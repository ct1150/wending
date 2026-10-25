import test from 'node:test';
import assert from 'node:assert/strict';
import { createCultivation, getCultivationView, chooseCultivation } from '../src/game/cultivation/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { MAX_SAVE_CHARACTERS } from '../src/game/save-size.js';
import { readLegacyBackup } from '../src/game/persistence.js';
import { createGame } from '../src/game/engine.js';

function take(state, id) {
  const view = getCultivationView(state);
  const chosen = view.choices.find(row => row.id === id);
  assert.ok(chosen?.enabled, `${view.sceneId}: ${id} must be available (${chosen?.reason})`);
  const result = chooseCultivation(state, { revision: view.revision, sceneId: view.sceneId, choiceId: id });
  assert.equal(result.kind, 'applied', result.message);
  return result.state;
}

function travel(ids, seed = 'cultivation-route') {
  return ids.reduce(take, createCultivation({ seed }));
}

const toTutor = ['arrival-valley-rope', 'gate-rescue', 'rescue-rope', 'escape-long-path', 'aftermath-take-road', 'farewell-keep-herbs'];
const toMeditation = [...toTutor, 'tutor-herbalist', 'herbal-practice-own'];
const toMountain = [...toMeditation, 'meditate-steady', 'qi-work-mountain', 'apprentice-solid-ground'];
const elixirExpedition = {
  marsh: ['pass-go-adventure', 'marsh-read-plants', 'marsh-help-guide', 'marsh-pool-partner'],
  ruins: ['pass-go-adventure', 'ruins-buy-map', 'ruins-study-wall', 'ruins-open-carefully'],
  caravan: ['pass-go-adventure', 'caravan-take-escort', 'caravan-feed-team', 'caravan-spread-smoke'],
};
const toPill = [...toMountain, ...elixirExpedition.marsh, 'marsh-keep-harvest', 'crossroad-seek-cave', 'cave-build-shelter', 'plan-pill-method', 'medicine-use-herbalism'];

test('a new life starts as a sixteen-year-old mortal with a concrete cultivation goal', () => {
  const state = createCultivation({ seed: 'new-path' });
  const view = getCultivationView(state);
  assert.equal(state.version, 4);
  assert.equal(view.summary.age, 16);
  assert.equal(view.summary.realm, 'mortal');
  assert.equal(view.summary.remainingLife, 56);
  assert.ok(view.goal.length > 5);
  assert.ok(view.choices.length >= 2 && view.choices.length <= 3);
  assert.ok(view.blocks.some(row => /功法|吐纳|修仙|灵气|引气|求仙/.test(row.text)));
});

test('reading a scene is pure and an already submitted choice cannot apply twice', () => {
  const state = createCultivation({ seed: 7 });
  const before = JSON.stringify(state);
  const view = getCultivationView(state);
  assert.deepEqual(getCultivationView(state), view);
  assert.equal(JSON.stringify(state), before);
  const command = { revision: view.revision, sceneId: view.sceneId, choiceId: view.choices.find(c => c.enabled).id };
  const result = chooseCultivation(state, command);
  assert.equal(result.kind, 'applied');
  assert.equal(JSON.stringify(state), before);
  assert.equal(chooseCultivation(result.state, command).kind, 'stale');
});

test('the valley emergency takes days and a complete manual is not an automatic breakthrough', () => {
  const prepared = travel(['arrival-valley-rope', 'gate-rescue', 'rescue-rope', 'escape-long-path']);
  const hurried = travel(['arrival-valley-direct', 'gate-rescue', 'rescue-medicine', 'escape-long-path']);
  for (const state of [prepared, hurried]) {
    assert.equal(state.scene.nodeId, 'valley-aftermath');
    assert.ok(state.world.day - state.life.startDay <= 4);
    assert.equal(state.life.ageDays, 16 * 360 + state.world.day - state.life.startDay);
    assert.equal(state.life.realm, 'mortal');
    assert.equal(state.life.cultivation, 0);
    assert.equal(state.life.items.manual, 1);
    assert.equal(state.world.facts['valley-seed'], 'destroyed');
    assert.deepEqual(deserializeGame(serializeGame(state)), state);
  }
  assert.equal(prepared.life.items.medicine, hurried.life.items.medicine + 1);
  assert.equal(prepared.world.day, hurried.world.day + 1);
});

