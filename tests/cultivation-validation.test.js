import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCultivation } from '../src/game/cultivation/validation.js';
import { createCultivation, getCultivationView, chooseCultivation } from '../src/game/cultivation/engine.js';

// Deliberately literal: validation must accept the documented save boundary
// independently of the engine that produces it.
function fixture() {
  return {
    version: 4, mode: 'cultivation', contentVersion: 1, revision: 0,
    rng: 1, phase: 'playing',
    world: { day: 360000, generation: 1, facts: {}, legacies: [], biography: [] },
    life: {
      name: '云归', ageDays: 5760, lifeLimit: 72, lifeDamageDays: 0,
      realm: 'mortal', cultivation: 0, injury: 0, skills: [],
      items: { medicine: 1, stones: 0 }, legacyId: null, facts: {}, startDay: 360000,
    },
    scene: {
      nodeId: 'arrival',
      fate: { opening: 'valley', opportunity: 'marsh', pressure: 'rival' },
      visited: [],
    },
    transcript: [], summary: null,
  };
}

function endedFixture(cause = 'lifespan') {
  const state = fixture();
  if (cause === 'lifespan') {
    state.world.day = 380160;
    state.life.ageDays = 25920;
  }
  state.phase = 'ended';
  state.scene.nodeId = 'ended';
  state.life.skills = ['herbalism'];
  state.world.legacies = ['herbalism'];
  state.life.facts['deed-1'] = '采药养息';
  state.summary = {
    cause, title: '山居一生', generation: 1,
    age: cause === 'lifespan' ? 72 : 16,
    realm: 'mortal', achievement: '学会了草木辨识', lesson: '先备护身之法',
  };
  state.world.biography = [{
    ...state.summary, name: '云归', year: cause === 'lifespan' ? 1056 : 1000,
    legacyId: null, skills: ['herbalism'], deeds: ['采药养息'],
  }];
  return state;
}

function rejects(mutate, label, base = fixture) {
  const state = base();
  mutate(state);
  assert.throws(() => validateCultivation(state), /存档/, label);
}

test('v4 validation preserves the documented state and accepts a JSON round trip', () => {
  const state = fixture(), before = JSON.stringify(state);
  assert.equal(validateCultivation(state), state);
  assert.equal(JSON.stringify(state), before);
  const restored = JSON.parse(before);
  assert.equal(validateCultivation(restored), restored);
  assert.deepEqual(restored, state);
});

test('v4 requires the complete supported top-level format', () => {
  for (const input of [null, undefined, [], true, 4, 'save']) {
    assert.throws(() => validateCultivation(input), /存档/);
  }
  for (const field of Object.keys(fixture())) {
    rejects(state => { delete state[field]; }, `missing ${field}`);
  }
  for (const [field, value] of [['version', 3], ['mode', 'dialogue'], ['contentVersion', 2], ['phase', 'victory']]) {
    rejects(state => { state[field] = value; }, `unsupported ${field}`);
  }
  rejects(state => { state.extraState = {}; }, 'unknown structural fields');
});

test('v4 rejects missing nested fields and values that cannot be restored as records', () => {
  for (const section of ['world', 'life', 'scene']) {
    for (const field of Object.keys(fixture()[section])) {
      rejects(state => { delete state[section][field]; }, `missing ${section}.${field}`);
    }
    for (const value of [null, [], 'record']) rejects(state => { state[section] = value; }, section);
  }
  for (const field of ['opening', 'opportunity', 'pressure']) {
    rejects(state => { delete state.scene.fate[field]; }, `missing fate.${field}`);
  }
});

test('v4 dates, counters, resources and bounded conditions reject unsafe numbers', () => {
  const cases = [
    ['revision', -1], ['revision', 0.5], ['revision', Number.MAX_SAFE_INTEGER + 1],
    ['rng', 0], ['rng', -1], ['rng', 4294967296], ['rng', 1.5],
    ['world.day', Infinity], ['world.generation', 0], ['world.generation', 1.1],
    ['life.ageDays', -1], ['life.ageDays', NaN], ['life.ageDays', 5760.5],
    ['life.lifeLimit', 73], ['life.lifeDamageDays', -1], ['life.lifeDamageDays', 0.5],
    ['life.lifeDamageDays', 25921], ['life.cultivation', -1], ['life.cultivation', 7],
    ['life.cultivation', 0.5], ['life.injury', -1], ['life.injury', 4], ['life.injury', 1.5],
    ['life.items.medicine', -1], ['life.items.medicine', 10000], ['life.items.medicine', 0.5],
  ];
  for (const [path, value] of cases) {
    rejects(state => {
      const keys = path.split('.');
      const target = keys.slice(0, -1).reduce((record, key) => record[key], state);
      target[keys.at(-1)] = value;
    }, `${path}: ${String(value)}`);
  }
  const boundary = fixture();
  boundary.rng = 4294967295;
  boundary.revision = Number.MAX_SAFE_INTEGER;
  boundary.life.items.medicine = 9999;
  boundary.life.cultivation = 6;
  boundary.life.injury = 3;
  assert.equal(validateCultivation(boundary), boundary);
});

