import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,prepareRecordedChoice,resolveRuleScene,commitTurn} from '../src/game/cultivation/live/engine.js';
import {validateGeneratedScene} from '../src/game/cultivation/live/schema.js';
import {validateLiveState} from '../src/game/cultivation/live/validation.js';
import {stateHash,canonicalStringify} from '../src/game/cultivation/live/identity.js';
import {adventureLeads,noteRoutes} from '../src/game/cultivation/live/journey-notes.js';
import {CAMPAIGN_CHAPTERS,DING_CHAPTER} from '../src/game/cultivation/live/campaign-chapters.js';
import {DUEL_ENCOUNTERS} from '../src/game/cultivation/live/duel-encounters.js';
import {BOND_CHARACTERS} from '../src/game/cultivation/live/bonds.js';
import {SECRET_REALMS} from '../src/game/cultivation/live/secret-realms.js';
import {WORLD_TALES} from '../src/game/cultivation/live/world-tales.js';

function playV2Session() {
 const birth = createLiveGame({runId:'v2-e2e-full',engineVersion:7,originStories:true,eventVersion:2,seed:2026,name:'江临'});
 let s = structuredClone(birth);
 const entries = [];

 const open = prepareOpening(s,{requestId:'open'});
 const openScene = resolveRuleScene(s,open);
 s = commitTurn(s,open,openScene);
 validateLiveState(s);
 entries.push({pending:open,scene:openScene,hash:stateHash(s)});

 const choose = (key) => {
  const c = s.currentScene.choices.find(x => x.id.endsWith(':c:' + key));
  assert.ok(c, `missing choice ${key} at ${s.events.node}`);
  const turn = prepareChoice(s,{requestId:`t-${s.turnId}`,choiceId:c.id});
  const scene = resolveRuleScene(s,turn);
  validateGeneratedScene(scene);
  s = commitTurn(s,turn,scene);
  validateLiveState(s);
  entries.push({pending:turn,scene,hash:stateHash(s)});
  return s;
 };

 const goTo = (targetNode) => {
  const route = noteRoutes(s, [{node:targetNode}]).get(targetNode);
  assert.ok(route, `cannot route from ${s.events.node} to ${targetNode}`);
  for (const step of route) choose(step);
  assert.equal(s.events.node, targetNode);
 };

 // 1. New prologue with optional stele + talk
 choose('visit-stele');
 choose('leave-village');
 choose('ask-terms');
 choose('join-gate');
 choose('talk-linyan');
 choose('work-bank');
 choose('save-canal');
 while (s.life.realm === 'mortal') {
  if (s.events.node === 'prologue-result') choose('try-again');
  else if (s.currentScene.choices.some(c => c.id.endsWith(':c:first-breakthrough'))) choose('first-breakthrough');
  else if (s.currentScene.choices.some(c => c.id.endsWith(':c:restore-copy'))) choose('restore-copy');
  else choose('settle-breath');
 }
 choose('take-help');
 choose('chapter-out');

 // 2. Mainline chapter 1 + result + epilogue
 goTo('campaign-book');
 choose('campaign-act');
 choose('campaign-public');
 assert.equal(s.events.node, 'campaign-result');
 choose('campaign-epilogue');
 assert.equal(s.events.node, 'campaign-epilogue');
 choose('back');

 // 3. Tactical Duel (beat Zhao Hu)
 goTo('duel-book');
 choose('duel-start');
 let guard = 0;
 while (s.events.node === 'duel-arena' && guard++ < 25) {
  const keys = s.currentScene.choices.map(c => c.id.split(':c:')[1]);
  if (keys.includes('duel-burst')) choose('duel-burst');
  else if (s.events.duels.active.telegraph === 1 && keys.includes('duel-defend')) choose('duel-defend');
  else choose('duel-strike');
 }
 assert.equal(s.events.node, 'duel-victory');
 assert.ok(s.events.duels.won.includes('zhao-hu'));
 choose('back');

 // 4. Character Bond (Lin Yan Act 1 with deep talk)
 goTo('bonds-book');
 choose('bond-open');
 choose('bond-talk');
 choose('bond-decide-menu');
 choose('bond-pick-0');
 assert.equal(s.events.node, 'bond-result');
 assert.equal(s.events.bonds.linyan.stage, 1);
 choose('back');

 // 5. Secret Realm Investigation (all 3 clues + NPC interrogation + confront -> True Ending)
 goTo('realm-book');
 choose('realm-enter');
 choose('realm-search');
 choose('realm-map');
 choose('realm-go-1');
 choose('realm-search');
 choose('realm-map');
 choose('realm-go-2');
 choose('realm-search');
 choose('realm-npc');
 choose('realm-npc-trust');
 choose('realm-map');
 choose('realm-go-3');
 choose('realm-climax');
 choose('realm-end-2');
 assert.equal(s.events.node, 'realm-result');
 assert.equal(s.events.realms.done[SECRET_REALMS[0].id], '2');
 choose('back');

 // 6. World Tale
 goTo('tale-book');
 choose('tale-open');
 choose('tale-pick-0');
 assert.equal(s.events.node, 'tale-result');
 assert.equal(Object.keys(s.events.tales).length, 1);

 return {birth, state: s, entries};
}

