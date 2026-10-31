import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalStringify,sha256} from '../src/game/cultivation/live/identity.js';
import {KNOWLEDGE_MANIFEST as manifest} from '../src/worker/knowledge/catalog.js';
import {createStoryProductionWorker,validateStoryProductionPolicy} from '../src/worker/story-production.js';
import {GLM_MODEL_ID} from '../src/worker/story-config.js';
import {assertStoryKnowledgeReady} from '../src/worker/story-knowledge-status.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';

const marker=canonicalStringify(Object.fromEntries(['schemaVersion','contentVersion','sourceSha256','chapterCount','evidenceCount','curatedCount','shardCount','shardsDigest'].map(key=>[key,manifest[key]])));
function policy(){
  const accountId='knowledge-production-fixture';
  return {enabled:true,mode:'production',modelId:GLM_MODEL_ID,protocolVersion:1,rulesVersion:1,promptVersion:1,saveVersion:5,contentVersion:4,bindingAccountId:accountId,currentPlan:{accountId,source:'operator-account-verification',plan:'workers-free'},freeBoundaryProof:{accountId,source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:0,checkedAt:'2026-10-01T00:00:00.000Z'},knowledge:{enabled:true,corpusVersion:manifest.contentVersion,namespaceId:'a'.repeat(32)}};
}
const request=path=>new Request('https://game.test'+path);
const noAi={run(){throw Error('readiness must not infer');}};

