import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { validateJourney, validateJourneyContent } from '../src/game/journey/validation.js';
import { JOURNEY_CHAPTERS } from '../src/game/journey/content.js';

function pick(state, choiceId) {
  const view = getJourneyView(state), before = JSON.stringify(state);
  const result = chooseJourney(state, { revision: view.revision, sceneId: view.sceneId, choiceId });
  assert.equal(result.kind, 'applied', `${view.sceneId}/${choiceId}: ${result.message}`);
  assert.equal(JSON.stringify(state), before);
  return validateJourney(result.state);
}
function start({ seed = 0, medicine = true, learn = false, pledge = 'pledge-truth' } = {}) {
  let state = pick(createJourney({ seed }), 'catch-child');
  state = pick(state, medicine ? 'take-medicine' : 'leave-medicine');
  state = pick(state, learn ? 'learn-method' : 'continue-road');
  return pick(state, pledge);
}
function investigate(state, route, decision) {
  return pick(pick(state, `route-${route}`), decision);
}
function prepared() {
  let state = investigate(start(), 'ledger', 'keep-original');
  state = investigate(state, 'channel', 'measure-channel');
  return pick(pick(pick(state, 'go-confront'), 'public-hearing'), 'organize-rescue');
}
function settle(state, outcome) { return pick(state, `choose-${outcome}`); }
function depart(state) { return pick(pick(state, 'handoff-record'), 'travel-nether'); }

test('open clinic keeps an actual seed and original evidence, with public truth and real handoff', () => {
  let state = settle(prepared(), 'clinic');
  assert.equal(state.world.facts['valley-outcome'], 'open_clinic');
  assert.equal(state.world.facts['seed-state'], 'rooted');
  assert.equal(state.world.facts['public-truth'], true);
  assert.equal(state.life.items['ledger-page'], 1);
  assert.equal(state.life.items['channel-map'], 1);
  assert.equal(state.world.people['wen-du'].status, 'safe');
  assert.equal(state.world.facts['survivor-line'], 'seven-households-and-wen');
  assert.equal(state.world.facts['truth-pledge'], 'fulfilled');
  assert.equal(state.life.realm, 'foundation');
  assert.deepEqual(state.world.proofs, [], 'growth does not automatically award a proof');
  state = depart(state);
  assert.equal(state.scene.chapterId, 'nether');
  assert.equal(state.scene.nodeId, 'nether-arrival');
  assert.equal(state.phase, 'playing');
  assert.deepEqual(state.world.proofs, ['mortal']);
  assert.equal(state.world.facts['valley-handoff'], 'recorded');
  assert.deepEqual(state.world.completedTasks.map(row => [row.episodeId, row.outcomeId, row.sequence]), [['mortal-valley', 'open_clinic', 1], ['mortal-handoff', 'recorded', 2]]);
  assert.equal(state.world.biography.length, 0);
});

test('sect estate trades ownership for rescue; missing testimony stays missing and records survive departure', () => {
  let state = investigate(start({ medicine: false, pledge: 'pledge-people' }), 'ledger', 'keep-original');
  state = pick(pick(state, 'go-confront'), 'accept-sect');
  state = pick(state, 'sect-rescue');
  state = settle(state, 'estate');
  assert.equal(state.world.facts['valley-outcome'], 'sect_estate');
  assert.equal(state.world.facts['seed-state'], 'sect-custody');
  assert.equal(state.world.facts['seed-custodian'], 'guiheng');
  assert.equal(state.world.people['wen-du'].status, 'dependent');
  assert.equal(state.world.facts['sect-aid'], true);
  assert.equal(state.world.facts['public-truth'], false);
  assert.equal(state.life.items.testimony ?? 0, 0);
  assert.equal(state.life.items['ledger-page'], 1);
  state = depart(state);
  assert.equal(state.world.facts['valley-outcome'], 'sect_estate');
  assert.equal(state.world.facts['evacuation-pledge'], 'fulfilled');
});

test('ash refuge destroys the seed permanently and preserves a failed rescue and unfulfilled truth pledge', () => {
  let state = investigate(start({ medicine: false }), 'witness', 'anonymous-record');
  state = pick(pick(pick(state, 'go-confront'), 'record-limits'), 'evacuate-wounded');
  state = settle(state, 'ash');
  assert.equal(state.world.facts['valley-outcome'], 'ash_refuge');
  assert.equal(state.world.facts['seed-state'], 'destroyed');
  assert.equal(state.world.people['wen-du'].status, 'dead');
  assert.equal(state.world.facts['survivor-line'], 'seven-households-wen-lost');
  assert.equal(state.world.facts['witness-consent'], 'anonymous');
  assert.equal(state.world.facts['truth-pledge'], 'unfulfilled');
  state = depart(state);
  assert.equal(state.world.facts['seed-state'], 'destroyed');
  assert.equal(state.world.people['wen-du'].status, 'dead');
  assert.equal(state.life.items['ledger-page'] ?? 0, 0);
});