test('v4 keeps elapsed world days and personal age coherent without imposing a death-age ceiling', () => {
  rejects(state => { state.life.startDay++; }, 'future life start');
  rejects(state => { state.world.day++; }, 'world time changed without aging');
  rejects(state => { state.life.ageDays++; }, 'age changed without world time');
  rejects(state => { state.life.realm = 'foundation'; }, 'realm and lifespan disagree');
  const older = endedFixture();
  older.world.day = 381960;
  older.life.ageDays = 27720;
  older.summary.age = 77;
  older.world.biography[0].age = 77;
  older.world.biography[0].year = 1061;
  assert.equal(validateCultivation(older), older);
  const foundation = fixture();
  foundation.life.realm = 'foundation'; foundation.life.lifeLimit = 180;
  assert.equal(validateCultivation(foundation), foundation);
});

test('v4 rejects unknown items, skills, realms and scene references', () => {
  const mutations = [
    state => { state.life.items.invented = 1; },
    state => { state.life.skills = ['invented']; },
    state => { state.world.legacies = ['invented']; },
    state => { state.life.legacyId = 'invented'; },
    state => { state.life.realm = 'invented'; },
    state => { state.scene.nodeId = 'invented'; },
    state => { state.scene.visited = ['invented']; },
    state => { state.transcript = [{ id: 'cultivation-1', sceneId: 'invented', kind: 'narration', text: '记' }]; },
  ];
  for (const mutate of mutations) rejects(mutate, 'unknown content reference');
});

test('v4 saves a fixed fate and never accepts an unknown or missing fate branch', () => {
  for (const field of ['opening', 'opportunity', 'pressure']) {
    rejects(state => { state.scene.fate[field] = 'invented'; }, field);
  }
  rejects(state => { state.scene.fate.opening = 'market'; }, 'first life opens at the valley');
  const later = fixture(); later.world.generation = 2;
  later.scene.fate = { opening: 'ferry', opportunity: 'caravan', pressure: 'storm' };
  assert.equal(validateCultivation(later), later);
});

test('v4 inheritance refers to one earned skill and skill collections are unique', () => {
  const state = fixture();
  state.world.legacies = ['herbalism', 'conceal'];
  state.life.skills = ['herbalism']; state.life.legacyId = 'herbalism';
  assert.equal(validateCultivation(state), state);
  rejects(value => { value.life.legacyId = 'herbalism'; }, 'unearned active legacy');
  rejects(value => { value.world.legacies = ['herbalism']; value.life.legacyId = 'herbalism'; }, 'active legacy absent from skills');
  rejects(value => { value.life.skills = ['sword', 'sword']; }, 'duplicate skill');
  rejects(value => { value.world.legacies = ['conceal', 'conceal']; }, 'duplicate legacy');
});

test('v4 facts accept bounded primitive story markers, including null and empty text', () => {
  const state = fixture();
  state.world.facts = { 'valley-seed': 'destroyed', '后来人的约定': null, promise: false, amount: -2.5, blank: '', far: Number.MAX_VALUE };
  state.life.facts = { ['记'.repeat(80)]: '事'.repeat(200) };
  assert.equal(validateCultivation(state), state);
  state.world.facts = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`fact-${i}`, true]));
  assert.equal(validateCultivation(state), state);
  state.world.facts['one-more'] = true;
  assert.throws(() => validateCultivation(state), /存档/);
});

test('v4 facts reject nonfinite values, nested objects and oversized keys or text', () => {
  for (const value of [NaN, Infinity, -Infinity, undefined, 1n, [], {}, () => true, Symbol('value')]) {
    rejects(state => { state.life.facts.marker = value; }, `invalid fact ${String(value)}`);
  }
  rejects(state => { state.world.facts[''] = true; }, 'empty fact key');
  rejects(state => { state.world.facts['x'.repeat(81)] = true; }, 'oversized fact key');
  rejects(state => { state.world.facts.marker = '记'.repeat(201); }, 'oversized fact text');
  rejects(state => { state.life.facts.self = state.life.facts; }, 'circular facts');
});

test('v4 reserved deed markers remain usable when the current life is settled', () => {
  const state = fixture();
  for (let index = 1; index <= 8; index++) state.life.facts[`deed-${index}`] = '亲历的一件事';
  assert.equal(validateCultivation(state), state);
  rejects(value => { value.life.facts['deed-1'] = false; }, 'non-text deed');
  rejects(value => { value.life.facts['deed-9'] = '多出的一件事'; }, 'deed overflow');
  rejects(value => { value.life.facts['deed-01'] = '重复编号'; }, 'ambiguous deed slot');
});

