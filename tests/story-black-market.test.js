import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {sha256} from '../src/game/cultivation/live/identity.js';
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
  return generateProviderScene({run:async()=>({model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture.wire)}}],usage:{prompt_tokens:400,completion_tokens:450,total_tokens:850}})},{...GLM_PROFILE,storyActions:true},fixture.context);
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
])test('v7 negotiation does not admit '+name,async()=>{
  const result=await generate(fixture(items,purpose,approach));
  assert.equal(result.status,'rejected');
  assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');
  assert.equal(result.scene,undefined);
});

test('v7 ordinary negotiation still admits talking about an item price',async()=>{
  const result=await generate(fixture({relic:1},'询问古修遗物的价格','cooperate'));
  assert.equal(result.status,'ready',result.errorCode);
});
