// Local regressions for the protagonist alias observed in provider diagnostics.
// Only the external AI boundary is replaced; these tests perform no inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {generateAcceptanceScene} from '../src/worker/story-acceptance.js';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';

function opening() {
  const state=createLiveGame({runId:'player-identity-regression',seed:42,name:'云归',originId:'ferry'});
  return buildStoryContext(state,prepareOpening(state,{requestId:'opening'}));
}
function scene(context,name='船夫') {
  const prefix=context.namespace+':t1:',personId=prefix+'e:person_boatman';
  return {
    id:prefix+'s:scene',title:'渡口晨雾',location:'渡口',
    entities:[{id:personId,name,kind:'person',status:'alive'}],
    blocks:[{kind:'dialogue',speaker:personId,text:'河水涨了，过河要小心。'},{kind:'dialogue',speaker:'self',text:'我会留意水势。'}],
    choices:[
      {id:prefix+'c:a',label:'帮忙备齐行粮，换取灵石',intent:'negotiate',targetId:personId,approach:'cooperate',stake:'normal'},
      {id:prefix+'c:b',label:'留在渡口稳步修行',intent:'practice',targetId:'self',approach:'steady',stake:'normal'},
    ],memoryDeltas:[],
  };
}

test('generated scenes cannot alias the player as an NPC action target',()=>{
  const context=opening(),invalid=scene(context,'云归'),before=JSON.stringify(invalid);
  assert.throws(()=>validateGeneratedScene(invalid,context),{code:'ENTITY_IDENTITY_CONFLICT'});
  assert.equal(JSON.stringify(invalid),before,'invalid identities are rejected without repairing the scene');
});

test('provider rejects a protagonist NPC alias while preserving completed call accounting',async()=>{
  const context=opening(),invalid=scene(context,'云归');
  const raw={model:CANDIDATE_MODEL_ID,choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(invalid)}}],usage:{prompt_tokens:50,completion_tokens:100,total_tokens:150}};
  const result=await generateAcceptanceScene({run:async()=>raw},context);
  assert.equal(result.status,'rejected');
  assert.equal(result.errorCode,'ENTITY_IDENTITY_CONFLICT');
  assert.equal(result.inferencePerformed,true);
  assert.equal(result.accountingStatus,'complete');
  assert.equal(Object.hasOwn(result,'scene'),false);
});

test('self dialogue and an ordinary NPC with a similar name remain valid',async()=>{
  const context=opening(),valid=scene(context,'云归舟');
  assert.deepEqual(validateGeneratedScene(valid,context),valid);
  const raw={model:CANDIDATE_MODEL_ID,choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(valid)}}],usage:{prompt_tokens:50,completion_tokens:100,total_tokens:150}};
  const result=await generateAcceptanceScene({run:async()=>raw},context);
  assert.equal(result.status,'ready');
  assert.deepEqual(result.scene,valid);
});

for(const kind of ['place','faction'])test(`a ${kind} cannot be used as a dialogue speaker`,()=>{
  const context=opening(),invalid=scene(context),prefix=context.namespace+':t1:';
  const entity={id:prefix+'e:'+kind+'_gate',name:'山门',kind};
  invalid.entities=[entity];
  invalid.blocks=[{kind:'dialogue',speaker:entity.id,text:'河水涨了，过河要小心。'}];
  invalid.choices=[
    {id:prefix+'c:a',label:'歇息',intent:'rest',targetId:'self',approach:'recover',stake:'low'},
    {id:prefix+'c:b',label:'稳步修行',intent:'practice',targetId:'self',approach:'steady',stake:'normal'},
  ];
  assert.throws(()=>validateGeneratedScene(invalid,context),{code:'SPEAKER_REFERENCE_INVALID'});
});
