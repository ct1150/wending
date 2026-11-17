import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene,compileChoices} from '../src/game/cultivation/live/engine.js';
import {realmFor,nextRealmFor,v7ActionRule} from '../src/game/cultivation/live/cultivation-rules.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {validateConvoy} from '../src/game/cultivation/live/sea-convoy.js';
import {validateValley} from '../src/game/cultivation/live/mist-valley.js';
import {eventNode} from '../src/game/cultivation/live/event-content.js';
import {validateWatch} from '../src/game/cultivation/live/retreat-watch.js';

const observers=new WeakMap();
function start(observe,seed=42){
 const state=createLiveGame({runId:'river-reader',seed,name:'沈渡',engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1});
 const pending=prepareOpening(state,{requestId:'opening'});
 const ready=commitTurn(state,pending,resolveRuleScene(state,pending));
 if(observe)observers.set(ready,observe);
 return ready;
}
function pick(state,key){
 const choice=state.currentScene.choices.find(row=>row.id.endsWith(':c:'+key));
 assert.ok(choice,'missing '+key+' in '+state.currentScene.title);
 const pending=prepareChoice(state,{choiceId:choice.id,requestId:'river-'+(state.turnId+1)});
 const next=commitTurn(state,pending,resolveRuleScene(state,pending)),observe=observers.get(state);
 if(observe){observe(key,next);observers.set(next,observe);}
 return next;
}
const follow=(state,...keys)=>keys.reduce(pick,state);
const open=observe=>follow(start(observe),'decline','journey-menu','river-book','river-open');
const prose=state=>state.currentScene.blocks.map(block=>block.text).join('\n');

