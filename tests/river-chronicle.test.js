import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene,compileChoices,settleDeath} from '../src/game/cultivation/live/engine.js';
import {realmFor,nextRealmFor,v7ActionRule,resolveV7Action} from '../src/game/cultivation/live/cultivation-rules.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {validateConvoy} from '../src/game/cultivation/live/sea-convoy.js';
import {yardNode,validateYardShifts} from '../src/game/cultivation/live/departure-yard.js';
import {validateValley} from '../src/game/cultivation/live/mist-valley.js';
import {eventNode} from '../src/game/cultivation/live/event-content.js';
import {validateWatch} from '../src/game/cultivation/live/retreat-watch.js';
import {validateDing,validateInscription} from '../src/game/cultivation/live/mountain-ding.js';
import {validateMine} from '../src/game/cultivation/live/lamp-mine.js';
import {DAYS_PER_YEAR} from '../src/game/cultivation/live/model.js';
import {validateGarden,gardenRootForChild} from '../src/game/cultivation/live/phenology.js';
import {validatePost} from '../src/game/cultivation/live/lin-post.js';
import {validateMountain} from '../src/game/cultivation/live/folded-mountain.js';
import {validateFerry} from '../src/game/cultivation/live/shell-ferry.js';
import {validateWell} from '../src/game/cultivation/live/echo-well.js';
import {validateCloudPassage} from '../src/game/cultivation/live/cloud-passage.js';
import {journeyNotes,adventureLeads,noteRoutes,crossingDeadlines} from '../src/game/cultivation/live/journey-notes.js';
import {practicePlan} from '../src/game/cultivation/live/practice-plan.js';
import {canStudyForm,validateForms} from '../src/game/cultivation/live/technique-forms.js';
import {eventActionRule,advanceEvents} from '../src/game/cultivation/live/events.js';

const observers=new WeakMap();
test('port wages depend on the actual cargo and settle once, with native forge and search rules',()=>{
 const s=start(),menu=(key,label,next)=>({key,label,next}),choice=(key,label,intent,targetId,approach,extra)=>({key,label,intent,targetId,approach,stake:'low',...extra});
 const row=(title,goal,blocks,choices)=>({title,goal,blocks,choices});
 for(const tier of [0,1]){
  s.life.cultivationProfile.worldTier=tier;
  const chapters=Array.from({length:tier+1},()=>({rig:'light',loads:[5,10]}));
  s.events={...s.events,convoy:{chapters,draft:0},node:'convoy-yard-boat'};
  const options=()=>yardNode(s,menu,choice,row).choices;
  const pay=options().find(c=>c.key==='yard-pay-iron');
  assert.equal(pay.rule.days,tier?14:8);assert.deepEqual(pay.rule.gain,{stones:tier?90:45,iron:2});
  if(tier){
   s.events.convoy.shifts=[{crew:'boat',pay:'stones'},null];
   assert.equal(options()[0].rule.days,12);
  }
  Object.assign(s.events,pay.patch);s.events.node='convoy-yard-book';
  validateYardShifts(s.events.convoy);assert.ok(!options().some(c=>c.key==='yard-duty'));
  const invalid=structuredClone(s.events.convoy);invalid.shifts[tier].pay='free';
  assert.throws(()=>validateYardShifts(invalid),/工签/);
  s.events.node='convoy-yard-stores';
  for(const c of options().slice(0,2)){
   const rule=v7ActionRule(s,c);assert.equal(c.rule,undefined);assert.equal(rule.days,90);assert.equal(rule.checkKind,'exploration');
  }
  s.life.items.stones=0;s.life.items.iron=0;s.life.items.array=0;s.events.node='convoy-yard-shed';
  assert.equal(options()[0].key,'yard-stores');
  s.life.items.stones=6;s.life.items.iron=2;
  const forge=options()[0],rule=v7ActionRule(s,forge);
  assert.equal(forge.key,'yard-forge');assert.equal(forge.rule,undefined);assert.deepEqual(rule.items,{iron:2,stones:6});
  assert.equal(rule.checkKind,'craft');
 }
});
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

test('cloud passage records cannot skip an open shift or reopen its lodging before the next realm',()=>{
 const life={...start().life,realm:'nascent'};
 life.cultivationProfile={...life.cultivationProfile,worldTier:2};
 const desk={node:'sky-book',cloudPassage:[{seat:0,route:null}]};
 assert.doesNotThrow(()=>validateCloudPassage(desk,life));
 assert.throws(()=>validateCloudPassage({...desk,node:'sky-shore'},life));
 assert.throws(()=>validateCloudPassage({...desk,cloudPassage:[...desk.cloudPassage,{seat:1,route:1}]},life));
 assert.throws(()=>validateCloudPassage({node:'sky-boat',cloudPassage:[{seat:0,route:1}]},life));
 assert.throws(()=>validateCloudPassage(desk,{...life,cultivationProfile:{...life.cultivationProfile,worldTier:1}}));
});

