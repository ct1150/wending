import test from 'node:test';
import assert from 'node:assert/strict';
import { createCultivation, getCultivationView, chooseCultivation } from '../src/game/cultivation/engine.js';
import { validateCultivation } from '../src/game/cultivation/validation.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';

// A literal save fixture exercises the public import boundary independently of
// the creator, including profiles that are useful for checking bounded effects.
function draftFixture() {
  return {
    version: 4, mode: 'cultivation', contentVersion: 2, revision: 0,
    rng: 1, phase: 'creating',
    world: { day: 360000, generation: 1, facts: {}, legacies: [], biography: [] },
    life: {
      name: '云归', ageDays: 5760, lifeLimit: 72, lifeDamageDays: 0,
      realm: 'mortal', cultivation: 0, injury: 0, skills: [],
      items: { medicine: 1, stones: 0 }, legacyId: null, facts: {}, startDay: 360000,
      birth: { attributes: { constitution: 1, insight: 1, fortune: 1 }, talentId: 'prepared', rollCount: 1 },
    },
    scene: { nodeId: 'arrival', fate: { opening: 'valley', opportunity: 'marsh', pressure: 'rival' }, visited: [] },
    transcript: [], summary: null,
  };
}

function command(state, choiceId, fields = {}) {
  return { revision: state.revision, sceneId: state.scene.nodeId, choiceId, ...fields };
}

function take(state, id, fields) {
  const result = chooseCultivation(state, command(state, id, fields));
  assert.equal(result.kind, 'applied', `${state.scene.nodeId}/${id}: ${result.message}`);
  return result.state;
}

const toTutor = ['arrival-valley-rope', 'gate-rescue', 'rescue-rope', 'escape-long-path', 'aftermath-take-road', 'farewell-keep-herbs'];
const toMeditation = [...toTutor, 'tutor-herbalist', 'herbal-practice-own'];
const woundedToTrial = ['arrival-valley-direct', 'gate-rescue', 'rescue-barehands', 'escape-short-path', 'aftermath-take-road', 'farewell-keep-herbs', 'tutor-herbalist'];

function journey(profile, ids) {
  const draft = draftFixture();
  draft.life.birth = { ...draft.life.birth, ...profile, attributes: { ...draft.life.birth.attributes, ...profile.attributes } };
  return ids.reduce(take, take(draft, 'birth-start'));
}

test('an opted-in birth remains an exportable draft with a fixed preview until the player starts', () => {
  const state = createCultivation({ seed: 'creation-save', characterCreation: true, name: '  林遥  ' });
  assert.equal(state.contentVersion, 2);
  assert.equal(state.phase, 'creating');
  assert.equal(state.life.name, '林遥');
  assert.equal(state.life.ageDays, 5760);
  assert.equal(state.world.day, 360000);
  assert.deepEqual(state.scene.visited, []);
  assert.deepEqual(state.transcript, []);
  assert.deepEqual(state.life.items, { medicine: 1, stones: 0 });
  assert.deepEqual(state.life.skills, []);
  assert.deepEqual(state.world.legacies, []);
  const raw = serializeGame(state);
  const view = getCultivationView(state);
  assert.equal(view.creation.name, '林遥');
  assert.equal(view.creation.rollCount, 1);
  assert.equal(view.creation.attributes.length, 3);
  assert.equal(view.creation.talents.length, 1);
  assert.deepEqual(view.summary.attributes, view.creation.attributes);
  assert.deepEqual(view.summary.talents, view.creation.talents);
  assert.deepEqual(view.blocks, []);
  assert.deepEqual(getCultivationView(deserializeGame(raw)), view);
  assert.deepEqual(getCultivationView(state), view);
  assert.equal(serializeGame(state), raw);
});

