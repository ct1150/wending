import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame, prepareOpening, prepareChoice, commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {ORIGIN_BACKGROUNDS, TALENT_STORIES} from '../src/game/cultivation/live/birth-stories.js';
import {ORIGINS, TALENTS} from '../src/game/cultivation/live/model.js';
import {generateScene} from '../src/worker/story-provider.js';
import {GLM_PROFILE, STORY_LIMITS} from '../src/worker/story-config.js';

const profile = {...GLM_PROFILE, validated: true, supportsStructuredOutput: true};
const runtime = {storyActions: true, engineMenu: true};
const actor = {kind: 'person', name: '芦娘'};
const firstScene = {
  blocks: [
    {kind: 'narration', text: '岸边候着一条运盐船，木桩上的双扣结打反了一道。你认得老艄公教你的手势，反结是仓促改过的。'},
    {kind: 'dialogue', speaker: actor, text: '我这里存着昨晚的船册，你肯替我看看是谁换过缆绳么？'},
  ],
  choices: [
    {action: 'interact:ask', target: actor, purpose: '问芦娘昨晚谁来借过扎出反扣的缆绳'},
    {action: 'interact:decline', target: actor, purpose: '婉拒查绳的托付，让芦娘另请识结的人'},
  ],
};
const afterRefusal = {
  blocks: [{kind: 'narration', text: '船册合上了。盐棚外有人往石阶上撒灰，潮水一退，便露出三道靛青色的轮印。'}],
  choices: [
    {action: 'interact:observe', target: 'self', purpose: '辨清靛青轮印在第几级石阶折返'},
    {action: 'travel:road', target: {kind:'place', name:'南堤盐棚'}, stake:'low', purpose:'前往南堤盐棚查探车轮染青的缘由'},
  ],
};

function birth({marked = true, seed = 4, lockedTalentId} = {}) {
  const state = createLiveGame({runId: 'ferry-child', originId: 'ferry', seed, engineVersion: 7, experienceVersion: 1, ...(marked ? {originStories: true} : {}), ...(lockedTalentId ? {lockedTalentId} : {})});
  const pending = prepareOpening(state, {requestId: 'opening'});
  return {state, pending, context: buildStoryContext(state, pending)};
}

// Capture the exact request passed to the real GLM transport and stream the
// fixture through the production decoder, including its one-call budget.
async function complete(context, wire, finish = 'stop') {
  const calls = [];
  const ai = {async run(model, input) {
    calls.push(input);
    const content = typeof wire === 'string' ? wire : JSON.stringify(wire);
    const packet = {model, choices:[{delta:{content}, finish_reason:finish}], usage:{prompt_tokens:3600, completion_tokens:360, total_tokens:3960}};
    return new Response('data: '+JSON.stringify(packet)+'\n\ndata: [DONE]\n\n').body;
  }};
  const result = await generateScene(ai, profile, context, {}, runtime);
  assert.equal(calls.length, 1, result.errorCode);
  const input = calls[0];
  assert.ok(Buffer.byteLength(JSON.stringify(input)) <= STORY_LIMITS.maxInputBytes);
  return {result, input, facts: JSON.parse(input.messages[1].content)};
}

test('a marked birth uses its past and both talents at the model boundary, then offers authored alternatives after refusal', async () => {
  const {state, pending, context} = birth();
  const opened = await complete(context, firstScene);
  assert.equal(opened.result.status, 'ready', opened.result.errorCode);
  const {originId, backgroundId, talentIds} = state.life.birth;
  const expectedPast = {
    origin:ORIGINS[originId],
    beforeOpening:ORIGIN_BACKGROUNDS[originId][backgroundId],
    talents:talentIds.map(id => ({name:TALENTS[id], ...TALENT_STORIES[id]})),
  };
  assert.equal(backgroundId, 'ferry-knots');
  assert.deepEqual(opened.facts.birthMemory, expectedPast);
  assert.deepEqual(opened.input.response_format.json_schema.schema.required, ['blocks','choices']);
  const active = commitTurn(state, pending, opened.result.scene);
  assert.deepEqual(active.currentScene.choices.map(choice => choice.approach), ['ask','decline']);
  const decline = active.currentScene.choices[1];
  for (const [i, choice] of firstScene.choices.entries()) assert.ok(active.currentScene.choices[i].label.endsWith(choice.purpose));

  const next = prepareChoice(active, {requestId:'decline', choiceId:decline.id});
  const nextContext = buildStoryContext(active, next, [], {continuity:true});
  const follow = await complete(nextContext, afterRefusal);
  assert.equal(follow.result.status, 'ready', follow.result.errorCode);
  assert.deepEqual(follow.facts.birthMemory, expectedPast);
  assert.equal(follow.facts.receipt.action.label, decline.label);
  assert.ok(follow.facts.memory.recent.some(row => row.text.includes('船册')));
  const turn = JSON.parse(follow.input.messages.at(-1).content);
  assert.equal(turn.selectedPurpose, decline.label);
  assert.equal(turn.settledLocation, active.currentScene.location);
  assert.match(turn.guidance, /不继续原请求/);
  const continued = commitTurn(active, next, follow.result.scene);
  assert.deepEqual(continued.currentScene.choices.map(choice => choice.approach), ['observe','road']);
  for (const [i, choice] of afterRefusal.choices.entries()) assert.ok(continued.currentScene.choices[i].label.endsWith(choice.purpose));
});

