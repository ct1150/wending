// Private server evidence only. No provider text, exceptions or credentials
// belong in this fixed vocabulary; public/cache envelopes remain unchanged.
import {assertPlainData,canonicalStringify,sha256} from '../game/cultivation/live/identity.js';
import {exactKeys} from '../game/cultivation/live/schema.js';
import {CANDIDATE_MODEL_ID,STORY_LIMITS} from './story-config.js';
import {PROVIDER_ERROR_CODES,STRUCTURE_DIAGNOSTIC_CODES} from './story-provider-core.js';

const fields=['version','stage','errorCode','structureDiagnostic','modelId','inputHash','inputBytes','usage','stopReason','nonThinkingValidated','latencyMs'];
const stages=['provider','api-scene','api-envelope'],stops=['stop','length','tool_calls','content_filter'];
// Reading immutable prior evidence must not rewrite its model or hash. This
// compatibility list does not select providers or authorize fresh observations.
const observationModels=new Set([CANDIDATE_MODEL_ID,'@cf/qwen/qwen3-30b-a3b-fp8']);
const errors=new Set([...PROVIDER_ERROR_CODES,'PROVIDER_FAILED','PROVIDER_BUSY','FREE_QUOTA_EXHAUSTED']),diagnostics=new Set(STRUCTURE_DIAGNOSTIC_CODES);
const integer=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=()=>{throw Object.assign(new Error('STORY_OBSERVATION_INVALID'),{code:'STORY_OBSERVATION_INVALID'});};
function usageValid(value){
  try{assertPlainData(value);exactKeys(value,['promptTokens','completionTokens','totalTokens']);return Object.values(value).every(n=>integer(n,1e9))&&value.promptTokens+value.completionTokens===value.totalTokens;}catch{return false;}
}
// Read only own data properties when selecting optional provider metadata.
const own=(value,key)=>value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key)?.value:undefined;

export function validateStoryObservation(value,{status}={}){
  try{
    assertPlainData(value);exactKeys(value,fields);
    if(value.version!==1||!stages.includes(value.stage)||value.errorCode!==null&&!errors.has(value.errorCode)||value.structureDiagnostic!==null&&!diagnostics.has(value.structureDiagnostic))fail();
    if(value.modelId!==null&&!observationModels.has(value.modelId))fail();
    if(value.inputHash===null?value.inputBytes!==null:!hash(value.inputHash)||!integer(value.inputBytes,STORY_LIMITS.maxInputBytes)||value.inputBytes===0)fail();
    if(value.usage!==null&&!usageValid(value.usage)||value.stopReason!==null&&!stops.includes(value.stopReason)||value.nonThinkingValidated!==null&&typeof value.nonThinkingValidated!=='boolean'||value.latencyMs!==null&&!integer(value.latencyMs,86400000))fail();
    if(value.stage!=='provider'&&value.errorCode!=='GENERATED_SCENE_INVALID'||value.structureDiagnostic!==null&&(value.errorCode!=='GENERATED_SCENE_INVALID'||value.stage==='api-envelope'))fail();
    if(status!==undefined){
      if(!['complete','failed','unknown'].includes(status)||status==='complete'&&value.errorCode!==null||status==='failed'&&value.errorCode===null||status!=='failed'&&value.structureDiagnostic!==null)fail();
    }
    return structuredClone(value);
  }catch{fail();}
}

export function createStoryObservation(generated,options={}){
  try{
    // Timing is optional evidence: nonfinite measurements become unknown. All
    // other options must be plain data, and no accessor is ever evaluated.
    if(!options||![Object.prototype,null].includes(Object.getPrototypeOf(options)))fail();
    const descriptors=Object.getOwnPropertyDescriptors(options);
    const inspected=Object.fromEntries(Reflect.ownKeys(descriptors).map(key=>{const d=descriptors[key];if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))fail();return [key,key==='latencyMs'?null:d.value];}));
    assertPlainData(inspected);exactKeys(options,[],['stage','latencyMs','errorCode','structureDiagnostic']);
  }catch{fail();}
  const stage=options.stage??'provider';if(!stages.includes(stage))fail();
  const requestedError=Object.hasOwn(options,'errorCode')?options.errorCode:own(generated,'errorCode')??null;
  const errorCode=requestedError===null?null:errors.has(requestedError)?requestedError:'PROVIDER_FAILED';
  const requestedDiagnostic=Object.hasOwn(options,'structureDiagnostic')?options.structureDiagnostic:own(generated,'structureDiagnostic');
  const inputHash=own(generated,'inputHash'),inputBytes=own(generated,'inputBytes');
  const validInput=hash(inputHash)&&integer(inputBytes,STORY_LIMITS.maxInputBytes)&&inputBytes>0;
  const usage=own(generated,'usage'),stopReason=own(generated,'stopReason'),thinking=own(generated,'nonThinkingValidated');
  return validateStoryObservation({version:1,stage,errorCode,
    structureDiagnostic:errorCode==='GENERATED_SCENE_INVALID'&&stage!=='api-envelope'&&diagnostics.has(requestedDiagnostic)?requestedDiagnostic:null,
    modelId:own(generated,'modelId')===CANDIDATE_MODEL_ID?CANDIDATE_MODEL_ID:null,
    inputHash:validInput?inputHash:null,inputBytes:validInput?inputBytes:null,
    usage:usageValid(usage)?structuredClone(usage):null,stopReason:stops.includes(stopReason)?stopReason:null,
    nonThinkingValidated:typeof thinking==='boolean'?thinking:null,latencyMs:integer(options.latencyMs,86400000)?options.latencyMs:null});
}

export function storyObservationHash(value){return sha256(canonicalStringify(validateStoryObservation(value)));}
