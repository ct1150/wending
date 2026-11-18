import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene} from '../src/game/cultivation/live/engine.js';
import * as notes from '../src/game/cultivation/live/journey-notes.js';
import {eventNode} from '../src/game/cultivation/live/event-content.js';

function born(){const s=createLiveGame({runId:'preparation',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1});const p=prepareOpening(s,{requestId:'opening'});return commitTurn(s,p,resolveRuleScene(s,p));}
function pick(s,key){const c=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));assert.ok(c,key);const p=prepareChoice(s,{choiceId:c.id,requestId:'step-'+s.turnId});return commitTurn(s,p,resolveRuleScene(s,p));}
function settled(){return ['ask','accept','finish-work','continue'].reduce(pick,born());}

test('each supply and recipe has its own safe route without spending or making a promise',()=>{
 assert.equal(typeof notes.preparationStops,'function');
 const s=settled(),stops=notes.preparationStops(s),routes=notes.noteRoutes(s,stops);
 assert.equal(stops.length,10);assert.equal(routes.size,10);
 for(const stop of stops){
  const after=routes.get(stop.id).reduce(pick,s),action=eventNode(after).choices[0];
  assert.equal(action.targetId,stop.item);assert.equal(after.events.node,stop.node);assert.equal(after.events.page,stop.page);
  assert.deepEqual(after.life,s.life);assert.equal(after.rng,s.rng);
  assert.deepEqual({...after.events,node:s.events.node,page:s.events.page},s.events);
  assert.deepEqual(notes.noteRoutes(after,[stop]).get(stop.id),[]);
 }
 assert.equal(stops.find(x=>x.id==='recipe-array').page,3);
 assert.equal(stops.find(x=>x.id==='resource-iron').page,4);
 assert.ok(notes.noteRoutes(s,[{node:'resources'}]).get('resources'));
});

test('unresolved entry and dead lives have no preparation directory; destinations cannot bypass a decision',()=>{
 assert.equal(typeof notes.preparationStops,'function');
 assert.deepEqual(notes.preparationStops(born()),[]);
 const s=settled();assert.deepEqual(notes.preparationStops({...s,phase:'dead'}),[]);
 const blocked=['journey-menu','river-book','river-open','deliberate'].reduce(pick,s);
 assert.equal(notes.noteRoutes(blocked,notes.preparationStops(blocked)).size,0);
});

test('an existing zero-cost leave path may postpone a conversation without answering it',()=>{
 const s=['ask','accept','finish-work','companion'].reduce(pick,born());
 const stop=notes.preparationStops(s).find(n=>n.id==='recipe-array'),path=notes.noteRoutes(s,[stop]).get(stop.id);
 assert.equal(path[0],'leave-companion');const after=path.reduce(pick,s);
 assert.equal(after.events.companion,'unmet');assert.deepEqual(after.life,s.life);assert.equal(after.rng,s.rng);
 assert.deepEqual({...after.events,node:s.events.node,page:s.events.page},s.events);
});
