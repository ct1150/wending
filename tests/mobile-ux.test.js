import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';

test('mobile 375x812 full playthrough: auto-scrolls to top on scene advance, keeps choices right below prose, shows v2 titles, and trims fixed header height', async t => {
  const { page } = await liveBrowser(t);
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/story/**', route => route.abort());

  // 1. Title & Character creation
  await page.locator('[data-title-new]:enabled').click();
  await page.locator('#live-name').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'creation fits 375px width');

  await page.locator('[data-live-start]:enabled').scrollIntoViewIfNeeded();
  await page.locator('[data-live-start]:enabled').click();
  await page.locator('[data-live-choice$=":c:leave-village"]:enabled').waitFor();

  const pick = async (key) => {
    const btn = page.locator(`[data-live-choice$=":c:${key}"]:enabled`);
    await btn.scrollIntoViewIfNeeded();
    const beforeRev = await btn.getAttribute('data-revision');
    await btn.click();
    await page.waitForFunction(rev => {
      const next = document.querySelector('[data-live-choice]:enabled');
      return next && next.dataset.revision !== rev;
    }, beforeRev);
  };

  // Scroll deep down to pick visit-stele, then verify auto-scroll back to top on new scene
  await pick('visit-stele');
  await page.locator('[data-live-choice$=":c:leave-village"]:enabled').waitFor();
  const afterStele = await page.evaluate(() => {
    const sceneTop = document.querySelector('.game-scene-topbar')?.getBoundingClientRect().height ?? 0;
    const paperTop = document.querySelector('.paper-top-immersive')?.getBoundingClientRect().height ?? 0;
    const firstBlockTop = document.querySelector('[data-live-block="0"]')?.getBoundingClientRect().top ?? -999;
    return {
      scrollY: window.scrollY,
      fixedTopTotal: Math.round(sceneTop + paperTop),
      firstBlockTop: Math.round(firstBlockTop),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(afterStele.overflowX, false, 'prologue-stele should not overflow horizontally');
  assert.ok(afterStele.fixedTopTotal <= 132, `mobile double header should be compact (<=132px), got ${afterStele.fixedTopTotal}px`);
  assert.ok(afterStele.scrollY <= 12, `advancing to a new scene should auto-scroll back to top, got scrollY=${afterStele.scrollY}`);
  assert.ok(afterStele.firstBlockTop >= afterStele.fixedTopTotal - 4, `first paragraph top (${afterStele.firstBlockTop}) should be visible below fixed header (${afterStele.fixedTopTotal})`);

  // Advance through prologue to Qi hub
  await pick('leave-village');
  await pick('join-gate');
  await pick('work-bank');
  await pick('save-canal');
  for (let i = 0; i < 40; i++) {
    if (await page.locator('[data-live-choice$=":c:take-help"]:enabled').count()) { await pick('take-help'); break; }
    if (await page.locator('[data-live-choice$=":c:try-again"]:enabled').count()) await pick('try-again');
    else if (await page.locator('[data-live-choice$=":c:first-breakthrough"]:enabled').count()) await pick('first-breakthrough');
    else if (await page.locator('[data-live-choice$=":c:restore-copy"]:enabled').count()) await pick('restore-copy');
    else if (await page.locator('[data-live-choice$=":c:settle-breath"]:enabled').count()) await pick('settle-breath');
    else if (await page.locator('[data-live-choice$=":c:recover-first"]:enabled').count()) await pick('recover-first');
    else if (await page.locator('[data-live-choice$=":c:prologue-rest"]:enabled').count()) await pick('prologue-rest');
  }
  await pick('chapter-out');

  // Verify hub layout: choices sit right below compact state bar, above auxiliary growth/leads/notes panels
  const hubMetrics = await page.evaluate(() => {
    const prose = document.querySelector('[data-live-prose]');
    const choices = document.querySelector('[data-live-choices]');
    const growthPanel = document.querySelector('[data-event-growth]').getBoundingClientRect();
    const between = [];
    for (let el = prose.nextElementSibling; el && el !== choices; el = el.nextElementSibling) {
      if (!el.hidden) between.push(el.className || el.tagName);
    }
    return {
      between,
      gapProseToChoices: Math.round(choices.getBoundingClientRect().top - prose.getBoundingClientRect().bottom),
      choicesAboveAux: choices.getBoundingClientRect().bottom <= growthPanel.top + 12,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(hubMetrics.overflowX, false);
  assert.deepEqual(hubMetrics.between, ['live-turn-state'], 'only the compact live-turn-state may sit between prose and choices');
  assert.ok(hubMetrics.gapProseToChoices <= 165, `choices should sit close to prose without multi-panel clutter (<=165px), got ${hubMetrics.gapProseToChoices}px`);
  assert.equal(hubMetrics.choicesAboveAux, true, 'choices should appear before auxiliary growth/notes/leads panels');

  // Enter v2-chronicles -> duel-book -> duel-arena and verify visible title + compact gap + auto-scroll
  await pick('journey-menu');
  await pick('v2-chronicles');
  await pick('duel-book');
  await pick('duel-start');
  await page.locator('[data-live-choice$=":c:duel-strike"]:enabled').waitFor();
  const duelMetrics = await page.evaluate(() => {
    const title = document.querySelector('#journey-current-title');
    const loc = document.querySelector('.live-scene-location');
    const prose = document.querySelector('[data-live-prose]').getBoundingClientRect();
    const choices = document.querySelector('[data-live-choices]').getBoundingClientRect();
    const enabledReasons = [...document.querySelectorAll('[data-live-choice]:enabled .journey-choice-reason:not([hidden])')];
    return {
      scrollY: window.scrollY,
      titleVisible: title && !title.classList.contains('live-sr-only'),
      titleText: title?.innerText.trim() ?? '',
      locationText: loc?.innerText.trim() ?? '',
      gapProseToChoices: Math.round(choices.top - prose.bottom),
      hasMetaReasonClass: enabledReasons.some(el => el.classList.contains('is-meta')),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(duelMetrics.overflowX, false);
  assert.equal(duelMetrics.titleVisible, true, 'v2 duel arena title should be visibly rendered');
  assert.match(duelMetrics.titleText, /第1合/);
  assert.ok(duelMetrics.locationText.length > 0, 'v2 scene location eyebrow should be visible');
  assert.ok(duelMetrics.scrollY <= 12, `entering duel should scroll to top, got ${duelMetrics.scrollY}`);
  assert.ok(duelMetrics.gapProseToChoices <= 165, `duel choices should sit close to battle log without multi-panel clutter (<=165px), got ${duelMetrics.gapProseToChoices}px`);
  assert.equal(duelMetrics.hasMetaReasonClass, true, 'normal cost/reward hints on enabled choices should use muted is-meta styling instead of error red');

  // Verify character drawer, history drawer, and settings fit cleanly on mobile
  await page.locator('[data-character]').click();
  await page.locator('#dialog[open]').waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('#dialog .dialog-body').scrollWidth <= document.querySelector('#dialog .dialog-body').clientWidth + 1), true, 'character drawer fits 375px');
  await page.locator('#dialog [data-close-dialog]').click();

  await page.locator('[data-history]').click();
  await page.locator('#dialog[open]').waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('#dialog .dialog-body').scrollWidth <= document.querySelector('#dialog .dialog-body').clientWidth + 1), true, 'history drawer fits 375px');
  await page.locator('#dialog [data-close-dialog]').click();

  // Also test 320px narrow mobile screen with large text inside duel
  await page.setViewportSize({ width: 320, height: 667 });
  await page.evaluate(() => { document.documentElement.dataset.textSize = 'large'; });
  const narrowFit = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.equal(narrowFit, true, '320px narrow mobile with large text should never overflow horizontally');

  assert.deepEqual(errors, []);
});
