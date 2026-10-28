import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { readStoryJson } from '../src/worker/story-request-body.js';

const encoder = new TextEncoder();
function request(body, { headers = {}, signal } = {}) {
  return new Request('https://game.example/api/story/turn', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body, signal, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  });
}
async function bounded(promise, timeoutMs = 300) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Body read did not settle within the test bound')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
function openBody(t, cancel = () => {}) {
  let controller;
  const body = new ReadableStream({ start(value) { controller = value; }, cancel });
  t.after(() => { try { controller.close(); } catch {} });
  return { body, controller };
}

test('a stalled body reaches its deadline without waiting for hanging cancellation', async t => {
  let canceled = 0;
  const { body } = openBody(t, () => { canceled++; return new Promise(() => {}); });
  const input = request(body);
  await assert.rejects(bounded(readStoryJson(input, { timeoutMs: 15 })), { code: 'REQUEST_TIMEOUT', httpStatus: 408 });
  assert.equal(canceled, 1);
  assert.equal(input.body.locked, false);
  assert.equal(getEventListeners(input.signal, 'abort').length, 0);
});

test('incoming chunks cannot restart the absolute request deadline', async t => {
  let timer, canceled = 0;
  const { body, controller } = openBody(t, () => { canceled++; clearInterval(timer); });
  controller.enqueue(encoder.encode('{"text":"'));
  timer = setInterval(() => controller.enqueue(encoder.encode('x')), 5);
  t.after(() => clearInterval(timer));
  const input = request(body);
  await assert.rejects(bounded(readStoryJson(input, { timeoutMs: 30 })), { code: 'REQUEST_TIMEOUT', httpStatus: 408 });
  assert.equal(canceled, 1);
  assert.equal(input.body.locked, false);
});

test('already aborted bodies are canceled without exposing the private reason', async t => {
  let canceled = 0;
  const { body } = openBody(t, () => { canceled++; return new Promise(() => {}); });
  const controller = new AbortController();
  controller.abort(new Error('private cancellation detail'));
  const input = request(body, { signal: controller.signal });
  await assert.rejects(bounded(readStoryJson(input)), error => {
    assert.equal(error.code, 'REQUEST_ABORTED');assert.equal(error.httpStatus, 400);
    assert.equal(error.message, 'REQUEST_ABORTED');return true;
  });
  assert.equal(canceled, 1);
  assert.equal(input.body.locked, false);
});

test('abort during a pending read cancels the body and removes the listener', async t => {
  let canceled = 0;
  const { body, controller: stream } = openBody(t, () => { canceled++; return new Promise(() => {}); });
  stream.enqueue(encoder.encode('{"text":'));
  const controller = new AbortController(), input = request(body, { signal: controller.signal });
  const reading = readStoryJson(input, { timeoutMs: 200 });
  const checked = assert.rejects(bounded(reading), { code: 'REQUEST_ABORTED', httpStatus: 400 });
  const timer = setTimeout(() => controller.abort('private reason'), 5);
  t.after(() => clearTimeout(timer));
  await checked;
  assert.equal(canceled, 1);
  assert.equal(input.body.locked, false);
  assert.equal(getEventListeners(input.signal, 'abort').length, 0);
});

test('streaming byte overrun rejects even if cancel never resolves', async () => {
  let canceled = 0;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(32769)); },
    cancel() { canceled++; return new Promise(() => {}); },
  });
  const input = request(body);
  await assert.rejects(bounded(readStoryJson(input)), { code: 'REQUEST_TOO_LARGE', httpStatus: 413 });
  assert.equal(canceled, 1);
  assert.equal(input.body.locked, false);
});

test('the exact 32768-byte limit accepts multibyte JSON but one more byte rejects', async () => {
  const text = '界'.repeat(10919), json = '{"text":"' + text + '"}';
  assert.equal(encoder.encode(json).byteLength, 32768);
  assert.deepEqual(await readStoryJson(request(json)), { text });
  await assert.rejects(readStoryJson(request(json + ' ')), { code: 'REQUEST_TOO_LARGE', httpStatus: 413 });
});

test('a completed body before the deadline preserves split UTF-8 and releases resources', async t => {
  let canceled = 0;
  const { body, controller } = openBody(t, () => { canceled++; });
  const bytes = encoder.encode('{"text":"山"}');
  controller.enqueue(bytes.slice(0, 10));
  const input = request(body), existingListener = () => {};
  input.signal.addEventListener('abort', existingListener);
  t.after(() => input.signal.removeEventListener('abort', existingListener));
  const reading = readStoryJson(input, { timeoutMs: 100 });
  const timer = setTimeout(() => { controller.enqueue(bytes.slice(10)); controller.close(); }, 5);
  t.after(() => clearTimeout(timer));
  assert.deepEqual(await bounded(reading), { text: '山' });
  assert.equal(canceled, 0);
  assert.equal(input.body.locked, false);
  assert.deepEqual(getEventListeners(input.signal, 'abort'), [existingListener]);
});

test('invalid encoding, JSON and unsafe plain-data keys have one bounded error', async t => {
  for (const body of [new Uint8Array([0x22, 0xc3, 0x28, 0x22]), '{"secret":', '{"__proto__":{"secret":true}}']) {
    await t.test(typeof body === 'string' ? body.slice(0, 12) : 'invalid UTF-8', async () => {
      await assert.rejects(readStoryJson(request(body)), { code: 'REQUEST_INVALID', httpStatus: 400, message: 'REQUEST_INVALID' });
    });
  }
});

test('body stream failures cannot expose arbitrary transport details', async () => {
  const body = new ReadableStream({ start(controller) { controller.error(new Error('private stream failure')); } });
  const input = request(body);
  await assert.rejects(readStoryJson(input), { code: 'REQUEST_INVALID', httpStatus: 400, message: 'REQUEST_INVALID' });
  assert.equal(input.body.locked, false);
  assert.equal(getEventListeners(input.signal, 'abort').length, 0);
});

test('content type, content encoding and declared size remain strict', async t => {
  const cases = [
    [{ 'content-type': 'text/plain' }, 'CONTENT_TYPE_INVALID', 415],
    [{ 'content-type': 'application/json; charset=latin1' }, 'CONTENT_TYPE_INVALID', 415],
    [{ 'content-encoding': 'gzip' }, 'CONTENT_TYPE_INVALID', 415],
    [{ 'content-length': '32769' }, 'REQUEST_TOO_LARGE', 413],
    [{ 'content-length': '-1' }, 'REQUEST_TOO_LARGE', 413],
  ];
  for (const [headers, code, httpStatus] of cases) await t.test(JSON.stringify(headers), async () => {
    await assert.rejects(readStoryJson(request('{}', { headers })), { code, httpStatus });
  });
  assert.deepEqual(await readStoryJson(request('{}', { headers: { 'content-type': 'application/json; charset=UTF-8' } })), {});
  await assert.rejects(readStoryJson(request(null)), { code: 'REQUEST_INVALID', httpStatus: 400 });
});

test('trusted timeout options cannot disable or extend the maximum deadline', async t => {
  for (const timeoutMs of [0, -1, Infinity, NaN, 10001, '15']) await t.test(String(timeoutMs), async () => {
    await assert.rejects(readStoryJson(request('{}'), { timeoutMs }), { code: 'REQUEST_INVALID', httpStatus: 400 });
  });
});
