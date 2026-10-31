import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLiveGame, rollLiveBirth, prepareOpening, commitTurn, prepareChoice, prepareRecordedChoice} from '../src/game/cultivation/live/engine.js';
import {v7ActionRule, resolveV7Action} from '../src/game/cultivation/live/cultivation-rules.js';
import {validateBirth, validateReceipt, serializeLiveState, deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {buildStoryContext, buildMemoryDelta} from '../src/game/cultivation/live/memory.js';
import {buildOpeningBrief} from '../src/game/cultivation/live/experience-story.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v540-unmarked-v7.json', import.meta.url)));
const options = {...fixture.options, originId:'village', experienceVersion:1, originStories:true};
const marked = extra => createLiveGame({...options, ...extra});
const action = (intent, approach, targetId, stake='normal') => ({intent, approach, targetId, stake});
const opponent = {id:'opponent', kind:'person', name:'山客'};
const scene = turn => {
  const sc = structuredClone(fixture.scene);
  sc.id = sc.id.replace(':t1:', ':t'+turn+':');
  for (const choice of sc.choices) choice.id = choice.id.replace(':t1:', ':t'+turn+':');
  return sc;
};

test('marked previews commit exactly the displayed background and all physique/relic and opening/mystery pairs occur', async () => {
  const gear = new Set(), plots = new Set(), backgrounds = new Set();
  for (let seed = 0; seed < 256; seed++) {
    const state = marked({seed});
    const preview = rollLiveBirth({seed, originId:'village', experienceVersion:1, originStories:true});
    assert.deepEqual(preview, {birth:state.life.birth, rng:state.rng});
    assert.deepEqual(state.birthReceipt.birth, preview.birth);
    backgrounds.add(preview.birth.backgroundId);
    gear.add([preview.birth.cultivationProfile.physiqueId, preview.birth.cultivationProfile.relicId].join('/'));
    const brief = buildOpeningBrief({life:state.life, director:state.director, phase:'opening'});
    plots.add([brief.kind, state.director.destiny.motif].join('/'));
  }
  assert.equal(gear.size, 16);
  assert.equal(plots.size, 16);
  const {ORIGIN_BACKGROUNDS} = await import('../src/game/cultivation/live/birth-stories.js');
  assert.deepEqual(backgrounds, new Set(Object.keys(ORIGIN_BACKGROUNDS.village)));
});

test('background membership is validated against origin and legacy births cannot gain it', () => {
  const village = marked({}).life.birth, exile = marked({originId:'exile'}).life.birth;
  assert.throws(() => validateBirth({...village, backgroundId:exile.backgroundId}));
  assert.throws(() => validateBirth({...village, backgroundId:'unknown'}));
  const old = createLiveGame(fixture.options).life.birth;
  assert.ok(!Object.hasOwn(old,'backgroundId'));
  const legacy = createLiveGame({runId:'old'}).life.birth;
  assert.throws(() => validateBirth({...legacy, backgroundId:village.backgroundId}));
  assert.throws(() => createLiveGame({runId:'old', originStories:true}));
});

test('new story lives confirm the same randomly drawn origin even if the caller omits originId', () => {
  for (let seed=0; seed<16; seed++) {
    const params={seed,originStories:true,engineVersion:7};
    const preview=rollLiveBirth(params);
    const state=createLiveGame({...params,runId:'random-origin'});
    assert.deepEqual(state.life.birth,preview.birth);
    assert.equal(state.rng,preview.rng);
  }
});

test('only marked lives receive the new specialized chances and the two sides of fortune-debt', () => {
  for (const [talent, move, delta] of [
    ['sensitive-breath',action('explore','cautious','supplies'),8],
    ['sword-bone',action('fight','assault','opponent'),8],
    ['flash-wisdom',action('practice','breakthrough','qi'),6],
  ]) {
    const s = marked({lockedTalentId:talent});
    s.relatedEntities = [opponent];
    s.life.cultivationProfile.exposure = 90;
    s.life.cultivation = 3;
    const before = structuredClone(s);
    delete before.life.birth.backgroundId;
    const oldRule = v7ActionRule(before, move), rule = v7ActionRule(s, move);
    assert.equal(rule.chance, Math.min(99, oldRule.chance + delta), talent);
  }
  const s = marked({lockedTalentId:'fortune-debt'});
  const explore = action('explore','bold','herbs');
  const rule = v7ActionRule(s, explore);
  const old = structuredClone(s); delete old.life.birth.backgroundId;
  const oldRule = v7ActionRule(old, explore);
  for (const roll of [0,99]) {
    const after = resolveV7Action(s.life,explore,rule,roll,1).nextLife;
    const prior = resolveV7Action(old.life,explore,oldRule,roll,1).nextLife;
    assert.equal(after.items.herbs, prior.items.herbs + (roll===0 ? 1 : 0));
    assert.equal(after.injury, prior.injury + (roll===99 ? 1 : 0));
  }
});

test('keen-memory self-restoration lasts 45 days, verifies against birth, replays and round-trips unchanged', () => {
  const newLife = marked({lockedTalentId:'keen-memory'});
  const opening = scene(1), followup = scene(2);
  Object.assign(opening.choices[0], {intent:'craft', approach:'diagnose', label:'验看本命功法'});
  Object.assign(followup.choices[0], {intent:'craft', approach:'restore', label:'自行推演残法'});
  const start = commitTurn(newLife, prepareOpening(newLife,{requestId:'opening'}), opening);
  const diagnosis = prepareChoice(start,{choiceId:opening.choices[0].id,requestId:'diagnose'});
  const diagnosed = commitTurn(start, diagnosis, followup);
  const restored = prepareChoice(diagnosed,{choiceId:followup.choices[0].id,requestId:'restore'});
  assert.equal(restored.receipt.elapsedDays,45);
  assert.equal(restored.nextLife.cultivationProfile.experience.repaired,true);
  assert.deepEqual(prepareRecordedChoice(diagnosed,restored),restored);
  const after = commitTurn(diagnosed,restored,scene(3));
  assert.deepEqual(deserializeLiveState(serializeLiveState(after)), after);
  assert.equal(buildStoryContext(diagnosed,restored).receipt.elapsedDays,45);
  assert.doesNotThrow(() => buildMemoryDelta(restored.receipt,scene(3)));
  const oldBirth = {...after.life.birth};
  delete oldBirth.backgroundId;
  assert.throws(() => validateReceipt(restored.receipt,{birth:oldBirth}));
});
