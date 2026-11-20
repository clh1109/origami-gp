// node scripts/douyin.mjs <url> <out.png>
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2];
const out = process.argv[3] || 'shots/douyin.png';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--lang=zh-CN'],
  defaultViewport: { width: 420, height: 860, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
} catch (e) { console.log('goto warn:', e.message.slice(0, 120)); }
await new Promise((r) => setTimeout(r, 6000));
const info = await page.evaluate(() => {
  const meta = (p) => document.querySelector(`meta[property="${p}"],meta[name="${p}"]`)?.content || null;
  const vids = Array.from(document.querySelectorAll('video')).map((v) => v.src || v.currentSrc || (v.querySelector('source')?.src ?? null));
  const imgs = Array.from(document.querySelectorAll('img')).slice(0, 12).map((i) => i.src);
  return { title: document.title, ogTitle: meta('og:title'), ogDesc: meta('og:description'), ogImage: meta('og:image'), ogVideo: meta('og:video'), vids, imgs, bodyText: document.body.innerText.slice(0, 400) };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2500));
await page.screenshot({ path: out });
await browser.close();