test('missing rescue equipment is unavailable and cannot consume time or resources', () => {
  const state = travel(['arrival-valley-direct', 'gate-rescue']);
  const before = serializeGame(state);
  const view = getCultivationView(state);
  assert.equal(view.choices.find(row => row.id === 'rescue-rope').enabled, false);
  const result = chooseCultivation(state, { revision: view.revision, sceneId: view.sceneId, choiceId: 'rescue-rope' });
  assert.equal(result.kind, 'unavailable');
  assert.equal(result.state, state);
  assert.equal(serializeGame(state), before);
  const rescued = take(state, 'rescue-medicine');
  assert.equal(rescued.life.items.medicine, 0);
  assert.equal(rescued.life.injury, 0);
});

test('a missed valley rescue window explains the elapsed deadline before the player acts', () => {
  const state = travel(['arrival-valley-rope', 'gate-vault']);
  const rescue = getCultivationView(state).choices.find(row => row.id === 'vault-go-rescue');
  assert.equal(rescue.enabled, false);
  assert.match(rescue.reason, /已过3日/);
  assert.match(rescue.reason, /第2日/);
});

test('an action exceeding retained-history capacity leaves the complete original save exportable', () => {
  // Explicit storage-boundary fixture; padding is retained prose, not a claim
  // that this many characters were generated by the short opening route.
  const state = createCultivation({ seed: 'history-boundary' });
  state.transcript[0].text += '记'.repeat(MAX_SAVE_CHARACTERS - JSON.stringify(state).length);
  const raw = serializeGame(state);
  assert.equal(raw.length, MAX_SAVE_CHARACTERS);
  const result = chooseCultivation(state, { revision: state.revision, sceneId: state.scene.nodeId, choiceId: 'arrival-valley-direct' });
  assert.equal(result.kind, 'unavailable');
  assert.equal(result.state, state);
  assert.equal(serializeGame(result.state), raw);
  assert.deepEqual(deserializeGame(raw), state);
});

test('v4 saves cannot masquerade as old-life backup sources', () => {
  const legacyRaw = serializeGame(createGame({ seed: 5 }));
  const currentRaw = serializeGame(createCultivation({ seed: 5 }));
  for (const field of ['originalRaw', 'currentRaw', 'previousRaw']) {
    const record = { originalRaw: legacyRaw, currentRaw: legacyRaw, previousRaw: legacyRaw, checkpointRaw: null, preparedRaw: null };
    record[field] = currentRaw;
    assert.throws(() => readLegacyBackup({ getItem: () => JSON.stringify(record) }), /旧.*无效/);
  }
});

test('a real teacher teaches one useful method, then qi requires three actual years of cultivation', () => {
  let state = travel(toMeditation);
  assert.equal(state.life.realm, 'mortal');
  assert.deepEqual(state.life.skills, ['herbalism']);
  assert.deepEqual(state.world.legacies, ['herbalism']);
  const before = state.world.day;
  state = take(state, 'meditate-steady');
  assert.equal(state.world.day - before, 3 * 360);
  assert.equal(state.life.realm, 'qi');
  assert.equal(state.life.lifeLimit, 72);
  assert.equal(state.life.cultivation, 1);
  assert.ok(getCultivationView(state).summary.age >= 20);
  assert.ok(state.transcript.some(block => /灵气.*经脉/.test(block.text)));
});

