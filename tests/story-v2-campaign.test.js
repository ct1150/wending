import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,resolveRuleScene,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';
import {validateGeneratedScene} from '../src/game/cultivation/live/schema.js';
import {noteRoutes} from '../src/game/cultivation/live/journey-notes.js';

const AI_CLICHES = [
 /没有(?:为这次离开)?付出额外惩罚/,
 /不会添修为/,
 /读信不算答应/,
 /不发修为或宝物/,
 /失败不会被写成/,
 /不替故人写下死讯/,
 /不编造未确认的重逢/,
 /没有因此替彼此决定未来/,
 /不需要为了展开故事/,
 /没有额外替你接受任何事务/,
 /没有借休整替你完成/,
];

function startV2(seed = 42, name = '沈渡') {
 const state = createLiveGame({runId:'v2-campaign-test',engineVersion:7,originStories:true,eventVersion:2,seed,name});
 const open = prepareOpening(state,{requestId:'open'});
 return commitTurn(state,open,resolveRuleScene(state,open));
}

function choose(state, key) {
 const choice = state.currentScene.choices.find(c => c.id.endsWith(':c:' + key));
 assert.ok(choice, `Node ${state.events.node} missing choice ${key}`);
 const turn = prepareChoice(state,{requestId:`t-${state.turnId}`,choiceId:choice.id});
 return commitTurn(state,turn,resolveRuleScene(state,turn));
}

function sceneText(scene) {
 return scene.blocks.map(b => b.text).join('\n');
}

function assertCleanProse(scene, label) {
 validateGeneratedScene(scene);
 const text = sceneText(scene);
 for (const pattern of AI_CLICHES) {
  assert.doesNotMatch(text, pattern, `${label} contains AI meta-prose: ${pattern}`);
 }
}

test('v2 prologue features real character dialogue, optional village lore, and zero AI meta-prose', () => {
 let s = startV2(42);
 assertCleanProse(s.currentScene, 'prologue-departure');
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'), 'prologue-departure should include dialogue blocks');
 assert.ok(s.currentScene.choices.some(c => c.id.endsWith(':c:visit-stele')), 'prologue-departure should allow visiting the old stele');

 s = choose(s, 'visit-stele');
 assert.equal(s.events.node, 'prologue-stele');
 assertCleanProse(s.currentScene, 'prologue-stele');
 assert.ok(sceneText(s.currentScene).length >= 260, 'prologue-stele should offer rich atmospheric storytelling');

 s = choose(s, 'leave-village');
 assert.equal(s.events.node, 'prologue-gate');
 assertCleanProse(s.currentScene, 'prologue-gate');
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'), 'prologue-gate should feature Steward Zhou speaking directly');

 s = choose(s, 'join-gate');
 assertCleanProse(s.currentScene, 'prologue-work');
 assert.ok(s.currentScene.choices.some(c => c.id.endsWith(':c:talk-linyan')), 'prologue-work should allow a deeper talk with Lin Yan');
 s = choose(s, 'talk-linyan');
 assertCleanProse(s.currentScene, 'prologue-work-talk');
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'), 'talking with Lin Yan should use dialogue');

 s = choose(s, 'work-bank');
 assertCleanProse(s.currentScene, 'prologue-flood');
 s = choose(s, 'save-canal');
 assertCleanProse(s.currentScene, 'prologue-camp');
});

test('v2 independent road allows deep talk with Aunt Liang before the flood', () => {
 let s = startV2(42);
 s = choose(s, 'leave-village');
 s = choose(s, 'take-road');
 assertCleanProse(s.currentScene, 'prologue-road');
 assert.ok(s.currentScene.choices.some(c => c.id.endsWith(':c:talk-liang')), 'prologue-road should allow asking Aunt Liang about her past');
 s = choose(s, 'talk-liang');
 assertCleanProse(s.currentScene, 'prologue-road-talk');
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'), 'Aunt Liang talk should use dialogue');
 s = choose(s, 'follow-water');
 assert.equal(s.events.node, 'prologue-flood');
});

test('v2 three-world campaign chapters have rich xianxia dialogue, epilogue deep-talks, and substantial prose volume', () => {
 let s = startV2(42);
 s = choose(s, 'leave-village');
 s = choose(s, 'join-gate');
 s = choose(s, 'work-bank');
 s = choose(s, 'save-canal');
 for (let i = 0; i < 12 && s.life.realm === 'mortal'; i++) {
  if (s.events.node === 'prologue-result') s = choose(s, 'try-again');
  const next = compileChoices(s, s.currentScene.choices).find(c => c.enabled);
  s = choose(s, next.id.split(':').at(-1));
 }
 s = choose(s, 'take-help');
 s = choose(s, 'campaign-book');
 assertCleanProse(s.currentScene, 'campaign-book');

 s = choose(s, 'campaign-act');
 assertCleanProse(s.currentScene, 'campaign-act-0');
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'), 'campaign chapter 1 should include real NPC dialogue');
 assert.ok(sceneText(s.currentScene).length >= 500, 'each campaign act should be rich and immersive (>= 500 chars)');

 s = choose(s, 'campaign-public');
 assert.equal(s.events.node, 'campaign-result');
 assertCleanProse(s.currentScene, 'campaign-result-0');
 assert.ok(s.currentScene.choices.some(c => c.id.endsWith(':c:campaign-epilogue')), 'campaign-result should provide an optional deep-talk epilogue');

 s = choose(s, 'campaign-epilogue');
 assert.equal(s.events.node, 'campaign-epilogue');
 assertCleanProse(s.currentScene, 'campaign-epilogue-0');
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'), 'campaign-epilogue should include character dialogue');
 assert.ok(noteRoutes(s, [{node:'hub'}]).get('hub'), 'campaign-epilogue should allow clean navigation back to hub');
});
