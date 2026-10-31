import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { renderJourney, renderJourneyHistory } from '../src/ui/journey.js';
import { renderLiveJourney } from '../src/ui/journey.js';
import { createLiveGame,prepareOpening } from '../src/game/cultivation/live/engine.js';
import { renderIdentityBar } from '../src/ui/character.js';

import { route, clinic } from './helpers/journey-routes.js';

function command(state, choiceId) { const view = getJourneyView(state); return { revision: view.revision, sceneId: view.sceneId, choiceId }; }

test('live opening shows birth facts until escaped streamed prose takes over without choices',()=>{
  const state=createLiveGame({runId:'local-intro',seed:42}),pending=prepareOpening(state,{requestId:'intro'}),before=structuredClone(state);
  const view={state,pending,busy:true,status:'pending',preview:{text:'<script>尚未落定</script>'}};
  const html=renderLiveJourney(view,[]);
  const waiting=renderLiveJourney({...view,preview:null},[]);
  assert.match(waiting,/本地开场/);assert.match(waiting,/天赋/);
  assert.doesNotMatch(html,/天赋/);assert.match(html,/data-live-preview-text/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|data-live-choice=/);assert.deepEqual(state,before);
  assert.match(renderLiveJourney({...view,busy:false,status:'paused'},[]),/未完成/);
});

test('an existing v3 life still exposes a known injury before choosing without restoring routine accounting', () => {
  const source = route(clinic.slice(0, 10).map(id => id === 'continue-road' ? 'learn-method' : id), 4);
  const view = getJourneyView(source), rescue = view.choices.find(choice => choice.id === 'organize-rescue');
  assert.ok(rescue.enabled);
  assert.match(rescue.warning, /受伤/);
  const html = renderJourney(view);
  assert.match(html, /受伤/);
  assert.ok(!html.includes(rescue.detail));
});

test('the real journey renderer separates natural choices from the compact balance bar without mutation', () => {
  const state = createJourney({ seed: 'ui' }), before = structuredClone(state), view = getJourneyView(state);
  const html = renderJourney(view);
  assert.ok(html.includes(view.blocks[0].text));
  for (const choice of view.choices) {
    assert.ok(html.includes(`data-journey-choice="${choice.id}"`));
    assert.ok(!html.includes(choice.detail));
  }
  assert.match(html, /data-revision="0"/); assert.match(html, /data-scene-id="mortal-entry"/);
  let learning = chooseJourney(state, command(state, 'catch-child')).state;
  learning = chooseJourney(learning, command(learning, 'take-medicine')).state;
  assert.match(renderIdentityBar(getJourneyView(learning).summary), /余寿64年/);
  assert.doesNotMatch(html, /data-action|data-equip|data-path|data-origin|resource-strip|inventory/);
  view.summary.name = '<img src=x onerror=alert(1)>';
  view.title = '<script>bad()</script>'; view.blocks[0].text = '<svg onload=bad()>';
  view.choices[0].label = '"<unsafe>'; view.choices[0].detail = '<b>cost</b>';
  const escaped = renderJourney(view) + renderIdentityBar(view.summary);
  assert.doesNotMatch(escaped, /<img|<script|<svg|<unsafe|<b>cost/);
  assert.match(escaped, /&lt;img/); assert.match(escaped, /&lt;script/); assert.doesNotMatch(escaped, /cost/);
  assert.deepEqual(state, before);
});

test('chosen action remains in the history drawer and the latest consequence stays visible; unavailable choices explain why', () => {
  let state = createJourney({ seed: 'ui' });
  state = chooseJourney(state, command(state, 'catch-child')).state;
  const view = getJourneyView(state), html = renderJourney(view);
  const history = renderJourneyHistory(view);
  for (const block of view.blocks) assert.ok(history.includes(block.text));
  assert.ok(!html.includes(view.blocks[0].text));
  assert.ok(html.includes(view.blocks.findLast(block => block.kind === 'result').text));
  assert.match(history, /journey-history/); assert.match(html, /journey-current-title/);
  const disabled = structuredClone(view); disabled.choices[0].enabled = false; disabled.choices[0].reason = '<缺少证物>';
  assert.match(renderJourney(disabled), /disabled/); assert.match(renderJourney(disabled), /&lt;缺少证物&gt;/);
});
