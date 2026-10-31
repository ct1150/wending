import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStoryChoicePlan,materializeStoryChoices} from '../src/worker/story-choice-plan.js';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {decodeGlmScene} from '../src/worker/story-glm-wire.js';
import {v7ActionRule} from '../src/game/cultivation/live/cultivation-rules.js';
import {ITEMS} from '../src/game/cultivation/live/model.js';

const state=createLiveGame({runId:'plan-at-birth',seed:42,engineVersion:7}),opening=prepareOpening(state,{requestId:'open'});
const context=()=>structuredClone(buildStoryContext(state,opening));
const blocks=[{kind:'dialogue',speaker:{kind:'person',name:'船夫'},text:'这只陶罐是从断桥底下捞来的。'}];
const sceneFor=(c,rows,body=blocks)=>decodeGlmScene({blocks:body,choices:rows,title:'河岸',location:'渡口',memoryDeltas:[],story:{pattern:'investigation',beat:'progress',anchors:[0]}},c,{storyActions:true});

test('the frozen opening plan becomes actionable without reading any model choices',()=>{
  const c=context(),plan=buildStoryChoicePlan(c),same=buildStoryChoicePlan(structuredClone(c));assert.deepEqual(plan,same);assert.ok(plan.cues.length>=2);
  const rows=materializeStoryChoices(plan,c,blocks);assert.ok(rows.length>=2&&rows.length<=3);const scene=sceneFor(c,rows),first=scene.choices.find(row=>row.approach==='ask');
  assert.equal(first.targetId,scene.blocks[0].speaker);assert.match(first.label,/陶罐/);assert.deepEqual(scene.blocks[0].text,blocks[0].text);
  const active=commitTurn(state,opening,scene);for(const choice of scene.choices)assert.equal(prepareChoice(active,{requestId:'choose',choiceId:choice.id}).receipt.action.id,choice.id);
  assert.deepEqual(materializeStoryChoices(plan,c,blocks),rows);
});

test('a quoted NPC remark yields a readable question about one clause',()=>{
  const c=context(),body=[{kind:'dialogue',speaker:{kind:'person',name:'老张'},text:'“这东西邪门得很，我刚才摸过，指尖还麻着。”'}];
  const ask=materializeStoryChoices(buildStoryChoicePlan(c),c,body).find(x=>x.action==='interact:ask');
  assert.equal(ask.purpose,'问问“这东西邪门得很”是怎么回事');
});

test('a narration-only opening has a real playable menu without inventing a speaker',()=>{
  const c=context(),body=[{kind:'narration',text:'渡口无人，唯见水纹荡开。'}],rows=materializeStoryChoices(buildStoryChoicePlan(c),c,body),scene=sceneFor(c,rows,body);
  assert.ok(rows.length>=2);assert.ok(scene.choices.some(x=>x.intent==='interact'&&x.approach==='observe'&&x.targetId==='self'));assert.ok(!scene.entities.some(x=>x.kind==='person'));
  commitTurn(state,opening,scene);
});

test('affordable progression and world routes remain reachable over later turns; every materialized row uses the actual rules',()=>{
  const c=context();c.phase='choice';c.life.realm='foundation';c.life.cultivation=100;c.life.injury=0;for(const id of Object.keys(ITEMS))c.life.items[id]=200;c.life.cultivationProfile.spirit=100;
  const offered=new Set();
  for(let turn=2;turn<=112;turn++){
    c.identity.turnId=turn;c.receipt.action={intent:'interact',approach:'observe',targetId:'self',label:'观察渡口'};
    const rows=materializeStoryChoices(buildStoryChoicePlan(c),c,blocks),scene=sceneFor(c,rows);
    assert.ok(rows.length>=2&&rows.length<=3);for(const choice of scene.choices){const rule=v7ActionRule({life:c.life,turnId:turn,relatedEntities:scene.entities},choice);assert.equal(rule.reason,undefined,choice.approach);offered.add(choice.intent+':'+choice.approach);}
  }
  for(const action of ['practice:steady','practice:breakthrough','explore:cautious','travel:road','travel:smuggle','craft:alchemy','negotiate:bargain'])assert.ok(offered.has(action),action);
});

test('an ended contact and dead actors do not return as active opponents or addressees',()=>{
  const c=context();c.phase='choice';c.identity.turnId=6;c.entities=[{id:'old:host',name:'船夫',kind:'person',status:'alive'},{id:'old:dead',name:'故人',kind:'person',status:'dead'}];
  c.receipt.action={intent:'interact',approach:'leave',targetId:'old:host',label:'向船夫告辞'};
  const rows=materializeStoryChoices(buildStoryChoicePlan(c),c,[{kind:'dialogue',speaker:'k1',text:'船已离岸。'},{kind:'dialogue',speaker:'k2',text:'无效的对白。'}]);assert.ok(rows.length>=2);assert.ok(!rows.some(r=>['k1','k2'].includes(r.target)));
});

test('combat and retreat stay with the established opponent, and the safe alternative costs no time',()=>{
  const c=context();c.phase='choice';c.identity.turnId=8;c.entities=[{id:'old:rival',name:'执剑人',kind:'person',status:'alive'}];c.receipt.action={intent:'fight',approach:'guard',targetId:'old:rival',label:'守住剑势'};
  const foe=[{kind:'dialogue',speaker:'k1',text:'再接一剑。'}],plan=buildStoryChoicePlan(c),choices=materializeStoryChoices(plan,c,foe);
  assert.ok(choices.some(r=>r.action.startsWith('fight:')&&r.target==='k1'));assert.ok(choices.some(r=>r.action.startsWith('evade:')&&r.target==='k1'));assert.ok(choices.some(r=>r.action==='interact:observe'&&r.target==='self'));
  const bystander=[{kind:'dialogue',speaker:{kind:'person',name:'过路人'},text:'我只来问路。'}];assert.ok(!materializeStoryChoices(plan,c,bystander).some(r=>r.action.startsWith('fight:')||r.action.startsWith('evade:')));
});

test('an active clue grounds the next question, while exhausted resources never create unaffordable offers',()=>{
  const c=context();c.phase='choice';c.identity.turnId=4;c.director.mainQuest={kind:'clue',text:'断桥下的陶罐'};c.receipt.action={intent:'interact',approach:'observe',targetId:'self',label:'辨认河中的物件'};
  for(const id of Object.keys(c.life.items))c.life.items[id]=0;c.life.cultivationProfile.spirit=0;
  const rows=materializeStoryChoices(buildStoryChoicePlan(c),c,blocks);assert.ok(rows.some(r=>r.purpose.includes('断桥下的陶罐')));
  for(let turn=2;turn<24;turn++){c.identity.turnId=turn;const next=materializeStoryChoices(buildStoryChoicePlan(c),c,[]);assert.ok(next.length>=2);for(const r of next)assert.ok(!r.action.startsWith('craft:')&&!r.action.startsWith('travel:')&&r.action!=='practice:breakthrough');}
});