test('renaming and explicit rerolling have distinct persisted effects and reject replayed commands', () => {
  let state = draftFixture();
  const initial = structuredClone(state);
  state = take(state, 'birth-name', { name: '  顾长安  ' });
  assert.equal(state.life.name, '顾长安');
  assert.equal(state.rng, 1);
  assert.deepEqual(state.life.birth, initial.life.birth);
  assert.deepEqual(state.world, initial.world);
  const before = serializeGame(state);
  const request = command(state, 'birth-reroll');
  const result = chooseCultivation(state, request);
  assert.equal(result.kind, 'applied');
  assert.equal(serializeGame(state), before);
  // Four known xorshift32 draws from state 1; a read/name/start draw would
  // change the next profile and break deterministic restoration.
  assert.equal(result.state.rng, 307599695);
  assert.deepEqual(result.state.life.birth, {
    attributes: { constitution: 1, insight: 1, fortune: 4 }, talentId: 'prepared', rollCount: 2,
  });
  assert.equal(result.state.life.name, '顾长安');
  assert.deepEqual(result.state.world, initial.world);
  assert.deepEqual(result.state.scene, initial.scene);
  assert.deepEqual(result.state.life.items, initial.life.items);
  assert.deepEqual(result.state.transcript, []);
  assert.equal(chooseCultivation(result.state, request).kind, 'stale');
  assert.deepEqual(chooseCultivation(deserializeGame(before), request), result);
});

test('invalid draft names and creation commands preserve the complete prior state', () => {
  const state = draftFixture(), before = serializeGame(state);
  for (const name of ['', '   ', '名'.repeat(25), '林\n遥', '林\u0000遥', 42, null]) {
    for (const id of ['birth-name', 'birth-start']) {
      const result = chooseCultivation(state, command(state, id, { name }));
      assert.equal(result.kind, 'unavailable', `${id}: ${String(name)}`);
      assert.equal(result.state, state);
      assert.equal(serializeGame(state), before);
    }
  }
  for (const choiceId of ['arrival-valley-direct', 'unknown']) {
    const result = chooseCultivation(state, command(state, choiceId));
    assert.equal(result.kind, 'unavailable');
    assert.equal(result.state, state);
  }
  assert.equal(chooseCultivation(state, { ...command(state, 'birth-start'), sceneId: 'valley-gate' }).kind, 'stale');
  assert.throws(() => createCultivation({ characterCreation: true, name: ' ' }), /姓名|名字/);
});

test('name entry rejects raw edge controls before trimming ordinary surrounding spaces', () => {
  const state = draftFixture(), raw = serializeGame(state);
  const controlCodes = [...Array.from({ length: 32 }, (_, i) => i), ...Array.from({ length: 33 }, (_, i) => 127 + i), 0x2028, 0x2029];
  for (const code of controlCodes) {
    const control = String.fromCodePoint(code);
    for (const name of [control + '云归', '云归' + control]) {
      assert.throws(() => createCultivation({ characterCreation: true, name }), /姓名|名字/, `creator control ${code}`);
      for (const id of ['birth-name', 'birth-start']) {
        const result = chooseCultivation(state, command(state, id, { name }));
        assert.equal(result.kind, 'unavailable', `${id} control ${code}`);
        assert.equal(result.state, state);
        assert.equal(serializeGame(state), raw);
      }
    }
  }
  assert.equal(take(state, 'birth-name', { name: '  云归  ' }).life.name, '云归');
});