test('hurried training spends personal lifespan separately from elapsed world years', () => {
  let state = travel([...toTutor, 'tutor-quiet']);
  const before = structuredClone(state);
  const choice = getCultivationView(state).choices.find(row => row.id === 'quiet-starve-hurry');
  assert.match(choice.detail, /折损寿元1年/);
  state = take(state, choice.id);
  assert.equal(state.world.day - before.world.day, 360);
  assert.equal(state.life.ageDays - before.life.ageDays, 360);
  assert.equal(state.life.lifeDamageDays - before.life.lifeDamageDays, 360);
  assert.equal(state.life.injury, before.life.injury + 1);
  assert.deepEqual(state.life.skills, ['conceal']);
});

test('birth seeds produce three different advertised expeditions without rerolling on read or restore', () => {
  const seeds = new Map();
  for (let seed = 0; seed < 100 && seeds.size < 3; seed++) {
    const state = createCultivation({ seed });
    seeds.set(state.scene.fate.opportunity, seed);
  }
  assert.equal(seeds.size, 3);
  const titles = new Set();
  for (const [opportunity, seed] of seeds) {
    const state = travel(toMountain, seed);
    const before = serializeGame(state);
    const view = getCultivationView(state);
    assert.equal(state.scene.nodeId, 'mountain-pass');
    assert.equal(state.scene.fate.opportunity, opportunity);
    titles.add(view.title);
    assert.deepEqual(getCultivationView(deserializeGame(before)), view);
    assert.equal(serializeGame(state), before);
    assert.ok(view.choices.find(row => row.id === 'pass-go-adventure').enabled);
  }
  assert.equal(titles.size, 3);
});

test('insufficient lifespan is warned and cannot borrow the reward of an unfinished breakthrough', () => {
  const state = travel([
    'arrival-valley-town', 'market-try-work', 'market-year-work', 'market-accept-debt',
    'farewell-keep-herbs', 'tutor-sword', 'sword-work-training', 'meditate-heal-first',
    'qi-work-mountain', 'apprentice-solid-ground', 'pass-prepare-adventure', 'ruins-probe-slowly',
    'ruins-study-wall', 'ruins-smash-core', 'ruins-share-reading', 'crossroad-repay-work',
    'rest-relearn-breath', 'cave-build-shelter', 'plan-make-last-preparation', 'preparation-six-year-work',
    'plan-warm-method', 'warm-prepare-twelve-years',
  ], 13);
  const view = getCultivationView(state);
  const action = view.choices.find(row => row.id === 'warm-breakthrough-steady');
  assert.equal(view.summary.remainingLifeText, '4年257日');
  assert.equal(action.enabled, true);
  assert.match(action.detail, /余寿已不足以完成/);
  const before = serializeGame(state);
  const ended = take(state, action.id);
  assert.equal(ended.phase, 'ended');
  assert.equal(ended.summary.cause, 'lifespan');
  assert.equal(ended.life.realm, 'qi');
  assert.equal(ended.life.lifeLimit, 72);
  assert.equal(ended.life.cultivation, state.life.cultivation);
  assert.equal(ended.life.facts['foundation-method'], undefined);
  assert.equal(ended.life.ageDays, 67 * 360);
  assert.equal(ended.world.day - state.world.day, 1697);
  assert.equal(serializeGame(state), before);
});

test('a wounded swordsman who maps the ruins without herbs can continue instead of becoming trapped', () => {
  const state = travel([
    'arrival-valley-direct', 'gate-vault', 'vault-book-only', 'escape-long-path',
    'aftermath-take-road', 'farewell-leave-herb', 'tutor-sword', 'sword-work-training',
    'meditate-steady', 'qi-courier-work', 'road-use-sword', 'pass-go-adventure', 'ruins-probe-slowly',
  ], 11);
  assert.equal(state.scene.nodeId, 'ruins-map');
  assert.equal(state.life.injury, 2);
  assert.equal(state.life.items.herb, 0);
  const follow = getCultivationView(state).choices.find(row => row.id === 'ruins-follow-map');
  assert.equal(follow.enabled, true, 'a route actually surveyed with rope must be usable');
  assert.equal(take(state, follow.id).scene.nodeId, 'ruins-seal');
});

