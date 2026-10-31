// Explicit server-owned production composition. Browser input never selects a
// profile, proof, account, or acceptance provider.
import {createStoryApi} from './story-api.js';
import {storyBudgetCoordinator} from './index.js';
import {CANDIDATE_MODEL_ID,GLM_MODEL_ID,PRODUCTION_PROFILES,assertProviderReady,restoreFreeBoundaryEvidence} from './story-config.js';
import {assertPlainData} from '../game/cultivation/live/identity.js';
import {exactKeys} from '../game/cultivation/live/schema.js';
import {validateKnowledgePolicy,assertStoryKnowledgeReady,storyKnowledgeMetadata} from './story-knowledge-status.js';

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

export function createStoryProductionWorker({staticFetch=()=>new Response('Not found',{status:404}),config={}}={}){
  return {async fetch(request,env={},ctx){
    const path=new URL(request.url).pathname;
    if(path!=='/api/story'&&!path.startsWith('/api/story/'))return staticFetch(request,env,ctx);
    if(path==='/api/story/knowledge'){
      if(request.method!=='GET')return new Response(null,{status:405,headers:{allow:'GET','cache-control':'no-store'}});
      const enabled=config?.enabled===true&&config?.knowledge!==undefined;
      let errorCode=null;
      if(enabled)try{readPolicy(config);await assertStoryKnowledgeReady(env.STORY_KNOWLEDGE);}catch(error){errorCode=error?.code==='KNOWLEDGE_UNAVAILABLE'?'KNOWLEDGE_UNAVAILABLE':'STORY_PRODUCTION_CONFIGURATION_INVALID';}
      return Response.json(storyKnowledgeMetadata({enabled,available:enabled&&errorCode===null,errorCode}),{headers:{'cache-control':'no-store'}});
    }
    const readiness=async runtime=>{
      if(config?.enabled!==true)fail('INFERENCE_DISABLED');
      // Cloudflare module scope has no request clock. The existing API calls
      // readiness only for new work; cached results remain readable when paused.
      const {policy,evidence}=readPolicy(config);
      // Corpus availability is reported by /knowledge; validated policy and
      // the hard Free boundary alone determine inference readiness.
      return assertProviderReady({enabled:true,modelId:policy.modelId,env:runtime,evidence,purpose:'production'});
    };
    // Readiness validates the entire policy before any new inference. A retained
    // KV binding alone must not activate retrieval after a policy rollback.
    return createStoryApi({budget:storyBudgetCoordinator(env),config:{readiness,knowledgeEnabled:config?.knowledge?.enabled===true}}).fetch(request,env,ctx);
  }};
}
