// Private acceptance orchestration. Production entries never import this module.
import { CANDIDATE_MODEL_ID, assertProviderReady, estimateMaxNeurons, reserveExperiment, settleExperiment } from './story-config.js';
import { buildCandidateStoryInput, generateAcceptanceScene } from './story-acceptance.js';
import { PROVIDER_ERROR_CODES } from './story-provider.js';
import { STRUCTURE_DIAGNOSTIC_CODES } from './story-provider-core.js';
import { createLiveGame, prepareOpening, prepareChoice, compileChoices, commitTurn } from '../game/cultivation/live/engine.js';
import { buildStoryContext, validateGeneratedScene, buildMemoryDelta } from '../game/cultivation/live/memory.js';
import { sha256, canonicalStringify, stateHash } from '../game/cultivation/live/identity.js';

const REVISED_CASES = Object.freeze(['task7-opening-v2','task7-branch-a-v2','task7-branch-b-v2']);
export const STORY_ACCEPTANCE_CASES = Object.freeze(['task7-opening','task7-continuation','task7-counterfactual-a','task7-counterfactual-b',...REVISED_CASES]);
// Deliberately conservative acceptance-only cap, below SQLite KV's 2 MB limit.
export const MAX_ACCEPTANCE_SNAPSHOT_BYTES = 120 * 1024;
const encoder = new TextEncoder();
const copy = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code),{code}); };
const safeCodes = new Set([...PROVIDER_ERROR_CODES,'FREE_BOUNDARY_UNVERIFIED','AI_BINDING_MISSING','ACCOUNT_QUOTA_UNAVAILABLE','EXPERIMENT_BUDGET_EXHAUSTED','EXPERIMENT_LEDGER_INVALID','EXPERIMENT_ATTEMPT_INVALID','ACCEPTANCE_PREREQUISITE_MISSING','ACCEPTANCE_DISTINCT_CHOICES_UNAVAILABLE','ACCEPTANCE_RULE_DEATH','ACCEPTANCE_STATE_INVALID','ACCEPTANCE_STORAGE_LIMIT','LEDGER_PERSIST_FAILED']);
const errorCode = error => safeCodes.has(error?.code) ? error.code : 'ACCEPTANCE_PREPARATION_FAILED';
function bounded(record) { if (encoder.encode(JSON.stringify(record)).length > MAX_ACCEPTANCE_SNAPSHOT_BYTES) fail('ACCEPTANCE_STORAGE_LIMIT'); return record; }
function acceptanceState(record) {
  if (record.acceptance === undefined) return {schemaVersion:1,cases:{}};
  const state = record.acceptance;
  if (state?.schemaVersion !== 1 || !state.cases || typeof state.cases !== 'object' || Array.isArray(state.cases) || Object.keys(state.cases).some(id => !STORY_ACCEPTANCE_CASES.includes(id))) fail('ACCEPTANCE_STATE_INVALID');
  for (const [caseId,row] of Object.entries(state.cases)) if (!row || typeof row.attemptId !== 'string' || !['reserved','complete','failed','unknown'].includes(row.status) || REVISED_CASES.includes(caseId) && row.recipeVersion !== 2) fail('ACCEPTANCE_STATE_INVALID');
  return state;
}
function requireOriginalStructuralFailure(record,acceptance) {
  const original = acceptance.cases['task7-opening'];
  const reservation = record.ledger.attempts.find(row => row.attemptId === original?.attemptId);
  const result = record.results[original?.attemptId];
  if (original?.caseId !== 'task7-opening' || original.status !== 'failed' || reservation?.task !== 'task7' || reservation.status !== 'failed' || result?.task !== 'task7' || result.caseId !== 'task7-opening' || result.attemptId !== original.attemptId || result.status !== 'rejected' || result.errorCode !== 'GENERATED_SCENE_INVALID') fail('ACCEPTANCE_PREREQUISITE_MISSING');
}
function distinctAction(first,next) {
  const a = first.receipt.action, b = next.receipt.action;
  // Labels, IDs and an ineffective stake change do not establish a contrast.
  return ['intent','targetId','approach'].some(key => a[key] !== b[key]) || canonicalStringify(first.nextLife) !== canonicalStringify(next.nextLife);
}
function prepareCase(record,acceptance,caseId) {
  const revised = REVISED_CASES.includes(caseId);
  const opening = caseId === STORY_ACCEPTANCE_CASES[0] || caseId === REVISED_CASES[0];
  if (revised) requireOriginalStructuralFailure(record,acceptance);
  let state,records = [];
  if (opening) state = createLiveGame({runId:'live-acceptance-v1',seed:42,name:'云归',originId:'village'});
  else {
    const prerequisite = acceptance.cases[revised ? REVISED_CASES[0] : caseId === STORY_ACCEPTANCE_CASES[1] ? STORY_ACCEPTANCE_CASES[0] : STORY_ACCEPTANCE_CASES[1]];
    const precedingBranch = caseId === STORY_ACCEPTANCE_CASES[3] ? STORY_ACCEPTANCE_CASES[2] : caseId === REVISED_CASES[2] ? REVISED_CASES[1] : null;
    if (prerequisite?.status !== 'complete' || !prerequisite.state || !Array.isArray(prerequisite.records) || precedingBranch && acceptance.cases[precedingBranch]?.status !== 'complete') fail('ACCEPTANCE_PREREQUISITE_MISSING');
    state = copy(prerequisite.state); records = copy(prerequisite.records);
  }
  let pending;
  if (opening) pending = prepareOpening(state,{requestId:caseId});
  else {
    const enabled = compileChoices(state,state.currentScene.choices).filter(choice => choice.enabled);
    const living = enabled.map(choice => prepareChoice(state,{requestId:caseId,choiceId:choice.id})).filter(candidate => !candidate.receipt.death);
    if (!living.length) fail('ACCEPTANCE_RULE_DEATH');
    if (revised) {
      const distinctSecond = living.slice(1).find(candidate => distinctAction(living[0],candidate));
      if (!distinctSecond) fail('ACCEPTANCE_DISTINCT_CHOICES_UNAVAILABLE');
      pending = caseId === REVISED_CASES[2] ? distinctSecond : living[0];
    } else {
      if (caseId !== STORY_ACCEPTANCE_CASES[1] && living.length < 2) fail('ACCEPTANCE_DISTINCT_CHOICES_UNAVAILABLE');
      pending = living[caseId === STORY_ACCEPTANCE_CASES[3] ? 1 : 0];
    }
  }
  const openTotal = records.filter(row => ['promise','clue'].includes(row.kind) && row.status === 'open').length;
  const context = buildStoryContext(state,pending,records,{selection:'relevance-v1',openTotal});
  return {state,records,pending,context};
}
function remember(previous,pending,scene) {
  const delta = buildMemoryDelta(pending.receipt,scene), common = {runId:pending.identity.runId,turnId:pending.identity.turnId};
  const rows = new Map(previous.map(row => [row.id,copy(row)]));
  const add = row => rows.set(row.id,row);
  add({id:'receipt:'+common.turnId,...common,source:'rules',kind:'receipt',receipt:copy(delta.receipt)});
  for (const row of delta.records) add({...row,...common});
  for (const entity of scene.entities) {
    const id = 'e:'+sha256(entity.id).slice(0,40), prior = rows.get(id);
    add({id,...common,source:'narrative',kind:'entity',entity:{id:entity.id,name:entity.name,kind:entity.kind},status:prior?.status === 'dead' ? 'dead' : entity.status ?? prior?.status ?? 'unknown'});
  }
  for (const entityId of Object.keys(pending.receipt.relationChanges)) add({id:'q:'+sha256(entityId).slice(0,40),...common,source:'rules',kind:'ruleRelation',entityId,value:pending.nextLife.relations[entityId]});
  if (rows.size > 256) fail('ACCEPTANCE_STORAGE_LIMIT');
  return [...rows.values()];
}

