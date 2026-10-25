import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { renderJourney } from '../src/ui/journey.js';
import { startApp } from './helpers/app-harness.js';

function command(state, choiceId) { const view = getJourneyView(state); return { revision: view.revision, sceneId: view.sceneId, choiceId }; }
function clickChoice(app, state, choiceId) { const cmd = command(state, choiceId); app.click({ journeyChoice: cmd.choiceId, revision: String(cmd.revision), sceneId: cmd.sceneId }); }

test('the real journey renderer exposes current choices, balances and escaped text without mutation', () => {
  const state = createJourney({ seed: 'ui' }), before = structuredClone(state), view = getJourneyView(state);
  const html = renderJourney(view);
  assert.ok(html.includes(view.blocks[0].text));
  for (const choice of view.choices) {
    assert.ok(html.includes(`data-journey-choice="${choice.id}"`));
    assert.ok(html.includes(choice.detail));
  }
  assert.match(html, /data-revision="0"/); assert.match(html, /data-scene-id="mortal-entry"/);
  let learning = chooseJourney(state, command(state, 'catch-child')).state;
  learning = chooseJourney(learning, command(learning, 'take-medicine')).state;
  assert.match(renderJourney(getJourneyView(learning)), /当前余寿：64 年/);
  assert.doesNotMatch(html, /data-action|data-equip|data-path|data-origin|resource-strip|inventory/);
  view.summary.name = '<img src=x onerror=alert(1)>';
  view.title = '<script>bad()</script>'; view.blocks[0].text = '<svg onload=bad()>';
  view.choices[0].label = '"<unsafe>'; view.choices[0].detail = '<b>cost</b>';
  const escaped = renderJourney(view);
  assert.doesNotMatch(escaped, /<img|<script|<svg|<unsafe|<b>cost/);
  assert.match(escaped, /&lt;img/); assert.match(escaped, /&lt;script/); assert.match(escaped, /&lt;b&gt;cost/);
  assert.deepEqual(state, before);
});

test('chosen action and consequence remain in same-page history; unavailable choices explain why', () => {
  let state = createJourney({ seed: 'ui' });
  state = chooseJourney(state, command(state, 'catch-child')).state;
  const view = getJourneyView(state), html = renderJourney(view);
  for (const block of view.blocks) assert.ok(html.includes(block.text));
  assert.match(html, /journey-history/); assert.match(html, /journey-current-title/);
  const disabled = structuredClone(view); disabled.choices[0].enabled = false; disabled.choices[0].reason = '<缺少证物>';
  assert.match(renderJourney(disabled), /disabled/); assert.match(renderJourney(disabled), /&lt;缺少证物&gt;/);
});

test('actual app starts v3, submits the rendered command once, focuses consequence and reloads unchanged', async () => {
  const app = await startApp();
  let state = deserializeGame(app.storage.raw);
  assert.equal(state.version, 3); assert.equal(state.revision, 0);
  assert.match(app.html, /data-journey-choice/); assert.match(app.html, /data-more/);
  assert.doesNotMatch(app.html, /data-action|data-equip|data-path|data-origin|data-rebirth/);
  const button = app.html.match(/<button[^>]*data-journey-choice="catch-child"[^>]*>/)[0];
  const renderedCommand = { journeyChoice: 'catch-child', revision: button.match(/data-revision="([^"]*)"/)[1], sceneId: button.match(/data-scene-id="([^"]*)"/)[1] };
  app.click(renderedCommand);
  const progressed = deserializeGame(app.storage.raw);
  assert.equal(progressed.revision, 1);
  const result = progressed.transcript.find(block => block.kind === 'result');
  assert.equal(app.focus.at(-1), `#journey-block-${result.id}`);
  assert.equal(app.scroll.at(-1), `#journey-block-${result.id}`);
  const writes = app.storage.writes;
  clickChoice(app, state, 'catch-child');
  assert.equal(app.storage.writes, writes); assert.deepEqual(deserializeGame(app.storage.raw), progressed);
  const restored = await startApp({ raw: app.storage.raw });
  assert.deepEqual(deserializeGame(restored.storage.raw), progressed); assert.equal(restored.storage.writes, 0);
  assert.ok(restored.html.includes(result.text));
  restored.click(renderedCommand);
  assert.equal(restored.storage.writes, 0);
  assert.deepEqual(deserializeGame(restored.storage.raw), progressed);
});

