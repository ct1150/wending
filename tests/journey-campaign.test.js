import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_CHAPTERS } from '../src/game/journey/content.js';
import { getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { validateJourney, validateJourneyContent } from '../src/game/journey/validation.js';
import { pick, route, clinic, ash, netherEvidence, netherLimited, celestial, personal, evidenceVictory, limitedVictory } from './helpers/journey-routes.js';

test('first life evidence route wins through public actions while retaining valley ownership and sources', () => {
  const state = route(evidenceVictory);
  assert.equal(state.phase, 'victory');
  assert.equal(state.world.generation, 1);
  assert.deepEqual(state.world.proofs, ['mortal', 'nether', 'celestial']);
  assert.equal(state.world.facts['valley-outcome'], 'open_clinic');
  assert.equal(state.world.facts['ding-method'], 'evidence');
  assert.equal(state.life.items['ledger-page'], 1);
  assert.equal(state.world.facts['local-supply'], 'minimum');
  assert.ok(getJourneyView(state).summary.remainingLife > 0);
  assert.deepEqual(state.life.abilities, []);
  assert.deepEqual(state.world.completedTasks.map(x => x.sequence), [1, 2, 3, 4, 5]);
});

test('no optional ability limited route wins with real loss, missing truth and personal duties', () => {
  const state = route(limitedVictory);
  assert.equal(state.phase, 'victory');
  assert.equal(state.world.people['wen-du'].status, 'dead');
  assert.equal(state.world.facts['seed-state'], 'destroyed');
  assert.equal(state.world.facts['public-truth'], false);
  assert.equal(state.world.facts['ding-method'], 'shared');
  assert.equal(state.world.facts['local-supply'], 'none');
  assert.equal(state.world.facts['nether-duty'], 'three-seasons');
  assert.deepEqual(state.life.abilities, []);
  assert.equal(state.life.items.testimony ?? 0, 0);
});

test('local refusal leaves actual affordable repair and preserves missing proof until repaired', () => {
  let state = route([...ash, ...netherLimited.slice(0, -1), 'leave-dispute', ...personal]);
  assert.equal(state.world.proofs.includes('nether'), false);
  assert.deepEqual(getJourneyView(state).choices.map(x => x.id), ['withdraw-ding']);
  state = pick(state, 'withdraw-ding');
  assert.equal(state.phase, 'playing');
  assert.ok(getJourneyView(state).choices.find(x => x.id === 'repair-nether').enabled);
  state = pick(state, 'repair-nether');
  assert.equal(state.world.proofs.includes('nether'), true);
  state = pick(state, 'reconsider-ding');
  for (const id of ['shared-method', 'separate-fire', 'share-stop-right', 'return-duty']) state = pick(state, id);
  assert.equal(state.phase, 'victory');
});

test('little remaining life disables a real time cost and preserves cost-free limited commitments', () => {
  let state = route([...clinic, ...netherEvidence, ...celestial, 'shared-method', 'separate-fire', 'share-stop-right']);
  state.life.lifeDamage = state.life.lifeLimit - state.life.age - 1;
  validateJourney(state);
  const choice = getJourneyView(state).choices.find(x => x.id === 'finish-season');
  assert.equal(choice.enabled, false);
  const before = JSON.stringify(state);
  assert.equal(chooseJourney(state, { revision: state.revision, sceneId: state.scene.nodeId, choiceId: choice.id }).kind, 'unavailable');
  assert.equal(JSON.stringify(state), before);
  state = pick(state, 'return-duty');
  assert.equal(state.phase, 'victory');
  assert.equal(getJourneyView(state).summary.remainingLife, 1);
});

test('held proof skips a completed adjudication without rerolling, relearning or settlement rewards', () => {
  let state = route([...clinic, ...netherEvidence]);
  const tasks = structuredClone(state.world.completedTasks), rng = state.rng;
  state.scene.chapterId = 'nether'; state.scene.nodeId = 'nether-arrival';
  state = pick(state, 'honor-nether-proof');
  assert.deepEqual(state.world.completedTasks, tasks);
  assert.equal(state.rng, rng);
  assert.equal(state.scene.nodeId, 'celestial-arrival');
});

test('campaign content has six bounded optional encounters and valid authored successors', () => {
  assert.equal(Object.values(JOURNEY_CHAPTERS).flatMap(x => x.opportunities).length, 6);
  assert.equal(validateJourneyContent(), true);
});

// Bounded seed discovery selects a real saved opportunity; it never changes RNG,
// proofs, evidence or character progression to manufacture a combination.
function findOpportunity(prefix, expected) {
  for (let seed = 0; seed < 100; seed++) {
    const state = route(prefix, seed);
    if (Object.entries(expected).every(([chapter, id]) => state.scene.opportunities[chapter] === id)) return state;
  }
  assert.fail('Expected public opportunity combination within 100 deterministic seeds');
}
const witnessRoute = ['catch-child', 'take-medicine', 'learn-method', 'pledge-truth', 'route-witness', 'protect-wen', 'route-ledger', 'keep-original', 'go-confront', 'public-hearing', 'organize-rescue', 'choose-estate', 'handoff-record', 'travel-nether'];

test('shelter plus soul lamp preserves two actual voluntary sources at a visible injury cost', () => {
  let state = findOpportunity([...witnessRoute, 'shelve-records', 'correct-record'], { mortal: 'mortal-shelter', nether: 'nether-lamp' });
  for (const id of ['learn-nether', 'verify-sources', 'protect-sources']) state = pick(state, id);
  assert.equal(state.life.facts['paired-testimony'], true);
  assert.equal(state.life.injury, 'hurt');
  assert.equal(state.world.people['wen-du'].status, 'safe');
  for (const id of ['judge-accountable', ...celestial, 'evidence-method', 'separate-fire']) state = pick(state, id);
  assert.equal(state.life.facts['ding-first-audit'], false);
  assert.equal(state.life.facts['fire-crossed'], true);
});

test('discern plus oath requires actual source registration and fixes limited terms without inherited liability', () => {
  const prefix = [...clinic.map(id => id === 'continue-road' ? 'learn-method' : id), ...netherEvidence, 'authorize-local'];
  let state = findOpportunity(prefix, { mortal: 'mortal-discern', celestial: 'celestial-oath' });
  state = pick(pick(state, 'learn-celestial'), 'limit-terms');
  assert.equal(state.life.facts['joint-seal'], true);
  assert.equal(state.life.facts['first-audit'], false);
  state = pick(pick(state, 'minimum-share'), 'deliver-copies');
  assert.equal(state.life.facts['copy-custodian'], 'joint-seal');
  assert.equal(state.life.facts['first-audit'], false);
});

test('herbalism and burn-life have a genuinely affordable public medicine route, then finite personal costs', () => {
  const base = [...witnessRoute, 'shelve-records', 'correct-record'];
  // Probe the selected celestial opportunity using the ordinary herb lesson;
  // replay the same seed with the paid service when the desired pair occurs.
  let seedFound;
  for (let seed = 0; seed < 100; seed++) {
    let state = route(base, seed);
    if (state.scene.opportunities.nether !== 'nether-herbalism') continue;
    for (const id of ['learn-nether', 'verify-sources', 'protect-sources', 'judge-accountable', 'authorize-local']) state = pick(state, id);
    if (state.scene.opportunities.celestial === 'celestial-fire') { seedFound = seed; break; }
  }
  assert.notEqual(seedFound, undefined);
  let state = route(base, seedFound), age = state.life.age, serviceYear = state.world.year, serviceDamage = state.life.lifeDamage;
  state = pick(state, 'learn-nether-service');
  assert.equal(state.life.age, age + 2);
  assert.equal(state.world.year, serviceYear + 2);
  assert.equal(state.life.lifeDamage, serviceDamage);
  assert.equal(state.life.items['medicine-pack'], 1);
  assert.equal(state.life.learnedOpportunities.filter(id => id === 'nether-herbalism').length, 1);
  assert.equal(state.life.abilities.filter(id => id === 'herbalism').length, 1);
  assert.equal(state.life.facts['soul-window-closed'], undefined);
  for (const id of ['verify-sources', 'protect-sources', 'judge-accountable', 'authorize-local', 'learn-celestial', 'limit-terms', 'trial-appeal', 'deliver-copies', 'evidence-method']) state = pick(state, id);
  const year = state.world.year, damage = state.life.lifeDamage;
  state = pick(state, 'herb-fire-passage');
  assert.equal(state.world.year, year);
  assert.equal(state.life.lifeDamage, damage + 3);
  assert.equal(state.life.items['medicine-pack'], 0);
  assert.equal(state.life.facts['ding-first-audit'], false);
  const priorProofs = [...state.world.proofs], priorTasks = structuredClone(state.world.completedTasks);
  const beforeDeath = state;
  state = pick(state, 'burn-all');
  assert.equal(state.phase, 'ended');
  assert.equal(state.summary.cause, 'burned');
  assert.equal(state.world.year, year);
  assert.equal(state.life.age, beforeDeath.life.age);
  assert.equal(state.life.age + state.life.lifeDamage, state.life.lifeLimit);
  assert.deepEqual(state.world.proofs, priorProofs);
  assert.deepEqual(state.world.completedTasks, priorTasks);
  assert.equal(state.world.facts['ding-complete'], undefined);
});

test('forged campaign verdicts and accepted unlimited terms cannot pass save validation', () => {
  const state = route(limitedVictory);
  for (const mutate of [
    s => { s.world.facts['nether-verdict'] = 'omniscient'; },
    s => { s.world.facts['celestial-terms'] = 'unlimited'; },
    s => { s.world.facts['local-supply'] = 'infinite'; },
    s => { s.world.facts['ding-method'] = 'force'; },
    s => { s.life.facts['bounded-terms'] = false; },
    s => { s.life.facts['copies-delivered'] = false; },
  ]) {
    const bad = structuredClone(state); mutate(bad);
    assert.throws(() => validateJourney(bad), /三界|立约|问鼎/);
  }
});

test('severe injury and no medicine can still complete the real limited route after an unaffordable service', () => {
  let state = findOpportunity([...ash, 'shelve-records', 'freeze-debt'], { nether: 'nether-herbalism' });
  state.life.injury = 'severe';
  state.life.lifeDamage = state.life.lifeLimit - state.life.age - 1;
  assert.equal(getJourneyView(state).choices.find(x => x.id === 'learn-nether-service').enabled, false);
  for (const id of ['continue-inquest', 'record-gaps', 'protect-sources', 'share-duty', ...personal, 'shared-method', 'separate-fire', 'share-stop-right', 'return-duty']) state = pick(state, id);
  assert.equal(state.phase, 'victory');
  assert.equal(state.life.injury, 'severe');
  assert.equal(state.world.people['wen-du'].status, 'dead');
  assert.deepEqual(state.life.abilities, []);
});

test('actual missing mortal and celestial proofs each require their finite repair event', () => {
  let state = route([...ash.map(id => id === 'handoff-record' ? 'handoff-with-gaps' : id), ...netherLimited, ...personal.slice(0, -1), 'decline-terms', 'withdraw-ding']);
  assert.deepEqual(state.world.proofs, ['nether']);
  state = pick(state, 'repair-mortal');
  assert.deepEqual(state.world.proofs, ['nether', 'mortal']);
  state = pick(state, 'repair-celestial');
  assert.deepEqual(state.world.proofs, ['nether', 'mortal', 'celestial']);
  assert.equal(state.world.facts['valley-handoff'], 'uncertified', 'original failed handoff remains history');
  assert.equal(state.world.facts['local-supply'], 'none');
  assert.equal(state.phase, 'playing');
});

test('an actually traded original survives the whole limited victory without being recreated', () => {
  const traded = ['catch-child', 'leave-medicine', 'continue-road', 'pledge-truth', 'route-ledger', 'keep-original', 'go-confront', 'record-limits', 'surrender-page', 'choose-ash', 'handoff-record', 'travel-nether'];
  const state = route([...traded, ...netherLimited, ...personal, 'shared-method', 'separate-fire', 'share-stop-right', 'return-duty']);
  assert.equal(state.phase, 'victory');
  assert.equal(state.life.items['ledger-page'], 0);
  assert.equal(state.world.facts['ledger-original'], 'traded');
  assert.equal(state.world.facts['ledger-evidence'], 'lost');
  assert.equal(state.world.people['wen-du'].status, 'dependent');
  assert.equal(state.world.facts['ding-method'], 'shared');
});

test('a withdrawn confrontation has one finite return, never an unlimited repeat loop', () => {
  let state = route([...ash, ...netherLimited, ...personal, 'withdraw-ding', 'reconsider-ding', 'withdraw-ding']);
  assert.equal(state.phase, 'playing');
  assert.equal(getJourneyView(state).choices.some(x => x.id === 'reconsider-ding'), false);
  assert.ok(getJourneyView(state).choices.find(x => x.id === 'return-watch').enabled);
});

test('a retired save cannot masquerade as the living victory terminal', () => {
  const state = route([...clinic.slice(0, -1), 'keep-watch']);
  state.scene = { ...state.scene, chapterId: 'celestial', nodeId: 'campaign-victory' };
  assert.throws(() => validateJourney(state), /结算/);
});


test('herbal lesson spends one actual year, service spends two, and refusal remains free', () => {
  const source = findOpportunity([...ash, 'shelve-records', 'freeze-debt'], { nether: 'nether-herbalism' });
  for (const [id, years, packs, learned] of [['learn-nether', 1, 0, true], ['learn-nether-service', 2, 1, true], ['continue-inquest', 0, 0, false]]) {
    const next = pick(source, id);
    assert.equal(next.life.age, source.life.age + years, id);
    assert.equal(next.world.year, source.world.year + years, id);
    assert.equal(next.life.lifeDamage, source.life.lifeDamage, id);
    assert.equal(next.life.items['medicine-pack'] ?? 0, packs, id);
    assert.equal(next.life.abilities.includes('herbalism'), learned, id);
    assert.equal(next.life.learnedOpportunities.includes('nether-herbalism'), learned, id);
    assert.equal(next.life.facts['soul-window-closed'], undefined);
    const before = JSON.stringify(next);
    const repeated = chooseJourney(next, { revision: source.revision, sceneId: source.scene.nodeId, choiceId: id });
    assert.equal(repeated.kind, 'stale');
    assert.equal(JSON.stringify(next), before);
  }
  for (const remaining of [1, 2, 3]) {
    const tight = structuredClone(source);
    tight.life.lifeDamage = tight.life.lifeLimit - tight.life.age - remaining;
    const view = getJourneyView(tight);
    assert.equal(view.choices.find(c => c.id === 'learn-nether').enabled, remaining > 1);
    assert.equal(view.choices.find(c => c.id === 'learn-nether-service').enabled, remaining > 2);
    assert.equal(view.choices.find(c => c.id === 'continue-inquest').enabled, true);
    for (const choice of view.choices.filter(c => !c.enabled)) {
      const before = JSON.stringify(tight);
      assert.equal(chooseJourney(tight, { revision: view.revision, sceneId: view.sceneId, choiceId: choice.id }).kind, 'unavailable');
      assert.equal(JSON.stringify(tight), before);
    }
    const declined = pick(tight, 'continue-inquest');
    assert.equal(declined.life.age, tight.life.age);
    assert.equal(declined.world.year, tight.world.year);
    assert.equal(declined.life.lifeDamage, tight.life.lifeDamage);
  }
});
