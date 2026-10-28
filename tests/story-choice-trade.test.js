import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {CANDIDATE_PROFILE} from '../src/worker/story-config.js';
import {generateAcceptanceScene} from '../src/worker/story-acceptance.js';
import {generateScene} from '../src/worker/story-provider.js';

const generators=[generateAcceptanceScene,(ai,context)=>generateScene(ai,{...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true},context)];
function fixture(label){
  const state=createLiveGame({runId:'trade-regression',seed:42});
  const context=buildStoryContext(state,prepareOpening(state,{requestId:'opening'})),prefix=context.namespace+':t1:',person=prefix+'e:person_wang';
  const scene={id:prefix+'s:scene',title:'市集交谈',location:'青石村',entities:[{id:person,name:'老王',kind:'person',status:'alive'}],blocks:[{kind:'dialogue',speaker:person,text:'你想问些什么？'}],choices:[
    {id:prefix+'c:a',label,intent:'negotiate',targetId:person,approach:'cooperate',stake:'low'},
    {id:prefix+'c:b',label:'留在村里休养',intent:'rest',targetId:'self',approach:'recover',stake:'low'},
  ],memoryDeltas:[]};return {context,scene};
}
async function generate(context,scene){
  const before=JSON.stringify(scene),results=[];
  for(const generator of generators){
    let calls=0;
    const raw={model:CANDIDATE_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(scene)}}],usage:{prompt_tokens:120,completion_tokens:180,total_tokens:300}};
    const result=await generator({run:async()=>{calls++;return raw;}},context);
    assert.equal(calls,1);assert.equal(result.inferencePerformed,true);assert.equal(result.accountingStatus,'complete');
    assert.deepEqual(result.usage,{promptTokens:120,completionTokens:180,totalTokens:300});assert.equal(result.actualNeurons,null);assert.equal(result.stopReason,'stop');results.push(result);
  }
  assert.equal(JSON.stringify(scene),before);return results;
}
for(const label of ['向老王购买那张低阶符纸','买下符纸','买走符纸','买入符纸','购入符纸','卖出符纸','卖掉符纸','出售符纸','用行粮换取符纸'])test('new provider labels cannot commit an unsupported item trade: '+label,async()=>{
  const {context,scene}=fixture(label);assert.deepEqual(validateGeneratedScene(scene,context),scene,'canonical archive validation stays compatible');
  for(const result of await generate(context,scene)){assert.equal(result.status,'rejected');assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');assert.equal(Object.hasOwn(result,'scene'),false);}
});
for(const label of ['询问符纸价格','与老王讨价还价','询问符纸的来历'])test('communication remains a valid negotiate label: '+label,async()=>{
  const {context,scene}=fixture(label);
  for(const result of await generate(context,scene)){assert.equal(result.status,'ready');assert.deepEqual(result.scene,scene);}
});
test('rule-supported negotiation exchange stays valid while another resource is rejected',async()=>{
  const {context,scene}=fixture('帮忙备齐行粮，换取灵石');
  for(const result of await generate(context,scene))assert.equal(result.status,'ready');
  scene.choices[0].label='帮忙备齐行粮，换取完整功法';
  for(const result of await generate(context,scene)){assert.equal(result.status,'rejected');assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');assert.equal(Object.hasOwn(result,'scene'),false);}
});
