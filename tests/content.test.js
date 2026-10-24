import test from 'node:test';
import assert from 'node:assert/strict';
import { REALMS, PATHS, ORIGINS, WORLDS, ITEMS, LEGACIES, EVENTS, ENEMIES, CHALLENGES, WORLD_FLAGS } from '../src/game/content.js';

const ids = list => new Set(list.map(value => value.id));
const worlds = ids(WORLDS);
const paths = ids(PATHS);
const items = ids(ITEMS);
const legacies = ids(LEGACIES);
const enemies = ids(ENEMIES);
const worldFlags = new Set(Object.keys(WORLD_FLAGS));
const localFlags = new Set([
  ...EVENTS.flatMap(event => event.choices.flatMap(choice => [choice.effects?.flag, choice.failure?.effects?.flag])),
  ...LEGACIES.map(legacy => legacy.effects.flag),
].filter(Boolean));

function knownKeys(value, allowed, context) {
  for (const key of Object.keys(value ?? {})) assert.ok(allowed.includes(key), `${context}: unsupported key ${key}`);
}

function assertRequirements(requires, context) {
  if (!requires) return;
  knownKeys(requires, ['minRealm', 'maxRealm', 'pathId', 'flag', 'notFlag', 'worldFlag', 'notWorldFlag'], context);
  for (const key of ['minRealm', 'maxRealm']) {
    if (key in requires) assert.ok(Number.isInteger(requires[key]) && requires[key] >= 0 && requires[key] < REALMS.length, `${context}: invalid ${key}`);
  }
  if (requires.pathId) assert.ok(paths.has(requires.pathId), `${context}: unknown path`);
  for (const key of ['flag', 'notFlag']) if (requires[key]) assert.ok(localFlags.has(requires[key]), `${context}: unproducible ${key}`);
  for (const key of ['worldFlag', 'notWorldFlag']) if (requires[key]) assert.ok(worldFlags.has(requires[key]), `${context}: unknown world flag`);
  if ('minRealm' in requires && 'maxRealm' in requires) assert.ok(requires.minRealm <= requires.maxRealm, `${context}: impossible realm range`);
}

function assertEffects(effects, context) {
  if (!effects) return;
  const numeric = ['cultivation', 'spirit', 'herbs', 'hp', 'lifeDamage', 'merit', 'renown'];
  knownKeys(effects, [...numeric, 'itemId', 'flag', 'worldFlag', 'removeWorldFlag', 'legacyId'], context);
  for (const key of numeric) if (key in effects) assert.ok(Number.isSafeInteger(effects[key]), `${context}: invalid ${key}`);
  if (effects.itemId) assert.ok(items.has(effects.itemId), `${context}: missing item ${effects.itemId}`);
  if (effects.legacyId) assert.ok(legacies.has(effects.legacyId), `${context}: missing legacy ${effects.legacyId}`);
  for (const key of ['worldFlag', 'removeWorldFlag']) if (effects[key]) assert.ok(worldFlags.has(effects[key]), `${context}: unknown world flag`);
}

test('all content identifiers are unique and references point to usable definitions', () => {
  for (const list of [REALMS, PATHS, ORIGINS, WORLDS, ITEMS, LEGACIES, EVENTS, ENEMIES, CHALLENGES]) {
    assert.equal(ids(list).size, list.length, 'duplicate ID');
    for (const entry of list) assert.match(entry.id, /^[a-z][a-z0-9-]+$/);
  }
  for (const path of PATHS) {
    const art = ITEMS.find(item => item.id === path.starterArt);
    const skill = ITEMS.find(item => item.id === path.starterSkill);
    assert.equal(art?.kind, 'art', `${path.id} requires a starter art`);
    assert.equal(skill?.kind, 'skill', `${path.id} requires a starter skill`);
    assert.equal(art.pathId, path.id);
    assert.equal(skill.pathId, path.id);
  }
  for (const item of ITEMS) {
    assert.ok(paths.has(item.pathId) || item.pathId === 'any', `${item.id}: path`);
    assert.ok(['art', 'skill', 'artifact'].includes(item.kind), `${item.id}: kind`);
    assert.ok(['common', 'rare', 'epic'].includes(item.rarity), `${item.id}: rarity`);
    knownKeys(item.stats, ['attack', 'defense', 'hp', 'training', 'burn', 'healing'], item.id);
    assert.ok(Object.values(item.stats).every(value => Number.isSafeInteger(value) && value >= 0), `${item.id}: invalid stat`);
  }
  for (const legacy of LEGACIES) {
    knownKeys(legacy.effects, ['spirit', 'herbs', 'attack', 'defense', 'hp', 'cultivation', 'itemId', 'flag'], legacy.id);
    if (legacy.effects.itemId) assert.ok(items.has(legacy.effects.itemId));
    for (const [key, value] of Object.entries(legacy.effects)) if (!['itemId', 'flag'].includes(key)) assert.ok(Number.isSafeInteger(value) && value >= 0);
  }
  const obtainable = new Set([
    ...PATHS.flatMap(path => [path.starterArt, path.starterSkill]),
    ...EVENTS.flatMap(event => event.choices.flatMap(choice => [choice.effects?.itemId, choice.failure?.effects?.itemId])),
    ...LEGACIES.map(legacy => legacy.effects.itemId),
  ]);
  for (const item of ITEMS) assert.ok(obtainable.has(item.id), `${item.id}: no acquisition route`);
});