function turnFixture(config,store){
  let calls=0;const reads=[];
  const state=createLiveGame({runId:'knowledge-policy-turn',seed:42}),context=buildStoryContext(state,prepareOpening(state,{requestId:'knowledge-policy-opening'}));
  const actor={kind:'person',name:'陈叔',ref:'',status:null};
  const scene={blocks:[{kind:'narration',text:'陈叔停在村口，告诉你林中传来求救声，请你先听清方位。'}],choices:[{action:'interact:ask',target:actor,stake:'low',purpose:'求救声从哪个方位传来',anchor:0},{action:'interact:leave',target:actor,stake:'low',purpose:'放下林中求救之事',anchor:0}],title:'村口传闻',location:'村口',memoryDeltas:[]};
  const worker=createStoryProductionWorker({config}),env={STORY_BUDGET:{idFromName:name=>name,get:()=>({async fetch(request){
    const method=new URL(request.url).pathname.slice(1);
    const result={admit:{kind:'allowed'},getSession:{kind:'session',sessionRef:'knowledge-session'},lookup:{code:'ATTEMPT_NOT_FOUND'},reserve:{kind:'reserved'},settle:{kind:'settled'}}[method];
    assert.ok(result,'unexpected budget method '+method);return Response.json(result);
  }})},AI:{async run(model,input){
    calls++;assert.equal(model,GLM_MODEL_ID);assert.equal(JSON.parse(input.messages[1].content).storyReferences,undefined);
    const chunk={model,choices:[{delta:{content:JSON.stringify(scene)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};
    return new Response('data: '+JSON.stringify(chunk)+'\n\ndata: [DONE]\n\n').body;
  }},STORY_KNOWLEDGE:{async get(key,type){reads.push(key);return store.get(key,type);}}};
  return {worker,env,reads,get calls(){return calls;},turn:()=>worker.fetch(new Request('https://game.test/api/story/turn',{method:'POST',headers:{origin:'https://game.test','content-type':'application/json','X-Story-Actions':'1',cookie:'__Host-story_session='+'a'.repeat(64)},body:JSON.stringify({context,attempt:{id:'knowledge-policy-attempt',sessionRef:'knowledge-session',retryOf:null},storyActions:true})}),env)};
}

test('rolling back to legacy production ignores a retained knowledge binding and still generates a turn',async()=>{
  const config=policy();delete config.knowledge;
  const f=turnFixture(config,{get:async()=>null});
  assert.equal((await(await f.worker.fetch(request('/api/story/knowledge'),f.env)).json()).status,'disabled');
  assert.equal((await(await f.worker.fetch(request('/api/story/capabilities'),f.env)).json()).available,true);
  const result=await(await f.turn()).json();
  assert.equal(result.status,'ready',result.errorCode);assert.equal(f.calls,1);assert.deepEqual(f.reads,[]);
  assert.equal(result.scene.retrieval,undefined);
});

test('explicit production knowledge still requires the selected shard after verifying its completion marker',async()=>{
  const f=turnFixture(policy(),{get:async key=>key===manifest.manifestKey?marker:null});
  const result=await(await f.turn()).json();
  assert.equal(result.status,'paused');assert.equal(result.errorCode,'KNOWLEDGE_UNAVAILABLE');assert.equal(f.calls,0);
  assert.equal(f.reads[0],manifest.manifestKey);assert.ok(f.reads.some(key=>key!==manifest.manifestKey));
});

test('a hung completion-marker read expires, clears its shared check and permits recovery',async()=>{
  let reads=0;const store={get(){reads++;return reads===1?new Promise(()=>{}):Promise.resolve(marker);}};
  const checks=[assertStoryKnowledgeReady(store,{timeoutMs:5}),assertStoryKnowledgeReady(store,{timeoutMs:5})];
  const result=await Promise.race([Promise.allSettled(checks),new Promise(resolve=>setTimeout(()=>resolve('hung'),100))]);
  assert.notEqual(result,'hung','readiness must settle before the provider watchdog starts');
  assert.equal(reads,1);
  for(const row of result){assert.equal(row.status,'rejected');assert.equal(row.reason.code,'KNOWLEDGE_UNAVAILABLE');assert.equal(row.reason.message,'KNOWLEDGE_UNAVAILABLE');}
  // Recovery includes real asynchronous hashing; retain its production budget
  // even when the deliberately hung first read uses a shortened test deadline.
  await assertStoryKnowledgeReady(store);
  assert.equal(reads,2);
});

test('hung marker readiness returns bounded public paused responses before any inference',async()=>{
  const store={get(){return new Promise(()=>{});}},worker=createStoryProductionWorker({config:policy()});
  const [capabilities,knowledge]=await Promise.all(['/api/story/capabilities','/api/story/knowledge'].map(async path=>(await worker.fetch(request(path),{AI:noAi,STORY_KNOWLEDGE:store})).json()));
  for(const result of [capabilities,knowledge]){
    assert.equal(result.available,false);assert.equal(result.status,'paused');assert.equal(result.errorCode,'KNOWLEDGE_UNAVAILABLE');
    assert.equal(JSON.stringify(result).includes(manifest.manifestKey),false);
  }
});

test('production pins the full corpus version and explicit private KV binding',()=>{
  assert.equal(sha256(marker),manifest.manifestSha256);
  assert.deepEqual(validateStoryProductionPolicy(policy()),policy());
  for(const knowledge of [null,{},false,{...policy().knowledge,enabled:false},{...policy().knowledge,namespaceId:'unbound'},{...policy().knowledge,corpusVersion:'other-corpus'},{...policy().knowledge,publicText:true}]){
    assert.throws(()=>validateStoryProductionPolicy({...policy(),knowledge}),{code:'STORY_PRODUCTION_CONFIGURATION_INVALID'});
  }
  const legacy=policy();delete legacy.knowledge;
  assert.deepEqual(validateStoryProductionPolicy(legacy),legacy,'existing production policy remains valid');
});

test('new production refuses inference when private knowledge is absent, partial or mismatched',async()=>{
  for(const store of [undefined,{}, {get:async()=>null},{get:async()=>marker+' '},{get:async()=>marker.replace(manifest.contentVersion,'wrong-version')},{get:async()=>{throw Error('storage unavailable');}}]){
    const worker=createStoryProductionWorker({config:policy()}),env={AI:noAi,...(store?{STORY_KNOWLEDGE:store}:{})};
    const result=await(await worker.fetch(request('/api/story/capabilities'),env)).json();
    assert.equal(result.available,false);assert.equal(result.errorCode,'KNOWLEDGE_UNAVAILABLE');
  }
});

test('knowledge diagnostics verify only the final completion marker and reveal no source passages or storage identifiers',async()=>{
  const reads=[],store={async get(key,type){reads.push([key,type]);return marker;}},worker=createStoryProductionWorker({config:policy()});
  const response=await worker.fetch(request('/api/story/knowledge'),{AI:noAi,STORY_KNOWLEDGE:store});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();
  assert.equal(result.available,true);assert.equal(result.status,'ready');assert.equal(result.enabled,true);
  assert.equal(result.corpusVersion,manifest.contentVersion);assert.equal(result.chapterCount,2454);assert.equal(result.sectionsCovered,2454);assert.equal(result.evidenceCount,manifest.evidenceCount);assert.equal(result.curatedCount,120);assert.equal(result.sourceTextPublic,false);
  assert.deepEqual(reads,[[manifest.manifestKey,'text']]);
  const serialized=JSON.stringify(result);
  for(const privateValue of [policy().knowledge.namespaceId,manifest.manifestKey,'"text":','"records":','"currentPlan":'])assert.equal(serialized.includes(privateValue),false);
  const capabilities=await(await worker.fetch(request('/api/story/capabilities'),{AI:noAi,STORY_KNOWLEDGE:store})).json();
  assert.equal(capabilities.available,true);assert.equal(reads.length,1,'immutable verified marker is reused within this binding');
});

test('failed marker checks are retryable and verification never leaks across KV bindings',async()=>{
  let value=null,reads=0;const store={async get(){reads++;return value;}},worker=createStoryProductionWorker({config:policy()});
  let result=await(await worker.fetch(request('/api/story/knowledge'),{STORY_KNOWLEDGE:store})).json();
  assert.equal(result.errorCode,'KNOWLEDGE_UNAVAILABLE');value=marker;
  result=await(await worker.fetch(request('/api/story/knowledge'),{STORY_KNOWLEDGE:store})).json();
  assert.equal(result.available,true);assert.equal(reads,2);
  result=await(await worker.fetch(request('/api/story/knowledge'),{STORY_KNOWLEDGE:{get:async()=>null}})).json();
  assert.equal(result.available,false);
});

test('legacy or disabled production reports knowledge disabled and non-GET diagnostics do not touch storage',async()=>{
  const legacy=policy();delete legacy.knowledge;
  for(const config of [legacy,{enabled:false}]){
    const worker=createStoryProductionWorker({config});
    const result=await(await worker.fetch(request('/api/story/knowledge'),{AI:noAi})).json();
    assert.equal(result.enabled,false);assert.equal(result.available,false);assert.equal(result.status,'disabled');
  }
  const worker=createStoryProductionWorker({config:policy()});
  const response=await worker.fetch(new Request('https://game.test/api/story/knowledge',{method:'POST'}),{STORY_KNOWLEDGE:{get(){throw Error('must not read');}}});
  assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET');
});
