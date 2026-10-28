// Private Task8 accounting only. The caller authenticates and serializes access
// to the existing experiment-v1 record; this module never invokes a provider.
import { assertProviderReady, reserveExperiment, settleExperiment,EXPERIMENT_LIMITS } from './story-config.js';
import { TURN_RESERVATION_NEURONS } from './story-api.js';
import { assertPlainData, canonicalStringify, sha256 } from '../game/cultivation/live/identity.js';
import { exactKeys, idField } from '../game/cultivation/live/schema.js';
import { validateStoryObservation,storyObservationHash } from './story-observation.js';

const identityFields=['sessionRef','requestId','attemptId','payloadHash','contextHash'];
const statuses=['complete','failed','unknown'];
const safeCodes=new Set(['FREE_BOUNDARY_UNVERIFIED','AI_BINDING_MISSING','ACCOUNT_QUOTA_UNAVAILABLE','EXPERIMENT_BUDGET_EXHAUSTED','EXPERIMENT_LEDGER_INVALID','EXPERIMENT_ATTEMPT_INVALID','TASK8_ADMISSION_CONFLICT','TASK8_ADMISSION_MISSING','TASK8_SETTLEMENT_CONFLICT','ACCEPTANCE_STORAGE_LIMIT','LEDGER_PERSIST_FAILED']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const denied=error=>({kind:'denied',code:safeCodes.has(error?.code)?error.code:'EXPERIMENT_LEDGER_INVALID'});
const admissionId=identity=>'task8_'+sha256(canonicalStringify([identity.sessionRef,identity.attemptId]));
const sceneHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

export function validateTask8Body(body,settlement=false){
  assertPlainData(body);exactKeys(body,[...identityFields,...(settlement?['status',...(body.status==='complete'?['acceptedSceneHash']:[])]:[])],settlement?['observation']:[]);
  for(const key of ['sessionRef','requestId','attemptId'])idField(body[key]);
  for(const key of ['payloadHash','contextHash'])if(typeof body[key]!=='string'||!/^[a-f0-9]{64}$/.test(body[key]))fail('REQUEST_INVALID');
  if(settlement&&!statuses.includes(body.status))fail('REQUEST_INVALID');
  if(settlement&&body.status==='complete'&&!sceneHash(body.acceptedSceneHash))fail('REQUEST_INVALID');
  if(settlement&&Object.hasOwn(body,'observation'))validateStoryObservation(body.observation,{status:body.status});
  return Object.fromEntries(identityFields.map(key=>[key,body[key]]));
}

function stateOf(record){
  const state=record.task8??{schemaVersion:1,admissions:{}};
  assertPlainData(state);exactKeys(state,['schemaVersion','admissions']);
  if(state.schemaVersion!==1||!state.admissions||typeof state.admissions!=='object'||Array.isArray(state.admissions)||Object.keys(state.admissions).length>EXPERIMENT_LIMITS.taskCalls.task8)fail('EXPERIMENT_LEDGER_INVALID');
  for(const [id,row] of Object.entries(state.admissions)){
    exactKeys(row,['identity','status',...(row.status==='complete'?['acceptedSceneHash']:[])],['observationHash']);validateTask8Body(row.identity);
    const entry=record.ledger.attempts.find(value=>value.attemptId===id);
    if(id!==admissionId(row.identity)||!['reserved',...statuses].includes(row.status)||entry?.task!=='task8'||entry.reservedNeurons!==TURN_RESERVATION_NEURONS||entry.status!==row.status)fail('EXPERIMENT_LEDGER_INVALID');
    const result=record.results?.[id];
    if(Object.hasOwn(row,'observationHash')){
      if(row.status==='reserved'||!sceneHash(row.observationHash)||!result||result.observationHash!==row.observationHash||result.task!=='task8'||result.status!==row.status||result.reservedNeurons!==TURN_RESERVATION_NEURONS||result.actualNeurons!==null||identityFields.some(key=>result[key]!==row.identity[key]))fail('EXPERIMENT_LEDGER_INVALID');
      try{validateStoryObservation(result.observation,{status:row.status});if(storyObservationHash(result.observation)!==row.observationHash)fail('EXPERIMENT_LEDGER_INVALID');}catch{fail('EXPERIMENT_LEDGER_INVALID');}
    }else if(result&&(Object.hasOwn(result,'observation')||Object.hasOwn(result,'observationHash')))fail('EXPERIMENT_LEDGER_INVALID');
    if(row.status==='complete'){
      // Old un-attested completions and inconsistent copies cannot qualify a
      // later baseline or be silently upgraded by a settlement replay.
      if(!sceneHash(row.acceptedSceneHash)||result?.task!=='task8'||result.status!=='complete'||result.acceptedSceneHash!==row.acceptedSceneHash||result.reservedNeurons!==TURN_RESERVATION_NEURONS||result.actualNeurons!==null||identityFields.some(key=>result[key]!==row.identity[key]))fail('EXPERIMENT_LEDGER_INVALID');
    }else if(result&&Object.hasOwn(result,'acceptedSceneHash'))fail('EXPERIMENT_LEDGER_INVALID');
  }
  return state;
}

async function saveBounded(save,record){
  // Keep the same conservative snapshot ceiling as Task7, including old evidence.
  if(new TextEncoder().encode(JSON.stringify(record)).length>120*1024)fail('ACCEPTANCE_STORAGE_LIMIT');
  try{await save(record);}catch{fail('LEDGER_PERSIST_FAILED');}
}

export async function admitTask8({record,body,env,confirmEvidence,save}){
  try{
    const identity=validateTask8Body(body),id=admissionId(identity),state=stateOf(record),existing=state.admissions[id];
    if(existing){
      if(canonicalStringify(existing.identity)!==canonicalStringify(identity))fail('TASK8_ADMISSION_CONFLICT');
      // A replay is deliberately not another grant, even after a lost response.
      return {kind:'duplicate',admissionId:id,status:existing.status,reservedNeurons:TURN_RESERVATION_NEURONS};
    }
    if(record.ledger.attempts.some(entry=>entry.attemptId===id))fail('TASK8_ADMISSION_CONFLICT');
    assertProviderReady({enabled:true,env,evidence:confirmEvidence(),purpose:'probe',ledger:record.ledger,reservationNeurons:TURN_RESERVATION_NEURONS});
    const ledger=reserveExperiment(record.ledger,{task:'task8',attemptId:id,reservedNeurons:TURN_RESERVATION_NEURONS});
    await saveBounded(save,{...record,ledger,task8:{schemaVersion:1,admissions:{...state.admissions,[id]:{identity,status:'reserved'}}}});
    return {kind:'reserved',admissionId:id,reservedNeurons:TURN_RESERVATION_NEURONS};
  }catch(error){return denied(error);}
}

export async function settleTask8({record,body,save}){
  try{
    const identity=validateTask8Body(body,true),id=admissionId(identity),state=stateOf(record),existing=state.admissions[id];
    if(!existing)fail('TASK8_ADMISSION_MISSING');
    if(canonicalStringify(existing.identity)!==canonicalStringify(identity))fail('TASK8_ADMISSION_CONFLICT');
    const observation=Object.hasOwn(body,'observation')?validateStoryObservation(body.observation,{status:body.status}):undefined;
    const observationHash=observation===undefined?undefined:storyObservationHash(observation);
    if(existing.status!=='reserved'&&(existing.status!==body.status||existing.acceptedSceneHash!==body.acceptedSceneHash||existing.observationHash!==observationHash))fail('TASK8_SETTLEMENT_CONFLICT');
    const attestation=body.status==='complete'?{acceptedSceneHash:body.acceptedSceneHash}:{};
    const observationLink=observationHash===undefined?{}:{observationHash};
    const response={kind:'settled',admissionId:id,status:body.status,...attestation,...observationLink};
    if(existing.status===body.status)return response;
    const ledger=settleExperiment(record.ledger,id,{status:body.status,actualNeurons:null});
    const result={task:'task8',...identity,status:body.status,reservedNeurons:TURN_RESERVATION_NEURONS,actualNeurons:null,...attestation,...observationLink,...(observation===undefined?{}:{observation})};
    await saveBounded(save,{...record,ledger,results:{...record.results,[id]:result},task8:{schemaVersion:1,admissions:{...state.admissions,[id]:{identity,status:body.status,...attestation,...observationLink}}}});
    return response;
  }catch(error){return denied(error);}
}
