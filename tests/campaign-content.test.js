import test from 'node:test';
import assert from 'node:assert/strict';
import { NODES, resolveCultivationScene, AUTHORING_BRIEFS } from '../src/game/cultivation/v3/content.js';

test('CV3 has at least one hundred distinct authored choice scenes and stable prose slots', () => {
  assert.ok(NODES.length >= 100, `Only ${NODES.length} scenes`);
  assert.equal(new Set(NODES).size, NODES.length);
  assert.ok(AUTHORING_BRIEFS.length >= 10);
  assert.equal(new Set(AUTHORING_BRIEFS.map(row => row.id)).size, AUTHORING_BRIEFS.length);
});

test('all authored scenes resolve without drawing fate or mutating saved state', () => {
  for (const nodeId of NODES) {
    const state = {world:{facts:{},proofs:[]},life:{birth:{originId:'village',talentIds:['keen-memory','iron-bones']},facts:{},items:{},skills:[],realm:'mortal',cultivation:0,injury:0},scene:{nodeId,fate:{route:'sect',trial:'ruins',pressure:'pursuit'},visited:{}}};
    const before = JSON.stringify(state);
    const scene = resolveCultivationScene(state);
    assert.equal(scene.id, nodeId);
    assert.ok(scene.goal.length > 5, nodeId);
    assert.ok(scene.blocks.some(block => block.kind === 'dialogue'), nodeId);
    if(nodeId!=='ended') assert.ok(scene.choices.length >= 2 && scene.choices.length <= 3, nodeId);
    assert.ok(scene.blocks.map(block => block.text).join('').length >= 150, nodeId);
    for (const choice of scene.choices) assert.ok(NODES.includes(choice.to), `${nodeId} -> ${choice.to}`);
    assert.equal(JSON.stringify(state), before);
  }
});