test('prose without authored choices cannot receive a generated substitute menu on marked lives', async () => {
  const wire = {blocks:firstScene.blocks};
  const marked = await complete(birth().context, wire);
  assert.equal(marked.result.errorCode, 'GENERATED_SCENE_INVALID');
  const older = await complete(birth({marked:false}).context, wire);
  assert.equal(older.result.status, 'ready', older.result.errorCode);
  assert.deepEqual(older.input.response_format.json_schema.schema.required, ['blocks']);
  assert.equal(older.facts.birthMemory, undefined);
});

test('a capped completion retains its complete authored growth choice and cannot invent a pledge', async () => {
  const {state, pending, context} = birth({seed:2});
  const diagnose = {action:'craft:diagnose', target:'self', stake:'low', purpose:'对照船册的反笔验看旧谱中抄错的经络'};
  const opening = {...firstScene, choices:[diagnose,firstScene.choices[1]]};
  const capped = JSON.stringify(opening).slice(0,-1)+',"title":"';
  const opened = await complete(context, capped, 'length');
  assert.equal(opened.result.status, 'ready', opened.result.errorCode);
  const active = commitTurn(state, pending, opened.result.scene);
  const next = prepareChoice(active, {requestId:'old-method', choiceId:active.currentScene.choices[0].id});
  assert.equal(next.receipt.action.approach, 'diagnose');
  const nextContext = buildStoryContext(active, next, [], {continuity:true});
  const terms = {action:'craft:pledge', target:'k1', stake:'low', purpose:'接受芦娘的校法指点，约定下次还一份行粮'};
  const decline = {...firstScene.choices[1], target:'k1'};
  const reply = {blocks:[{kind:'dialogue', speaker:'k1', text:'我只是认出这本旧谱，不能替你校法。'}], choices:[terms,decline]};
  assert.equal((await complete(nextContext, reply)).result.errorCode, 'CHOICE_NOT_COMPILABLE');
  reply.blocks[0].text = '我愿用三日替你校法，下次见面还我一份行粮。';
  const offered = await complete(nextContext, reply);
  assert.equal(offered.result.status, 'ready', offered.result.errorCode);
  assert.ok(offered.result.scene.choices[0].label.endsWith(terms.purpose));
});

test('holding a different talent changes the model’s specific clue and rule guidance in the same ferry opening', async () => {
  const talents = ['keen-memory','sword-bone'];
  const [memory, sword] = await Promise.all(talents.map(lockedTalentId =>
    complete(birth({seed:2, lockedTalentId}).context, afterRefusal)));
  assert.deepEqual(JSON.parse(memory.input.messages[2].content).opening, JSON.parse(sword.input.messages[2].content).opening);
  assert.equal(memory.facts.birthMemory.origin, ORIGINS.ferry);
  assert.equal(memory.facts.birthMemory.beforeOpening, ORIGIN_BACKGROUNDS.ferry['ferry-shoal']);
  assert.equal(sword.facts.birthMemory.beforeOpening, memory.facts.birthMemory.beforeOpening);
  assert.deepEqual(memory.facts.birthMemory.talents[1], sword.facts.birthMemory.talents[1]);
  for (const [i, sample] of [memory,sword].entries()) {
    assert.equal(sample.result.status, 'ready', sample.result.errorCode);
    assert.deepEqual(sample.facts.birthMemory.talents[0], {name:TALENTS[talents[i]], ...TALENT_STORIES[talents[i]]});
    assert.ok(!JSON.stringify(sample.facts.birthMemory).includes(TALENT_STORIES[talents[1-i]].effect));
  }
});
