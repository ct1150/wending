import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayCustomAction, customActionCommand, CUSTOM_ACTION_MESSAGE } from '../src/game/cultivation/live/custom-actions.js';
import { createLiveGame, prepareOpening, prepareChoice, prepareRecordedChoice, commitTurn } from '../src/game/cultivation/live/engine.js';
import { canonicalStringify, sha256, stateHash } from '../src/game/cultivation/live/identity.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
import { verifyPending } from '../src/game/live-archive.js';

function fixture() {
  return {runId:'custom-run',turnId:1,phase:'active',life:{realm:'mortal'},relatedEntities:[
    {id:'person:chen',name:'陈砚',kind:'person'},
    {id:'place:ferry',name:'落苇渡',kind:'place'},
  ],currentScene:{location:'石桥',choices:[
    {id:'first',label:'向陈砚打听渡口的来历',intent:'interact',targetId:'person:chen',approach:'ask',stake:'low'},
    {id:'second',label:'查看石桥的裂痕',intent:'interact',targetId:'self',approach:'observe',stake:'low'},
    {id:'third',label:'向陈砚告辞',intent:'interact',targetId:'person:chen',approach:'leave',stake:'low'},
  ]}};
}

test('numeric inputs select exactly the current option; custom intent stays verbatim',()=>{
  const state=fixture(),before=JSON.stringify(state);
  assert.deepEqual(replayCustomAction(state,'2'),state.currentScene.choices[1]);
  const text='询问陈砚：落苇渡为何封船？',action=replayCustomAction(state,text);
  assert.equal(action.intent,'interact');assert.equal(action.approach,'ask');assert.equal(action.targetId,'person:chen');assert.equal(action.label,text);
  assert.equal(action.id,replayCustomAction(state,text).id);
  assert.equal(JSON.stringify(state),before);
});

test('custom action replay derives the original text only for the reserved custom id',()=>{
  const state=fixture(),action=replayCustomAction(state,'观察石桥上的裂痕'),pending={identity:{requestId:'req',choiceId:action.id},receipt:{action,cultivationResult:{version:7}}};
  assert.deepEqual(customActionCommand(pending),{requestId:'req',choiceId:action.id,customAction:action.label});
  assert.deepEqual(customActionCommand({identity:{requestId:'req',choiceId:'first'},receipt:{action:state.currentScene.choices[0]}}),{requestId:'req',choiceId:'first'});
  assert.deepEqual(customActionCommand({...pending,receipt:{action}}),{requestId:'req',choiceId:action.id},'legacy generated IDs never acquire custom-action semantics');
});

test('known destinations and current actors map to actual rules without creating entities',()=>{
  const state=fixture();
  assert.deepEqual(Object.fromEntries(['intent','approach','targetId'].map(key=>[key,replayCustomAction(state,'前往落苇渡')[key]])),{intent:'travel',approach:'road',targetId:'place:ferry'});
  assert.equal(replayCustomAction(state,'撤退，避开陈砚').approach,'withdraw');
  assert.equal(replayCustomAction(state,'打坐修炼').intent,'practice');
  assert.equal(replayCustomAction(state,'休整疗伤').intent,'rest');
  assert.equal(replayCustomAction(state,'谨慎寻找灵石').targetId,'stones');
  assert.equal(replayCustomAction(state,'服用延寿丹药').approach,'extend');
  assert.equal(replayCustomAction(state,'反击').targetId,'person:chen');
});

test('impossible, compound, negated and ambiguous actions reject without replacing intent',()=>{
  const state=fixture(),before=JSON.stringify(state);
  for(const text of ['', '4', '直接成仙', '瞬移到天界', '去未知仙城', '攻击陌生仙人', '攻击陈砚的仇人', '帮助陈砚的敌人', '攻击陈砚以外的人', '攻击欺骗陈砚的人', '攻击陈砚身后的敌人', '攻击陈砚旁边的人', '帮助陈砚背后的敌人', '询问林长老渡口的来历', '不攻击陈砚，只观察四周', '先问陈砚然后杀掉他', '攻击陈砚，前往落苇渡', '获得一万枚灵石', '突破渡劫', '突破世界屏障', '<script>alert(1)</script>']) {
    assert.throws(()=>replayCustomAction(state,text),{code:'CUSTOM_ACTION_UNSUPPORTED',message:CUSTOM_ACTION_MESSAGE},text);
  }
  state.relatedEntities.push({id:'person:second',name:'林岫',kind:'person'});
  assert.throws(()=>replayCustomAction(state,'询问他发生了什么'),{code:'CUSTOM_ACTION_UNSUPPORTED'});
  state.relatedEntities[0].status='dead';
  assert.throws(()=>replayCustomAction(state,'询问陈砚发生了什么'),{code:'CUSTOM_ACTION_UNSUPPORTED'});
  assert.equal(JSON.stringify(fixture()),before);
});

