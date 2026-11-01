// Recovery never reselects the player's action. A new inference is allowed
// only after the previous attempt has a terminal result, and its linked ID
// must be durable before POST. Older services keep the single-attempt path.
const retryable=new Set(['PROVIDER_TIMEOUT','PROVIDER_BUSY','PROVIDER_FAILED','PROVIDER_RESPONSE_INVALID','OUTPUT_TRUNCATED','GENERATED_SCENE_INVALID','CHOICE_NOT_COMPILABLE']);
const network=new Set(['NETWORK_UNAVAILABLE','PROVIDER_TIMEOUT','SERVICE_UNAVAILABLE']);
const fault=code=>Object.assign(Error(code),{code});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function requestRecoverableTurn({client,pending,context,attempt,storyActions=false,onProgress,replaceAttempt,automatic=false,onRecovery=()=>{},now=()=>Date.now(),sleep=pause,recoveryMs=125000,pollMs=1500}){
 let current=attempt;
 function identity(value){if(!automatic&&value?.status!=='ready')return value;if(value?.requestId!==pending.identity.requestId||value.attemptId!==current.id||value.sessionRef!==current.sessionRef)throw fault('RESPONSE_IDENTITY_MISMATCH');return value;}
 async function lookup(started){
  for(;;){
   try{
    const value=identity(await client.getTurn(pending,current));
    if(value.errorCode!=='ATTEMPT_IN_PROGRESS'||now()-started>=recoveryMs)return value;
   }catch(error){if(!network.has(error?.code)||now()-started>=recoveryMs)throw error;}
   await sleep(Math.min(pollMs,Math.max(1,started+recoveryMs-now())));
  }
 }
 const maxAttempts=automatic?4:1;
 for(let pass=0;pass<maxAttempts;pass++){
  const started=now();let value;
  try{value=identity(await client.requestTurn(pending,context,current,{storyActions,onProgress}));}
  catch(error){
   if(!automatic||!network.has(error?.code))throw error;
   onRecovery({kind:'reconnect',code:error.code});value=await lookup(started);
  }
  if(value.status==='ready'||pass===maxAttempts-1)return {result:value,attempt:current};
  if(value.errorCode==='PROVIDER_BUSY'||value.errorCode==='ATTEMPT_IN_PROGRESS')value=await lookup(started);
  if(value.status==='ready')return {result:value,attempt:current};
  const reuse=['ATTEMPT_NOT_ADMITTED','ATTEMPT_NOT_FOUND'].includes(value.errorCode);
  if(!reuse&&!retryable.has(value.errorCode))return {result:value,attempt:current};
  if(typeof replaceAttempt!=='function')return {result:value,attempt:current};
  onRecovery({kind:'retry',code:value.errorCode,reuse});
  current=await replaceAttempt(current,{reuse});
  onProgress?.({type:'reset'});
 }
 throw fault('SERVICE_UNAVAILABLE');
}
