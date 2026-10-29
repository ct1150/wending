import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { renderJourney, renderJourneyHistory } from '../src/ui/journey.js';
import { renderLiveJourney } from '../src/ui/journey.js';
import { createLiveGame,prepareOpening } from '../src/game/cultivation/live/engine.js';
import { renderIdentityBar } from '../src/ui/character.js';
import { startApp } from './helpers/app-harness.js';
import { route, clinic } from './helpers/journey-routes.js';

function command(state, choiceId) { const view = getJourneyView(state); return { revision: view.revision, sceneId: view.sceneId, choiceId }; }
function clickChoice(app, state, choiceId) { const cmd = command(state, choiceId); app.click({ journeyChoice: cmd.choiceId, revision: String(cmd.revision), sceneId: cmd.sceneId }); }

test('live opening immediately shows stable birth facts and escaped incomplete narrative without choices',()=>{
  const state=createLiveGame({runId:'local-intro',seed:42}),pending=prepareOpening(state,{requestId:'intro'}),before=structuredClone(state);
  const view={state,pending,busy:true,status:'pending',preview:{text:'<script>尚未落定</script>'}};
  const html=renderLiveJourney(view,[]);
  assert.match(html,/本地开场/);assert.match(html,/天赋/);assert.match(html,/data-live-preview-text/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|data-live-choice=/);assert.deepEqual(state,before);
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

test('actual app continues v3, submits the rendered command once, focuses consequence and reloads unchanged', async () => {
  const app = await startApp({ raw: serializeGame(createJourney({ seed: 20261025 })) });
  let state = deserializeGame(app.storage.raw);
  assert.equal(state.version, 3); assert.equal(state.revision, 0);
  assert.match(app.html, /data-journey-choice/); assert.match(app.html, /data-view="settings"/); assert.match(app.html, /data-home/);
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

test('v3 help/settings/export and failed imports preserve the existing journey', async () => {
  const source = createJourney({ seed: 'restore' }); source.life.name = '<云归>';
  const app = await startApp({ raw: serializeGame(source), denyWrite: true });
  app.clickRendered('[data-view="settings"]'); assert.match(app.html, /data-help/);
  app.click({ help: '' }); assert.match(app.dialog.innerHTML, /选择/); assert.doesNotMatch(app.dialog.innerHTML, /修行 →|功法与法器/);
  app.click({ view: 'settings' }); assert.match(app.html, /data-export/);
  app.click({ export: '' }); assert.match(app.toast, /已导出/);
  const backup = app.downloads.find(item => item instanceof Blob);
  assert.deepEqual(deserializeGame(await backup.text()), source);
  await app.import(serializeGame(source)); assert.match(app.dialog.innerHTML, /&lt;云归&gt;/);
  app.click({ confirm: '' });
  assert.equal(app.storage.raw, serializeGame(source)); assert.equal(app.storage.writes, 0);
  assert.match(app.toast, /quota|保存|存档/);
  app.clickRendered('[data-menu-back]');
  assert.match(app.html, /data-journey-choice/); assert.match(app.html, /data-revision="0"/);
});

test('help and settings are read-only; unavailable choices do not write or consume progress', async () => {
  let source = createJourney({ seed: 'unavailable' });
  source = chooseJourney(source, command(source, 'catch-child')).state;
  source.life.items['medicine-pack'] = 0;
  const raw = serializeGame(source), app = await startApp({ raw });
  assert.match(app.html, /data-journey-choice="take-medicine"[^>]*disabled/);
  app.clickRendered('[data-view="settings"]'); app.clickRendered('[data-help]'); app.click({ closeDialog: '' });
  app.clickRendered('[data-view="settings"]'); app.clickRendered('[data-menu-back]');
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
  app.clickRendered('[data-view="settings"]'); app.clickRendered('[data-export]');
  const progressed = deserializeGame(await app.downloads.find(item => item instanceof Blob).text());
  assert.equal(progressed.revision, 1);
  assert.equal(progressed.scene.nodeId, 'mortal-medicine');
  app.clickRendered('[data-menu-back]');
  clickChoice(app, progressed, 'take-medicine');
  assert.match(app.html, /data-revision="2"/);
});

test('malformed imports and blocked startup preserve exact original data until explicit recovery', async () => {
  const source = serializeGame(createJourney({ seed: 'valid' }));
  const app = await startApp({ raw: source });
  await app.import('{bad'); assert.equal(app.storage.raw, source); assert.equal(app.storage.writes, 0);
  for (const raw of ['{bad', '', JSON.stringify({ version: 99 })]) {
    const blocked = await startApp({ raw });
    assert.match(blocked.html, /原始存档已保留/); assert.doesNotMatch(blocked.html, /data-journey-choice/);
    assert.equal(blocked.storage.raw, raw); assert.equal(blocked.storage.writes, 0);
    blocked.click({ exportCorrupt: '' });
    assert.equal(await blocked.downloads.find(item => item instanceof Blob).text(), raw);
    await blocked.import(source); blocked.click({ confirm: '' });
    assert.equal(deserializeGame(blocked.storage.raw).version, 3);
    assert.match(blocked.html, /data-journey-choice/);
    blocked.clickRendered('[data-view="settings"]'); blocked.clickRendered('[data-export-recovery]');
    const recovery = JSON.parse(await blocked.downloads.filter(item => item instanceof Blob).at(-1).text());
    assert.equal(recovery.format, 'wending-recovery-backups');
    assert.ok(recovery.entries.some(entry => entry.raw === raw && entry.backupRaw === null), 'confirmed recovery keeps the exact corrupt bytes independently exportable');
  }
  const denied = await startApp({ denyRead: true });
  assert.match(denied.html, /拒绝读取本地存档/); assert.equal(denied.storage.raw, null); assert.equal(denied.storage.writes, 0); assert.doesNotMatch(denied.html, /data-birth-start|data-journey-choice/);
});

test('the authored ending stays readable and offers a real direct new-life choice', async () => {
  const app = await startApp({ raw: serializeGame(createJourney({ seed: 20261025 })) });
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
