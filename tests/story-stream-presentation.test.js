import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';
import { createLiveGame, prepareOpening } from '../src/game/cultivation/live/engine.js';
import { renderLiveJourney } from '../src/ui/journey.js';
import { cultivationFixtureProse } from './helpers/live-story-fixture.js';

test('structured preview presents the current dialogue and model choices without actionable commands', () => {
  const state = createLiveGame({ runId: 'structured-preview', seed: 42 });
  const pending = prepareOpening(state, { requestId: 'opening' });
  const preview = {
    blocks: [
      { kind: 'narration', text: '你沿着山路走近渡口。', complete: true },
      { kind: 'dialogue', speaker: '渡者', text: '“前方渡口封了，你要去哪里？”', complete: true },
    ],
    choices: [{ label: '询问渡者：渡口为何封闭', complete: true }, { label: '查看河边留下的脚印', complete: false }],
  };
  const html = renderLiveJourney({ state, pending, busy: true, status: 'pending', preview }, []);
  assert.match(html, /class="journey-block journey-narration"[^>]*>你沿着山路走近渡口。<\/p>/);
  assert.match(html, /class="journey-block journey-dialogue"[^>]*><span class="journey-voice">渡者：<\/span>“前方渡口封了，你要去哪里？”<\/p>/);
  assert.match(html, /询问渡者：渡口为何封闭/);
  assert.match(html, /查看河边留下的脚印/);
  assert.doesNotMatch(html, /data-live-choice="|此生的行路，正要从这里开始|生成中 · 正文尚未保存|正文完成并保存后开放下一步/);
  assert.equal((html.match(/<button\b[^>]*\bdisabled\b/g) ?? []).length, 2);
});

test('ready choices omit empty accounting while preserving real costs and risks', () => {
  const state = createLiveGame({ runId: 'quiet-costs', seed: 42 });
  state.phase = 'active';
  state.currentScene = { id: 'scene', title: '渡口', location: '河畔', entities: [], blocks: [{ kind: 'narration', text: '你在渡口停下。' }] };
  const choices = [
    { id: 'ask', label: '询问渡口的去向', enabled: true, costs: { days: 0, items: {} }, warnings: [] },
    { id: 'help', label: '取出行粮交给渡者', enabled: true, costs: { days: 1, items: { ration: 1 } }, warnings: ['渡河可能受伤'] },
  ];
  const html = renderLiveJourney({ state, pending: null, busy: false, status: 'ready', itemNames: { ration: '行粮' } }, choices);
  assert.doesNotMatch(html, />0\s*日|落下一念，故事才会继续/);
  assert.match(html, /1\s*日/);
  assert.match(html, /行粮 1/);
  assert.match(html, /渡河可能受伤/);
});

test('streamed narration keeps the saved story reading typography', async t => {
  const { page } = await liveBrowser(t);
  const result = await page.evaluate(async () => {
    const { renderLiveJourney } = await import('/src/ui/journey.js');
    const state = engine.createLiveGame({ runId: 'presentation', seed: 42 });
    const pending = engine.prepareOpening(state, { requestId: 'opening' });
    const scene = fixture(state);
    scene.blocks = [{ kind: 'narration', text: '你沿着山路走近渡口。' }];
    const root = document.querySelector('#app');
    const readingStyle = element => {
      const style = getComputedStyle(element);
      return Object.fromEntries(['fontFamily', 'fontSize', 'lineHeight', 'whiteSpace'].map(key => [key, style[key]]));
    };
    root.innerHTML = renderLiveJourney({ state, pending, busy: true, status: 'pending', preview: { text: scene.blocks[0].text } }, []);
    const preview = readingStyle(root.querySelector('[data-live-preview-text] .journey-block') ?? root.querySelector('[data-live-preview-text]'));
    const nextState = engine.commitTurn(state, pending, scene);
    root.innerHTML = renderLiveJourney({ state: nextState, pending: null, busy: false, status: 'ready' }, []);
    const saved = readingStyle(root.querySelector('.journey-block'));
    return { preview, saved };
  });
  assert.deepEqual(result.preview, result.saved, 'finishing the same narration must not change its font, size, line height or whitespace');
});

test('a ready story leaves routine generation instructions off the reading surface', async t => {
  const { page } = await liveBrowser(t);
  const result = await page.evaluate(async () => {
    const { renderLiveJourney } = await import('/src/ui/journey.js');
    const state = engine.createLiveGame({ runId: 'quiet-presentation', seed: 42 });
    const pending = engine.prepareOpening(state, { requestId: 'opening' });
    const nextState = engine.commitTurn(state, pending, fixture(state));
    const root = document.querySelector('#app');
    root.innerHTML = renderLiveJourney({ state: nextState, pending: null, busy: false, status: 'ready' }, []);
    const status = root.querySelector('.live-status');
    return status && !status.hidden && getComputedStyle(status).display !== 'none' ? status.textContent.trim() : '';
  });
  assert.equal(result, '', 'completed narration and choices need no permanent status instruction');
});

test('the app keeps streamed dialogue and choice nodes through completion and durable save', async t => {
  const { page, origin } = await liveBrowser(t);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://wending-presentation.test/**', async route => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await page.request.get(origin + (url.pathname === '/' ? '/index.html' : url.pathname)) });
  });
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = async (url, options) => {
      if (url === '/api/story/capabilities') return Response.json({ protocolVersion: 1, available: true, status: 'ready', errorCode: null, storyActions: true, limits: { maxRequestBytes: 32768, maxResponseBytes: 65536, maxContextBytes: 7000, timeoutMs: 30000 } });
      if (url === '/api/story/session') return Response.json({ protocolVersion: 1, status: 'ready', sessionRef: 'presentation-session', expiresAt: Date.now() + 86400000 });
      if (url !== '/api/story/turn') return original(url, options);
      const { context, attempt } = JSON.parse(options.body);
      window.streamRequest = { context, attempt };
      return new Response(new ReadableStream({ start(controller) {
        window.streamPacket = (packet, close = false) => {
          const value = { protocolVersion: 1, requestId: context.identity.requestId, attemptId: attempt.id, sessionRef: attempt.sessionRef, ...packet };
          controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify(value) + '\n\n'));
          if (close) controller.close();
        };
      } }), { headers: { 'content-type': 'text/event-stream' } });
    };
  });
  await page.goto('https://wending-presentation.test/index.html');
  await page.locator('[data-title-new]:enabled').click();
  await page.locator('[data-live-start]:enabled').click();
  await page.waitForFunction(() => window.streamPacket);
  const firstNarration = cultivationFixtureProse('你沿着山路走近渡口。', 1);
  await page.evaluate(text => {
    window.streamPacket({ type: 'block', index: 0, kind: 'narration', text, complete: true });
    window.streamPacket({ type: 'block', index: 1, kind: 'dialogue', speaker: '渡者', text: '“前方渡口封了，你要去', complete: false });
    window.streamPacket({ type: 'choice', index: 0, label: '询问渡者：渡口为何', complete: false });
  }, firstNarration);
  await page.locator('[data-live-choice-preview]').waitFor();
  assert.equal(await page.locator('.journey-dialogue').textContent(), '渡者：“前方渡口封了，你要去');
  assert.equal(await page.locator('[aria-label="本地开场"]:visible').count(), 0);
  assert.equal(await page.locator('[data-live-choice]').count(), 0);
  await page.locator('[data-history]').focus();
  await page.evaluate(() => {
    window.originalBlock = document.querySelector('.journey-dialogue');
    window.originalChoice = document.querySelector('[data-live-choice-preview]');
    window.streamPacket({ type: 'block', index: 1, kind: 'dialogue', speaker: '渡者', text: '“前方渡口封了，你要去哪里？”', complete: true });
    window.streamPacket({ type: 'choice', index: 0, label: '询问渡者：渡口为何封闭', complete: true });
    window.streamPacket({ type: 'choice', index: 1, label: '告辞渡者：结束交谈', complete: true });
    window.streamPacket({ type: 'choice', index: 2, label: '留在岸边观察渡口的动静', complete: true });
  });
  await page.waitForFunction(() => document.querySelectorAll('[data-live-choice-preview]').length === 3);
  const before = await page.evaluate(() => {
    const block = document.querySelector('.journey-dialogue'), choice = document.querySelector('[data-live-choice-preview]');
    const style = getComputedStyle(block);
    return { prose: block.textContent, label: choice.textContent, top: block.getBoundingClientRect().top, font: style.font, choiceBorder: getComputedStyle(choice).borderStyle };
  });
  const { context, attempt } = await page.evaluate(() => window.streamRequest);
  const prefix = `${context.namespace}:t${context.identity.turnId}:`, person = prefix + 'e:ferry';
  const scene = {
    id: prefix + 's:scene', title: '渡口问路', location: '河畔',
    blocks: [{ kind: 'narration', text: firstNarration }, { kind: 'dialogue', speaker: person, text: '“前方渡口封了，你要去哪里？”' }],
    entities: [{ id: person, name: '渡者', kind: 'person' }],
    choices: [
      { id: prefix + 'c:ask', label: '询问渡者：渡口为何封闭', intent: 'interact', targetId: person, stake: 'low', approach: 'ask' },
      { id: prefix + 'c:leave', label: '告辞渡者：结束交谈', intent: 'interact', targetId: person, stake: 'low', approach: 'leave' },
      { id: prefix + 'c:observe', label: '留在岸边观察渡口的动静', intent: 'interact', targetId: 'self', stake: 'low', approach: 'observe' },
    ],
    memoryDeltas: [], story: { pattern: 'journey', beat: 'progress', anchors: [0] },
  };
  await page.evaluate(result => window.streamPacket({ type: 'result', result }, true), { protocolVersion: 1, status: 'ready', errorCode: null, retry: null, requestId: context.identity.requestId, attemptId: attempt.id, sessionRef: attempt.sessionRef, scene });
  await page.locator('[data-live-choice]:enabled').first().waitFor();
  const after = await page.evaluate(async () => {
    const block = document.querySelector('.journey-dialogue'), choice = document.querySelector('[data-live-choice]');
    const style = getComputedStyle(block);
    const { openLiveArchive } = await import('/src/game/live-archive.js');
    const archive = await openLiveArchive();
    const saved = await archive.load();
    archive.close();
    return { prose: block.textContent, label: choice.textContent, top: block.getBoundingClientRect().top, font: style.font, choiceBorder: getComputedStyle(choice).borderStyle, sameBlock: block === window.originalBlock, sameChoice: choice === window.originalChoice, focus: document.activeElement.hasAttribute('data-history'), revision: saved.state.revision, noOverflow: document.documentElement.scrollWidth <= innerWidth };
  });
  assert.deepEqual({ prose: after.prose, label: after.label, top: after.top, font: after.font, choiceBorder: after.choiceBorder }, before);
  assert.deepEqual({ sameBlock: after.sameBlock, sameChoice: after.sameChoice, focus: after.focus, revision: after.revision, noOverflow: after.noOverflow }, { sameBlock: true, sameChoice: true, focus: true, revision: 1, noOverflow: true });
  assert.deepEqual(errors, []);
});
