import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { createGame, act, combatAction, equipItem, getStats, deserialize } from '../src/game/engine.js';
import { SAVE_KEY, loadFromStorage, saveToStorage } from '../src/game/persistence.js';
import { evidenceVictory, limitedVictory, clinic, ash, netherLimited, personal } from './helpers/journey-routes.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';

function command(state, choiceId) {
  const view = getJourneyView(state);
  return { revision: view.revision, sceneId: view.sceneId, choiceId };
}
function legacyStates() {
  const start = createGame({ seed: '5' });
  const event = act(start, { type: 'explore' });
  const prepared = structuredClone(start);
  prepared.run.realmIndex = 5; prepared.run.hp = getStats(prepared).maxHp;
  const combat = act(prepared, { type: 'challenge', challengeId: 'mortal-proof' });
  const ended = act(start, { type: 'retire' });
  const ready = structuredClone(prepared);
  ready.meta.proofs = ['mortal', 'nether', 'celestial']; ready.run.worldId = 'celestial';
  ready.run.items.push('star-sword-art', 'burning-star', 'ashen-sheath');
  let winner = equipItem(equipItem(equipItem(ready, 'star-sword-art'), 'burning-star', 1), 'ashen-sheath');
  winner = act(winner, { type: 'finale' });
  while (winner.phase === 'combat') winner = combatAction(winner, 'burn');
  assert.equal(event.phase, 'event'); assert.equal(combat.phase, 'combat'); assert.equal(winner.phase, 'victory');
  return [start, event, combat, ended, winner];
}
function asV1(state) {
  const old = structuredClone(state);
  old.version = 1; delete old.story; delete old.meta.storyWorld;
  return old;
}

test('v3 representative public campaign routes preserve state, choices, next results and RNG across reload', () => {
  let visited = 0, randomized = false, ended = false, victory = false;
  const routes = [evidenceVictory, limitedVictory, [...clinic.slice(0, -1), 'keep-watch'], [...ash, ...netherLimited.slice(0, -1), 'leave-dispute', ...personal, 'withdraw-ding', 'repair-nether', 'reconsider-ding', 'shared-method', 'separate-fire', 'share-stop-right', 'finish-season']];
  for (const seed of [4, '谷口']) for (const route of routes) {
    let state = createJourney({ seed });
    for (const choiceId of [...route, null]) {
      const before = JSON.stringify(state), restored = deserializeGame(serializeGame(state));
      visited++; ended ||= restored.phase === 'ended'; victory ||= restored.phase === 'victory';
      assert.deepEqual(restored, state);
      assert.deepEqual(getJourneyView(restored), getJourneyView(state));
      // Check every available next transaction at each selected representative
      // boundary; do not recursively enumerate its descendants or histories.
      for (const choice of getJourneyView(state).choices) {
        const cmd = command(state, choice.id);
        const originalNext = chooseJourney(state, cmd), restoredNext = chooseJourney(restored, cmd);
        assert.deepEqual(restoredNext, originalNext);
        assert.equal(restoredNext.state.rng, originalNext.state.rng);
        if (originalNext.kind === 'applied') {
          randomized ||= originalNext.state.rng !== state.rng;
          const next = deserializeGame(serializeGame(originalNext.state));
          assert.equal(chooseJourney(next, cmd).kind, 'stale');
        }
      }
      assert.equal(JSON.stringify(state), before);
      if (choiceId !== null) {
        const next = chooseJourney(state, command(state, choiceId));
        assert.equal(next.kind, 'applied', `${state.scene.nodeId}/${choiceId}`);
        state = next.state;
      }
    }
  }
  assert.ok(visited > 100); assert.ok(randomized); assert.ok(ended); assert.ok(victory);
});

test('the shared storage key loads and saves an actual v3 life', () => {
  const state = chooseJourney(createJourney({ seed: 'persist' }), { revision: 0, sceneId: 'mortal-entry', choiceId: 'catch-child' }).state;
  const stored = new Map();
  const storage = { setItem(key, raw) { stored.set(key, raw); }, getItem(key) { return stored.get(key) ?? null; } };
  saveToStorage(state, storage);
  assert.deepEqual([...stored.keys()], ['baishi-wending-save-v1']);
  assert.equal(JSON.parse(stored.get(SAVE_KEY)).version, 3);
  assert.deepEqual(loadFromStorage(storage), state);
});

test('v1 and v2 phases use strict legacy validation without abandoning or re-settling the saved life', () => {
  for (const state of legacyStates()) {
    assert.deepEqual(deserializeGame(serializeGame(state)), state);
    const old = asV1(state), raw = JSON.stringify(old), restored = deserializeGame(raw);
    assert.deepEqual(restored, deserialize(raw));
    for (const field of ['run', 'rng', 'phase', 'combat', 'eventId', 'summary', 'lastMessage']) assert.deepEqual(restored[field], old[field]);
    assert.equal(restored.story, null);
    assert.deepEqual(deserializeGame(serializeGame(old)), restored);
    assert.equal(JSON.stringify(old), raw, 'legacy validation must not mutate the source');
  }
});

test('v1 and v2 malformed legacy data still fails before import or export', () => {
  for (const version of [1, 2]) {
    for (const mutate of [
      state => { delete state.run.hp; },
      state => { state.run.herbs = -1; },
      state => { state.meta.history = null; },
      state => { state.run.items.push('invented-item'); },
    ]) {
      const bad = version === 1 ? asV1(createGame()) : createGame(); mutate(bad);
      assert.throws(() => deserializeGame(JSON.stringify(bad)), /存档/);
      assert.throws(() => serializeGame(bad), /存档/);
    }
  }
  const v1 = asV1(createGame()); v1.meta.legacyIds.push('plain-medicine');
  assert.throws(() => deserializeGame(JSON.stringify(v1)), /存档/);
  assert.throws(() => serializeGame(v1), /存档/);
});