function executableFixture(){
  const born=createLiveGame({runId:'custom-trade-refusal',seed:42,originId:'artisan',engineVersion:7});
  const draft=fixture(),scene={id:'trade-scene',title:'桥头议事',location:draft.currentScene.location,blocks:[{kind:'narration',text:'陈砚留在石桥边，等你自行决定如何回应。'}],entities:draft.relatedEntities,choices:draft.currentScene.choices,memoryDeltas:[]};
  const opening=commitTurn(born,prepareOpening(born,{requestId:'open'}),scene);
  const state=commitTurn(opening,prepareChoice(opening,{requestId:'observe',choiceId:'second'}),scene);
  // Later-life inventory isolates custom-intent admission from acquisition;
  // neither a parsed refusal nor its engine boundary may mutate this state.
  Object.assign(state.life.items,{relic:1,artifact:1});
  return state;
}

test('fresh commands accept only an offered choice id, even when the typed label matches a valid action',()=>{
  const state=executableFixture();
  for(const text of ['1','议价','观察周围',state.currentScene.choices[0].label]){
    assert.throws(()=>prepareChoice(state,{requestId:'fresh',customAction:text}),{code:'CUSTOM_ACTION_UNSUPPORTED'});
    assert.throws(()=>prepareChoice(state,{requestId:'fresh',choiceId:state.currentScene.choices[0].id,customAction:text}),{code:'CUSTOM_ACTION_UNSUPPORTED'});
  }
  assert.deepEqual(prepareChoice(state,{requestId:'fresh',choiceId:state.currentScene.choices[0].id}).receipt.action,state.currentScene.choices[0]);
});

// Captured with the actual 5.0.1 parser/engine at the fixture's recorded commit,
// before fresh-input admission rejected trade tails. This is not regenerated
// through the new resolver: all IDs, receipt fields and the final hash are fixed.
function recordedTradeFixture(){
  const captured=JSON.parse(readFileSync(new URL('./fixtures/v501-custom-trade.json',import.meta.url),'utf8'));
  const born=createLiveGame(captured.options),opening=prepareOpening(born,{requestId:captured.openingRequestId});
  return {...captured,state:commitTurn(born,opening,captured.openingScene)};
}

test('captured 5.0.1 trade-tail pending remains replayable while fresh input is refused',()=>{
  const {state,pending,pendingHash,continuationScene,committedStateHash}=recordedTradeFixture(),before=JSON.stringify(state);
  assert.equal(sha256(canonicalStringify(pending)),pendingHash);
  assert.equal(stateHash(state),pending.identity.stateHash);
  assert.deepEqual(pending.receipt.itemChanges,{stones:-1,supplies:2});
  assert.throws(()=>prepareChoice(state,customActionCommand(pending)),{code:'CUSTOM_ACTION_UNSUPPORTED'});
  assert.throws(()=>prepareChoice(state,{...customActionCommand(pending),replay:true}),'fresh commands cannot select replay semantics');
  assert.equal(JSON.stringify(state),before,'fresh refusal cannot change state or RNG');
  assert.equal(JSON.stringify(prepareRecordedChoice(state,pending)),JSON.stringify(pending));
  assert.deepEqual(buildStoryContext(state,pending).receipt,pending.receipt);
  assert.deepEqual(verifyPending(state,pending),pending);
  const committed=commitTurn(state,pending,continuationScene);
  assert.equal(stateHash(committed),committedStateHash);
  assert.deepEqual(committed.lastReceipt,pending.receipt);
  assert.equal(JSON.stringify(state),before,'recorded preparation and commit stay pure');
});

test('recorded trade-tail compatibility retains identity, receipt, life and RNG integrity checks',()=>{
  const {state,pending,continuationScene}=recordedTradeFixture(),before=JSON.stringify(state);
  const corruptions=[
    value=>{value.identity.choiceId+='x';},
    value=>{value.receipt.action.approach='black-market';},
    value=>{value.receipt.itemChanges.stones=999;},
    value=>{value.nextLife.items.stones++;},
    value=>{value.nextRng=(value.nextRng+1)>>>0;},
    value=>{value.receipt.action.label='出售法器';},
  ];
  for(const corrupt of corruptions){
    const altered=structuredClone(pending);corrupt(altered);
    assert.throws(()=>buildStoryContext(state,altered),{code:'ACTION_RECEIPT_MISMATCH'});
    assert.throws(()=>verifyPending(state,altered));
    assert.throws(()=>commitTurn(state,altered,continuationScene));
  }
  assert.equal(JSON.stringify(state),before);
});
