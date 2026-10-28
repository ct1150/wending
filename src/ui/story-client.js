// Browser transport: credentials remain in the same-origin HttpOnly cookie.
const LIMITS = {maxRequestBytes:32768,maxResponseBytes:65536,maxContextBytes:7000,timeoutMs:105000};
const error = code => Object.assign(new Error(code), {code});
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/.test(value);
export function createStoryClient({fetch:fetcher=globalThis.fetch,location=globalThis.location,timeoutMs=LIMITS.timeoutMs}={}) {
  let limits={...LIMITS};
  async function json(path,body) {
    if(location?.protocol!=='https:') throw error('SERVICE_UNAVAILABLE');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Math.min(timeoutMs,limits.timeoutMs));
    try {
      const serialized=body===undefined?undefined:JSON.stringify(body);
      if(serialized && new TextEncoder().encode(serialized).length>limits.maxRequestBytes)throw error('REQUEST_TOO_LARGE');
      const response=await fetcher('/api/story/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,...(serialized?{headers:{'Content-Type':'application/json'},body:serialized}:{})});
      if(!response.headers.get('content-type')?.includes('application/json'))throw error('PROTOCOL_MISMATCH');
      const reader=response.body?.getReader();if(!reader)throw error('PROTOCOL_MISMATCH');
      const chunks=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limits.maxResponseBytes){await reader.cancel();throw error('RESPONSE_TOO_LARGE');}chunks.push(value);}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let result;try{result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw error('PROTOCOL_MISMATCH');}
      if(result?.protocolVersion!==1)throw error('PROTOCOL_MISMATCH');
      if(!response.ok && !['paused','rejected'].includes(result.status))throw error('SERVICE_UNAVAILABLE');
      return result;
    } catch(e) { if(e.code && /^[A-Z_]+$/.test(e.code))throw e;throw error(e.name==='AbortError'?'PROVIDER_TIMEOUT':'NETWORK_UNAVAILABLE'); }
    finally { clearTimeout(timer); }
  }
  async function capabilities(){try{const value=await json('capabilities');if(typeof value.available!=='boolean'||value.status!==(value.available?'ready':'paused')||!value.limits||Object.entries(LIMITS).some(([key,max])=>!Number.isSafeInteger(value.limits[key])||value.limits[key]<=0||value.limits[key]>max))throw error('PROTOCOL_MISMATCH');if(value.available&&value.errorCode!==null)throw error('PROTOCOL_MISMATCH');limits={...value.limits};return value;}catch(e){return {protocolVersion:1,available:false,status:'paused',errorCode:e.code};}}
  async function createSession(){const value=await json('session',{protocolVersion:1});if(value.status!=='ready')throw error(value.errorCode||'SESSION_UNAVAILABLE');if(!identifier(value.sessionRef)||!Number.isSafeInteger(value.expiresAt))throw error('PROTOCOL_MISMATCH');return value;}
  function turn(value,pending,attempt) {
    if(!['ready','paused','rejected'].includes(value.status)||typeof value.errorCode!=='string'&&value.errorCode!==null)throw error('PROTOCOL_MISMATCH');
    const matches=value.requestId===pending.identity.requestId&&value.attemptId===attempt.id&&value.sessionRef===attempt.sessionRef;
    if(value.errorCode==='ATTEMPT_NOT_ADMITTED'&&(value.status!=='paused'||!matches))throw error('RESPONSE_IDENTITY_MISMATCH');
    if(value.status==='ready'&&(value.errorCode!==null||!matches||!value.scene||value.retry!==null))throw error('RESPONSE_IDENTITY_MISMATCH');
    return value;
  }
  async function requestTurn(pending,context,attempt){if(new TextEncoder().encode(JSON.stringify(context)).length>limits.maxContextBytes)throw error('REQUEST_TOO_LARGE');return turn(await json('turn',{context,attempt}),pending,attempt);}
  async function getTurn(pending,attempt){return turn(await json('turn/'+encodeURIComponent(pending.identity.requestId)+'?attemptId='+encodeURIComponent(attempt.id)),pending,attempt);}
  return {capabilities,createSession,requestTurn,getTurn};
}
