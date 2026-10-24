import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, getStats, getEventChoices, chooseEvent, equipItem, combatAction, serialize, deserialize } from '../src/game/engine.js';
import { CHALLENGES, ITEMS, PATHS } from '../src/game/content.js';

function campaign(pathId, seed, prepared, tactics = true) {
  let state = createGame({ name: '百世行者', originId: pathId === 'alchemy' ? 'herbalist' : 'village', pathId, seed });
  const counts = { actions: 0, train: 0, explore: 0, events: 0, gear: 0, guard: 0, burn: 0, strike: 0 };
  const checkpoints = [];
  const score = item => {
    const s = item.stats, body = pathId === 'body';
    return (s.attack ?? 0) * (body ? 1.5 : 2) + (s.defense ?? 0) * (body ? 3 : 2) + (s.hp ?? 0) * (body ? 0.3 : 0.15) + (s.burn ?? 0) + (state.run.realmIndex < 5 ? (s.training ?? 0) * 2 : 0) + (s.healing ?? 0) * 0.15;
  };
  function equipment() {
    if (!prepared || state.phase !== 'adventure') return;
    const owned = state.run.items.map(id => ITEMS.find(item => item.id === id)).filter(item => item.pathId === 'any' || item.pathId === pathId);
    for (const kind of ['art', 'artifact', 'skill']) {
      const best = owned.filter(item => item.kind === kind).sort((a, b) => score(b) - score(a)).slice(0, kind === 'skill' ? 2 : 1);
      for (let slot = 0; slot < best.length; slot++) {
        const current = kind === 'skill' ? state.run.loadout.skills[slot] : state.run.loadout[kind];
        if (current !== best[slot].id) {
          if (kind === 'skill' && state.run.loadout.skills.includes(best[slot].id)) continue;
          state = equipItem(state, best[slot].id, slot); counts.actions++; counts.gear++;
        }
      }
    }
  }
  function move(type, options = {}) {
    state = act(state, { type, ...options }); counts.actions++;
    if (Object.hasOwn(counts, type)) counts[type]++;
    return state.phase === 'adventure';
  }
  function fight(tactical) {
    for (let i = 0; state.phase === 'combat' && i < 100; i++) {
      const combat = state.combat, stats = getStats(state);
      const attack = tactical && combat.round % 3 === 0 && combat.enemyHp > Math.max(1, stats.attack * 2 + stats.burnBonus - 60) ? 'guard' : 'burn';
      state = combatAction(state, attack); counts.actions++; counts[attack]++;
    }
  }
  function heal() {
    while (state.phase === 'adventure' && state.run.hp < getStats(state).maxHp) if (!move('rest')) break;
  }
  function grow(target) {
    while (state.phase === 'adventure' && state.run.realmIndex < target && counts.train < 100) {
      while (state.phase === 'adventure' && state.run.cultivation < getStats(state).need) move('train');
      if (state.phase !== 'adventure' || !move('breakthrough')) break;
    }
  }
  function explore(times) {
    for (let i = 0; i < times && state.phase === 'adventure'; i++) {
      if (state.run.hp < getStats(state).maxHp * 0.65) heal();
      if (!move('explore')) {
        if (state.phase === 'combat') fight(true);
        if (state.phase === 'event') {
          const choices = getEventChoices(state).filter(choice => choice.enabled);
          const choice = choices.find(choice => choice.effects?.itemId && !state.run.items.includes(choice.effects.itemId) && ['any', pathId].includes(ITEMS.find(item => item.id === choice.effects.itemId).pathId))
            ?? choices.find(choice => choice.chance == null && ((choice.effects?.cultivation ?? 0) >= 20 || (choice.effects?.herbs ?? 0) >= 4 || (choice.effects?.spirit ?? 0) >= 15))
            ?? choices.find(choice => !choice.cost && !choice.requires);
          state = chooseEvent(state, choice.id); counts.actions++; counts.events++;
        }
      }
      equipment();
    }
  }
  grow(2);
  if (prepared) { explore(12); checkpoints.push({ stage: '人间历练', age: state.run.age, remaining: getStats(state).remainingLife }); }
  grow(3);
  if (prepared && state.phase === 'adventure') {
    move('travel', { worldId: 'nether' }); explore(12); checkpoints.push({ stage: '幽冥历练', age: state.run.age, remaining: getStats(state).remainingLife });
  }
  grow(5);
  if (prepared && state.phase === 'adventure') {
    move('travel', { worldId: 'celestial' }); explore(16); checkpoints.push({ stage: '天界备战', age: state.run.age, remaining: getStats(state).remainingLife });
    // Two finite elixirs trade actual time and resources for a small net preparation budget.
    while (state.phase === 'adventure' && state.run.elixirsUsed < 2 && state.run.herbs >= 3 && state.run.spirit >= 15) move('alchemy');
  }
  for (const challenge of [...CHALLENGES.filter(row => !row.final), CHALLENGES.find(row => row.final)]) {
    if (state.phase !== 'adventure') break;
    if (state.run.worldId !== challenge.worldId && !move('travel', { worldId: challenge.worldId })) break;
    heal(); if (state.phase !== 'adventure') break;
    if (!move(challenge.final ? 'finale' : 'challenge', { challengeId: challenge.id })) fight(prepared && tactics);
    checkpoints.push({ stage: challenge.id, age: state.run.age, remaining: getStats(state).remainingLife, hp: state.run.hp });
    assert.deepEqual(deserialize(serialize(state)), state);
  }
  return { state, counts, checkpoints };
}

