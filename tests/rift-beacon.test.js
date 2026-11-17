import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene,settleDeath} from '../src/game/cultivation/live/engine.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {validateRiftBeacon,beaconNode} from '../src/game/cultivation/live/rift-beacon.js';
import {v7ActionRule} from '../src/game/cultivation/live/cultivation-rules.js';
import {eventActionRule,eventGoal} from '../src/game/cultivation/live/events.js';
import {journeyNotes,adventureLeads,noteRoutes,crossingDeadlines} from '../src/game/cultivation/live/journey-notes.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/a7ded3d-combined-route.json',import.meta.url)));
function pick(s,key){
 const c=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));assert.ok(c,'missing '+key+' at '+s.events.node);
 const p=prepareChoice(s,{choiceId:c.id,requestId:'beacon-'+(s.turnId+1)});
 return commitTurn(s,p,resolveRuleScene(s,p));
}
const follow=(s,...keys)=>keys.reduce(pick,s);
const bases=new Map();
function completedRift(anchor='drift',ending='renew'){
 const id=anchor+ending;
 if(!bases.has(id)){let s=createLiveGame(fixture.config),p=prepareOpening(s,{requestId:'opening'});s=commitTurn(s,p,resolveRuleScene(s,p));
  for(const key of fixture.route){s=pick(s,key==='rift-drift'?'rift-'+anchor:key==='rift-renew'?'rift-'+ending:key);if(key==='rift-renew')break;}bases.set(id,s);}
 return bases.get(id);
}
test('a native late life explores one side, carries the record and returns by the new floating route',()=>{
 const before=completedRift(),original=structuredClone(before.events.cloudRift);
 let s=follow(before,'beacon-book','beacon-launch');const start=s.life.ageDays;
 s=follow(s,'beacon-channel','beacon-survey','beacon-enter');
 assert.equal(s.life.ageDays-start,4);assert.equal(s.lastReceipt.elapsedDays,2);
 assert.equal(s.events.riftBeacon.place,'beacon');assert.deepEqual(s.lastReceipt.itemChanges,{});
 s=follow(s,'beacon-read','beacon-works','beacon-drift','beacon-exit','beacon-return');
 assert.equal(s.events.riftBeacon.place,'channel');assert.equal(s.lastReceipt.elapsedDays,1);
 s=follow(s,'beacon-shore','beacon-deliver');assert.equal(s.events.riftBeacon.ending,'delivered');
 assert.match(eventGoal(s),/回看本次探路/);
 assert.deepEqual(s.events.cloudRift,original);assert.deepEqual(deserializeLiveState(serializeLiveState(s)),s);
 assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:beacon-launch')));
});
test('native retained and changed wind paths both allow a direct repaired return',()=>{
 for(const ending of ['renew','change']){
  const path=ending==='change'?'ledge':'channel';
  let s=follow(completedRift('drift',ending),'beacon-book','beacon-launch','beacon-'+path,'beacon-survey','beacon-enter');
  assert.deepEqual(s.lastReceipt.itemChanges,{});
  s=follow(s,'beacon-read','beacon-works','beacon-moor','beacon-exit','beacon-return');
  assert.equal(s.events.riftBeacon.place,'shore');assert.equal(s.lastReceipt.elapsedDays,2);
  s=pick(s,'beacon-deliver');assert.equal(s.events.riftBeacon.ending,'delivered');
 }
});
test('the four anchor/return combinations price both entrances by their effective shape',()=>{
 const site=follow(completedRift(),'beacon-book','beacon-launch','beacon-ledge','beacon-survey');
 const menu=(key,label,next,patch)=>({key,label,next,patch}),choice=(key,label,intent,targetId,approach,extra)=>({key,label,intent,targetId,approach,...extra});
 // Local rule matrix only; these altered histories are not exported or called native play.
 for(const anchor of ['moor','drift'])for(const ending of ['renew','change'])for(const path of ['ledge','channel']){
  const s=structuredClone(site);Object.assign(s.events.cloudRift,{anchor,ending});s.events.riftBeacon.place=path;s.events.riftBeacon.surveys=[site.life.ageDays,site.life.ageDays];
  const rule=beaconNode(s,menu,choice).choices.find(c=>c.key==='beacon-enter').rule;
  const free=((anchor==='moor')!==(ending==='change'))===(path==='ledge');
  assert.deepEqual(rule.items,free?{}:{iron:1});
 }
});
test('the other entrance charges one iron and arrival on the fifth day uses the new wind',()=>{
 const opened=follow(completedRift(),'beacon-book','beacon-launch');
 const other=follow(opened,'beacon-ledge','beacon-survey','beacon-enter');
 assert.equal(other.lastReceipt.itemChanges.iron,-1);
 // One real cross-step before the survey puts the nominal arrival exactly at day five.
 let s=follow(opened,'beacon-ledge','beacon-channel','beacon-survey');
 const before=s.life.cultivationProfile.spirit;
 s=pick(s,'beacon-enter');assert.equal(s.lastReceipt.elapsedDays,3);assert.equal(s.life.cultivationProfile.spirit,before-4);
 assert.equal(s.life.ageDays-s.events.riftBeacon.start,6);
 const returned=follow(s,'beacon-read','beacon-exit','beacon-return');
 assert.equal(returned.lastReceipt.elapsedDays,3);assert.equal(returned.events.riftBeacon.place,'channel');
});
test('going back to cultivate changes the weather without erasing surveys or pretending to return instantly',()=>{
 let s=follow(completedRift(),'beacon-book','beacon-launch','beacon-channel','beacon-survey');
 assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:train-menu')));
 s=pick(s,'beacon-shore');assert.equal(s.lastReceipt.elapsedDays,1);const surveyed=s.events.riftBeacon.surveys[1];
 s=follow(s,'beacon-rest','train-menu','practice','train-menu');
 assert.match(journeyNotes(s).find(n=>n.node==='sky-beacon-book').timing,/已经变风/);
 const path=noteRoutes(s,journeyNotes(s)).get('sky-beacon-book');assert.ok(path);
 s=follow(s,...path,'beacon-channel','beacon-enter');
 assert.equal(s.lastReceipt.elapsedDays,3);assert.equal(s.events.riftBeacon.surveys[1],surveyed);
 s=follow(s,'beacon-slow','beacon-shore','beacon-rest','beacon-withdraw');
 assert.equal(s.events.riftBeacon.ending,'withdrawn');assert.equal(s.events.riftBeacon.read,null);
});
test('the invitation never starts a trip, and malformed dates or locations cannot pass the chapter validator',()=>{
 const before=completedRift();assert.ok(adventureLeads(before).some(n=>n.node==='sky-beacon-book'));
 const offer=pick(before,'beacon-book');assert.equal(offer.events.riftBeacon,undefined);assert.equal(offer.life.ageDays,before.life.ageDays);
 const s=follow(offer,'beacon-launch','beacon-channel','beacon-survey','beacon-enter','beacon-read');
 for(const mutate of [e=>e.riftBeacon.place='unknown',e=>e.riftBeacon.at--,e=>e.riftBeacon.surveys[1]=null,e=>e.riftBeacon.work='moor',e=>e.riftBeacon.ending='delivered',e=>e.node='training']){
  const e=structuredClone(s.events);mutate(e);assert.throws(()=>validateRiftBeacon(e,s.life));
 }
 // Isolated affordability boundary, not an invented native journey.
 const poor=structuredClone(s);poor.life.items.iron=0;poor.life.items.supplies=0;poor.life.cultivationProfile.spirit=0;
 const c=poor.currentScene.choices.find(c=>c.id.endsWith(':c:beacon-slow')),rule=eventActionRule(poor,c,v7ActionRule(poor,c));
 assert.equal(rule.reason,undefined);assert.equal(rule.spiritCost,0);assert.deepEqual(rule.items,{});assert.equal(rule.days,3);
});
test('a retreat before taking the paper remains resumable and reports only the surveyed side',()=>{
 let s=follow(completedRift(),'beacon-book','beacon-launch');
 assert.match(journeyNotes(s).find(n=>n.node==='sky-beacon-book').timing,/还有5日/);
 const ashore=structuredClone(s.events);ashore.riftBeacon.place='ledge';assert.throws(()=>validateRiftBeacon(ashore,s.life));
 s=follow(s,'beacon-channel','beacon-survey','beacon-enter');
 const invented=structuredClone(s.events);invented.riftBeacon.surveys[0]=s.life.ageDays;assert.throws(()=>validateRiftBeacon(invented,s.life));
 s=follow(s,'beacon-slow','beacon-shore','beacon-channel','beacon-enter','beacon-read');
 assert.match(s.currentScene.blocks.map(b=>b.text).join(''),/亲见的下层回流/);
 s=follow(s,'beacon-slow','beacon-shore','beacon-deliver');assert.equal(s.events.riftBeacon.ending,'delivered');
});
test('a lifespan boundary during return does not invent a completed movement or delivery',()=>{
 const s=follow(completedRift(),'beacon-book','beacon-launch','beacon-channel','beacon-survey','beacon-enter','beacon-read','beacon-exit');
 // Constructed lifespan boundary only. The full-life test separately reaches death by real actions.
 const near=structuredClone(s),age=near.life.lifeLimit*360-1;near.life.ageDays=age;
 near.lastReceipt.before.ageDays=age;near.lastReceipt.after.ageDays=age;
 const action=near.currentScene.choices.find(c=>c.id.endsWith(':c:beacon-slow'));
 const p=prepareChoice(near,{choiceId:action.id,requestId:'beacon-lifespan'});assert.equal(p.receipt.death.cause,'lifespan');
 const dead=settleDeath(near,p);assert.equal(dead.phase,'dead');assert.deepEqual(dead.events.riftBeacon,near.events.riftBeacon);assert.equal(dead.events.riftBeacon.ending,null);
});
test('cultivation warns about changed wind rather than an expired commission',()=>{
 const s=follow(completedRift(),'beacon-book','beacon-launch','beacon-rest','train-menu');
 const warning=crossingDeadlines(s,journeyNotes(s),5);
 assert.match(warning,/变风/);assert.doesNotMatch(warning,/回风孤标的期限/);
});
test('surveying both sides crosses the wind boundary but a resource-free retreat still completes the journey',()=>{
 let s=follow(completedRift(),'beacon-book','beacon-launch','beacon-ledge','beacon-survey','beacon-channel','beacon-survey');
 const spirit=s.life.cultivationProfile.spirit;s=pick(s,'beacon-enter');
 assert.equal(s.lastReceipt.elapsedDays,3);assert.equal(s.life.cultivationProfile.spirit,spirit-4);
 s=follow(s,'beacon-read','beacon-slow','beacon-shore','beacon-deliver');
 assert.ok(s.events.riftBeacon.surveys.every(d=>d!==null));assert.equal(s.events.riftBeacon.ending,'delivered');
});
