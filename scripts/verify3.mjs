// 触屏虚拟按键默认开启验收：node scripts/verify3.mjs
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});
const errors = [];
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

// 重叠检测：虚拟按键之间、按键与 HUD 纸卡之间不得相交
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

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForSelector('canvas');
await wait(4000);
console.log('default touch =', await page.evaluate('window.__store.getState().settings.touch'));

// 起步（手动驾驶，验证虚拟按键可鼠标操作）
await page.evaluate('window.__store.getState().setResults([]); window.__engine.startRace(window.__store.getState().config);');
await wait(1200);
console.log('countdown buttons/overlap:', JSON.stringify(await page.evaluate(OVERLAP)));
// 无头 GPU 慢时钟：仿真进入 racing 后再做鼠标操作测试
await page.evaluate('(() => { const e = window.__engine; e.sm.render = () => {}; for (let i = 0; i < 300; i++) e.update(1 / 60); delete e.sm.render; })()');
await wait(800);

// 鼠标按住油门 6s → 车速应上升
const boxes = await page.evaluate('[...document.querySelectorAll(".touch-btn")].map(b => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })');
const throttle = boxes[5];
const steerL = boxes[0];
await page.mouse.move(throttle.x, throttle.y);
await page.mouse.down();
await wait(6000);
const speedAfterThrottle = await page.evaluate('+window.__engine.player.speed.toFixed(1)');
await page.mouse.up();
// 按住左转 4s → 航向应变化
const h0 = await page.evaluate('window.__engine.player.heading');
await page.mouse.move(steerL.x, steerL.y);
await page.mouse.down();
await wait(4000);
await page.mouse.up();
const h1 = await page.evaluate('window.__engine.player.heading');
console.log('mouse throttle speed =', speedAfterThrottle, '| steer delta =', +(h1 - h0).toFixed(3));
console.log('racing buttons/overlap:', JSON.stringify(await page.evaluate(OVERLAP)));
await page.screenshot({ path: 'shots/v3-desktop-race.png' });

// 设置开关：默认 ON → 关闭按键消失 → 再开恢复
await page.evaluate('window.__store.getState().setShowSettings(true);');
await wait(600);
const toggleState = () => page.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('触屏虚拟按键'));
  return { on: window.__store.getState().settings.touch, knob: b.querySelector('span span').className.includes('left-[22px]') };
})()`);
console.log('toggle initial:', JSON.stringify(await toggleState()));
await page.evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('触屏虚拟按键')).click()`);
await wait(400);
console.log('after off:', JSON.stringify(await toggleState()), 'buttons =', await page.evaluate('document.querySelectorAll(".touch-btn").length'));
await page.evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('触屏虚拟按键')).click()`);
await wait(400);
console.log('after on:', JSON.stringify(await toggleState()), 'buttons =', await page.evaluate('document.querySelectorAll(".touch-btn").length'));
await page.evaluate('window.__store.getState().setShowSettings(false);');

// 旧存档迁移：无 v 且 touch:false → 升级后回到默认开，其余偏好保留
await page.evaluate('localStorage.setItem("origami-gp-settings", JSON.stringify({ touch: false, volume: 0.4 }));');
await page.reload({ waitUntil: 'networkidle0' });
await wait(2500);
console.log('migrated old save:', JSON.stringify(await page.evaluate('(() => { const s = window.__store.getState().settings; return { touch: s.touch, volume: s.volume }; })()')));
// v2 存档的显式关闭应被尊重
await page.evaluate('window.__store.getState().setSettings({ touch: false });');
await page.reload({ waitUntil: 'networkidle0' });
await wait(2500);
console.log('v2 explicit off respected:', JSON.stringify(await page.evaluate('(() => { const s = window.__store.getState().settings; return { touch: s.touch, volume: s.volume }; })()')));
await page.evaluate('localStorage.removeItem("origami-gp-settings");');
console.log('desktop errors:', errors.length ? errors.slice(0, 8).join(' | ') : 'none');
await page.close();

// 移动端：默认按键 + 无重叠
const mp = await browser.newPage();
const merr = [];
mp.on('console', (m) => { if (m.type() === 'error') merr.push(m.text()); });
mp.on('pageerror', (e) => merr.push(e.message));
await mp.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await mp.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await mp.waitForSelector('canvas');
await wait(4000);
await mp.evaluate('window.__store.getState().setResults([]); window.__engine.startRace(window.__store.getState().config);');
await wait(1500);
console.log('mobile countdown buttons/overlap:', JSON.stringify(await mp.evaluate(OVERLAP)));
await mp.screenshot({ path: 'shots/v3-mobile-race.png' });
// 窄屏 320x568 再测一次重叠
await mp.setViewport({ width: 320, height: 568, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await wait(1200);
console.log('small 320x568 buttons/overlap:', JSON.stringify(await mp.evaluate(OVERLAP)));
await mp.screenshot({ path: 'shots/v3-small-race.png' });
console.log('mobile errors:', merr.length ? merr.slice(0, 8).join(' | ') : 'none');
await browser.close();
console.log('DONE');