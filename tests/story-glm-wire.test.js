import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene,validateStoryContext} from '../src/game/cultivation/live/memory.js';
import {buildStoryInput} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
import {readFile} from 'node:fs/promises';
const module=await import('../src/worker/story-glm-wire.js').catch(()=>null);
const context=()=>{const state=createLiveGame({runId:'wire-run',name:'云归',seed:42});return buildStoryContext(state,prepareOpening(state,{requestId:'wire-opening'}));};
const wire=()=>({blocks:[{kind:'narration',text:'山风吹过，陈叔指向远处的山道。'},{kind:'dialogue',text:'沿山道走便是了。',speaker:'p1'}],title:'山道',location:'山下',otherPeople:[{id:'p1',name:'陈叔'}],places:[{id:'l1',name:'古道'}],factions:[],choices:[{action:'travel:road',targetId:'l1',stake:'low'},{action:'rest:recover',targetId:'self',stake:'low'}],memoryDeltas:[]});
function knownContext(){
  const state=createLiveGame({runId:'wire-known-run',name:'云归',seed:42}),opening=prepareOpening(state,{requestId:'first'}),c=buildStoryContext(state,opening);
  const next=commitTurn(state,opening,module.decodeGlmScene(wire(),c),c.relationships),pending=prepareChoice(next,{requestId:'next',choiceId:next.currentScene.choices[1].id});
  const promise={id:'promise:old',runId:state.runId,turnId:1,source:'narrative',kind:'promise',entityId:next.currentScene.entities[0].id,text:'明日还书',status:'open'};
  const result=structuredClone(buildStoryContext(next,pending,[promise]));result.life.relations[promise.entityId]=4;result.relationships[promise.entityId]=4;return result;
}

test('GLM wire uses short aliases and server-owned scene and choice identities',()=>{
  assert.ok(module);const c=context(),input=wire(),before=structuredClone(input),scene=module.decodeGlmScene(input,c),prefix=c.namespace+':t1:';
  assert.equal(scene.id,prefix+'s:scene');assert.equal(scene.choices[0].id,prefix+'c:a');assert.equal(scene.entities[0].id,prefix+'e:person_1');assert.equal(scene.blocks[1].speaker,scene.entities[0].id);assert.equal(scene.choices[0].targetId,scene.entities[1].id);assert.deepEqual(validateGeneratedScene(scene,c),scene);assert.deepEqual(input,before);
  assert.equal(scene.choices[0].label,'沿路前往古道（谨慎）');
});

test('GLM request puts narrative first and keeps birth facts without asking the model to copy hashes',()=>{
  const c=context(),before=structuredClone(c),input=buildStoryInput(GLM_PROFILE,c),user=JSON.parse(input.messages[1].content);
  assert.deepEqual(user.life.birth,c.life.birth);assert.equal(user.namespace,undefined);assert.equal(user.identity,undefined);assert.equal(user.turn,1);assert.doesNotMatch(input.messages[0].content,new RegExp(c.namespace));
  assert.match(input.messages[0].content,/先写blocks/);assert.match(input.messages[0].content,/主角.*self/);assert.deepEqual(c,before);
});

test('known identities and promise closures round-trip through aliases without changing their facts',()=>{
  assert.ok(module);const c=knownContext(),known=c.entities[0].id,reference=c.memory.promises[0].id;validateStoryContext(c);
  const request=module.buildGlmWire(c,'base instructions'),packed=request.context;
  assert.equal(packed.entities[0].id,'k1');assert.equal(packed.relationships.k1,4);assert.equal(packed.memory.promises[0].id,'m1');assert.equal(packed.memory.promises[0].entityId,'k1');
  const value=wire();value.otherPeople[0]={id:'k1',name:'陈叔'};value.places[0].id='k2';value.choices[0].targetId='k2';value.blocks[0].text='你歇息过后，陈叔提醒了你们的约定。';value.blocks[1].speaker='k1';value.memoryDeltas=[{entityId:'k1',kind:'promise',text:'明日还书',referenceId:'m1',status:'resolved'}];
  const scene=module.decodeGlmScene(value,c);assert.equal(scene.entities[0].id,known);assert.equal(scene.memoryDeltas[0].referenceId,reference);assert.equal(scene.memoryDeltas[0].entityId,known);assert.deepEqual(validateGeneratedScene(scene,c),scene);
  const changed=structuredClone(value);changed.memoryDeltas[0].text='改写约定';assert.throws(()=>validateGeneratedScene(module.decodeGlmScene(changed,c),c),{code:'MEMORY_REFERENCE_CONFLICT'});
});

