import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build, bundleModules, parseModule } from '../scripts/build.js';
import { createRequestHandler } from '../scripts/dev.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'baishi-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src')); await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'package.json'), '{"name":"fixture","version":"1.0.0","type":"module"}');
  return root;
}

test('offline build preserves isolated module scopes and inlines styles and SVG assets', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'index.html'), '<!doctype html><link rel="stylesheet" href="./src/styles.css"><link rel="icon" href="./assets/mark.svg"><img src="./assets/mark.svg"><script type="module" src="./src/app.js"></script>');
  await writeFile(path.join(root, 'assets/mark.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
  await writeFile(path.join(root, 'src/styles.css'), 'body{background:url("../assets/mark.svg")}');
  await writeFile(path.join(root, 'src/a.js'), 'const privateValue = 20; export const a = privateValue, label = "export default import";');
  await writeFile(path.join(root, 'src/b.js'), 'const privateValue = 22; function read() { return privateValue; } export { read as b };');
  await writeFile(path.join(root, 'src/app.js'), 'import { a as first, label } from "./a.js"; import { b } from "./b.js"; globalThis.answer = first + b(); globalThis.label = label; globalThis.image = "./assets/mark.svg";');
  const meta = await build(root);
  const html = await readFile(path.join(root, 'release/baishi-wending-offline.html'), 'utf8');
  assert.equal(await readFile(path.join(root, 'dist/index.html'), 'utf8'), await readFile(path.join(root, 'index.html'), 'utf8'));
  assert.equal(await readFile(path.join(root, 'dist/baishi-wending-offline.html'), 'utf8'), html);
  assert.match(html, /<style>/); assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(html, /(?:href|src)="\.\//); assert.doesNotMatch(html, /type="module"/);
  const context = {}; vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  assert.equal(context.answer, 42); assert.equal(context.label, 'export default import');
  assert.match(context.image, /^data:image\/svg\+xml;base64,/);
  assert.equal(meta.offline.bytes, Buffer.byteLength(html)); assert.match(meta.offline.sha256, /^[0-9a-f]{64}$/);
  assert.equal(JSON.parse(await readFile(path.join(root, 'release/release.json'), 'utf8')).version, '1.0.0');
});

test('unsupported module syntax fails explicitly', () => {
  for (const code of ['export default 1;', 'export * from "./a.js";', 'import value from "./a.js";', 'import * as x from "./a.js";', 'import "./a.js";', 'const x = import("./a.js");', 'const x = `${import("./a.js")}`;', 'const url = import.meta.url;', 'export let changing = 1;', 'let changing = 1; export { changing };', 'export const { a } = { a: 1 };', 'await Promise.resolve();']) {
    assert.throws(() => parseModule(code), /unsupported|only|top-level/i, code);
  }
});

test('module declarations survive prose, regular expressions, and nested template literals', () => {
  const source = 'const template = `outer ${[1].map(x => `inner ${x}`).join("")} export default`; const re = /export\\s+default/; export function read() { return template; }';
  const parsed = parseModule(source);
  assert.deepEqual(parsed.exports, [{ name: 'read', local: 'read' }]);
  assert.match(parsed.code, /outer/); assert.doesNotMatch(parsed.code, /export function/);
});

test('bundler rejects dependency cycles, missing named exports, and paths outside the project', async t => {
  const root = await fixture(t); const app = path.join(root, 'src/app.js');
  await writeFile(app, 'import { absent } from "./a.js";'); await writeFile(path.join(root, 'src/a.js'), 'export const present = 1;');
  await assert.rejects(bundleModules(root, './src/app.js'), /missing export absent/);
  await writeFile(app, 'import { a } from "./a.js"; export const b = 1;'); await writeFile(path.join(root, 'src/a.js'), 'import { b } from "./app.js"; export const a = 1;');
  await assert.rejects(bundleModules(root, './src/app.js'), /Circular imports/);
  await writeFile(app, 'import { a } from "../../outside.js";');
  const outside = path.join(root, '..', 'outside.js'); await writeFile(outside, 'export const a = 1;'); t.after(() => rm(outside, { force: true }));
  await assert.rejects(bundleModules(root, './src/app.js'), /escapes project/);
});

async function get(handler, url, method = 'GET') {
  const result = { headers: {}, body: '' };
  const response = { writeHead(status, headers = {}) { result.status = status; result.headers = headers; return this; }, end(body) { result.body = body?.toString() || ''; } };
  await handler({ url, method }, response);
  return result;
}

test('development server serves modules and refuses traversal, hidden files, symlink escape, and writes', async t => {
  const root = await fixture(t); await writeFile(path.join(root, 'index.html'), '<h1>ready</h1>'); await writeFile(path.join(root, 'src/app.js'), 'export const ready = true;');
  await writeFile(path.join(root, '.secret'), 'private'); await symlink('/etc/passwd', path.join(root, 'assets/outside.txt'));
  const handler = await createRequestHandler(root);
  assert.equal((await get(handler, '/')).body, '<h1>ready</h1>');
  assert.match((await get(handler, '/src/app.js')).headers['Content-Type'], /javascript/);
  for (const url of ['/%2e%2e/package.json', '/.secret', '/assets/outside.txt', '/%5c..%5csecret']) assert.equal((await get(handler, url)).status, 403, url);
  assert.equal((await get(handler, '/%XX')).status, 400); assert.equal((await get(handler, '/missing')).status, 404);
  assert.equal((await get(handler, '/', 'POST')).status, 405); assert.equal((await get(handler, '/', 'HEAD')).body, '');
});

test('development offline download falls back to dist without bypassing root files or path restrictions', async t => {
  const root = await fixture(t); const dist = path.join(root, 'dist');
  const filename = 'baishi-wending-offline.html';
  await mkdir(dist); await writeFile(path.join(dist, filename), '<h1>offline release</h1>');
  const handler = await createRequestHandler(root);
  const download = await get(handler, '/' + filename);
  assert.equal(download.status, 200); assert.equal(download.body, '<h1>offline release</h1>');
  assert.match(download.headers['Content-Type'], /text\/html/);
  const distHandler = await createRequestHandler(dist);
  assert.equal((await get(distHandler, '/' + filename)).body, download.body);
  await writeFile(path.join(root, filename), '<h1>root release</h1>');
  assert.equal((await get(handler, '/' + filename)).body, '<h1>root release</h1>');
  await rm(path.join(root, filename));
  for (const url of ['/%2e%2e/' + filename, '/.hidden/' + filename]) assert.equal((await get(handler, url)).status, 403);
  await rm(path.join(dist, filename)); await symlink('/etc/passwd', path.join(dist, filename));
  assert.equal((await get(handler, '/' + filename)).status, 403);
});

test('production app and journey renderer bundle through the offline named-module graph', async () => {
  const code = await bundleModules(process.cwd(), './src/app.js');
  assert.doesNotThrow(() => new vm.Script(code));
  const { startApp } = await import('./helpers/app-harness.js');
  const app = await startApp();
  assert.match(app.html, /data-birth-start/);
  app.clickRendered('[data-birth-start]');
  assert.match(app.html, /data-journey-choice/);
});

test('static outputs exclude server code and browser imports cannot reach worker modules',async t=>{
  const root=await fixture(t);
  await mkdir(path.join(root,'src/worker'));
  await writeFile(path.join(root,'index.html'),'<script type="module" src="./src/app.js"></script>');
  await writeFile(path.join(root,'src/app.js'),'globalThis.browserOnly = true;');
  await writeFile(path.join(root,'src/worker/private.js'),'export const operatorEvidence = "SERVER_ONLY_EVIDENCE";');
  await build(root);
  await assert.rejects(readFile(path.join(root,'dist/src/worker/private.js')),/ENOENT/);
  assert.doesNotMatch(await readFile(path.join(root,'release/baishi-wending-offline.html'),'utf8'),/SERVER_ONLY_EVIDENCE/);
  await writeFile(path.join(root,'src/app.js'),'import { operatorEvidence } from "./worker/private.js"; globalThis.leak = operatorEvidence;');
  await assert.rejects(build(root),/server|worker/i);
});
