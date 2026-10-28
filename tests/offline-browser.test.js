import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { bundleModules } from '../scripts/build.js';
import { createCultivation, chooseCultivation } from '../src/game/cultivation/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { SAVE_KEY } from '../src/game/persistence.js';
import { JOURNEY_SAVES_KEY } from '../src/game/journey-saves.js';

test('an old offline tab cannot autosave over a newly committed journey in another tab', { timeout: 45000 }, async t => {
  const root = resolve('.'), directory = await mkdtemp(join(tmpdir(), 'wending-offline-tabs-'));
  let context;
  t.after(async () => {
    if (context) await context.close();
    await rm(directory, { recursive: true, force: true });
  });

  const [template, bundle] = await Promise.all([
    readFile(join(root, 'index.html'), 'utf8'),
    bundleModules(root, './src/app.js'),
  ]);
  const html = template
    .replace(/href="\.\/([^"]+)"/g, (_, relative) => `href="${pathToFileURL(resolve(root, relative)).href}"`)
    .replace('<script type="module" src="./src/app.js"></script>', () => `<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>`);
  const file = join(directory, 'offline.html');
  await writeFile(file, html);

  context = await chromium.launchPersistentContext(join(directory, 'profile'), {
    headless: true,
    ...(process.env.WENDING_BROWSER_EXECUTABLE ? { executablePath: process.env.WENDING_BROWSER_EXECUTABLE } : {}),
  });
  const requests = [], errors = [];
  await context.route(/^https?:\/\//, async route => {
    requests.push(route.request().url());
    await route.abort();
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));

  const creation = createCultivation({ seed: 'offline-two-tabs', name: '林照', characterCreation: true, contentVersion: 3 });
  const born = chooseCultivation(creation, { revision: creation.revision, sceneId: creation.scene.nodeId, choiceId: 'birth-start' });
  assert.equal(born.kind, 'applied');
  const originalRaw = serializeGame(born.state);
  await context.addInitScript(({ key, raw }) => {
    if (location.protocol === 'file:' && localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  }, { key: SAVE_KEY, raw: originalRaw });

  const first = await context.newPage(), url = pathToFileURL(file).href;
  await first.goto(url);
  await first.locator('[data-title-continue]:enabled').click();
  await first.locator('[data-journey-choice]:enabled').first().waitFor();
  assert.equal(await first.evaluate(key => localStorage.getItem(key), SAVE_KEY), originalRaw);

  const second = await context.newPage();
  await second.goto(url);
  await second.locator('[data-title-new]:enabled').click();
  await second.locator('[data-confirm]').click();
  await second.locator('#birth-name').fill('沈渡');
  await second.locator('[data-birth-start]').click();
  await second.locator('[data-journey-choice]:enabled').first().waitFor();
  const replacementRaw = await second.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  assert.equal(deserializeGame(replacementRaw).life.name, '沈渡');
  assert.equal(deserializeGame(replacementRaw).phase, 'playing');
  assert.notEqual(replacementRaw, originalRaw);
  assert.equal(await first.evaluate(key => localStorage.getItem(key), SAVE_KEY), replacementRaw, 'both file tabs must share the actual active save');

  await first.locator('[data-journey-choice]:enabled').first().click();
  assert.equal(await second.evaluate(key => localStorage.getItem(key), SAVE_KEY), replacementRaw, 'a stale tab must not overwrite the newly active journey');
  const preserved = await second.evaluate(key => JSON.parse(localStorage.getItem(key)).entries, JOURNEY_SAVES_KEY);
  assert.ok(preserved.some(entry => entry.raw === originalRaw && entry.originalRaw === originalRaw), 'the original alive journey remains available in the saved journeys');
  const warning = first.locator('[role="alert"]');
  await warning.waitFor();
  assert.match(await warning.innerText(), /另一页面|其他页面|刷新/);
  assert.equal(await warning.locator('[data-export]').isVisible(), true, 'the conflicting tab offers export of its in-memory progress');

  await first.reload();
  await first.locator('[data-journey-choice]:enabled').first().waitFor();
  assert.match(await first.locator('#app').innerText(), /沈渡/);
  assert.equal(await first.evaluate(key => localStorage.getItem(key), SAVE_KEY), replacementRaw);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, [], 'the offline scenario must not request a backend or other network resource');
});