function postOffer(meeting,observe){
 return follow(start(observe),'ask','companion',meeting,'continue','decline','affairs-menu','companion-menu','post-book');
}
test('Lin Yan recalls both early decisions and either original witness can establish the first destination',()=>{
 for(const [meeting,route,inspect,deliver] of [['aid','relay','read-box','deliver-0'],['decline-companion','door','walk-stops','deliver-1']]){
  let s=follow(postOffer(meeting),'launch-'+route,'practice-post');
  assert.match(s.currentScene.title,/写反的站名/);
  assert.equal(s.lastReceipt.action.approach,'steady');
  s=follow(s,'investigate',inspect);assert.equal(s.lastReceipt.elapsedDays,1);
  assert.match(prose(s),route==='relay'?/弧边归篷房/:/与匣底相合的是半边晒架/);
  s=deserializeLiveState(serializeLiveState(s));
  s=follow(s,'post-book','deliver',deliver);
  assert.match(prose(s),/两边合拢/);
  s=follow(s,'keep-register',route==='door'?'single-bell':'two-runners','keep-register');
  assert.match(prose(s),route==='door'?/亲手签过/:/两个脚夫/);
  s=follow(s,'station-mark','keep-register','split-box','post-history');
  assert.equal(s.events.post.steps.length,3);
  assert.match(prose(s),/不抄寄件人/);
  assert.equal(s.events.post.ending,'leaves');
  assert.equal(s.life.ageDays-s.events.post.start,25*DAYS_PER_YEAR);
 }
});
test('wrong delivery, returning a sealed parcel and declining the project have distinct persistent consequences',()=>{
 const offer=postOffer('decline-companion'),refused=follow(offer,'consider','decline-post');
 assert.equal(refused.events.post.route,'pass');assert.equal(refused.lastReceipt.elapsedDays,0);
 const s=follow(offer,'launch-door','keep-register','deliver');
 const wrong=pick(s,'deliver-0');assert.match(prose(wrong),/误投/);
 const returned=follow(s,'review-parcel','return-parcel');assert.match(prose(returned),/重写地点/);
 assert.deepEqual(returned.life.items,s.life.items);
 assert.throws(()=>validatePost({...returned.events.post,steps:[{day:s.life.ageDays,decision:'missed'}]}),/回单/);
});
test('cultivating past a deadline leaves a dated return slip, and the next cohort still makes its own decision',()=>{
 let s=follow(postOffer('aid'),'launch-relay','back','train-menu');
 for(let i=0;i<4;i++)s=follow(s,'practice','train-menu');
 s=follow(s,'rest-menu','back','affairs-menu','companion-menu','post-book');
 assert.match(s.currentScene.title,/换班已经过去/);
 const age=s.life.ageDays;
 s=pick(s,'file-return');assert.equal(s.life.ageDays,age);
 assert.equal(s.events.post.steps[0].decision,'missed');
 if(s.currentScene.choices.some(c=>c.id.endsWith(':c:keep-register')))s=pick(s,'keep-register');
 assert.match(prose(s),/没有两边落款/);
 s=pick(s,'single-bell');assert.equal(s.events.post.steps[1].decision,'bell');
});
test('the deadline is checked on actual arrival and an overseas courier cannot impersonate an eyewitness',()=>{
 const s=follow(postOffer('aid'),'launch-relay','keep-register','deliver');
 s.life.ageDays=s.events.post.start+4*DAYS_PER_YEAR-1;
 const delivery=eventNode(s).choices.find(c=>c.key==='deliver-0');
 assert.match(delivery.label,/途中换班/);
 assert.deepEqual(delivery.patch.post.steps,[{decision:'missed',day:s.life.ageDays+1}]);
 s.life.cultivationProfile.worldTier=1;
 const remote=eventNode(s);assert.equal(remote.title,'药路寄来的托函');
 assert.ok(!remote.choices.some(c=>c.key==='deliver-0'));
 const reply=remote.choices.find(c=>c.key==='file-return');
 assert.deepEqual(reply.patch.post.steps,[{decision:'delegated',day:s.life.ageDays}]);
});
test('Zhi can travel alone, share the shore or miss the tide; her old training changes the real cost of leave',()=>{
 const start=follow(postOffer('decline-companion'),'launch-relay','keep-register','deliver','deliver-0','keep-register');
 const tide=(s,lesson)=>follow(s,lesson,'keep-register','named-witness','keep-register','keep-box','post-shore','join-shore');
 const pair=tide(start,'two-runners'),bell=tide(start,'single-bell');
 const alone=pick(pair,'cover-desk');
 assert.equal(alone.events.post.walk.outcome,'alone');assert.equal(alone.lastReceipt.elapsedDays,3);
 const supply=bell.life.items.supplies;
 let solo=pick(bell,'find-cover');
 assert.equal(solo.life.items.supplies,supply-1);assert.equal(solo.lastReceipt.elapsedDays,2);
 const options=compileChoices(solo,solo.currentScene.choices);
 assert.match(options.find(c=>c.id.endsWith(':c:take-ridge')).warnings.join(''),/会错过阿枳/);
 assert.doesNotMatch(options.find(c=>c.id.endsWith(':c:take-ferry')).warnings.join(''),/会错过阿枳/);
 const late=follow(solo,'take-ridge','file-tide');
 assert.equal(late.events.post.walk.outcome,'late');assert.equal(late.events.post.walk.finished-late.events.post.walk.start,5);
 solo=follow(deserializeLiveState(serializeLiveState(solo)),'take-ferry','hold-paper');
 assert.equal(solo.events.post.walk.outcome,'sketch');assert.match(prose(solo),/床头/);
 const shared=follow(pair,'find-cover','take-ridge','sit-quiet');assert.equal(shared.events.post.walk.finished-shared.events.post.walk.start,4);
 assert.equal(shared.life.items.supplies,pair.life.items.supplies);
 assert.throws(()=>validatePost({...shared.events.post,walk:{...shared.events.post.walk,finished:shared.life.ageDays+10}},shared.life),/看潮/);
});

const valleyCamp=()=>follow(open(),'deliberate','policy-0','field-guide','enter-field');
test('station commissions carry the last settlement into the next trip; both districts can be heard after a real retreat',()=>{
 const start=follow(postOffer('decline-companion'),'launch-relay','keep-register','deliver','deliver-0','keep-register','two-runners','keep-register','station-mark','keep-register','split-box','post-history','station-book');
 const plan=pick(start,'trust-0'),early=follow(plan,'station-work','visit-0','visit-1','station-settle');
 const appointments=journeyNotes(plan);
 const shift=appointments.find(n=>n.node==='post-stations');
 const retreat=compileChoices(plan,plan.currentScene.choices).find(c=>c.id.endsWith(':c:station-retreat'));
 assert.ok(plan.life.ageDays+retreat.costs.days>shift.close);
 assert.match(crossingDeadlines(plan,appointments,retreat.costs.days),/两站交账首班/);
 assert.equal(early.life.ageDays-plan.life.ageDays,94);
 assert.match(prose(early),/小木鞋/);assert.match(prose(early),/额头/);
 let s=pick(deserializeLiveState(serializeLiveState(early)),'settle-2');
 assert.equal(s.lastReceipt.elapsedDays,2);assert.equal(s.life.items.supplies,early.life.items.supplies-1);
 assert.match(prose(s),/最后一人到齐/);
 s=follow(s,'trust-1','station-work','visit-1');assert.equal(s.lastReceipt.elapsedDays,2);
 s=follow(s,'station-settle','settle-1','trust-0','station-work','visit-1');assert.equal(s.lastReceipt.elapsedDays,1);
 const fog=follow(s,'visit-0','walk-fog');
 const sensed=pick(fog,'sense-oar');assert.equal(sensed.life.cultivationProfile.spirit,fog.life.cultivationProfile.spirit-4);
 assert.equal(sensed.events.post.stations[2].fog,'carried');
 const found=pick(fog,'feel-left');assert.equal(found.events.post.stations[2].fog,'found');
 const missed=follow(fog,'feel-right','walk-fog','find-crossing');assert.equal(missed.events.post.stations[2].fog,'found');
 s=follow(found,'station-settle','settle-0');assert.equal(s.events.post.stations.length,3);
 assert.match(prose(s),/无主|无人来认/);assert.match(prose(s),/开船前夜/);
 assert.deepEqual(deserializeLiveState(serializeLiveState(s)),s);
 const other=follow(start,'trust-1','station-retreat','visit-1','visit-0','station-settle');
 assert.match(prose(other),/藤杖/);assert.match(prose(other),/箱到/);
 assert.match(prose(other),/六日访回/);
 const delayed=pick(other,'settle-2');assert.equal(delayed.lastReceipt.elapsedDays,6);
 const debt=structuredClone(delayed.events.post);
 debt.stations[0].end=debt.stations[0].visits.at(-1).day+2;
 assert.throws(()=>validatePost(debt,delayed.life),/两站结案/);
 const one=follow(plan,'station-work','visit-0','station-settle');
 assert.ok(!one.currentScene.choices.some(x=>x.id.endsWith(':c:settle-2')));
 const away=pick(one,'hear-other');away.life.cultivationProfile.worldTier=1;
 assert.match(eventNode(away).choices.find(x=>x.key==='visit-1').label,/寄函/);
});
const firstWatch=(seed,keeper,marks)=>follow(start(undefined,seed),'decline','train-menu','rest-menu','watch-book','watch-open','keeper-'+keeper,marks,'sit-watch');
const firstPlot=(seed=42)=>follow(start(undefined,seed),'decline','train-menu','garden-book','sow');
test('calendar notes respect inclusive harvest days and distinguish an appointment from a declined invitation',()=>{
 const s=firstPlot(),notes=journeyNotes(s),garden=notes.find(n=>n.node==='garden-book');
 assert.match(garden.timing,/日开始/);
 const away={...s,events:{...s.events,node:'training'}},days=garden.close-s.life.ageDays;
 assert.equal(crossingDeadlines(away,notes,days),'');
 assert.match(crossingDeadlines(away,notes,days+1),/嫩候/);
 const post=follow(postOffer('aid'),'launch-relay','back');
 const note=journeyNotes(post).find(n=>n.node==='post-book');
 const path=noteRoutes(post,[note]).get('post-book'),desk=follow(post,...path);
 assert.equal(desk.events.node,'post-book');assert.deepEqual(desk.life,post.life);assert.deepEqual(desk.events.post,post.events.post);
 const declined=follow(postOffer('decline-companion'),'consider','decline-post');
 assert.ok(!journeyNotes(declined).some(n=>n.node==='post-book'));
});
function growToRealm(s,rank,arrival='mount-book'){
 s=pick(s,'train-menu');
 for(let turns=0;turns<80;turns++){
  const next=nextRealmFor(s.life);
  if(s.life.injury>1||s.life.cultivationProfile.spirit<35+next.rank*5)s=follow(s,'rest-menu','recover','train-menu');
  else if(s.life.cultivation<next.threshold)s=follow(s,'practice','train-menu');
  else if(!s.life.items[next.material]){
   s=follow(s,'rest-menu','back','journey-menu','resources-menu');
   if(!s.life.items.supplies&&next.rank>1)s=pick(s,'next-resource');
   s=follow(s,'gather','train-menu');
  }else{
   s=pick(s,'breakthrough');
   if(realmFor(s.life).rank===rank)return pick(s,arrival);
   s=pick(s,'train-menu');
  }
 }
 assert.fail('stalled at '+s.life.realm);
}
function formBook(observe){
 let s=follow(start(observe),'decline');
 for(let rank=1;rank<=2;rank++)s=growToRealm(s,rank,'continue');
 s=follow(s,'affairs-menu','mentor-menu');
 if(!canStudyForm(s.life))s=follow(s,'diagnose','restore','mentor-menu');
 return pick(s,'form-book');
}
test('a repaired foundation life studies a form through paid native practice and keeps the draft in its journal',()=>{
 const book=formBook(),draft=pick(book,'form-listen');
 assert.deepEqual(draft.events.forms,{known:null,draft:'listen'});
 assert.ok(journeyNotes(draft).some(n=>n.node==='form-book'));
 const proposal=draft.currentScene.choices.find(c=>c.id.endsWith(':c:form-steady')),rule=v7ActionRule(draft,proposal);
 const learned=pick(deserializeLiveState(serializeLiveState(draft)),'form-steady');
 assert.deepEqual(learned.events.forms,{known:'listen',draft:null});
 assert.equal(learned.life.ageDays-draft.life.ageDays,rule.days);
 assert.equal(learned.life.cultivation-draft.life.cultivation,rule.cultivation);
 assert.equal(draft.life.cultivationProfile.spirit-learned.life.cultivationProfile.spirit,rule.spiritCost);
 assert.ok(!journeyNotes(learned).some(n=>n.node==='form-book'));
 const retrain=follow(learned,'form-book','form-ward');
 const action=retrain.currentScene.choices.find(c=>c.id.endsWith(':c:form-intensive'));
 const failed=advanceEvents(retrain,{kind:'choice',action,cultivationResult:{check:{success:false}}});
 assert.deepEqual(failed.forms,{known:'listen',draft:'ward'});
 assert.equal(failed.node,'form-result');
 assert.match(eventNode({...retrain,events:failed}).blocks[0].text,/分息听泉仍在/);
 const changed=pick(retrain,'form-steady');
 assert.deepEqual(changed.events.forms,{known:'ward',draft:null});
 assert.equal(changed.life.ageDays-retrain.life.ageDays,rule.days);
});

