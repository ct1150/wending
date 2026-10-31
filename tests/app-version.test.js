import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { build } from '../scripts/build.js';
import { createDevServer } from '../scripts/dev.js';

test('the web app boots with the package version in development, static and bundled releases', async t => {
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
  for (const [directory, entry] of [[root, '/'], [path.join(root, 'dist'), '/'], [path.join(root, 'release'), '/baishi-wending-web.html']]) {
    const server = await createDevServer(directory);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    try {
      const response = await page.goto(`http://127.0.0.1:${server.address().port}${entry}`);
      assert.equal(response.status(), 200);
      await page.locator('.title-footer').waitFor();
      assert.equal(await page.locator('.title-footer span').last().textContent(), `v${metadata.version}`, directory);
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
  assert.deepEqual(errors, []);
});