test('wire cannot inject authoritative IDs, unknown aliases, wrong kinds, extra fields or undeclared targets',()=>{
  assert.ok(module);const c=context();
  const changes=[s=>s.id='injected',s=>s.choices[0].id='injected',s=>s.otherPeople[0].id='person_陈叔',s=>s.otherPeople[0].id='l2',s=>s.otherPeople[0].id=['p1'],s=>s.otherPeople[0].kind='person',s=>s.places[0].status='alive',s=>s.otherPeople=null,s=>s.blocks[1].speaker='k99',s=>s.choices[0].targetId='l99',s=>s.choices[0].targetId='l2',s=>s.memoryDeltas=[{entityId:'p1',kind:'promise',text:'约定',referenceId:'m99',status:'resolved'}]];
  for(const change of changes){const s=wire();change(s);assert.throws(()=>module.decodeGlmScene(s,c),{code:'GENERATED_SCENE_INVALID'});}
});

test('the captured real identifier failure remains rejected and a player alias cannot bypass final validation',async()=>{
  const record=JSON.parse(await readFile(new URL('../docs/evidence/stream-speed-2026-10-29/glm-backup-opening-7.json',import.meta.url),'utf8'));
  assert.throws(()=>module.decodeGlmScene(JSON.parse(record.rawCompletion.choices[0].message.content),context()),{code:'GENERATED_SCENE_INVALID'});
  const s=wire(),c=context();s.otherPeople[0].name=c.life.name;
  assert.throws(()=>validateGeneratedScene(module.decodeGlmScene(s,c),c),{code:'ENTITY_IDENTITY_CONFLICT'});
});

test('wire action codes produce labels from the actual target and reject unknown action pairs',()=>{
  const c=context(),s=wire();s.choices[0].action='travel:recover';assert.throws(()=>module.decodeGlmScene(s,c),{code:'GENERATED_SCENE_INVALID'});
  const input=buildStoryInput(GLM_PROFILE,c);assert.match(input.messages[0].content,/"action"/);assert.doesNotMatch(input.messages[0].content,/"required":\["id","label"/);
});

test('packing maps only typed references even when IDs collide with field names, prose and record IDs',()=>{
  const c=knownContext(),old=c.entities[0].id;c.entities[0].id='identity';c.entities[0].name='identity';c.memory.promises[0].id='identity';c.memory.promises[0].entityId='identity';c.memory.promises[0].text='identity';c.references=['identity'];
  c.relationships.identity=c.relationships[old];delete c.relationships[old];c.life.relations.identity=c.life.relations[old];delete c.life.relations[old];validateStoryContext(c);
  const packed=module.buildGlmWire(c,'base').context;
  assert.equal(packed.identity,undefined);assert.equal(packed.entities[0].id,'k1');assert.equal(packed.entities[0].name,'identity');assert.equal(packed.memory.promises[0].id,'m1');assert.equal(packed.memory.promises[0].entityId,'k1');assert.equal(packed.memory.promises[0].text,'identity');assert.equal(packed.references[0],'m1');assert.doesNotMatch(JSON.stringify(packed),/stateHash/);
});

test('reserved entity identities cannot alias player, resource or realm semantics',()=>{
  for(const id of ['self','supplies','mortal']){
    const c=knownContext(),old=c.entities[0].id;c.entities[0].id=id;c.memory.promises[0].entityId=id;c.relationships[id]=c.relationships[old];delete c.relationships[old];c.life.relations[id]=c.life.relations[old];delete c.life.relations[old];validateStoryContext(c);
    assert.throws(()=>module.buildGlmWire(c,'base'),{code:'STORY_CONTEXT_INVALID'});assert.throws(()=>module.decodeGlmScene(wire(),c),{code:'GENERATED_SCENE_INVALID'});
  }
});

test('fresh aliases cannot claim a known ID from the current turn',()=>{
  const c=structuredClone(context());c.entities=[{id:c.namespace+':t1:e:person_1',name:'陈叔',kind:'person',status:'alive'}];delete c.relationshipVersion;delete c.relationships;validateStoryContext(c);
  assert.throws(()=>module.decodeGlmScene(wire(),c),{code:'GENERATED_SCENE_INVALID'});
});

test('captured real opening and continuation decode and pass the unchanged scene contract',async()=>{
  const evidence=JSON.parse(await readFile(new URL('../docs/evidence/stream-speed-2026-10-29/glm-browser-two-turns-first.json',import.meta.url),'utf8'));
  const cases=new Map(evidence.records.flatMap(record=>record.diagnostics.map(sample=>[sample.requestId,sample])));assert.equal(cases.size,2);
  for(const {context:c,rawCompletion,result}of cases.values()){
    validateStoryContext(c);assert.equal(result.status,'ready');assert.equal(rawCompletion.choices[0].finish_reason,'stop');
    const scene=module.decodeGlmScene(JSON.parse(rawCompletion.choices[0].message.content),c);assert.deepEqual(validateGeneratedScene(scene,c),scene);assert.deepEqual(scene,result.scene);
  }
});
