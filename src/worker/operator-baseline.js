// Operator-only provenance bridge. Registration never invokes or reserves AI.
import { assertPlainData,canonicalStringify,sha256,stateHash } from '../game/cultivation/live/identity.js';
import { exactKeys,idField } from '../game/cultivation/live/schema.js';
import { validateLiveState } from '../game/cultivation/live/validation.js';
import { prepareOpening,commitTurn } from '../game/cultivation/live/engine.js';
import { buildStoryContext,validateStoryContext,validateGeneratedScene } from '../game/cultivation/live/memory.js';
import { boundAcceptanceRecord,rememberAcceptanceTurn } from './operator-acceptance-state.js';
import {validateStoryObservation,storyObservationHash} from './story-observation.js';

export const MAX_BASELINE_BODY_BYTES=64*1024;
export const BASELINE_ERROR_CODES=Object.freeze(['ACCEPTANCE_PREREQUISITE_MISSING','BASELINE_SOURCE_INVALID','BASELINE_CONTENT_INVALID','BASELINE_CONFLICT','ACCEPTANCE_STORAGE_LIMIT','LEDGER_PERSIST_FAILED']);
const allowed=new Set(BASELINE_ERROR_CODES),copy=value=>JSON.parse(JSON.stringify(value));
const equal=(a,b)=>canonicalStringify(a)===canonicalStringify(b);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const identityFields=['sessionRef','requestId','attemptId','payloadHash','contextHash'];

export function validateTask7BaselineBody(body){
  assertPlainData(body);exactKeys(body,['admissionId','context','scene','browserState'],['retryOf']);idField(body.admissionId);
  for(const key of ['context','scene','browserState'])if(!body[key]||typeof body[key]!=='object'||Array.isArray(body[key]))throw Error('Invalid baseline body');
  if(Object.hasOwn(body,'retryOf')&&body.retryOf!==null){exactKeys(body.retryOf,['attemptId','sessionRef']);idField(body.retryOf.attemptId);idField(body.retryOf.sessionRef);}
  if(new TextEncoder().encode(JSON.stringify(body)).length>MAX_BASELINE_BODY_BYTES)throw Error('Baseline body too large');
  return body;
}

function requireHistoricalFailures(record){
  const cases=record.acceptance?.cases;if(!cases)fail('ACCEPTANCE_PREREQUISITE_MISSING');
  let birthHash,receipt;
  for(const [caseId,version,code] of [['task7-opening',undefined,'GENERATED_SCENE_INVALID'],['task7-opening-v2',2,'SCENE_ID_SCOPE_INVALID'],['task7-opening-v3',3,'GENERATED_SCENE_INVALID']]){
    const row=cases[caseId],result=record.results?.[row?.attemptId],entry=record.ledger.attempts.find(value=>value.attemptId===row?.attemptId);
    if(row?.caseId!==caseId||row.status!=='failed'||row.recipeVersion!==version||entry?.task!=='task7'||entry.status!=='failed'||result?.task!=='task7'||result.attemptId!==row.attemptId||result.caseId!==caseId||result.recipeVersion!==version||result.status!=='rejected'||result.errorCode!==code||result.inferencePerformed!==true||result.reservedNeurons!==entry.reservedNeurons||version===3&&result.structureDiagnostic!=='ACTION_PAIR_INVALID')fail('ACCEPTANCE_PREREQUISITE_MISSING');
    if(['contextHash','inputHash'].some(key=>!hash(row[key])||result[key]!==row[key])||!Number.isSafeInteger(row.inputBytes)||row.inputBytes<1||result.inputBytes!==row.inputBytes||!hash(row.baseStateHash)||row.identity?.stateHash!==row.baseStateHash||row.identity?.requestId!==caseId||!equal(row.identity,result.identity)||!equal(row.receipt,result.receipt))fail('ACCEPTANCE_PREREQUISITE_MISSING');
    birthHash??=row.baseStateHash;receipt??=row.receipt;if(row.baseStateHash!==birthHash||!equal(row.receipt,receipt))fail('ACCEPTANCE_PREREQUISITE_MISSING');
  }
}

function attestedSource(record,admissionId){
  if(record.ledger?.schemaVersion!==1||!Array.isArray(record.ledger.attempts))fail('BASELINE_SOURCE_INVALID');
  requireHistoricalFailures(record);
  const source=record.task8?.admissions?.[admissionId],entry=record.ledger.attempts.find(row=>row.attemptId===admissionId),result=record.results?.[admissionId];
  if(record.task8?.schemaVersion!==1||source?.status!=='complete'||entry?.task!=='task8'||entry.status!=='complete'||(!Number.isSafeInteger(entry.reservedNeurons)||entry.reservedNeurons<1)||entry.actualNeurons!==null||result?.task!=='task8'||result.status!=='complete'||result.reservedNeurons!==entry.reservedNeurons||result.actualNeurons!==null||!hash(source.acceptedSceneHash)||result.acceptedSceneHash!==source.acceptedSceneHash)fail('BASELINE_SOURCE_INVALID');
  exactKeys(source,['identity','status','acceptedSceneHash'],['observationHash']);exactKeys(source.identity,identityFields);
  if(Object.hasOwn(source,'observationHash')){
    try{
      validateStoryObservation(result.observation,{status:'complete'});
      if(!hash(source.observationHash)||result.observationHash!==source.observationHash||storyObservationHash(result.observation)!==source.observationHash)fail('BASELINE_SOURCE_INVALID');
    }catch{fail('BASELINE_SOURCE_INVALID');}
  }else if(Object.hasOwn(result,'observation')||Object.hasOwn(result,'observationHash'))fail('BASELINE_SOURCE_INVALID');
  for(const key of ['sessionRef','requestId','attemptId'])idField(source.identity[key]);
  for(const key of ['payloadHash','contextHash'])if(!hash(source.identity[key]))fail('BASELINE_SOURCE_INVALID');
  // Preserve terminal failed/unknown openings and their reservations. A separate
  // attested success can follow them; active reservations and prior successes cannot.
  if(identityFields.some(key=>result[key]!==source.identity[key])||admissionId!=='task8_'+sha256(canonicalStringify([source.identity.sessionRef,source.identity.attemptId]))||record.ledger.attempts.find(row=>row.task==='task8'&&!['failed','unknown'].includes(row.status))?.attemptId!==admissionId)fail('BASELINE_SOURCE_INVALID');
  return source;
}

