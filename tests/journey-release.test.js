import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_CHAPTERS, matchesJourneyConditions, resolveJourneyScene } from '../src/game/journey/content.js';
import { createJourney, getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { validateJourney } from '../src/game/journey/validation.js';
import { evidenceVictory, limitedVictory } from './helpers/journey-routes.js';

// A finite condition-domain matrix, not an exploration of transcript histories.
// These are resolver fixtures, not claims that every fact combination is a legal
// saved/publicly reachable life. Actual state transitions are checked separately.
function conditionStates(chapterId, sceneId, scene) {
  const fields = new Map();
  for (const condition of scene.variants.flatMap(v => [...v.when, ...v.choices.flatMap(c => c.requires ?? [])])) {
    const key = condition.kind === 'opportunity' ? 'opportunity' : `${condition.kind}:${condition.id ?? ''}`;
    if (!fields.has(key)) fields.set(key, { condition, values: [undefined] });
    const value = condition.kind === 'proof' ? condition.held ?? true : condition.kind === 'person' ? condition.status : condition.kind === 'item' ? condition.min ?? 1 : condition.kind === 'ability' ? true : condition.kind === 'opportunity' ? condition.id : condition.kind === 'remaining-life' ? condition.min : condition.value;
    if (!fields.get(key).values.includes(value)) fields.get(key).values.push(value);
  }
  let states = [createJourney({ seed: 0 })];
  for (const { condition: c, values } of fields.values()) {
    states = states.flatMap(state => values.map(value => {
      const s = structuredClone(state);
      if (c.kind === 'world-fact' || c.kind === 'life-fact') s[c.kind === 'world-fact' ? 'world' : 'life'].facts[c.id] = value;
      if (c.kind === 'person') s.world.people[c.id].status = value ?? 'dead';
      if (c.kind === 'item') s.life.items[c.id] = value ?? 0;
      if (c.kind === 'ability') { s.life.abilities = s.life.abilities.filter(id => id !== c.id); if (value) s.life.abilities.push(c.id); }
      if (c.kind === 'opportunity') s.scene.opportunities[chapterId] = value;
      if (c.kind === 'proof') { s.world.proofs = s.world.proofs.filter(id => id !== c.id); if (value !== undefined ? value : !(c.held ?? true)) s.world.proofs.push(c.id); }
      if (c.kind === 'injury-not') s.life.injury = value ?? 'well';
      if (c.kind === 'remaining-life') s.life.lifeDamage = s.life.lifeLimit - s.life.age - (value ?? 1);
      s.scene.chapterId = chapterId; s.scene.nodeId = sceneId;
      return s;
    }));
    assert.ok(states.length <= 4096, `${sceneId}: condition matrix must stay bounded`);
  }
  for (const state of states) { state.scene.chapterId = chapterId; state.scene.nodeId = sceneId; }
  return states;
}

test('finite authored condition matrices select every variant and preserve bounded real exits', t => {
  let fixtures = 0, variants = 0, scenes = 0;
  const nodes = new Set(Object.values(JOURNEY_CHAPTERS).flatMap(c => Object.keys(c.scenes)));
  for (const [chapterId, chapter] of Object.entries(JOURNEY_CHAPTERS)) for (const [sceneId, scene] of Object.entries(chapter.scenes)) {
    scenes++;
    const selected = new Set();
    for (const state of conditionStates(chapterId, sceneId, scene)) {
      fixtures++;
      const resolved = resolveJourneyScene(state);
      const index = scene.variants.findIndex(v => matchesJourneyConditions(state, v.when));
      selected.add(index);
      assert.ok(resolved.choices.length <= 3, sceneId);
      for (const choice of resolved.choices) assert.ok(nodes.has(choice.to), `${sceneId}/${choice.id}`);
      // Terminal author nodes intentionally have no story choices: the public
      // engine replaces them with direct birth choices, covered by public routes.
      if (resolved.choices.length) assert.ok(resolved.choices.some(c => matchesJourneyConditions(state, c.requires) &&
        Object.entries(c.costs?.items ?? {}).every(([id, count]) => (state.life.items[id] ?? 0) >= count) &&
        (c.ending || state.life.age + state.life.lifeDamage + (c.costs?.years ?? 0) + (c.costs?.lifeDamage ?? 0) < state.life.lifeLimit)), `${sceneId}/${index}: affordable authored exit`);
    }
    assert.deepEqual([...selected].sort((a,b) => a-b), scene.variants.map((_, i) => i), `${sceneId}: no shadowed or unexercised authored variant`);
    variants += selected.size;
  }
  t.diagnostic(`${scenes} scenes / ${variants} authored variants / ${fixtures} bounded resolver fixtures; not all-path reachability`);
});

function inspectPublic(state) {
  validateJourney(state);
  const before = serializeGame(state), rng = state.rng;
  const view = getJourneyView(state);
  assert.deepEqual(getJourneyView(deserializeGame(before)), view);
  assert.equal(serializeGame(state), before);
  assert.equal(state.rng, rng);
  assert.ok(view.choices.length >= 1 && view.choices.length <= 3, view.sceneId);
  assert.ok(view.choices.some(c => c.enabled), `${view.sceneId}: executable successor`);
  return view;
}

test('bounded public victory routes and one-step alternatives retain valid exits and once-only commands', t => {
  let prefixes = 0, alternatives = 0;
  for (const ids of [evidenceVictory, limitedVictory]) for (const seed of [0, 1, 7]) {
    let state = createJourney({ seed });
    for (const id of ids) {
      prefixes++;
      const view = inspectPublic(state), before = serializeGame(state);
      for (const row of view.choices.filter(c => c.enabled)) {
        const command = { revision: view.revision, sceneId: view.sceneId, choiceId: row.id };
        const result = chooseJourney(state, command);
        assert.equal(result.kind, 'applied', `${view.sceneId}/${row.id}`);
        inspectPublic(result.state);
        assert.equal(chooseJourney(result.state, command).kind, 'stale');
        assert.equal(serializeGame(state), before);
        assert.equal(new Set(result.state.world.completedTasks.map(r => r.episodeId)).size, result.state.world.completedTasks.length);
        alternatives++;
      }
      state = chooseJourney(state, { revision: view.revision, sceneId: view.sceneId, choiceId: id }).state;
    }
    assert.equal(state.phase, 'victory');
    assert.deepEqual(state.life.abilities, []);
    assert.equal(state.world.generation, 1);
    inspectPublic(state);
  }
  t.diagnostic(`${prefixes} public prefixes / ${alternatives} one-step actions; two complete zero-ability first-life methods across three seeds`);
});
