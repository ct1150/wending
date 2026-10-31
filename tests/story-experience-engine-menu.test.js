import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {buildOpeningBrief,growthPrompt} from '../src/game/cultivation/live/experience-story.js';
import {buildStoryInput,generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE,GLM_MODEL_ID} from '../src/worker/story-config.js';

const profile={...GLM_PROFILE,storyActions:true,engineMenu:true};
function fixture(marked=true,seed=42){
 const state=createLiveGame({runId:'experience-engine-integration',engineVersion:7,seed,...(marked?{experienceVersion:1}:{})}),pending=prepareOpening(state,{requestId:'opening'});
 return {state,pending,c:buildStoryContext(state,pending)};
}
const target={kind:'person',name:'陈砚'};
async function deliver(c,blocks,story){
 let calls=0;const r=await generateProviderScene({run:async()=>{calls++;return {model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify({blocks,story})}}],usage:{prompt_tokens:200,completion_tokens:110,total_tokens:310}};}},profile,c);
 assert.equal(calls,1);assert.equal(r.status,'ready',r.errorCode);return r.scene;
}

test('the 6.0 authored opening and technique guidance coexist with engine-owned decisions',()=>{
 const seen=new Set();
 for(let seed=1;seed<=32&&seen.size<4;seed++){
  const {c}=fixture(true,seed),brief=buildOpeningBrief(c);seen.add(brief.kind);
  const input=buildStoryInput(profile,c),facts=JSON.parse(input.messages.at(-1).content);
  assert.ok(facts.focus.includes(brief.goal)&&facts.focus.includes(brief.dilemma));
  assert.ok(facts.focus.includes(brief.strength)&&facts.focus.includes(brief.tradeoff));
  if(growthPrompt(c))assert.ok(facts.focus.includes(growthPrompt(c)));
  const schema=input.response_format.json_schema.schema;
  assert.deepEqual(schema.required,['blocks']);assert.ok(schema.properties.story.properties.opponent);
  assert.match(facts.focus,/有依据|明确揭示/u);assert.ok(facts.possibleNextSteps.length>=2);assert.equal(schema.properties.choices,undefined);
 }
 assert.equal(seen.size,4);
});

test('the marked engine-menu adapter saves only corroborated opponent intelligence and remaps its original block',async()=>{
 const {state,pending,c}=fixture(),bad={kind:'dialogue',speaker:'r:foreign:t2:e:p',text:'不使用此段。'};
 const blocks=[bad,{kind:'narration',text:'陈砚已入筑基。陈砚意在守桥，破绽是旧伤未愈。'},{kind:'dialogue',speaker:target,text:'桥头风大。'}];
 const note={target,anchor:1,realmId:'foundation',purpose:'守桥',condition:'旧伤未愈'};
 const scene=await deliver(c,blocks,{opponent:note}),actor=scene.entities.find(e=>e.name===target.name);
 assert.deepEqual(scene.story.opponent,{entityId:actor.id,anchor:0,realmId:'foundation',purpose:'守桥',condition:'旧伤未愈'});
 assert.deepEqual(actor.experience,{version:1,realmId:'foundation'});
 const saved=commitTurn(state,pending,scene);assert.equal(saved.revision,1);assert.deepEqual(saved.currentScene.story.opponent,scene.story.opponent);
 const rumor=await deliver(c,[bad,{kind:'narration',text:'传闻陈砚已入筑基，并无凭据。'},blocks[2]],{opponent:note});
 assert.equal(rumor.story.opponent,undefined);assert.equal(rumor.entities.find(e=>e.name===target.name).experience,undefined);
 const unmarked=await deliver(fixture(false).c,blocks,{opponent:note});assert.equal(unmarked.story.opponent,undefined);
});