test('all three expeditions can actually earn a breakthrough ingredient using learned methods and spent supplies', () => {
  const seeds = new Map();
  for (let seed = 0; seed < 100 && seeds.size < 3; seed++) seeds.set(createCultivation({ seed }).scene.fate.opportunity, seed);
  assert.equal(seeds.size, 3);
  for (const [opportunity, seed] of seeds) {
    const state = travel([...toMountain, ...elixirExpedition[opportunity]], seed);
    assert.equal(state.scene.nodeId, opportunity + '-return');
    assert.equal(state.life.items.essence, 1);
    assert.equal(state.life.realm, 'qi');
    assert.ok(state.life.cultivation >= 3);
    assert.equal(state.phase, 'playing');
    assert.ok(getCultivationView(state).choices.some(row => row.enabled));
    if (opportunity === 'ruins') assert.equal(state.world.facts['ruins-cache'], 'taken');
    assert.deepEqual(deserializeGame(serializeGame(state)), state);
  }
});

test('pill foundation consumes the earned ingredient and three years before increasing lifespan', () => {
  const state = travel(toPill, 1);
  assert.equal(state.scene.nodeId, 'pill-breakthrough');
  const next = take(state, 'pill-breakthrough-steady');
  assert.equal(next.life.items.essence, state.life.items.essence - 1);
  assert.equal(next.world.day - state.world.day, 3 * 360);
  assert.equal(next.life.realm, 'foundation');
  assert.equal(next.life.lifeLimit, 180);
  assert.equal(next.life.facts['foundation-method'], 'pill');
  assert.equal(state.life.realm, 'qi');
});

test('forcing the pill breakthrough delivers the advertised failure, heavy injury and life loss', () => {
  const state = travel(toPill, 1);
  const choice = getCultivationView(state).choices.find(row => row.id === 'pill-breakthrough-force');
  assert.match(choice.detail, /重伤/);
  const next = take(state, choice.id);
  assert.equal(next.life.realm, 'qi');
  assert.equal(next.life.injury, 3);
  assert.equal(next.life.items.essence, state.life.items.essence - 1);
  assert.equal(next.life.lifeDamageDays - state.life.lifeDamageDays, 6 * 360);
  assert.equal(next.world.day - state.world.day, 360);
  assert.equal(next.life.facts['foundation-failed'], 'pill-rush');
});

test('warm foundation needs paid twelve-year preparation and six more years, even without an ingredient', () => {
  let state = travel([...toMountain, 'pass-go-adventure', 'marsh-read-plants', 'marsh-outer-harvest', 'marsh-keep-harvest', 'crossroad-seek-cave', 'cave-build-shelter', 'plan-warm-method'], 1);
  assert.equal(state.life.items.essence ?? 0, 0);
  const start = structuredClone(state);
  state = take(state, 'warm-prepare-twelve-years');
  assert.equal(state.life.realm, 'qi');
  assert.equal(state.world.day - start.world.day, 12 * 360);
  assert.equal(state.life.items.herb, start.life.items.herb - 3);
  assert.equal(state.life.items.stones, start.life.items.stones - 2);
  assert.equal(state.life.facts['warm-foundation'], true);
  state = take(state, 'warm-breakthrough-steady');
  assert.equal(state.world.day - start.world.day, 18 * 360);
  assert.equal(state.life.realm, 'foundation');
  assert.equal(state.life.lifeLimit, 180);
  assert.equal(state.life.facts['foundation-method'], 'warm');
});

