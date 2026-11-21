import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fileUrl = 'file:///E:/Qoder%E6%AF%94%E8%B5%9B/%E8%B5%9B%E8%BD%A6/%E6%8A%98%E7%BA%B8%E5%A5%87%E6%97%85OrigamiGP.html';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('canvas', { timeout: 15000 });
await wait(2000);

// 切到第 3 步 (车手展示特写 - 默认赤狐)
await page.evaluate(() => {
  window.__store.getState().setLobbyStep(3);
  window.__engine.enterLobby(window.__store.getState().config, 3);
});
await wait(1800);
await page.screenshot({ path: 'shots/v6-car-close-fox.png' });

// 切换到第 2 个车手 (雪兔)
await page.evaluate(() => {
  window.__store.getState().setConfig({ racerId: 'rabbit' });
  window.__engine.enterLobby(window.__store.getState().config, 3);
});
await wait(1500);
await page.screenshot({ path: 'shots/v6-car-close-rabbit.png' });

// 切换到黑熊
await page.evaluate(() => {
  window.__store.getState().setConfig({ racerId: 'bear' });
  window.__engine.enterLobby(window.__store.getState().config, 3);
});
await wait(1500);
await page.screenshot({ path: 'shots/v6-car-close-bear.png' });

// 切换到帆舟·浪 (boat)
await page.evaluate(() => {
  window.__store.getState().setConfig({ racerId: 'boat' });
  window.__engine.enterLobby(window.__store.getState().config, 3);
});
await wait(1500);
await page.screenshot({ path: 'shots/v7-car-close-boat.png' });

await browser.close();
console.log('Close up car screenshots captured successfully!');
