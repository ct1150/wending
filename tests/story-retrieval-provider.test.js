import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveGame, prepareOpening } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
import { canonicalStringify, sha256 } from '../src/game/cultivation/live/identity.js';
import { buildStoryInput, generateProviderScene } from '../src/worker/story-provider-core.js';
import { generateScene } from '../src/worker/story-provider.js';
import { createStoryApi } from '../src/worker/story-api.js';
import { CANDIDATE_PROFILE, GLM_PROFILE, GLM_MODEL_ID, STORY_LIMITS } from '../src/worker/story-config.js';

const profile=()=>({...GLM_PROFILE,validated:true,supportsStructuredOutput:true,storyActions:true});
function context(){const state=createLiveGame({runId:'retrieval-provider',seed:42});return buildStoryContext(state,prepareOpening(state,{requestId:'retrieval-provider-open'}));}
function bundle(c){
  const id='WD-TEST-001',evidenceId='FR-TEST-001',family='uncertain_witness',text='PRIVATE_EVIDENCE_CANARY：旁观者只见到结果，具体动机仍须向当事人询问。';
  const card={id,title:'旧路上的信息差',category:'人际与传闻',tags:['询问','线索'],situation:'路旁见闻尚未得到当事人证实。',conflict:'急于行动与核实消息存在取舍。',npc_motives:['见证者想说明所见，又不愿替他人担保。'],preconditions:['已有可以询问的在场人物。'],exclusions:['已确认的事实不可推翻。'],choices:[{label:'询问消息来源',tradeoff:'需要花心思核对',continuation:'得到可核实的方向',action_hint:'interact:ask',requires_extension:false}],followups:[],variation_slots:['旁观者的动机'],dedupe_key:family,adaptation_notes:'只借鉴信息差结构，不建立新的游戏事实。'};
  return {selection:{corpusVersion:'fanren-test-v1',queryHash:sha256(canonicalStringify(c)),cardIds:[id],evidenceIds:[evidenceId],families:[family]},curated:[{id,content_version:'fanren-test-v1',retrieval_text:'询问路边见证者的线索来源',metadata:{category:card.category,tags:card.tags,dedupe_key:family,source_card_id:id},card}],evidence:[{id:evidenceId,chapterId:'FR-0001',title:'测试章节',text,startOffset:0,endOffset:Array.from(text).length,startLine:1,endLine:1,sha256:sha256(text)}]};
}
function wire(){
  const actor={kind:'person',name:'陈叔',ref:'',status:null};
  return {blocks:[{kind:'narration',text:'陈叔停在村口，告诉你林中传来求救声，请你先听清方位。'}],choices:[{action:'interact:ask',target:actor,stake:'low',purpose:'求救声从哪个方位传来',anchor:0},{action:'interact:leave',target:actor,stake:'low',purpose:'放下林中求救之事',anchor:0}],title:'村口传闻',location:'村口',memoryDeltas:[]};
}
const response=(value,model=GLM_MODEL_ID)=>({model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}});
function canonicalScene(c){
  const prefix=c.namespace+':t'+c.identity.turnId+':';
  return {id:prefix+'s:scene',title:'山路',location:'山间',blocks:[{kind:'narration',text:'你停在山间，听见松风。'}],entities:[],choices:[{id:prefix+'c:rest',label:'歇息调养',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:prefix+'c:practice',label:'凝神修行',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]};
}

test('one model call receives private references and returns only server-stamped exposure identifiers',async()=>{
  const c=context(),references=bundle(c),before=JSON.stringify(c);let calls=0,input;
  const result=await generateProviderScene({run:async(_model,value)=>{calls++;input=value;return response(wire());}},profile(),c,{},undefined,references);
  assert.equal(result.status,'ready',result.errorCode);
  assert.ok(JSON.parse(input.messages[1].content).storyReferences,'selected references must reach the actual model request');
  assert.equal(calls,1);
  assert.equal(input.messages.length,3);
  assert.ok(Buffer.byteLength(JSON.stringify(input))<=STORY_LIMITS.maxInputBytes);
  assert.deepEqual(result.scene.retrieval,{version:1,...references.selection});
  assert.doesNotMatch(JSON.stringify(result.scene),/PRIVATE_EVIDENCE_CANARY|旁观者只见到结果/);
  assert.equal(JSON.stringify(c),before,'generating or previewing a scene must not mutate saved exposure memory');
});

test('old frozen contexts receive adapted prompts without a new scene field',async()=>{
  const c=structuredClone(context());delete c.retrieval;let input;
  const result=await generateProviderScene({run:async(_model,value)=>{input=value;return response(wire());}},profile(),c,{},undefined,bundle(c));
  assert.equal(result.status,'ready',result.errorCode);
  assert.ok(JSON.parse(input.messages[1].content).storyReferences);
  assert.equal(Object.hasOwn(result.scene,'retrieval'),false);
});

test('references are omitted when they cannot fit the original validated input ceiling',()=>{
  const c=context(),base=buildStoryInput(profile(),c),maxInput=Buffer.byteLength(JSON.stringify(base))+8;
  const packed=buildStoryInput({...profile(),maxInput},c,bundle(c));
  assert.ok(Buffer.byteLength(JSON.stringify(packed))<=maxInput);
  assert.deepEqual(packed,base);
});

test('a trusted reference bundle for another frozen context pauses before model inference',async()=>{
  const c=context(),references=bundle(c);references.selection.queryHash='0'.repeat(64);let calls=0;
  const result=await generateProviderScene({run:async()=>{calls++;return response(wire());}},profile(),c,{},undefined,references);
  assert.equal(calls,0);
  assert.equal(result.status,'paused');
  assert.equal(result.errorCode,'KNOWLEDGE_UNAVAILABLE');
  assert.equal(result.inferencePerformed,false);
  assert.equal(result.accountingStatus,'complete');
});

test('the model cannot forge a source receipt even when it emits a valid canonical scene',async()=>{
  const c=context(),scene=canonicalScene(c),references=bundle(c);
  scene.retrieval={version:1,...references.selection,queryHash:'a'.repeat(64),cardIds:['MODEL_FORGED']};
  const candidate={...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true};
  const result=await generateProviderScene({run:async()=>response(scene,candidate.modelId)},candidate,c,{},undefined,references);
  assert.equal(result.status,'rejected');
  assert.equal(result.errorCode,'GENERATED_SCENE_INVALID');
  assert.equal(result.scene,undefined);
});

for(const [name,store]of [
  ['missing',null],
  ['empty',{async get(){return null;}}],
  ['corrupt',{async get(){return new TextEncoder().encode('corrupt private source');}}],
  ['failed read',{async get(){throw Error('private source unavailable');}}],
  ['timed out',{get(){return new Promise(()=>{});}}],
])test(`configured ${name} knowledge degrades to the unchanged single model request without a receipt`,async()=>{
  const c=context(),before=JSON.stringify(c);let calls=0,submitted;
  const result=await generateScene({run:async(_model,input)=>{
    calls++;submitted=input;
    const chunk={model:GLM_MODEL_ID,choices:[{delta:{content:JSON.stringify(wire())},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};
    return new Response('data: '+JSON.stringify(chunk)+'\n\ndata: [DONE]\n\n').body;
  }},profile(),c,{}, {storyActions:true,knowledgeStore:store});
  assert.equal(result.status,'ready',result.errorCode);
  assert.equal(calls,1);assert.equal(result.inferencePerformed,true);assert.equal(result.accountingStatus,'complete');
  assert.deepEqual(submitted,buildStoryInput(profile(),c));
  assert.equal(result.inputHash,sha256(JSON.stringify(submitted)));
  assert.equal(result.scene.retrieval,undefined);assert.equal(JSON.stringify(c),before);
  assert.doesNotMatch(JSON.stringify(result),/private source/);
});

test('retrieval fallback preserves request validation and never starts AI after cancellation or an expired deadline',async()=>{
  for(const [options,runtime,errorCode]of [
    [{timeoutMs:0},{},'PROVIDER_OPTIONS_INVALID'],
    [{},{signal:AbortSignal.abort()},'PROVIDER_TIMEOUT'],
    [{},{deadlineAt:Date.now()-1},'PROVIDER_TIMEOUT'],
  ]){
    let calls=0;
    const result=await generateScene({run:async()=>{calls++;throw Error('must not infer');}},profile(),context(),options,{storyActions:true,knowledgeStore:{get:async()=>null},...runtime});
    assert.equal(result.errorCode,errorCode);assert.equal(calls,0);assert.equal(result.inferencePerformed,false);
  }
});

test('cancellation during a knowledge read cannot turn into a fallback model request',async()=>{
  const controller=new AbortController();let calls=0;
  const result=await generateScene({run:async()=>{calls++;throw Error('must not infer');}},profile(),context(),{}, {storyActions:true,signal:controller.signal,knowledgeStore:{get(){controller.abort();return new Promise(()=>{});}}});
  assert.equal(result.status,'paused');assert.equal(result.errorCode,'PROVIDER_TIMEOUT');
  assert.equal(calls,0);assert.equal(result.inferencePerformed,false);assert.equal(result.accountingStatus,'complete');
});

test('a Free quota failure after retrieval degradation is preserved without a retry',async()=>{
  let calls=0;
  const result=await generateScene({run:async()=>{calls++;throw Object.assign(Error('3036: Free boundary'),{code:3036});}},profile(),context(),{}, {storyActions:true,knowledgeStore:null});
  assert.equal(calls,1);assert.equal(result.status,'paused');assert.equal(result.errorCode,'FREE_QUOTA_EXHAUSTED');
  assert.equal(result.accountingStatus,'complete');assert.equal(result.scene,undefined);
});

function apiFixture(provider){
  const c=context(),attempt={id:'retrieval-attempt',sessionRef:'retrieval-session',retryOf:null};let result;
  const budget={async admit(){return {kind:'allowed'};},async getSession(){return {kind:'session',sessionRef:attempt.sessionRef};},async lookup(){return result?{kind:'replay',result}:{code:'ATTEMPT_NOT_FOUND'};},async reserve(){return result?{kind:'replay',result}:{kind:'reserved'};},async settle(input){result=input.result;return {kind:'settled'};}};
  const api=createStoryApi({budget,config:{readiness:()=>profile(),knowledgeEnabled:true},provider});
  return {c,api,request:()=>new Request('https://retrieval.test/api/story/turn',{method:'POST',headers:{origin:'https://retrieval.test','content-type':'application/json','X-Story-Actions':'1',cookie:'__Host-story_session='+'a'.repeat(64)},body:JSON.stringify({context:c,attempt,storyActions:true})})};
}

test('the HTTP composition passes only its server knowledge binding and replays accepted metadata',async()=>{
  const store={async get(){return null;}};let calls=0;
  const f=apiFixture(async(_ai,_profile,c,_options,runtime)=>{
    calls++;assert.equal(runtime.knowledgeStore,store);
    return {status:'ready',accountingStatus:'complete',scene:{...canonicalScene(c),retrieval:{version:1,...bundle(c).selection}}};
  });
  const first=await(await f.api.fetch(f.request(),{STORY_KNOWLEDGE:store})).json();
  assert.equal(first.status,'ready',first.errorCode);
  const second=await(await f.api.fetch(f.request(),{STORY_KNOWLEDGE:store})).json();
  assert.deepEqual(second,first);assert.equal(calls,1);
  assert.deepEqual(first.scene.retrieval.cardIds,['WD-TEST-001']);
});

test('the HTTP boundary rejects a provider receipt bound to another context',async()=>{
  const f=apiFixture(async(_ai,_profile,c)=>({status:'ready',accountingStatus:'complete',scene:{...canonicalScene(c),retrieval:{version:1,...bundle(c).selection,queryHash:'0'.repeat(64)}}}));
  const result=await(await f.api.fetch(f.request())).json();
  assert.equal(result.status,'rejected');assert.equal(result.errorCode,'GENERATED_SCENE_INVALID');
  assert.equal(result.scene,undefined);
});
