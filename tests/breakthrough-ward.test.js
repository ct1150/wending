import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame} from '../src/game/cultivation/live/engine.js';
import {V7_REALMS,nextRealmFor,v7ActionRule,resolveV7Action,lifespanLimitFor,maximumSpiritFor} from '../src/game/cultivation/live/cultivation-rules.js';
import {eventNode} from '../src/game/cultivation/live/event-content.js';
import {eventActionRule,validateEventState} from '../src/game/cultivation/live/events.js';
import {sha256} from '../src/game/cultivation/live/identity.js';
import {DAYS_PER_YEAR} from '../src/game/cultivation/live/model.js';

// Deliberately constructed rule boundaries, not native gameplay evidence.
function boundary(rank=6){
 const s=createLiveGame({runId:'ward-boundary',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1});
 s.life.realm=Object.values(V7_REALMS).find(r=>r.rank===rank).id;
 s.life.lifeLimit=lifespanLimitFor(s.life);s.life.cultivation=nextRealmFor(s.life)?.threshold??999;
 s.life.items={...s.life.items,array:1,artifact:1,[nextRealmFor(s.life)?.material??'stones']:1};
 s.life.cultivationProfile.maxSpirit=maximumSpiritFor(s.life);s.life.cultivationProfile.spirit=s.life.cultivationProfile.maxSpirit;
 s.events.node='breakthrough-ward';s.currentScene=null;
 return s;
}
function rules(s){
 const c=eventNode(s).choices.find(c=>c.key==='guarded-breakthrough');
 assert.ok(c,'guarded breakthrough should be offered');
 const action={...c,id:'r:'+sha256(s.runId).slice(0,16)+':t'+s.turnId+':c:'+c.key};
 const plain=v7ActionRule(s,action),ward=eventActionRule(s,action,plain);
 return {action,plain,ward};
}
test('a paid ward preserves ordinary breakthrough costs and success, but stops only lethal backlash',()=>{
 for(const rank of [6,7,8]){
  const s=boundary(rank),{action,plain,ward}=rules(s),next=nextRealmFor(s.life);
  assert.equal(ward.days,plain.days);assert.equal(ward.chance,plain.chance);assert.equal(ward.spiritCost,plain.spiritCost+12);
  assert.deepEqual(ward.items,{...plain.items,array:1,artifact:1});assert.equal(plain.breakthroughWard,undefined);
  assert.equal(ward.reason,undefined);
  for(const roll of [98,99]){
   // Pin the failure branch even for a life whose ordinary chance is 99.
   const normal=resolveV7Action(s.life,action,{...plain,chance:70},roll,2);
   const guarded=resolveV7Action(s.life,action,{...ward,chance:70},roll,2);
   assert.equal(normal.death.cause,'injury');assert.equal(guarded.death,null);
   assert.equal(guarded.nextLife.injury,2);assert.equal(guarded.nextLife.realm,s.life.realm);
   assert.equal(guarded.nextLife.cultivation,s.life.cultivation-Math.ceil(next.threshold/2));
   assert.equal(guarded.nextLife.items.array,0);assert.equal(guarded.nextLife.items.artifact,0);
   assert.equal(guarded.nextLife.items[next.material],0);assert.equal(guarded.elapsedDays,plain.days);
   assert.equal(guarded.nextLife.cultivationProfile.spirit,s.life.cultivationProfile.spirit-ward.spiritCost);
  }
  const win=resolveV7Action(s.life,action,ward,0,2);
  assert.equal(win.nextLife.realm,next.id);assert.equal(win.nextLife.items.array,0);assert.equal(win.nextLife.items.artifact,0);
  assert.equal(win.nextLife.cultivation,s.life.cultivation-next.threshold);
  assert.equal(resolveV7Action(s.life,action,{...plain,chance:99},98,2).nextLife.realm,next.id);
  assert.equal(resolveV7Action(s.life,action,{...ward,chance:99},98,2).nextLife.realm,next.id);
  s.life.ageDays=s.life.lifeLimit*DAYS_PER_YEAR-1;
  assert.equal(rules(s).ward.warnings.filter(w=>w.includes('途中寿尽')).length,1);
  const aged=resolveV7Action(s.life,action,ward,0,2);
  assert.equal(aged.death.cause,'lifespan');assert.equal(aged.elapsedDays,1);assert.equal(aged.nextLife.realm,s.life.realm);
 }
});
test('ward retains all ordinary gates and requires its own consumables and spirit',()=>{
 for(const [change,reason] of [
  [s=>s.life.cultivation=0,/修为/],[s=>s.life.injury=2,/伤势/],
  [s=>s.life.items[nextRealmFor(s.life).material]=0,/缺少/],
  [s=>s.life.items.array=0,/阵盘/],[s=>s.life.items.artifact=0,/法器/],
  [s=>s.life.cultivationProfile.spirit=60,/灵力/],
 ]){const s=boundary();change(s);assert.match(rules(s).ward.reason,reason);}
 assert.throws(()=>validateEventState(boundary(5).events,boundary(5).life),/护阵/);
 assert.throws(()=>validateEventState(boundary(9).events,boundary(9).life),/护阵/);
});
test('guard entrance replaces only ready late training and preserves genuine historical menus',()=>{
 const s=boundary();s.events.node='training';
 assert.ok(eventNode(s).choices.some(c=>c.key==='ward-book'));
 assert.ok(eventNode(s,'ward').choices.some(c=>c.key==='practice'));
 s.currentScene={id:'r:test:t'+s.turnId+':s:event_training',choices:[{id:'old:c:practice'}]};
 assert.ok(eventNode(s).choices.some(c=>c.key==='practice'));
 s.currentScene=null;s.life.cultivation=0;
 assert.ok(!eventNode(s).choices.some(c=>c.key==='ward-book'));
 const lower=boundary(5);lower.events.node='training';
 assert.ok(!eventNode(lower).choices.some(c=>c.key==='ward-book'));
 s.life.cultivation=nextRealmFor(s.life).threshold;
 for(const pending of [{garden:{plot:{}}},{mountain:{walk:[],wind:{ending:null}}},{mountain:{walk:[{},{},{},{},{exit:'echo'}]}}]){
  const ready={...s,events:{...s.events,...pending}};
  assert.equal(eventNode(ready).choices[0].key,'ward-book');
  assert.ok(['garden-book','mount-book'].includes(eventNode(ready,'ward').choices[0].key));
  ready.events.node='breakthrough-preparation';
  assert.ok(['garden-book','mount-book'].includes(eventNode(ready).choices[0].key));
 }
 s.events.node='breakthrough-ward';
 assert.ok(eventNode(s).choices.some(c=>c.key==='ward-preparation'));
 s.events.node='breakthrough-preparation';
 const steady=eventNode(s).choices.find(c=>c.key==='practice');
 assert.equal(steady.approach,'steady');assert.equal(steady.rule,undefined);
});
