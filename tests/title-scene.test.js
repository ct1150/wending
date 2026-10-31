import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';

const sceneModule = await import('../src/ui/title-scene.js').catch(() => null);

test('title scene is harmless without browser APIs or a root', () => {
  assert.equal(typeof sceneModule?.mountTitleScene, 'function');
  for (const root of [undefined, null, {}, {querySelector() { throw Error('not a browser'); }}]) {
    const dispose = sceneModule.mountTitleScene(root);
    assert.equal(typeof dispose, 'function');
    assert.doesNotThrow(() => { dispose(); dispose(); });
  }
});

async function scene(t, {graphics = 'canvas', reduced = false, preference = null, denyStorage = false} = {}) {
  const {page, origin} = await liveBrowser(t);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
  await page.route(origin + '/__title-scene-test', route => route.fulfill({contentType:'text/html', body:`<!doctype html><html><body style="margin:0"><div id="scene" style="position:relative;width:100vw;height:100vh"><canvas data-title-fog style="position:absolute;width:100%;height:100%;pointer-events:none"></canvas><canvas data-title-particles style="position:absolute;width:100%;height:100%;pointer-events:none"></canvas><button data-title-motion><span data-motion-label></span></button><button data-title-sound><span data-sound-label></span></button><button data-title-new onclick="this.dataset.clicked='true'">踏入仙途</button></div></body></html>`}));
  await page.goto(origin + '/__title-scene-test');
  await page.evaluate(async ({graphics, preference, denyStorage}) => {
    if (preference !== null) localStorage.setItem('wending-title-motion-v1', preference);
    if (denyStorage) Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('denied', 'SecurityError'); }});
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...options) {
      if (graphics === 'static') throw new DOMException('denied', 'SecurityError');
      if (graphics === 'canvas' && type !== '2d') return null;
      return getContext.call(this, type, ...options);
    };
    // Replace only the clock boundary: DOM, media queries and graphics stay real.
    window.sceneFrames = new Map();
    let nextFrame = 0;
    window.requestAnimationFrame = callback => { const id = ++nextFrame; sceneFrames.set(id, callback); return id; };
    window.cancelAnimationFrame = id => sceneFrames.delete(id);
    window.advanceScene = (...times) => { for (const time of times) { const callbacks = [...sceneFrames.values()]; sceneFrames.clear(); callbacks.forEach(callback => callback(time)); } };
    window.sceneDraws = 0;
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function(...args) { sceneDraws++; return clearRect.apply(this, args); };
    window.sceneHidden = false;
    Object.defineProperty(document, 'hidden', {get: () => sceneHidden, configurable:true});
    window.sceneAudio = [];
    if (window.AudioContext) {
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext { constructor(...args) { super(...args); sceneAudio.push(this); } };
    }
    window.sceneRoot = document.querySelector('#scene');
    window.sceneModule = await import('/src/ui/title-scene.js');
    window.disposeScene = sceneModule.mountTitleScene(sceneRoot);
  }, {graphics, preference, denyStorage});
  return {page, state: () => page.evaluate(() => ({
    motion:sceneRoot.dataset.motion, running:sceneRoot.dataset.sceneRunning, renderer:sceneRoot.dataset.sceneRenderer,
    pending:sceneFrames.size, draws:sceneDraws, pressed:sceneRoot.querySelector('[data-title-motion]').getAttribute('aria-pressed'),
    x:sceneRoot.style.getPropertyValue('--scene-x'), y:sceneRoot.style.getPropertyValue('--scene-y'),
  }))};
}

test('motion pause stops drawing, persists the choice and resets parallax', async t => {
  const {page, state} = await scene(t);
  assert.deepEqual(await state(), {motion:'on', running:'true', renderer:'canvas', pending:1, draws:1, pressed:'true', x:'0px', y:'0px'});
  await page.evaluate(() => {
    sceneRoot.dispatchEvent(new PointerEvent('pointermove', {clientX:innerWidth, clientY:innerHeight, pointerType:'mouse'}));
    advanceScene(0, 40, 80, 120);
  });
  const moving = await state();
  assert.ok(moving.draws > 1);
  assert.ok(parseFloat(moving.x) > 0 && parseFloat(moving.x) <= 12);
  assert.ok(parseFloat(moving.y) > 0 && parseFloat(moving.y) <= 12);
  await page.locator('[data-title-motion]').click();
  const paused = await state();
  assert.equal(paused.motion, 'off');
  assert.equal(paused.running, 'false');
  assert.equal(paused.pending, 0);
  assert.equal(paused.pressed, 'false');
  assert.equal(paused.x, '0px');
  assert.equal(paused.y, '0px');
  await page.evaluate(() => advanceScene(200, 400));
  assert.equal((await state()).draws, paused.draws);
  assert.equal(await page.evaluate(() => localStorage.getItem('wending-title-motion-v1')), 'off');
  await page.locator('[data-title-motion]').click();
  assert.equal((await state()).pending, 1);
});

