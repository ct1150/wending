import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';
import { liveStoryFixture } from './helpers/live-story-fixture.js';

const appOrigin = 'https://wending-game-visual.test';
const readingKey = 'wending-reading-v1';

async function fixture(t, { reducedMotion = 'reduce', motion = null } = {}) {
  const { page, origin } = await liveBrowser(t);
  const errors = [], external = [], replies = new Map();
  let posts = 0;
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion });
  // Exercise the real native fallback without depending on the host GPU.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === '2d' ? getContext.call(this, type, ...args) : null;
    };
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== appOrigin) { external.push(url.href); return route.abort(); }
    const json = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname === '/__bootstrap') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    if (url.pathname === '/api/story/capabilities') return json({ protocolVersion: 1, available: true, status: 'ready', errorCode: null, storyActions: true, experienceVersion: 1, originStories: true, limits: { maxRequestBytes: 32768, maxResponseBytes: 65536, maxContextBytes: 7000, timeoutMs: 30000 } });
    if (url.pathname === '/api/story/session') return json({ protocolVersion: 1, status: 'ready', sessionRef: 'game-visual-session', expiresAt: Date.now() + 86400000 });
    if (url.pathname === '/api/story/turn') {
      posts++;
      const { context, attempt } = route.request().postDataJSON(), prefix = `${context.namespace}:t${context.identity.turnId}:`;
      const scene = liveStoryFixture({ id: prefix + 's:path', title: '松风过古道', location: '青山古道旁的临水旧亭', entities: [], blocks: [{ kind: 'narration', text: '你循着青石小径走进松影，远处的云海正在山峰之间缓缓散开。' }], choices: [
        { id: prefix + 'c:rest', label: '在临水旧亭里稍作歇息，听清远处传来的脚步声', intent: 'rest', targetId: 'self', stake: 'low', approach: 'recover' },
        { id: prefix + 'c:practice', label: '借着松间清风静心吐纳，继续这一日的修行', intent: 'practice', targetId: 'self', stake: 'low', approach: 'steady' },
      ], memoryDeltas: [] }, context);
      const result = { protocolVersion: 1, status: 'ready', errorCode: null, retry: null, requestId: context.identity.requestId, attemptId: attempt.id, sessionRef: attempt.sessionRef, scene };
      replies.set(attempt.id, result);
      return json(result);
    }
    if (url.pathname.startsWith('/api/story/turn/')) return json(replies.get(url.searchParams.get('attemptId')));
    return route.fulfill({ response: await page.request.get(origin + (url.pathname === '/' ? '/index.html' : url.pathname)) });
  });
  await page.goto(appOrigin + '/__bootstrap');
  if (motion !== null) await page.evaluate(value => localStorage.setItem('wending-title-motion-v1', value), motion);
  await page.goto(appOrigin + '/');
  await page.locator('[data-title-new]:enabled').waitFor();
  t.after(() => { assert.deepEqual(errors, []); assert.deepEqual(external, [], 'the browser fixture must not access external services'); });
  return { page, get posts() { return posts; } };
}

async function enterBirth(page) {
  await page.locator('[data-title-new]:enabled').click();
  await page.locator('#live-name').waitFor();
}

async function enterStory(page) {
  await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();
}

async function rememberScene(page) {
  assert.equal(await page.locator('#game-scene [data-title-fog]').count(), 1, 'entering the game mounts one shared fog canvas');
  assert.equal(await page.locator('#game-scene .title-world').isVisible(), true, 'the game landscape is visible behind the reading surfaces');
  await page.evaluate(() => {
    window.originalGameFog = document.querySelector('#game-scene [data-title-fog]');
    window.originalGameScene = originalGameFog.closest('[data-motion]');
  });
}

async function assertSameScene(page) {
  assert.equal(await page.evaluate(() => originalGameFog.isConnected && document.querySelector('#game-scene [data-title-fog]') === originalGameFog && originalGameFog.closest('[data-motion]') === originalGameScene), true, 'navigation and story redraws must retain the mounted scene and canvas');
}

async function sceneState(page) {
  return page.locator('#game-scene [data-title-fog]').evaluate(canvas => {
    const root = canvas.closest('[data-motion]');
    return { motion: root.dataset.motion, running: root.dataset.sceneRunning, pressed: root.querySelector('[data-title-motion]').getAttribute('aria-pressed') };
  });
}

async function assertFits(page, label) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth, drawer: document.querySelector('#dialog[open] .dialog-body') ? { client: document.querySelector('#dialog .dialog-body').clientWidth, scroll: document.querySelector('#dialog .dialog-body').scrollWidth } : null }));
  assert.ok(dimensions.page <= dimensions.width, `${label}: page overflows ${dimensions.page}px into a ${dimensions.width}px viewport`);
  if (dimensions.drawer) assert.ok(dimensions.drawer.scroll <= dimensions.drawer.client + 1, `${label}: drawer text must wrap within its scrollable body`);
}

