import {GLM_MODEL_ID,STORY_LIMITS} from './story-config.js';
import {readStoryPreview,readStoryPresentation} from '../game/cultivation/live/story-preview.js';
const encoder=new TextEncoder();
// Tokens, decoded model text, and HTTP/SSE framing are different units. A
// provider may repeat a full chat-completion envelope for every output token.
const maxEvents=2*STORY_LIMITS.maxOutputTokens+64;
const maxEventBytes=6*STORY_LIMITS.maxResponseBytes+4096; // JSON can escape a byte as \u00xx.
const maxWireBytes=maxEventBytes+(STORY_LIMITS.maxOutputTokens+64)*1024;
const fault=code=>Object.assign(new Error(code),{code});
const numericCode=error=>Number(error?.code??error?.errors?.[0]?.code??error?.status??/^(3036|4006|3040|429): /.exec(error?.message??'')?.[1]);

// A trusted server-only transport. It returns one ordinary completion to the
// existing validator; no partial scene can reach the archive commit path.
export function createGlmTransport({ai,context,authoredChoices=false,onProgress=()=>{},deadlineAt=Infinity,signal,timeoutMs=STORY_LIMITS.timeoutMs}={}) {
  let accountingUnknown=false;
  const started=Date.now(),endsAt=Math.min(started+timeoutMs,deadlineAt);
  function assertActive(){if(signal?.aborted||Date.now()>=endsAt)throw fault('PROVIDER_TIMEOUT');}
  async function consume(factory,model,deadline){
    const controller=new AbortController();let reader,timer,abort,active=true;
    let text='',preview='',presentation='{"blocks":[],"choices":[]}',wireBytes=0,contentBytes=0,reasoningBytes=0,trailingHigh=false,usage,finishReason,reasoning='',modelSeen=false,ended=false;
    const operation=(async()=>{
      assertActive();const stream=await factory(controller.signal);
      if(!active){await stream?.cancel?.().catch(()=>{});throw fault('PROVIDER_TIMEOUT');}
      if(typeof stream?.getReader!=='function')throw fault('PROVIDER_RESPONSE_INVALID');
      reader=stream.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});
      let event=new Uint8Array(1024),used=0,lineStart=0,eventCount=0,emptyReads=0;
      function append(bytes){
        const required=used+bytes.length;
        if(required>maxEventBytes)throw fault('PROVIDER_RESPONSE_TOO_LARGE');
        if(required>event.length){
          const next=new Uint8Array(Math.min(maxEventBytes,Math.max(2*event.length,required)));
          next.set(event.subarray(0,used));event=next;
        }
        event.set(bytes,used);used=required;
      }
      function decode(bytes){try{return decoder.decode(bytes);}catch{throw fault('PROVIDER_RESPONSE_INVALID');}}
      let inspectedBytes=-1,inspectedAt=0,inspectedModel=false,displayedBlocks=[];
      function previewContent(force=false){
        if(contentBytes===inspectedBytes&&modelSeen===inspectedModel)return;
        const now=Date.now();
        // Preserve the first and final draft. Coalesce only rapid, tiny deltas
        // so a fast token stream does not parse both JSON previews per token.
        if(!force&&inspectedBytes>=0&&modelSeen===inspectedModel&&contentBytes-inspectedBytes<64&&now-inspectedAt<32)return;
        inspectedBytes=contentBytes;inspectedAt=now;inspectedModel=modelSeen;
        const next=readStoryPreview(text),draft=readStoryPresentation(text,context,{authoredChoices});
        const serialized=JSON.stringify(draft);
        if(/<\/?(?:think|thinking|analysis|reasoning)(?:\s|>)/iu.test(next+'\n'+draft.blocks.map(block=>(block.speaker??'')+'\n'+block.text).join('\n')+'\n'+draft.choices.map(choice=>choice.label).join('\n')))throw fault('PROVIDER_RESPONSE_INVALID');
        if(!active||!modelSeen)return;
        // The HTTP writer resets all rows if a snapshot shrinks. A damaged
        // later field must not retract already displayed, individually closed
        // blocks. An unfinished row stays a draft until the parser closes it.
        const hasClosed=displayedBlocks.some(row=>row.complete);
        if(hasClosed&&(draft.blocks.length<displayedBlocks.length||displayedBlocks.some((row,i)=>{
          const now=draft.blocks[i];
          return row.complete&&(!now?.complete||now.kind!==row.kind||now.speaker!==row.speaker||now.text!==row.text);
        })))return;
        if(serialized!==presentation){
          presentation=serialized;
          displayedBlocks=draft.blocks.map(row=>({...row}));
          onProgress({type:'presentation',...draft});
        }
        // Text-only subscribers also interpret a non-prefix update as reset.
        if(next!==preview&&(!hasClosed||next.startsWith(preview))){preview=next;onProgress({type:'preview',text:preview});}
      }
      function frame(raw){
        const data=raw.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
        if(!data)return;
        if(ended)throw fault('PROVIDER_RESPONSE_INVALID');
        if(data==='[DONE]'){previewContent(true);ended=true;return;}
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
          reasoningBytes+=encoder.encode(delta[key]).length;
          if(reasoningBytes>STORY_LIMITS.maxResponseBytes)throw fault('PROVIDER_RESPONSE_TOO_LARGE');
          reasoning+=delta[key];
        }
        for(const key of ['reasoning_details','thinking','thinking_content'])if(delta[key]!==undefined&&delta[key]!==null&&!(typeof delta[key]==='string'&&!/\S/u.test(delta[key])))throw fault('PROVIDER_RESPONSE_INVALID');
        if(delta.content!==undefined&&delta.content!==null){
          if(typeof delta.content!=='string')throw fault('PROVIDER_RESPONSE_INVALID');
          if(delta.content){
            // Adjacent JS strings may complete one surrogate pair: encoding
            // separately counts two replacement characters (6 bytes) vs 4.
            const first=delta.content.charCodeAt(0),last=delta.content.charCodeAt(delta.content.length-1);
            const joined=trailingHigh&&first>=0xdc00&&first<=0xdfff;
            trailingHigh=last>=0xd800&&last<=0xdbff;
            contentBytes+=encoder.encode(delta.content).length-(joined?2:0);
            if(contentBytes>STORY_LIMITS.maxResponseBytes)throw fault('PROVIDER_RESPONSE_TOO_LARGE');
            text+=delta.content;previewContent();
          }
        }
      }
      for(;;){
        assertActive();const chunk=await reader.read();if(!active)throw fault('PROVIDER_TIMEOUT');
        if(chunk.done)break;
        const value=chunk.value,bytes=ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):value instanceof ArrayBuffer?new Uint8Array(value):null;
        if(!bytes)throw fault('PROVIDER_RESPONSE_INVALID');
        wireBytes+=bytes.length;if(wireBytes>maxWireBytes)throw fault('PROVIDER_RESPONSE_TOO_LARGE');
        if(!bytes.length){if(++emptyReads>64)throw fault('PROVIDER_RESPONSE_INVALID');continue;}emptyReads=0;
        // Chunk boundaries are unrelated to UTF-8 characters, lines or events.
        // Scan each byte once, retaining at most one bounded incomplete event.
        for(let from=0;from<bytes.length;){
          const lf=bytes.indexOf(10,from),end=lf===-1?bytes.length:lf+1;
          append(bytes.subarray(from,end));from=end;
          if(lf===-1)break;
          if(used-lineStart===1||used-lineStart===2&&event[lineStart]===13){
            if(++eventCount>maxEvents)throw fault('PROVIDER_RESPONSE_TOO_LARGE');
            frame(decode(event.subarray(0,lineStart)).replaceAll('\r\n','\n'));
            used=0;lineStart=0;
          }else lineStart=used;
        }
      }
      if((used&&decode(event.subarray(0,used)).trim())||!ended)throw fault('PROVIDER_RESPONSE_INVALID');
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
