import { STORY_LIMITS, CANDIDATE_PROFILE, assertProviderReady } from './story-config.js';
import { generateScene } from './story-provider.js';
import { validateStoryContext,validateGeneratedScene } from '../game/cultivation/live/memory.js';
import { assertPlainData,canonicalStringify,sha256 } from '../game/cultivation/live/identity.js';
import { exactKeys,idField } from '../game/cultivation/live/schema.js';

export const STORY_COOKIE='__Host-story_session';
export const STORY_API_LIMITS=Object.freeze({maxRequestBytes:32768,maxResponseBytes:65536,maxContextBytes:7000,timeoutMs:30000});
// Reserve the full permitted serialized prompt, including schema/system fields,
// maximum message framing and output. No client chooses a model/rate/budget.
export const TURN_RESERVATION_NEURONS=Math.ceil(((STORY_LIMITS.maxInputBytes+1024+64*STORY_LIMITS.maxMessages)*CANDIDATE_PROFILE.neuronRates.inputPerMillion+STORY_LIMITS.maxOutputTokens*CANDIDATE_PROFILE.neuronRates.outputPerMillion)/1000000);
const encoder=new TextEncoder();
const allowedCodes=new Set(['INFERENCE_DISABLED','MODEL_NOT_ALLOWED','MODEL_UNVALIDATED','AI_BINDING_MISSING','FREE_BOUNDARY_UNVERIFIED','ACCOUNT_QUOTA_UNAVAILABLE','INPUT_TOO_LARGE','CONTEXT_TOO_LARGE','OUTPUT_TOO_LARGE','PROVIDER_PROFILE_INVALID','PROVIDER_OPTIONS_INVALID','PROVIDER_TIMEOUT','PROVIDER_RESPONSE_INVALID','PROVIDER_RESPONSE_TOO_LARGE','MODEL_RESPONSE_MISMATCH','OUTPUT_TRUNCATED','STOP_REASON_INVALID','PROVIDER_USAGE_INVALID','FREE_QUOTA_EXHAUSTED','PROVIDER_BUSY','PROVIDER_FAILED','GENERATED_SCENE_INVALID','NEXT_CONTEXT_TOO_LARGE','BUDGET_UNAVAILABLE']);
const codeOf=(error,fallback='SERVICE_UNAVAILABLE')=>allowedCodes.has(error?.code)?error.code:fallback;
const fail=(code,httpStatus=400)=>{throw Object.assign(new Error(code),{code,httpStatus});};
const randomHex=length=>Array.from(crypto.getRandomValues(new Uint8Array(length)),n=>n.toString(16).padStart(2,'0')).join('');
function cookieHash(request){const values=(request.headers.get('cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(STORY_COOKIE+'='));if(values.length!==1)return null;const token=values[0].slice(STORY_COOKIE.length+1);return /^[a-f0-9]{64}$/.test(token)?sha256(token):null;}
function envelope(status,errorCode=null,identity={}){const {requestId=null,attemptId=null,sessionRef=null}=identity;return {protocolVersion:1,status,requestId,attemptId,sessionRef,errorCode,retry:status==='paused'?{explicit:true,afterMs:errorCode==='ATTEMPT_IN_PROGRESS'?30000:errorCode==='PROVIDER_BUSY'?5000:0,previousAttemptId:attemptId,previousSessionRef:sessionRef}:null};}
function json(value,status=200,extra={}){const text=JSON.stringify(value);if(encoder.encode(text).length>STORY_LIMITS.maxResponseBytes)return json(envelope('rejected','RESPONSE_TOO_LARGE'),200);return new Response(text,{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});}
async function readJson(request){
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??'')||request.headers.has('content-encoding'))fail('CONTENT_TYPE_INVALID',415);
  const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>STORY_LIMITS.maxRequestBytes))fail('REQUEST_TOO_LARGE',413);
  if(!request.body)fail('REQUEST_INVALID');
  const reader=request.body.getReader(),parts=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>STORY_LIMITS.maxRequestBytes){await reader.cancel();fail('REQUEST_TOO_LARGE',413);}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  try {const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));assertPlainData(result);return result;}catch{fail('REQUEST_INVALID');}
}
function validateTurn(body){try {exactKeys(body,['context','attempt']);validateStoryContext(body.context);exactKeys(body.attempt,['id','sessionRef','retryOf']);idField(body.attempt.id);idField(body.attempt.sessionRef);if(body.attempt.retryOf!==null){exactKeys(body.attempt.retryOf,['attemptId','sessionRef']);idField(body.attempt.retryOf.attemptId);idField(body.attempt.retryOf.sessionRef);}}catch{fail('REQUEST_INVALID');}}