test('v3 help/settings/export/import/reset and failed storage use the unified boundaries', async () => {
  const source = createJourney({ seed: 'restore' }); source.life.name = '<云归>';
  const app = await startApp({ raw: serializeGame(source), denyWrite: true });
  app.click({ more: '' }); assert.match(app.dialog.innerHTML, /data-help/);
  app.click({ help: '' }); assert.match(app.dialog.innerHTML, /选择/); assert.doesNotMatch(app.dialog.innerHTML, /修行 →|功法与法器/);
  app.click({ view: 'settings' }); assert.match(app.html, /data-export/);
  app.click({ export: '' }); assert.match(app.toast, /已导出/);
  const backup = app.downloads.find(item => item instanceof Blob);
  assert.deepEqual(deserializeGame(await backup.text()), source);
  await app.import(serializeGame(source)); assert.match(app.dialog.innerHTML, /&lt;云归&gt;/);
  app.click({ confirm: '' }); assert.match(app.html, /自动保存暂不可用/); assert.match(app.html, /data-journey-choice/);
  app.click({ reset: '' }); app.click({ confirm: '' });
  assert.match(app.html, /data-revision="0"/); assert.doesNotMatch(app.html, /dao-name/);
});

test('help and settings are read-only; unavailable choices do not write or consume progress', async () => {
  let source = createJourney({ seed: 'unavailable' });
  source = chooseJourney(source, command(source, 'catch-child')).state;
  source.life.items['medicine-pack'] = 0;
  const raw = serializeGame(source), app = await startApp({ raw });
  assert.match(app.html, /data-journey-choice="take-medicine"[^>]*disabled/);
  app.click({ more: '' }); app.click({ help: '' }); app.click({ closeDialog: '' });
  app.click({ view: 'settings' }); app.click({ view: 'adventure' });
  assert.equal(app.focus.at(-1), '#journey-current-title');
  clickChoice(app, source, 'take-medicine');
  assert.match(app.toast, /缺少/); assert.equal(app.storage.writes, 0); assert.equal(app.storage.raw, raw);
  clickChoice(app, source, 'search-unmedicated');
  assert.equal(deserializeGame(app.storage.raw).revision, source.revision + 1);
});

test('failed writes leave new choices exportable while keeping the previous stored backup', async () => {
  const source = createJourney({ seed: 'quota' }), raw = serializeGame(source);
  const app = await startApp({ raw, denyWrite: true });
  clickChoice(app, source, 'catch-child');
  assert.equal(app.storage.raw, raw); assert.match(app.html, /自动保存暂不可用/);
  app.click({ export: '' });
  const progressed = deserializeGame(await app.downloads.find(item => item instanceof Blob).text());
  assert.equal(progressed.revision, 1);
  assert.equal(progressed.scene.nodeId, 'mortal-medicine');
  clickChoice(app, progressed, 'take-medicine');
  assert.match(app.html, /data-revision="2"/);
});

test('malformed imports and blocked startup preserve exact original data until explicit recovery', async () => {
  const source = serializeGame(createJourney({ seed: 'valid' }));
  const app = await startApp({ raw: source });
  await app.import('{bad'); assert.equal(app.storage.raw, source); assert.equal(app.storage.writes, 0);
  for (const raw of ['{bad', '', JSON.stringify({ version: 99 })]) {
    const blocked = await startApp({ raw });
    assert.match(blocked.html, /原存档未被覆盖/); assert.doesNotMatch(blocked.html, /data-journey-choice/);
    assert.equal(blocked.storage.raw, raw); assert.equal(blocked.storage.writes, 0);
    blocked.click({ exportCorrupt: '' });
    assert.equal(await blocked.downloads.find(item => item instanceof Blob).text(), raw);
    await blocked.import(source); blocked.click({ confirm: '' });
    assert.equal(deserializeGame(blocked.storage.raw).version, 3);
    assert.match(blocked.html, /data-journey-choice/);
  }
  const denied = await startApp({ denyRead: true });
  assert.match(denied.html, /未创建新人生/); assert.equal(denied.storage.writes, 0);
});

test('the authored ending stays readable and offers a real direct new-life choice', async () => {
  const app = await startApp();
  for (const id of ['catch-child', 'take-medicine', 'continue-road', 'pledge-truth', 'route-channel', 'retreat-marks', 'go-confront', 'record-limits', 'evacuate-wounded', 'choose-ash', 'handoff-record', 'keep-watch']) {
    const state = deserializeGame(app.storage.raw);
    clickChoice(app, state, id);
    assert.equal(deserializeGame(app.storage.raw).revision, state.revision + 1);
  }
  const ended = deserializeGame(app.storage.raw);
  assert.equal(ended.phase, 'ended'); assert.ok(app.html.includes(ended.summary.title));
  assert.match(app.html, /data-journey-choice="new-life"/);
  assert.doesNotMatch(app.html, /data-rebirth|data-start|dao-name/);
  app.click({ view: 'settings' }); app.click({ export: '' }); assert.match(app.toast, /已导出/);
});

test('imported progressed journey focuses current context rather than the first historical consequence',async()=>{
 let state=createJourney({seed:4});
 for(const id of ['catch-child','take-medicine','continue-road','pledge-truth'])state=chooseJourney(state,command(state,id)).state;
 const app=await startApp();await app.import(serializeGame(state));app.click({confirm:''});
 assert.equal(app.focus.at(-1),'#journey-current-title');
});
