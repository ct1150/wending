import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene,compileChoices} from '../src/game/cultivation/live/engine.js';
import {realmFor,nextRealmFor} from '../src/game/cultivation/live/cultivation-rules.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';

function start(){
 const state=createLiveGame({runId:'river-reader',seed:42,name:'沈渡',engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1});
 const pending=prepareOpening(state,{requestId:'opening'});
 return commitTurn(state,pending,resolveRuleScene(state,pending));
}
function pick(state,key){
 const choice=state.currentScene.choices.find(row=>row.id.endsWith(':c:'+key));
 assert.ok(choice,'missing '+key+' in '+state.currentScene.title);
 const pending=prepareChoice(state,{choiceId:choice.id,requestId:'river-'+(state.turnId+1)});
 return commitTurn(state,pending,resolveRuleScene(state,pending));
}
const follow=(state,...keys)=>keys.reduce(pick,state);
const open=()=>follow(start(),'decline','journey-menu','river-book','river-open');
const prose=state=>state.currentScene.blocks.map(block=>block.text).join('\n');

test('the player carries independent field observations through rest and reload and can act on incomplete evidence',()=>{
 let state=open();
 assert.match(prose(state),/水尺/);
 state=pick(state,'clue-1');
 assert.match(prose(state),/闸脚/);
 state=follow(state,'river-return','river-back','journey-menu','river-book','river-open');
 state=deserializeLiveState(serializeLiveState(state));
 assert.match(prose(state),/闸脚/);
 assert.equal(state.events.river.seen,2);
 const prior={...state.life.items};
 state=follow(state,'deliberate','policy-0');
 assert.equal(state.events.river.record,'0');
 assert.equal(state.events.river.seen,0);
 assert.ok(state.lastReceipt.elapsedDays>0);
 assert.equal(state.life.items.herbs,(prior.herbs??0)+1);
 state=follow(state,'next-case','river-open');
 assert.match(prose(state),/药畦.*湿/);
});

test('the other first decision changes the next evidence and the account of who carried the cost',()=>{
 let state=follow(open(),'deliberate','policy-1');
 assert.match(prose(state),/饭/);
 state=follow(state,'next-case','river-open');
 assert.match(prose(state),/碾房.*转/);
 assert.equal(state.events.river.record,'1');
});

test('a full pack still allows either river settlement and leaves excess gifts at the site',()=>{
 const s=follow(open(),'deliberate');
 Object.assign(s.life.items,{herbs:9999,supplies:9999});
 const actions=compileChoices(s,s.currentScene.choices);
 assert.ok(actions.slice(0,2).every(row=>row.enabled));
 const saved=pick(s,'policy-0');
 assert.equal(saved.events.river.record,'0');assert.equal(saved.life.items.herbs,9999);
 assert.match(prose(saved),/行囊/);
});

for(const branch of [0,1])test('all six leaves settle once and return to the cultivation game on route '+branch,()=>{
 let state=open();
 for(let i=0;i<6;i++){
  state=follow(state,'clue-0','river-return','clue-1','river-return','deliberate','policy-'+branch,'next-case');
  assert.equal(state.events.river.record,String(branch).repeat(i+1));
  if(i<5)state=pick(state,'river-open');
 }
 assert.match(state.currentScene.title,/合卷/);
 assert.equal(state.currentScene.blocks.length,7);
 const items={...state.life.items};
 state=follow(state,'river-back','journey-menu','river-book');
 assert.match(state.currentScene.title,/合卷/);
 assert.deepEqual(state.life.items,items);
 state=follow(state,'train-menu','practice');
 assert.equal(state.events.node,'action-result');
});

