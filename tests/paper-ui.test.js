import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, chooseStory, getStoryView, act, combatAction, getStats, getEventChoices, chooseEvent, serialize, deserialize } from '../src/game/engine.js';
import { renderStoryScene, renderStoryRecords, renderStoryInterruption } from '../src/ui/story.js';

test('opening costs expose current balances next to the authoritative choice, without advancing the engine', () => {
  const state = createGame({ name: '云归', seed: 20261025 });
  const before = structuredClone(state);
  const markup = renderStoryScene(getStoryView(state), state.run);
  const help = markup.match(/<button[^>]*data-story-choice="enter_help"[\s\S]*?<\/button>/)?.[0];
  assert.match(help, /气血当前 120/);
  assert.match(help, /6气血/);
  assert.doesNotMatch(markup, /data-investigation-limit/);
  assert.deepEqual(state, before);
});

test('investigation limit appears when the real route selection begins', () => {
  let state = createGame({ seed: 'paper' });
  for (const id of ['enter_help', 'pledge_truth', 'ask_permission']) state = chooseStory(state, id);
  assert.match(renderStoryScene(getStoryView(state), state.run), /data-investigation-limit/);
});

test('records have stable native disclosure keys so redraw can restore each expanded record', () => {
  const markup = renderStoryRecords(getStoryView(createGame()));
  for (const key of ['journal', 'people', 'clues']) assert.match(markup, new RegExp(`<details[^>]*data-panel-key="${key}"`));
});

// A life-burning option must expose the independent personal lifespan, not the valley clock.
test('life-burning story costs show personal remaining life alongside the real cost', () => {
  let state = createGame({ seed: 'paper' });
  for (const id of ['enter_help', 'pledge_truth', 'ask_permission', 'route_channel']) state = chooseStory(state, id);
  if (getStoryView(state).sceneId.startsWith('SIDE')) state = chooseStory(state, 'leave_side');
  for (const id of ['retreat_marks', 'go_confront', 'limited_correction', 'launch_now', 'sword_break']) state = chooseStory(state, id);
  const markup = renderStoryScene(getStoryView(state), { ...state.run, remainingLife: 84 });
  const burning = markup.match(/<button[^>]*data-story-choice="stabilize_life"[\s\S]*?<\/button>/)?.[0];
  assert.match(burning, /4年余寿（命损）/);
  assert.match(burning, /自身余寿当前 84/);
});

function primaryMarkup(state) {
  const markup = renderStoryScene(getStoryView(state), state.run, state.run.log);
  return markup.match(/<section class="story-result"[\s\S]*?<\/section>/)?.[0] || '';
}

test('fresh YG01 has no birth feedback, but training before its first choice has persistent actual feedback', () => {
  const fresh = createGame({ seed: 20261025 });
  assert.equal(primaryMarkup(fresh), '');
  const trained = act(fresh, { type: 'train' });
  assert.match(primaryMarkup(deserialize(serialize(trained))), /闭关修行/);
  assert.match(primaryMarkup(trained), /静修3年/);
  assert.equal(getStoryView(trained).sceneId, 'YG01');
});

test('a newer cultivation result replaces an older choice without losing saved story details', () => {
  const helped = chooseStory(createGame({ seed: 20261025 }), 'enter_help');
  assert.match(primaryMarkup(helped), /气血-6/);
  const trained = act(helped, { type: 'train' });
  const restored = deserialize(serialize(trained));
  const savedStory = structuredClone(restored.story);
  const markup = primaryMarkup(restored);
  assert.match(markup, /闭关修行/);
  assert.match(markup, /静修3年/);
  assert.doesNotMatch(markup, /先替她搬病人|气血-6/);
  assert.equal((markup.match(/id="story-result-title"/g) || []).length, 1);
  assert.deepEqual(restored.story, savedStory);
  assert.equal(getStoryView(restored).lastResult.title, '先替她搬病人');
});

test('rest, alchemy, event resolution and travel display their latest real engine outcomes after reload', () => {
  const helped = chooseStory(createGame({ seed: 20261025 }), 'enter_help');
  const rest = act(helped, { type: 'rest' });
  const alchemy = act(helped, { type: 'alchemy' });
  let event = act(act(helped, { type: 'train' }), { type: 'explore' });
  assert.equal(event.phase, 'event');
  event = chooseEvent(event, getEventChoices(event).find(choice => choice.enabled && !choice.cost && !choice.requires).id);
  // A valid prepared import boundary isolates travel presentation from realm progression.
  const prepared = structuredClone(helped);
  prepared.run.realmIndex = 2; prepared.run.hp = getStats(prepared).maxHp;
  const travel = act(prepared, { type: 'travel', worldId: 'nether' });
  for (const [state, title] of [[rest, '休养调息'], [alchemy, '延寿丹成'], [event, '合上军籍退出'], [travel, '游历三界']]) {
    const restored = deserialize(serialize(state));
    assert.match(primaryMarkup(restored), new RegExp(title));
    assert.doesNotMatch(primaryMarkup(restored), /先替她搬病人|气血-6/);
  }
});

test('ordinary interruptions do not repeat an older story result above their authoritative panels', () => {
  const helped = chooseStory(createGame({ seed: 20261025 }), 'enter_help');
  const event = act(act(helped, { type: 'train' }), { type: 'explore' });
  const prepared = structuredClone(helped);
  prepared.run.realmIndex = 5; prepared.run.hp = getStats(prepared).maxHp;
  const combat = act(prepared, { type: 'challenge', challengeId: 'mortal-proof' });
  for (const state of [event, combat]) {
    const markup = renderStoryInterruption(getStoryView(state), state.phase, state.run.log);
    assert.doesNotMatch(markup, /story-result-title|气血-6/);
  }
});

test('story-triggered combat retains the current narrative result until an actual combat action supersedes it', () => {
  let state = createGame({ seed: 'paper' });
  for (const id of ['enter_help', 'pledge_truth', 'ask_permission', 'route_channel']) state = chooseStory(state, id);
  if (getStoryView(state).sceneId.startsWith('SIDE')) state = chooseStory(state, 'leave_side');
  for (const id of ['retreat_marks', 'go_confront', 'limited_correction', 'launch_now', 'short_fight']) state = chooseStory(state, id);
  assert.equal(state.phase, 'combat');
  const markup = renderStoryInterruption(getStoryView(state), state.phase, state.run.log);
  assert.match(markup, /story-result-title/);
  assert.match(markup, /短战：击开守炉甲傀/);
  const fighting = combatAction(state, 'guard');
  assert.equal(fighting.phase, 'combat');
  assert.doesNotMatch(renderStoryInterruption(getStoryView(fighting), fighting.phase, fighting.run.log), /story-result-title/);
});