function reconstruct(record,body){
  validateTask7BaselineBody(body);
  const source=attestedSource(record,body.admissionId),context=body.context;
  if(sha256(canonicalStringify(context))!==source.identity.contextHash||sha256(canonicalStringify(body.scene))!==source.acceptedSceneHash)fail('BASELINE_CONTENT_INVALID');
  // Retry lineage is part of the successful request's attested payload. The
  // caller may supply it, but cannot change it or the recorded attempt identity.
  const attempt={id:source.identity.attemptId,sessionRef:source.identity.sessionRef,retryOf:body.retryOf??null};
  if(sha256(canonicalStringify({context,attempt}))!==source.identity.payloadHash)fail('BASELINE_CONTENT_INVALID');
  validateStoryContext(context);
  if(context.phase!=='opening'||context.identity.requestId!==source.identity.requestId||context.identity.baseRevision!==0||context.identity.turnId!==1||context.relationshipVersion!==1)fail('BASELINE_CONTENT_INVALID');
  // Restore exact already-drawn birth facts and RNG; never choose a new seed or
  // regenerate talents. The recorded context binds the original birth hash.
  const birth=validateLiveState({relationshipVersion:1,version:5,mode:'cultivation',contentVersion:4,rulesVersion:1,promptVersion:1,runId:context.identity.runId,revision:0,turnId:0,phase:'awaitingOpening',rng:context.receipt.random.before,life:copy(context.life),birthReceipt:copy(context.receipt),currentScene:null,lastReceipt:null,relatedEntities:[],archiveCursor:0});
  if(stateHash(birth)!==context.identity.stateHash)fail('BASELINE_CONTENT_INVALID');
  const pending=prepareOpening(birth,{requestId:source.identity.requestId});
  const rebuilt=buildStoryContext(birth,pending,[],{selection:'relevance-v1',openTotal:0});
  if(!equal(rebuilt,context))fail('BASELINE_CONTENT_INVALID');
  const scene=validateGeneratedScene(body.scene,context),state=commitTurn(birth,pending,scene,context.relationships);
  validateLiveState(body.browserState);if(!equal(state,body.browserState))fail('BASELINE_CONTENT_INVALID');
  return {schemaVersion:1,source:'task8-opening',admissionId:body.admissionId,identity:copy(source.identity),acceptedSceneHash:source.acceptedSceneHash,context:copy(context),stateHash:stateHash(state),state:copy(state),records:rememberAcceptanceTurn([],pending,scene),...(attempt.retryOf===null?{}:{retryOf:copy(attempt.retryOf)})};
}

const summary=baseline=>({status:'registered',sourceTask:'task8',admissionId:baseline.admissionId,contextHash:baseline.identity.contextHash,acceptedSceneHash:baseline.acceptedSceneHash,stateHash:baseline.stateHash});
export function readPlayerBaseline(record){
  const previous=record.acceptance?.playerBaseline;if(!previous)fail('ACCEPTANCE_PREREQUISITE_MISSING');
  exactKeys(previous,['schemaVersion','source','admissionId','identity','acceptedSceneHash','context','stateHash','state','records'],['retryOf']);
  const expected=reconstruct(record,{admissionId:previous.admissionId,context:previous.context,scene:previous.state?.currentScene,browserState:previous.state,...(Object.hasOwn(previous,'retryOf')?{retryOf:previous.retryOf}:{})});
  if(!equal(expected,previous))fail('BASELINE_CONTENT_INVALID');
  return copy(expected);
}

export async function registerTask7Baseline({record,body,save}){
  try{
    const baseline=reconstruct(record,body),previous=record.acceptance.playerBaseline;
    if(previous){if(!equal(previous,baseline))fail('BASELINE_CONFLICT');return summary(readPlayerBaseline(record));}
    const next=boundAcceptanceRecord({...record,acceptance:{...record.acceptance,playerBaseline:baseline}});
    try{await save(next);}catch{fail('LEDGER_PERSIST_FAILED');}
    return summary(baseline);
  }catch(error){return {status:'blocked',errorCode:allowed.has(error?.code)?error.code:'BASELINE_CONTENT_INVALID'};}
}