function afterRiver(timberChoice=1){
 let s=open();
 for(let i=0;i<6;i++){
  s=follow(s,'deliberate','policy-'+(i===3?timberChoice:i%2),'next-case');
  if(i<5)s=pick(s,'river-open');
 }
 return pick(s,'voyage-book');
}
test('the timber agreement changes actual journey time and the route shown on the map',()=>{
 const book=afterRiver(0);
 assert.match(prose(book),/木纤道/);
 const map=follow(book,'voyage-log');
 assert.match(prose(map),/窑脚 → 桐油仓 1刻/);
 const destination=follow(map,'voyage-go','to-kiln','to-store');
 assert.equal(destination.events.expedition.watch,3);
 assert.equal(follow(afterRiver(),'voyage-go','to-kiln','to-store').events.expedition.watch,4);
});
test('three expeditions allow a complete rescue route, an optional detour and a verifiable ending',()=>{
 let s=follow(afterRiver(),'voyage-go','to-weir','to-hut','to-weir','to-kiln','to-store','to-tower');
 assert.equal(s.events.expedition.watch,8);assert.equal(s.events.expedition.goods,7);
 s=follow(s,'voyage-on','voyage-camp','voyage-go','voyage-finish');
 assert.equal(s.lastReceipt.elapsedDays,8);assert.match(prose(s),/抄潮人/);
 s=follow(s,'voyage-book','voyage-go','to-east','to-shelf','to-west','to-peak','voyage-finish');
 assert.match(prose(s),/私册/);
 s=follow(s,'voyage-book','voyage-go','to-well','to-sledge','to-pass','to-post','to-camp','voyage-finish','voyage-book');
 assert.match(s.currentScene.title,/三程归来/);
 assert.equal(s.events.expedition.results,'111');
 s=pick(s,'hear-council');assert.match(prose(s),/炼气/);
 s=pick(s,'train-menu');assert.equal(s.events.node,'training');
});

test('wrong tide and missed deadline are recoverable without consuming real life supplies',()=>{
 let s=follow(afterRiver(),'voyage-go','to-weir','voyage-camp','voyage-wait');
 assert.equal(s.events.expedition.watch,2);assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:to-hut')));
 const items={...s.life.items},age=s.life.ageDays;
 for(let i=2;i<9;i++)s=follow(s,'voyage-camp','voyage-wait');
 s=follow(s,'voyage-log','river-back','journey-menu','river-book','voyage-book');
 s=deserializeLiveState(serializeLiveState(s));
 assert.equal(s.events.expedition.watch,9);
 s=follow(s,'voyage-log','voyage-reset','voyage-restart','to-kiln','to-store','to-tower');
 assert.equal(s.life.ageDays,age);assert.deepEqual(s.life.items,items);
 s=pick(s,'voyage-finish');assert.equal(s.events.expedition.results,'0');
 assert.doesNotMatch(prose(s),/二十年的潮纸/);
});

function trainTo(state,rank){
 let s=state;
 for(let i=0;realmFor(s.life).rank<rank;i++){
  assert.ok(i<100,'training route is stuck');
  const realm=nextRealmFor(s.life);
  if(s.life.injury>1||s.life.cultivationProfile.spirit<30+rank*5){
   s=follow(s,'rest-menu','recover','train-menu');
  }else if(s.life.cultivation<realm.threshold){
   s=follow(s,'practice','train-menu');
  }else if(!s.life.items[realm.material]){
   s=follow(s,'rest-menu','back','journey-menu','resources-menu');
   if(rank>1&&!s.life.items.supplies)s=pick(s,'next-resource');
   s=follow(s,'gather','train-menu');
  }else s=follow(s,'breakthrough','train-menu');
 }
 return follow(s,'rest-menu','back','journey-menu','river-book','hear-council');
}
test('one continuous birth reaches three actual realms and leaves nine binding resolutions in the valley',t=>{
 let s=follow(afterRiver(),'voyage-go','to-kiln','to-store','to-tower','voyage-finish','voyage-book','voyage-go','to-east','to-west','to-peak','voyage-finish','voyage-book','voyage-go','to-pass','to-well','to-camp','voyage-finish','voyage-book','hear-council');
 for(let rank=1;rank<=3;rank++){
  assert.match(s.currentScene.title,/待你归来/);
  s=trainTo(pick(s,'train-menu'),rank);
  for(let i=0;i<3;i++){
   const before=s.life.cultivation,spirit=s.life.cultivationProfile.spirit;
   s=pick(s,'resolve-0');assert.equal(s.life.cultivation,before+1);assert.equal(s.life.cultivationProfile.spirit,spirit-rank);
   if(rank===1&&i===1)assert.equal(s.lastReceipt.elapsedDays,7);
   if(rank===2&&i===0)assert.equal(s.lastReceipt.elapsedDays,15);
   s=pick(s,'hear-council');
  }
 }
 assert.match(s.currentScene.title,/山河有继/);
 assert.equal(s.events.council,'000000000');assert.equal(s.life.realm,'golden');assert.equal(s.phase,'active');
 t.diagnostic('Continuous route to the valley ending: '+s.turnId+' committed turns including menus; '+s.life.ageDays+' in-world age days.');
 const inventory={...s.life.items};
 s=follow(s,'river-back','journey-menu','river-book','voyage-book');assert.match(s.currentScene.title,/三程归来/);
 s=pick(s,'hear-council');assert.match(s.currentScene.title,/山河有继/);assert.deepEqual(s.life.items,inventory);
});