test('missing v3 fields and unknown content references are rejected on import and export', () => {
  const mutations = [
    ...['mode', 'contentVersion', 'revision', 'rng', 'phase', 'world', 'life', 'scene', 'transcript', 'summary'].map(key => state => { delete state[key]; }),
    state => { delete state.world.people; },
    state => { delete state.life.items; },
    state => { state.scene.chapterId = 'missing'; },
    state => { state.scene.nodeId = 'missing'; },
    state => { state.scene.opportunities.mortal = 'missing'; },
    state => { state.life.abilities = ['missing']; },
    state => { state.life.items['missing'] = 1; },
    state => { state.life.legacyId = 'missing'; },
    state => { state.transcript[0].sceneId = 'missing'; },
    state => { state.contentVersion = 2; },
  ];
  for (const mutate of mutations) {
    const bad = createJourney(); mutate(bad);
    assert.throws(() => deserializeGame(JSON.stringify(bad)), /存档/);
    assert.throws(() => serializeGame(bad), /存档/);
  }
});

test('unknown or missing versions, invalid JSON, non-text and oversized imports are refused', () => {
  for (const version of [undefined, null, 0, 4, '3']) {
    const bad = { ...createJourney(), version };
    assert.throws(() => deserializeGame(JSON.stringify(bad)), /存档/);
    assert.throws(() => serializeGame(bad), /存档/);
  }
  for (const raw of ['', '{broken', 'null', '[]', '3', undefined, {}, `${' '.repeat(1000001)}{}`]) {
    assert.throws(() => deserializeGame(raw), /存档/);
  }
});

test('invalid v3 state cannot overwrite an existing stored save', () => {
  const original = JSON.stringify(createJourney()), storage = {
    raw: original, writes: 0,
    setItem(key, value) { this.writes++; this.raw = value; },
  };
  const bad = createJourney(); delete bad.life.items;
  assert.throws(() => saveToStorage(bad, storage), /存档/);
  assert.equal(storage.raw, original); assert.equal(storage.writes, 0);
});

import { journeyAtSize, legacyAtSize } from './helpers/save-boundaries.js';
test('shared serialization and storage accept the exact import boundary and reject larger valid v2/v3 history atomically', () => {
 for (const build of [journeyAtSize,legacyAtSize]) {
  const edge=build(1000000),raw=JSON.stringify(edge);
  assert.equal(raw.length,1000000);assert.deepEqual(deserializeGame(serializeGame(edge)),edge);
  const tooLarge=build(1000001);assert.equal(JSON.stringify(tooLarge).length,1000001);
  const storage={raw,writes:0,setItem(key,value){this.raw=value;this.writes++;}};
  assert.throws(()=>serializeGame(tooLarge),/存档.*(长度|字符|上限)/);
  assert.throws(()=>saveToStorage(tooLarge,storage),/存档.*(长度|字符|上限)/);
  assert.equal(storage.raw,raw);assert.equal(storage.writes,0);
 }
});
test('a real growing choice and a terminal birth reject before costs, time, RNG or history become unexportable',()=>{
 const entry=createJourney({seed:'boundary'}),medicine=chooseJourney(entry,command(entry,'catch-child')).state,learning=chooseJourney(medicine,command(medicine,'take-medicine')).state;
 const starts=[entry,medicine,learning,evidenceVictory.reduce((s,id)=>chooseJourney(s,command(s,id)).state,createJourney({seed:1}))];
 for(const base of starts){
  const state=journeyAtSize(999999,base),before=JSON.stringify(state);
  const id=base.phase==='victory'?getJourneyView(base).choices[0].id:({'mortal-entry':'catch-child','mortal-medicine':'take-medicine','mortal-learning':'learn-method'})[base.scene.nodeId];
  const result=chooseJourney(state,command(state,id));
  assert.equal(result.kind,'unavailable');assert.equal(result.state,state);
  assert.match(result.message,/存档.*(长度|字符|上限)/);assert.match(result.message,/未.*(执行|提交)|保持/);
  assert.equal(JSON.stringify(state),before);assert.deepEqual(deserializeGame(serializeGame(result.state)),state);
 }
});

test('v1 normalization cannot load or export a state larger than the shared restore boundary',()=>{
 const old=legacyAtSize(1000000);old.version=1;delete old.story;delete old.meta.storyWorld;
 let padding=1000000-JSON.stringify(old).length;
 for(const row of old.meta.history.flatMap(entry=>entry.log)){const count=Math.min(4096-row.text.length,padding);row.text+='记'.repeat(count);padding-=count;}
 const raw=JSON.stringify(old),normalized=deserialize(raw);
 assert.ok(raw.length<=1000000);
 assert.ok(JSON.stringify(normalized).length>1000000,'original v1 upgrader adds its required v2 fields');
 assert.throws(()=>deserializeGame(raw),/存档.*(长度|字符|上限)/);
 assert.throws(()=>serializeGame(old),/存档.*(长度|字符|上限)/);
});

test('compact v3 number encoding cannot bypass the normalized restore boundary',()=>{
 const state=journeyAtSize(1000001),canonical=JSON.stringify(state);
 const raw=canonical.replace('"year":1000','"year":1e3');
 assert.equal(canonical.length,1000001);assert.equal(raw.length,1000000);
 assert.deepEqual(JSON.parse(raw),state);
 assert.throws(()=>deserializeGame(raw),/存档.*(长度|字符|上限)/);
 const exact=journeyAtSize(1000000);assert.deepEqual(deserializeGame(JSON.stringify(exact)),exact);
});
