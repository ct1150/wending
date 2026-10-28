// Server-only transport to the existing operator ledger. The tester permit is
// never forwarded; the operator credential is read only from a secret binding.
import { canonicalStringify, sha256 } from '../game/cultivation/live/identity.js';

export const STORY_EXPERIMENT_COORDINATOR_NAME='wending-realtime-acceptance-v1';
export const STORY_EXPERIMENT_NAMESPACE_ID='dfb218f2f29d4ecab2395f8a00b48350';
const fields=['sessionRef','requestId','attemptId','payloadHash','contextHash'];
const codes=new Set(['FREE_BOUNDARY_UNVERIFIED','AI_BINDING_MISSING','ACCOUNT_QUOTA_UNAVAILABLE','EXPERIMENT_BUDGET_EXHAUSTED','EXPERIMENT_LEDGER_INVALID','EXPERIMENT_ATTEMPT_INVALID','TASK8_ADMISSION_CONFLICT','TASK8_ADMISSION_MISSING','TASK8_SETTLEMENT_CONFLICT','ACCEPTANCE_STORAGE_LIMIT','LEDGER_PERSIST_FAILED']);
const unavailable=()=>({kind:'denied',code:'EXPERIMENT_BUDGET_UNAVAILABLE'});

export function assertExperimentBridgeReady(env){
  if(typeof env?.STORY_EXPERIMENT?.idFromName!=='function'||typeof env.STORY_EXPERIMENT.get!=='function'||typeof env.STORY_OPERATOR_TOKEN!=='string'||!/^[^\s]{32,256}$/.test(env.STORY_OPERATOR_TOKEN))throw Object.assign(new Error('EXPERIMENT_BUDGET_UNAVAILABLE'),{code:'EXPERIMENT_BUDGET_UNAVAILABLE'});
}

async function readBounded(response){
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('invalid bridge response');
  const reader=response.body?.getReader();if(!reader)throw Error('missing bridge response');
  let length=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>4096){await reader.cancel();throw Error('oversized bridge response');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

export function createExperimentBridge(env){
  async function call(path,input){
    let timer;
    try{
      assertExperimentBridgeReady(env);
      const body=Object.fromEntries(fields.map(field=>[field,input[field]]));
      if(path==='/task8/settle')body.status=input.status;
      const expectedId='task8_'+sha256(canonicalStringify([body.sessionRef,body.attemptId]));
      const operation=(async()=>{
        const binding=env.STORY_EXPERIMENT,stub=binding.get(binding.idFromName(STORY_EXPERIMENT_COORDINATOR_NAME));
        const response=await stub.fetch(new Request('https://story-experiment.internal'+path,{method:'POST',headers:{authorization:'Bearer '+env.STORY_OPERATOR_TOKEN,'content-type':'application/json'},body:JSON.stringify(body)}));
        const result=await readBounded(response);
        if(result?.kind==='denied'&&codes.has(result.code))return {kind:'denied',code:result.code};
        if(!response.ok||result?.admissionId!==expectedId)return unavailable();
        if(path==='/task8/admit'&&['reserved','duplicate'].includes(result.kind)&&result.reservedNeurons===111&&(result.kind==='reserved'||['reserved','complete','failed','unknown'].includes(result.status)))return result;
        if(path==='/task8/settle'&&result.kind==='settled'&&result.status===body.status)return result;
        return unavailable();
      })();
      return await Promise.race([operation,new Promise(resolve=>{timer=setTimeout(()=>resolve(unavailable()),5000);})]);
    }catch{return unavailable();}finally{clearTimeout(timer);}
  }
  return {reserve:input=>call('/task8/admit',input),settle:input=>call('/task8/settle',input)};
}
