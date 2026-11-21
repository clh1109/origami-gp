// 视觉重构验收：node scripts/verify2.mjs
// 无头 GPU 较慢，用同步物理仿真推进比赛时间，在关键节点恢复渲染截图。
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:5173';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--mute-audio', '--window-size=1280,800',
  ],
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: 'shots/' + name }); console.log('shot', name); };
const ev = (code) => page.evaluate(code);

// 同步仿真：停渲染推进 gameSec 秒物理，返回采样统计
const SIM = (gameSec) => `(() => {
  const e = window.__engine;
  const orig = e.sm.render;
  e.sm.render = () => {};
  const s = [];
  const steps = Math.round(${gameSec} * 60);
  for (let i = 0; i < steps; i++) {
    e.update(1 / 60);
    if (i % 12 === 0 && e.player) s.push([+e.player.pos.y.toFixed(2), +(e.player.root.userData.slopePitch || 0).toFixed(3), e.player.offroad ? 1 : 0]);
    if (e.phase === 'finished') break;
  }
  delete e.sm.render;
  const ys = s.map(x => x[0]);
  return {
    phase: e.phase, raceTime: +e.raceTime.toFixed(1), lap: e.player && e.player.lap,
    place: e.player && e.player.place, speed: e.player && +e.player.speed.toFixed(1),
    maxY: Math.max(...ys), minY: Math.min(...ys),
    maxPitch: Math.max(...s.map(x => Math.abs(x[1]))),
    offFrames: s.filter(x => x[2]).length, frames: s.length,
    y: e.player && +e.player.pos.y.toFixed(2), t: e.player && +e.player.nearestT.toFixed(2),
  };
})()`;

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForSelector('canvas', { timeout: 30000 });
await wait(6000);
await shot('v2-lobby1.png');

// 大厅第 3 步特写
await ev('window.__store.getState().setLobbyStep(3)');
await wait(3000);
await shot('v2-showcase.png');
await ev('window.__store.getState().setLobbyStep(1)');
await wait(800);

// 起步 → 仿真 10s（第一段坡道）
await ev('window.__engine.autopilot = true; window.__store.getState().setResults([]); window.__engine.startRace(window.__store.getState().config);');
console.log('race-10s', JSON.stringify(await ev(SIM(10))));
await wait(1500);
await shot('v2-race-slope.png');

// 仿真到完赛
console.log('race-finish', JSON.stringify(await ev(SIM(240))));
await wait(2000);
await shot('v2-results.png');

// 重开一局验证 restart 不叠循环
await ev('window.__engine.restart();');
console.log('restart', JSON.stringify(await ev(SIM(6))));
await wait(1200);
await shot('v2-restart.png');

// 回大厅换霓虹夜巷
await ev('window.__engine.enterLobby(window.__store.getState().config, 1);');
await wait(600);
await ev('window.__store.getState().setConfig({ trackId: "neon" });');
await wait(3500);
await shot('v2-neon-lobby.png');
await ev('window.__store.getState().setResults([]); window.__engine.startRace(window.__store.getState().config);');
console.log('neon-8s', JSON.stringify(await ev(SIM(8))));
await wait(1500);
await shot('v2-neon-race.png');

// 冰霜 / 书桌 大厅
await ev('window.__engine.enterLobby(window.__store.getState().config, 1);');
await wait(400);
await ev('window.__store.getState().setConfig({ trackId: "frost" });');
await wait(3000);
await shot('v2-frost-lobby.png');
await ev('window.__store.getState().setConfig({ trackId: "desk" });');
await wait(3000);
await shot('v2-desk-lobby.png');

console.log('desktop errors:', errors.length ? errors.slice(0, 10).join(' | ') : 'none');
await page.close();

// 移动端视口
const mp = await browser.newPage();
const merr = [];
mp.on('console', (m) => { if (m.type() === 'error') merr.push(m.text()); });
mp.on('pageerror', (e) => merr.push(e.message));
await mp.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await mp.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await mp.waitForSelector('canvas');
await wait(5000);
await mp.screenshot({ path: 'shots/v2-mobile-lobby.png' });
console.log('shot v2-mobile-lobby.png');
await mp.evaluate('window.__store.getState().setSettings ? window.__store.getState().setSettings({ ...window.__store.getState().settings, touch: true }) : window.__store.setState({ settings: { ...window.__store.getState().settings, touch: true } });');
await mp.evaluate('window.__engine.autopilot = true; window.__store.getState().setResults([]); window.__engine.startRace(window.__store.getState().config);');
await mp.evaluate(`(() => { const e = window.__engine; e.sm.render = () => {}; for (let i = 0; i < 360; i++) e.update(1 / 60); delete e.sm.render; })()`);
await wait(1500);
await mp.screenshot({ path: 'shots/v2-mobile-race.png' });
console.log('shot v2-mobile-race.png');
console.log('mobile errors:', merr.length ? merr.slice(0, 10).join(' | ') : 'none');

fs.writeFileSync('shots/v2-verify.log.txt', [...errors, ...merr].join('\n') || 'no console errors');
await browser.close();
console.log('DONE');