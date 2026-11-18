import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene,compileChoices,settleDeath} from '../src/game/cultivation/live/engine.js';
import {validateHomebound} from '../src/game/cultivation/live/homebound.js';
import {eventActionRule} from '../src/game/cultivation/live/events.js';
import {v7ActionRule} from '../src/game/cultivation/live/cultivation-rules.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {noteRoutes} from '../src/game/cultivation/live/journey-notes.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/rift-beacon-combined-route.json',import.meta.url)));
function pick(s,key){
 const c=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));assert.ok(c,'missing '+key+' at '+s.events.node);
 const p=prepareChoice(s,{choiceId:c.id,requestId:'home-'+(s.turnId+1)});
 return commitTurn(s,p,resolveRuleScene(s,p));
}
const follow=(s,...keys)=>keys.reduce(pick,s);
function reach(s,node){const path=noteRoutes(s,[{node}]).get(node);assert.ok(path,'no route to '+node);return follow(s,...path);}
let cached,early;
function veteran(){
 if(!cached){let s=createLiveGame(fixture.config),p=prepareOpening(s,{requestId:'opening'});s=commitTurn(s,p,resolveRuleScene(s,p));
  for(const key of fixture.route){s=pick(s,key);if(!early&&s.life.realm==='spirit'&&s.life.cultivationProfile.worldTier===2&&s.events.node==='crossing'&&s.life.items.supplies)early=s;}
  for(const [item,count] of [['supplies',6],['iron',3]]){
   s=reach(s,'resources');while(!s.currentScene.choices.some(c=>c.id.endsWith(':c:gather')&&c.targetId===item))s=pick(s,'next-resource');
   for(let n=0;(s.life.items[item]??0)<count;n++){assert.ok(n<30);s=pick(s,n?'gather-again':'gather');}
  }
  s=pick(reach(s,'rest'),'recover');cached=reach(s,'crossing');
 }
 return cached;
}
function stage(s,choice){return follow(s,'home-depart','home-see-0','home-see-1','home-decide',choice,'home-return');}
test('a native veteran can carry one promise through all four voyages and return with an autonomous ship',()=>{
 const base=veteran();let s=follow(base,'harbor-book','home-book','home-ask','home-depart','home-see-0','home-see-1','home-decide','home-skiff','home-return');
 assert.equal(s.events.homebound.visits[0].choice,'skiff');assert.equal(s.events.homebound.place,'shore');
 s=stage(s,'home-open');s=stage(s,'home-channel');
 s=follow(s,'home-depart','home-see-0','home-see-1','home-decide','home-sail');
 assert.equal(s.events.homebound.ending,null,'ending requires actual return');
 s=pick(s,'home-return');assert.equal(s.events.homebound.ending,'sail');assert.equal(s.events.homebound.visits.length,4);
 assert.deepEqual(deserializeLiveState(serializeLiveState(s)),s);
 assert.deepEqual(s.events.cloudRift,base.events.cloudRift);assert.deepEqual(s.events.riftBeacon,base.events.riftBeacon);
});
test('a restoration promise and sealed cabins change available final choices and can be explicitly released',()=>{
 let s=follow(veteran(),'harbor-book','home-book','home-restore','home-depart','home-see-0','home-decide','home-hull','home-return');
 s=stage(s,'home-seal');s=stage(s,'home-harbor');s=follow(s,'home-depart','home-decide');
 assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:home-sail')));
 s=pick(s,'home-unseal');assert.equal(s.lastReceipt.elapsedDays,2);
 assert.equal(s.events.homebound.released,true);
 s=follow(s,'home-decide','home-sail','home-return');assert.equal(s.events.homebound.ending,'sail');
 assert.ok(compileChoices(s,s.currentScene.choices).every(c=>c.enabled));
});
test('one broken restoration promise really removes the spirit assistance on the third voyage',()=>{
 const third=pledge=>{
  let s=follow(veteran(),'harbor-book','home-book','home-'+pledge,'home-depart','home-see-1','home-decide','home-skiff','home-return');
  s=stage(s,'home-open');return follow(s,'home-depart','home-decide');
 };
 const kept=pick(third('ask'),'home-channel'),broken=pick(third('restore'),'home-channel');
 assert.equal(kept.lastReceipt.elapsedDays,3);assert.equal(broken.lastReceipt.elapsedDays,3);
 assert.equal(kept.lastReceipt.before.cultivationProfile.spirit-kept.life.cultivationProfile.spirit,0);
 assert.equal(broken.lastReceipt.before.cultivationProfile.spirit-broken.life.cultivationProfile.spirit,4);
 assert.match(broken.currentScene.blocks.map(b=>b.text).join(''),/舵|航/);
});
test('departure, free retreat and explicit withdrawal cannot reset a surveyed voyage',()=>{
 let s=follow(veteran(),'harbor-book','home-book','home-ask');const promised=s;
 assert.equal(s.events.homebound.visits.length,0);
 s=follow(s,'home-depart','home-see-0','home-decide','home-leave');const aboard=s;
 const poor=structuredClone(s);poor.life.items.supplies=0;poor.life.cultivationProfile.spirit=0;
 const c=poor.currentScene.choices.find(c=>c.id.endsWith(':c:home-retreat')),rule=eventActionRule(poor,c,v7ActionRule(poor,c));
 assert.equal(rule.reason,undefined);assert.deepEqual(rule.items,{});assert.equal(rule.spiritCost,0);
 s=pick(s,'home-retreat');const seen=s.events.homebound.visits[0].seen;
 s=pick(s,'home-depart');assert.equal(s.events.homebound.visits[0].seen,seen);assert.equal(s.events.homebound.visits[0].start,aboard.events.homebound.visits[0].start);
 assert.equal(s.life.items.supplies,promised.life.items.supplies-2);
 s=follow(s,'home-decide','home-leave','home-retreat','home-leave','home-withdraw');
 assert.equal(s.events.homebound.ending,'withdrawn');assert.equal(s.events.homebound.visits[0].done,null);
});
test('all final destinations can be chosen without inventing a completed return',()=>{
 let s=follow(veteran(),'harbor-book','home-book','home-ask','home-depart','home-decide','home-skiff','home-return');
 s=stage(s,'home-open');s=stage(s,'home-channel');s=follow(s,'home-depart','home-decide');
 for(const end of ['moor','sail','release']){
  const before=end==='release'?pick(s,'home-final'):s,chosen=pick(before,'home-'+end);
  assert.equal(chosen.events.homebound.ending,null);
  const returned=pick(chosen,'home-return');assert.equal(returned.events.homebound.ending,end);
  assert.equal(returned.events.homebound.ended,returned.life.ageDays);
  const unclosed=structuredClone(returned.events);unclosed.homebound.ending=null;unclosed.homebound.ended=null;assert.throws(()=>validateHomebound(unclosed,returned.life));
 }
});
test('malformed histories and a lifespan interrupt cannot fabricate return or promotion',()=>{
 const s=follow(veteran(),'harbor-book','home-book','home-ask','home-depart','home-decide','home-skiff');
 for(const mutate of [h=>h.at=-1,h=>h.visits[0].seen=9,h=>h.visits[0].choice='channel',h=>h.visits[0].done=h.at,h=>h.released=true,h=>h.ending='sail']){
  const e=structuredClone(s.events);mutate(e.homebound);assert.throws(()=>validateHomebound(e,s.life));
 }
 const tooFast=structuredClone(s.events);tooFast.homebound.visits[0].decided=tooFast.homebound.visits[0].start+1;assert.throws(()=>validateHomebound(tooFast,s.life));
 const e=structuredClone(s.events);e.node='training';assert.throws(()=>validateHomebound(e,s.life));
 const near=structuredClone(s),age=near.life.lifeLimit*360-1;near.life.ageDays=age;near.lastReceipt.before.ageDays=age-near.lastReceipt.elapsedDays;near.lastReceipt.after.ageDays=age;
 const c=near.currentScene.choices.find(c=>c.id.endsWith(':c:home-return')),p=prepareChoice(near,{choiceId:c.id,requestId:'home-lifespan'});
 assert.equal(p.receipt.death.cause,'lifespan');assert.deepEqual(settleDeath(near,p).events.homebound,near.events.homebound);
});
test('a native spirit-stage visitor must continue cultivation before the second voyage',()=>{
 veteran();assert.ok(early,'native spirit-stage crossing');
 let s=follow(early,'harbor-book','home-book','home-ask','home-depart','home-see-1','home-decide','home-skiff','home-return');
 assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:home-depart')));assert.match(s.currentScene.blocks.map(b=>b.text).join(''),/炼虚/);
 const e=structuredClone(s.events);e.homebound.visits.push({start:s.life.ageDays,seen:0,choice:null,decided:null,done:null});assert.throws(()=>validateHomebound(e,s.life));
});
