import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { liveBrowser } from './helpers/live-browser.js';
import { createCultivation, chooseCultivation } from '../src/game/cultivation/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { SAVE_KEY, LEGACY_BACKUP_KEY } from '../src/game/persistence.js';
import { JOURNEY_SAVES_KEY } from '../src/game/journey-saves.js';

const ACTIVE_MODE_KEY = 'wending-active-mode-v1';

async function fixture(t, { offline = true, corruptLibrary = null, legacyBackupRaw = null } = {}) {
  const { page, origin } = await liveBrowser(t), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/story/**', async route => {
    requests.push(route.request().url());
    await route.abort();
  });
  t.after(() => {
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [], 'cached journey selection and creation drafts must not request new stories');
  });
  const records = await page.evaluate(async () => {
    const archive = await open(), records = [];
    try {
      for (const [runId, name] of [['retained-live-a', '林映'], ['retained-live-b', '沈渡']]) {
        const state = engine.createLiveGame({ runId, name, seed: 42 });
        await archive.create({ state, pending: engine.prepareOpening(state, { requestId: `${runId}-opening` }), expectedArchiveId: records.at(-1)?.archiveId ?? null });
        await advance(archive);
        records.push(await archive.load());
      }
      return records;
    } finally { archive.close(); }
  });
  const creation = createCultivation({ seed: 'offline-switch-recovery', name: '山中客', characterCreation: true, contentVersion: 3 });
  const source = chooseCultivation(creation, { revision: creation.revision, sceneId: creation.scene.nodeId, choiceId: 'birth-start' }).state;
  const originalRaw = serializeGame(source);
  await page.evaluate(({ raw, offline, corruptLibrary, legacyBackupRaw, saveKey, libraryKey, backupKey, modeKey }) => {
    if (offline) localStorage.setItem(saveKey, raw);
    localStorage.setItem(modeKey, offline ? 'offline' : 'live');
    if (corruptLibrary !== null) localStorage.setItem(libraryKey, corruptLibrary);
    if (legacyBackupRaw !== null) localStorage.setItem(backupKey, legacyBackupRaw);
    sessionStorage.clear();
  }, { raw: originalRaw, offline, corruptLibrary, legacyBackupRaw, saveKey: SAVE_KEY, libraryKey: JOURNEY_SAVES_KEY, backupKey: LEGACY_BACKUP_KEY, modeKey: ACTIVE_MODE_KEY });
  await page.goto(`${origin}/index.html?journey-switch-recovery`);
  await page.locator('[data-title-continue]:enabled').waitFor();
  return { page, records, source, originalRaw };
}

async function exportOffline(page) {
  await page.locator('[data-view="settings"]').click();
  const downloading = page.waitForEvent('download');
  await page.locator('[data-export]').click();
  const download = await downloading;
  const raw = await readFile(await download.path(), 'utf8');
  await page.locator('[data-menu-back]').click();
  return raw;
}

async function leaveUnsavedProgress(f, { denyPreservation = false } = {}) {
  const { page, source, originalRaw } = f;
  await page.locator('[data-title-continue]').click();
  await page.locator('[data-journey-choice]:enabled').first().waitFor();
  await page.evaluate(({ saveKey, libraryKey, denyPreservation }) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && (key === saveKey || denyPreservation && key === libraryKey)) {
        throw new DOMException('Injected storage quota failure', 'QuotaExceededError');
      }
      return setItem.call(this, key, value);
    };
    globalThis.restoreRecoveryWrites = () => { Storage.prototype.setItem = setItem; };
  }, { saveKey: SAVE_KEY, libraryKey: JOURNEY_SAVES_KEY, denyPreservation });
  await page.locator('[data-journey-choice]:enabled').first().click();
  await page.locator('[role="alert"]').waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), originalRaw);
  const newerRaw = await exportOffline(page);
  assert.equal(deserializeGame(newerRaw).revision, source.revision + 1);
  assert.notEqual(newerRaw, originalRaw);
  return newerRaw;
}

async function retainedOffline(page, raw) {
  return page.evaluate(({ key, raw }) => {
    const records = JSON.parse(localStorage.getItem(key) ?? '{"entries":[]}').entries;
    return records.find(entry => entry.raw === raw) ?? null;
  }, { key: JOURNEY_SAVES_KEY, raw });
}

async function currentLive(page) {
  return page.evaluate(async () => {
    const { openLiveArchive } = await import('/src/game/live-archive.js');
    const archive = await openLiveArchive();
    try { return await archive.load(); }
    finally { archive.close(); }
  });
}

test('switching to a retained live journey preserves unsaved offline progress for reload and exact restoration', { timeout: 45000 }, async t => {
  const f = await fixture(t), { page, records, originalRaw } = f;
  const newerRaw = await leaveUnsavedProgress(f);
  await page.locator('[data-home]').click();
  await page.locator('[data-saves]').click();
  await page.locator(`[data-select-live="${records[0].archiveId}"]:enabled`).click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();
  const retained = await retainedOffline(page, newerRaw);
  assert.ok(retained, 'the exact newer offline export must be durable before switching to live');
  assert.equal(retained.originalRaw, originalRaw);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), originalRaw);
  assert.deepEqual((await currentLive(page)).state, records[0].state);

  await page.reload();
  await page.locator('[data-live-choice]:enabled').first().waitFor();
  await page.locator('[data-home]').click();
  await page.locator('[data-saves]').click();
  await page.locator(`[data-select-offline="${retained.id}"]:enabled`).click();
  await page.locator('[data-journey-choice]:enabled').first().waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), newerRaw);
  assert.equal(await exportOffline(page), newerRaw);
});

test('failure to preserve newer offline progress blocks live selection and keeps that progress exportable', { timeout: 45000 }, async t => {
  const f = await fixture(t), { page, records, originalRaw } = f;
  const newerRaw = await leaveUnsavedProgress(f, { denyPreservation: true });
  await page.locator('[data-home]').click();
  await page.locator('[data-saves]').click();
  await page.locator(`[data-select-live="${records[0].archiveId}"]:enabled`).click();
  await page.waitForFunction(() => document.querySelector('[data-live-choice]') || document.querySelector('[data-select-live]:not(:disabled)'));
  assert.equal(await page.locator('[data-live-choice]').count(), 0, 'a failed preservation must not enter the live journey');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), ACTIVE_MODE_KEY), 'offline');
  assert.equal((await currentLive(page)).archiveId, records[1].archiveId);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), originalRaw);
  assert.equal(await retainedOffline(page, newerRaw), null);
  assert.match(await page.locator('#toast').getAttribute('class'), /error/);
  await page.locator('[data-menu-back]').click();
  await page.locator('[data-title-continue]').click();
  assert.equal(await exportOffline(page), newerRaw);
});

test('entering new live creation preserves the newer offline state before a draft-page reload', { timeout: 45000 }, async t => {
  const f = await fixture(t), { page, originalRaw } = f;
  const newerRaw = await leaveUnsavedProgress(f);
  await page.locator('[data-home]').click();
  await page.locator('[data-title-new]').click();
  await page.locator('[data-confirm]').click();
  await page.locator('#live-name').waitFor();
  const retained = await retainedOffline(page, newerRaw);
  assert.ok(retained, 'opening a live creation draft must first retain newer offline progress');
  assert.equal(retained.originalRaw, originalRaw);
  await page.locator('#live-name').fill('新旅人');
  await page.reload();
  assert.equal(await page.locator('#live-name').inputValue(), '新旅人');
  assert.deepEqual(await retainedOffline(page, newerRaw), retained);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), originalRaw);
});

test('offline import refuses to discard newer in-memory progress alongside a malformed legacy handoff', { timeout: 45000 }, async t => {
  const legacyBackupRaw = '{malformed legacy handoff';
  const f = await fixture(t, { legacyBackupRaw }), { page, originalRaw } = f;
  const newerRaw = await leaveUnsavedProgress(f);
  await page.evaluate(() => restoreRecoveryWrites());
  const replacementRaw = serializeGame(createCultivation({ seed: 'valid-offline-import' }));
  await page.locator('[data-view="settings"]').click();
  const choosing = page.waitForEvent('filechooser');
  await page.locator('[data-import]').click();
  await (await choosing).setFiles({ name: 'another-life.json', mimeType: 'application/json', buffer: Buffer.from(replacementRaw) });
  await page.locator('[data-confirm]').click();
  await page.locator('#dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), originalRaw, 'import must not replace the active life when its newer progress cannot be preserved');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), LEGACY_BACKUP_KEY), legacyBackupRaw);
  assert.match(await page.locator('#toast').innerText(), /未保存的进度[\s\S]*导出/);
  assert.match(await page.locator('#toast').getAttribute('class'), /error/);
  await page.locator('[data-menu-back]').click();
  assert.equal(await exportOffline(page), newerRaw, 'the exact newer state must remain available for export after the blocked import');
});

test('a corrupt offline journey catalog cannot hide or block healthy live journeys', { timeout: 45000 }, async t => {
  const corruptLibrary = '{broken offline catalog';
  const { page, records } = await fixture(t, { offline: false, corruptLibrary });
  await page.locator('[data-saves]').click();
  await page.locator('.saved-journeys [role="status"]').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('[data-select-live]').count(), 2, 'both committed live journeys stay visible despite the unrelated offline error');
  for (const record of records) assert.equal(await page.locator(`[data-select-live="${record.archiveId}"]`).isVisible(), true);
  assert.equal(await page.locator('.saved-journeys [role="alert"]').isVisible(), true);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), JOURNEY_SAVES_KEY), corruptLibrary);
  await page.locator(`[data-select-live="${records[0].archiveId}"]:enabled`).click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();
  assert.deepEqual((await currentLive(page)).state, records[0].state);
  assert.match(await page.locator('#app').innerText(), /林映/);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), JOURNEY_SAVES_KEY), corruptLibrary);
});
