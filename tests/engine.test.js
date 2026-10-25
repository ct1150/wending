import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/game/engine.js';
import { REALMS } from '../src/game/content.js';

const fresh = (options = {}) => engine.createGame({ name: '问道者', seed: 'test', ...options });

test('new lives and training are deterministic, pure and spend world years', () => {
  const start = fresh();
  const snapshot = JSON.stringify(start);
  const next = engine.act(start, { type: 'train' });
  assert.equal(JSON.stringify(start), snapshot);
  assert.equal(next.run.age, 16 + REALMS[0].trainYears);
  assert.equal(next.meta.worldYear, 1000 + REALMS[0].trainYears);
  assert.ok(next.run.cultivation > start.run.cultivation);
  assert.deepEqual(next, engine.act(fresh(), { type: 'train' }));
});

test('elapsed years kill before breakthrough grants a longer lifespan', () => {
  const state = fresh();
  state.run.age = REALMS[0].lifeCap - REALMS[0].breakYears;
  state.run.cultivation = REALMS[0].need;
  const next = engine.act(state, { type: 'breakthrough' });
  assert.equal(next.phase, 'ended');
  assert.equal(next.run.realmIndex, 0);
  assert.equal(next.summary.legacyOptions.length, 0);
});

test('retirement is not a reward and reincarnation preserves only earned meta', () => {
  const ended = engine.act(fresh(), { type: 'retire' });
  assert.deepEqual(ended.summary.legacyOptions, []);
  const next = engine.reincarnate(ended, { name: '再来者', seed: 42 });
  assert.equal(next.meta.generation, 2);
  assert.equal(next.meta.worldYear, ended.meta.worldYear + 16);
  assert.equal(next.run.age, 16);
  assert.equal(next.meta.history.length, 1);
});

test('alchemy has visible finite costs, cannot rescue an exhausted life, and is capped twice', () => {
  const start = fresh();
  start.run.herbs = 30; start.run.spirit = 100;
  let state = engine.act(start, { type: 'alchemy' });
  state = engine.act(state, { type: 'alchemy' });
  assert.equal(state.run.elixirsUsed, 2);
  assert.equal(state.run.herbs, 24);
  assert.equal(state.run.lifeBonus, 4 * REALMS[0].trainYears);
  assert.equal(engine.getActionInfo(state, 'alchemy').enabled, false);
  assert.throws(() => engine.act(state, { type: 'alchemy' }), /两/);
  const dying = structuredClone(start);
  dying.run.age = REALMS[0].lifeCap - REALMS[0].trainYears;
  const ended = engine.act(dying, { type: 'alchemy' });
  assert.equal(ended.phase, 'ended');
  assert.equal(ended.run.lifeBonus, 0);
});

test('equipment enforces ownership, kind and two distinct skill slots', () => {
  const state = fresh();
  assert.throws(() => engine.equipItem(state, 'missing'), /物品|拥有/);
  const skill = state.run.loadout.skills[0];
  assert.throws(() => engine.equipItem(state, skill, 2), /槽/);
  assert.throws(() => engine.equipItem(state, skill, 1), /重复/);
  const next = engine.equipItem(state, state.run.loadout.art);
  assert.deepEqual(next.run.loadout, state.run.loadout);
  assert.notEqual(next, state);
});

test('save roundtrip preserves random state and rejects incomplete or unknown data', () => {
  const state = fresh();
  assert.deepEqual(engine.deserialize(engine.serialize(state)), state);
  assert.throws(() => engine.deserialize('{bad json'), /存档/);
  for (const mutate of [
    s => { delete s.run.loadout; },
    s => { s.run.items.push('unknown-item'); },
    s => { s.run.spirit = -1; },
    s => { s.rng = 0; },
    s => { s.run.elixirsUsed = 3; },
    s => { s.run.hp = 999999; },
    s => { s.phase = 'combat'; },
    s => { s.phase = 'event'; s.eventId = 'unknown-event'; },
    s => { s.meta.proofs.push('fake'); },
    s => { s.run.loadout.skills.push(s.run.loadout.skills[0]); },
    s => { s.run.selectedLegacies.push('sword-heart'); },
    s => { s.version = 3; },
    s => { s.unexpected = true; },
  ]) {
    const corrupt = structuredClone(state); mutate(corrupt);
    assert.throws(() => engine.deserialize(JSON.stringify(corrupt)), /存档/);
  }
});

import { ITEMS, EVENTS, CHALLENGES, LEGACIES } from '../src/game/content.js';
import { saveToStorage, loadFromStorage, SAVE_KEY } from '../src/game/persistence.js';