const valleyCamp=()=>follow(open(),'deliberate','policy-0','field-guide','enter-field');
const firstWatch=(seed,keeper,marks)=>follow(start(undefined,seed),'decline','train-menu','rest-menu','watch-book','watch-open','keeper-'+keeper,marks,'sit-watch');
test('a missed practice check preserves the time and injury, and a single signature really authorizes early action',()=>{
 const missed=firstWatch(36,0,'one-mark');
 assert.equal(missed.lastReceipt.cultivationResult.check.success,false);
 assert.equal(missed.life.injury,1);assert.equal(missed.events.watch.draft.success,false);
 assert.match(prose(missed),/检定未成/);assert.match(prose(missed),/饭舍开了背风窗/);
 const confirmed=firstWatch(42,1,'two-marks');
 assert.match(prose(confirmed),/两道凭据都已齐全/);assert.match(prose(confirmed),/把锅移离烟道/);
});
test('public and sealed handoffs give different keepers an independent source for the next retreat',()=>{
 const s=start();s.life.realm='qi';
 const first={keeper:0,marks:1,days:360,success:true,shared:true};
 for(const shared of [true,false]){
  for(const keeper of [0,1]){
   const draft={keeper,marks:2,days:360,success:true};
   s.events={...s.events,node:'watch-report',watch:{record:[{...first,shared}],draft}};
   validateWatch(s.events.watch);
   const scene=eventNode(s),confirmed=scene.blocks.some(b=>b.text.includes('两道凭据都已齐全'));
   assert.equal(confirmed,shared?keeper===1:keeper===0);
  }
 }
 assert.throws(()=>validateWatch({record:[{...first,days:null}],draft:null}),/回执/);
 assert.throws(()=>validateWatch({record:[first],draft:null,trail:{start:5,world:0,place:'ford',traces:0,outcome:'herd',reply:null}}),/栗溪/);
});
test('Tao He leaves on schedule, and both a timely handoff and a missed meeting survive reload',()=>{
 const base=follow(firstWatch(42,1,'one-mark'),'leave-copy','deer-trail','walk-with-he');
 let s=follow(base,'to-reeds','read-trace','to-ford','shelter-deer');
 assert.equal(s.events.watch.trail.outcome,'meadow');assert.equal(s.life.ageDays-base.life.ageDays,5);
 s=deserializeLiveState(serializeLiveState(s));assert.match(prose(s),/背风坡/);
 s=follow(base,'to-ridge','trail-fork','cross-slope','trail-fork','cross-slope','trail-fork','cross-slope','trail-fork','cross-slope','trail-fork','cross-slope');
 assert.equal(s.life.ageDays-base.life.ageDays,6);assert.match(prose(s),/六日已经过去/);
 s=pick(s,'accept-late');assert.equal(deserializeLiveState(serializeLiveState(s)).events.watch.trail.outcome,'late');
});
test('a guarded retreat spends the ordinary practice cost and settles the keeper instructions only once',()=>{
 const ready=follow(start(),'decline','train-menu');
 const normal=pick(ready,'practice');
 let s=follow(ready,'rest-menu','watch-book','watch-open','keeper-0','two-marks','sit-watch');
 assert.deepEqual(s.life,normal.life);assert.deepEqual(s.lastReceipt.random,normal.lastReceipt.random);
 assert.equal(s.events.watch.draft.days,normal.lastReceipt.elapsedDays);
 s=deserializeLiveState(serializeLiveState(s));
 assert.match(prose(s),/两道/);
 s=follow(s,'watch-later','rest-menu','watch-book','watch-open','leave-copy','watch-book');
 assert.equal(s.events.watch.record.length,1);assert.equal(s.events.watch.draft,null);
 assert.match(prose(s),/炼气/);assert.equal(s.life.ageDays,normal.life.ageDays);
});
test('each of the eight handoff histories changes the actual upper-world instruments and their working proposals',()=>{
 const state=start();state.life.cultivationProfile.worldTier=2;
 const chapters=[{rig:'light',loads:[5,10]}];
 for(let mask=0;mask<8;mask++){
  const letters=Array.from({length:3},(_,i)=>mask&(1<<i)?'C':'O').join('');
  for(let i=0;i<3;i++){
   const decisions=letters+'O'.repeat(i);
   state.events={...state.events,node:'convoy-ear-table',convoy:{chapters,draft:0,resonance:{decisions,seen:0,trial:'none'}}};
   const controls=eventNode(state).choices.slice(0,2),useRight=letters[i]==='C'?(i===1):(i!==1);
   assert.equal(controls[Number(useRight)].next,'convoy-ear-good');
   assert.equal(controls[1-Number(useRight)].next,'convoy-ear-miss');
   assert.equal(controls[Number(useRight)].rule.days,1);
   assert.match(controls[Number(useRight)].patch.convoy.resonance.trial,/proved/);
   state.life.cultivationProfile.worldTier=1;
   assert.equal(eventNode(state).choices.some(c=>c.key.startsWith('try-')),false);
   state.life.cultivationProfile.worldTier=2;
  }
 }
 const score={decisions:'CCOCOO',seen:0,trial:'none'};
 assert.throws(()=>validateConvoy({chapters,draft:0,resonance:{...score,decisions:'CCO',concert:{venue:'harbor',visits:0,performed:false}}}),/尚未校完/);
 assert.throws(()=>validateConvoy({chapters,draft:0,resonance:{...score,concert:{venue:'window',visits:7,performed:true}}}),/合奏/);
 for(const venue of ['harbor','window']){
  for(let visits=0;visits<7;visits++){
   state.events={...state.events,node:'convoy-concert-check',convoy:{chapters,draft:0,resonance:{...score,concert:{venue,visits,performed:false}}}};
   const perform=eventNode(state).choices.find(c=>c.key==='perform');
   state.events={...state.events,...perform.patch,node:perform.next};
   validateConvoy(state.events.convoy);
   const result=eventNode(state);assert.match(result.title,venue==='harbor'?/桥/:/窗/);assert.ok(!result.choices.some(c=>c.key==='perform'));
  }
 }
});
test('a life already above an unfinished port must commission local hands through the mirror',()=>{
 for(const tier of [1,2]){
  const state=start();state.life.cultivationProfile.worldTier=tier;
  const completed={rig:'light',loads:[5,10]};
  for(let portIndex=0;portIndex<tier;portIndex++){
   state.events={...state.events,node:'convoy-book',location:tier===1?'middle':'upper',convoy:{chapters:Array.from({length:portIndex},()=>completed),draft:0}};
   let choices=eventNode(state).choices;
   assert.deepEqual(choices.map(c=>c.key),['commission','river-back']);
   state.events.node=choices[0].next;
   choices=eventNode(state).choices;
   const barge=choices.find(c=>c.key==='rig-barge');
   assert.match(barge.label,/委托/);assert.equal(barge.rule.days,4);
   assert.equal(barge.rule.items.iron??0,portIndex===0?1:0);
   state.events={...state.events,...barge.patch,node:'convoy-book'};
   assert.equal(eventNode(state).choices[0].key,'commission');
   state.events.node='convoy-remote';
   assert.equal(eventNode(state).choices[0].key,'crew');
   state.events.node='convoy-check';state.events.convoy.draft=1;
   const sail=eventNode(state).choices.find(c=>c.key==='sail');
   assert.match(sail.label,/委托/);assert.deepEqual(sail.patch.convoy.chapters.at(-1).loads,[1]);
   assert.equal(sail.arrival,undefined);
  }
 }
});
test('manifest validation permits a voluntary empty return and rejects impossible shipments or commission receipts',()=>{
 const manifest=(loads,draft=0)=>({chapters:[{rig:'light',loads}],draft});
 assert.doesNotThrow(()=>validateConvoy(manifest([2,0])));
 assert.throws(()=>validateConvoy(manifest([0])),/落印/);
 assert.throws(()=>validateConvoy(manifest([3])),/落印/);
 assert.throws(()=>validateConvoy(manifest([1,1])),/落印/);
 assert.throws(()=>validateConvoy(manifest([2],5)),/候船/);
 assert.throws(()=>validateConvoy({...manifest([1,0]),benches:[{pattern:'RRLL',paid:true},null]}),/未校成/);
 assert.throws(()=>validateValley({sample:false,remedy:true,slag:false,sleeve:false,pass:'medicine',settled:'kiln'}),/游记/);
});
for(const path of ['medicine','forge'])test('mist valley '+path+' route carries real work and one settlement across a reload',()=>{
 let state=valleyCamp();
 assert.equal(state.currentScene.location,'谷口茶棚');
 state=path==='medicine'?follow(state,'to-bank','take-sample','to-grove','brew-filter'):follow(state,'to-kiln','measure-kiln','fit-sleeve');
 assert.equal(state.lastReceipt.elapsedDays,path==='medicine'?3:4);
 assert.ok(!state.currentScene.choices.some(row=>/:(brew-filter|fit-sleeve)$/.test(row.id)));
 state=follow(state,'to-shrine','show-proof','proof-'+path,'to-source');
 state=deserializeLiveState(serializeLiveState(state));
 assert.equal(state.events.valley.pass,path);
 state=follow(state,'compare-banks',path==='medicine'?'water-clinic':'water-kiln');
 assert.equal(state.events.valley.settled,path==='medicine'?'infirmary':'kiln');
 const items={...state.life.items};
 state=follow(state,'field-home','journey-menu','resources-menu','field-guide');
 assert.match(state.currentScene.title,/合卷/);
 assert.deepEqual(state.life.items,items);
});
test('mist valley spar uses the actual rank and outcome, with a route home after the match',()=>{
 let state=follow(valleyCamp(),'to-kiln','to-shrine');
 const foe=state.relatedEntities.find(row=>row.name==='守泉会');
 assert.equal(foe.experience.realmId,'qi');
 const stones=state.life.items.stones??0;
 const wounded=structuredClone(state);wounded.life.injury=9;
 assert.match(v7ActionRule(wounded,wounded.currentScene.choices.find(c=>c.intent==='fight')).reason??'',/伤/);
 state=pick(state,'hold-bell');
 assert.equal(state.lastReceipt.elapsedDays,1);
 assert.equal(state.life.relations[foe.id]??0,0);
 assert.equal(state.life.items.stones??0,stones);
 assert.ok(!state.director.memory.enemies.some(enemy=>enemy.id===foe.id));
 const won=state.lastReceipt.cultivationResult.check.success;
 assert.equal(state.events.valley?.pass??null,won?'spar':null);
 state=won?follow(state,'to-source','water-spring','field-home'):pick(state,'field-home');
 assert.equal(state.events.node,'hub');
});

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

