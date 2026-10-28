// Regression fixtures for a real stage opening whose travel label named a
// different destination from its target ID. Only the external AI is replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {CANDIDATE_PROFILE} from '../src/worker/story-config.js';
import {generateAcceptanceScene} from '../src/worker/story-acceptance.js';
import {generateScene} from '../src/worker/story-provider.js';

const validatedFixtureProfile={...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true};
const generators=[
  ['acceptance',(ai,context)=>generateAcceptanceScene(ai,context)],
  ['production',(ai,context)=>generateScene(ai,validatedFixtureProfile,context)],
];
function fixture(){
  const state=createLiveGame({runId:'travel-target-regression',seed:42,name:'云归',originId:'village'});
  const context=buildStoryContext(state,prepareOpening(state,{requestId:'travel-opening'}));
  const prefix=context.namespace+':t1:';
  const scene={
    id:prefix+'s:scene',title:'村口消息',location:'青石村',
    entities:[
      {id:prefix+'e:place_tingfeng_lou',name:'听风楼',kind:'place'},
      {id:prefix+'e:person_boatman',name:'船夫',kind:'person',status:'alive'},
    ],
    blocks:[{kind:'dialogue',speaker:prefix+'e:person_boatman',text:'镇上有人招杂役，你可以去看看。'},{kind:'dialogue',speaker:'self',text:'我先考虑一下。'}],
    choices:[
      {id:prefix+'c:a',label:'前往镇上的听风楼应聘杂役',intent:'travel',targetId:prefix+'e:place_tingfeng_lou',approach:'road',stake:'low'},
      {id:prefix+'c:b',label:'留在村里休养',intent:'rest',targetId:'self',approach:'recover',stake:'low'},
    ],memoryDeltas:[],
  };
  return {context,scene,prefix};
}
async function generated(generate,context,scene){
  const raw={model:CANDIDATE_PROFILE.modelId,choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(scene)}}],usage:{prompt_tokens:120,completion_tokens:180,total_tokens:300}};
  const before=JSON.stringify(raw);let calls=0;
  const result=await generate({run:async()=>{calls++;return raw;}},context);
  assert.equal(calls,1);assert.equal(JSON.stringify(raw),before,'the provider does not repair rejected output');
  assert.equal(result.inferencePerformed,true);assert.equal(result.accountingStatus,'complete');
  assert.deepEqual(result.usage,{promptTokens:120,completionTokens:180,totalTokens:300});
  assert.equal(result.actualNeurons,null);assert.equal(result.stopReason,'stop');
  return result;
}
function rejected(result){
  assert.equal(result.status,'rejected');assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');
  assert.equal(Object.hasOwn(result,'scene'),false,'rejected narrative must never escape in a scene field');
}

test('provider rejects the observed travel-to-building label whose target is the current village',async()=>{
  const {context,scene,prefix}=fixture();
  scene.entities[0]={id:prefix+'e:place_qingshi_village',name:'青石村',kind:'place'};
  scene.choices[0].targetId=scene.entities[0].id;
  assert.deepEqual(validateGeneratedScene(scene,context),scene,'canonical archive validation remains unchanged');
  for(const [,generate] of generators)rejected(await generated(generate,context,scene));
});

test('travel labels must include the actual destination name even when it differs from the current location',async()=>{
  const {context,scene}=fixture();scene.entities[0].name='南山寺';
  for(const [,generate] of generators)rejected(await generated(generate,context,scene));
});

test('travel to the current location is rejected even when its name appears in the label',async()=>{
  const {context,scene}=fixture();scene.entities[0].name='青石村';scene.choices[0].label='前往青石村';
  for(const [,generate] of generators)rejected(await generated(generate,context,scene));
});

test('a declared different destination named in its travel label remains ready',async()=>{
  const {context,scene}=fixture();
  for(const [,generate] of generators){
    const result=await generated(generate,context,scene);
    assert.equal(result.status,'ready');assert.deepEqual(result.scene,scene);
  }
});

test('an undeclared travel target remains rejected by canonical validation',async()=>{
  const {context,scene}=fixture();scene.entities.shift();
  assert.throws(()=>validateGeneratedScene(scene,context),{code:'CHOICE_NOT_COMPILABLE'});
  for(const [,generate] of generators)rejected(await generated(generate,context,scene));
});

test('self actions and NPC actions retain their existing labels and identities',async()=>{
  const {context,scene,prefix}=fixture();
  scene.entities.shift();
  scene.choices[0]={...scene.choices[0],label:'打听渡口航路',intent:'negotiate',targetId:prefix+'e:person_boatman',approach:'cooperate'};
  for(const [,generate] of generators){
    const result=await generated(generate,context,scene);
    assert.equal(result.status,'ready');assert.deepEqual(result.scene,scene);
  }
});