function eventState(event) {
  const state = fresh({ pathId: event.requires?.pathId ?? 'sword' });
  state.run.realmIndex = event.requires?.minRealm ?? 0;
  state.run.worldId = event.worldId;
  if (event.requires?.flag) state.run.flags.push(event.requires.flag);
  if (event.requires?.worldFlag) state.meta.worldFlags.push(event.requires.worldFlag);
  state.run.hp = engine.getStats(state).maxHp;
  state.phase = 'event'; state.eventId = event.id; state.run.visitedEvents.push(event.id);
  return state;
}

test('event affordability rejects choices without mutating resources, time or RNG', () => {
  const event = EVENTS.find(row => row.choices.some(choice => choice.cost?.spirit || choice.cost?.herbs));
  const state = eventState(event); state.run.spirit = 0; state.run.herbs = 0;
  const choice = engine.getEventChoices(state).find(row => row.cost?.spirit || row.cost?.herbs);
  assert.equal(choice.enabled, false);
  const before = JSON.stringify(state);
  assert.throws(() => engine.chooseEvent(state, choice.id), /不足/);
  assert.equal(JSON.stringify(state), before);
  assert.ok(engine.getEventChoices(state).some(row => row.enabled && !row.cost));
});

test('event choices replay from a save, account for years and record world consequences', () => {
  const event = EVENTS.find(row => row.choices.some(choice => choice.effects?.worldFlag && choice.chance == null));
  const state = eventState(event);
  state.run.spirit = 1000; state.run.herbs = 100;
  const choice = engine.getEventChoices(state).find(row => row.enabled && row.effects?.worldFlag && row.chance == null);
  assert.ok(choice);
  const next = engine.chooseEvent(state, choice.id);
  assert.equal(next.run.age, state.run.age + (choice.cost?.years ?? 0));
  assert.equal(next.meta.worldYear, state.meta.worldYear + (choice.cost?.years ?? 0));
  assert.ok(next.meta.worldFlags.includes(choice.effects.worldFlag));
  assert.equal(next.phase, 'adventure');
  assert.deepEqual(next, engine.chooseEvent(engine.deserialize(engine.serialize(state)), choice.id));
  assert.deepEqual(engine.deserialize(engine.serialize(next)), next);
});

test('event costs that exhaust lifespan end before rewards', () => {
  const event = EVENTS.find(row => row.choices.some(choice => choice.cost?.years > 0));
  const state = eventState(event);
  state.run.spirit = 1000; state.run.herbs = 100;
  const choice = engine.getEventChoices(state).find(row => row.enabled && row.cost?.years > 0);
  state.run.age = engine.getStats(state).lifeLimit - choice.cost.years;
  const next = engine.chooseEvent(state, choice.id);
  assert.equal(next.phase, 'ended');
  assert.deepEqual(next.run.items, state.run.items);
  assert.equal(next.run.cultivation, state.run.cultivation);
  assert.deepEqual(next.meta.worldFlags, state.meta.worldFlags);
});

function readyForChallenge(challenge = CHALLENGES.find(row => row.proofId === 'mortal')) {
  const state = fresh(); state.run.realmIndex = 5; state.run.worldId = challenge.worldId;
  state.run.hp = engine.getStats(state).maxHp;
  return engine.act(state, { type: 'challenge', challengeId: challenge.id });
}

test('burn consumes personal remaining life without advancing world time', () => {
  const state = readyForChallenge();
  const next = engine.combatAction(state, 'burn');
  assert.equal(next.run.lifeDamage, state.run.lifeDamage + 5);
  assert.equal(next.run.age, state.run.age);
  assert.equal(next.meta.worldYear, state.meta.worldYear);
  assert.equal(state.run.lifeDamage, 0);
});

test('burn cannot attack after its fuel exhausts life', () => {
  const state = readyForChallenge();
  state.run.lifeDamage = engine.getStats(state).lifeLimit - state.run.age - 5;
  const next = engine.combatAction(state, 'burn');
  assert.equal(next.phase, 'ended');
  assert.equal(next.meta.proofs.length, 0);
});

test('guard accumulates focus but enemy pressure prevents endless stalling', () => {
  let state = readyForChallenge();
  state = engine.combatAction(state, 'guard');
  assert.equal(state.combat.focus, 1);
  assert.ok(state.run.hp < engine.getStats(state).maxHp);
  for (let i = 0; i < 300 && state.phase === 'combat'; i++) state = engine.combatAction(state, 'guard');
  assert.equal(state.phase, 'ended');
  assert.equal(state.summary.cause, 'battle');
});

test('flee pays resources and two actual years and never grants a proof', () => {
  const state = readyForChallenge();
  const next = engine.combatAction(state, 'flee');
  assert.equal(next.phase, 'adventure');
  assert.equal(next.run.age, state.run.age + 2);
  assert.equal(next.meta.worldYear, state.meta.worldYear + 2);
  assert.ok(next.run.spirit < state.run.spirit);
  assert.deepEqual(next.meta.proofs, []);
});