function afterRiver(timberChoice=1,observe,visitValley=false){
 let s=open(observe);
 for(let i=0;i<6;i++){
  s=follow(s,'deliberate','policy-'+(i===3?timberChoice:i%2));
  if(i===0&&visitValley){
   s=follow(s,'field-guide','enter-field','to-bank','take-sample','to-grove','brew-filter','to-shrine','show-proof','proof-medicine','to-source','compare-banks','water-clinic','field-home','journey-menu','river-book');
  }else s=pick(s,'next-case');
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

function guardedPractice(s){
 const i=s.events.watch?.record.length??0;
 s=follow(s,'rest-menu','watch-book','watch-open','keeper-'+(i%2),i%3?'two-marks':'one-mark','sit-watch');
 assert.equal(s.events.watch.draft.days,s.lastReceipt.elapsedDays);
 s=pick(s,i%2?'seal-original':'leave-copy');
 if(i===0){
  s=follow(s,'deer-trail','walk-with-he','to-ridge','read-trace','cross-slope','read-trace','to-ford','follow-herd');
  assert.equal(s.events.watch.trail.outcome,'herd');assert.equal(s.life.ageDays-s.events.watch.trail.start,6);
 }
 s=pick(s,'watch-later');
 assert.equal(s.events.watch.record.length,i+1);
 return s;
}
function trainTo(state,rank){
 let s=state;
 for(let i=0;realmFor(s.life).rank<rank;i++){
  assert.ok(i<100,'training route is stuck');
  const realm=nextRealmFor(s.life);
  if(s.life.injury>1||s.life.cultivationProfile.spirit<30+rank*5){
   s=follow(s,'rest-menu','recover','train-menu');
  }else if(s.life.cultivation<realm.threshold){
   if((s.events.watch?.record.length??0)<=realmFor(s.life).rank){
    s=guardedPractice(s);continue;
   }
   s=pick(s,'practice');
   while(s.life.cultivation<realm.threshold&&s.life.injury<=1&&s.life.cultivationProfile.spirit>=30+rank*5){
    s=pick(s,'practice-again');
   }
   s=pick(s,'train-menu');
  }else if(!s.life.items[realm.material]){
   s=follow(s,'rest-menu','back','journey-menu','resources-menu');
   if(rank>1&&!s.life.items.supplies)s=pick(s,'next-resource');
   s=follow(s,'gather','train-menu');
  }else{
   s=pick(s,'breakthrough');
   if(realmFor(s.life).rank===rank)return pick(s,'resume-ledger');
   s=pick(s,'train-menu');
  }
 }
 return follow(s,'rest-menu','back','journey-menu','river-book','hear-council');
}
test('one continuous birth finishes the three-world campaign and replays its entire archive',async t=>{
 const route=[],blocks=new Set();
 const observe=(key,state)=>{route.push(key);for(const b of state.currentScene.blocks)blocks.add(b.text);};
 let s=follow(afterRiver(1,observe,true),'voyage-go','to-kiln','to-store','to-tower','voyage-finish','voyage-book','voyage-go','to-east','to-west','to-peak','voyage-finish','voyage-book','voyage-go','to-pass','to-well','to-camp','voyage-finish','voyage-book','hear-council');
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
 s=pick(s,'convoy-book');assert.match(prose(s),/沉钟湾/);
 s=follow(s,'rig-light','crew','load-0','manifest','stores','load-2','manifest');
 assert.equal(s.events.convoy.draft,5);
 s=deserializeLiveState(serializeLiveState(s));
 observers.set(s,observe);
 s=follow(s,'weigh','sail');assert.deepEqual(s.events.convoy.chapters[0].loads,[5]);
 assert.equal(s.lastReceipt.elapsedDays,3);assert.match(prose(s),/桩/);
 s=follow(s,'convoy-book','crew','load-1','manifest','stores','load-3','manifest','weigh','sail','convoy-book');
 assert.deepEqual(s.events.convoy.chapters[0].loads,[5,10]);assert.equal(s.events.convoy.draft,0);
 assert.equal(s.life.cultivationProfile.worldTier,0);assert.match(prose(s),/中界/);
 const priorStones=s.life.items.stones??0,priorArrays=s.life.items.array??0;
 s=follow(s,'work-board','pin-R','pin-L','pin-L','pin-R','test-pins');
 assert.match(s.currentScene.title,/未合/);assert.equal(s.life.items.stones??0,priorStones);
 s=follow(s,'reset-pins','pin-L','pin-R','pin-L','pin-R','test-pins');
 assert.equal(s.life.items.stones,priorStones+45);assert.equal(s.life.items.array,priorArrays+1);assert.ok(s.events.convoy.benches[0].paid);
 s=follow(s,'cross-menu','sea-array');
 assert.equal(s.life.cultivationProfile.worldTier,1);assert.equal(s.life.items.array,priorArrays);
 s=pick(s,'ear-book');
 for(const [i,key] of ['right','left','right'].entries()){
  s=follow(s,'ear-open','ear-read','ear-object','ear-letter','ear-table');
  if(i===0){
   assert.match(prose(s),/米粒/);assert.match(prose(s),/拣豆子/);
   s=pick(s,'try-left');assert.match(s.currentScene.title,/走音/);assert.equal(s.lastReceipt.elapsedDays,1);
   assert.equal(s.events.convoy.resonance.decisions,'');s=pick(s,'ear-table');
  }
  s=pick(s,'try-'+key);assert.match(s.currentScene.title,/合声/);
  s=pick(s,i===1?'keep-original':'make-copy');assert.equal(s.events.convoy.resonance.decisions.length,i+1);
  s=pick(s,'ear-book');
 }
 assert.match(s.currentScene.title,/等候上界/);s=pick(s,'convoy-book');
 s=follow(s,'rig-barge','crew','load-0','manifest','weigh','sail','convoy-book','stores','load-2','load-3','manifest','crew','load-1','manifest','weigh','sail','convoy-book');
 assert.deepEqual(s.events.convoy.chapters[1].loads,[1,14]);
 s=follow(s,'work-board','pin-R','pin-L','pin-R','pin-L','test-pins','cross-menu');
 assert.ok(!compileChoices(s,s.currentScene.choices).find(c=>c.approach==='ancient-array').enabled);
 s=trainTo(follow(s,'river-back','train-menu'),4);
 s=follow(s,'cross-menu','sea-array');
 assert.equal(s.life.cultivationProfile.worldTier,2);
 s=pick(s,'ear-book');
 for(const [i,key] of ['left','left','left'].entries()){
  s=follow(s,'ear-open','ear-read','ear-letter','ear-object','ear-table','try-'+key);
  assert.match(s.currentScene.title,/合声/);
  s=follow(s,i===1?'make-copy':'keep-original','ear-book');
 }
 assert.equal(s.events.convoy.resonance.decisions,'COCOCO');
 assert.match(prose(s),/钟荻/);
 s=follow(s,'plan-concert','play-window','visit-groups','visit-0','visit-groups','visit-2');
 assert.equal(s.events.convoy.resonance.concert.visits,5);
 s=follow(s,'check-concert','perform');
 assert.match(s.currentScene.title,/一扇窗/);assert.match(prose(s),/陶管/);
 const arts={...s.life.cultivationProfile.arts};
 s=follow(s,'ear-book','read-concert');assert.deepEqual(s.life.cultivationProfile.arts,arts);
 s=pick(s,'convoy-book');
 s=follow(s,'rig-light','crew','load-1','manifest','stores','load-3','manifest','weigh','sail','convoy-book','crew','load-0','manifest','stores','load-2','manifest','weigh','sail','convoy-book');
 assert.deepEqual(s.events.convoy.chapters[2].loads,[10,5]);assert.match(s.currentScene.title,/问川归航/);
 for(let rank=5;rank<=8;rank++)s=trainTo(pick(s,'train-menu'),rank);
 s=pick(s,'train-menu');
 while(s.events.watch.record.length<9)s=guardedPractice(s);
 s=follow(s,'rest-menu','watch-book');
 assert.match(s.currentScene.title,/守关簿合卷/);
 assert.equal(s.life.realm,'mahayana');assert.equal(s.currentScene.blocks.length,10);
 s=follow(s,'watch-visitors','deer-trail');
 assert.match(prose(s),/多年以前寄存的旧信/);
 s=follow(s,'answer-letter','watch-later','rest-menu','back','journey-menu','river-book','hear-council','convoy-book');
 assert.match(s.currentScene.title,/问川归航/);
 t.diagnostic('Three-world campaign ending at turn '+s.turnId+'; world tier '+s.life.cultivationProfile.worldTier);
 const {liveBrowser}=await import('./helpers/live-browser.js'),{page}=await liveBrowser(t);
 const browser=await page.evaluate(async keys=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),format=await import('/src/game/live-save-format.js');
  const archive=await open('convoy-source'),target=await open('convoy-restored');
  const session=createLiveSession({archive,client:{}});
  let row=await session.startNew({runId:'river-reader',seed:42,name:'沈渡',engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  for(const key of keys){
   const action=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   if(!action)throw Error('browser missing '+key+' at '+row.state.turnId);
   row=await session.choose({choiceId:action.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});
   if(row.errorCode)throw Error(row.errorCode);
  }
  await format.importLiveArchive(format.exportLiveArchive(archive),target);
  const restored=await target.load();
  return {events:restored.state.events,turn:restored.state.turnId,life:restored.state.life,title:restored.state.currentScene.title,exact:identity.stateHash(restored.state)===identity.stateHash(row.state)};
 },route);
 assert.equal(browser.exact,true);assert.deepEqual(browser.events,s.events);assert.deepEqual(browser.life,s.life);
 assert.equal(browser.turn,s.turnId);assert.equal(browser.title,s.currentScene.title);
 t.diagnostic('Route inventory: '+blocks.size+' distinct displayed blocks, '+[...blocks].reduce((n,b)=>n+[...b].length,0)+' characters (includes menu and status text).');
 s=pick(s,'train-menu');assert.equal(s.phase,'active');
});
