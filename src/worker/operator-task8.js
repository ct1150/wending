// Private Task8 accounting only. The caller authenticates and serializes access
// to the existing experiment-v1 record; this module never invokes a provider.
import { assertProviderReady, reserveExperiment, settleExperiment } from './story-config.js';
import { TURN_RESERVATION_NEURONS } from './story-api.js';
import { assertPlainData, canonicalStringify, sha256 } from '../game/cultivation/live/identity.js';
import { exactKeys, idField } from '../game/cultivation/live/schema.js';

const identityFields=['sessionRef','requestId','attemptId','payloadHash','contextHash'];
const statuses=['complete','failed','unknown'];
const safeCodes=new Set(['FREE_BOUNDARY_UNVERIFIED','AI_BINDING_MISSING','ACCOUNT_QUOTA_UNAVAILABLE','EXPERIMENT_BUDGET_EXHAUSTED','EXPERIMENT_LEDGER_INVALID','EXPERIMENT_ATTEMPT_INVALID','TASK8_ADMISSION_CONFLICT','TASK8_ADMISSION_MISSING','TASK8_SETTLEMENT_CONFLICT','ACCEPTANCE_STORAGE_LIMIT','LEDGER_PERSIST_FAILED']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const denied=error=>({kind:'denied',code:safeCodes.has(error?.code)?error.code:'EXPERIMENT_LEDGER_INVALID'});
const admissionId=identity=>'task8_'+sha256(canonicalStringify([identity.sessionRef,identity.attemptId]));

export function validateTask8Body(body,settlement=false){
  assertPlainData(body);exactKeys(body,[...identityFields,...(settlement?['status']:[])]);
  for(const key of ['sessionRef','requestId','attemptId'])idField(body[key]);
  for(const key of ['payloadHash','contextHash'])if(typeof body[key]!=='string'||!/^[a-f0-9]{64}$/.test(body[key]))fail('REQUEST_INVALID');
  if(settlement&&!statuses.includes(body.status))fail('REQUEST_INVALID');
  return Object.fromEntries(identityFields.map(key=>[key,body[key]]));
}

function stateOf(record){
  const state=record.task8??{schemaVersion:1,admissions:{}};
  assertPlainData(state);exactKeys(state,['schemaVersion','admissions']);
  if(state.schemaVersion!==1||!state.admissions||typeof state.admissions!=='object'||Array.isArray(state.admissions)||Object.keys(state.admissions).length>2)fail('EXPERIMENT_LEDGER_INVALID');
  for(const [id,row] of Object.entries(state.admissions)){
    exactKeys(row,['identity','status']);validateTask8Body(row.identity);
    const entry=record.ledger.attempts.find(value=>value.attemptId===id);
    if(id!==admissionId(row.identity)||!['reserved',...statuses].includes(row.status)||entry?.task!=='task8'||entry.reservedNeurons!==TURN_RESERVATION_NEURONS||entry.status!==row.status)fail('EXPERIMENT_LEDGER_INVALID');
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
    if(existing.status!=='reserved'&&existing.status!==body.status)fail('TASK8_SETTLEMENT_CONFLICT');
    if(existing.status===body.status)return {kind:'settled',admissionId:id,status:body.status};
    const ledger=settleExperiment(record.ledger,id,{status:body.status,actualNeurons:null});
    const result={task:'task8',...identity,status:body.status,reservedNeurons:TURN_RESERVATION_NEURONS,actualNeurons:null};
    await saveBounded(save,{...record,ledger,results:{...record.results,[id]:result},task8:{schemaVersion:1,admissions:{...state.admissions,[id]:{identity,status:body.status}}}});
    return {kind:'settled',admissionId:id,status:body.status};
  }catch(error){return denied(error);}
}