test('no medicine, severe injury, only channel rubbing and no optional abilities still permits an honest continuing life', () => {
  let state = pick(createJourney(), 'catch-child');
  state.life.items['medicine-pack'] = 0;
  state.life.injury = 'severe';
  state = pick(pick(pick(state, 'search-unmedicated'), 'continue-road'), 'pledge-people');
  state = investigate(state, 'channel', 'retreat-marks');
  state = pick(pick(pick(state, 'go-confront'), 'record-limits'), 'evacuate-wounded');
  state = depart(settle(state, 'ash'));
  assert.equal(state.scene.nodeId, 'nether-arrival');
  assert.equal(state.life.injury, 'severe');
  assert.deepEqual(state.life.abilities, []);
  assert.ok(getJourneyView(state).choices.some(choice => choice.enabled));
});

test('giving away original ledger for a stretcher never recreates the original or full ledger evidence', () => {
  let state = investigate(start({ medicine: false }), 'ledger', 'keep-original');
  state = pick(pick(state, 'go-confront'), 'record-limits');
  state = pick(state, 'surrender-page');
  assert.equal(state.life.items['ledger-page'], 0);
  assert.equal(state.world.facts['ledger-original'], 'traded');
  state = depart(settle(state, 'ash'));
  assert.equal(state.life.items['ledger-page'], 0);
  assert.equal(state.world.facts['ledger-original'], 'traded');
  assert.equal(state.world.facts['public-truth'], false);
});

test('investigation window closes after two distinct routes, with no year deadline or repeat rewards', () => {
  let state = investigate(start({ learn: true }), 'witness', 'protect-wen');
  state = investigate(state, 'ledger', 'copy-accountable');
  assert.equal(state.life.facts['investigations-used'], 2);
  const view = getJourneyView(state), before = JSON.stringify(state);
  assert.deepEqual(view.choices.map(choice => choice.id), ['go-confront']);
  for (const choiceId of ['route-witness', 'route-ledger', 'route-channel']) {
    assert.equal(chooseJourney(state, { revision: view.revision, sceneId: view.sceneId, choiceId }).kind, 'unavailable');
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.life.facts['deadline-year'], undefined);
  state = pick(pick(pick(state, 'go-confront'), 'public-hearing'), 'organize-rescue');
  state = depart(settle(state, 'estate'));
  assert.equal(state.scene.chapterId, 'nether');
});

test('voluntary witness consent and protection pledge require actual treatment, then actual rescue', () => {
  let state = investigate(start(), 'witness', 'protect-wen');
  assert.equal(state.world.facts['witness-consent'], 'named');
  assert.equal(state.world.facts['protect-pledge'], 'pending');
  state = pick(pick(pick(state, 'go-confront'), 'record-limits'), 'organize-rescue');
  assert.equal(state.world.facts['protect-pledge'], 'fulfilled');
  assert.equal(state.world.people['wen-du'].status, 'safe');
  const untreated = pick(start({ medicine: false }), 'route-witness');
  assert.ok(!getJourneyView(untreated).choices.some(choice => choice.id === 'protect-wen'));
});

test('breaking the protection pledge is remembered after the family is left to escape without promised help', () => {
  let state = investigate(start(), 'witness', 'protect-wen');
  state = pick(pick(pick(state, 'go-confront'), 'record-limits'), 'evacuate-wounded');
  assert.equal(state.world.facts['protect-pledge'], 'broken');
  assert.equal(state.world.people['wen-du'].status, 'safe');
  assert.equal(state.world.facts['witness-cooperation'], false);
  state = depart(settle(state, 'ash'));
  assert.equal(state.world.facts['protect-pledge'], 'broken');
});

test('mortals with little remaining life can refuse time costs and use a safe successor', () => {
  let state = pick(pick(createJourney(), 'catch-child'), 'leave-medicine');
  state.life.lifeDamage = state.life.lifeLimit - state.life.age - 1;
  assert.equal(getJourneyView(state).choices.find(choice => choice.id === 'learn-method').enabled, false);
  state = pick(pick(state, 'continue-road'), 'pledge-people');
  state = investigate(state, 'channel', 'retreat-marks');
  state = pick(pick(pick(state, 'go-confront'), 'record-limits'), 'evacuate-wounded');
  state = depart(settle(state, 'ash'));
  assert.equal(state.phase, 'playing');
  assert.equal(state.scene.chapterId, 'nether');
});

test('handoff can truthfully decline certification; travel still occurs without fabricating proof', () => {
  let state = pick(settle(prepared(), 'clinic'), 'handoff-with-gaps');
  assert.deepEqual(state.world.proofs, []);
  assert.equal(state.world.facts['valley-handoff'], 'uncertified');
  state = pick(state, 'travel-nether');
  assert.equal(state.scene.chapterId, 'nether');
  assert.deepEqual(state.world.proofs, []);
});

