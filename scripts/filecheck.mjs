// node scripts/filecheck.mjs <fileUrl> <out.png>
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2];
const out = process.argv[3] || 'shots/file-hint.png';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage', '--mute-audio', '--allow-file-access-from-files'],
  defaultViewport: { width: 900, height: 560 },
});
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
const text = await page.evaluate(() => document.getElementById('root').innerText.slice(0, 120));
console.log('ROOT TEXT:', JSON.stringify(text));
await page.screenshot({ path: out });
await browser.close();