for (const path of PATHS) {
  test(`${path.name}: initial gear and uninterrupted burns cannot rush the final victory`, () => {
    for (const seed of ['legal-victory-2026', 'balance-1', 'balance-2']) {
      const result = campaign(path.id, seed, false);
      assert.notEqual(result.state.phase, 'victory', JSON.stringify(result));
      assert.equal(result.state.phase, 'ended');
      assert.equal(result.state.summary.cause, 'battle');
      assert.equal(result.state.meta.proofs.length, 3);
      if (process.env.BALANCE_REPORT && seed === 'legal-victory-2026') console.log(JSON.stringify({ route: 'initial-gear-rush', pathId: path.id, age: result.state.run.age, remaining: getStats(result.state).remainingLife, cause: result.state.summary.cause, counts: result.counts }));
      assert.equal(result.counts.explore, 0);
      assert.equal(result.counts.gear, 0);
      assert.equal(result.state.meta.generation, 1);
    }
  });
  test(`${path.name}: one prepared first life can win through actual exploration, equipment and tactics`, () => {
    const result = campaign(path.id, 'prepared-2026', true);
    if (process.env.BALANCE_REPORT) console.log(JSON.stringify({ pathId: path.id, phase: result.state.phase, age: result.state.run.age, remaining: getStats(result.state).remainingLife, lifeDamage: result.state.run.lifeDamage, lifeBonus: result.state.run.lifeBonus, loadout: result.state.run.loadout, counts: result.counts, checkpoints: result.checkpoints }));
    assert.equal(result.state.phase, 'victory', JSON.stringify(result));
    assert.equal(result.state.meta.generation, 1);
    assert.equal(result.state.meta.proofs.length, 3);
    assert.ok(result.counts.events >= 15);
    assert.ok(result.counts.gear >= 3);
    assert.ok(result.counts.guard > 0);
    assert.ok(result.counts.train < 50);
    assert.ok(getStats(result.state).remainingLife > 0);
    assert.ok(getStats(result.state).remainingLife < 250, 'preparation should consume a material part of the life budget');
  });
}

test('prepared alchemy benefits from guarding visible heavy turns instead of burning every round', () => {
  const tactical = campaign('alchemy', 'prepared-2026', true, true);
  const reckless = campaign('alchemy', 'prepared-2026', true, false);
  assert.equal(tactical.state.phase, 'victory');
  assert.equal(reckless.state.phase, 'ended');
  assert.equal(reckless.state.summary.cause, 'battle');
  assert.equal(reckless.state.meta.proofs.length, 3);
  assert.deepEqual(tactical.state.run.loadout, reckless.state.run.loadout);
  assert.ok(tactical.counts.guard > 0);
  assert.equal(reckless.counts.guard, 0);
});
