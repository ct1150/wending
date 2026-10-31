import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_MODEL_ID,GLM_PROFILE} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';

const state=createLiveGame({runId:'separate-speakers',seed:42,engineVersion:7}),pending=prepareOpening(state,{requestId:'open'}),c=buildStoryContext(state,pending);
const person={kind:'person',name:'锦衣人甲'},n={kind:'narration',text:'山路尽头，草木在风中起伏。'},d={kind:'dialogue',speaker:person,text:'守门人还有一句话要说。我答应明日交还玉简。'};
const invalid={kind:'dialogue',speaker:{...person,ref:'k99'},text:'这段不可确认归属，也不可单独变成一条旁白。'};
function deliver(wire,context){
  let calls=0;
  const ai={run:async()=>{assert.equal(++calls,1);return {model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}],usage:{prompt_tokens:100,completion_tokens:200,total_tokens:300}};}};
  return generateProviderScene(ai,{...GLM_PROFILE,storyActions:true,authoredChoices:true},context);
}


const choices=[{action:'interact:ask',target:person,purpose:'问守门人玉简从何而来'},{action:'interact:decline',target:person,purpose:'与守门人道别，暂缓接下玉简'}];

test('a conflicting speaking identity cannot be assigned to the witness named in the model menu',async()=>{
  for(const bad of [invalid,{...invalid,speaker:'r:foreign:t1:e:p'},{...invalid,speaker:c.life.name}]){
    const out=await deliver({blocks:[n,bad,d],choices,memoryDeltas:[{kind:'promise',target:'p1',anchor:1,status:'open'}]},c);
    assert.notEqual(out.status,'ready');assert.equal(out.scene,undefined);
  }
  const real=await deliver({blocks:[n,d],choices,memoryDeltas:[{kind:'promise',target:person,anchor:1,status:'open'}]},c);
  assert.equal(real.status,'ready',real.errorCode);
  const saved=commitTurn(state,pending,real.scene),witness=saved.currentScene.blocks[1].speaker;
  assert.equal(saved.currentScene.memoryDeltas[0].entityId,witness);
  assert.equal(saved.currentScene.memoryDeltas[0].text,d.text);
  assert.ok(saved.currentScene.choices.every(row=>row.targetId===witness));
});
