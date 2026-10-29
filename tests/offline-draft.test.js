import test from 'node:test';
import assert from 'node:assert/strict';
import { createCultivation, getCultivationView, chooseCultivation } from '../src/game/cultivation/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { SAVE_KEY, LEGACY_BACKUP_KEY } from '../src/game/persistence.js';
import { startApp } from './helpers/app-harness.js';

const draftState = app => deserializeGame(app.navigation.offlineDraft.raw);

function existingLife() {
  const state = createCultivation({ seed: 'draft-keeps-existing-life' });
  state.life.name = '旧山客';
  const view = getCultivationView(state), choice = view.choices.find(row => row.enabled);
  return chooseCultivation(state, { revision: view.revision, sceneId: view.sceneId, choiceId: choice.id }).state;
}

async function enterNew(app) {
  await app.clickRendered('[data-title-new]');
  if (app.dialog.open) await app.clickRendered('[data-confirm]');
  assert.match(app.html, /id="birth-name"/);
}

test('entering a new offline life leaves the active save empty until birth is confirmed', async () => {
  const app = await startApp();
  assert.match(app.html, /id="birth-name"/);
  assert.equal(app.storage.raw, null);
  assert.equal(app.storage.writes, 0);
  assert.equal(app.navigation.screen, 'new');
  assert.equal(app.navigation.offlineDraft.expectedRaw, null);
  assert.equal(app.navigation.offlineDraft.expectedBackupRaw, null);
  const before = draftState(app);
  app.clickRendered('[data-birth-start]');
  const started = deserializeGame(app.storage.raw);
  assert.equal(started.phase, 'playing');
  assert.equal(started.rng, before.rng);
  assert.equal(started.world.day, before.world.day);
  assert.deepEqual(started.life.birth, before.life.birth);
  assert.equal(app.storage.writes, 1);
  assert.equal(app.navigation.offlineDraft, null);
  assert.equal(app.navigation.screen, 'adventure');
});

test('name and dice drafts leave the old life and handoff untouched while settings export the active life', async () => {
  const source = existingLife(), raw = serializeGame(source), legacyBackupRaw = '{old handoff bytes';
  const app = await startApp({ raw, legacyBackupRaw, autoEnter: false });
  await enterNew(app);
  assert.equal(app.navigation.offlineDraft.expectedRaw, raw);
  assert.equal(app.navigation.offlineDraft.expectedBackupRaw, legacyBackupRaw);
  app.input('birth-name', '林照');
  app.clickRendered('[data-birth-reroll]');
  const draft = app.navigation.offlineDraft;
  assert.equal(draftState(app).life.name, '林照');
  assert.equal(draftState(app).life.birth.rollCount, 2);
  assert.equal(app.storage.raw, raw);
  assert.equal(app.storage.getItem(LEGACY_BACKUP_KEY), legacyBackupRaw);
  assert.equal(app.storage.writes, 0);
  assert.equal(app.storage.totalWrites, 0);

  app.clickRendered('[data-view="settings"]');
  assert.match(app.html, /当前：旧山客/);
  app.clickRendered('[data-export]');
  const exported = await app.downloads.find(value => value instanceof Blob).text();
  assert.deepEqual(deserializeGame(exported), source);
  assert.deepEqual(app.navigation.offlineDraft, draft);
  assert.equal(app.storage.raw, raw);
  assert.equal(app.storage.writes, 0);

  app.clickRendered('[data-menu-back]');
  assert.match(app.html, /id="birth-name"[^>]*value="林照"/);
  assert.deepEqual(app.navigation.offlineDraft, draft);
  app.clickRendered('[data-menu-back]');
  assert.match(app.html, /data-title-continue/);
  assert.match(app.html, /旧山客/);
  await app.clickRendered('[data-title-continue]');
  assert.match(app.html, /data-journey-choice/);
  assert.equal(app.storage.raw, raw);
  assert.equal(app.storage.getItem(LEGACY_BACKUP_KEY), legacyBackupRaw);
  assert.equal(app.storage.writes, 0);
});

test('reload restores the exact edited offline draft and RNG even when settings was the current page', async () => {
  const raw = serializeGame(existingLife());
  const app = await startApp({ raw, autoEnter: false });
  await enterNew(app);
  app.input('birth-name', '沈渡');
  app.clickRendered('[data-birth-origin="artisan"]');
  app.clickRendered('[data-birth-reroll]');
  const expected = app.navigation.offlineDraft;
  app.clickRendered('[data-view="settings"]');
  const restored = await startApp({ raw, navigation: app.navigation, navigationType: 'reload', autoEnter: false });
  assert.equal(restored.navigation.screen, 'settings');
  assert.deepEqual(restored.navigation.offlineDraft, expected);
  assert.equal(restored.storage.raw, raw);
  assert.equal(restored.storage.writes, 0);
  restored.clickRendered('[data-menu-back]');
  assert.match(restored.html, /id="birth-name"[^>]*value="沈渡"/);
  assert.deepEqual(restored.navigation.offlineDraft, expected);
  assert.equal(draftState(restored).life.birth.originId, 'artisan');
  assert.equal(draftState(restored).life.birth.rollCount, 2);
});

