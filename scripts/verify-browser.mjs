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

  // 1. 进入建角选道统，确认立绘图片加载成功
  await page.click('button:has-text("踏入新一世仙途")');
  await page.waitForSelector('.lineage-thumb');

  // 2. 开启仙途 -> 星宿图
  await page.click('button:has-text("破壳降生")');
  await page.waitForSelector('.map-stage');

  // 3. 进战并校验高清立绘图片加载 + 零页面垂直滚动 + 零横向溢出
  await page.locator('.map-node-btn.reachable').first().click();
  await page.waitForSelector('.battle-one-screen .portrait-img');

  const layoutCheck = await page.evaluate(() => {
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

  if (!layoutCheck.allLoaded) throw new Error(`${name}: portrait images failed to load`);
  if (layoutCheck.scrollW > layoutCheck.innerW + 2) {
    throw new Error(`${name}: horizontal overflow (${layoutCheck.scrollW} > ${layoutCheck.innerW})`);
  }
  if (layoutCheck.scrollH > layoutCheck.innerH + 2) {
    throw new Error(`${name}: vertical scroll detected in combat (${layoutCheck.scrollH} > ${layoutCheck.innerH})`);
  }

  // 4. 打出第一张可用TCG卡并结束回合
  await page.locator('.tcg-card:not([disabled])').first().click();
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
