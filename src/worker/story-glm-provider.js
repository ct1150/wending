import {GLM_MODEL_ID,STORY_LIMITS} from './story-config.js';
import {readStoryPreview,readStoryPresentation} from '../game/cultivation/live/story-preview.js';
const encoder=new TextEncoder();
const fault=code=>Object.assign(new Error(code),{code});
const numericCode=error=>Number(error?.code??error?.errors?.[0]?.code??error?.status??/^(3036|4006|3040|429): /.exec(error?.message??'')?.[1]);

// A trusted server-only transport. It returns one ordinary completion to the
// existing validator; no partial scene can reach the archive commit path.
export function createGlmTransport({ai,context,onProgress=()=>{},deadlineAt=Infinity,signal,timeoutMs=STORY_LIMITS.timeoutMs}={}) {
  let accountingUnknown=false;
  const started=Date.now(),endsAt=Math.min(started+timeoutMs,deadlineAt);
  function assertActive(){if(signal?.aborted||Date.now()>=endsAt)throw fault('PROVIDER_TIMEOUT');}
  async function consume(factory,model,deadline){
    const controller=new AbortController();let reader,timer,abort,active=true;
    let text='',preview='',presentation='{"blocks":[],"choices":[]}',byteLength=0,usage,finishReason,reasoning='',modelSeen=false,ended=false;
    const operation=(async()=>{
      assertActive();const stream=await factory(controller.signal);
      if(!active){await stream?.cancel?.().catch(()=>{});throw fault('PROVIDER_TIMEOUT');}
      if(typeof stream?.getReader!=='function')throw fault('PROVIDER_RESPONSE_INVALID');
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
          const next=readStoryPreview(text),draft=readStoryPresentation(text,context),serialized=JSON.stringify(draft);
          if(/<\/?(?:think|thinking|analysis|reasoning)(?:\s|>)/iu.test(next+'\n'+draft.blocks.map(block=>(block.speaker??'')+'\n'+block.text).join('\n')+'\n'+draft.choices.map(choice=>choice.label).join('\n')))throw fault('PROVIDER_RESPONSE_INVALID');
          // Structured consumers receive the row's type and speaker before any
          // text-only compatibility event can reach an older renderer.
          if(active&&modelSeen&&serialized!==presentation){presentation=serialized;onProgress({type:'presentation',...draft});}
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
    get source(){return 'cloudflare';},get accountingUnknown(){return accountingUnknown;},
    async run(model,input){
      if(model!==GLM_MODEL_ID)throw fault('MODEL_NOT_ALLOWED');
      onProgress({type:'status',status:'generating'});
      return consume(()=>{assertActive();if(typeof ai?.run!=='function')throw fault('AI_BINDING_MISSING');return ai.run(GLM_MODEL_ID,input);},GLM_MODEL_ID,endsAt-Date.now());
    },
  };
}
