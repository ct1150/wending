import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/game/cultivation/live/engine.js';
import {ORIGINS, TALENTS} from '../src/game/cultivation/live/model.js';

test('each seeded preview can be confirmed with exactly the same birth and RNG', () => {
  const origins = new Set();
  for (let seed = 0; seed < 32; seed++) {
    const options = {seed, experienceVersion: 1, inheritedBenefits: ['past-memory']};
    const preview = engine.rollLiveBirth(options);
    const {originId} = preview.birth;
    origins.add(originId);

    const state = engine.createLiveGame({...options, originId, runId: 'confirmed-life', engineVersion: 7});
    const opening = engine.prepareOpening(state, {requestId: 'first-turn'});
    assert.deepEqual(opening.receipt.birth, preview.birth);
    assert.deepEqual(opening.nextLife.birth, preview.birth);
    assert.equal(opening.nextRng, preview.rng);
    assert.deepEqual(engine.rollLiveBirth(options), preview);
  }
  assert.deepEqual(origins, new Set(Object.keys(ORIGINS)));
});

test('locking a shown talent preserves the current roll and carries only that talent into new rolls', () => {
  const original = engine.rollLiveBirth({seed: 'first'});
  for (const lockedTalentId of original.birth.talentIds) {
    assert.deepEqual(engine.rollLiveBirth({seed: 'first', lockedTalentId}), original);
    const partners = new Set();
    for (let seed = 0; seed < 32; seed++) {
      const unlocked = engine.rollLiveBirth({seed});
      const locked = engine.rollLiveBirth({seed, lockedTalentId});
      assert.deepEqual(locked, {...unlocked, birth: {...unlocked.birth, talentIds: locked.birth.talentIds}});
      assert.equal(new Set(locked.birth.talentIds).size, 2);
      assert.ok(locked.birth.talentIds.includes(lockedTalentId));
      partners.add(locked.birth.talentIds.find(id => id !== lockedTalentId));
      const state = engine.createLiveGame({runId: 'locked-life', engineVersion: 7, seed, originId: locked.birth.originId, lockedTalentId});
      assert.deepEqual(state.life.birth, locked.birth);
    }
    assert.ok(partners.size > 1);
  }
});

test('the traditional village default and its seed stream still reproduce the same explicit-origin preview', () => {
  const original = engine.createLiveGame({runId: 'default-origin', seed: 42, engineVersion: 7});
  const preview = engine.rollLiveBirth({seed: 42, originId: 'village'});
  assert.equal(original.life.birth.originId, 'village');
  assert.deepEqual(preview.birth, original.life.birth);
  assert.equal(preview.rng, original.rng);
});

test('unknown and legacy locks cannot be confirmed', () => {
  assert.throws(() => engine.createLiveGame({runId: 'v7-bad-lock', engineVersion: 7, lockedTalentId: 'unknown'}), /命格/);
  assert.throws(() => engine.createLiveGame({runId: 'legacy-lock', lockedTalentId: Object.keys(TALENTS)[0]}), /命格/);
});
