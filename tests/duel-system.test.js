import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,resolveRuleScene,commitTurn} from '../src/game/cultivation/live/engine.js';
import {validateGeneratedScene} from '../src/game/cultivation/live/schema.js';
import {adventureLeads,journeyNotes,noteRoutes} from '../src/game/cultivation/live/journey-notes.js';
import {DUEL_ENCOUNTERS} from '../src/game/cultivation/live/duel-encounters.js';

function startQiV2(seed = 42) {
 let s = createLiveGame({runId:'duel-test',engineVersion:7,originStories:true,eventVersion:2,seed,name:'沈渡'});
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

test('duel encounters cover all 9 realms from qi to mahayana with dialogue and distinct opponents', () => {
 assert.equal(DUEL_ENCOUNTERS.length, 9);
 const ids = new Set(DUEL_ENCOUNTERS.map(e => e.id));
 assert.equal(ids.size, 9);
 for (const enc of DUEL_ENCOUNTERS) {
  assert.ok(enc.name && enc.title && enc.location);
  assert.ok(enc.intents.length >= 3, `${enc.id} needs >= 3 tactical intents`);
  assert.ok(enc.intro.some(b => b.kind === 'dialogue'), `${enc.id} intro needs dialogue`);
  assert.ok(enc.victory.some(b => b.kind === 'dialogue'), `${enc.id} victory needs dialogue`);
 }
});

test('a qi cultivator can navigate to duel-book, fight a multi-round tactical duel, use tactics, and win real rewards', () => {
 let {state: s, choose} = startQiV2(42);
 const leads = adventureLeads(s);
 const duelLead = leads.find(l => l.node === 'duel-book');
 assert.ok(duelLead, 'adventureLeads should surface duel-book for v2 qi cultivator');
 const route = noteRoutes(s, [duelLead]).get('duel-book');
 assert.ok(route && route.length > 0, 'duel-book should be reachable via noteRoutes');
 for (const step of route) s = choose(s, step);
 assert.equal(s.events.node, 'duel-book');
 validateGeneratedScene(s.currentScene);

 // Enter first encounter (Zhao Hu)
 s = choose(s, 'duel-start');
 assert.equal(s.events.node, 'duel-arena');
 assert.ok(s.events.duels.active, 'duel should become active');
 assert.ok(journeyNotes(s).some(n => n.node === 'duel-arena'), 'active duel should appear in journeyNotes');

 // Check tactics submenu and return
 s = choose(s, 'duel-tactics');
 assert.equal(s.events.node, 'duel-tactics');
 validateGeneratedScene(s.currentScene);
 s = choose(s, 'duel-back-arena');
 assert.equal(s.events.node, 'duel-arena');

 // Fight tactically until victory
 let rounds = 0;
 while (s.events.node === 'duel-arena' && rounds < 20) {
  rounds++;
  const keys = s.currentScene.choices.map(c => c.id.split(':c:')[1]);
  if (keys.includes('duel-burst')) s = choose(s, 'duel-burst');
  else if (s.events.duels.active.foeHp <= 25 && keys.includes('duel-strike')) s = choose(s, 'duel-strike');
  else if (rounds % 2 === 1 && keys.includes('duel-defend')) s = choose(s, 'duel-defend');
  else s = choose(s, 'duel-strike');
  validateGeneratedScene(s.currentScene);
 }
 assert.equal(s.events.node, 'duel-victory', 'player should defeat first opponent through tactical play');
 assert.ok(s.events.duels.won.includes(DUEL_ENCOUNTERS[0].id));
 assert.equal(s.events.duels.active, null);
 assert.ok(s.life.items.stones > 0, 'victory should grant real loot');
});
