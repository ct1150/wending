import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, chooseEvent, getEventChoices, combatAction, getStats, selectLegacy, reincarnate, serialize, deserialize } from '../src/game/engine.js';

function completedLife() {
  let state = createGame({ name: '种药人', pathId: 'sword', seed: '5' });
  state = act(state, { type: 'explore' });
  assert.equal(state.eventId, 'mortal-seed');
  state = chooseEvent(state, 'plant');
  for (let actions = 0; state.run.realmIndex < 2 && actions < 40; actions++) {
    state = act(state, { type: state.run.cultivation < getStats(state).need ? 'train' : 'breakthrough' });
    assert.equal(state.phase, 'adventure');
  }
  assert.equal(state.run.realmIndex, 2);
  return act(state, { type: 'retire' });
}

test('past-life event choices and the chosen legacy remain readable after reincarnation and save roundtrip', () => {
  const ended = completedLife();
  assert.equal(ended.meta.history[0].selectedLegacyId, null);
  assert.ok(ended.meta.history[0].log.some(entry => entry.title === '留下种药' && entry.year === 1005));
  const selected = selectLegacy(ended, 'realm-memory');
  assert.equal(ended.meta.history[0].selectedLegacyId, null, 'selecting a legacy must not mutate the prior state');
  const reborn = reincarnate(selected, { name: '青谷归人', legacyIds: ['realm-memory'] });
  const restored = deserialize(serialize(reborn));
  const past = restored.meta.history[0];
  assert.equal(past.selectedLegacyId, 'realm-memory');
  assert.ok(past.log.some(entry => entry.title === '留下种药'));
  assert.ok(past.log.some(entry => entry.kind === 'ending'));
  assert.ok(past.log.some(entry => entry.kind === 'legacy' && entry.text.includes('丹成旧梦')));
  assert.equal(restored.run.log.length, 1, 'a new life starts its own journal');
});

test('older version-one backups import without historical journal fields and preserve a selected current-life reward', () => {
  const selected = selectLegacy(completedLife(), 'realm-memory');
  const reborn = reincarnate(selected);
  for (const [source, expectedSelection] of [[selected, 'realm-memory'], [reborn, null]]) {
    const old = JSON.parse(serialize(source));
    for (const history of old.meta.history) {
      delete history.log;
      delete history.selectedLegacyId;
    }
    const raw = JSON.stringify(old);
    const migrated = deserialize(raw);
    assert.equal(migrated.version, 1);
    assert.deepEqual(migrated.meta.history[0].log, []);
    assert.equal(migrated.meta.history[0].selectedLegacyId, expectedSelection);
    assert.equal(JSON.stringify(old), raw, 'migration does not change the source backup');
    assert.deepEqual(deserialize(serialize(migrated)), migrated);
  }
});

test('finite elixir milestones are retained in the life journal', () => {
  let state = createGame({ name: '守炉人', pathId: 'alchemy', originId: 'herbalist' });
  state = act(state, { type: 'alchemy' });
  state = act(state, { type: 'alchemy' });
  state = reincarnate(act(state, { type: 'retire' }));
  assert.equal(state.meta.history[0].log.filter(entry => entry.title === '延寿丹成').length, 2);
});

test('malformed historical journals and inconsistent reward selections are rejected instead of normalized away', () => {
  const selected = selectLegacy(completedLife(), 'realm-memory');
  for (const mutate of [
    history => { history.log = null; },
    history => { history.log[0].text = { invalid: true }; },
    history => { history.log[0].age = history.age + 1; },
    history => { history.log[0].year = selected.meta.worldYear + 1; },
    history => { history.log[0].kind = 'unknown'; },
    history => { history.log[0].extra = true; },
    history => { history.log[1].id = history.log[0].id; },
    history => { history.log = Array.from({ length: 41 }, (_, index) => ({ ...history.log[0], id: index + 1 })); },
    history => { history.selectedLegacyId = 'unknown-legacy'; },
    history => { history.selectedLegacyId = 'iron-bone'; },
    history => { history.selectedLegacyId = null; },
  ]) {
    const corrupt = structuredClone(selected);
    mutate(corrupt.meta.history[0]);
    assert.throws(() => deserialize(JSON.stringify(corrupt)), /存档/);
  }
});

test('long adventures retain at most forty recent key entries and fifty completed lives', () => {
  let state = createGame({ name: '远游人', seed: '5' });
  while (state.run.realmIndex < 2) state = act(state, { type: state.run.cultivation < getStats(state).need ? 'train' : 'breakthrough' });
  for (const worldId of ['mortal', 'nether']) {
    if (state.run.worldId !== worldId) state = act(state, { type: 'travel', worldId });
    for (let turns = 0; turns < 20 && state.run.visitedEvents.length < 24; turns++) {
      state = act(state, { type: 'explore' });
      if (state.phase === 'event') {
        const leave = getEventChoices(state).find(choice => choice.enabled && !choice.cost);
        state = chooseEvent(state, leave.id);
      } else if (state.phase === 'combat') state = combatAction(state, 'flee');
      assert.equal(state.phase, 'adventure');
    }
  }
  assert.ok(state.run.visitedEvents.length >= 20, 'the public journey produced enough key events to exercise trimming');
  state = act(state, { type: 'retire' });
  assert.equal(state.meta.history[0].log.length, 40);
  assert.equal(state.meta.history[0].log.at(-1).kind, 'ending');
  assert.deepEqual(deserialize(serialize(state)), state);

  let manyLives = createGame();
  for (let life = 1; life <= 52; life++) {
    manyLives = act(manyLives, { type: 'retire' });
    if (life < 52) manyLives = reincarnate(manyLives);
  }
  assert.equal(manyLives.meta.history.length, 50);
  assert.equal(manyLives.meta.history[0].generation, 3);
  assert.equal(manyLives.meta.history.at(-1).generation, 52);
  assert.deepEqual(deserialize(serialize(manyLives)), manyLives);
});
