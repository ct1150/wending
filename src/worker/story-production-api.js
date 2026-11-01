import {createStoryApi} from './story-api.js';
import {CANDIDATE_MODEL_ID,GLM_MODEL_ID,PRODUCTION_PROFILES,assertProviderReady,restoreFreeBoundaryEvidence} from './story-config.js';
import {assertPlainData} from '../game/cultivation/live/identity.js';
import {exactKeys} from '../game/cultivation/live/schema.js';
import {validateKnowledgePolicy} from './story-knowledge-status.js';

export const STORY_PRODUCTION_VERSIONS=Object.freeze({protocolVersion:1,rulesVersion:1,promptVersion:1,saveVersion:5,contentVersion:4});
export const STORY_BUDGET_NAMESPACE_ID='1de1df3929534a8d8d495d6db6604e99';
const fail=code=>{throw Object.assign(new Error(code),{code});};

function readPolicy(value){
  try{
    assertPlainData(value);
    exactKeys(value,['enabled','mode','modelId','bindingAccountId','currentPlan','freeBoundaryProof',...Object.keys(STORY_PRODUCTION_VERSIONS)],['knowledge']);
    exactKeys(value.currentPlan,['accountId','source','plan']);
    exactKeys(value.freeBoundaryProof,['accountId','source','plan','hardLimit','noGatewayCredits','directBinding','accountUsageVerified','storageFreeVerified','remainingNeurons','checkedAt']);
    if(value.enabled!==true||value.mode!=='production'||Object.entries(STORY_PRODUCTION_VERSIONS).some(([key,version])=>value[key]!==version))throw Error('invalid production policy');
    if(Object.hasOwn(value,'knowledge'))validateKnowledgePolicy(value.knowledge);
  }catch{fail('STORY_PRODUCTION_CONFIGURATION_INVALID');}
  if(![CANDIDATE_MODEL_ID,GLM_MODEL_ID].includes(value.modelId))fail('MODEL_NOT_ALLOWED');
  // Preserve the original observation time. Production verifies the account's
  // current hard Free boundary, not a newly measured five-minute probe balance.
  const evidence=restoreFreeBoundaryEvidence(value.freeBoundaryProof,{bindingAccountId:value.bindingAccountId,currentPlan:value.currentPlan});
  if(!PRODUCTION_PROFILES.some(profile=>profile.modelId===value.modelId&&profile.validated===true&&profile.supportsStructuredOutput===true))fail('MODEL_UNVALIDATED');
  return {policy:structuredClone(value),evidence};
}

export function validateStoryProductionPolicy(value){return readPolicy(value).policy;}

export const STORY_RUNTIME_POLICY_HEADER='x-wending-production-policy';
export function createStoryProductionApi({config={},budget}={}){
  const readiness=async runtime=>{
    if(config?.enabled!==true)fail('INFERENCE_DISABLED');
    const {policy,evidence}=readPolicy(config);
    return assertProviderReady({enabled:true,modelId:policy.modelId,env:runtime,evidence,purpose:'production'});
  };
  return createStoryApi({budget,config:{readiness,groundedChoices:true,knowledgeEnabled:config?.knowledge?.enabled===true}});
}
