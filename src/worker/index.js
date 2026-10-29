import {createStoryApi} from './story-api.js';
import {assertProviderReady,restoreFreeBoundaryEvidence} from './story-config.js';
export {StoryBudget} from './story-budget.js';
export const STORY_COORDINATOR_NAME='story-budget-v1-global';
export function storyBudgetCoordinator(env){
  // This fixed name is global to the deployment's account/game, never session/IP.
  const binding=env?.STORY_BUDGET;
  if(!binding?.idFromName||!binding?.get)return {};
  const stub=binding.get(binding.idFromName(STORY_COORDINATOR_NAME));
  return Object.fromEntries(['getSession','admit','createSession','lookup','reserve','settle','cleanup','acquireProvider','releaseProvider'].map(method=>[method,async input=>{
    const response=await stub.fetch(new Request('https://story-budget.internal/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));
    if(!response.ok)throw Object.assign(new Error('BUDGET_UNAVAILABLE'),{code:'BUDGET_UNAVAILABLE'});
    return response.json();
  }]));
}
export function createStoryWorker({staticFetch=()=>new Response('Not found',{status:404}),config={}}={}){
  return {async fetch(request,env={},ctx){
    const path=new URL(request.url).pathname;
    if(path!=='/api/story'&&!path.startsWith('/api/story/'))return staticFetch(request,env,ctx);
    const api=createStoryApi({budget:storyBudgetCoordinator(env),config:{readiness:runtime=>assertProviderReady({enabled:config.enabled===true,modelId:config.modelId,env:runtime,evidence:config.enabled===true?restoreFreeBoundaryEvidence(config.freeBoundaryProof,{bindingAccountId:config.bindingAccountId,currentPlan:config.currentPlan}):undefined,purpose:'production'})}});
    return api.fetch(request,env,ctx);
  }};
}
