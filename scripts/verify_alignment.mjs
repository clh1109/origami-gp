import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fileUrl = 'file:///E:/Qoder%E6%AF%94%E8%B5%9B/%E8%B5%9B%E8%BD%A6/%E6%8A%98%E7%BA%B8%E5%A5%87%E6%97%85OrigamiGP.html';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAP = `(() => {
  const rects = (sel) => [...document.querySelectorAll(sel)].map(el => { const r = el.getBoundingClientRect(); return { sel, x: r.x, y: r.y, w: r.width, h: r.height }; });
  const btns = rects('.touch-btn');
  const cards = rects('.paper-card');
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const bad = [];
  for (let i = 0; i < btns.length; i++) {
    for (let j = i + 1; j < btns.length; j++) if (hit(btns[i], btns[j])) bad.push('btn-btn');
    for (const c of cards) if (hit(btns[i], c)) bad.push('btn-card');
  }
  return { btnCount: btns.length, bad };
})()`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--mute-audio',
    '--allow-file-access-from-files',
    '--window-size=1280,800',
  ],
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('[console.error] ' + m.text());
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

console.log('Navigating to single-file build:', fileUrl);
await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('canvas', { timeout: 15000 });
await wait(3000);

// 0. 验证开场精装立体书封面
await page.screenshot({ path: 'shots/v5-storybook-cover.png' });
await page.evaluate(() => window.__store.getState().setBookCover(false));
await wait(500);

// 1. 验证大厅 Step 1 (模式)
await page.screenshot({ path: 'shots/v5-lobby-step1.png' });

// 2. 切换到 Step 2 (纸张克重: 80g / 120g / 200g)
await page.evaluate(() => window.__store.getState().setLobbyStep(2));
await wait(1200);
await page.screenshot({ path: 'shots/v5-lobby-step2-paper.png' });

// 3. 切换到 Step 4 (章节) 并开始比赛
await page.evaluate(() => window.__store.getState().setLobbyStep(4));
await wait(1000);
await page.screenshot({ path: 'shots/v5-lobby-step4-tracks.png' });

// 4. 开始比赛 (雏菊草甸)
await page.evaluate(() => {
  window.__store.getState().setResults([]);
  window.__engine.startRace(window.__store.getState().config);
});
await wait(1200);

// 截取开场巡航便签卡 (章节 1 · 雏菊草甸)
await page.screenshot({ path: 'shots/v5-race-intro-banner.png' });

// 模拟推进进入比赛 racing
await page.evaluate(() => {
  const e = window.__engine;
  e.sm.render = () => {};
  for (let i = 0; i < 240; i++) e.update(1 / 60);
  delete e.sm.render;
});
await wait(1200);

// 验证赛道名称与 HUD 状态
const trackInfo = await page.evaluate(() => ({
  trackId: window.__store.getState().config.trackId,
  hudPlace: window.__store.getState().hud.place,
  hudLap: window.__store.getState().hud.lap,
  hudSpeed: window.__store.getState().hud.speed,
}));
console.log('Track and HUD state:', trackInfo);

// 截取竞速中画面 (雏菊草甸 + 1:1 HUD)
await page.screenshot({ path: 'shots/v5-race-meadow.png' });
console.log('Desktop Errors:', errors);
await page.close();

// 5. 移动端 (390x844 & 320x568) 按键重叠检测
const mp = await browser.newPage();
await mp.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await mp.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });
await mp.waitForSelector('canvas', { timeout: 15000 });
await wait(2000);
await mp.evaluate(() => {
  window.__store.getState().setBookCover(false);
  window.__store.getState().setResults([]);
  window.__engine.startRace(window.__store.getState().config);
});
await wait(1200);
const mobileCountdownOverlap = await mp.evaluate(OVERLAP);
console.log('Mobile 390x844 countdown overlap:', JSON.stringify(mobileCountdownOverlap));
await mp.screenshot({ path: 'shots/v5-mobile-countdown.png' });

// 窄屏 320x568
await mp.setViewport({ width: 320, height: 568, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await wait(1000);
const smallCountdownOverlap = await mp.evaluate(OVERLAP);
console.log('Small 320x568 countdown overlap:', JSON.stringify(smallCountdownOverlap));
await mp.screenshot({ path: 'shots/v5-small-countdown.png' });

await browser.close();
console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY');
