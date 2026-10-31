import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {sha256,stateHash} from '../src/game/cultivation/live/identity.js';
import {renderLiveJourney} from '../src/ui/journey.js';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE,GLM_MODEL_ID} from '../src/worker/story-config.js';
import {cultivationFixtureProse} from './helpers/live-story-fixture.js';

function fixture(items,purpose,approach='black-market') {
  let state=createLiveGame({runId:'black-market-regression',seed:42,engineVersion:7});
  const namespace='r:'+sha256(state.runId).slice(0,16),actor={id:namespace+':t1:e:merchant',name:'江陌',kind:'person'};
  const previous=turn=>({id:namespace+':t'+turn+':s:scene',title:'暗市旧摊',location:'暗市',blocks:[{kind:'narration',text:cultivationFixtureProse('江陌站在暗市旧摊边，等待你自行决定下一步。',turn)}],entities:[actor],choices:[
    {id:namespace+':t'+turn+':c:watch',label:'观察旧摊边的脚印',intent:'interact',targetId:'self',approach:'observe',stake:'low'},
    {id:namespace+':t'+turn+':c:ask',label:'询问江陌摊位的来历',intent:'interact',targetId:actor.id,approach:'ask',stake:'low'},
    {id:namespace+':t'+turn+':c:decline',label:'婉拒江陌的提议',intent:'interact',targetId:actor.id,approach:'decline',stake:'low'},
  ],memoryDeltas:[],story:{pattern:'bargain',beat:'progress',anchors:[0]}});
  state=commitTurn(state,prepareOpening(state,{requestId:'opening'}),previous(1));
  state=commitTurn(state,prepareChoice(state,{requestId:'watch',choiceId:state.currentScene.choices[0].id}),previous(2));
  // A later-life inventory fixture isolates provider admission; the assertions
  // below execute the admitted proposal through the real settlement rules.
  Object.assign(state.life.items,{relic:0,artifact:0,...items});
  const pending=prepareChoice(state,{requestId:'next',choiceId:state.currentScene.choices[0].id}),context=buildStoryContext(state,pending);
  const target={kind:'person',name:actor.name,ref:'',status:null};
  const wire={blocks:[{kind:'narration',text:cultivationFixtureProse('江陌拨亮暗市摊位旁的灯，说明此地只收已经持有的古修遗物或法器。交易尚未开始，你仍可以听清条件，或者查看灯影下的旧印。',3)}],title:'灯下议价',location:'暗市',choices:[
    {action:'negotiate:'+approach,target,stake:'normal',purpose,anchor:0},
    {action:'interact:ask',target,stake:'low',purpose:'这处暗市由谁照看',anchor:0},
    {action:'interact:observe',target:'self',stake:'low',purpose:'辨认灯影下的旧印',anchor:0},
  ],memoryDeltas:[],story:{pattern:'bargain',beat:'progress',anchors:[0]}};
  return {state,pending,context,wire};
}

async function generate(fixture) {
  let calls=0;
  const result=await generateProviderScene({run:async()=>{calls++;return {model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture.wire)}}],usage:{prompt_tokens:400,completion_tokens:450,total_tokens:850}};}},{...GLM_PROFILE,storyActions:true},fixture.context);
  assert.equal(calls,1,'menu admission must use only this completed response');
  return result;
}

for(const {name,items,purpose,sold,stones} of [
  {name:'held relic',items:{relic:1},purpose:'出售古修遗物，换取灵石',sold:'relic',stones:25},
  {name:'held artifact without relic',items:{artifact:1},purpose:'出售法器，换得灵石',sold:'artifact',stones:15},
  {name:'relic before another held artifact',items:{relic:1,artifact:1},purpose:'卖出古修遗物',sold:'relic',stones:25},
  {name:'one of two held relics',items:{relic:2},purpose:'出售一件古修遗物，换取灵石',sold:'relic',stones:25},
])test('v7 black-market accepts the rule-selected '+name,async()=>{
  const f=fixture(items,purpose),result=await generate(f);
  assert.equal(result.status,'ready',result.errorCode);
  const committed=commitTurn(f.state,f.pending,result.scene),sale=prepareChoice(committed,{requestId:'sell',choiceId:result.scene.choices[0].id});
  assert.equal(sale.receipt.action.approach,'black-market');assert.ok(sale.receipt.action.label.endsWith(purpose));
  assert.equal(sale.receipt.itemChanges[sold],-1);
  assert.equal(sale.nextLife.items[sold],items[sold]-1);
  const other=sold==='relic'?'artifact':'relic';
  assert.equal(sale.nextLife.items[other],items[other]??0);
  assert.equal(sale.receipt.itemChanges.stones??0,sale.receipt.cultivationResult.check.success?stones:0);
});