test('starting applies finite birth supplies once, uses the chosen name and does not advance time or RNG', () => {
  const state = draftFixture();
  state.life.birth.attributes.fortune = 6;
  const before = serializeGame(state), request = command(state, 'birth-start', { name: '山中客' });
  const result = chooseCultivation(state, request);
  assert.equal(result.kind, 'applied');
  const started = result.state;
  assert.equal(started.phase, 'playing');
  assert.equal(started.life.name, '山中客');
  assert.equal(started.rng, state.rng);
  assert.equal(started.world.day, state.world.day);
  assert.equal(started.life.ageDays, state.life.ageDays);
  assert.deepEqual(started.life.items, { medicine: 2, stones: 2 });
  assert.deepEqual(started.scene.visited, ['arrival']);
  assert.ok(started.transcript.some(block => block.text.includes('你叫山中客')));
  assert.ok(!started.transcript.some(block => block.text.includes('你叫云归')));
  assert.equal(started.life.realm, 'mortal');
  assert.equal(started.life.cultivation, 0);
  assert.deepEqual(started.life.skills, []);
  assert.deepEqual(started.world.legacies, []);
  assert.equal(serializeGame(state), before);
  assert.equal(chooseCultivation(started, request).kind, 'stale');
  for (const id of ['birth-start', 'birth-reroll', 'birth-name']) {
    const rejected = chooseCultivation(started, command(started, id, { name: '改名' }));
    assert.equal(rejected.kind, 'unavailable');
    assert.equal(rejected.state, started);
  }
  assert.deepEqual(deserializeGame(serializeGame(started)), started);
});

test('the four talents and fortune tiers give only their finite advertised starting supplies', () => {
  for (const [talentId, fortune, items] of [
    ['prepared', 1, { medicine: 2, stones: 0 }],
    ['herb-affinity', 3, { medicine: 1, stones: 1, herb: 1 }],
    ['focused', 6, { medicine: 1, stones: 2 }],
    ['restful', 6, { medicine: 1, stones: 2 }],
  ]) {
    const state = journey({ talentId, attributes: { fortune } }, []);
    assert.deepEqual(state.life.items, items, talentId);
    assert.deepEqual(state.life.skills, [], talentId);
    assert.deepEqual(state.world.legacies, [], talentId);
    const view = getCultivationView(state);
    assert.equal(view.summary.talents[0].id, talentId);
    assert.ok(view.summary.talents[0].description.length > 5);
    assert.equal(view.creation, undefined);
  }
});

test('insight and focus improve earned qi cultivation without bypassing years, a manual or learned methods', () => {
  for (const [insight, talentId, expected] of [[1, 'prepared', 1], [3, 'prepared', 2], [6, 'prepared', 3], [6, 'focused', 4]]) {
    const before = journey({ talentId, attributes: { insight } }, toMeditation);
    assert.deepEqual(before.life.skills, ['herbalism']);
    assert.deepEqual(before.world.legacies, ['herbalism']);
    assert.equal(before.life.cultivation, 0);
    const after = take(before, 'meditate-steady');
    assert.equal(after.life.cultivation, expected);
    assert.equal(after.world.day - before.world.day, 1080);
    assert.equal(after.life.ageDays - before.life.ageDays, 1080);
    assert.equal(after.life.realm, 'qi');
    assert.equal(after.life.lifeLimit, 72);
    const worked = take(after, 'qi-work-mountain');
    assert.equal(worked.life.cultivation, expected + 1, 'the first qi bonus must not repeat on later training');
    assert.equal(worked.world.day - after.world.day, 1440);
    const withoutManual = structuredClone(before);
    withoutManual.life.items.manual = 0;
    const refused = chooseCultivation(withoutManual, command(withoutManual, 'meditate-steady'));
    assert.equal(refused.kind, 'unavailable');
    assert.equal(refused.state, withoutManual);
  }
});

test('constitution and restful only enhance authored healing and cannot cancel guaranteed harm', () => {
  for (const [constitution, talentId, afterHealing] of [[1, 'prepared', 1], [3, 'prepared', 0], [6, 'prepared', 0], [1, 'restful', 0]]) {
    const wounded = journey({ talentId, attributes: { constitution } }, woundedToTrial);
    assert.equal(wounded.life.injury, 2, 'two explicitly dangerous choices still produce two injuries');
    const healed = take(wounded, 'herbal-practice-own');
    assert.equal(healed.life.injury, afterHealing);
    assert.equal(healed.world.day - wounded.world.day, 360);
    assert.equal(healed.life.items.herb, wounded.life.items.herb + 1, 'the same actual material is spent before receiving the authored herbs');
    assert.deepEqual(healed.life.skills, ['herbalism']);
    assert.equal(healed.life.lifeLimit, 72);
  }
});

