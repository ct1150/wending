import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {CANDIDATE_PROFILE} from '../src/worker/story-config.js';
import {generateAcceptanceScene} from '../src/worker/story-acceptance.js';
import {generateScene} from '../src/worker/story-provider.js';

async function check(label,{intent='negotiate',approach='cooperate',rejected=false}={}){
  const state=createLiveGame({runId:'choice-movement',seed:42,name:'云归'});
  const context=buildStoryContext(state,prepareOpening(state,{requestId:'opening'}));
  const p=context.namespace+':t1:';
  const scene={id:p+'s:scene',title:'山林中的消息',location:'村后山林',entities:[{id:p+'e:person_lin',name:'林商',kind:'person',status:'alive'}],blocks:[{kind:'dialogue',speaker:p+'e:person_lin',text:'去云州城的车资可以商议。'}],choices:[{id:p+'c:a',label,intent,targetId:p+'e:person_lin',approach,stake:'low'},{id:p+'c:b',label:'静坐调息',intent:'rest',targetId:'self',approach:'recover',stake:'low'}],memoryDeltas:[]};
  assert.deepEqual(validateGeneratedScene(scene,context),scene,'existing archive validation is unchanged');
  const raw={model:CANDIDATE_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(scene)}}],usage:{prompt_tokens:120,completion_tokens:180,total_tokens:300}};
  for(const run of [generateAcceptanceScene,(ai,c)=>generateScene(ai,{...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true},c)]){
    const result=await run({run:async()=>raw},context);
    assert.equal(result.inferencePerformed,true);assert.equal(result.accountingStatus,'complete');
    assert.deepEqual(result.usage,{promptTokens:120,completionTokens:180,totalTokens:300});
    assert.equal(result.actualNeurons,null);
    if(rejected){assert.equal(result.status,'rejected');assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');assert.equal(Object.hasOwn(result,'scene'),false);}
    else {assert.equal(result.status,'ready');assert.deepEqual(result.scene,scene);}
  }
}
test('negotiation cannot promise the observed return-and-carriage journey',()=>check('返回青石村，寻找林商搭车前往云州城',{rejected:true}));
test('asking about a route is still negotiation',()=>check('询问前往云州城的路线'));
test('discussing travel costs is still negotiation',()=>check('与林商商议前往云州城的车资与路线'));
test('movement remains valid for an actual evasion action',()=>check('返回树林中隐蔽',{intent:'evade',approach:'conceal'}));
