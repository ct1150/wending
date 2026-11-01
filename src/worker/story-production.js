// Server-owned production policy is never selected by browser input.
import {storyBudgetCoordinator,STORY_COORDINATOR_NAME} from './index.js';
import {createStoryProductionApi,validateStoryProductionPolicy,STORY_RUNTIME_POLICY_HEADER} from './story-production-api.js';
import {assertStoryKnowledgeReady,storyKnowledgeMetadata} from './story-knowledge-status.js';
export {validateStoryProductionPolicy,STORY_PRODUCTION_VERSIONS,STORY_BUDGET_NAMESPACE_ID} from './story-production-api.js';

export function createStoryProductionWorker({staticFetch=()=>new Response('Not found',{status:404}),config={}}={}){
  return {async fetch(request,env={},ctx){
    const path=new URL(request.url).pathname;
    if(path!=='/api/story'&&!path.startsWith('/api/story/'))return staticFetch(request,env,ctx);
    if(path==='/api/story/knowledge'){
      if(request.method!=='GET')return new Response(null,{status:405,headers:{allow:'GET','cache-control':'no-store'}});
      const enabled=config?.enabled===true&&config?.knowledge!==undefined;
      let errorCode=null;
      if(enabled)try{validateStoryProductionPolicy(config);await assertStoryKnowledgeReady(env.STORY_KNOWLEDGE);}catch(error){errorCode=error?.code==='KNOWLEDGE_UNAVAILABLE'?'KNOWLEDGE_UNAVAILABLE':'STORY_PRODUCTION_CONFIGURATION_INVALID';}
      return Response.json(storyKnowledgeMetadata({enabled,available:enabled&&errorCode===null,errorCode}),{headers:{'cache-control':'no-store'}});
    }
    // The existing SQLite object owns heavy turn processing and its original
    // ledger. Only server-owned configuration crosses this internal boundary.
    if(path==='/api/story/turn'||path.startsWith('/api/story/turn/')){
      const binding=env.STORY_BUDGET;
      if(binding?.idFromName&&binding?.get){
        const headers=new Headers(request.headers);
        headers.set(STORY_RUNTIME_POLICY_HEADER,JSON.stringify(config));
        return binding.get(binding.idFromName(STORY_COORDINATOR_NAME)).fetch(new Request(request,{headers}));
      }
    }
    return createStoryProductionApi({config,budget:storyBudgetCoordinator(env)}).fetch(request,env,ctx);
  }};
}