test('proofs are unique and the final battle produces a persistent victory', () => {
  let state = fresh(); state.run.realmIndex = 5; state.run.hp = engine.getStats(state).maxHp;
  // This boundary fixture isolates proof uniqueness and the ending. Legal acquisition is tested in simulation.test.js.
  state.run.items.push('star-sword-art', 'burning-star', 'returning-edge', 'ashen-sheath');
  state = engine.equipItem(state, 'star-sword-art');
  state = engine.equipItem(state, 'burning-star', 0);
  state = engine.equipItem(state, 'returning-edge', 1);
  state = engine.equipItem(state, 'ashen-sheath');
  for (const challenge of CHALLENGES.filter(row => row.proofId)) {
    if (state.run.worldId !== challenge.worldId) state = engine.act(state, { type: 'travel', worldId: challenge.worldId });
    state = engine.act(state, { type: 'challenge', challengeId: challenge.id });
    while (state.phase === 'combat') state = engine.combatAction(state, 'burn');
    assert.equal(state.phase, 'adventure');
    assert.ok(state.meta.proofs.includes(challenge.proofId));
    assert.throws(() => engine.act(state, { type: 'challenge', challengeId: challenge.id }), /已取得/);
    state = engine.act(state, { type: 'rest' });
    state = engine.act(state, { type: 'rest' });
  }
  state = engine.act(state, { type: 'finale' });
  assert.throws(() => engine.equipItem(state, state.run.items[0]), /当前|先完成/);
  while (state.phase === 'combat') state = engine.combatAction(state, 'burn');
  assert.equal(state.phase, 'victory');
  assert.equal(state.meta.victories, 1);
  assert.equal(state.meta.proofs.length, 3);
  assert.deepEqual(engine.deserialize(engine.serialize(state)), state);
});

test('earned candidates require a single choice, and carried legacies are capped at two', () => {
  const state = fresh(); state.run.realmIndex = 2; state.run.hp = engine.getStats(state).maxHp;
  const ended = engine.act(state, { type: 'retire' });
  assert.ok(ended.summary.legacyOptions.includes('realm-memory'));
  assert.throws(() => engine.reincarnate(ended), /先/);
  const chosen = engine.selectLegacy(ended, 'realm-memory');
  assert.throws(() => engine.selectLegacy(chosen, 'sword-heart'), /已经/);
  const reborn = engine.reincarnate(chosen, { legacyIds: ['realm-memory'] });
  assert.equal(reborn.run.cultivation, LEGACIES.find(row => row.id === 'realm-memory').effects.cultivation);
  assert.deepEqual(reborn.run.selectedLegacies, ['realm-memory']);
  assert.deepEqual(engine.deserialize(engine.serialize(chosen)), chosen);
  const meta = structuredClone(chosen.meta); meta.legacyIds = [...new Set([...meta.legacyIds, ...LEGACIES.slice(0, 3).map(row => row.id)])];
  assert.throws(() => engine.createGame({ legacyIds: meta.legacyIds.slice(0, 3) }, meta), /最多/);
  assert.throws(() => engine.createGame({ legacyIds: ['realm-memory'] }), /解锁/);
});

test('storage missing saves return null and corrupt saves are not overwritten', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(loadFromStorage(storage), null);
  saveToStorage(fresh(), storage);
  assert.deepEqual(loadFromStorage(storage), fresh());
  values.set(SAVE_KEY, '{broken');
  assert.throws(() => loadFromStorage(storage), /存档/);
  assert.equal(values.get(SAVE_KEY), '{broken');
  assert.throws(() => saveToStorage(fresh(), { setItem() { throw new Error('quota'); } }), /保存失败/);
});

test('failed breakthroughs preserve cultivation and improve the next visible chance', () => {
  let state, next;
  for (let seed = 1; seed < 1000; seed++) {
    state = fresh({ seed }); state.run.cultivation = REALMS[0].need;
    next = engine.act(state, { type: 'breakthrough' });
    if (next.run.realmIndex === 0) break;
  }
  assert.equal(next.run.realmIndex, 0);
  assert.equal(next.run.cultivation, state.run.cultivation);
  assert.equal(next.run.breakthroughFailures, 1);
  assert.ok(engine.getStats(next).breakthroughChance > engine.getStats(state).breakthroughChance);
  assert.ok(next.run.hp < state.run.hp);
  assert.equal(next.run.age, state.run.age + REALMS[0].breakYears);
});