for(const {name,items,purpose,approach} of [
  {name:'purchase',items:{relic:1},purpose:'购买古修遗物'},
  {name:'purchase with a quantity',items:{relic:1},purpose:'买一件古修遗物'},
  {name:'buying back an item',items:{relic:1},purpose:'买回古修遗物'},
  {name:'acquiring an item',items:{relic:1},purpose:'收购古修遗物'},
  {name:'asking about an item',items:{relic:1},purpose:'询问古修遗物的来历'},
  {name:'selling two items in Chinese',items:{relic:2},purpose:'出售两件古修遗物'},
  {name:'selling two items in digits',items:{relic:2},purpose:'出售2件古修遗物'},
  {name:'ordinary negotiation sale',items:{relic:1},purpose:'出售古修遗物',approach:'cooperate'},
  {name:'ordinary negotiation purchase alias',items:{relic:1},purpose:'买一件古修遗物',approach:'cooperate'},
  {name:'ordinary negotiation sale alias',items:{relic:1},purpose:'卖古修遗物',approach:'cooperate'},
  {name:'ordinary bargain acquisition alias',items:{artifact:1},purpose:'收购法器',approach:'bargain'},
  {name:'artifact while a relic takes priority',items:{relic:1,artifact:1},purpose:'出售法器'},
  {name:'unheld relic',items:{artifact:1},purpose:'出售古修遗物'},
  {name:'unheld artifact',items:{},purpose:'出售法器'},
  {name:'another inventory item',items:{relic:1,herbs:1},purpose:'出售灵草'},
  {name:'two inventory items',items:{relic:1,artifact:1},purpose:'出售古修遗物和法器'},
  {name:'stones sold alongside the relic',items:{relic:1,stones:5},purpose:'出售古修遗物和灵石'},
  {name:'companion relic',items:{relic:1},purpose:'出售听烛残灯'},
  {name:'wrong exchange reward',items:{relic:1},purpose:'出售古修遗物，换取完整功法'},
  {name:'invented exchange amount',items:{relic:1},purpose:'出售古修遗物，换取一百灵石'},
])test('v7 drops '+name+' and keeps both original interactions playable',async()=>{
  const f=fixture(items,purpose,approach),result=await generate(f);
  assert.equal(result.status,'ready',result.errorCode);
  const state=commitTurn(f.state,f.pending,result.scene),prefix=f.context.namespace+':t'+f.pending.identity.turnId+':c:';
  const askId=prefix+'b',observeId=prefix+'c',actor=f.state.currentScene.entities[0];
  assert.deepEqual(state.currentScene.blocks,f.wire.blocks);
  assert.deepEqual(state.currentScene.choices,[
    {id:askId,label:'询问'+actor.name+'：'+f.wire.choices[1].purpose,intent:'interact',approach:'ask',targetId:actor.id,stake:'low'},
    {id:observeId,label:'仔细观察：'+f.wire.choices[2].purpose,intent:'interact',approach:'observe',targetId:'self',stake:'low'},
  ]);
  const compiled=compileChoices(state,state.currentScene.choices),html=renderLiveJourney({state,stateHash:stateHash(state),status:'ready'},compiled);
  const buttons=[...html.matchAll(/<button\b[^>]* data-live-choice="([^"]+)"[^>]*>/gu)];
  assert.deepEqual(buttons.map(button=>button[1]),[askId,observeId]);
  assert.ok(buttons.every(button=>!button[0].includes(' disabled')));
  assert.throws(()=>prepareChoice(state,{choiceId:prefix+'a',requestId:'stale-trade'}),/当前场景没有此行动/u);
  assert.deepEqual(state.life.items,f.state.life.items);
  for(const choice of state.currentScene.choices){
    const next=prepareChoice(state,{requestId:'select-'+choice.approach,choiceId:choice.id});
    assert.deepEqual(next.receipt.action,choice);
    assert.deepEqual(next.receipt.itemChanges,{});assert.deepEqual(next.nextLife.items,state.life.items);
  }
});

test('an entirely invalid trade menu produces no committable scene or inventory change',async()=>{
  const f=fixture({relic:1,artifact:1,stones:8},'购买古修遗物'),trade=f.wire.choices[0];
  f.wire.choices=[trade,{...trade,action:'negotiate:cooperate',purpose:'出售古修遗物'},{...trade,action:'negotiate:bargain',purpose:'收购法器'}];
  const original=structuredClone(f.state),result=await generate(f);
  assert.equal(result.status,'rejected');assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');
  assert.equal(result.scene,undefined);
  assert.throws(()=>commitTurn(f.state,f.pending,result.scene));
  assert.deepEqual(f.state,original,'the last committed scene, receipt, revision, RNG and entire inventory remain intact');
});

test('v7 ordinary negotiation keeps the original proposal to discuss an item price',async()=>{
  const f=fixture({relic:1},'询问古修遗物的价格','cooperate'),result=await generate(f);
  assert.equal(result.status,'ready',result.errorCode);assert.equal(result.scene.choices.length,3);
  const state=commitTurn(f.state,f.pending,result.scene),talk=prepareChoice(state,{choiceId:result.scene.choices[0].id,requestId:'talk'});
  assert.equal(talk.receipt.action.approach,'cooperate');assert.ok(talk.receipt.action.label.endsWith(f.wire.choices[0].purpose));
  assert.equal(talk.nextLife.items.relic,state.life.items.relic);
});