test('each saved mortal opportunity has different consequences, one learn or refusal, with stable RNG', () => {
  const seen = new Set();
  for (let seed = 0; seed < 30 && seen.size < 2; seed++) {
    let state = pick(pick(createJourney({ seed }), 'catch-child'), 'take-medicine');
    const id = state.scene.opportunities.mortal;
    if (seen.has(id)) continue;
    seen.add(id);
    const before = JSON.stringify(state);
    getJourneyView(state); getJourneyView(state);
    assert.equal(JSON.stringify(state), before);
    const learned = pick(state, 'learn-method');
    assert.equal(learned.life.learnedOpportunities.length, 1);
    assert.equal(learned.life.abilities.length, 1);
    assert.equal(learned.life.facts[id === 'mortal-shelter' ? 'evacuation-trained' : 'dates-crosschecked'], true);
    const declined = pick(state, 'continue-road');
    assert.deepEqual(declined.life.abilities, []);
  }
  assert.equal(seen.size, 2);
});

test('retirement is explicit and distinct from alive departure; neither duplicates the valley settlement', () => {
  let state = pick(settle(prepared(), 'estate'), 'handoff-record');
  const command = { revision: state.revision, sceneId: state.scene.nodeId, choiceId: 'keep-watch' };
  state = chooseJourney(state, command).state;
  assert.equal(state.phase, 'ended');
  assert.equal(state.life.age + state.life.lifeDamage, state.life.lifeLimit);
  assert.equal(state.world.completedTasks.filter(row => row.episodeId === 'mortal-valley').length, 1);
  assert.equal(chooseJourney(state, command).kind, 'stale');
});

test('author fact conditions reject nonfinite or overlong values just like saved facts', () => {
  for (const value of [NaN, Infinity, -Infinity, 'x'.repeat(201)]) {
    const chapters = structuredClone(JOURNEY_CHAPTERS);
    chapters.mortal.scenes['mortal-entry'].variants[0].choices[0].requires = [{ kind: 'world-fact', id: 'invalid-fact', value }];
    assert.throws(() => validateJourneyContent(chapters), /条件|事实/);
  }
});


test('save validation rejects contradictory seed, evidence and rescue history', () => {
  const ash = settle(prepared(), 'ash');
  for (const mutate of [
    state => { state.world.facts['seed-state'] = 'rooted'; },
    state => { state.world.facts['seed-custodian'] = 'guiheng'; },
    state => { state.world.facts['ledger-original'] = 'traded'; },
    state => { state.world.facts['ledger-evidence'] = 'lost'; },
    state => { state.world.facts['channel-evidence'] = 'partial'; },
    state => { state.life.facts['investigations-used'] = 1; },
    state => { state.world.facts['survivor-line'] = 'seven-households-wen-lost'; },
    state => { state.world.completedTasks[0].outcomeId = 'sect_estate'; },
  ]) {
    const broken = structuredClone(ash); mutate(broken);
    assert.throws(() => validateJourney(broken), /灵种|证物|账页|调查|幸存|结局|谷地/);
  }
});

test('choice details show authoritative held quantities for real medicine consumption and insufficiency', () => {
  let state = pick(createJourney(), 'catch-child');
  let row = getJourneyView(state).choices.find(choice => choice.id === 'take-medicine');
  assert.match(row.detail, /止血药包.*1/);
  state.life.items['medicine-pack'] = 0;
  row = getJourneyView(state).choices.find(choice => choice.id === 'take-medicine');
  assert.equal(row.enabled, false);
  assert.match(row.detail, /止血药包.*0/);
  const before = JSON.stringify(state);
  assert.equal(chooseJourney(state, { revision: state.revision, sceneId: state.scene.nodeId, choiceId: 'take-medicine' }).kind, 'unavailable');
  assert.equal(JSON.stringify(state), before);
});

test('the two optional skills change later actions without becoming mandatory', () => {
  const byOpportunity = new Map();
  for (let seed = 0; seed < 30 && byOpportunity.size < 2; seed++) {
    const state = start({ seed, learn: true });
    byOpportunity.set(state.scene.opportunities.mortal, state);
  }
  let discerning = pick(byOpportunity.get('mortal-discern'), 'route-ledger');
  const copiedAge = discerning.life.age;
  discerning = pick(discerning, 'copy-accountable');
  assert.equal(discerning.life.age, copiedAge, 'actual discernment saves the extra archive year');
  let sheltering = investigate(byOpportunity.get('mortal-shelter'), 'channel', 'measure-channel');
  sheltering = pick(pick(sheltering, 'go-confront'), 'record-limits');
  const rescueAge = sheltering.life.age;
  sheltering = pick(sheltering, 'organize-rescue');
  assert.equal(sheltering.life.age, rescueAge);
  assert.equal(sheltering.life.injury, 'hurt', 'saving the reorganization year has a visible injury consequence');
  assert.equal(sheltering.world.people['wen-du'].status, 'safe');
});
