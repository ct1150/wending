import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,resolveRuleScene,compileChoices} from '../src/game/cultivation/live/engine.js';
import {V7_REALMS,v7ActionRule} from '../src/game/cultivation/live/cultivation-rules.js';
import {eventNode} from '../src/game/cultivation/live/event-content.js';
import {validateEventState} from '../src/game/cultivation/live/events.js';
import {adventureLeads} from '../src/game/cultivation/live/journey-notes.js';

function opening(){const s=createLiveGame({runId:'independent-crossing',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1}),p=prepareOpening(s,{requestId:'open'});return commitTurn(s,p,resolveRuleScene(s,p));}
function go(s,...keys){for(const key of keys){const c=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));assert.ok(c,key);const p=prepareChoice(s,{choiceId:c.id,requestId:'go-'+s.turnId});s=commitTurn(s,p,resolveRuleScene(s,p));}return s;}

test('a new independent life can inspect both world routes without accepting a commission or paying',()=>{
 const s=go(opening(),'decline','journey-menu','workshop-menu','crossing-menu');
 const viewed=go(s,'crossing-ways','crossing-preparation','crossing-menu');
 assert.deepEqual(viewed.life,s.life);assert.equal(viewed.rng,s.rng);assert.equal(viewed.events.convoy,undefined);
 const ways=go(viewed,'crossing-ways');
 const options=compileChoices(ways,ways.currentScene.choices);
 assert.equal(options.find(c=>c.approach==='ascend').enabled,false);
 assert.equal(options.find(c=>c.approach==='ancient-array').enabled,false);
 const prepare=go(ways,'crossing-preparation');
 const search=compileChoices(prepare,prepare.currentScene.choices).find(c=>c.intent==='explore');
 assert.equal(search.targetId,'skykey');assert.equal(search.enabled,false);
 assert.throws(()=>prepareChoice(prepare,{choiceId:search.id,requestId:'cannot-gather'}));
});

test('public ancient arrays retain lower existing gates and ascending materials follow the actual next world',()=>{
 const born=opening();
 for(const [tier,rank] of [[0,1],[0,2],[1,3],[1,4]]){
  // Rule-only boundary inputs; native storage walkthrough is separate.
  const s=structuredClone(born);s.currentScene=null;s.events.node='crossing-ways';s.life.cultivationProfile.worldTier=tier;
  s.events.entry='declined';
  s.life.realm=Object.values(V7_REALMS).find(r=>r.rank===rank).id;
  Object.assign(s.life.items,{array:1,stones:200,skykey:1,thunderseal:1});
  const definition=eventNode(s),array=definition.choices.find(c=>c.approach==='ancient-array'),ascend=definition.choices.find(c=>c.approach==='ascend');
  const rule=v7ActionRule(s,array);
  assert.equal(adventureLeads(s).some(n=>n.node==='crossing-ways'),rank===(tier?4:2));
  assert.equal(Boolean(rule.reason),rank===(tier?3:1));assert.deepEqual(rule.items,{array:1,stones:tier?90:45});
  assert.equal(rule.checkKind,'world-crossing');assert.ok(v7ActionRule(s,ascend).reason);
  s.events.node='crossing-preparation';assert.equal(eventNode(s).choices[0].targetId,tier?'thunderseal':'skykey');
 }
 for(const node of ['crossing-ways','crossing-preparation']){
  const s=structuredClone(born);s.events.node=node;s.life.cultivationProfile.worldTier=2;
  assert.throws(()=>validateEventState(s.events,s.life),/界域/);
 }
});
