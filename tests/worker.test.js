import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { buildWorker } from '../scripts/build-worker.js';

const sourceCommit = '6698dbbca4b452466ad461070250c6ea7deeb87c';

test('Worker packaging preserves HTML exactly and importing it has no I/O side effects', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'baishi-worker-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'release')); await mkdir(path.join(root, 'assets'));
  const html = '<!doctype html>\r\n<title>百世问鼎</title><script>const text = `寿元 ${16}`; const end = "</script>";</script>\n';
  const icon = '<svg xmlns="http://www.w3.org/2000/svg"><title>问鼎</title></svg>\n';
  await writeFile(path.join(root, 'release/baishi-wending-web.html'), html);
  await writeFile(path.join(root, 'assets/seal.svg'), icon);
  const result = await buildWorker({ root, sourceCommit });
  assert.equal(result.htmlSha256, createHash('sha256').update(html).digest('hex'));
  const before = await readdir(path.join(root, 'release'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Import must not issue network requests'); };
  let worker;
  try { worker = (await import(pathToFileURL(result.file).href)).default; }
  finally { globalThis.fetch = originalFetch; }
  assert.equal(typeof worker.fetch, 'function');
  assert.deepEqual(await readdir(path.join(root, 'release')), before);
  assert.equal(await readFile(path.join(root, 'release/baishi-wending-web.html'), 'utf8'), html);

  const request = (url, method = 'GET') => worker.fetch(new Request('https://example.workers.dev' + url, { method }));
  for (const url of ['/', '/index.html', '/?seed=test']) {
    const response = await request(url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers.get('Content-Type'), /^text\/html/);
    assert.equal(await response.text(), html, url);
  }
  const retired = await request('/baishi-wending-offline.html'); assert.equal(retired.status, 410);
  assert.equal(retired.headers.get('Content-Disposition'), null); assert.match(retired.headers.get('Content-Type'), /^text\/plain/); assert.doesNotMatch(await retired.text(), /<!doctype|<script/i);
  for (const url of ['/favicon.svg', '/favicon.ico']) {
    const response = await request(url); assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type'), /^image\/svg\+xml/); assert.equal(await response.text(), icon);
  }
  const health = await request('/healthz'); assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', sourceCommit, htmlSha256: result.htmlSha256 });
  for (const url of ['/', '/index.html', '/baishi-wending-offline.html', '/favicon.svg', '/favicon.ico', '/healthz', '/missing']) {
    const response = await request(url, 'HEAD');
    assert.equal(response.status, url === '/missing' ? 404 : url === '/baishi-wending-offline.html' ? 410 : 200); assert.equal(response.body, null); assert.equal(await response.text(), '');
  }
  assert.equal((await request('/missing')).status, 404);
  const post = await request('/', 'POST'); assert.equal(post.status, 405); assert.equal(post.headers.get('Allow'), 'GET, HEAD');
});

test('Worker packaging rejects missing or invalid source commit without exposing its value', async () => {
  for (const value of [null, '', 'main', 'sensitive-token-value']) {
    await assert.rejects(buildWorker({ sourceCommit: value }), error => error.message === 'SOURCE_COMMIT must be a full 40-character Git commit SHA');
  }
});