test('reduced motion overrides a stored preference and later system changes stop an explicit opt-in', async t => {
  const {page, state} = await scene(t, {reduced:true, preference:'on'});
  assert.equal((await state()).motion, 'off');
  assert.equal((await state()).pending, 0);
  await page.locator('[data-title-motion]').click();
  assert.equal((await state()).motion, 'on');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(() => sceneRoot.dataset.motion === 'off', null, {polling:20});
  assert.equal((await state()).pending, 0);
});

test('background tabs suspend rendering and resume one loop on return', async t => {
  const {page, state} = await scene(t);
  await page.evaluate(() => { sceneHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = await state();
  assert.equal(hidden.running, 'false');
  assert.equal(hidden.pending, 0);
  await page.evaluate(() => { advanceScene(100, 200); sceneHidden = false; document.dispatchEvent(new Event('visibilitychange')); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal((await state()).draws, hidden.draws);
  assert.equal((await state()).running, 'true');
  assert.equal((await state()).pending, 1);
});

test('high refresh screens cap painting and steady frames do not rewrite the menu', async t => {
  const {page} = await scene(t);
  const result = await page.evaluate(async () => {
    let mutations = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(sceneRoot, {subtree:true, attributes:true, childList:true, characterData:true});
    const before = sceneDraws;
    advanceScene(...Array.from({length:121}, (_, index) => index * 1000 / 120));
    await Promise.resolve();
    observer.disconnect();
    return {draws:sceneDraws - before, mutations};
  });
  assert.ok(result.draws >= 25 && result.draws <= 32, `one second at 120 Hz produced ${result.draws} paints`);
  assert.equal(result.mutations, 0, 'stationary animation should not keep mutating menu or accessibility attributes');
});

test('disposal releases the scene and repeated mounting never leaves an orphan frame', async t => {
  const {page, state} = await scene(t);
  await page.evaluate(() => { disposeScene(); disposeScene(); });
  assert.equal((await state()).pending, 0);
  assert.equal((await state()).running, 'false');
  await page.locator('[data-title-motion]').click();
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('resize')); });
  assert.equal((await state()).pending, 0);
  await page.evaluate(() => { disposeScene = sceneModule.mountTitleScene(sceneRoot); disposeScene = sceneModule.mountTitleScene(sceneRoot); });
  assert.equal((await state()).pending, 1);
  await page.evaluate(() => { sceneRoot.remove(); advanceScene(100); });
  assert.equal((await state()).pending, 0);
  assert.equal((await state()).running, 'false');
});

test('unavailable graphics and denied storage preserve a working static menu', async t => {
  const {page, state} = await scene(t, {graphics:'static', denyStorage:true});
  assert.equal((await state()).renderer, 'static');
  assert.equal((await state()).running, 'false');
  assert.equal((await state()).motion, 'off');
  assert.equal((await state()).pending, 0);
  await page.locator('[data-title-new]').click();
  assert.equal(await page.locator('[data-title-new]').getAttribute('data-clicked'), 'true');
});

test('WebGL context loss falls back to particles and large screens respect the fog pixel budget', async t => {
  const {page, state} = await scene(t, {graphics:'webgl'});
  assert.equal((await state()).renderer, 'webgl');
  await page.setViewportSize({width:3840, height:2160});
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const pixels = await page.locator('[data-title-fog]').evaluate(canvas => canvas.width * canvas.height);
  assert.ok(pixels > 1 && pixels <= 1_000_000);
  await page.evaluate(() => sceneRoot.querySelector('[data-title-fog]').getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(() => sceneRoot.dataset.sceneRenderer === 'canvas', null, {polling:20});
  assert.equal((await state()).pending, 1);
  await page.evaluate(() => { advanceScene(100); disposeScene(); });
  assert.equal((await state()).pending, 0);
});

test('unmount promptly releases the removed canvas WebGL context', async t => {
  const {page} = await scene(t, {graphics:'webgl'});
  const released = await page.evaluate(async () => {
    const graphics = sceneRoot.querySelector('[data-title-fog]').getContext('webgl');
    sceneRoot.remove();
    disposeScene();
    await Promise.resolve();
    return graphics.isContextLost();
  });
  assert.equal(released, true, 'removed home canvases must not accumulate live graphics contexts');
});

test('ambient sound needs a click, suspends in the background and closes on disposal', async t => {
  const {page} = await scene(t);
  assert.equal(await page.evaluate(() => sceneAudio.length), 0);
  assert.equal(await page.locator('[data-title-sound]').getAttribute('aria-pressed'), 'false');
  await page.locator('[data-title-sound]').click();
  await page.waitForFunction(() => sceneAudio.length === 1 && sceneAudio[0].state === 'running', null, {polling:20});
  assert.equal(await page.locator('[data-title-sound]').getAttribute('aria-pressed'), 'true');
  await page.evaluate(() => { sceneHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => sceneAudio[0].state === 'suspended', null, {polling:20});
  assert.equal(await page.locator('[data-title-sound]').getAttribute('aria-pressed'), 'false');
  await page.evaluate(() => { sceneHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => sceneAudio[0].state === 'running', null, {polling:20});
  await page.evaluate(() => { disposeScene(); disposeScene(); });
  await page.waitForFunction(() => sceneAudio[0].state === 'closed', null, {polling:20});
});
