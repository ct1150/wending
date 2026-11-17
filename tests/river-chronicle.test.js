import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene,compileChoices} from '../src/game/cultivation/live/engine.js';
import {realmFor,nextRealmFor,v7ActionRule} from '../src/game/cultivation/live/cultivation-rules.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {validateConvoy} from '../src/game/cultivation/live/sea-convoy.js';
import {validateValley} from '../src/game/cultivation/live/mist-valley.js';
import {eventNode} from '../src/game/cultivation/live/event-content.js';
import {validateWatch} from '../src/game/cultivation/live/retreat-watch.js';
import {validateDing,validateInscription} from '../src/game/cultivation/live/mountain-ding.js';
import {validateMine} from '../src/game/cultivation/live/lamp-mine.js';
import {DAYS_PER_YEAR} from '../src/game/cultivation/live/model.js';
import {validateGarden,gardenRootForChild} from '../src/game/cultivation/live/phenology.js';

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
const firstPlot=(seed=42)=>follow(start(undefined,seed),'decline','train-menu','garden-book','sow');
test('the same seed crop ripens during the actual native retreat, while shorter intensive practice returns at the tender harvest',()=>{
 const split=firstPlot(),opening=split.life.ageDays,practice=pick(split,'practice-bed');
 const choices=compileChoices(practice,practice.currentScene.choices);
 const steady=pick(practice,'garden-steady');
 assert.equal(steady.life.ageDays-opening,choices.find(c=>c.approach==='steady').costs.days);
 assert.equal(steady.lastReceipt.action.approach,'steady');
 const mature=follow(steady,'inspect-bed','ripe','pick-root');
 assert.equal(mature.events.garden.record[0].take,'root');
 assert.equal(mature.events.garden.plot,null);
 const supplies=split.life.items.supplies;
 let quick=pick(practice,'garden-intensive');
 assert.equal(quick.life.items.supplies,supplies-1);
 assert.equal(quick.life.ageDays-opening,choices.find(c=>c.approach==='intensive').costs.days);
 quick=deserializeLiveState(serializeLiveState(quick));
 const tender=follow(quick,'inspect-bed','pick-tips');
 assert.equal(tender.life.items.supplies,supplies);
 assert.equal(tender.events.garden.record[0].take,'tips');
 assert.ok(!tender.currentScene.choices.some(c=>c.id.endsWith(':c:sow')));
});
test('tending advances the actual calendar without cultivating; missed crops cannot grant a harvest',()=>{
 let s=firstPlot(),cultivation=s.life.cultivation;
 s=follow(s,'inspect-bed','tend');assert.equal(s.life.cultivation,cultivation);
 assert.equal(s.life.ageDays-s.events.garden.plot.sown,DAYS_PER_YEAR/2);
 s=follow(s,'practice-bed','garden-steady','inspect-bed');
 assert.match(prose(s),/种实已散/);
 const items={...s.life.items};
 s=follow(s,'pick-scatter','garden-history');assert.deepEqual(s.life.items,items);
 assert.equal(s.events.garden.record[0].take,'scatter');
});
test('a saved pre-garden training page still compiles its disabled breakthrough and can continue normally',()=>{
 const s=follow(start(),'decline','train-menu'),next=nextRealmFor(s.life);
 const old=s.currentScene.choices[1];
 Object.assign(old,{id:old.id.replace(/garden-book$/,'breakthrough'),label:'闭关尝试突破'+next.name,intent:'practice',targetId:next.id,approach:'breakthrough'});
 const restored=deserializeLiveState(serializeLiveState(s));
 const actions=compileChoices(restored,restored.currentScene.choices);
 assert.equal(actions.find(c=>c.approach==='breakthrough').enabled,false);
 assert.equal(pick(restored,'practice').lastReceipt.action.approach,'steady');
});
test('late tender harvests require an unused mother root, and an active crop consumes the parcel',()=>{
 const record=[{bed:0,sown:10,day:10+DAYS_PER_YEAR,take:'tips'}];
 assert.throws(()=>validateGarden({record,plot:null}),/采期/);
 validateGarden({record,plot:null},undefined,0);
 assert.equal(gardenRootForChild({reincarnation:{gardenRoot:0}}),0);
 assert.equal(gardenRootForChild({reincarnation:{gardenRoot:0},events:{garden:{record:[],plot:{bed:0,sown:10}}}}),undefined);
 assert.equal(gardenRootForChild({reincarnation:{gardenRoot:0},events:{garden:{record,plot:null}}}),undefined);
});

