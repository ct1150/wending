import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCustomAction, customActionCommand, CUSTOM_ACTION_MESSAGE } from '../src/game/cultivation/live/custom-actions.js';

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
  assert.deepEqual(resolveCustomAction(state,'2'),state.currentScene.choices[1]);
  const text='询问陈砚：落苇渡为何封船？',action=resolveCustomAction(state,text);
  assert.equal(action.intent,'interact');assert.equal(action.approach,'ask');assert.equal(action.targetId,'person:chen');assert.equal(action.label,text);
  assert.equal(action.id,resolveCustomAction(state,text).id);
  assert.equal(JSON.stringify(state),before);
});

test('custom action replay derives the original text only for the reserved custom id',()=>{
  const state=fixture(),action=resolveCustomAction(state,'观察石桥上的裂痕'),pending={identity:{requestId:'req',choiceId:action.id},receipt:{action,cultivationResult:{version:7}}};
  assert.deepEqual(customActionCommand(pending),{requestId:'req',choiceId:action.id,customAction:action.label});
  assert.deepEqual(customActionCommand({identity:{requestId:'req',choiceId:'first'},receipt:{action:state.currentScene.choices[0]}}),{requestId:'req',choiceId:'first'});
  assert.deepEqual(customActionCommand({...pending,receipt:{action}}),{requestId:'req',choiceId:action.id},'legacy generated IDs never acquire custom-action semantics');
});

test('known destinations and current actors map to actual rules without creating entities',()=>{
  const state=fixture();
  assert.deepEqual(Object.fromEntries(['intent','approach','targetId'].map(key=>[key,resolveCustomAction(state,'前往落苇渡')[key]])),{intent:'travel',approach:'road',targetId:'place:ferry'});
  assert.equal(resolveCustomAction(state,'撤退，避开陈砚').approach,'withdraw');
  assert.equal(resolveCustomAction(state,'打坐修炼').intent,'practice');
  assert.equal(resolveCustomAction(state,'休整疗伤').intent,'rest');
  assert.equal(resolveCustomAction(state,'谨慎寻找灵石').targetId,'stones');
  assert.equal(resolveCustomAction(state,'服用延寿丹药').approach,'extend');
  assert.equal(resolveCustomAction(state,'反击').targetId,'person:chen');
});

test('impossible, compound, negated and ambiguous actions reject without replacing intent',()=>{
  const state=fixture(),before=JSON.stringify(state);
  for(const text of ['', '4', '直接成仙', '瞬移到天界', '去未知仙城', '攻击陌生仙人', '攻击陈砚的仇人', '帮助陈砚的敌人', '攻击陈砚以外的人', '攻击欺骗陈砚的人', '攻击陈砚身后的敌人', '攻击陈砚旁边的人', '帮助陈砚背后的敌人', '询问林长老渡口的来历', '不攻击陈砚，只观察四周', '先问陈砚然后杀掉他', '攻击陈砚，前往落苇渡', '获得一万枚灵石', '突破渡劫', '突破世界屏障', '<script>alert(1)</script>']) {
    assert.throws(()=>resolveCustomAction(state,text),{code:'CUSTOM_ACTION_UNSUPPORTED',message:CUSTOM_ACTION_MESSAGE},text);
  }
  state.relatedEntities.push({id:'person:second',name:'林岫',kind:'person'});
  assert.throws(()=>resolveCustomAction(state,'询问他发生了什么'),{code:'CUSTOM_ACTION_UNSUPPORTED'});
  state.relatedEntities[0].status='dead';
  assert.throws(()=>resolveCustomAction(state,'询问陈砚发生了什么'),{code:'CUSTOM_ACTION_UNSUPPORTED'});
  assert.equal(JSON.stringify(fixture()),before);
});
