// node scripts/probe.mjs <url> <waitMs> <actionsJson> <expr>
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] || 'http://localhost:5173';
const waitMs = parseInt(process.argv[3] || '4000', 10);
const actions = process.argv[4] ? JSON.parse(process.argv[4]) : [];
const expr = process.argv[5] || '(()=>{const e=window.__engine;return {phase:e.phase, speed:e.player&&e.player.speed, pos:e.player&&[e.player.pos.x.toFixed(1),e.player.pos.z.toFixed(1)], lap:e.player&&e.player.lap, t:e.player&&e.player.nearestT};})()';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage', '--mute-audio'],
  defaultViewport: { width: 1000, height: 620 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForSelector('canvas');
await new Promise((r) => setTimeout(r, waitMs));
for (const a of actions) {
  if (a.type === 'eval') await page.evaluate(a.code);
  else if (a.type === 'wait') await new Promise((r) => setTimeout(r, a.ms));
  else if (a.type === 'keydown') await page.keyboard.down(a.key);
  else if (a.type === 'keyup') await page.keyboard.up(a.key);
}
const result = await page.evaluate(expr);
console.log(JSON.stringify(result));
await browser.close();