test('events have valid requirements, visible finite costs and supported reward effects', () => {
  for (const event of EVENTS) {
    assert.ok(worlds.has(event.worldId), `${event.id}: world`);
    assert.ok(event.body.length >= 20, `${event.id}: meaningful body`);
    assertRequirements(event.requires, event.id);
    assert.equal(ids(event.choices).size, event.choices.length, `${event.id}: choice ID collision`);
    assert.ok(event.choices.length >= 2, `${event.id}: no decision`);
    for (const choice of event.choices) {
      const context = `${event.id}/${choice.id}`;
      assert.ok(choice.label && choice.description && choice.result, `${context}: missing player-facing text`);
      assertRequirements(choice.requires, context);
      knownKeys(choice.cost, ['years', 'spirit', 'herbs', 'hp', 'lifeDamage'], context);
      for (const value of Object.values(choice.cost ?? {})) assert.ok(Number.isSafeInteger(value) && value >= 0, `${context}: invalid cost`);
      assertEffects(choice.effects, context);
      if ('chance' in choice) {
        assert.ok(Number.isFinite(choice.chance) && choice.chance >= 0 && choice.chance <= 1, `${context}: invalid chance`);
        assert.ok(choice.failure?.text, `${context}: risky choice needs explained failure`);
        assert.match(choice.description, /成功率/, `${context}: risk probability not disclosed`);
        assertEffects(choice.failure.effects, context);
      } else assert.equal(choice.failure, undefined, `${context}: unreachable failure`);
    }
  }
});

test('every encounter permits an unconditional, free and nonlethal exit', () => {
  for (const event of EVENTS) {
    assert.ok(event.choices.some(choice => !choice.requires && !choice.cost && !choice.chance && !choice.failure && !choice.effects), `${event.id}: no safe exit`);
  }
});

test('cross-life consequences have guarded founders, explicit follow-ups and earned legacies', () => {
  for (const flag of ['medicine-valley', 'sword-sect', 'old-tomb', 'soul-debt', 'saved-city']) {
    const founders = EVENTS.flatMap(event => event.choices.filter(choice => choice.effects?.worldFlag === flag).map(choice => ({ event, choice })));
    assert.ok(founders.length, `${flag}: no founding deed`);
    for (const { event, choice } of founders) {
      assert.equal(event.requires?.notWorldFlag, flag, `${flag}: deed must not repeat after persistence`);
      assert.ok(choice.effects.flag, `${flag}: missing this-life guard`);
      const followups = EVENTS.filter(followup => followup.requires?.worldFlag === flag && followup.requires?.notFlag === choice.effects.flag);
      assert.ok(followups.length, `${flag}: no follow-up requiring earlier life`);
      assert.ok(followups.some(followup => followup.body.includes('前世')), `${flag}: predecessor not explicit`);
      assert.ok(followups.some(followup => followup.choices.some(next => next.effects?.legacyId)), `${flag}: no earned legacy`);
    }
  }
  assert.ok(EVENTS.some(event => event.choices.some(choice => choice.effects?.removeWorldFlag === 'soul-debt')), 'soul debt has no resolution');
  for (const [id, flag] of Object.entries(WORLD_FLAGS)) assert.ok(flag.name && flag.description.length >= 15, `${id}: insufficient UI explanation`);
});

test('realm progression, regional encounters and main challenges form a finite playable route', () => {
  assert.equal(REALMS.length, 6);
  assert.ok(EVENTS.length >= 45);
  assert.ok(ITEMS.length >= 24);
  for (const [index, realm] of REALMS.entries()) {
    assert.ok(realm.trainYears > 0 && realm.trainGain > 0);
    assert.ok(realm.hp > 0 && realm.attack > 0 && realm.defense >= 0);
    if (index < REALMS.length - 1) {
      assert.ok(realm.need > 0 && realm.breakYears > 0);
      const conservativeTrainingYears = Math.ceil(realm.need / realm.trainGain) * realm.trainYears + realm.breakYears;
      assert.ok(conservativeTrainingYears < realm.lifeCap / 2, `${realm.id}: ordinary progression costs too much life`);
      assert.ok(REALMS[index + 1].lifeCap > realm.lifeCap);
    } else assert.equal(realm.need, 0);
  }
  for (const world of WORLDS) {
    assert.ok(EVENTS.filter(event => event.worldId === world.id).length >= 10, `${world.id}: sparse encounters`);
    assert.ok(ENEMIES.filter(enemy => enemy.worldId === world.id).length >= 3, `${world.id}: missing opposition`);
    const challenges = CHALLENGES.filter(challenge => challenge.worldId === world.id && !challenge.final);
    assert.equal(challenges.length, 1);
    assert.equal(challenges[0].proofId, world.id);
    assert.ok(challenges[0].minRealm >= world.minRealm);
  }
  for (const enemy of ENEMIES) {
    assert.ok(worlds.has(enemy.worldId));
    for (const key of ['hp', 'attack', 'defense']) assert.ok(Number.isSafeInteger(enemy[key]) && enemy[key] >= 0);
    assert.ok(enemy.hp > 0 && enemy.intent);
  }
  for (const challenge of CHALLENGES) {
    assert.ok(enemies.has(challenge.enemyId));
    assert.equal(ENEMIES.find(enemy => enemy.id === challenge.enemyId).worldId, challenge.worldId);
  }
  const finale = CHALLENGES.filter(challenge => challenge.final);
  assert.equal(finale.length, 1);
  assert.equal(finale[0].id, 'finale');
  assert.equal(finale[0].minRealm, REALMS.length - 1);
  assert.equal(finale[0].proofId, null);
});
