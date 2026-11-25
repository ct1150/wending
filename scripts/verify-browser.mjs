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
  const titleText = await page.textContent('.title-main');
  if (!titleText?.includes('百世问鼎')) throw new Error(`${name}: missing title`);

  // 1. 进入建角选道统
  await page.click('button:has-text("踏入新一世仙途")');
  await page.waitForSelector('.lineage-grid');

  // 2. 重掷灵根并开启仙途
  await page.click('button:has-text("重掷灵根")');
  await page.click('button:has-text("破壳降生")');
  await page.waitForSelector('.map-stage');

  // 3. 点击第一层可达节点进入战斗
  const reachable = page.locator('.map-node-btn.reachable').first();
  await reachable.click();
  await page.waitForSelector('.battle-stage');

  // 4. 打出第一张可用神通牌并结束回合
  const playableCard = page.locator('.card-tile:not([disabled])').first();
  await playableCard.click();
  await page.click('button:has-text("结束回合")');

  // 检查是否横向溢出
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  if (overflow) throw new Error(`${name}: horizontal overflow detected`);
  if (errors.length > 0) throw new Error(`${name}: console/page errors: ${errors.join('; ')}`);

  await page.close();
  return { name, ok: true };
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: findLocalChromium() });
  try {
    const desktop = await verifyViewport(browser, 'desktop-1280x800', { width: 1280, height: 800 });
    const mobile = await verifyViewport(browser, 'mobile-390x844', { width: 390, height: 844 });
    console.log(JSON.stringify({ ok: true, results: [desktop, mobile] }));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