test('forms keep the ordinary risky path intact and change only the advertised spirit, chance or failure injury',()=>{
 for(const mode of ['listen','ward']){
  let s=follow(formBook(),'form-'+mode,'form-steady','train-menu');
  while(s.life.cultivation<nextRealmFor(s.life).threshold){
   if(s.life.cultivationProfile.spirit<30)s=follow(s,'rest-menu','recover','train-menu');
   s=follow(s,'practice','train-menu');
  }
  s=pick(s,'find-material');if(s.events.node==='hunt-sources')s=pick(s,'hunt-grounds');
  while(!s.life.items.supplies)s=pick(s,'hunt-food');
  if(s.life.cultivationProfile.spirit<20)s=pick(s,'hunt-rest');
  s=pick(s,'hunt-forms');
  const original=s.currentScene.choices.find(c=>c.id.endsWith(':c:hunt-bold'));
  const skill=s.currentScene.choices.find(c=>c.id.endsWith(':c:hunt-skilled'));
  assert.equal(original.stake,'low');
  const ordinary=v7ActionRule(s,original),aided=eventActionRule(s,skill,v7ActionRule(s,skill));
  assert.equal(aided.spiritCost,ordinary.spiritCost+6);
  assert.equal(aided.chance,mode==='listen'?Math.min(99,ordinary.chance+12):ordinary.chance);
  assert.equal(aided.failureInjury,mode==='ward'?Math.max(0,ordinary.failureInjury-1):ordinary.failureInjury);
  for(const field of ['days','gain','items','cultivation','checkKind','exposure'])assert.deepEqual(aided[field],ordinary[field]);
  const failed=resolveV7Action(s.life,skill,aided,99,s.turnId+1),plainFailure=resolveV7Action(s.life,original,ordinary,99,s.turnId+1);
  assert.equal(failed.result.check.success,false);
  assert.equal(failed.nextLife.injury,plainFailure.nextLife.injury-(mode==='ward'?1:0));
  assert.equal(failed.nextLife.items.core??0,s.life.items.core??0);
  const outcome=pick(s,'hunt-skilled');
  assert.equal(outcome.life.ageDays-s.life.ageDays,aided.days);
  assert.equal(s.life.cultivationProfile.spirit-outcome.life.cultivationProfile.spirit,aided.spiritCost);
  assert.equal(outcome.lastReceipt.cultivationResult.check.chance,aided.chance);
  assert.equal(outcome.lastReceipt.itemChanges.supplies,-1);
  assert.deepEqual(deserializeLiveState(serializeLiveState(outcome)).events.forms,s.events.forms);
  const poor=structuredClone(s);poor.life.cultivationProfile.spirit=ordinary.spiritCost;
  assert.match(eventActionRule(poor,skill,v7ActionRule(poor,skill)).reason,/灵力不足/);
  assert.ok(!eventActionRule(poor,original,v7ActionRule(poor,original)).reason);
 }
});

test('form records reject unearned entries and malformed specializations',()=>{
 assert.throws(()=>validateForms({node:'form-book'},start().life),/筑基/);
 for(const forms of [null,{},[],{known:null,draft:null},{known:'both',draft:null},{known:'listen',draft:'other'}])assert.throws(()=>validateForms({node:'hub',forms}));
 for(const node of ['form-drill','form-result','hunt-forms'])assert.throws(()=>validateForms({node}));
 assert.doesNotThrow(()=>validateForms({node:'form-book'}));
});
function windOffer(mode='listen',observe){
 let s=follow(formBook(observe),'form-'+mode,'form-steady','train-menu','garden-book','mount-book','seek-source');
 for(let i=0;i<4;i++){
  if(s.life.cultivationProfile.spirit<20)s=follow(s,'train-menu','rest-menu','recover','mount-book');
  s=follow(s,'hear-stone','mount-steady','path-'+[1,0,1,0][i]);
  if(i===1)s=pick(s,'keep-token');
 }
 return s;
}
test('both learned forms can fund a real day with Xiaoman, keep ordinary gifts optional and retain an unfinished conversation',()=>{
 for(const mode of ['listen','ward']){
  const offer=windOffer(mode),skipped=pick(offer,'keep-token');
  assert.equal(skipped.events.mountain.wind,undefined);
  assert.deepEqual(skipped.events.mountain.gifts,['keep','keep']);
  const gate=pick(offer,'mount-wind'),poor=structuredClone(gate);poor.life.cultivationProfile.spirit=5;
  const button=poor.currentScene.choices.find(c=>c.id.endsWith(':c:wind-practice'));
  assert.match(eventActionRule(poor,button,v7ActionRule(poor,button)).reason,/灵力不足/);
  const paid=pick(gate,'wind-practice');
  assert.equal(paid.life.ageDays-gate.life.ageDays,1);
  assert.equal(gate.life.cultivationProfile.spirit-paid.life.cultivationProfile.spirit,6);
  assert.equal(paid.life.cultivation,gate.life.cultivation);
  assert.deepEqual(paid.life.items,gate.life.items);
  assert.deepEqual(paid.events.mountain.wind,{form:mode,day:paid.life.ageDays,ending:null});
  let resumed=pick(paid,'train-menu');
  const route=noteRoutes(resumed,journeyNotes(resumed)).get('mount-book');assert.ok(route);
  resumed=follow(resumed,...route);
  assert.equal(resumed.currentScene.title,'谁来迈下一步');
  resumed=deserializeLiveState(serializeLiveState(resumed));
  for(const ending of ['own','pair']){
   const settled=follow(resumed,'wind-'+ending,'mount-book','keep-token');
   assert.equal(settled.events.mountain.wind.ending,ending);
   assert.equal(settled.life.ageDays,paid.life.ageDays);
   assert.ok(!settled.currentScene.choices.some(c=>c.id.endsWith(':c:wind-practice')));
   const broken=structuredClone(settled.events.mountain);broken.wind.day=broken.walk[3].woke;
   assert.throws(()=>validateMountain(broken,settled.life,settled.events.node,settled.events.forms),/风口/);
  }
  const impossible=structuredClone(paid.events.mountain);impossible.gifts.push('keep');
  assert.throws(()=>validateMountain(impossible),/风口/);
 }
});