// Sample the rendered background after hiding only this element's text. This
// includes artwork, gradients and translucent panels, unlike a CSS color check.
async function assertReadable(page, selector, label) {
  const element = page.locator(selector).first();
  // Geometry-only visibility does not account for the persistent masthead.
  // Center the reading sample below the masthead before checking contrast.
  await element.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  const foreground = await element.evaluate(node => {
    node.setAttribute('data-contrast-sample', '');
    const color = getComputedStyle(node).color;
    let opacity = 1;
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
    return { color, opacity };
  });
  let png;
  try {
    png = await page.screenshot({ animations: 'disabled', caret: 'hide', style: '[data-contrast-sample], [data-contrast-sample] * { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }' });
  } finally { await element.evaluate(node => node.removeAttribute('data-contrast-sample')); }
  const ratio = await element.evaluate(async (node, { png, foreground }) => {
    const picture = new Image(); picture.src = 'data:image/png;base64,' + png; await picture.decode();
    const canvas = document.createElement('canvas'); canvas.width = picture.width; canvas.height = picture.height;
    const context = canvas.getContext('2d'); context.drawImage(picture, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const color = foreground.color.match(/[\d.]+/g).map(Number), alpha = (color[3] ?? 1) * foreground.opacity;
    const luminance = values => values.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    let minimum = Infinity;
    const rect = node.getBoundingClientRect(), scaleX = canvas.width / innerWidth, scaleY = canvas.height / innerHeight;
    // Sample only the visible text area: fixed/sticky headers can overlap an
    // element screenshot after scrolling, and are not this text's background.
    const left = Math.ceil(Math.max(0, rect.left + Math.min(8, rect.width / 4))), right = Math.min(innerWidth, Math.max(left + 1, rect.right - 28));
    const top = Math.ceil(Math.max(0, rect.top + Math.min(4, rect.height / 4))), bottom = Math.min(innerHeight, Math.max(top + 1, rect.bottom - 4));
    for (let y = top; y < bottom; y += 8) for (let x = left; x < right; x += 8) {
      if (!node.contains(document.elementFromPoint(x, y))) continue;
      const offset = (Math.floor(y * scaleY) * canvas.width + Math.floor(x * scaleX)) * 4, background = Array.from(pixels.slice(offset, offset + 3));
      const back = luminance(background), front = luminance(background.map((value, i) => color[i] * alpha + value * (1 - alpha)));
      minimum = Math.min(minimum, (Math.max(front, back) + .05) / (Math.min(front, back) + .05));
    }
    return minimum;
  }, { png: png.toString('base64'), foreground });
  assert.ok(Number.isFinite(ratio) && ratio >= 4.5, `${label}: text contrast ${ratio.toFixed(2)}:1 must be at least 4.5:1 on its rendered background`);
}

test('game scenery persists through character creation, settings and story redraws', async t => {
  const f = await fixture(t), { page } = f;
  await enterBirth(page);
  await rememberScene(page);
  assert.equal(f.posts, 0, 'entering the creation screen does not request a story');
  await enterStory(page);
  await assertSameScene(page);
  await page.locator('[data-view="settings"]').click();
  await page.locator('#reading-theme').waitFor();
  await assertSameScene(page);
  await page.locator('[data-menu-back]').click();
  await page.locator('[data-live-choice]:enabled').first().waitFor();
  await assertSameScene(page);
  assert.equal(f.posts, 1, 'settings navigation must not advance the story');
  await page.locator('[data-live-choice]:enabled').first().click();
  await page.locator('[data-live-choice][data-revision="2"]:enabled').first().waitFor();
  await assertSameScene(page);
});

test('a paused homepage stays paused in the game and returning home disposes its canvases', async t => {
  const { page } = await fixture(t, { reducedMotion: 'no-preference' });
  const homeMotion = page.locator('.title-shell [data-title-motion]');
  assert.equal(await homeMotion.getAttribute('aria-pressed'), 'true');
  await homeMotion.click();
  await enterBirth(page);
  await rememberScene(page);
  assert.deepEqual(await sceneState(page), { motion: 'off', running: 'false', pressed: 'false' });
  await page.locator('#game-scene [data-title-motion]').click();
  assert.deepEqual(await sceneState(page), { motion: 'on', running: 'true', pressed: 'true' });
  await page.locator('[data-menu-back]').click();
  await page.locator('.title-shell [data-title-new]').waitFor();
  assert.equal(await page.evaluate(() => !originalGameFog.isConnected && originalGameScene.dataset.sceneRunning === 'false'), true, 'the removed game canvas must be disposed immediately');
  assert.equal(await page.locator('#game-scene [data-title-fog]').count(), 0);
  assert.equal(await page.locator('.title-shell [data-title-motion]').getAttribute('aria-pressed'), 'true', 'the explicit game preference is shared with the homepage');
});

test('system reduced motion is respected on entry and when it changes inside the game', async t => {
  const { page } = await fixture(t, { motion: 'on' });
  await enterBirth(page);
  await rememberScene(page);
  assert.deepEqual(await sceneState(page), { motion: 'off', running: 'false', pressed: 'false' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('#game-scene [data-title-fog]').closest('[data-motion]').dataset.motion === 'on');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#game-scene [data-title-fog]').closest('[data-motion]').dataset.motion === 'off');
  assert.deepEqual(await sceneState(page), { motion: 'off', running: 'false', pressed: 'false' });
  await assertSameScene(page);
});

test('creation, reading, drawers and custom actions stay legible at phone and desktop widths', async t => {
  const { page } = await fixture(t);
  await enterBirth(page);
  await page.locator('#live-name').fill('长风听雨问道云归'.repeat(3));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await assertFits(page, `${width}px creation`);
    await assertReadable(page, '.live-birth-greeting', `${width}px creation introduction`);
    await assertReadable(page, '#live-name', `${width}px name input`);
    await assertReadable(page, '[data-live-reroll]', `${width}px reroll control`);
    await assertReadable(page, '[data-live-lock]', `${width}px talent lock`);
    await assertReadable(page, '#live-origin-history', `${width}px origin history`);
    await assertReadable(page, '.live-roll-talent p', `${width}px talent explanation`);
  }
  await enterStory(page);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await assertFits(page, `${width}px story`);
    await assertReadable(page, '.journey-prose .journey-block', `${width}px story prose`);
    await assertReadable(page, '[data-live-choice] .journey-choice-label', `${width}px choices`);
    await page.locator('[data-live-custom-toggle]').click();
    await page.locator('#live-custom-action').fill('观察眼前山路'.repeat(8));
    await assertReadable(page, '#live-custom-action', `${width}px custom action`);
    await assertFits(page, `${width}px custom action`);
    await page.locator('[data-live-custom-toggle]').click();
    await page.locator('[data-character]').click();
    await assertReadable(page, '#dialog .character-facts dt', `${width}px character labels`);
    await assertReadable(page, '#dialog .character-facts dd', `${width}px character values`);
    await assertFits(page, `${width}px character drawer`);
    await page.locator('#dialog [data-close-dialog]').click();
    await page.locator('[data-history]').click();
    await assertReadable(page, '#dialog .journey-block', `${width}px history`);
    await assertFits(page, `${width}px history drawer`);
    await page.locator('#dialog [data-close-dialog]').click();
    await page.locator('[data-view="settings"]').click();
    await assertReadable(page, '#reading-theme', `${width}px reading settings`);
    await page.locator('#reading-size').selectOption('large');
    await assertFits(page, `${width}px settings`);
    await page.locator('[data-menu-back]').click();
    assert.ok(await page.locator('.journey-prose .journey-block').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize)) >= 21, 'large text remains effective inside the new game shell');
    await assertFits(page, `${width}px large text`);
  }
});

