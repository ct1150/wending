import test from 'node:test';
import assert from 'node:assert/strict';

const content = await import('../src/game/journey/content.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const validation = await import('../src/game/journey/validation.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const engine = await import('../src/game/journey/engine.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
function chapters() {
  assert.ok(content.JOURNEY_CHAPTERS, 'authored journey chapters must exist');
  return structuredClone(content.JOURNEY_CHAPTERS);
}

test('content exposes the six fixed abilities and named chapter/legacy tables', () => {
  assert.deepEqual(Object.keys(content.JOURNEY_ABILITIES ?? {}).sort(), ['shelter', 'discern', 'burn-life', 'herbalism', 'soul-lamp', 'bind-oath'].sort());
  assert.ok(content.JOURNEY_LEGACIES);
  assert.equal(typeof content.resolveJourneyScene, 'function');
  assert.equal(validation.validateJourneyContent(chapters()), true);
});

test('content validation rejects unknown successors, unresolved conditions, too many choices and dead ends', () => {
  for (const [mutate, error] of [
    [rows => { rows.mortal.scenes['mortal-entry'].variants[0].choices[0].to = 'missing'; }, /后继/],
    [rows => { rows.mortal.scenes['mortal-entry'].variants[0].when = [{ kind: 'imaginary-condition' }]; }, /条件/],
    [rows => { const choices = rows.mortal.scenes['mortal-entry'].variants[0].choices; choices.push({ ...choices[0], id: 'extra-one' }, { ...choices[0], id: 'extra-two' }); }, /三|3/],
    [rows => { rows.mortal.scenes['mortal-entry'].variants[0].choices = []; }, /出口/],
    [rows => { rows.mortal.scenes['mortal-entry'].variants[0].choices[0].requires = [{ kind: 'ability', id: 'imaginary-ability' }]; }, /条件|能力/],
  ]) {
    const rows = chapters(); mutate(rows);
    assert.throws(() => validation.validateJourneyContent(rows), error);
  }
});

test('public paths bound the important conflict, retain a live exit and cover both saved opportunities', () => {
  const opportunities = new Set(), outcomes = new Set();
  // Representative public paths test gameplay states instead of enumerating
  // exponentially many permutations of the persistent transcript.
  for (let seed = 0; seed < 8; seed++) {
    let state = engine.createJourney({ seed });
    const route = ['catch-child', seed % 2 ? 'leave-medicine' : 'take-medicine', seed % 2 ? 'learn-method' : 'continue-road', 'pledge-truth', 'route-channel', 'measure-channel', 'go-confront', 'record-limits', 'organize-rescue', ['choose-clinic', 'choose-estate', 'choose-ash'][seed % 3], 'handoff-record', 'travel-nether', 'shelve-records', 'return-watch'];
    let conflictDecisions = 0;
    for (const id of route) {
      validation.validateJourney(state);
      const view = engine.getJourneyView(state);
      assert.ok(view.choices.length <= 3);
      assert.ok(view.choices.some(choice => choice.enabled), `${view.sceneId} has a live exit`);
      if (state.scene.opportunities.mortal) opportunities.add(state.scene.opportunities.mortal);
      if (['mortal-conflict', 'mortal-rescue', 'mortal-seed'].includes(view.sceneId)) conflictDecisions++;
      const result = engine.chooseJourney(state, { revision: view.revision, sceneId: view.sceneId, choiceId: id });
      assert.equal(result.kind, 'applied', `${view.sceneId}/${id}`);
      if (state.world.facts['valley-outcome']) assert.equal(result.state.world.facts['valley-outcome'], state.world.facts['valley-outcome']);
      state = result.state;
    }
    assert.equal(conflictDecisions, 3);
    assert.equal(state.phase, 'ended');
    assert.equal(state.world.completedTasks.length, 2);
    assert.ok(engine.getJourneyView(state).choices.length >= 1 && engine.getJourneyView(state).choices.length <= 3);
    outcomes.add(state.world.facts['valley-outcome']);
  }
  assert.equal(opportunities.size, 2);
  assert.deepEqual([...outcomes].sort(), ['ash_refuge', 'open_clinic', 'sect_estate']);
});

test('authoring rejects misspelled condition fields and closed nonterminal cycles', () => {
  const typo = chapters();
  typo.mortal.scenes['mortal-entry'].variants[0].choices[0].requires = [{ kind: 'item', id: 'ledger-page', minimum: 1 }];
  assert.throws(() => validation.validateJourneyContent(typo), /条件/);
  const loop = chapters();
  for (const choice of loop.mortal.scenes['mortal-outro'].variants[0].choices) {
    delete choice.ending;
    choice.to = 'mortal-outro';
  }
  assert.throws(() => validation.validateJourneyContent(loop), /出口|结算/);
});