test('the wind lesson changes an actual later rescue and farewell even when the player keeps both tokens',()=>{
 for(const ending of ['own','pair']){
  let s=follow(windOffer(ending==='own'?'listen':'ward'),'mount-wind','wind-practice','wind-'+ending,'mount-book','keep-token');
  s=growToRealm(s,5);
  s=follow(s,'hear-stone','mount-steady','path-0');
  assert.deepEqual(s.events.mountain.gifts,['keep','keep']);
  assert.match(prose(s),ending==='own'?/风口那天怎样试出/:/风口那天的节拍/);
  s=pick(s,'call-xiaoman');assert.equal(s.events.mountain.walk[4].exit,'guided');
  assert.equal(s.lastReceipt.elapsedDays,0);
  s=follow(s,'hear-stone','mount-steady','path-0','send-xiaoman');
  assert.match(prose(s),ending==='own'?/没有回头等你伸手/:/谁都没有叫对方停住/);
  s=pick(s,'mount-history');assert.match(prose(s),/风口同行/);
  assert.match(prose(s),ending==='own'?/轮到你沿他的脚印走/:/节拍把两个人都带回/);
  assert.deepEqual(deserializeLiveState(serializeLiveState(s)).events.mountain,s.events.mountain);
 }
});
const ferryFromTraining=s=>follow(s,'rest-menu','back','journey-menu','resources-menu','shell-book');
test('the echo well charges each leg once, carries survey work across a retreat and remembers who inherits the bell',async()=>{
 const {readFile}=await import('node:fs/promises'),{gunzipSync}=await import('node:zlib');
 const bytes=gunzipSync(await readFile(new URL('./fixtures/f9b784d-echo-well.jsonl.gz',import.meta.url))).toString('utf8');
 const old=JSON.parse(bytes.split('\n')[0]).state;
 const source=follow(old,'train-menu','find-material');
 for(const [way,clue,rig,claim,trained] of [['cautious','chalk','sluice','share',true],['bold','knot','sluice','alone',false],['bold','knot','basket','alone',true]]){
  let s=pick(source,'well-'+way);const budget=s.events.well.total;
  assert.equal(s.lastReceipt.elapsedDays,budget/4);assert.deepEqual(s.lastReceipt.itemChanges,{supplies:-1});
  s=pick(s,'well-'+clue);assert.equal(s.lastReceipt.elapsedDays,budget/4);
  const atLeg=structuredClone(s.events.well),age=s.life.ageDays;
  s=follow(s,'train-menu','find-material','well-book');assert.deepEqual(s.events.well,atLeg);assert.equal(s.life.ageDays,age);
  s=pick(deserializeLiveState(serializeLiveState(s)),'well-'+rig);
  assert.equal(s.lastReceipt.elapsedDays,trained?budget/8:budget/4);
  const before=s;
  s=pick(s,'well-'+claim);
  const w=s.events.well,success=s.lastReceipt.cultivationResult.check.success;
  assert.equal(s.lastReceipt.elapsedDays,budget/4+(claim==='share'?12:0));assert.equal(w.found,success);
  assert.equal(w.finish-w.start,(trained?7/8:1)*budget+(claim==='share'?12:0));
  assert.equal(s.life.items.supplies,source.life.items.supplies-1);assert.equal(s.lastReceipt.itemChanges.soulseal??0,success?(claim==='share'?1:2):0);
  const broken={...w,finish:w.start+1};assert.throws(()=>validateWell(broken,s.life),/日期/);
  if(claim==='share'){
   const later=follow(growToRealm(s,4,'continue'),'journey-menu','resources-menu','next-resource','well-book');
   for(const reply of ['up','down']){
    const final=pick(later,'well-'+reply);assert.equal(final.events.well.reply,reply);
    assert.equal(final.lastReceipt.elapsedDays,12);assert.deepEqual(final.lastReceipt.itemChanges,{});
    assert.match(prose(final),reply==='up'?/按铃交班/:/最后一人/);
    assert.deepEqual(deserializeLiveState(serializeLiveState(final)),final);
   }
  }else if(!trained){
   let camp=before;
   for(let i=0;s.events.well.found;i++){
    assert.ok(i<32);camp=follow(camp,'train-menu','rest-menu','recover','train-menu','find-material','well-book');
    s=pick(camp,'well-alone');
   }
   assert.equal(s.lastReceipt.itemChanges.soulseal??0,0);assert.match(prose(s),/没有带走归魂印/);
   let retry=follow(s,'train-menu','find-material');
   for(let j=0;!retry.life.items.supplies;j++){assert.ok(j<12);retry=pick(retry,'hunt-food');}
   assert.ok(retry.currentScene.choices.some(c=>c.id.endsWith(':c:hunt-careful')));
  }
 }
});
test('material leads follow the actual missing item, fishing decisions and native search odds',()=>{
 let gate=growToRealm(follow(start(),'accept','finish-work'),1,'train-menu');
 while(gate.life.cultivation<nextRealmFor(gate.life).threshold)gate=follow(gate,'practice','train-menu');
 const source=pick(gate,'find-material');
 assert.equal(source.lastReceipt.elapsedDays,0);assert.match(prose(source),/裂壳滩/);
 const fork=pick(source,'shell-book');
 const gift=follow(fork,'sail-bank','trace-shell','ask-ferrier','leave-release','train-menu','find-material');
 assert.equal(gift.events.node,'hunt-grounds');assert.equal(gift.currentScene.title.startsWith('断层石场'),true);
 let ordinary=pick(source,'hunt-grounds');
 for(let i=0;!ordinary.life.items.supplies;i++){
  assert.ok(i<12);ordinary=pick(ordinary,'hunt-food');
 }
 const row=key=>ordinary.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
 const careful=v7ActionRule(ordinary,row('hunt-careful')),bold=v7ActionRule(ordinary,row('hunt-bold'));
 assert.ok(careful.days>bold.days);assert.ok(careful.chance>bold.chance);
 for(const [key,rule] of [['hunt-careful',careful],['hunt-bold',bold]]){
  const after=pick(ordinary,key);
  assert.equal(after.lastReceipt.elapsedDays,rule.days);assert.equal(after.lastReceipt.itemChanges.supplies,-1);
  const gained=after.lastReceipt.itemChanges.crystal??0;
  assert.equal(gained,after.lastReceipt.cultivationResult.check.success?rule.gain.crystal:0);
  assert.match(prose(after),gained?/晶心|青光/:/碎屑/);
  assert.deepEqual(deserializeLiveState(serializeLiveState(after)),after);
  if(gained)assert.equal(pick(after,'breakthrough').lastReceipt.itemChanges.crystal,-1);
 }
});
test('a fatal high-realm breakthrough at the search grounds can settle and restore the life',()=>{
 let s=follow(start(),'accept','finish-work');
 for(let rank=1;rank<=6;rank++)s=growToRealm(s,rank,'continue');
 s=pick(s,'train-menu');
 while(s.life.cultivation<nextRealmFor(s.life).threshold)s=follow(s,'practice','train-menu');
 s=follow(s,'find-ridge','hunt-grounds');
 for(let i=0;!s.life.items.unityjade;i++){
  assert.ok(i<60);s=pick(s,!s.life.items.supplies?'hunt-food':s.life.cultivationProfile.spirit<5?'hunt-rest':'hunt-careful');
 }
 for(let i=0;i<300;i++){
  const action=compileChoices(s,s.currentScene.choices).find(c=>c.approach==='breakthrough');
  if(action.enabled){
   const pending=prepareChoice(s,{choiceId:action.id,requestId:'high-realm-failure'});
   if(pending.receipt.death?.cause==='injury'){
    assert.ok(pending.nextLife.cultivation<nextRealmFor(s.life).threshold);
    const dead=settleDeath(s,pending);assert.equal(dead.phase,'dead');
    assert.deepEqual(deserializeLiveState(serializeLiveState(dead)),dead);
    return;
   }
  }
  s=pick(s,'hunt-rest');
 }
 assert.fail('the route did not encounter high-realm backlash');
});

