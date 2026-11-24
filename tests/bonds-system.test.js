import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,resolveRuleScene,commitTurn} from '../src/game/cultivation/live/engine.js';
import {validateGeneratedScene} from '../src/game/cultivation/live/schema.js';
import {adventureLeads,noteRoutes} from '../src/game/cultivation/live/journey-notes.js';
import {BOND_CHARACTERS} from '../src/game/cultivation/live/bonds.js';

function startQiV2(seed = 42) {
 let s = createLiveGame({runId:'bonds-test',engineVersion:7,originStories:true,eventVersion:2,seed,name:'沈渡'});
 const open = prepareOpening(s,{requestId:'open'});
 s = commitTurn(s,open,resolveRuleScene(s,open));
 const choose = (st, key) => {
  const c = st.currentScene.choices.find(x => x.id.endsWith(':c:' + key));
  assert.ok(c, `missing ${key} at ${st.events.node}`);
  const turn = prepareChoice(st,{requestId:`t-${st.turnId}`,choiceId:c.id});
  return commitTurn(st,turn,resolveRuleScene(st,turn));
 };
 s = choose(s,'leave-village');
 s = choose(s,'join-gate');
 s = choose(s,'work-bank');
 s = choose(s,'save-canal');
 while (s.life.realm === 'mortal') {
  if (s.events.node === 'prologue-result') s = choose(s,'try-again');
  else if (s.currentScene.choices.some(c => c.id.endsWith(':c:first-breakthrough'))) s = choose(s,'first-breakthrough');
  else if (s.currentScene.choices.some(c => c.id.endsWith(':c:restore-copy'))) s = choose(s,'restore-copy');
  else s = choose(s,'settle-breath');
 }
 s = choose(s,'take-help');
 s = choose(s,'chapter-out');
 return {state: s, choose};
}

test('bonds catalog defines 6 core characters with 5 deep dialogue acts each and zero AI clichés', () => {
 assert.equal(BOND_CHARACTERS.length, 6);
 let totalHan = 0;
 for (const ch of BOND_CHARACTERS) {
  assert.equal(ch.acts.length, 5, `${ch.id} should have 5 acts`);
  for (const act of ch.acts) {
   assert.ok(act.blocks.some(b => b.kind === 'dialogue'), `${ch.id}:${act.title} needs dialogue`);
   assert.ok(act.deepTalk.some(b => b.kind === 'dialogue'), `${ch.id}:${act.title} deepTalk needs dialogue`);
   assert.equal(act.choices.length, 2);
   const allText = [
    ...act.blocks.map(b => b.text),
    ...act.deepTalk.map(b => b.text),
    ...act.choices.flatMap(c => [c.label, c.result]),
   ].join('\n');
   assert.doesNotMatch(allText, /不会添修为|没有额外惩罚|读信不算答应|不发修为或宝物|不替故人写下死讯/);
   totalHan += (allText.match(/[\u4e00-\u9fff]/g) || []).length;
  }
 }
 assert.ok(totalHan >= 18000, `bonds should provide substantial literary volume, got ${totalHan}`);
});

test('a v2 qi cultivator can reach bonds-book, deep-talk with Lin Yan, make a lasting choice, and preserve route state', () => {
 let {state: s, choose} = startQiV2(42);
 const lead = adventureLeads(s).find(l => l.node === 'bonds-book');
 assert.ok(lead, 'adventureLeads should surface bonds-book for v2 cultivator');
 const route = noteRoutes(s, [lead]).get('bonds-book');
 assert.ok(route && route.length > 0, 'bonds-book should be reachable via noteRoutes');
 for (const step of route) s = choose(s, step);
 assert.equal(s.events.node, 'bonds-book');
 validateGeneratedScene(s.currentScene);

 // Enter Lin Yan's first act
 s = choose(s, 'bond-open');
 assert.equal(s.events.node, 'bond-act');
 validateGeneratedScene(s.currentScene);
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'));

 // Deep talk first
 s = choose(s, 'bond-talk');
 assert.equal(s.events.node, 'bond-talk');
 validateGeneratedScene(s.currentScene);
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'));

 // Go to decision and pick option 0
 s = choose(s, 'bond-decide-menu');
 assert.equal(s.events.node, 'bond-decide');
 s = choose(s, 'bond-pick-0');
 assert.equal(s.events.node, 'bond-result');
 validateGeneratedScene(s.currentScene);
 assert.equal(s.events.bonds.linyan.stage, 1);
 assert.equal(s.events.bonds.linyan.route, '0');
});