const mineStart=()=>follow(valleyCamp(),'to-bank','take-sample','to-grove','brew-filter','to-shrine','show-proof','proof-medicine','to-source','water-spring','field-home','journey-menu','resources-menu','field-guide','mine-book','borrow-lamp');
test('mine rescue clues follow the changed waterway, consume oil once and persist before deciding',()=>{
 for(const drain of [0,1]){
  let s=mineStart();
  for(let i=0;i<3;i++){
   s=follow(s,'inspect','inspect-0');
   const age=s.life.ageDays,oil=s.events.mine.lamp;
   s=pick(s,'inspect-0');
   assert.equal(s.life.ageDays,age);assert.equal(s.events.mine.lamp,oil);
   s=deserializeLiveState(serializeLiveState(s));
   const move=i===0?drain:i===1?(drain===0?0:1):0;
   if(i===1)assert.match(prose(s),drain===0?/刚剥落/:/一层细细的灰/);
   s=follow(s,'gallery','decide','move-'+move);
   assert.equal(s.lastReceipt.elapsedDays,1);
   if(i<2)s=follow(s,'mine-book','enter-gallery');
  }
  s=follow(s,'mine-book','teach-log');
  assert.equal(s.events.mine.pledge,'巡教');assert.equal(s.lastReceipt.elapsedDays,3);
  assert.ok(s.currentScene.choices.every(c=>!c.id.endsWith(':c:teach-log')));
  const age=s.life.ageDays;
  s=follow(s,'mine-journal','turn-page');
  assert.equal(s.life.ageDays,age);assert.match(prose(s),drain===0?/刚剥落/:/一层细细的灰/);
  assert.doesNotMatch(prose(s),/刚踩扁的枣核|篓耳勒出/);
 }
});
test('retreating with an empty lamp leaves a playable way back and buying oil charges actual supplies',()=>{
 let s=follow(mineStart(),'inspect','inspect-0','inspect-1','gallery','decide','move-1','mine-book','enter-gallery','inspect','inspect-1','gallery','decide','move-1','mine-book','enter-gallery','inspect');
 assert.equal(s.events.mine.lamp,0);
 const stock=s.life.items.supplies??0;
 s=pick(s,'withdraw');
 assert.equal(s.lastReceipt.elapsedDays,1);
 const buy=compileChoices(s,s.currentScene.choices).find(c=>c.id.endsWith(':c:buy-oil'));
 assert.equal(buy.enabled,stock>=1);assert.equal(buy.costs.items.supplies,1);
 if(stock>=1){
  s=pick(s,'buy-oil');assert.equal(s.life.items.supplies,stock-1);assert.equal(s.events.mine.lamp,2);
 }
 s=follow(s,'enter-gallery','decide','move-0');
 assert.equal(s.events.mine.record[2].seen,0);
});
test('a premature mine decision changes the next rescue and a wrong response takes two extra days',()=>{
 let s=mineStart();
 s=follow(s,'decide','move-0','mine-book','enter-gallery','decide','move-1','mine-book','enter-gallery','inspect','inspect-1');
 assert.match(prose(s),/两个人的重量/);
 s=follow(s,'gallery','decide','move-0');
 assert.equal(s.lastReceipt.elapsedDays,3);assert.match(prose(s),/再歇两日/);
 assert.throws(()=>validateMine({...s.events.mine,lamp:6}),/灯簿/);
 assert.throws(()=>validateMine({...s.events.mine,record:[],pledge:'留井'}),/灯簿/);
});
test('leaving the mine to cultivate lets the other crew take over; the first report remains readable',()=>{
 let s=follow(mineStart(),'inspect','inspect-1','gallery','decide','move-1','field-guide','train-menu','practice','continue','journey-menu','resources-menu','field-guide','mine-book');
 assert.match(s.currentScene.title,/交班/);assert.equal(s.events.mine.record.length,1);
 s=follow(s,'mine-journal','mine-book');assert.match(s.currentScene.title,/交班/);
 assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:enter-gallery')));
});
test('an ordinary workshop brew opens the dispensary, consumes its actual ingredients and extends life only on drinking',()=>{
 let s=follow(start(),'decline');
 for(let n=0;(s.life.items.herbs??0)<8||(s.life.items.stones??0)<12;n++){
  assert.ok(n<45);
  const target=(s.life.items.herbs??0)<8?'herbs':'stones';
  s=follow(s,'journey-menu','resources-menu');
  for(let pages=0;s.currentScene.choices[0].targetId!==target;pages++){
   assert.ok(pages<5);s=pick(s,'next-resource');
  }
  s=follow(s,'gather','continue');
 }
 s=follow(s,'journey-menu','workshop-menu','next-recipe','next-recipe','next-recipe','next-recipe');
 const herbs=s.life.items.herbs,stones=s.life.items.stones,limit=s.life.lifeLimit;
 s=pick(s,'craft');
 assert.equal(s.events.node,'apothecary');assert.equal(s.life.items.herbs,herbs-8);assert.equal(s.life.items.stones,stones-12);
 for(let n=0;!s.life.items.elixir;n++){
  assert.ok(n<90);
  s=pick(s,s.life.injury>1||s.life.cultivationProfile.spirit<15?'recover':(s.life.items.herbs??0)<8||(s.life.items.stones??0)<12?'gather-ingredient':'brew-elixir');
 }
 s=deserializeLiveState(serializeLiveState(s));
 assert.equal(s.life.lifeLimit,limit);
 s=pick(s,'take-elixir');assert.equal(s.life.items.elixir,0);assert.equal(s.life.lifeLimit,limit+5);
 assert.match(prose(s),/实增寿限5年/);
});
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
 assert.throws(()=>validateDing({form:'hall',feet:[0,1,6]}),/问鼎/);
 assert.throws(()=>validateInscription({form:'hall',pieces:[{foot:0,shared:true},{foot:3,shared:false,keeper:1},{foot:6,shared:true}]}));
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
   s=follow(s,'field-guide','enter-field','to-bank','take-sample','to-grove','brew-filter','to-shrine','show-proof','proof-medicine','to-source','compare-banks','water-clinic','field-home','journey-menu','resources-menu','field-guide','mine-book','borrow-lamp');
   for(const move of [0,0,0]){
    s=follow(s,'inspect','inspect-0','gallery','decide','move-'+move,'mine-book');
    if(s.events.mine.record.length<3)s=pick(s,'enter-gallery');
   }
   s=follow(s,'leave-log','field-guide','field-back','journey-menu','river-book');
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