test('an independent cultivator can open the three ridge sections, bring back materials and use the earlier works',()=>{
 let s=follow(start(),'decline');
 for(let rank=1;rank<=6;rank++)s=growToRealm(s,rank,'continue');
 for(const [i,site] of ['unityjade','daofruit','thunderseal'].entries()){
  s=pick(s,'train-menu');
  while(s.life.cultivation<nextRealmFor(s.life).threshold||!s.life.items.supplies||s.life.cultivationProfile.spirit<5){
   if(!s.life.items.supplies)s=follow(s,'rest-menu','back','journey-menu','resources-menu','next-resource','gather','train-menu');
   else if(s.life.cultivationProfile.spirit<20||s.life.injury>1)s=follow(s,'rest-menu','recover','train-menu');
   else s=follow(s,'practice','train-menu');
  }
  s=pick(s,'find-ridge');
  const ordinary=pick(structuredClone(s),'hunt-grounds');
  const fare=v7ActionRule(ordinary,ordinary.currentScene.choices.find(c=>c.id.endsWith(':c:hunt-careful')));
  s=pick(s,'ridge-start');assert.equal(s.lastReceipt.elapsedDays,fare.days);assert.equal(s.lastReceipt.itemChanges.supplies,-1);
  if(i===1)assert.match(prose(s),/吊筐正压着近枝/);
  if(i===2)assert.match(prose(s),/浅槽旁的试针/);
  const correct=i===0?Number(prose(s).includes('西孔里的粉线')):1;
  s=pick(s,'ridge-test-'+(1-correct));assert.equal(s.events.ridgeRoad.at(-1).aligned,false);
  assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:ridge-test-'+(1-correct))));
  s=pick(s,'train-menu');
  const note=journeyNotes(s).find(n=>n.node==='ridge-'+site);
  s=follow(s,...noteRoutes(s,[note]).get(note.node));
  s=pick(s,'ridge-test-'+correct);assert.equal(s.lastReceipt.elapsedDays,2);
  s=pick(s,'ridge-leave-'+(i===0?1:0));assert.equal(s.lastReceipt.itemChanges[site],1);
  assert.ok(!s.currentScene.choices.some(c=>c.id.includes('ridge-leave')));
  assert.deepEqual(deserializeLiveState(serializeLiveState(s)),s);
  if(i<2)s=growToRealm(s,7+i,'continue');
 }
 s=growToRealm(s,9,'continue');
 assert.equal(realmFor(s.life).rank,9);assert.equal(s.events.entry,'declined');assert.equal(s.events.nursery,undefined);
});
test('one cultivator takes three ferry relics into native breakthroughs and returns to fulfil the promise',()=>{
 const spent=new Set();
 const birth=start((key,s)=>{if(key==='breakthrough')for(const [item,n] of Object.entries(s.lastReceipt.itemChanges))if(n<0)spent.add(item);});
 let s=ferryFromTraining(growToRealm(follow(birth,'accept','finish-work'),1,'train-menu'));
 s=follow(s,'sail-bank','trace-shell','take-moult');
 assert.equal(s.lastReceipt.itemChanges.crystal,1);
 assert.deepEqual(Object.values(s.lastReceipt.relationChanges),[1]);
 s=ferryFromTraining(growToRealm(s,2,'train-menu'));
 s=follow(s,'sail-bank','follow-lamp');
 assert.equal(s.lastReceipt.elapsedDays,2);
 s=follow(s,'warm-coal','take-cold');
 assert.equal(s.lastReceipt.itemChanges.core,1);
 s=ferryFromTraining(growToRealm(s,5,'train-menu'));
 s=follow(s,'sail-deck','pilot-gap');
 assert.deepEqual(s.lastReceipt.itemChanges,{});
 s=pick(s,'take-borrow');assert.equal(s.lastReceipt.itemChanges.voidstone,1);
 s=ferryFromTraining(growToRealm(s,6,'train-menu'));
 for(const ending of ['chart','quiet']){
  const final=pick(s,ending);
  assert.equal(final.events.ferry.reply,ending);
  assert.deepEqual(final.lastReceipt.itemChanges,{});
  assert.deepEqual(deserializeLiveState(serializeLiveState(final)),final);
  assert.equal(pick(final,'shell-journal').currentScene.blocks.length,3);
 }
 for(const item of ['crystal','core','voidstone'])assert.ok(spent.has(item),item);
});
test('the ferry records a missed tide, a gift freely declined, and the cost of stripping the boat',()=>{
 const opening=ferryFromTraining(growToRealm(follow(start(),'accept','finish-work'),1,'train-menu'));
 const atBank=pick(opening,'sail-bank');
 assert.equal(practicePlan(pick(atBank,'train-menu')).count,0);
 const missed=pick(ferryFromTraining(follow(atBank,'train-menu','practice','train-menu')),'close-tide');
 assert.equal(missed.events.ferry.pages[0].end,'missed');assert.deepEqual(missed.lastReceipt.itemChanges,{});
 const gift=follow(atBank,'trace-shell','ask-ferrier','leave-release');
 assert.deepEqual(gift.lastReceipt.itemChanges,{});assert.deepEqual(Object.values(gift.lastReceipt.relationChanges),[3]);
 const stripped=pick(atBank,'take-keel');
 assert.equal(stripped.lastReceipt.itemChanges.crystal,1);assert.deepEqual(Object.values(stripped.lastReceipt.relationChanges),[-2]);
 const next=ferryFromTraining(growToRealm(stripped,2,'train-menu'));
 assert.match(prose(next),/玄铁/);
 const broken=structuredClone(gift.events.ferry);broken.pages[0].marks=0;
 assert.throws(()=>validateFerry(broken,gift.life),/宝物去处/);
});
test('a single life returns to the folded mountain at foundation and spirit, including a mobile replay from a pre-stone archive',async t=>{
 for(const wish of ['home','source']){
  const route=[];let s=follow(start(key=>route.push(key)),'decline','train-menu','garden-book','mount-book','seek-'+wish);
  for(let i=0;i<6;i++){
   if(i===2||i===4)s=growToRealm(s,i===2?2:5);
   s=pick(s,i%2?'hear-stone':'watch-stone');const before=s.life.ageDays;
   s=pick(s,'mount-steady');const slot=s.events.mountain.walk[i];
   assert.equal(slot.days,s.life.ageDays-before);assert.equal(slot.woke,s.life.ageDays);
   assert.equal(slot.method,s.lastReceipt.action.approach);
   assert.ok(s.lastReceipt.after.cultivation>s.lastReceipt.before.cultivation);
   if(wish==='source'&&[0,2,4].includes(i)){
    s=follow(s,'path-0','go-around','side-'+({0:'bowl',2:'carry',4:'sit'}[i]));
   }else if(i===0){
    s=follow(s,'path-0','try-again');assert.deepEqual(deserializeLiveState(serializeLiveState(s)),s);
    s=pick(s,'path-1');assert.equal(s.events.mountain.walk[0].exit,'corrected');
   }else if(i===2)s=follow(s,'path-0','call-xiaoman');
   else s=pick(s,'path-'+(i===4||i===5&&wish==='home'?1:0));
   if(i===1||i===3){
    s=pick(s,i===1?'give-token':'keep-token');
    if(i===3&&wish==='source')assert.equal(s.events.mountain.walk[2].turning,'carry');
   }
  }
  s=pick(s,wish==='home'?'send-xiaoman':'open-mountain');
  assert.match(prose(s),wish==='home'?/脚步落在石外/:/留一道门/);
  s=pick(s,'mount-history');
  assert.equal(s.currentScene.blocks.length,6);assert.match(prose(s),wish==='home'?/破了音的芦哨/:/井底的空碗/);
  assert.match(prose(s),wish==='home'?/空碗|桌脚/:/石边|侧面/);
  const clone=structuredClone(s.events.mountain);
  if(wish==='home')clone.gifts[0]='keep';else clone.walk[0].turning='meal';
  assert.throws(()=>validateMountain(clone,s.life),/记录|岔路/);
  if(wish==='home')await replayOldGarden(t,route,s.events.mountain);
 }
});
async function replayOldGarden(t,route,expected){
 const {liveBrowser}=await import('./helpers/live-browser.js'),{readFile}=await import('node:fs/promises'),{gunzipSync}=await import('node:zlib');
 const {page}=await liveBrowser(t);await page.setViewportSize({width:360,height:760});
 let calls=0;await page.route('**/api/story/**',r=>{calls++;return r.abort();});
 const text=gunzipSync(await readFile(new URL('./fixtures/873a7ce-first-garden.jsonl.gz',import.meta.url))).toString('utf8');
 const old=await page.evaluate(async text=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await openLiveArchive();
  try{
   await importLiveArchive(new Response(text).body,archive);const {state}=await archive.load();
   return [identity.stateHash(state)===identity.stateHash(JSON.parse(text.split('\n')[0]).state),state.currentScene.choices.length];
  }finally{archive.close();}
 },text);
 assert.deepEqual(old,[true,2]);
 const button=key=>page.locator('[data-live-choice$=":c:'+key+'"]:enabled');
 async function resume(key){
  await page.reload();const saved=button(key),enter=page.locator('[data-title-continue]:enabled');
  await saved.or(enter).first().waitFor();if(!await saved.isVisible())await enter.click();await saved.waitFor();
 }
 await resume('train-menu');
 await button('train-menu').click();await button('garden-book').click();
 let savedClicks=0,batches=0;
 for(let i=3;i<route.length;i++){
  const key=route[i];
  if(key==='practice'){
   await button(key).waitFor();
   const batch=page.locator('[data-live-practice]:enabled');
   if(await batch.count()){
    assert.ok(await batch.evaluate(node=>Boolean(node.compareDocumentPosition(document.querySelector('[data-live-choice]'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    const count=Number(await batch.getAttribute('data-live-practice'));
    // Substitute only an identical stretch of ordinary practice. The
    // reference route still owns every recovery, search and breakthrough.
    const same=Array.from({length:count},(_,j)=>route[i+2*j]==='practice'&&(!j||route[i+2*j-1]==='train-menu')).every(Boolean);
    if(same){
     await batch.click();
     await page.locator('[data-practice-report]').filter({hasText:'已完成 '+count+' 关'}).waitFor();
     savedClicks+=2*(count-1);batches++;i+=2*(count-1);continue;
    }
   }
  }
  await button(key).click();
  if(key==='try-again'){await button('path-1').waitFor();await resume('path-1');}
 }
 await page.getByRole('heading',{name:'山路留痕'}).waitFor();
 const result=await page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js'),{exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js'),{stateHash}=await import('/src/game/cultivation/live/identity.js');
  const a=await openLiveArchive(),b=await openLiveArchive({name:'stone-roundtrip'});
  try{
   await importLiveArchive(exportLiveArchive(a),b);const from=(await a.load()).state,to=(await b.load()).state;
   return [from.events.mountain,from.life.realm,stateHash(from)===stateHash(to),document.documentElement.scrollWidth<=innerWidth];
  }finally{a.close();b.close();}
 });
 assert.deepEqual(result,[expected,'spirit',true,true]);assert.equal(calls,0);
 assert.ok(batches>0&&savedClicks>0);
 t.diagnostic('Mobile old-save route to the mountain ending: '+route.length+' reference choices; '+batches+' steady retreat plans saved '+savedClicks+' clicks along that route.');
 await button('train-menu').click();
 await page.locator('.practice-plan details summary').click();
 await page.locator('[data-practice-count]').selectOption('2');
 const [days,spirit,gain]=await page.locator('[data-practice-count] option:checked').innerText().then(text=>text.match(/(\d+) 日 · 灵力 −(\d+) · 修为 \+(\d+)/).slice(1).map(Number));
 const current=()=>page.evaluate(async()=>{
  const {openLiveArchive}=await import('/src/game/live-archive.js');const a=await openLiveArchive();
  try{const {life,turnId}=((await a.load()).state);return [life.ageDays,life.cultivationProfile.spirit,life.cultivation,turnId];}finally{a.close();}
 });
 const before=await current();
 await page.locator('[data-live-short-practice]').click();
 await page.locator('[data-practice-report]').filter({hasText:'已按所选关数收功'}).waitFor();
 await resume('train-menu');const after=await current();
 assert.deepEqual(after.map((n,i)=>n-before[i]),[days,-spirit,gain,2]);
 assert.equal(calls,0);
}
test('folded mountain retains a failed intensive retreat and charges a detour only once',()=>{
 for(let seed=0;seed<50;seed++){
  let s=follow(start(undefined,seed),'decline','train-menu','garden-book','mount-book','seek-source','hear-stone');
  const food=s.life.items.supplies;
  if(!food)continue;
  s=pick(s,'mount-intensive');
  if(s.events.mountain.walk[0].ok)continue;
  assert.equal(s.life.items.supplies,food-1);assert.match(prose(s),/失手/);
  const before=s.life.ageDays;
  s=follow(s,'path-0','go-around');assert.equal(s.life.ageDays,before+3);
  assert.equal(s.events.mountain.walk[0].exit,'bypath');
  if(s.life.items.supplies){const meals=s.life.items.supplies;s=pick(s,'side-meal');assert.equal(s.life.items.supplies,meals-1);}
  else s=pick(s,'side-bowl');
  assert.equal(s.events.mountain.walk[0].exit,'around');
  assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:go-around')));return;
 }
 assert.fail('no failed intensive retreat exercised');
});
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

function afterRiver(timberChoice=1,observe,visitValley=false,visitPost=false,first){
 let s=first??(visitPost?follow(postOffer('decline-companion',observe),'launch-relay','keep-register','investigate','walk-stops','post-book','deliver','deliver-0','back','journey-menu','river-book','river-open'):open(observe));
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
  const fare=tier===2?90:45,index=tier-1;
  s=pick(s,'yard-book');
  if(!s.events.convoy.shifts?.[index]){
   s=follow(s,'yard-duty','yard-boat','yard-pay-'+((s.life.items.iron??0)<2?'iron':'stones'));
  }else s=pick(s,'yard-shed');
  for(let shift=0;;shift++){
   assert.ok(shift<80,'could not prepare an array at the pier');
   if(s.life.injury>1||s.life.cultivationProfile.spirit<30)s=pick(s,'yard-rest');
   else if((s.life.items.stones??0)<fare+(s.life.items.array?0:6)||!s.life.items.array&&(s.life.items.iron??0)<2){
    s=s.currentScene.choices.some(c=>c.id.endsWith(':c:yard-stores'))?pick(s,'yard-stores'):follow(s,'cross-menu','yard-book','yard-stores');
    while((s.life.items.stones??0)<fare+(s.life.items.array?0:6))s=pick(s,'yard-stones');
    while(!s.life.items.array&&(s.life.items.iron??0)<2)s=pick(s,'yard-iron');
    s=pick(s,'yard-shed');
   }else if(!s.life.items.array)s=pick(s,'yard-forge');
   else break;
  }
  s=follow(s,'cross-menu','sea-array');
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
    if(quick&&!s.life.items.supplies&&s.currentScene.choices.some(c=>c.id.endsWith(':c:ration-book'))){
     s=follow(s,'ration-book',(s.life.items.stones??0)>=2?'ration-buy':'ration-tea');
     continue;
    }
    s=pick(s,quick?(s.life.items.supplies?'intensive-again':'forage-again'):'practice-again');
   }
   s=pick(s,'train-menu');
  }else if(!s.life.items[realm.material]){
   if(s.currentScene.choices.some(c=>c.id.endsWith(':c:find-ridge'))){
    s=pick(s,'find-ridge');
    if(s.life.items.supplies){
     s=pick(s,'ridge-start');
     const correct=realm.material==='unityjade'?Number(prose(s).includes('西孔里的粉线')):realm.material==='daofruit'?Number(prose(s).includes('吊筐正压着近枝')):Number(prose(s).includes('浅槽旁的试针'));
     s=follow(s,'ridge-test-'+correct,'ridge-leave-0','train-menu');
     continue;
    }
    s=pick(s,'hunt-grounds');
   }else s=pick(s,'find-material');
   if(s.events.node==='hunt-sources')s=pick(s,'hunt-grounds');
   if(rank>1&&!s.life.items.supplies)s=pick(s,'hunt-food');
   else s=pick(s,'hunt-careful');
   s=pick(s,'train-menu');
  }else{
   s=pick(s,'breakthrough');
   if(realmFor(s.life).rank===rank)return pick(s,'resume-ledger');
   s=pick(s,'train-menu');
  }
 }
 return follow(s,'rest-menu','back','journey-menu','river-book','hear-council');
}
function lowerWorldCareer(observe,visitPost,first){
 let s=follow(afterRiver(1,observe,true,visitPost,first),'voyage-go','to-kiln','to-store','to-tower','voyage-finish','voyage-book','voyage-go','to-east','to-west','to-peak','voyage-finish','voyage-book','voyage-go','to-pass','to-well','to-camp','voyage-finish','voyage-book','hear-council');
 for(let rank=1;rank<=3;rank++){
  assert.match(s.currentScene.title,/待你归来/);
  s=trainTo(pick(s,'train-menu'),rank);
  if(visitPost&&rank===1){
   s=follow(s,'river-back','affairs-menu','companion-menu','post-book');
   if(s.currentScene.choices.some(c=>c.id.endsWith(':c:keep-register')))s=pick(s,'keep-register');
   s=follow(s,'two-runners','back','journey-menu','river-book','hear-council');
  }
  if(visitPost&&rank===2){
   s=follow(s,'river-back','affairs-menu','companion-menu','post-book');
   if(s.currentScene.choices.some(c=>c.id.endsWith(':c:keep-register')))s=pick(s,'keep-register');
   s=follow(s,'station-mark','keep-register','split-box','post-shore','join-shore','find-cover','take-ferry','sit-quiet','back','journey-menu','river-book','hear-council');
   assert.equal(s.events.post.walk.outcome,'quiet');
  }
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
 return s;
}
test('Lin and Zhi keep their full itinerary alongside the river cases and actual realm breakthroughs',()=>{
 const s=lowerWorldCareer(undefined,true);
 assert.equal(s.life.realm,'golden');
 assert.deepEqual(s.events.post.steps.map(step=>step.decision),['ferry','partner','anonymous']);
 assert.equal(s.events.post.walk.outcome,'quiet');
 const restored=deserializeLiveState(serializeLiveState(s));
 assert.deepEqual(restored.events.post,s.events.post);
});
test('one continuous birth finishes the three-world campaign and replays its entire archive',async t=>{
 const route=[],blocks=new Set(),hunted=new Set(),resumed=new Set(),directions=new Set();
 const observe=(key,state)=>{
  route.push(key);for(const b of state.currentScene.blocks)blocks.add(b.text);
  for(const lead of adventureLeads(state))directions.add(lead.node);
  if(key==='hunt-careful'&&state.lastReceipt.cultivationResult.check.success)hunted.add(state.currentScene.location);
  {
   const notes=[...(['hub','training'].includes(state.events.node)?journeyNotes(state):[]),...adventureLeads(state)].filter(n=>!resumed.has(n.node));
   for(const [node,path] of noteRoutes(state,notes)){
    const before=structuredClone(state),visited=follow(before,...path);
    assert.deepEqual(visited.life,before.life);assert.equal(visited.rng,before.rng);
    assert.deepEqual(visited.events,{...before.events,node,page:visited.events.page});
    resumed.add(node);
   }
  }
 };
 const first=follow(start(observe),'accept','nursery-book','nursery-ditch','nursery-guard-beans','nursery-beans','continue','journey-menu','river-book','river-open');
 let s=lowerWorldCareer(observe,false,first);
 assert.equal(s.events.nursery.end,'beans');
 s=follow(s,'river-back','journey-menu','resources-menu','next-resource','well-road');
 for(let tries=0;!s.life.items.supplies;tries++){assert.ok(tries<16);s=pick(s,'well-food');}
 s=follow(s,'well-cautious','well-chalk','well-sluice','well-share','train-menu','rest-menu','back','journey-menu','river-book','hear-council');
 assert.equal(s.events.well.claim,'share');
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
 const openHarbor=state=>follow(state,'river-back','journey-menu','workshop-menu','crossing-menu','packet-book','packet-sign');
 const sail=(state,stop,mode)=>follow(state,'packet-chart','packet-to-'+stop,'packet-'+mode);
 const loadCargo=(state,n)=>follow(state,'packet-cargo','packet-load-'+n);
 const councilFromTraining=state=>follow(state,'rest-menu','back','journey-menu','river-book','hear-council','convoy-book');
 s=openHarbor(s);
 assert.match(prose(s),/旧钟埠/);
 s=loadCargo(s,0);
 const full=pick(deserializeLiveState(serializeLiveState(s)),'packet-cargo');
 assert.ok(!full.currentScene.choices.some(c=>c.id.includes('packet-load')));
 const priorFreightIron=s.life.items.iron??0;
 s=sail(s,1,'tide');assert.equal(s.life.items.iron,priorFreightIron+1);assert.match(prose(s),/独木船/);
 s=loadCargo(s,2);s=sail(s,0,'tide');s=loadCargo(s,1);
 const herbs=s.life.items.herbs??0,food=s.life.items.supplies??0;
 s=sail(s,2,'tide');assert.equal(s.life.items.herbs,herbs+3);assert.equal(s.life.items.supplies,food+2);
 assert.match(prose(s),/红线钉在秧床/);
 s=follow(s,'packet-close','train-menu');s=councilFromTraining(s);
 const priorStones=s.life.items.stones??0,priorArrays=s.life.items.array??0;
 s=follow(s,'work-board','pin-R','pin-L','pin-L','pin-R','test-pins');
 assert.match(s.currentScene.title,/未合/);assert.equal(s.life.items.stones??0,priorStones);
 s=follow(s,'reset-pins','pin-L','pin-R','pin-L','pin-R','test-pins');
 assert.equal(s.life.items.stones,priorStones+45);assert.equal(s.life.items.array,priorArrays+1);assert.ok(s.events.convoy.benches[0].paid);
 s=crossWithArray(s,1);
 assert.equal(s.life.cultivationProfile.worldTier,1);assert.equal(s.life.items.array,priorArrays);
 s=follow(s,'river-back','journey-menu','workshop-menu','crossing-menu','seed-book');
 assert.match(prose(s),/亲手送豆/);
 s=follow(s,'seed-seep','seed-mend','train-menu','rest-menu','back','affairs-menu','ear-book');
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
 s=openHarbor(s);s=loadCargo(loadCargo(s,0),1);
 const bargeFood=s.life.items.supplies??0;
 s=sail(s,2,'tow');assert.equal(s.life.items.supplies??0,bargeFood);
 s=loadCargo(s,2);
 const towCheck=follow(deserializeLiveState(serializeLiveState(s)),'packet-chart','packet-to-1');
 assert.match(prose(towCheck),/需一份行粮/);
 s=sail(s,1,'tide');assert.match(prose(s),/靛坊|染槽/);
 assert.match(prose(s),/回来的人按自己的名字/);
 s=follow(s,'packet-close','train-menu');s=councilFromTraining(s);
 s=follow(s,'work-board','pin-R','pin-L','pin-R','pin-L','test-pins','cross-menu');
 assert.ok(!compileChoices(s,s.currentScene.choices).find(c=>c.approach==='ancient-array').enabled);
 s=trainTo(follow(s,'yard-book','river-back','train-menu'),4);
 s=follow(s,'river-back','journey-menu','resources-menu','next-resource','well-book');
 assert.match(prose(s),/副铃/);assert.equal(s.currentScene.location,'行粮驿的书案');
 s=follow(s,'well-down','train-menu','rest-menu','back','journey-menu','river-book','hear-council','convoy-book');
 s=follow(s,'river-back','journey-menu','workshop-menu','crossing-menu','seed-book','seed-seed');
 assert.equal(s.events.saltField.mended,true);assert.equal(s.events.saltField.parcel,'seed');
 s=follow(s,'back','journey-menu','river-book','hear-council','convoy-book');
 s=crossWithArray(s,2);
 assert.equal(s.life.cultivationProfile.worldTier,2);
 s=follow(s,'river-back','journey-menu','workshop-menu','crossing-menu','seed-book','seed-households');
 assert.match(prose(s),/三处地址/);
 s=follow(s,'back','affairs-menu','ear-book');
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
 s=openHarbor(s);s=loadCargo(s,1);s=sail(s,2,'tow');assert.match(prose(s),/新翻的土/);
 s=follow(s,'packet-moor','train-menu');s=councilFromTraining(s);
 for(let rank=4;rank<=8;rank++){
  if(rank>4)s=trainTo(pick(s,'train-menu'),rank);
  if(rank%2)continue;
  if(s.life.cultivationProfile.spirit<15)s=follow(s,'train-menu','rest-menu','recover','train-menu');
  else s=pick(s,'train-menu');
  s=follow(s,'rest-menu','back','journey-menu','workshop-menu','crossing-menu','sky-book');
  const stage=(rank-4)/2,seat=stage===1?1:0;
  if(!stage)assert.match(prose(s),/末人的报声手势/);
  const before=structuredClone(s.life);
  s=follow(s,'sky-watch-'+seat,'sky-steady');
  assert.equal(s.life.ageDays-before.ageDays,s.lastReceipt.elapsedDays);
  assert.ok(s.lastReceipt.elapsedDays>9);
  assert.equal(s.events.cloudPassage.at(-1).route,null);
  assert.match(prose(s),[/第一枚铁钉/,/两长一短/,/两道白漆/][stage]);
  const branch=deserializeLiveState(serializeLiveState(s));
  const alt=pick(branch,'sky-route-1');
  assert.equal(alt.lastReceipt.elapsedDays,stage===2?9:3);
  if(stage===2)assert.equal(alt.life.items.elixir,(s.life.items.elixir??0)+1);
  const main=stage===0?1:0;
  s=pick(s,'sky-route-'+main);
  assert.equal(s.lastReceipt.elapsedDays,stage===1?9:3);
  if(stage===2){
   assert.equal(s.life.items.thunderseal,(before.items.thunderseal??0)+1);
   assert.match(prose(s),/跳板/);assert.ok(!s.currentScene.choices.some(c=>c.id.includes('sky-route')));
  }else assert.match(prose(s),/下一封请托/);
  if(stage===0){
   s=follow(s,'train-menu','rest-menu','back','journey-menu','workshop-menu','crossing-menu','packet-book');
   assert.match(prose(s),/已过装货期/);assert.match(prose(s),/梅核家书（已交割/);
   s=pick(s,'packet-close');assert.match(prose(s),/等不及井水/);
   assert.match(prose(s),/新翻的土/);
  }
  s=follow(s,'train-menu','rest-menu','back','journey-menu','river-book','hear-council');
 }
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
 t.diagnostic('Material grounds successfully searched in this life: '+[...hunted].join('、'));
 t.diagnostic('Journal and long-route entrances reached through existing menus: '+[...resumed].join(', '));
 for(const node of ['river-book','voyage-book','council-book','convoy-book','watch-book','watch-ding-book']){
  assert.ok(directions.has(node),'missing long-route invitation '+node);assert.ok(resumed.has(node),'unreachable invitation '+node);
 }
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
   gardenRoot:reborn.reincarnation.gardenRoot,heirRecord:heir.state.events.garden.record,heirCharters:reborn.events.charters??null,heirShips:reborn.events.convoy.chapters,
   cause:row.state.lastReceipt.death.cause,reborn:reborn.life.realm,inscription:reborn.reincarnation.inscription,childTitle:reborn.currentScene.blocks.map(b=>b.text).join(''),privateWatch:!!reborn.events.watch};
 },route);
 assert.equal(browser.exact,true);assert.deepEqual(browser.events,s.events);assert.deepEqual(browser.life,s.life);
 assert.equal(browser.turn,s.turnId);assert.equal(browser.title,s.currentScene.title);
 assert.equal(browser.reborn,'mortal');assert.equal(browser.privateWatch,false);assert.match(browser.childTitle,/无名榫/);
 assert.equal(browser.heirCharters,null);assert.deepEqual(browser.heirShips,s.events.convoy.chapters);
 assert.match(browser.childTitle,/归灰稻母土/);assert.equal(browser.gardenRoot,8);
 assert.equal(browser.heirRecord.length,1);assert.equal(browser.heirRecord[0].take,'tips');
 assert.equal(browser.heirRecord[0].day-browser.heirRecord[0].sown,DAYS_PER_YEAR);
 assert.deepEqual(browser.inscription,{form:'village',pieces:[{foot:0,shared:true},{foot:3,shared:false},{foot:8,shared:true}]});
 t.diagnostic('Native archive parent settlement: '+browser.cause+'; inherited inscription restored in mortal child.');
 t.diagnostic('Route inventory: '+blocks.size+' distinct displayed blocks, '+[...blocks].reduce((n,b)=>n+[...b].length,0)+' characters (includes menu and status text).');
 s=pick(s,'train-menu');assert.equal(s.phase,'active');
});