test('CV2 rebirth preserves world history and one learned legacy while preparing a fresh unsupplied profile', () => {
  let ended = journey({ talentId: 'focused', attributes: { constitution: 6, insight: 6, fortune: 6 } }, [
    ...toMeditation, 'meditate-return-home', 'mortal-stay-with-family', 'mortal-finish-life',
  ]);
  assert.equal(ended.phase, 'ended');
  ended.rng = 1;
  const deathDay = ended.world.day;
  const born = take(ended, 'inherit-herbalism');
  assert.equal(born.contentVersion, 2);
  assert.equal(born.phase, 'creating');
  assert.equal(born.world.day, deathDay + 5760);
  assert.equal(born.world.generation, 2);
  assert.deepEqual(born.world.facts, ended.world.facts);
  assert.deepEqual(born.world.biography, ended.world.biography);
  assert.deepEqual(born.world.legacies, ['herbalism']);
  assert.deepEqual(born.life.skills, ['herbalism']);
  assert.equal(born.life.legacyId, 'herbalism');
  assert.equal(born.life.ageDays, 5760);
  assert.equal(born.life.startDay, born.world.day);
  assert.equal(born.life.realm, 'mortal');
  assert.equal(born.life.cultivation, 0);
  assert.equal(born.life.injury, 0);
  assert.equal(born.life.lifeDamageDays, 0);
  assert.deepEqual(born.life.items, { medicine: 1, stones: 0 });
  assert.equal(born.rng, 632435482);
  assert.deepEqual(born.life.birth, {
    attributes: { constitution: 1, insight: 4, fortune: 2 }, talentId: 'prepared', rollCount: 1,
  });
  const view = getCultivationView(born);
  assert.deepEqual(view.blocks, []);
  assert.deepEqual(view.summary.priorTranscript.slice(0, ended.transcript.length), ended.transcript);
  assert.equal(view.summary.priorTranscript.length, born.transcript.length);
  assert.deepEqual(deserializeGame(serializeGame(born)), born);
  const restarted = take(born, 'birth-start', { name: '顾长安' });
  assert.equal(restarted.rng, born.rng);
  assert.equal(restarted.world.day, born.world.day);
  assert.ok(getCultivationView(restarted).blocks.some(block => block.text.includes('顾长安')));
  assert.deepEqual(restarted.life.skills, ['herbalism']);
});

test('CV2 validation rejects malformed profiles and any progressed body or prose in a draft', () => {
  assert.equal(validateCultivation(draftFixture()).phase, 'creating');
  const mutations = [
    s => { delete s.life.birth; },
    s => { s.life.birth.extra = true; },
    s => { s.life.birth.attributes = []; },
    s => { delete s.life.birth.attributes.insight; },
    s => { s.life.birth.attributes.fortune = 7; },
    s => { s.life.birth.attributes.constitution = 0; },
    s => { s.life.birth.attributes.insight = 1.5; },
    s => { s.life.birth.talentId = 'herbalism'; },
    s => { s.life.birth.rollCount = 0; },
    s => { s.life.birth.rollCount = Number.MAX_SAFE_INTEGER + 1; },
    s => { s.life.name = ' '.repeat(2); },
    s => { s.life.name = '名'.repeat(25); },
    s => { s.life.name = '林\n遥'; },
    s => { s.life.ageDays++; s.world.day++; },
    s => { s.life.cultivation = 1; },
    s => { s.life.injury = 1; },
    s => { s.life.lifeDamageDays = 1; },
    s => { s.life.items.medicine = 2; },
    s => { s.life.items.herb = 1; },
    s => { s.life.skills.push('herbalism'); s.world.legacies.push('herbalism'); },
    s => { s.life.facts['valley-rope'] = true; },
    s => { s.scene.nodeId = 'valley-gate'; },
    s => { s.scene.visited.push('arrival'); },
    s => { s.transcript.push({ id: 'cultivation-1', sceneId: 'arrival', kind: 'narration', text: '已经入世。' }); },
    s => { s.contentVersion = 1; },
  ];
  for (const mutate of mutations) {
    const state = draftFixture();
    mutate(state);
    assert.throws(() => validateCultivation(state), /存档/);
  }
  let calls = 0;
  const accessor = draftFixture();
  Object.defineProperty(accessor.life.birth.attributes, 'insight', { enumerable: true, get() { calls++; return 6; } });
  assert.throws(() => validateCultivation(accessor), /存档/);
  assert.equal(calls, 0, 'profile validation must not execute accessors');
});