test('new readers receive the cinematic theme in the page and settings', async t => {
  const { page } = await fixture(t);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'cinematic');
  await page.locator('[data-view="settings"]').click();
  assert.equal(await page.locator('#reading-theme').inputValue(), 'cinematic');
  await page.locator('#reading-size').selectOption('large');
  await page.reload();
  assert.equal(await page.locator('#reading-theme').inputValue(), 'cinematic');
  assert.equal(await page.locator('#reading-size').inputValue(), 'large');
});

test('existing light, dark and system preferences keep their selected theme and larger text', async t => {
  const f = await fixture(t), { page } = f;
  for (const theme of ['light', 'dark', 'system']) {
    await page.evaluate(({ key, theme }) => localStorage.setItem(key, JSON.stringify({ theme, textSize: 'large' })), { key: readingKey, theme });
    await page.goto(appOrigin + '/');
    await page.locator('[data-title-new]:enabled').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    assert.equal(await page.locator('html').getAttribute('data-text-size'), 'large');
    await page.locator('[data-view="settings"]').click();
    assert.equal(await page.locator('#reading-theme').inputValue(), theme);
    await page.reload();
    assert.equal(await page.locator('#reading-theme').inputValue(), theme);
    assert.equal(await page.locator('#reading-size').inputValue(), 'large');
    await assertReadable(page, '.reading-sample', `${theme} large reading sample`);
  }
  assert.equal(f.posts, 0, 'theme selection never requests a story');
});
