import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as engine from '../src/game/cultivation/live/engine.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {validateCloudTrials} from '../src/game/cultivation/live/cloud-trial.js';
import {eventActionRule} from '../src/game/cultivation/live/events.js';

function pick(s,key){
 const c=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));assert.ok(c,'missing '+key+' in '+s.currentScene.title);
 const p=engine.prepareChoice(s,{choiceId:c.id,requestId:'trial-'+(s.turnId+1)});
 return p.receipt.death?engine.settleDeath(s,p):engine.commitTurn(s,p,engine.resolveRuleScene(s,p));
}
const follow=(s,...keys)=>keys.reduce(pick,s);
let base;
function firstTrial(){
 if(!base){
  const s=engine.createLiveGame({runId:'river-reader',seed:42,name:'沈渡',engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1});
  const p=engine.prepareOpening(s,{requestId:'opening'});
  base=JSON.parse(readFileSync(new URL('./fixtures/21e6acc-cloud-route.json',import.meta.url))).route.reduce(pick,engine.commitTurn(s,p,engine.resolveRuleScene(s,p)));
 }
 return follow(base,'sky-trial','trial-accept','trial-boat','trial-shore');
}

test('a real cloud trial has room for one group, with a separate paid handover for the other',()=>{
 let s=firstTrial(),before=structuredClone(s.life);
 s=pick(s,'trial-locals');
 assert.equal(s.life.ageDays-before.ageDays,2);assert.equal(s.life.items.supplies,before.items.supplies-1);
 assert.equal(s.events.cloudTrials[0].priority,'locals');assert.equal(s.events.cloudTrials[0].method,null);
 assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:trial-learners')));
 s=pick(s,'trial-arrange');
 assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:trial-relay')));
 before=structuredClone(s.life);s=pick(s,'trial-teach');
 assert.equal(s.life.ageDays-before.ageDays,3);assert.equal(s.life.cultivationProfile.spirit,before.cultivationProfile.spirit-4);
 assert.match(s.currentScene.blocks.map(b=>b.text).join(''),/已另留三日/);
 s=pick(s,'trial-relay');assert.equal(s.events.cloudTrials[0].method,'signal');
 assert.deepEqual(deserializeLiveState(serializeLiveState(s)).events,s.events);
 const ended=s.events.cloudTrials[0];s=follow(s,'sky-book','sky-trial');
 assert.deepEqual(s.events.cloudTrials[0],ended);assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:trial-accept')));
});

test('teaching first enables delegation, while returning the duty is an explicit different ending',()=>{
 let s=follow(firstTrial(),'trial-learners','trial-arrange');
 assert.ok(s.currentScene.choices.some(c=>c.id.endsWith(':c:trial-relay')));
 const before=structuredClone(s.life);s=pick(s,'trial-release');
 assert.equal(s.events.cloudTrials[0].method,'released');assert.deepEqual(s.life,before);
 assert.match(s.currentScene.blocks.map(b=>b.text).join(''),/常班/);
});

test('trial validation rejects unpaid or out of order outcomes and empty stores block departure',()=>{
 const s=firstTrial(),action=s.currentScene.choices.find(c=>c.id.endsWith(':c:trial-locals'));
 const empty=structuredClone(s);empty.life.items.supplies=0;
 assert.match(eventActionRule(empty,action,{}).reason,/行粮/);
 empty.life.items.supplies=1;empty.life.cultivationProfile.spirit=0;
 assert.match(eventActionRule(empty,action,{}).reason,/灵力/);
 const underway=pick(s,'trial-locals');
 for(const change of [{sailed:0},{marks:1},{trained:underway.life.ageDays},{method:'signal',finished:underway.life.ageDays},{refuge:'moor'},{stage:2}]){
  const e=structuredClone(underway.events);Object.assign(e.cloudTrials[0],change);
  assert.throws(()=>validateCloudTrials(e,underway.life));
 }
 const duplicate=structuredClone(underway.events);duplicate.cloudTrials.push({...duplicate.cloudTrials[0]});
 assert.throws(()=>validateCloudTrials(duplicate,underway.life));
 // Explicit validation-only boundary: consecutive acceptance still takes one day.
 const boundary=structuredClone(underway.events),first=boundary.cloudTrials[0];
 first.method='return';first.finished=first.sailed+2;
 boundary.cloudPassage.push({seat:0,route:1});
 boundary.cloudTrials.push({stage:1,start:first.finished,marks:0,priority:null,sailed:null,trained:null,finished:null,method:null,refuge:null});
 assert.throws(()=>validateCloudTrials(boundary),/次序/);
});