test('full v2 playthrough spans all 6 systems and deterministically replays from birth with identical scene & stateHash', () => {
 const {birth, state, entries} = playV2Session();
 assert.ok(entries.length >= 35, `expected rich multi-system session, got ${entries.length} turns`);

 // Deterministic archive replay from birth snapshot (exact check performed by live-archive import)
 let replay = structuredClone(birth);
 for (const entry of entries) {
  const expectedPending = entry.pending.kind === 'opening'
   ? prepareOpening(replay, {requestId: entry.pending.identity.requestId})
   : prepareRecordedChoice(replay, entry.pending);
  assert.equal(canonicalStringify(expectedPending), canonicalStringify(entry.pending));
  const expectedScene = resolveRuleScene(replay, expectedPending);
  assert.equal(canonicalStringify(expectedScene), canonicalStringify(entry.scene));
  replay = commitTurn(replay, expectedPending, expectedScene);
  validateLiveState(replay);
  assert.equal(stateHash(replay), entry.hash);
 }
 assert.equal(stateHash(replay), stateHash(state));
 assert.equal(replay.events.duels.won.length, 1);
 assert.equal(replay.events.bonds.linyan.stage, 1);
 assert.equal(replay.events.realms.done[SECRET_REALMS[0].id], '2');
 assert.equal(Object.keys(replay.events.tales).length, 1);
});

test('v2 content catalog reaches 20+ hour structural scale across all narrative and gameplay pillars', (t) => {
 assert.equal(CAMPAIGN_CHAPTERS.length, 8);
 assert.equal(DUEL_ENCOUNTERS.length, 9);
 assert.equal(BOND_CHARACTERS.length, 6);
 assert.equal(BOND_CHARACTERS.reduce((n, c) => n + c.acts.length, 0), 30);
 assert.equal(SECRET_REALMS.length, 8);
 assert.equal(WORLD_TALES.length, 24);

 const countHan = obj => (JSON.stringify(obj).match(/[\u4e00-\u9fff]/g) || []).length;
 const totals = {
  campaign: countHan(CAMPAIGN_CHAPTERS) + countHan(DING_CHAPTER),
  duels: countHan(DUEL_ENCOUNTERS),
  bonds: countHan(BOND_CHARACTERS),
  realms: countHan(SECRET_REALMS),
  tales: countHan(WORLD_TALES),
 };
 const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
 t.diagnostic('Authored V2 Han char totals: ' + JSON.stringify({...totals, grandTotal}));
 assert.ok(grandTotal >= 76000, `expected >= 76,000 Han chars of authored v2 content, got ${grandTotal} (${JSON.stringify(totals)})`);
});

test('v1 classic game remains 100% isolated from v2 polish and v2 systems', () => {
 let s = createLiveGame({runId:'v1-isolation-check',engineVersion:7,originStories:true,eventVersion:1,seed:7,name:'古人'});
 const open = prepareOpening(s,{requestId:'open'});
 s = commitTurn(s,open,resolveRuleScene(s,open));
 assert.equal(s.events.version, 1);
 assert.equal(s.events.node, 'arrival');
 const leads = adventureLeads(s);
 assert.equal(leads.length, 0);
 const decline = s.currentScene.choices.find(c => c.id.endsWith(':c:decline'));
 const t1 = prepareChoice(s,{requestId:'t1',choiceId:decline.id});
 s = commitTurn(s,t1,resolveRuleScene(s,t1));
 assert.equal(s.events.node, 'hub');
 // v1 hub must preserve original text verbatim for archive hash compatibility
 assert.match(s.currentScene.blocks.map(b => b.text).join('\n'), /没有变成必须偿还的债/);
});
