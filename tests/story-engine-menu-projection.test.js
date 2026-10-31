import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE,GLM_MODEL_ID} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';

const profile={...GLM_PROFILE,storyActions:true,authoredChoices:true};
const person={kind:'person',name:'石叔'};
const fit=(text,n)=>Array.from(text.repeat(18)).slice(0,n).join('');
// Public diagnostic #117 captured shapes and lengths, not the unknown field
// names or the raw prose. These values are synthetic representatives.
function sample(){return {blocks:[
  {kind:'narration',text:fit('石叔坐在村口的石碾旁，破陶罐里时不时透出热气。',144)},
  {kind:'dialogue',speaker:person,text:fit('刚从河滩捞起来，谁都没有开过盖。想看就先看看这道裂纹。',110)},
  {kind:'narration',text:fit('一阵风吹开摊布，盖上的红泥露了出来。你还没动手。',113)},
],title:'村口的陶罐',location:'旧村口'};}
function setup(){const state=createLiveGame({runId:'shape-117',engineVersion:7,seed:42}),pending=prepareOpening(state,{requestId:'opening'});return {state,pending,c:buildStoryContext(state,pending)};}
async function deliver(wire,c){
  let calls=0;const ai={run:async()=>{calls++;return {model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}],usage:{prompt_tokens:100,completion_tokens:300,total_tokens:400}};}};
  const result=await generateProviderScene(ai,profile,c);assert.equal(calls,1);return result;
}


test('the #117-shaped narrative needs an authored menu and preserves its actual speaker when one exists',async()=>{
  const {state,pending,c}=setup(),{blocks,title,location}=sample();
  assert.deepEqual(blocks.map(b=>Array.from(b.text).length),[144,110,113]);
  const missing=await deliver({blocks},c);assert.notEqual(missing.status,'ready');assert.equal(missing.scene,undefined);
  const choices=[{action:'interact:ask',target:person,purpose:'问石叔盖上的红泥来自哪片河滩'},
    {action:'interact:observe',target:'self',purpose:'轻轻揭开摊布，检查盖上的裂纹'}];
  const result=await deliver({blocks,title,location,choices},c);
  assert.equal(result.status,'ready',result.errorCode);assert.deepEqual(result.scene.blocks.map(b=>b.text),blocks.map(b=>b.text));
  assert.deepEqual(result.scene.choices.map(c=>c.label),choices.map(x=>x.purpose));
  assert.equal(result.scene.choices[0].targetId,result.scene.blocks[1].speaker);
  const active=commitTurn(state,pending,result.scene);
  for(const choice of active.currentScene.choices)assert.deepEqual(prepareChoice(active,{choiceId:choice.id,requestId:'next-'+choice.approach}).receipt.action,choice);
  for(const extra of [{life:{realm:'immortal'}},{receipt:{death:true}},{retrieval:{corpusVersion:'forged'}},{memoryDeltas:[{referenceId:'m999',status:'resolved'}]}]){
    const rejected=await deliver({blocks,choices,...extra},c);
    assert.notEqual(rejected.status,'ready');assert.equal(rejected.scene,undefined);
  }
});
