import test from 'node:test';
import assert from 'node:assert/strict';
import { createCultivation, getCultivationView, chooseCultivation } from '../src/game/cultivation/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { startApp } from './helpers/app-harness.js';

const saved = app => deserializeGame(app.storage.raw);
const draft = app => deserializeGame(app.navigation.offlineDraft.raw);
const birthCommand = (state, key) => ({ [key]: '', revision: String(state.revision), sceneId: state.scene.nodeId });

test('fresh application keeps its unstarted dice profile in the tab and reloads without drawing again', async () => {
  const app = await startApp(), before = draft(app);
  assert.equal(before.contentVersion, 3);
  assert.equal(before.phase, 'creating');
  assert.equal(before.transcript.length, 0);
  assert.equal(before.life.birth.rollCount, 1);
  assert.equal(app.storage.raw, null);
  assert.equal(app.storage.writes, 0);
  assert.match(app.html, /id="birth-name"/);
  assert.match(app.html, /data-birth-reroll/);
  assert.doesNotMatch(app.html, /data-journey-choice/);
  const restored = await startApp({ sessionValues: app.sessionValues, navigationType: 'reload' });
  assert.equal(restored.storage.writes, 0);
  assert.equal(restored.storage.raw, null);
  assert.deepEqual(draft(restored), before);
});

test('typing a valid draft name keeps focus and dice controls current without writing the active save', async () => {
  const app = await startApp(), before = draft(app);
  app.input('birth-name', '<山岚>');
  const named = draft(app);
  assert.equal(named.life.name, '<山岚>');
  assert.equal(named.rng, before.rng);
  assert.equal(named.world.day, before.world.day);
  assert.deepEqual(named.life.birth, before.life.birth);
  assert.equal(app.focus.length, 0, 'typing should keep the input and IME cursor intact');
  app.clickRendered('[data-birth-reroll]');
  const rolled = draft(app);
  assert.equal(rolled.life.name, '<山岚>');
  assert.equal(rolled.life.birth.rollCount, 2);
  assert.notEqual(rolled.rng, named.rng);
  assert.equal(rolled.world.day, named.world.day);
  assert.match(app.html, /&lt;山岚&gt;/);
  assert.equal(app.storage.raw, null);
  assert.equal(app.storage.writes, 0);
  const navigation = app.navigation;
  app.click(birthCommand(named, 'birthReroll'));
  assert.deepEqual(app.navigation, navigation);
  assert.equal(app.storage.raw, null);
  assert.equal(app.storage.writes, 0);
});

test('empty names and composing text cannot start a life and an IME result is saved only when complete', async () => {
  const app = await startApp(), before = draft(app);
  app.input('birth-name', '');
  app.click(birthCommand(before, 'birthStart'));
  assert.deepEqual(draft(app), before);
  assert.equal(app.storage.raw, null);
  assert.match(app.toast, /姓名|名字/);
  app.composition('birth-name', 'compositionstart');
  app.input('birth-name', 'shan', { isComposing: true });
  app.submit('birth-form');
  assert.deepEqual(draft(app), before);
  assert.equal(app.storage.writes, 0);
  app.input('birth-name', '山岚', { isComposing: true });
  app.composition('birth-name', 'compositionend');
  assert.equal(draft(app).life.name, '山岚');
  assert.equal(app.storage.raw, null);
  app.submit('birth-form');
  const started = saved(app);
  assert.equal(started.phase, 'playing');
  assert.equal(started.life.name, '山岚');
  assert.equal(app.storage.writes, 1);
  assert.equal(app.navigation.offlineDraft, null);
  assert.equal(started.rng, before.rng);
  assert.ok(started.transcript.some(block => block.text.includes('山岚')));
  assert.match(app.html, /data-character/);
  assert.match(app.html, /data-history/);
  assert.doesNotMatch(app.html, /id="birth-name"/);
  const writes = app.storage.writes;
  app.submit('birth-form');
  app.click(birthCommand(started, 'birthStart'));
  assert.equal(app.storage.writes, writes);
});

test('character and full history drawers are read-only while the current page keeps only the latest scene and result', async () => {
  let source = createCultivation({ seed: 'immersive-drawers' });
  for (let index = 0; index < 2; index++) {
    const view = getCultivationView(source), choice = view.choices.find(row => row.enabled);
    source = chooseCultivation(source, { revision: view.revision, sceneId: view.sceneId, choiceId: choice.id }).state;
  }
  const raw = serializeGame(source), app = await startApp({ raw });
  const first = source.transcript[0], latest = source.transcript.findLast(row => row.kind === 'result');
  assert.ok(!app.html.includes(first.text), 'earlier prose belongs to history');
  assert.ok(app.html.includes(latest.text), 'the latest consequence stays next to the current scene');
  app.click({ character: '' });
  assert.equal(app.dialog.open, true);
  assert.match(app.dialog.className, /paper-drawer/);
  assert.match(app.dialog.innerHTML, /余寿|寿限/);
  assert.match(app.dialog.innerHTML, /随身|行囊|物品/);
  app.cancelDialog();
  assert.equal(app.dialog.open, false);
  assert.equal(app.focus.at(-1), '[data-character]');
  app.click({ history: '' });
  assert.ok(app.dialog.innerHTML.includes(first.text));
  assert.ok(app.dialog.innerHTML.includes(latest.text));
  assert.doesNotMatch(app.dialog.innerHTML, /data-journey-choice/);
  app.click({ closeDialog: '' });
  assert.equal(app.focus.at(-1), '[data-history]');
  assert.equal(app.storage.writes, 0);
  assert.equal(app.storage.raw, raw);
});

test('an existing saved creation keeps name and dice autosaves and imports exactly with creation focus', async () => {
  const app = await startApp({ raw: serializeGame(createCultivation({ seed: 'saved-creation', characterCreation: true, contentVersion: 3 })) });
  assert.equal(app.storage.writes, 0);
  app.input('birth-name', '林照');
  assert.equal(app.storage.writes, 1);
  app.clickRendered('[data-birth-reroll]');
  assert.equal(app.storage.writes, 2);
  const source = saved(app);
  app.clickRendered('[data-view="settings"]'); app.clickRendered('[data-export]');
  const raw = await app.downloads.find(value => value instanceof Blob).text();
  assert.deepEqual(deserializeGame(raw), source);
  const target = await startApp({ raw: serializeGame(createCultivation({ seed: 'old-life' })) });
  await target.import(raw);
  assert.equal(saved(target).phase, 'playing');
  target.click({ confirm: '' });
  assert.deepEqual(saved(target), source);
  assert.equal(target.focus.at(-1), '#birth-title');
  target.clickRendered('[data-birth-start]');
  assert.equal(saved(target).phase, 'playing');
  assert.equal(saved(target).life.name, '林照');
  assert.equal(saved(target).rng, source.rng);
});