function gardenFromTraining(s){
 if(s.currentScene.choices.some(c=>c.id.endsWith(':c:garden-book')))return pick(s,'garden-book');
 s=follow(s,'rest-menu','back','journey-menu','resources-menu');
 for(let page=0;s.currentScene.choices[0].targetId!=='herbs';page++){
  assert.ok(page<5);s=pick(s,'next-resource');
 }
 if(!s.events.garden)s=pick(s,'gather');
 return pick(s,'garden-book');
}
function crossWithArray(s,tier){
 s=follow(s,'cross-menu','sea-array');
 for(let n=0;s.life.cultivationProfile.worldTier<tier;n++){
  assert.ok(n<100,'could not fund the next crossing');
  s=pick(s,'river-back');
  const fare=tier===2?90:45,hasArray=(s.life.items.array??0)>0;
  if(s.life.injury>1||s.life.cultivationProfile.spirit<30){
   s=follow(s,'train-menu','rest-menu','recover','train-menu','rest-menu','back');
  }else if((s.life.items.stones??0)<fare+(hasArray?0:6)||!hasArray&&(s.life.items.iron??0)<2){
   const target=!hasArray&&(s.life.items.iron??0)<2?'iron':'stones';
   s=follow(s,'journey-menu','resources-menu');
   for(let page=0;s.currentScene.choices[0].targetId!==target;page++){
    assert.ok(page<5);s=pick(s,'next-resource');
   }
   s=follow(s,'gather','continue');
  }else if(!hasArray){
   s=follow(s,'journey-menu','workshop-menu','next-recipe','next-recipe','next-recipe','craft','continue');
  }
  s=follow(s,'journey-menu','river-book','hear-council','convoy-book','cross-menu');
  const crossing=compileChoices(s,s.currentScene.choices).find(c=>c.approach==='ancient-array');
  if(crossing.enabled)s=pick(s,'sea-array');
 }
 return s;
}
function guardedPractice(s){
 const i=s.events.watch?.record.length??0;
 s=pick(gardenFromTraining(s),'sow');
 if(i===4||i===6){
  s=pick(s,'practice-bed');
  for(let n=0;!s.life.items.supplies;n++){
   assert.ok(n<8);s=pick(s,'forage');
  }
  s=follow(s,'garden-intensive','inspect-bed','pick-tips');
 }
 s=pick(s,'train-menu');
 s=follow(s,'rest-menu','watch-book','watch-open','keeper-'+(i%2),i%3?'two-marks':'one-mark','sit-watch');
 assert.equal(s.events.watch.draft.days,s.lastReceipt.elapsedDays);
 s=pick(s,i%2?'seal-original':'leave-copy');
 if(i===0){
  s=follow(s,'deer-trail','walk-with-he','to-ridge','read-trace','cross-slope','read-trace','to-ford','follow-herd');
  assert.equal(s.events.watch.trail.outcome,'herd');assert.equal(s.life.ageDays-s.events.watch.trail.start,6);
 }
 s=pick(s,'watch-later');
 assert.equal(s.events.watch.record.length,i+1);
 if(s.events.garden.plot){
  s=pick(gardenFromTraining(s),'inspect-bed');
  if(!s.currentScene.choices.some(c=>c.id.endsWith(':c:ripe')))s=follow(s,'tend','inspect-bed');
  s=follow(s,'ripe',i%2?'pick-fruit':'pick-root','train-menu');
 }
 assert.equal(s.events.garden.record.length,i+1);
 return s;
}
function trainTo(state,rank){
 let s=state;
 for(let i=0;realmFor(s.life).rank<rank;i++){
  assert.ok(i<100,'training route is stuck');
  const realm=nextRealmFor(s.life);
  const reserve=(s.life.lifeLimit-100-realm.minYears)*DAYS_PER_YEAR;
  if(rank===9&&s.life.ageDays>=reserve){
   // Shop and brew through ordinary screens when the remaining lifespan is
   // close to the cost of one retreat. A failed brew spends both ingredients.
   s=follow(s,'rest-menu','recover');
   for(let tries=0;!s.life.items.elixir;tries++){
    assert.ok(tries<80,'could not prepare a longevity elixir');
    const stocked=(s.life.items.herbs??0)>=8&&(s.life.items.stones??0)>=12;
    s=pick(s,s.life.injury>1||s.life.cultivationProfile.spirit<15?'recover':stocked?'brew-elixir':'gather-ingredient');
   }
   const upper=s.life.lifeLimit;
   s=follow(s,'take-elixir','train-menu');assert.ok(s.life.lifeLimit>upper);
  }else if(s.life.injury>1||s.life.cultivationProfile.spirit<30+rank*5){
   s=follow(s,'rest-menu','recover','train-menu');
  }else if(s.life.cultivation<realm.threshold){
   if((s.events.watch?.record.length??0)<=realmFor(s.life).rank){
    s=guardedPractice(s);continue;
   }
   s=pick(s,'practice');
   while((rank<9||s.life.ageDays<reserve)&&s.life.cultivation<realm.threshold&&s.life.injury<=1&&s.life.cultivationProfile.spirit>=30+rank*5){
    const quick=s.events.garden&&rank>=3&&s.life.injury===0&&s.life.cultivationProfile.spirit>=50+rank*5;
    s=pick(s,quick?(s.life.items.supplies?'intensive-again':'forage-again'):'practice-again');
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
 s=crossWithArray(s,1);
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
 s=crossWithArray(s,2);
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
 s=trainTo(pick(s,'train-menu'),9);
 assert.equal(s.life.realm,'tribulation');
 s=follow(s,'train-menu','rest-menu','watch-book','ding-book','choose-feet','foot-0','foot-0','more-feet','foot-2','dedicate');
 let hall=deserializeLiveState(serializeLiveState(s));
 if(!hall.life.items.iron){
  hall=follow(hall,'ding-book','watch-book','watch-later','rest-menu','back','journey-menu','resources-menu','next-resource','next-resource','next-resource','next-resource','gather','train-menu','rest-menu','watch-book','ding-book','dedicate');
 }
 const iron=hall.life.items.iron;
 hall=pick(hall,'join-pieces');assert.match(hall.currentScene.title,/山门有器/);
 assert.equal(hall.lastReceipt.elapsedDays,9);assert.equal(hall.life.items.iron??0,iron-1);
 hall=follow(hall,'watch-book','ding-book');
 assert.ok(!hall.currentScene.choices.some(c=>c.id.endsWith(':c:join-pieces')));
 s=pick(s,'return-pieces');assert.equal(s.lastReceipt.elapsedDays,3);
 assert.match(s.currentScene.title,/鼎归九处/);
 assert.equal(s.events.watch.ding.form,'village');
 assert.deepEqual(s.events.watch.ding.feet,[0,3,8]);
 s=follow(s,'watch-later','rest-menu','back','journey-menu','river-book','hear-council','convoy-book');
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
  const exact=identity.stateHash(restored.state)===identity.stateHash(row.state);
  const {compileChoices}=await import('/src/game/cultivation/live/engine.js');
  // Keep the restored living campaign available while the source runs out its natural lifespan.
  for(let n=0;row.state.phase!=='dead'&&n<400;n++){
   const state=row.state,node=state.events.node,key=node==='training'?(compileChoices(state,state.currentScene.choices).find(c=>c.id.endsWith(':c:practice')).enabled?'practice':'rest-menu'):node==='rest'?'recover':'train-menu';
   const action=state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   row=await session.choose({choiceId:action.id,baseRevision:state.revision,stateHash:identity.stateHash(state)});
   if(row.errorCode)throw Error(row.errorCode);
  }
  if(row.state.phase!=='dead')throw Error('parent did not reach settlement');
  const child=await session.reincarnate({runId:'keeper-descendant',seed:7,name:'沈棠'},[],row.archiveId);
  if(child.errorCode)throw Error(child.errorCode);
  const childCopy=await open('keeper-child-copy');
  await format.importLiveArchive(format.exportLiveArchive(archive),childCopy);
  const reborn=(await childCopy.load()).state;
  const childSession=createLiveSession({archive:childCopy,client:{}});
  let heir=await childCopy.load();
  for(const key of ['decline','train-menu','garden-book','sow','inspect-bed','tend','inspect-bed','tend','inspect-bed','pick-tips']){
   const state=heir.state,action=state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   if(!action)throw Error('child missing '+key);
   heir=await childSession.choose({choiceId:action.id,baseRevision:state.revision,stateHash:identity.stateHash(state)});
   if(heir.errorCode)throw Error(heir.errorCode);
  }
  return {events:restored.state.events,turn:restored.state.turnId,life:restored.state.life,title:restored.state.currentScene.title,exact,
   gardenRoot:reborn.reincarnation.gardenRoot,heirRecord:heir.state.events.garden.record,
   cause:row.state.lastReceipt.death.cause,reborn:reborn.life.realm,inscription:reborn.reincarnation.inscription,childTitle:reborn.currentScene.blocks.map(b=>b.text).join(''),privateWatch:!!reborn.events.watch};
 },route);
 assert.equal(browser.exact,true);assert.deepEqual(browser.events,s.events);assert.deepEqual(browser.life,s.life);
 assert.equal(browser.turn,s.turnId);assert.equal(browser.title,s.currentScene.title);
 assert.equal(browser.reborn,'mortal');assert.equal(browser.privateWatch,false);assert.match(browser.childTitle,/无名榫/);
 assert.match(browser.childTitle,/归灰稻母土/);assert.equal(browser.gardenRoot,8);
 assert.equal(browser.heirRecord.length,1);assert.equal(browser.heirRecord[0].take,'tips');
 assert.equal(browser.heirRecord[0].day-browser.heirRecord[0].sown,DAYS_PER_YEAR);
 assert.deepEqual(browser.inscription,{form:'village',pieces:[{foot:0,shared:true},{foot:3,shared:false},{foot:8,shared:true}]});
 t.diagnostic('Native archive parent settlement: '+browser.cause+'; inherited inscription restored in mortal child.');
 t.diagnostic('Route inventory: '+blocks.size+' distinct displayed blocks, '+[...blocks].reduce((n,b)=>n+[...b].length,0)+' characters (includes menu and status text).');
 s=pick(s,'train-menu');assert.equal(s.phase,'active');
});