// Dependencies here are trusted server composition seams. Only index.js is the
// deployed entry and it installs the non-overridable production readiness gate.
export function createStoryApi({provider=generateScene,budget,config={}}={}){
  const readiness=config.readiness??(env=>assertProviderReady({enabled:config.enabled===true,env,evidence:config.evidence,now:(config.now??Date.now)()}));
  async function callBudget(method,input){if(typeof budget?.[method]!=='function')throw Object.assign(new Error('BUDGET_UNAVAILABLE'),{code:'BUDGET_UNAVAILABLE'});return await budget[method](input);}
  return {async fetch(request,env={},ctx){
    let identity={};
    try {
      const url=new URL(request.url),path=url.pathname;
      const capabilities=path==='/api/story/capabilities',sessionPath=path==='/api/story/session',turnPath=path==='/api/story/turn',lookupPath=/^\/api\/story\/turn\/[^/]+$/.test(path);
      if(!capabilities&&!sessionPath&&!turnPath&&!lookupPath)return json(envelope('rejected','NOT_FOUND'),404);
      const method=capabilities||lookupPath?'GET':'POST';if(request.method!==method)return json(envelope('rejected','METHOD_NOT_ALLOWED'),405,{allow:method});
      if(url.protocol!=='https:'||request.headers.get('sec-fetch-site')==='cross-site'||request.headers.has('origin')&&request.headers.get('origin')!==url.origin||method==='POST'&&request.headers.get('origin')!==url.origin)return json(envelope('rejected','ORIGIN_INVALID'),403);
      if(!lookupPath&&url.search)return json(envelope('rejected','REQUEST_INVALID'),400);
      if(capabilities){let errorCode=null;try{await readiness(env);}catch(error){errorCode=codeOf(error);}return json({protocolVersion:1,available:errorCode===null,status:errorCode?'paused':'ready',errorCode,limits:STORY_API_LIMITS});}
      const ipHash=sha256(request.headers.get('cf-connecting-ip')??'unknown');
      const admission=await callBudget('admit',{ipHash});if(admission.kind==='denied')return json(envelope('paused',admission.code),429);
      let body;if(method==='POST')body=await readJson(request);
      if(sessionPath){
        try{exactKeys(body,['protocolVersion']);if(body.protocolVersion!==1)fail('REQUEST_INVALID');}catch{fail('REQUEST_INVALID');}
        try{await readiness(env);}catch(error){return json(envelope('paused',codeOf(error)));}
        const tokenHash=cookieHash(request),existing=tokenHash?await callBudget('getSession',{tokenHash}):null;
        if(existing?.kind==='session')return json({protocolVersion:1,status:'ready',sessionRef:existing.sessionRef,expiresAt:existing.expiresAt});
        const token=randomHex(32),sessionRef='sess_'+randomHex(16),created=await callBudget('createSession',{sessionRef,tokenHash:sha256(token),ipHash});
        if(created.kind==='denied')return json(envelope('paused',created.code),429);
        return json({protocolVersion:1,status:'ready',sessionRef,expiresAt:created.expiresAt},200,{'set-cookie':`${STORY_COOKIE}=${token}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Strict`});
      }
      if(turnPath){validateTurn(body);identity={requestId:body.context.identity.requestId,attemptId:body.attempt.id,sessionRef:body.attempt.sessionRef};}
      else {try{identity.requestId=decodeURIComponent(path.slice('/api/story/turn/'.length));identity.attemptId=url.searchParams.get('attemptId');idField(identity.requestId);idField(identity.attemptId);if([...url.searchParams].length!==1||!url.searchParams.has('attemptId'))fail('REQUEST_INVALID');}catch{fail('REQUEST_INVALID');}}
      const tokenHash=cookieHash(request);if(!tokenHash)return json(envelope('paused','SESSION_UNAVAILABLE',identity));
      const authenticated=await callBudget('getSession',{tokenHash,...(turnPath?{sessionRef:identity.sessionRef}:{})});
      if(authenticated.kind!=='session')return json(envelope('paused','SESSION_UNAVAILABLE',identity));
      identity.sessionRef=authenticated.sessionRef;
      const lookup=await callBudget('lookup',{...identity,tokenHash});
      if(lookupPath)return json(lookup.kind==='replay'?lookup.result:envelope('paused',lookup.code,identity));
      const reservationInput={...identity,tokenHash,ipHash,payloadHash:sha256(canonicalStringify(body)),contextHash:sha256(canonicalStringify(body.context)),reservedNeurons:TURN_RESERVATION_NEURONS,retryOf:body.attempt.retryOf};
      // Check duplicate payload before readiness, so cached results remain readable
      // when inference is disabled. reserve never adds another existing attempt.
      let profile;
      if(lookup.code!=='ATTEMPT_NOT_FOUND'){
        const repeated=await callBudget('reserve',reservationInput);
        return json(repeated.kind==='replay'?repeated.result:envelope(repeated.code==='ATTEMPT_PAYLOAD_MISMATCH'?'rejected':'paused',repeated.code,identity));
      }
      try{profile=await readiness(env);}catch(error){return json(envelope('paused',codeOf(error),identity));}
      const reserved=await callBudget('reserve',reservationInput);
      if(reserved.kind!=='reserved')return json(reserved.kind==='replay'?reserved.result:envelope(['ATTEMPT_PAYLOAD_MISMATCH','RETRY_INVALID'].includes(reserved.code)?'rejected':'paused',reserved.code,identity));
      let generated,timer;
      try {generated=await Promise.race([Promise.resolve().then(()=>provider(env.AI,profile,body.context,{attemptId:identity.attemptId})),new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'paused',errorCode:'PROVIDER_TIMEOUT',inferencePerformed:true}),STORY_LIMITS.timeoutMs);})]);}catch{generated={status:'paused',errorCode:'PROVIDER_FAILED',inferencePerformed:true};}finally{clearTimeout(timer);}
      let result;
      if(generated?.status==='ready'){
        try {const scene=validateGeneratedScene(generated.scene,body.context);result={...envelope('ready',null,identity),scene};if(encoder.encode(JSON.stringify(result)).length>STORY_LIMITS.maxResponseBytes)throw new Error();}catch{result=envelope('rejected','GENERATED_SCENE_INVALID',identity);}
      }else if(['paused','rejected'].includes(generated?.status))result=envelope(generated.status,allowedCodes.has(generated.errorCode)?generated.errorCode:'PROVIDER_FAILED',identity);
      else result=envelope('paused','PROVIDER_FAILED',identity);
      const status=['PROVIDER_TIMEOUT','PROVIDER_FAILED'].includes(result.errorCode)?'unknown':'complete';
      const settled=await callBudget('settle',{sessionRef:identity.sessionRef,attemptId:identity.attemptId,status,actualNeurons:null,result,quotaExhausted:result.errorCode==='FREE_QUOTA_EXHAUSTED'});
      if(settled.kind!=='settled')return json(envelope('paused','BUDGET_UNAVAILABLE',identity));
      return json(result);
    }catch(error){return json(envelope(error?.httpStatus?'rejected':'paused',error?.httpStatus?error.code:codeOf(error),identity),error?.httpStatus??200);}
  }};
}