test('v4 refuses prototype pollution keys and custom prototypes at every record boundary', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    for (const path of ['world', 'life', 'scene']) {
      rejects(state => { Object.defineProperty(state[path], key, { enumerable: true, value: true }); }, `${path}.${key}`);
    }
    rejects(state => { state.world.facts = JSON.parse(`{"${key}":true}`); }, `fact ${key}`);
  }
  rejects(state => { Object.setPrototypeOf(state.life, { extra: true }); }, 'custom life prototype');
  rejects(state => { state.life.facts = new Date(); }, 'non-plain facts');
  const plain = fixture();
  plain.world.facts = Object.create(null); plain.life.items = Object.assign(Object.create(null), { medicine: 1 });
  assert.equal(validateCultivation(plain), plain);
});

test('v4 rejects getters and serialization hooks without executing them', () => {
  let calls = 0;
  const state = fixture();
  Object.defineProperty(state.life.facts, 'marker', { enumerable: true, get() { calls++; return true; } });
  assert.throws(() => validateCultivation(state), /存档/);
  const hook = fixture();
  hook.toJSON = () => { calls++; return fixture(); };
  assert.throws(() => validateCultivation(hook), /存档/);
  const field = fixture();
  Object.defineProperty(field.world, 'day', { enumerable: true, get() { calls++; return 360000; } });
  assert.throws(() => validateCultivation(field), /存档/);
  assert.equal(calls, 0);
});

test('v4 refuses fields that JSON would silently erase and arrays with hidden data or holes', () => {
  rejects(state => { state.world.facts[Symbol('hidden')] = true; }, 'symbol key');
  rejects(state => { Object.defineProperty(state.world.facts, 'hidden', { value: true }); }, 'nonenumerable fact');
  rejects(state => { state.life.skills = Array(1); }, 'sparse skill list');
  rejects(state => { state.scene.visited.extra = true; }, 'array extra property');
  rejects(state => { Object.setPrototypeOf(state.transcript, {}); }, 'array custom prototype');
  rejects(state => { Object.defineProperty(state.scene.visited, 0, { enumerable: true, get() { throw new Error('must not execute'); } }); }, 'array accessor');
});

test('v4 history lists reject overflow and allow repeated visited scenes', () => {
  const state = fixture(); state.scene.visited = Array(300).fill('arrival');
  assert.equal(validateCultivation(state), state);
  rejects(value => { value.scene.visited = Array(301).fill('arrival'); }, 'visited overflow');
  rejects(value => { value.transcript = Array(30001).fill(null); }, 'transcript overflow');
  rejects(value => { value.world.biography = Array(301).fill(null); }, 'biography overflow');
  const historical = fixture(); historical.world.generation = 301;
  historical.world.biography = Array.from({ length: 300 }, (_, i) => ({
    cause: 'battle', title: '山路逢险', generation: i + 1, age: 16, realm: 'mortal',
    achievement: '曾求仙途', lesson: '备好护身之物', name: '云归', year: 1000,
    legacyId: null, skills: [], deeds: [],
  }));
  assert.equal(validateCultivation(historical), historical);
});

test('v4 transcript blocks preserve dialogue and choice metadata with unique finite IDs', () => {
  const state = fixture();
  state.transcript = [
    { id: 'cultivation-1', sceneId: 'arrival', kind: 'dialogue', text: '去山外试一试。', speaker: '阿青' },
    { id: 'cultivation-2', sceneId: 'arrival', kind: 'action', text: '背起药篓。', choiceId: 'gather-herbs' },
  ];
  state.life.facts['transcript-start'] = 0;
  assert.equal(validateCultivation(state), state);
  for (const [field, value] of [['id', 'script'], ['kind', 'script'], ['text', {}], ['speaker', 7], ['choiceId', {}]]) {
    const bad = structuredClone(state); bad.transcript[0][field] = value;
    assert.throws(() => validateCultivation(bad), /存档/, field);
  }
  const duplicate = structuredClone(state); duplicate.transcript[1].id = 'cultivation-1';
  assert.throws(() => validateCultivation(duplicate), /存档/);
  for (const value of [-1, 0.5, 3]) {
    const bad = structuredClone(state); bad.life.facts['transcript-start'] = value;
    assert.throws(() => validateCultivation(bad), /存档/);
  }
});

test('v4 rejects nonsequential transcript IDs that would collide with the next appended action', () => {
  for (const id of ['cultivation-0', 'cultivation-2', 'cultivation-999999']) {
    rejects(state => {
      state.transcript = [{ id, sceneId: 'arrival', kind: 'narration', text: '记' }];
    }, `unsafe next append after ${id}`);
  }
  rejects(state => {
    state.transcript = [
      { id: 'cultivation-2', sceneId: 'arrival', kind: 'narration', text: '记' },
      { id: 'cultivation-1', sceneId: 'arrival', kind: 'narration', text: '记' },
    ];
  }, 'swapped transcript IDs');
});

