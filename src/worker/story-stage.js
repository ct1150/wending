// Explicit tester-only composition. The ordinary production entry never imports
// this module; no browser flag or environment switch selects this provider.
import { createStoryApi } from './story-api.js';
import { storyBudgetCoordinator } from './index.js';
import { CANDIDATE_MODEL_ID, assertProviderReady, restoreFreeBoundaryEvidence } from './story-config.js';
import { generateAcceptanceScene } from './story-acceptance.js';
import { assertExperimentBridgeReady, createExperimentBridge } from './story-experiment.js';
import { assertPlainData, sha256 } from '../game/cultivation/live/identity.js';
import { exactKeys } from '../game/cultivation/live/schema.js';

export const STORY_TESTER_HEADER='x-wending-story-tester';
const fail=code=>{throw Object.assign(new Error(code),{code});};

export function validateStoryStagePolicy(value){
  try{
    assertPlainData(value);exactKeys(value,['enabled','mode','modelId','testerPermitSha256','bindingAccountId','currentPlan','freeBoundaryProof']);
    if(value.enabled!==true||value.mode!=='tester-only'||value.modelId!==CANDIDATE_MODEL_ID||typeof value.testerPermitSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.testerPermitSha256))throw Error('invalid tester policy');
    restoreFreeBoundaryEvidence(value.freeBoundaryProof,{bindingAccountId:value.bindingAccountId,currentPlan:value.currentPlan});
    return structuredClone(value);
  }catch{fail('STORY_STAGE_CONFIGURATION_INVALID');}
}

function permitMatches(request,expected){
  const permit=request.headers.get(STORY_TESTER_HEADER);
  if(typeof permit!=='string'||!/^[a-f0-9]{64}$/.test(permit))return false;
  const actual=sha256(permit);let different=0;for(let i=0;i<64;i++)different|=actual.charCodeAt(i)^expected.charCodeAt(i);
  return different===0;
}

export function createStoryStageWorker({staticFetch=()=>new Response('Not found',{status:404}),config={}}={}){
  let trusted=null,invalid=false;
  if(config?.enabled===true){try{trusted=validateStoryStagePolicy(config);}catch{invalid=true;}}
  return {async fetch(request,env={},ctx){
    const path=new URL(request.url).pathname;
    if(path!=='/api/story'&&!path.startsWith('/api/story/'))return staticFetch(request,env,ctx);
    const readiness=()=>{
      if(invalid)fail('STORY_STAGE_CONFIGURATION_INVALID');
      if(!trusted)fail('INFERENCE_DISABLED');
      if(!permitMatches(request,trusted.testerPermitSha256))fail('TESTER_PERMIT_REQUIRED');
      assertExperimentBridgeReady(env);
      if(sha256(env.STORY_OPERATOR_TOKEN)===trusted.testerPermitSha256)fail('STORY_STAGE_CONFIGURATION_INVALID');
      const evidence=restoreFreeBoundaryEvidence(trusted.freeBoundaryProof,{bindingAccountId:trusted.bindingAccountId,currentPlan:trusted.currentPlan});
      return assertProviderReady({enabled:true,modelId:trusted.modelId,env,evidence,purpose:'probe'});
    };
    const api=createStoryApi({budget:storyBudgetCoordinator(env),experiment:createExperimentBridge(env),config:{readiness},provider:(ai,profile,context,options)=>generateAcceptanceScene(ai,context,options)});
    return api.fetch(request,env,ctx);
  }};
}
