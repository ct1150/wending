import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {CANDIDATE_PROFILE} from '../src/worker/story-config.js';
import {generateAcceptanceScene} from '../src/worker/story-acceptance.js';
import {generateScene} from '../src/worker/story-provider.js';

const generators=[generateAcceptanceScene,(ai,context)=>generateScene(ai,{...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true},context)];
function scene(context,label='留在村里休养'){
  const prefix=context.namespace+':t'+context.identity.turnId+':';
  return {id:prefix+'s:scene',title:'村中歇息',location:'青石村',entities:[],blocks:[{kind:'narration',text:'你在村中考虑下一步安排。'}],choices:[
    {id:prefix+'c:a',label,intent:'rest',targetId:'self',approach:'recover',stake:'low'},
    {id:prefix+'c:b',label:'稳步修行',intent:'practice',targetId:'self',approach:'steady',stake:'low'},
  ],memoryDeltas:[]};
}
function fixture(){const state=createLiveGame({runId:'duration-regression',seed:42});const pending=prepareOpening(state,{requestId:'opening'});return {state,pending,context:buildStoryContext(state,pending)};}
async function generate(context,value){
  const before=JSON.stringify(value),results=[];
  for(const generator of generators){
    const raw={model:CANDIDATE_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:120,completion_tokens:180,total_tokens:300}};
    const result=await generator({run:async()=>raw},context);
    assert.equal(result.inferencePerformed,true);assert.equal(result.accountingStatus,'complete');
    assert.deepEqual(result.usage,{promptTokens:120,completionTokens:180,totalTokens:300});
    assert.equal(result.actualNeurons,null);assert.equal(result.stopReason,'stop');results.push(result);
  }
  assert.equal(JSON.stringify(value),before);return results;
}
for(const label of ['休息一晚','休养30天','闭关三个月','修炼半年','歇息两日','歇息一炷香'])test('new provider choice rejects explicit duration: '+label,async()=>{
  const {context}=fixture(),value=scene(context,label);
  assert.deepEqual(validateGeneratedScene(value,context),value,'archive validation stays compatible');
  for(const result of await generate(context,value)){assert.equal(result.status,'rejected');assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');assert.equal(Object.hasOwn(result,'scene'),false);}
});
test('action labels without a fixed duration remain ready',async()=>{
  const {context}=fixture(),value=scene(context);
  for(const result of await generate(context,value)){assert.equal(result.status,'ready');assert.deepEqual(result.scene,value);}
});
test('actual receipt elapsed time remains allowed in scene narrative',async()=>{
  const {state,pending,context}=fixture(),opening=scene(context);
  const next=commitTurn(state,pending,opening),choice=prepareChoice(next,{requestId:'rest',choiceId:opening.choices[0].id});
  assert.equal(choice.receipt.elapsedDays,30);
  const continued=buildStoryContext(next,choice),value=scene(continued);
  value.blocks=[{kind:'narration',text:'三十天休养过去，村中的日子逐渐安稳。'}];
  for(const result of await generate(continued,value)){assert.equal(result.status,'ready');assert.deepEqual(result.scene,value);}
});
