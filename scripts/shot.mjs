// 无头截图工具：node scripts/shot.mjs <out.png> [waitMs] [url] [actionsJson]
// actionsJson: [{type:'click',selector}|{type:'key',key}|{type:'wait',ms}|{type:'eval',code}]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out = process.argv[2] || 'shot.png';
const waitMs = parseInt(process.argv[3] || '3500', 10);
const url = process.argv[4] || 'http://localhost:5173';
const actions = process.argv[5] ? JSON.parse(process.argv[5]) : [];
const VW = parseInt(process.argv[6] || '1280', 10);
const VH = parseInt(process.argv[7] || '800', 10);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--mute-audio',
    '--window-size=1280,800',
  ],
  defaultViewport: { width: VW, height: VH, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('[console.error] ' + m.text());
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForSelector('canvas', { timeout: 30000 });
await new Promise((r) => setTimeout(r, waitMs));

for (const a of actions) {
  if (a.type === 'click') {
    await page.click(a.selector).catch((e) => errors.push('click fail ' + a.selector + ': ' + e.message));
  } else if (a.type === 'key') {
    await page.keyboard.press(a.key);
  } else if (a.type === 'keydown') {
    await page.keyboard.down(a.key);
  } else if (a.type === 'keyup') {
    await page.keyboard.up(a.key);
  } else if (a.type === 'wait') {
    await new Promise((r) => setTimeout(r, a.ms || 500));
  } else if (a.type === 'eval') {
    await page.evaluate(a.code).catch((e) => errors.push('eval fail: ' + e.message));
  }
}

await page.screenshot({ path: out });
fs.writeFileSync(out.replace(/\.png$/, '.log.txt'), errors.join('\n') || 'no console errors');
console.log('saved', out);
if (errors.length) console.log(errors.slice(0, 12).join('\n'));
await browser.close();