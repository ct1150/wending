import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {buildOpeningBrief,growthPrompt} from '../src/game/cultivation/live/experience-story.js';
import {buildStoryInput,generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE,GLM_MODEL_ID} from '../src/worker/story-config.js';

const profile={...GLM_PROFILE,storyActions:true,authoredChoices:true};
function fixture(marked=true,seed=42){
 const state=createLiveGame({runId:'experience-engine-integration',engineVersion:7,seed,...(marked?{experienceVersion:1}:{})}),pending=prepareOpening(state,{requestId:'opening'});
 return {state,pending,c:buildStoryContext(state,pending)};
}
const target={kind:'person',name:'陈砚'};
async function deliver(c,blocks,opponent){
 const story={pattern:'relationship',beat:'progress',anchors:[0],opponent};
 const choices=[{action:'interact:ask',target,purpose:'问陈砚守的是哪座桥'},{action:'interact:leave',target,purpose:'向陈砚辞行，绕开桥头'}];
 let calls=0;const r=await generateProviderScene({run:async()=>{calls++;return {model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify({blocks,story,choices})}}],usage:{prompt_tokens:200,completion_tokens:110,total_tokens:310}};}},profile,c);
 assert.equal(calls,1);assert.equal(r.status,'ready',r.errorCode);return r.scene;
}

test('marked openings ask the model for decisions informed by the actual origin and technique',()=>{
 const seen=new Set();
 for(let seed=1;seed<=32&&seen.size<4;seed++){
  const {c}=fixture(true,seed),brief=buildOpeningBrief(c);seen.add(brief.kind);
  const input=buildStoryInput(profile,c),facts=input.messages.map(m=>m.content).join(' ');
  assert.ok(facts.includes(brief.goal)&&facts.includes(brief.dilemma));
  assert.ok(facts.includes(brief.strength)&&facts.includes(brief.tradeoff));
  if(growthPrompt(c))assert.ok(facts.includes(growthPrompt(c)));
  const schema=input.response_format.json_schema.schema;
  assert.ok(schema.required.includes('choices')&&schema.required.includes('blocks'));assert.ok(schema.properties.story.properties.opponent);
  assert.doesNotMatch(facts,/possibleNextSteps/);
 }
 assert.equal(seen.size,4);
});

test('marked scenes attach only corroborated opponent intelligence to its original block',async()=>{
 const {state,pending,c}=fixture();
 const blocks=[{kind:'narration',text:'陈砚已入筑基。陈砚意在守桥，破绽是旧伤未愈。'},{kind:'dialogue',speaker:target,text:'桥头风大。'}];
 const note={target,anchor:0,realmId:'foundation',purpose:'守桥',condition:'旧伤未愈'};
 const scene=await deliver(c,blocks,note),actor=scene.entities.find(e=>e.name===target.name);
 assert.deepEqual(scene.story.opponent,{entityId:actor.id,anchor:0,realmId:'foundation',purpose:'守桥',condition:'旧伤未愈'});
 assert.deepEqual(actor.experience,{version:1,realmId:'foundation'});
 const saved=commitTurn(state,pending,scene);assert.equal(saved.revision,1);assert.deepEqual(saved.currentScene.story.opponent,scene.story.opponent);
 const rumor=await deliver(c,[{kind:'narration',text:'传闻陈砚已入筑基，并无凭据。'},blocks[1]],note);
 assert.equal(rumor.story.opponent,undefined);assert.equal(rumor.entities.find(e=>e.name===target.name).experience,undefined);
 const unmarked=await deliver(fixture(false).c,blocks,note);assert.equal(unmarked.story.opponent,undefined);
});
