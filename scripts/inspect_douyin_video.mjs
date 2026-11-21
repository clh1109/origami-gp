import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'https://www.douyin.com/video/7693029509544676671';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--mute-audio',
    '--window-size=1280,900',
  ],
  defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  console.log('Navigating to Douyin video...');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wait(4000);

  // 彻底移除登录弹窗及遮罩
  await page.evaluate(() => {
    const removeOverlays = () => {
      document.querySelectorAll('div, article, section').forEach((el) => {
        const text = el.innerText || '';
        if (text.includes('登录后免费畅享') || text.includes('扫码登录') || text.includes('验证码登录')) {
          el.remove();
        }
      });
      document.querySelectorAll('div[class*="mask"], div[class*="overlay"], div[class*="backdrop"]').forEach((el) => el.remove());
    };
    removeOverlays();
  });
  await wait(1000);

  const times = [2, 10, 20, 32, 45, 60, 75, 88];
  for (const t of times) {
    await page.evaluate((seekTime) => {
      document.querySelectorAll('div, article').forEach((el) => {
        if ((el.innerText || '').includes('登录后免费畅享')) el.remove();
      });
      document.querySelectorAll('div[class*="mask"], div[class*="overlay"]').forEach((el) => el.remove());

      const v = document.querySelector('video');
      if (v) {
        v.pause();
        v.currentTime = seekTime;
      }
    }, t);
    await wait(1200);
    const shotPath = `shots/douyin-clear-${t}s.png`;
    await page.screenshot({ path: shotPath });
    console.log(`Captured ${shotPath}`);
  }
} catch (err) {
  console.error('Error during video capture:', err);
} finally {
  await browser.close();
}