test('a normal visit with a prior tab draft opens home and continues the old active journey', async () => {
  const raw = serializeGame(existingLife()), app = await startApp({ raw, autoEnter: false });
  await enterNew(app);
  app.input('birth-name', '另一生');
  const reopened = await startApp({ raw, navigation: app.navigation, navigationType: 'navigate', autoEnter: false });
  assert.equal(reopened.navigation.screen, 'home');
  assert.match(reopened.html, /data-title-continue/);
  assert.doesNotMatch(reopened.html, /id="birth-name"/);
  assert.equal(reopened.storage.writes, 0);
  await reopened.clickRendered('[data-title-continue]');
  assert.equal(reopened.storage.raw, raw);
  assert.match(reopened.html, /data-journey-choice/);
  assert.equal(reopened.storage.writes, 0);
});

test('returning from a new draft to an existing saved creation restores its own name and autosaves', async () => {
  const source = createCultivation({ seed: 'existing-creation', name: '旧名', contentVersion: 3, characterCreation: true });
  const raw = serializeGame(source), app = await startApp({ raw, autoEnter: false });
  await enterNew(app);
  app.input('birth-name', '新名');
  app.clickRendered('[data-menu-back]');
  await app.clickRendered('[data-title-continue]');
  assert.match(app.html, /id="birth-name"[^>]*value="旧名"/);
  assert.equal(app.storage.raw, raw);
  app.input('birth-name', '旧名续写');
  assert.equal(deserializeGame(app.storage.raw).life.name, '旧名续写');
  assert.equal(app.storage.writes, 1);
  assert.equal(app.navigation.offlineDraft.name, '新名');
});

for (const boundary of ['preserving the original', 'writing the new primary']) {
  test(`a failed birth while ${boundary} retains the exact draft and active save for retry`, async () => {
    const raw = serializeGame(existingLife()), legacyBackupRaw = '{preserve this handoff';
    const denyWrite = boundary === 'preserving the original' ? true : key => key === SAVE_KEY;
    const app = await startApp({ raw, legacyBackupRaw, denyWrite, autoEnter: false });
    await enterNew(app);
    app.input('birth-name', '待入世');
    app.clickRendered('[data-birth-reroll]');
    const before = app.navigation.offlineDraft;
    app.clickRendered('[data-birth-start]');
    assert.match(app.html, /id="birth-name"[^>]*value="待入世"/);
    assert.equal(app.navigation.screen, 'new');
    assert.deepEqual(app.navigation.offlineDraft, before);
    assert.equal(app.storage.raw, raw);
    assert.equal(app.storage.getItem(LEGACY_BACKUP_KEY), legacyBackupRaw);
    assert.equal(app.storage.writes, 0);
    assert.notEqual(app.toast, '', 'failed durable commit must visibly report the storage problem');
    const restored = await startApp({ raw, legacyBackupRaw, navigation: app.navigation, navigationType: 'reload', autoEnter: false });
    assert.deepEqual(restored.navigation.offlineDraft, before);
    restored.clickRendered('[data-birth-start]');
    const started = deserializeGame(restored.storage.raw), prepared = deserializeGame(before.raw);
    assert.equal(started.phase, 'playing');
    assert.equal(started.life.name, '待入世');
    assert.equal(started.rng, prepared.rng);
    assert.deepEqual(started.life.birth, prepared.life.birth);
    assert.equal(restored.navigation.offlineDraft, null);
    assert.equal(restored.storage.writes, 1);
  });
}

for (const boundary of ['primary save', 'legacy handoff']) {
  test(`birth refuses to replace an externally changed ${boundary} and keeps its draft`, async () => {
    const raw = serializeGame(existingLife()), legacyBackupRaw = '{original handoff';
    const app = await startApp({ raw, legacyBackupRaw, autoEnter: false });
    await enterNew(app);
    app.input('birth-name', '新旅程');
    const before = app.navigation.offlineDraft;
    const changedRaw = serializeGame(createCultivation({ seed: 'other-page', name: '另一页' }));
    if (boundary === 'primary save') app.storage.raw = changedRaw;
    else app.storage.setItem(LEGACY_BACKUP_KEY, '{another page handoff');
    const currentRaw = app.storage.raw, currentBackup = app.storage.getItem(LEGACY_BACKUP_KEY), writes = app.storage.totalWrites;
    app.clickRendered('[data-birth-start]');
    assert.match(app.html, /id="birth-name"/);
    assert.equal(app.navigation.screen, 'new');
    assert.deepEqual(app.navigation.offlineDraft, before);
    assert.equal(app.storage.raw, currentRaw);
    assert.equal(app.storage.getItem(LEGACY_BACKUP_KEY), currentBackup);
    assert.equal(app.storage.writes, 0);
    assert.equal(app.storage.totalWrites, writes);
    assert.match(app.toast, /另一页面|刷新/);
  });
}
