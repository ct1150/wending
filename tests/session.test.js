import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapSession, persistSession } from '../src/ui/session.js';
import { createGame, act, chooseStory, combatAction, equipItem, serialize, deserialize, getStoryView, getStats } from '../src/game/engine.js';
import { SAVE_KEY } from '../src/game/persistence.js';
import { createJourney, getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';

function storageWith(raw = null, options = {}) {
  return {
    raw, writes: 0, extras: new Map(),
    getItem(key) { if (options.denyRead) throw new Error('denied'); return key === SAVE_KEY ? this.raw : this.extras.get(key) ?? null; },
    setItem(key, value) { this.writes++; if (options.denyWrite) throw new Error('quota'); if(key===SAVE_KEY)this.raw = value;else this.extras.set(key,value); },
  };
}

// These cases catch automatic choice/time advancement and accidental replacement of an existing life.
test('missing save starts the recommended real YG01 without choosing or persisting', () => {
  const storage = storageWith();
  const session = bootstrapSession(storage, { seed: 20261025 });
  assert.equal(session.status, 'fresh');
  assert.deepEqual(session.state, createGame({ name: '云归', originId: 'village', pathId: 'sword', legacyIds: [], seed: 20261025 }));
  const story = getStoryView(session.state);
  assert.equal(story.sceneId, 'YG01'); assert.equal(story.yearsRemaining, 8);
  assert.equal(session.state.run.age, 16); assert.equal(session.state.run.hp, 120);
  assert.equal(session.state.run.spirit, 24); assert.equal(session.state.run.herbs, 3);
  assert.equal(story.lastResult, null); assert.equal(storage.writes, 0);
  assert.equal(session.rawCorruptSave, null); assert.equal(session.error, '');
});

function phaseStates() {
  const start = createGame({ seed: '5' });
  const event = act(start, { type: 'explore' });
  const prepared = structuredClone(start);
  prepared.run.realmIndex = 5; prepared.run.hp = getStats(prepared).maxHp;
  const combat = act(prepared, { type: 'challenge', challengeId: 'mortal-proof' });
  const ended = act(start, { type: 'retire' });
  const ready = structuredClone(prepared); ready.meta.proofs = ['mortal', 'nether', 'celestial']; ready.run.worldId = 'celestial';
  ready.run.items.push('star-sword-art', 'burning-star', 'ashen-sheath');
  let winner = equipItem(equipItem(equipItem(ready, 'star-sword-art'), 'burning-star', 1), 'ashen-sheath');
  winner = act(winner, { type: 'finale' });
  while (winner.phase === 'combat') winner = combatAction(winner, 'burn');
  assert.equal(event.phase, 'event'); assert.equal(combat.phase, 'combat'); assert.equal(winner.phase, 'victory');
  return [start, event, combat, ended, winner];
}

test('v2 adventure, event, combat, ended and victory load unchanged with no writes', () => {
  for (const source of phaseStates()) {
    const storage = storageWith(serialize(source));
    const session = bootstrapSession(storage, { seed: 20261025, createFresh: createJourney });
    assert.equal(session.status, 'loaded'); assert.deepEqual(session.state, source); assert.equal(storage.writes, 0);
  }
});

test('a migrated v1 life with story null remains the saved life', () => {
  const old = createGame({ seed: 'legacy' }); old.version = 1; delete old.story; delete old.meta.storyWorld;
  const storage = storageWith(JSON.stringify(old));
  const session = bootstrapSession(storage, { createFresh: createJourney });
  assert.equal(session.status, 'loaded'); assert.equal(session.state.story, null);
  assert.deepEqual(session.state.run, old.run); assert.equal(session.state.rng, old.rng); assert.equal(storage.writes, 0);
});

for (const raw of ['{broken', '']) test(`invalid raw save ${JSON.stringify(raw)} blocks automatic writes and preserves exact backup`, () => {
  const storage = storageWith(raw);
  const session = bootstrapSession(storage);
  assert.equal(session.status, 'blocked'); assert.equal(session.state, null);
  assert.equal(session.rawCorruptSave, raw); assert.ok(session.error);
  const attempted = persistSession({ ...session, state: createGame() }, storage);
  assert.equal(attempted.status, 'blocked'); assert.equal(storage.raw, raw); assert.equal(storage.writes, 0);
});

test('denied reads block startup and persistence without inventing a backup', () => {
  const storage = storageWith(null, { denyRead: true });
  const session = bootstrapSession(storage);
  assert.equal(session.status, 'blocked'); assert.equal(session.state, null); assert.equal(session.rawCorruptSave, null); assert.ok(session.error);
  persistSession(session, storage); assert.equal(storage.writes, 0);
});

test('enter_help survives save/reload at YG02 with one cost and the original result', () => {
  const storage = storageWith();
  const session = bootstrapSession(storage, { seed: 20261025 });
  session.state = chooseStory(session.state, 'enter_help');
  const result = getStoryView(session.state).lastResult;
  persistSession(session, storage);
  const restored = bootstrapSession(storage, { seed: 'ignored' });
  assert.equal(restored.status, 'loaded'); assert.equal(getStoryView(restored.state).sceneId, 'YG02');
  assert.equal(restored.state.run.hp, 114); assert.equal(restored.state.run.age, 16);
  assert.deepEqual(getStoryView(restored.state).lastResult, result); assert.equal(storage.writes, 1);
});

test('failed writes keep a playable state that can be exported and recovered', () => {
  const storage = storageWith(null, { denyWrite: true });
  const fresh = bootstrapSession(storage, { seed: 20261025 });
  const unsaved = persistSession(fresh, storage);
  assert.equal(unsaved.status, 'fresh'); assert.equal(unsaved.saved, false); assert.match(unsaved.error, /导出/);
  const next = chooseStory(unsaved.state, 'enter_help');
  assert.equal(next.run.hp, 114);
  assert.deepEqual(deserialize(serialize(next)), next); assert.equal(storage.raw, null);
});

test('createFresh can start the actual v3 journey without advancing or saving it', () => {
  const storage = storageWith();
  const session = bootstrapSession(storage, { seed: 20261025, createFresh: createJourney });
  assert.equal(session.status, 'fresh'); assert.equal(session.state.version, 3);
  assert.deepEqual(session.state, createJourney({ seed: 20261025 }));
  assert.equal(session.state.revision, 0); assert.equal(getJourneyView(session.state).sceneId, 'mortal-entry');
  assert.equal(storage.writes, 0); assert.equal(session.saved, false);
});

test('a persisted v3 choice reloads through one authoritative read without drawing again', () => {
  const storage = storageWith();
  const fresh = bootstrapSession(storage, { seed: 'session-rng', createFresh: createJourney });
  for (const choiceId of ['catch-child', 'take-medicine']) {
    const view = getJourneyView(fresh.state);
    fresh.state = chooseJourney(fresh.state, { revision: view.revision, sceneId: view.sceneId, choiceId }).state;
  }
  const saved = persistSession(fresh, storage);
  assert.equal(saved.saved, true);
  let reads = 0;
  const source = { getItem(key) { reads++; assert.equal(key, SAVE_KEY); return reads === 1 ? storage.raw : '{changed'; } };
  const loaded = bootstrapSession(source, { createFresh: createJourney, seed: 'ignored' });
  assert.equal(loaded.status, 'loaded'); assert.equal(reads, 1);
  assert.deepEqual(loaded.state, fresh.state);
  assert.deepEqual(getJourneyView(loaded.state), getJourneyView(fresh.state));
});

test('v3 startup refuses a denied read or malformed save without calling createFresh or writing', () => {
  const malformed = createJourney(); delete malformed.rng;
  for (const [raw, options] of [[null, { denyRead: true }], ['{broken', {}], ['', {}], [JSON.stringify({ version: 99 }), {}], [JSON.stringify(malformed), {}]]) {
    const storage = storageWith(raw, options);
    let creations = 0;
    const session = bootstrapSession(storage, { createFresh() { creations++; return createJourney(); } });
    assert.equal(session.status, 'blocked'); assert.equal(session.state, null); assert.equal(creations, 0);
    assert.equal(session.rawCorruptSave, options.denyRead ? null : raw);
    assert.ok(session.error);
    persistSession({ ...session, state: createJourney() }, storage);
    assert.equal(storage.writes, 0); assert.equal(storage.raw, raw);
  }
});

test('a failed v3 write retains the exact playable progress for export and recovery', () => {
  const previous = serializeGame(createJourney({ seed: 'previous' }));
  const storage = storageWith(previous, { denyWrite: true });
  let state = createJourney({ seed: 'unsaved' });
  state = chooseJourney(state, { revision: 0, sceneId: 'mortal-entry', choiceId: 'catch-child' }).state;
  const session = { status: 'loaded', state, rawCorruptSave: null, error: '', saved: true };
  const unsaved = persistSession(session, storage);
  assert.equal(unsaved.state, state); assert.equal(unsaved.saved, false); assert.match(unsaved.error, /导出/);
  assert.equal(storage.raw, previous);
  const exported = serializeGame(unsaved.state), restored = deserializeGame(exported);
  assert.deepEqual(restored, state);
  const view = getJourneyView(restored), cmd = { revision: view.revision, sceneId: view.sceneId, choiceId: 'take-medicine' };
  assert.deepEqual(chooseJourney(restored, cmd), chooseJourney(state, cmd));
});

import { journeyAtSize, legacyAtSize } from './helpers/save-boundaries.js';

test('oversized direct persistence reports failure before replacing either current or legacy backup',()=>{
 for(const build of [journeyAtSize,legacyAtSize]){
  const original=JSON.stringify(build(999999)),storage=storageWith(original);
  const session=bootstrapSession(storage),failed=persistSession({...session,state:build(1000001)},storage);
  assert.equal(failed.saved,false);assert.match(failed.error,/存档.*(长度|字符|上限)/);
  assert.doesNotMatch(failed.error,/请导出存档备份/);
  assert.equal(storage.raw,original);assert.equal(storage.writes,0);assert.equal(failed.storageRaw,original);
 }
});
