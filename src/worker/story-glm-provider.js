import {GLM_MODEL_ID,GLM_PROVIDER_ROUTE,STORY_LIMITS} from './story-config.js';
import {readStoryPreview} from '../game/cultivation/live/story-preview.js';
const ZHIPU_MODEL=GLM_PROVIDER_ROUTE.primaryModelId;
const ZHIPU_URL='https://open.bigmodel.cn/api/paas/v4/chat/completions';
const encoder=new TextEncoder();
const fault=code=>Object.assign(new Error(code),{code});
const numericCode=error=>Number(error?.code??error?.errors?.[0]?.code??error?.status??/^(3036|4006|3040|429): /.exec(error?.message??'')?.[1]);

// A trusted server-only transport. It returns one ordinary completion to the
// existing validator; no partial scene can reach the archive commit path.
export function createGlmTransport({ai,apiKey,fetch:fetcher=globalThis.fetch,onProgress=()=>{},providerGate,queueTimeoutMs=10000,gateRpcTimeoutMs=2000,deadlineAt=Infinity,signal,timeoutMs=STORY_LIMITS.timeoutMs,primaryTimeoutMs=Math.min(45000,timeoutMs/2)}={}) {
  let source='zhipu',accountingUnknown=false,primaryStreamOpened=false;
  const started=Date.now(),endsAt=Math.min(started+timeoutMs,deadlineAt);
  function assertActive(){if(signal?.aborted||Date.now()>=endsAt)throw fault('PROVIDER_TIMEOUT');}
  async function callGate(method,input,deadline){
    assertActive();let active=true,timer,abort;
    const until=Math.min(deadline,endsAt,Date.now()+Math.min(2000,gateRpcTimeoutMs));
    if(Date.now()>=until)throw fault('BUDGET_UNAVAILABLE');
    const operation=Promise.resolve().then(()=>providerGate[method](input)).then(value=>{
      // A timed-out admission may still have committed. It must never infer;
      // clearing that unused owner is safe even if another lease replaced it.
      if(!active&&method==='acquireProvider'&&value?.kind==='acquired'&&value.owner===input.owner)Promise.resolve().then(()=>providerGate.releaseProvider({owner:input.owner,outcome:'complete'})).catch(()=>{});
      return value;
    });
    try{return await Promise.race([operation,new Promise((_,reject)=>{
      abort=()=>reject(fault('PROVIDER_TIMEOUT'));
      timer=setTimeout(()=>reject(fault(Date.now()>=endsAt?'PROVIDER_TIMEOUT':'BUDGET_UNAVAILABLE')),Math.max(1,until-Date.now()));
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    })]);}catch(error){throw fault(error?.code==='PROVIDER_TIMEOUT'?'PROVIDER_TIMEOUT':'BUDGET_UNAVAILABLE');}
    finally{active=false;clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);}
  }
  async function consume(factory,model,deadline){
    const controller=new AbortController();let reader,timer,abort,active=true;
    let text='',preview='',byteLength=0,usage,finishReason,reasoning='',modelSeen=false,ended=false;
    const operation=(async()=>{
      assertActive();const stream=await factory(controller.signal);
      if(!active){await stream?.cancel?.().catch(()=>{});throw fault('PROVIDER_TIMEOUT');}
      if(typeof stream?.getReader!=='function')throw fault('PROVIDER_RESPONSE_INVALID');
      if(source==='zhipu')primaryStreamOpened=true;
      reader=stream.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let buffer='';
      function frame(raw){
        const data=raw.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
        if(!data)return;
        if(ended)throw fault('PROVIDER_RESPONSE_INVALID');
        if(data==='[DONE]'){ended=true;return;}
        let item;try{item=JSON.parse(data);}catch{throw fault('PROVIDER_RESPONSE_INVALID');}
        if(!item||typeof item!=='object'||Array.isArray(item))throw fault('PROVIDER_RESPONSE_INVALID');
        if(item.error)throw fault(numericCode(item.error)||'PROVIDER_FAILED');
        if(item.model!==undefined){if(item.model!==model)throw fault('MODEL_RESPONSE_MISMATCH');modelSeen=true;}
        if(item.usage)usage=item.usage;
        if(item.choices!==undefined&&(!Array.isArray(item.choices)||item.choices.length>1))throw fault('PROVIDER_RESPONSE_INVALID');
        const choice=item.choices?.[0],delta=choice?.delta;
        if(choice!==undefined&&(!choice||typeof choice!=='object'||Array.isArray(choice)||finishReason!==undefined))throw fault('PROVIDER_RESPONSE_INVALID');
        if(delta!==undefined&&delta!==null&&(typeof delta!=='object'||Array.isArray(delta)))throw fault('PROVIDER_RESPONSE_INVALID');
        if(choice?.index!==undefined&&choice.index!==0)throw fault('PROVIDER_RESPONSE_INVALID');
        if(choice?.finish_reason)finishReason=choice.finish_reason;
        if(!delta)return;
        if(delta.tool_calls?.length)throw fault('PROVIDER_RESPONSE_INVALID');
        for(const key of ['reasoning','reasoning_content'])if(delta[key]!==undefined&&delta[key]!==null){
          if(typeof delta[key]!=='string'||/\S/u.test(delta[key]))throw fault('PROVIDER_RESPONSE_INVALID');
          reasoning+=delta[key];
        }
        for(const key of ['reasoning_details','thinking','thinking_content'])if(delta[key]!==undefined&&delta[key]!==null&&!(typeof delta[key]==='string'&&!/\S/u.test(delta[key])))throw fault('PROVIDER_RESPONSE_INVALID');
        if(delta.content!==undefined&&delta.content!==null){
          if(typeof delta.content!=='string')throw fault('PROVIDER_RESPONSE_INVALID');
          text+=delta.content;
          if(encoder.encode(text).length>STORY_LIMITS.maxResponseBytes)throw fault('PROVIDER_RESPONSE_TOO_LARGE');
          const next=readStoryPreview(text);
          if(/<\/?(?:think|thinking|analysis|reasoning)(?:\s|>)/iu.test(next))throw fault('PROVIDER_RESPONSE_INVALID');
          if(active&&modelSeen&&next!==preview){preview=next;onProgress({type:'preview',text:preview});}
        }
      }
      for(;;){
        const chunk=await reader.read();if(!active)throw fault('PROVIDER_TIMEOUT');
        if(chunk.done){try{buffer+=decoder.decode();}catch{throw fault('PROVIDER_RESPONSE_INVALID');}break;}
        byteLength+=chunk.value.byteLength;if(byteLength>STORY_LIMITS.maxResponseBytes*4)throw fault('PROVIDER_RESPONSE_TOO_LARGE');
        try{buffer+=decoder.decode(chunk.value,{stream:true});}catch{throw fault('PROVIDER_RESPONSE_INVALID');}buffer=buffer.replaceAll('\r\n','\n');
        let end;while((end=buffer.indexOf('\n\n'))>=0){frame(buffer.slice(0,end));buffer=buffer.slice(end+2);}
      }
      if(buffer.trim()||!ended)throw fault('PROVIDER_RESPONSE_INVALID');
      if(!modelSeen)throw fault('MODEL_RESPONSE_MISMATCH');
      if(!usage||!['prompt_tokens','completion_tokens','total_tokens'].every(key=>Number.isSafeInteger(usage[key])&&usage[key]>=0)||usage.total_tokens!==usage.prompt_tokens+usage.completion_tokens)accountingUnknown=true;
      return {model:GLM_MODEL_ID,choices:[{finish_reason:finishReason,message:{content:text,reasoning_content:reasoning}}],...(usage?{usage}:{})};
    })();
    try{return await Promise.race([operation,new Promise((_,reject)=>{abort=()=>{controller.abort();reject(fault('PROVIDER_TIMEOUT'));};timer=setTimeout(abort,Math.max(1,Math.min(deadline,endsAt-Date.now())));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();})]);}
    catch(error){if(reader)accountingUnknown=true;throw error;}
    finally{active=false;clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);controller.abort();reader?.cancel().catch(()=>{});}
  }
  return {
    get source(){return source;},get accountingUnknown(){return accountingUnknown;},
    async run(model,input){
      if(model!==GLM_MODEL_ID)throw fault('MODEL_NOT_ALLOWED');
      onProgress({type:'status',status:'generating'});
      try{
        if(typeof apiKey!=='string'||!apiKey.trim())throw fault('ZHIPU_KEY_MISSING');
        let owner,outcome='unknown';
        try{
          if(typeof providerGate?.acquireProvider!=='function'||typeof providerGate?.releaseProvider!=='function')throw fault('BUDGET_UNAVAILABLE');
          const candidate=crypto.randomUUID(),queueDeadline=Math.min(endsAt,Date.now()+Math.max(1,Math.min(10000,queueTimeoutMs)));let queued=false;
          for(;;){
            if(queued&&Date.now()>=queueDeadline)throw fault('PROVIDER_BUSY');
            const lease=await callGate('acquireProvider',{owner:candidate},queueDeadline);
            if(lease?.kind==='acquired'&&lease.owner===candidate&&Number.isSafeInteger(lease.expiresAt)){
              owner=candidate;
              if(signal?.aborted||Date.now()>=endsAt){outcome='complete';throw fault('PROVIDER_TIMEOUT');}
              if(Date.now()>queueDeadline){outcome='complete';throw fault('PROVIDER_BUSY');}
              break;
            }
            if(lease?.kind!=='waiting'||!Number.isSafeInteger(lease.retryAt))throw fault('BUDGET_UNAVAILABLE');
            if(Date.now()>=queueDeadline)throw fault('PROVIDER_BUSY');
            if(!queued){queued=true;onProgress({type:'status',status:'queued'});}
            await new Promise(resolve=>setTimeout(resolve,Math.min(1000,queueDeadline-Date.now())));
          }
          onProgress({type:'status',status:'generating'});
        const body={model:ZHIPU_MODEL,messages:input.messages,stream:true,temperature:input.temperature,max_tokens:input.max_tokens,thinking:{type:'disabled'},response_format:{type:'json_object'}};
        const result=await consume(async signal=>{
          assertActive();let response;try{response=await fetcher(ZHIPU_URL,{method:'POST',headers:{Authorization:'Bearer '+apiKey.trim(),'Content-Type':'application/json'},body:JSON.stringify(body),signal,redirect:'manual'});}catch(error){if(error?.name==='AbortError')throw fault('PROVIDER_TIMEOUT');throw fault('PROVIDER_FAILED');}
          if(!response.ok){
            let code;const errorReader=response.body?.getReader();
            try{
              let text='',bytes=0;const decoder=new TextDecoder();
              while(errorReader){const item=await errorReader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>4096)break;text+=decoder.decode(item.value,{stream:true});}
              if(bytes<=4096)code=JSON.parse(text).error?.code;
            }catch{}finally{await errorReader?.cancel().catch(()=>{});}
            const limited=response.status===429||['1302','1305'].includes(String(code));
            outcome=limited?(String(code)==='1302'?'rate-limited':'overloaded'):response.status<500?'complete':'unknown';
            throw fault(limited?'PROVIDER_BUSY':'PROVIDER_FAILED');
          }
          if(!response.headers.get('content-type')?.includes('text/event-stream')){await response.body?.cancel();throw fault('PROVIDER_RESPONSE_INVALID');}
          return response.body;
        },ZHIPU_MODEL,Math.min(primaryTimeoutMs,endsAt-Date.now()));
        outcome='complete';return result;
        }finally{
          if(owner){const released=await callGate('releaseProvider',{owner,outcome},endsAt);if(released?.kind!=='released')throw fault('BUDGET_UNAVAILABLE');}
        }
      }catch(error){
        const code=numericCode(error),eligible=[3036,4006,3040,429,500,502,503,504].includes(code)||['PROVIDER_TIMEOUT','PROVIDER_FAILED','PROVIDER_BUSY','ZHIPU_KEY_MISSING'].includes(error?.code)||error instanceof TypeError;
        accountingUnknown=primaryStreamOpened||![3036,4006,3040,429].includes(code)&&!['ZHIPU_KEY_MISSING','PROVIDER_BUSY'].includes(error?.code);
        if(!eligible)throw error;
        assertActive();const remaining=endsAt-Date.now()-50;if(remaining<=0)throw error;
        source='cloudflare';onProgress({type:'reset'});onProgress({type:'status',status:'switching'});
        return consume(()=>{assertActive();if(typeof ai?.run!=='function')throw fault('AI_BINDING_MISSING');return ai.run(GLM_MODEL_ID,input);},GLM_MODEL_ID,remaining);
      }
    },
  };
}
