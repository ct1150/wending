import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build } from '../scripts/build.js';
import { createDevServer } from '../scripts/dev.js';

test('the visible title version follows package metadata in development, static and offline releases', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'wending-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const item of ['src', 'assets', 'index.html', 'package.json']) await cp(path.resolve(item), path.join(root, item), { recursive: true });
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  pkg.version = '9.8.7';
  await writeFile(path.join(root, 'package.json'), JSON.stringify(pkg));
  const metadata = await build(root);
  const browser = await chromium.launch({ headless: true, ...(process.env.WENDING_BROWSER_EXECUTABLE ? { executablePath: process.env.WENDING_BROWSER_EXECUTABLE } : {}) });
  t.after(() => browser.close());
  const errors = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const directory of [root, path.join(root, 'dist')]) {
    const server = await createDevServer(directory);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.locator('.title-footer').waitFor();
      assert.equal(await page.locator('.title-footer span').last().textContent(), `v${metadata.version}`, directory);
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
  await context.setOffline(true);
  await page.goto(pathToFileURL(path.join(root, 'release', 'baishi-wending-offline.html')).href);
  await page.locator('.title-footer').waitFor();
  assert.equal(await page.locator('.title-footer span').last().textContent(), `v${metadata.version}`, 'offline release without network');
  assert.deepEqual(errors, []);
});
