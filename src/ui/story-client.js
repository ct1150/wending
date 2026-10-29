// Browser transport: credentials remain in the same-origin HttpOnly cookie.
const LIMITS = {maxRequestBytes:32768,maxResponseBytes:65536,maxContextBytes:7000,timeoutMs:105000};
const error = code => Object.assign(new Error(code), {code});
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/.test(value);
export function createStoryClient({fetch:fetcher=globalThis.fetch,location=globalThis.location,timeoutMs=LIMITS.timeoutMs}={}) {
  let limits={...LIMITS};
  async function json(path,body,streaming) {
    if(location?.protocol!=='https:') throw error('SERVICE_UNAVAILABLE');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Math.min(timeoutMs,limits.timeoutMs));
    let reader;
    try {
      const serialized=body===undefined?undefined:JSON.stringify(body);
      if(serialized && new TextEncoder().encode(serialized).length>limits.maxRequestBytes)throw error('REQUEST_TOO_LARGE');
      const response=await fetcher('/api/story/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,...(serialized?{headers:{'Content-Type':'application/json',...(streaming?{Accept:'text/event-stream','X-Story-Queue-Status':'1'}:{})},body:serialized}:{})});
      if(streaming&&response.ok&&response.headers.get('content-type')?.includes('text/event-stream')){
        reader=response.body?.getReader();if(!reader)throw error('PROTOCOL_MISMATCH');
        const decoder=new TextDecoder('utf-8',{fatal:true});let buffer='',length=0,result,previewLength=0;
        function packet(frame){
          const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
          if(!data)return;
          let value;try{value=JSON.parse(data);}catch{throw error('PROTOCOL_MISMATCH');}
          if(value?.protocolVersion!==1||!['status','reset','preview','result'].includes(value.type)||result)throw error('PROTOCOL_MISMATCH');
          if(value.requestId!==streaming.requestId||value.attemptId!==streaming.attemptId||value.sessionRef!==streaming.sessionRef)throw error('RESPONSE_IDENTITY_MISMATCH');
          const extra=value.type==='status'?['status']:value.type==='preview'?['text']:value.type==='result'?['result']:[];
          if(Object.keys(value).some(key=>!['protocolVersion','requestId','attemptId','sessionRef','type',...extra].includes(key)))throw error('PROTOCOL_MISMATCH');
          if(value.type==='result'){result=turn(value.result,{identity:{requestId:streaming.requestId}},{id:streaming.attemptId,sessionRef:streaming.sessionRef});if(result.requestId!==streaming.requestId||result.attemptId!==streaming.attemptId||result.sessionRef!==streaming.sessionRef)throw error('RESPONSE_IDENTITY_MISMATCH');}
          else {
            if(value.type==='status'&&!['generating','switching','queued'].includes(value.status))throw error('PROTOCOL_MISMATCH');
            if(value.type==='reset')previewLength=0;
            if(value.type==='preview'){if(typeof value.text!=='string')throw error('PROTOCOL_MISMATCH');previewLength+=value.text.length;if(previewLength>24000)throw error('RESPONSE_TOO_LARGE');}
            streaming.onProgress(value.type==='preview'?{type:'preview',text:value.text}:value.type==='status'?{type:'status',status:value.status}:{type:'reset'});
          }
        }
        for(;;){
          const {done,value}=await reader.read();if(done){buffer+=decoder.decode();break;}
          length+=value.byteLength;if(length>limits.maxResponseBytes*4)throw error('RESPONSE_TOO_LARGE');
          buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');
          let end;while((end=buffer.indexOf('\n\n'))!==-1){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);if(new TextEncoder().encode(frame).length>limits.maxResponseBytes+1024)throw error('RESPONSE_TOO_LARGE');packet(frame);}
          if(new TextEncoder().encode(buffer).length>limits.maxResponseBytes+1024)throw error('RESPONSE_TOO_LARGE');
        }
        if(buffer.trim()||!result)throw error('NETWORK_UNAVAILABLE');
        return result;
      }
      if(!response.headers.get('content-type')?.includes('application/json'))throw error('PROTOCOL_MISMATCH');
      reader=response.body?.getReader();if(!reader)throw error('PROTOCOL_MISMATCH');
      const chunks=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limits.maxResponseBytes){await reader.cancel();throw error('RESPONSE_TOO_LARGE');}chunks.push(value);}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let result;try{result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw error('PROTOCOL_MISMATCH');}
      if(result?.protocolVersion!==1)throw error('PROTOCOL_MISMATCH');
      if(!response.ok && !['paused','rejected'].includes(result.status))throw error('SERVICE_UNAVAILABLE');
      return result;
    } catch(e) { try{await reader?.cancel();}catch{} if(e.code && /^[A-Z_]+$/.test(e.code))throw e;throw error(e.name==='AbortError'?'PROVIDER_TIMEOUT':'NETWORK_UNAVAILABLE'); }
    finally { clearTimeout(timer); }
  }
  async function capabilities(){try{const value=await json('capabilities');if(typeof value.available!=='boolean'||value.status!==(value.available?'ready':'paused')||!value.limits||Object.entries(LIMITS).some(([key,max])=>!Number.isSafeInteger(value.limits[key])||value.limits[key]<=0||value.limits[key]>max))throw error('PROTOCOL_MISMATCH');if(value.available&&value.errorCode!==null)throw error('PROTOCOL_MISMATCH');limits={...value.limits};return value;}catch(e){return {protocolVersion:1,available:false,status:'paused',errorCode:e.code};}}
  async function createSession(){const value=await json('session',{protocolVersion:1});if(value.status!=='ready')throw error(value.errorCode||'SESSION_UNAVAILABLE');if(!identifier(value.sessionRef)||!Number.isSafeInteger(value.expiresAt))throw error('PROTOCOL_MISMATCH');return value;}
  function turn(value,pending,attempt) {
    if(value?.protocolVersion!==1)throw error('PROTOCOL_MISMATCH');
    if(!['ready','paused','rejected'].includes(value.status)||typeof value.errorCode!=='string'&&value.errorCode!==null)throw error('PROTOCOL_MISMATCH');
    const matches=value.requestId===pending.identity.requestId&&value.attemptId===attempt.id&&value.sessionRef===attempt.sessionRef;
    if(value.errorCode==='ATTEMPT_NOT_ADMITTED'&&(value.status!=='paused'||!matches))throw error('RESPONSE_IDENTITY_MISMATCH');
    if(value.status==='ready'&&(value.errorCode!==null||!matches||!value.scene||value.retry!==null))throw error('RESPONSE_IDENTITY_MISMATCH');
    return value;
  }
  async function requestTurn(pending,context,attempt,{onProgress}={}){if(new TextEncoder().encode(JSON.stringify(context)).length>limits.maxContextBytes)throw error('REQUEST_TOO_LARGE');return turn(await json('turn',{context,attempt},typeof onProgress==='function'?{requestId:pending.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,onProgress}:null),pending,attempt);}
  async function getTurn(pending,attempt){return turn(await json('turn/'+encodeURIComponent(pending.identity.requestId)+'?attemptId='+encodeURIComponent(attempt.id)),pending,attempt);}
  return {capabilities,createSession,requestTurn,getTurn};
}