test('CV2 cannot skip the birth transition by declaring an unentered draft to be playing', () => {
  const skipped = draftFixture();
  skipped.phase = 'playing';
  assert.throws(() => validateCultivation(skipped), /存档/);
  const started = take(draftFixture(), 'birth-start');
  for (const mutate of [
    s => { s.scene.visited = []; },
    s => { s.transcript = []; },
    s => { s.transcript[0].sceneId = 'valley-gate'; },
  ]) {
    const incomplete = structuredClone(started);
    mutate(incomplete);
    assert.throws(() => validateCultivation(incomplete), /存档/);
  }
});

test('a first-generation draft cannot disguise existing narration as a previous life', () => {
  const state = draftFixture();
  state.transcript.push({ id: 'cultivation-1', sceneId: 'arrival', kind: 'narration', text: '虚构的前世。' });
  state.life.facts['transcript-start'] = 1;
  assert.throws(() => validateCultivation(state), /存档/);
  assert.throws(() => deserializeGame(JSON.stringify(state)), /存档/);
});

test('old CV1 creation retains its fate sequence, exact save shape and absence of random birth modifiers', () => {
  const state = createCultivation({ seed: 1 });
  assert.equal(state.contentVersion, 1);
  assert.equal(state.phase, 'playing');
  assert.equal(state.rng, 245069412);
  assert.deepEqual(state.scene.fate, { opening: 'valley', opportunity: 'marsh', pressure: 'rival' });
  assert.equal(Object.hasOwn(state.life, 'birth'), false);
  const raw = serializeGame(state), view = getCultivationView(state);
  assert.deepEqual(view.summary.attributes, []);
  assert.deepEqual(view.summary.talents, []);
  assert.deepEqual(deserializeGame(raw), state);
  assert.equal(serializeGame(state), raw);
});

test('severe known risks remain separately visible when routine choice details are hidden', () => {
  const rescue = journey({}, ['arrival-valley-direct', 'gate-rescue']);
  const hurt = getCultivationView(rescue).choices.find(row => row.id === 'rescue-barehands');
  assert.match(hurt.warning, /伤/);
  const training = journey({}, [...toTutor, 'tutor-quiet']);
  const rushed = getCultivationView(training).choices.find(row => row.id === 'quiet-starve-hurry');
  assert.match(rushed.warning, /折损寿元1年/);
  const terminal = journey({ attributes: { constitution: 6 }, talentId: 'restful' }, ['arrival-valley-direct', 'gate-rescue', 'rescue-barehands']);
  terminal.life.injury = 2;
  const fatal = getCultivationView(terminal).choices.find(row => row.id === 'escape-short-path');
  assert.match(fatal.warning, /必死|陨落|失去性命/);
  const ended = take(terminal, 'escape-short-path');
  assert.equal(ended.summary.cause, 'battle');
  assert.deepEqual(ended.world.legacies, []);
  const exhausted = journey({}, toMeditation);
  exhausted.life.ageDays = 71 * 360;
  exhausted.world.day = exhausted.life.startDay + exhausted.life.ageDays - 5760;
  const tooLong = getCultivationView(exhausted).choices.find(row => row.id === 'meditate-steady');
  assert.match(tooLong.warning, /余寿.*不足|寿尽/);
  const noTime = take(exhausted, 'meditate-steady');
  assert.equal(noTime.life.realm, 'mortal');
  assert.equal(noTime.life.cultivation, 0);
});
