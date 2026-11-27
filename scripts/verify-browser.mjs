import { readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

function findLocalChromium() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  try {
    const dirs = readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) {
      return path.join(base, d, 'chrome-win64', 'chrome.exe');
    }
  } catch {}
  return undefined;
}

const htmlUrl = pathToFileURL(path.resolve('release/baishi-wending-web.html')).href;

async function verifyViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.title-main');

  // 1. 验证万法图鉴四分页可正常打开并返回
  await page.click('button:has-text("万法图鉴")');
  await page.waitForSelector('h2:has-text("万法图鉴")');
  await page.click('button:has-text("名场面成就")');
  await page.click('button:has-text("三界强敌志")');
  await page.click('button:has-text("返回首页")');

  // 2. 建角 -> 破壳降生 -> 天命赐福四选一 -> SVG 星轨连线星宿地图（确保已无寿元/道基显示）
  await page.click('button:has-text("踏入新一世仙途")');
  await page.waitForSelector('.lineage-thumb');
  await page.click('button:has-text("破壳降生")');
  await page.waitForSelector('.blessing-card');
  await page.locator('.blessing-card').first().click();

  await page.waitForSelector('.map-stage svg.map-lines');
  const lineCount = await page.locator('.map-stage svg.map-lines line').count();
  if (lineCount < 10) throw new Error(`${name}: star map lines missing (${lineCount})`);

  // 打开顶部「? 词条」白话指南确认渲染正常并关闭
  await page.click('button:has-text("? 词条")');
  await page.waitForSelector('.glossary-grid');
  await page.click('.modal-box button:has-text("关闭")');

  // 3. 进战并校验高清立绘 + 首次轻提示 + 严格一屏零滚动
  await page.locator('.map-node-btn.reachable').first().click();
  await page.waitForSelector('.battle-one-screen .portrait-img');

  const checkZeroScroll = async (stageLabel) => {
    const res = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.portrait-img'));
      const allLoaded = imgs.length >= 2 && imgs.every((img) => img.complete && img.naturalWidth > 100);
      return {
        allLoaded,
        scrollH: document.documentElement.scrollHeight,
        innerH: window.innerHeight,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
      };
    });
    if (!res.allLoaded) throw new Error(`${name} (${stageLabel}): portrait images failed to load`);
    if (res.scrollW > res.innerW + 2) {
      throw new Error(`${name} (${stageLabel}): horizontal overflow (${res.scrollW} > ${res.innerW})`);
    }
    if (res.scrollH > res.innerH + 2) {
      throw new Error(`${name} (${stageLabel}): vertical scroll detected (${res.scrollH} > ${res.innerH})`);
    }
    return res;
  };

  const layoutCheck = await checkZeroScroll('initial');

  // 关闭首次进战提示
  const onboardBtn = page.locator('.onboard-banner button');
  if ((await onboardBtn.count()) > 0) {
    await onboardBtn.click();
  }

  // 4. 轻触五行灵印槽弹出连招白话气泡，验证依然一屏零滚动
  await page.click('.seal-bar-btn');
  await page.waitForSelector('.tip-popover');
  await checkZeroScroll('tip-popover-open');
  await page.click('.tip-popover button:has-text("关闭")');

  // 5. 轻触乾坤丹符袋 -> 弹出详情与防误触确认窗 -> 点击「立即使用」
  const activePouch = page.locator('.pouch-slot.active').first();
  if ((await activePouch.count()) > 0) {
    await activePouch.click();
    await page.waitForSelector('.confirm-pouch-btn');
    await page.click('.confirm-pouch-btn');
  }

  // 6. 单击手牌 -> 预览白话词条注释浮层（校验依然一屏零滚动！） -> 再点「立即打出」完成出牌
  const playableCard = page.locator('.tcg-card:not(.is-unplayable)').first();
  await playableCard.click();
  await page.waitForSelector('.card-preview-overlay');
  await checkZeroScroll('card-preview-open');
  await page.click('.confirm-play-btn');

  // 7. 结束回合
  await page.click('button:has-text("结束回合")');
  await page.waitForTimeout(420);

  if (errors.length > 0) throw new Error(`${name}: console/page errors: ${errors.join('; ')}`);

  await page.close();
  return { name, ok: true, ...layoutCheck };
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: findLocalChromium() });
  try {
    const desktop = await verifyViewport(browser, 'desktop-1280x800', { width: 1280, height: 800 });
    const mobileLand = await verifyViewport(browser, 'mobile-landscape-844x390', { width: 844, height: 390 });
    const mobilePort = await verifyViewport(browser, 'mobile-portrait-390x844', { width: 390, height: 844 });
    console.log(JSON.stringify({ ok: true, results: [desktop, mobileLand, mobilePort] }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