// Caller supplies only trusted env/config/storage and holds the singleton queue.
// Storage writes preserve the original snapshot, including all earlier tasks.
export async function runStoryAcceptance({record,caseId,attemptId,env,confirmEvidence,save}) {
  let acceptance;
  try { acceptance = acceptanceState(record); } catch (error) { return {status:'blocked',errorCode:errorCode(error)}; }
  const prior = record.ledger.attempts.find(row => row.attemptId === attemptId);
  const existing = acceptance.cases[caseId];
  if (prior && existing?.attemptId !== attemptId) return {status:'blocked',errorCode:'ACCEPTANCE_ATTEMPT_CONFLICT'};
  if (existing) {
    if (Object.hasOwn(record.results,existing.attemptId)) return record.results[existing.attemptId];
    return {status:'already-reserved-or-unknown',caseId,attemptId:existing.attemptId,reservation:record.ledger.attempts.find(row => row.attemptId === existing.attemptId) ?? null};
  }
  let prepared,input,reservedNeurons,reserved,association;
  try {
    if (!STORY_ACCEPTANCE_CASES.includes(caseId)) fail('ACCEPTANCE_STATE_INVALID');
    prepared = prepareCase(record,acceptance,caseId);
    input = buildCandidateStoryInput(prepared.context);
    const serialized = JSON.stringify(input);
    reservedNeurons = estimateMaxNeurons(input);
    association = {attemptId,caseId,status:'reserved',contextHash:sha256(canonicalStringify(prepared.context)),inputHash:sha256(serialized),inputBytes:encoder.encode(serialized).length,baseStateHash:stateHash(prepared.state),identity:copy(prepared.pending.identity),receipt:copy(prepared.pending.receipt)};
    if (REVISED_CASES.includes(caseId)) association.recipeVersion = 2;
    const evidence = confirmEvidence();
    assertProviderReady({enabled:true,env,evidence,purpose:'probe',ledger:record.ledger,reservationNeurons:reservedNeurons});
    const ledger = reserveExperiment(record.ledger,{task:'task7',attemptId,reservedNeurons});
    reserved = bounded({...record,ledger,acceptance:{...acceptance,cases:{...acceptance.cases,[caseId]:association}}});
    try { await save(reserved); } catch { fail('LEDGER_PERSIST_FAILED'); }
  } catch (error) { return {status:'blocked',errorCode:errorCode(error),caseId,attemptId}; }

  const started = Date.now();
  let generated;
  try {
    // The provider's transport ID is a fixed server-owned case ID. The external
    // operator attempt ID is bound to it in the durable pre-reservation above.
    generated = await generateAcceptanceScene(env.AI,prepared.context,{attemptId:caseId});
  } catch { generated = {status:'paused',accountingStatus:'unknown',inferencePerformed:true,errorCode:'PROVIDER_FAILED'}; }
  const result = {schemaVersion:1,sampleKind:'workers-ai',task:'task7',caseId,attemptId,contextHash:association.contextHash,inputHash:association.inputHash,inputBytes:association.inputBytes,modelId:CANDIDATE_MODEL_ID,rulesVersion:prepared.context.identity.rulesVersion,promptVersion:prepared.context.identity.promptVersion,reservedNeurons,actualNeurons:null,inferencePerformed:generated.inferencePerformed === true,usage:generated.usage ?? null,stopReason:generated.stopReason ?? null,latencyMs:Math.max(0,Date.now()-started),status:generated.status,identity:association.identity,receipt:association.receipt};
  if (association.recipeVersion === 2) result.recipeVersion = 2;
  if (generated.errorCode === 'GENERATED_SCENE_INVALID' && STRUCTURE_DIAGNOSTIC_CODES.includes(generated.structureDiagnostic)) result.structureDiagnostic = generated.structureDiagnostic;
  let state,records,status = generated.accountingStatus === 'unknown' ? 'unknown' : 'failed';
  if (generated.status === 'ready') {
    try {
      const scene = validateGeneratedScene(generated.scene,prepared.context);
      state = commitTurn(prepared.state,prepared.pending,scene,prepared.context.relationships);
      records = remember(prepared.records,prepared.pending,scene);
      result.scene = scene; status = 'complete';
    } catch (error) { result.status = 'rejected'; result.errorCode = errorCode(error); }
  } else result.errorCode = safeCodes.has(generated.errorCode) || ['PROVIDER_FAILED','FREE_QUOTA_EXHAUSTED','PROVIDER_BUSY'].includes(generated.errorCode) ? generated.errorCode : 'PROVIDER_FAILED';
  let final;
  try {
    const row = {...association,status,...(status === 'complete' ? {state,records} : {})};
    final = bounded({...reserved,ledger:settleExperiment(reserved.ledger,attemptId,{status,actualNeurons:null}),results:{...reserved.results,[attemptId]:result},acceptance:{...reserved.acceptance,cases:{...reserved.acceptance.cases,[caseId]:row}}});
  } catch {
    // Keep only bounded sanitized failure metadata if an accepted scene would
    // exceed the snapshot cap. It cannot advance this case or trigger a retry.
    delete result.scene; result.status = 'rejected'; result.errorCode = 'ACCEPTANCE_STORAGE_LIMIT';
    final = {...reserved,ledger:settleExperiment(reserved.ledger,attemptId,{status:'failed',actualNeurons:null}),results:{...reserved.results,[attemptId]:result},acceptance:{...reserved.acceptance,cases:{...reserved.acceptance.cases,[caseId]:{...association,status:'failed'}}}};
    try { bounded(final); } catch { return {status:'already-reserved-or-unknown',caseId,attemptId,errorCode:'ACCEPTANCE_STORAGE_LIMIT'}; }
  }
  try { await save(final); } catch { return {...result,ledgerErrorCode:'LEDGER_PERSIST_FAILED'}; }
  return result;
}
