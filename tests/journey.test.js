import test from 'node:test';
import assert from 'node:assert/strict';

// Dynamic loading makes the first RED an assertion about the new public API,
// rather than a test-runner import failure before any assertions can execute.
const engine = await import('../src/game/journey/engine.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const validation = await import('../src/game/journey/validation.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
function fresh(seed = '谷口') {
  assert.equal(typeof engine.createJourney, 'function', 'createJourney must create the new dialogue life');
  return engine.createJourney({ seed });
}
function pick(state, choiceId) {
  const view = engine.getJourneyView(state), before = JSON.stringify(state);
  const result = engine.chooseJourney(state, { revision: view.revision, sceneId: view.sceneId, choiceId });
  assert.equal(result.kind, 'applied', `${view.sceneId}/${choiceId}: ${result.message}`);
  assert.equal(JSON.stringify(state), before, 'a choice never mutates its input');
  assert.equal(validation.validateJourney(result.state), result.state);
  return result.state;
}
function approach({ seed = '谷口', medicine = true, learn = true, page = true } = {}) {
  let state = pick(fresh(seed), 'catch-child');
  state = pick(state, medicine ? 'take-medicine' : 'leave-medicine');
  state = pick(state, learn ? 'learn-method' : 'continue-road');
  state = pick(state, 'pledge-truth');
  state = pick(state, 'route-ledger');
  state = pick(state, page ? 'keep-original' : 'take-partial');
  return pick(state, 'go-confront');
}
function settled() {
  let state = pick(approach({ learn: false }), 'record-limits');
  state = pick(state, 'surrender-page');
  return pick(state, 'choose-estate');
}
function seedFor(opportunity) {
  for (let seed = 0; seed < 80; seed++) {
    const state = pick(pick(fresh(seed), 'catch-child'), 'take-medicine');
    if (state.scene.opportunities.mortal === opportunity) return seed;
  }
  assert.fail(`no seed reaches ${opportunity}`);
}

test('same seed creates the same default life and readable opening', () => {
  const state = fresh();
  assert.deepEqual(state, fresh());
  assert.equal(state.version, 3);
  assert.equal(state.mode, 'dialogue');
  assert.equal(state.life.name, '云归');
  assert.equal(state.life.injury, 'well');
  const view = engine.getJourneyView(state);
  assert.equal(view.choices.length, 2);
  assert.match(view.blocks.map(block => block.text).join(''), /沈芷|孩子/);
});

test('first concrete action changes the saved character response', () => {
  const start = fresh();
  const child = pick(start, 'catch-child'), tarp = pick(start, 'raise-tarp');
  assert.notDeepEqual(child.transcript, tarp.transcript);
  assert.match(child.transcript.map(block => block.text).join(''), /孩子/);
  assert.match(tarp.transcript.map(block => block.text).join(''), /药箱/);
  assert.equal(child.life.items['medicine-pack'], 1);
});

test('medicine allocation has actual, different witness and evacuation consequences', () => {
  const paid = approach(), reserved = approach({ medicine: false });
  assert.equal(paid.life.items['medicine-pack'], 0);
  assert.equal(reserved.life.items['medicine-pack'], 0);
  assert.equal(paid.world.people['wen-du'].status, 'mobile');
  assert.equal(reserved.world.people['wen-du'].status, 'critical');
  assert.equal(paid.life.facts['evacuation-medicated'], undefined);
  assert.equal(reserved.life.facts['evacuation-medicated'], true);
});

test('medicine and original evidence cannot be spent unless actually acquired', () => {
  let state = pick(fresh(), 'catch-child');
  state.life.items['medicine-pack'] = 0;
  const before = JSON.stringify(state);
  const view = engine.getJourneyView(state);
  assert.equal(view.choices.find(choice => choice.id === 'take-medicine').enabled, false);
  assert.equal(engine.chooseJourney(state, { revision: state.revision, sceneId: view.sceneId, choiceId: 'take-medicine' }).kind, 'unavailable');
  assert.equal(JSON.stringify(state), before);
  const withoutPage = approach({ page: false });
  assert.ok(!engine.getJourneyView(withoutPage).choices.some(choice => choice.id === 'surrender-page'));
  const rejected = engine.chooseJourney(withoutPage, { revision: withoutPage.revision, sceneId: withoutPage.scene.nodeId, choiceId: 'surrender-page' });
  assert.equal(rejected.kind, 'unavailable');
  assert.equal(rejected.state, withoutPage);
});

test('old revisions, wrong scenes, duplicate submissions and restored replays are no-ops', () => {
  const start = fresh(), view = engine.getJourneyView(start);
  const command = { revision: view.revision, sceneId: view.sceneId, choiceId: 'catch-child' };
  const applied = engine.chooseJourney(start, command);
  for (const state of [applied.state, JSON.parse(JSON.stringify(applied.state))]) {
    const before = JSON.stringify(state), result = engine.chooseJourney(state, command);
    assert.equal(result.kind, 'stale');
    assert.equal(result.state, state);
    assert.equal(JSON.stringify(state), before);
  }
  const wrong = engine.chooseJourney(start, { ...command, sceneId: 'wrong-scene' });
  assert.equal(wrong.kind, 'stale');
  assert.equal(wrong.state, start);
});

test('opportunity is selected on entry and reads never advance random state or saved text', () => {
  let state = pick(fresh(), 'catch-child');
  assert.equal(state.scene.opportunities.mortal, undefined);
  const priorRng = state.rng;
  state = pick(state, 'take-medicine');
  assert.notEqual(state.rng, priorRng);
  assert.ok(['mortal-shelter', 'mortal-discern'].includes(state.scene.opportunities.mortal));
  const before = JSON.stringify(state), first = engine.getJourneyView(state);
  for (let read = 0; read < 6; read++) assert.deepEqual(engine.getJourneyView(state), first);
  assert.equal(JSON.stringify(state), before);
  first.blocks[0].text = 'changed public copy';
  first.summary.abilities.push('invented');
  assert.equal(JSON.stringify(state), before);
});

test('learning is a story action; declining the opportunity leaves an executable route', () => {
  for (const id of ['mortal-shelter', 'mortal-discern']) {
    const seed = seedFor(id), learned = approach({ seed }), declined = approach({ seed, learn: false });
    assert.deepEqual(learned.life.abilities, [id === 'mortal-shelter' ? 'shelter' : 'discern']);
    assert.deepEqual(declined.life.abilities, []);
    assert.equal(learned.life.learnedOpportunities.length, 1);
    assert.ok(engine.getJourneyView(declined).choices.some(choice => choice.enabled));
  }
});

test('full chapter retirement has a real life-ending outro and no fake departure death', () => {
  let state = settled();
  state = pick(state, 'handoff-record');
  const before = state.life.age;
  state = pick(state, 'keep-watch');
  assert.equal(state.phase, 'ended');
  assert.equal(state.summary.cause, 'retired');
  assert.ok(state.life.age >= before);
  assert.equal(state.life.age + state.life.lifeDamage, state.life.lifeLimit);
  assert.equal(state.world.biography.length, 1);
  assert.ok(engine.getJourneyView(state).choices.length >= 1 && engine.getJourneyView(state).choices.length <= 3);
  const replay = engine.chooseJourney(state, { revision: state.revision, sceneId: state.scene.nodeId, choiceId: 'keep-watch' });
  assert.equal(replay.kind, 'unavailable');
  assert.equal(replay.state, state);
});

test('validation rejects malformed saved state, inconsistent status and unknown authored references', () => {
  assert.equal(typeof validation.validateJourney, 'function');
  for (const mutate of [
    state => { state.revision = -1; },
    state => { state.rng = 0; },
    state => { state.life.injury = 'poisoned'; },
    state => { state.life.abilities = ['unknown']; },
    state => { state.scene.nodeId = 'missing'; },
    state => { state.life.items['medicine-pack'] = -1; },
    state => { state.life.abilities = ['shelter', 'shelter']; },
    state => { state.phase = 'ended'; },
    state => { state.world.completedTasks = [{ episodeId: 'mortal-valley', generation: 1, sequence: 1, outcomeId: 'x' }, { episodeId: 'mortal-valley', generation: 1, sequence: 2, outcomeId: 'x' }]; },
  ]) {
    const state = fresh(); mutate(state);
    assert.throws(() => validation.validateJourney(state), /存档|伤势|能力|场景|记录|结算|物品|随机|revision/);
  }
});

test('ordinary time costs reject at the life boundary without partial spending or rewards', () => {
  let state = pick(pick(fresh(), 'catch-child'), 'take-medicine');
  state.life.lifeDamage = state.life.lifeLimit - state.life.age - 1;
  const before = JSON.stringify(state), view = engine.getJourneyView(state);
  const learn = view.choices.find(choice => choice.id === 'learn-method');
  assert.equal(learn.enabled, false);
  assert.match(learn.detail, /当前余寿.*1/);
  const result = engine.chooseJourney(state, { revision: state.revision, sceneId: view.sceneId, choiceId: learn.id });
  assert.equal(result.kind, 'unavailable');
  assert.equal(result.state, state);
  assert.equal(JSON.stringify(state), before);
  assert.ok(view.choices.find(choice => choice.id === 'continue-road').enabled);
});

test('a later authored episode settles in the same life without overwriting earlier valley facts', async () => {
  const { JOURNEY_CHAPTERS } = await import('../src/game/journey/content.js');
  const scenes = JOURNEY_CHAPTERS.mortal.scenes;
  scenes['mortal-followup'] = { title: '后续经历', location: '谷外', variants: [{ when: [], blocks: [], choices: [{
    id: 'settle-followup', label: '交接下一项责任。', detail: '保留先前的谷中事实。', result: '后来的一项责任也完成了。', to: 'mortal-outro',
    effects: { worldFacts: { 'later-outcome': 'kept' }, settle: { episodeId: 'later-episode', outcomeId: 'kept' } },
  }] }] };
  try {
    let state = settled();
    const first = structuredClone(state.world.completedTasks[0]);
    state.scene.nodeId = 'mortal-followup';
    state = pick(state, 'settle-followup');
    assert.equal(state.world.facts['valley-outcome'], 'sect_estate');
    assert.equal(state.world.facts['later-outcome'], 'kept');
    assert.deepEqual(state.world.completedTasks[0], first);
    assert.deepEqual(state.world.completedTasks.map(row => row.sequence), [1, 2]);
  } finally {
    delete scenes['mortal-followup'];
  }
});

test('ended summaries and biography must agree with the actual finished life', () => {
  const ended = pick(pick(settled(), 'handoff-record'), 'keep-watch');
  for (const mutate of [
    state => { state.summary.age--; },
    state => { state.summary.generation++; },
    state => { state.world.biography.push(structuredClone(state.world.biography[0])); },
    state => { state.world.biography[0].age--; },
  ]) {
    const broken = structuredClone(ended); mutate(broken);
    assert.throws(() => validation.validateJourney(broken), /结算|生平/);
  }
});