test('v4 living and ended phases agree with the scene, remaining life and summary', () => {
  rejects(state => { state.scene.nodeId = 'ended'; }, 'living at ending scene');
  rejects(state => { state.summary = {}; }, 'living with a summary');
  rejects(state => { state.world.day = 380160; state.life.ageDays = 25920; }, 'living after lifespan exhaustion');
  for (const cause of ['battle', 'lifespan', 'retired']) {
    const ended = endedFixture(cause);
    assert.equal(validateCultivation(ended), ended);
  }
  for (const mutate of [
    state => { state.summary = null; },
    state => { state.scene.nodeId = 'arrival'; },
    state => { state.summary.cause = 'victory'; },
    state => { state.summary.age--; },
    state => { state.summary.generation++; },
    state => { state.summary.realm = 'qi'; },
    state => { delete state.summary.lesson; },
    state => { state.world.biography = []; },
  ]) rejects(mutate, 'incoherent ending', endedFixture);
  rejects(state => { state.summary.cause = 'lifespan'; state.world.biography[0].cause = 'lifespan'; }, 'lifespan ending with remaining life', () => endedFixture('battle'));
});

test('v4 current biography agrees with the ending and historical records remain finite', () => {
  for (const mutate of [
    state => { state.world.biography[0].name = '另一个人'; },
    state => { state.world.biography[0].year--; },
    state => { state.world.biography[0].title = '另一结局'; },
    state => { state.world.biography[0].skills = []; },
    state => { state.world.biography[0].skills = ['invented']; },
    state => { state.world.biography[0].deeds = Array(9).fill('事'); },
    state => { state.world.biography[0].deeds = ['记'.repeat(201)]; },
    state => { state.world.biography.push(structuredClone(state.world.biography[0])); },
  ]) rejects(mutate, 'malformed biography', endedFixture);
  const playing = endedFixture();
  playing.phase = 'playing'; playing.scene.nodeId = 'arrival'; playing.summary = null;
  playing.life.ageDays = 5760; playing.life.startDay = playing.world.day;
  assert.throws(() => validateCultivation(playing), /存档/, 'unended current life already recorded');
  playing.world.generation = 2;
  assert.equal(validateCultivation(playing), playing);
});

test('v4 uses the shared exact character limit without mutating or trimming retained prose', () => {
  const state = fixture();
  state.transcript = [{ id: 'cultivation-1', sceneId: 'arrival', kind: 'narration', text: '' }];
  state.transcript[0].text = '记'.repeat(1000000 - JSON.stringify(state).length);
  const before = JSON.stringify(state);
  assert.equal(before.length, 1000000);
  assert.equal(validateCultivation(state), state);
  assert.equal(JSON.stringify(state), before);
  state.transcript[0].text += '记';
  assert.throws(() => validateCultivation(state), error => error.code === 'SAVE_SIZE_LIMIT' && /存档/.test(error.message));
  assert.equal(JSON.stringify(state).length, 1000001);
});

test('v4 restores genuine command-produced lives with identical choices, results and next RNG', () => {
  for (const seed of [1, 7, '旧谷新途']) {
    let state = createCultivation({ seed });
    let endings = 0;
    for (let step = 0; step < 120; step++) {
      const raw = JSON.stringify(state);
      assert.equal(validateCultivation(state), state);
      const restored = JSON.parse(raw);
      assert.equal(validateCultivation(restored), restored);
      const view = getCultivationView(state);
      assert.deepEqual(getCultivationView(restored), view);
      assert.equal(JSON.stringify(state), raw);
      if (state.world.generation === 3) break;
      const choice = state.phase === 'ended'
        ? view.choices.find(row => endings === 0 ? row.id.startsWith('inherit-') : row.id === 'new-life') || view.choices.find(row => row.id === 'new-life')
        : view.choices.find(row => row.enabled);
      assert.ok(choice, `no available continuation at ${state.scene.nodeId}`);
      if (state.phase === 'ended') endings++;
      const command = { revision: view.revision, sceneId: view.sceneId, choiceId: choice.id };
      const result = chooseCultivation(state, command);
      assert.equal(result.kind, 'applied', `${state.scene.nodeId}/${choice.id}: ${result.message}`);
      assert.deepEqual(chooseCultivation(restored, command), result);
      assert.equal(JSON.stringify(state), raw);
      state = result.state;
    }
    assert.equal(endings, 2, `two genuine endings for seed ${seed}`);
    assert.equal(state.world.generation, 3, `third playable life for seed ${seed}`);
    assert.equal(state.phase, 'playing');
  }
});