test('a second full adventure preserves an emptied ruin and earns new material through a year of refining', () => {
  let state = travel([...toMountain, ...elixirExpedition.ruins, 'ruins-share-reading', 'crossroad-go-home', 'qi-retire-practice-craft', 'qi-last-teach'], 11);
  assert.equal(state.phase, 'ended');
  assert.equal(state.world.facts['ruins-cache'], 'taken');
  const deathDay = state.world.day;
  state = take(state, 'inherit-herbalism');
  assert.equal(state.world.day, deathDay + 16 * 360);
  assert.equal(state.world.generation, 2);
  assert.equal(state.life.ageDays, 16 * 360);
  assert.equal(state.life.realm, 'mortal');
  assert.equal(state.life.cultivation, 0);
  assert.equal(state.life.injury, 0);
  assert.equal(state.life.lifeDamageDays, 0);
  assert.deepEqual(state.life.items, { medicine: 1, stones: 0 });
  assert.deepEqual(state.life.skills, ['herbalism']);
  assert.equal(state.life.legacyId, 'herbalism');
  assert.equal(state.world.facts['ruins-cache'], 'taken');
  assert.equal(state.world.facts['valley-seed'], 'destroyed');
  assert.equal(state.scene.fate.opening, 'ferry');
  assert.equal(state.scene.fate.opportunity, 'ruins');
  const secondPath = ['arrival-ferry-work', 'ferry-mend', 'ferry-use-rigging', 'ferry-claim-book', 'farewell-keep-herbs', 'tutor-herbalist', 'herbal-practice-own', 'meditate-steady', 'qi-work-mountain', 'apprentice-solid-ground', 'pass-go-adventure', 'ruins-buy-map', 'ruins-study-wall'];
  for (const id of secondPath) state = take(state, id);
  assert.ok(state.scene.visited.length >= 13, 'the next life must have a full new journey');
  const view = getCultivationView(state);
  assert.match(view.title, /新矿脉/);
  assert.match(view.choices.find(row => row.id === 'ruins-open-carefully').detail, /历时1年/);
  const before = state.world.day;
  state = take(state, 'ruins-open-carefully');
  assert.equal(state.world.day - before, 360);
  assert.equal(state.life.items.essence, 1);
  assert.equal(state.world.facts['ruins-cache'], 'taken');
  assert.equal(state.world.facts['ruins-core'], undefined, 'the intact but empty room is not rewritten as destroyed');
  assert.deepEqual(deserializeGame(serializeGame(state)), state);
});

test('a clearly fatal expedition choice ends this life without awarding a method for dying', () => {
  const state = travel([...toMountain, 'pass-go-adventure', 'marsh-read-plants', 'marsh-help-guide'], 1);
  const view = getCultivationView(state);
  const risk = view.choices.find(row => row.id === 'marsh-pool-greed');
  assert.match(risk.label, /必死/);
  const next = take(state, risk.id);
  assert.equal(next.phase, 'ended');
  assert.equal(next.summary.cause, 'battle');
  assert.deepEqual(next.world.legacies, state.world.legacies);
  assert.equal(next.life.items.essence ?? 0, 0);
  assert.ok(next.summary.lesson.length > 5);
  const reborn = take(next, 'new-life');
  assert.deepEqual(reborn.life.skills, []);
  assert.equal(reborn.life.legacyId, null);
  assert.equal(reborn.life.realm, 'mortal');
  assert.equal(reborn.world.biography.length, 1);
});

test('settling at home with only half a year left does not instantly heal a failed breakthrough', () => {
  const state = travel(toPill, 1);
  state.life.ageDays = 65 * 360 - 180;
  state.world.day = state.life.startDay + state.life.ageDays - 16 * 360;
  const failed = take(state, 'pill-breakthrough-force');
  assert.equal(failed.life.injury, 3);
  const home = take(failed, 'qi-retire-home-life');
  assert.equal(home.world.day, failed.world.day);
  assert.equal(home.life.injury, 3);
  assert.match(home.transcript.findLast(row => row.kind === 'result').text, /余日不多/);
  const ended = take(home, 'qi-last-quiet');
  assert.equal(ended.phase, 'ended');
  assert.equal(ended.world.day - home.world.day, 180);
});
