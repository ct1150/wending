import test from 'node:test';
import assert from 'node:assert/strict';
import { createCultivation, chooseCultivation } from '../src/game/cultivation/engine.js';
import { BIRTH_TALENTS } from '../src/game/cultivation/model.js';

// Each seed must produce a valid first-life character and persist its fate.
test('first life offers three authored starting routes', () => {
  const openings = new Set();
  for (let i = 0; i < 120; i++) {
    const state = createCultivation({ seed: 'origin-' + i, characterCreation: true });
    openings.add(state.scene.fate.opening);
    assert.equal(state.phase, 'creating');
    const started = chooseCultivation(state, { revision: state.revision, sceneId: state.scene.nodeId, choiceId: 'birth-start' });
    assert.equal(started.kind, 'applied', started.message);
    assert.equal(started.state.scene.fate.opening, state.scene.fate.opening);
  }
  assert.deepEqual([...openings].sort(), ['ferry', 'market', 'valley']);
});

test('all eight traits can be drawn and survive starting a life', () => {
  const found = new Set();
  for (let i = 0; i < 300; i++) {
    const state = createCultivation({ seed: 'talent-' + i, characterCreation: true });
    found.add(state.life.birth.talentId);
    const started = chooseCultivation(state, { revision: state.revision, sceneId: state.scene.nodeId, choiceId: 'birth-start' });
    assert.equal(started.kind, 'applied', started.message);
  }
  assert.deepEqual([...found].sort(), Object.keys(BIRTH_TALENTS).sort());
});