test('first exploration is an event and subsequent choices never repeat an event this life', () => {
  let state = engine.act(fresh(), { type: 'explore' });
  assert.equal(state.phase, 'event');
  const seen = new Set();
  for (let turn = 0; turn < 15; turn++) {
    if (state.phase === 'event') {
      assert.equal(seen.has(state.eventId), false); seen.add(state.eventId);
      const leave = engine.getEventChoices(state).find(choice => choice.enabled && !choice.cost && !choice.requires);
      assert.ok(leave);
      state = engine.chooseEvent(state, leave.id);
    } else if (state.phase === 'combat') state = engine.combatAction(state, 'flee');
    if (state.phase !== 'adventure') break;
    state = engine.act(state, { type: 'explore' });
    if (state.phase === 'ended') break;
  }
  assert.equal(new Set(state.run.visitedEvents).size, state.run.visitedEvents.length);
});

test('off-path equipment changes derived stats and max health is clamped when removed', () => {
  const state = fresh();
  const item = ITEMS.find(row => row.kind === 'artifact' && row.stats.hp > 0);
  assert.ok(item);
  state.run.items.push(item.id);
  const next = engine.equipItem(state, item.id);
  assert.equal(engine.getStats(next).maxHp, engine.getStats(state).maxHp + item.stats.hp);
  assert.equal(next.run.hp, state.run.hp);
  assert.deepEqual(engine.deserialize(engine.serialize(next)), next);
});

test('golden furnace is earned through two elixirs after foundation, never merely by retiring as an alchemist', () => {
  const state = fresh({ pathId: 'alchemy' }); state.run.realmIndex = 2; state.run.hp = engine.getStats(state).maxHp;
  const ended = engine.act(state, { type: 'retire' });
  assert.equal(ended.summary.legacyOptions.includes('golden-furnace'), false);
  state.run.herbs = 20; state.run.spirit = 100;
  let brewed = engine.act(state, { type: 'alchemy' });
  brewed = engine.act(brewed, { type: 'alchemy' });
  assert.ok(brewed.run.legacyCandidates.includes('golden-furnace'));
});

test('sword cultivators can earn sword heart from a real proof before reaching core realm', () => {
  const state = fresh(); state.run.realmIndex = 1; state.run.hp = engine.getStats(state).maxHp;
  state.run.items.push('star-sword-art', 'burning-star', 'ashen-sheath');
  let prepared = engine.equipItem(state, 'star-sword-art');
  prepared = engine.equipItem(prepared, 'burning-star', 1);
  prepared = engine.equipItem(prepared, 'ashen-sheath');
  let combat = engine.act(prepared, { type: 'challenge', challengeId: 'mortal-proof' });
  while (combat.phase === 'combat') combat = engine.combatAction(combat, 'burn');
  assert.equal(combat.phase, 'adventure');
  assert.equal(combat.run.realmIndex, 1);
  assert.ok(combat.run.legacyCandidates.includes('sword-heart'));
});

test('every event choice and probabilistic outcome remains a valid serializable state', () => {
  let outcomes = 0; const chanceOutcomes = new Map();
  for (const event of EVENTS) for (const choice of event.choices) for (let seed = 0; seed < (choice.chance == null ? 1 : 12); seed++) {
    const state = eventState(event);
    state.rng = fresh({ seed: `event-outcome-${seed}` }).rng;
    state.run.realmIndex = Math.max(state.run.realmIndex, { mortal: 0, nether: 2, celestial: 4 }[event.worldId], choice.requires?.minRealm ?? 0);
    if (choice.requires?.pathId) state.run.pathId = choice.requires.pathId;
    if (choice.requires?.flag && !state.run.flags.includes(choice.requires.flag)) state.run.flags.push(choice.requires.flag);
    if (choice.requires?.worldFlag && !state.meta.worldFlags.includes(choice.requires.worldFlag)) state.meta.worldFlags.push(choice.requires.worldFlag);
    state.run.hp = engine.getStats(state).maxHp; state.run.spirit = 1000; state.run.herbs = 100;
    const option = engine.getEventChoices(state).find(row => row.id === choice.id);
    assert.ok(option.enabled, `${event.id}/${choice.id}: ${option.reason}`);
    assert.deepEqual(engine.deserialize(engine.serialize(state)), state);
    const next = engine.chooseEvent(state, choice.id);
    assert.deepEqual(engine.deserialize(engine.serialize(next)), next, `${event.id}/${choice.id}`);
    if (choice.chance > 0 && choice.chance < 1) {
      const key = `${event.id}/${choice.id}`;
      if (!chanceOutcomes.has(key)) chanceOutcomes.set(key, new Set());
      chanceOutcomes.get(key).add(next.run.log.at(-1).kind === 'failure');
    }
    outcomes++;
  }
  for (const [key, results] of chanceOutcomes) assert.equal(results.size, 2, `${key} must exercise success and failure`);
  assert.ok(outcomes > 150);
});

test('browser storage access restrictions produce a readable error before any write', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    assert.throws(() => loadFromStorage(), /本地存储/);
    assert.throws(() => saveToStorage(fresh()), /本地存储/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
