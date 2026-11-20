# CLAUDE.md — 《折纸奇旅：Origami GP》全面工程架构与复刻级开发规范

本项目使用 **Vite + React + TypeScript + Three.js** 构建一款本地可运行的 3D 折纸立体书风格竞速 Web 应用。目标是**在渲染质感、立体书动效、驾驶手感与 UI 交互上达到 1:1 复刻级水准，同时在角色、赛道、道具与核心玩法上保持 100% 原创**。

**参考视觉与交互基准**：

* 原作参考视频：https://www.douyin.com/video/7693029509544676671 （分享短链：https://v.douyin.com/3A64-pcf9xQ/ ）

* 说明：请重点参考视频中的立体书沿途展开节奏、暖色调微缩纸艺光影、4 步配置卡片布局与 3 圈竞速 HUD 氛围；若无法直接抓取或观看视频画面，请结合用户提供的参考截图对齐视觉细节，并严格使用本文档中的原创角色、赛道与道具设定（严禁照搬原视频名称与文案）。

**执行边界**：现阶段仅在本地完成全部开发、调试与构建验收，**不要执行 `git push` 推送到 GitHub，也不要执行任何公网部署操作**。

## 一、核心原则：复刻质感 vs 原创内容

| 维度 | 1:1 还原的底层体验与视觉标准 | 100% 原创的差异化设计 | 
| ----- | ----- | ----- | 
| **立体书奇观** | 赛车行驶时，路边花草树木与建筑从地面实时折叠展开 | 升级为 **3 级父子关节延迟展开**（底座翻起 → 主干立起 → 树冠/花瓣/风车依次弹开） | 
| **微缩模型质感** | 哑光纸张纤维肌理、折痕边缘线稿、柔和接触阴影、微缩景深 | 使用**手账网格纸 + 牛皮纸 + 瓦楞卡纸 + 水彩纸**程序化纹理体系 | 
| **赛前 4 步流程** | `1 模式` → `2 纸张` → `3 选车手` → `4 选赛道` + 右上角设置/说明 | 第 2 步“纸张克重”直接影响物理手感（80g 宣纸 / 180g 道林纸 / 320g 瓦楞卡纸） | 
| **车手与数值** | 8 名造型鲜明的车手 + 五维属性（速度/加速/操控/重量/越野） | 8 名原创折纸动物/纸模车手，第 3 步配备**专属 3D 旋转展示台** | 
| **赛道与章节** | 4 个奇幻主题章节、3 圈 8 人竞速、左下角小地图、“？”道具箱 | 原创 4 条赛道与纸艺道具（**透明胶带护盾**、**纸飞机冲刺**、**双面胶陷阱**、**折纸回旋镖**） | 

## 二、技术栈与模块化目录结构

### 1. 依赖清单

* **核心**：`vite`、`typescript`、`react`、`react-dom`

* **3D 与后处理**：`three`、`@types/three`、`n8ao`（推荐，轻量高性能 SSAO）或 `three/examples/jsm/postprocessing/*`（`EffectComposer`、`RenderPass`、`SSAOPass`、`UnrealBloomPass`、`OutputPass`）

* **状态与样式**：`zustand`、`tailwindcss`、`lucide-react`

### 2. 目录结构

```
origami-gp/
├── CLAUDE.md
├── package.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── store/
    │   └── gameStore.ts            # 全局配置、比赛状态、设置项、Ghost 数据
    ├── data/
    │   ├── papers.ts               # 3 种纸张克重物理倍率
    │   ├── racers.ts               # 8 名原创车手配色、五维数值、特征部件类型
    │   └── tracks.ts               # 4 条赛道样条控制点、精确 Hex 配色、专属景物类型
    ├── engine/
    │   ├── SceneManager.ts         # 渲染器、ACESFilmic、2048软阴影、EffectComposer 后处理
    │   ├── CameraRig.ts            # 大厅绕飞、选人特写、局内弹簧阻尼跟随 + 动态 FOV
    │   └── AudioEngine.ts          # Web Audio API 合成（引擎音、纸张沙沙声、漂移、道具、倒计时）
    ├── materials/
    │   ├── PaperTextures.ts        # Offscreen Canvas 生成纸张凹凸图、手账网格图、棋盘格起跑线
    │   └── PaperMaterial.ts        # 哑光 PBR 材质工厂 + EdgesGeometry 折痕描边工厂
    ├── models/
    │   ├── CarBuilder.ts           # 多面体折纸赛车 + 车手动物头部/耳朵/翅膀/帆分件组装
    │   ├── PopupPropBuilder.ts     # 3 级关节立体书景物（松树、风车、花朵、灯笼、冰晶、文具）
    │   └── EnvironmentBuilder.ts   # 远景折纸群山、飘浮折纸云朵、起跑拱门
    ├── tracks/
    │   └── TrackBuilder.ts         # 闭合样条赛道、红白路肩、起跑线、发光加速带、道具箱
    ├── gameplay/
    │   ├── PhysicsSystem.ts        # 加速/极速、二段蓄力漂移（Mini-Turbo）、碰撞、越野减速
    │   ├── AIController.ts         # 7 名 AI 沿样条寻路、横向避让、道具使用
    │   ├── GhostRecorder.ts        # 计时挑战幽灵车位置/朝向录制与半透明回放
    │   └── ParticleSystem.ts       # 漂移彩纸屑、加速尾焰、碰撞纸片
    └── ui/
        ├── LobbyOverlay.tsx        # 手账卡片式 4 步配置大厅（透明背景露出 3D 场景）
        ├── RaceHUD.tsx             # 四角锚点 HUD + 左下角 Canvas 实时小地图 + 道具轮盘动画
        ├── TouchControls.tsx       # 触屏虚拟方向与油门/漂移/道具按钮
        └── Modals.tsx              # 操作说明、设置（阴影/SSAO/触屏开关）、完赛结算榜

```

## 三、视觉与渲染精确参数（消除“塑料感”与“粗糙方块感”）

### 1. 灯光与色调映射（`SceneManager.ts`）

* **Renderer**：`antialias: true`，`pixelRatio: Math.min(window.devicePixelRatio, 2)`，`toneMapping: THREE.ACESFilmicToneMapping`，`toneMappingExposure: 1.02`，`shadowMap.enabled = true`，`shadowMap.type = THREE.PCFSoftShadowMap`。

* **主方向光**：色温 `#fff3dc`，强度 `0.85`，阴影贴图 `2048 x 2048`，`shadow.bias = -0.0005`，`shadow.normalBias = 0.02`（彻底消除纸片表面的阴影条纹），阴影相机跟随玩家车辆移动。

* **半球光**：天空色 `#fffaf0`，地面反弹色 `#a89984`，强度 `0.62`（**严禁高于 0.75，防止地面过曝发白**）。

* **后处理管线**：接入 `N8AO`（或 `SSAOPass`），`aoRadius: 1.6`、`intensity: 1.35`，让折纸与地面接缝、树冠折角处自然产生暗角。设置界面提供“高画质后处理”开关以兼容低配设备。

### 2. 纸张材质与折痕描边（`PaperMaterial.ts`）

* **材质参数**：`MeshStandardMaterial`，`roughness: 0.90`，`metalness: 0.0`，`flatShading: true`，`bumpMap: paperFiberTex`，`bumpScale: 0.055`。

* **折痕描边**：所有折纸模型必须调用 `addOrigamiEdges(mesh, threshold = 22)`，使用 `THREE.EdgesGeometry` 叠加 `LineBasicMaterial({ color: 0x3b2f27, transparent: true, opacity: 0.42 })`。

### 3. 3D 相机参数（`CameraRig.ts`）

* **局内跟随**：相机位于车后 `12.5`、上方 `6.8`，注视车前方 `7.5`、高度 `1.4`；位置采用指数平滑 `1 - Math.exp(-9 * dt)`，转向略微滞后以体现动感。

* **动态速度感 FOV**：基础 `FOV = 52`，随车速线性拉宽至 `64`，触发纸飞机冲刺或加速带时瞬间拉宽至 `70`。

* **第 3 步选车手特写**：平滑拉近到展示台前方 `(0, 4.2, 9.5)`，FOV 收窄至 `45`，让玩家看清车手和车体的折纸细节。

## 四、建模与立体书动画规范

### 1. 折纸赛车与车手分件组装（`CarBuilder.ts`）

每辆车由 `TiltGroup`（负责漂移与过弯侧倾）包裹以下 6 个可见分件：

1. **多面折纸底盘**：前低后高的楔形/多边形组合，带底部阴影托盘。

2. **尖锐导流鼻翼**：四棱锥折纸车头 + 两侧小定风翼。

3. **独立折纸尾翼**：双立柱支撑 + 倾斜纸片翼面。

4. **4 个独立车轮**：八边形纸轮毂，随车速自转，前轮随转向角偏转（`±0.35 rad`）。

5. **驾驶舱与车手角色**：半开放驾驶舱内坐着可辨识的折纸车手头部，并按 `earType` 装配特征折纸配件（狐狸尖耳、兔子长耳、纸鹤双翼、纸船风帆、熊圆耳）。

6. **状态挂载**：透明胶带护盾开启时外围出现旋转的半透明多面体线框罩。

### 2. 3 级关节立体书展开（`PopupPropBuilder.ts`）

* 每个路边景物由 `RootPivot`（地面 `y = 0`）→ `BodyGroup` → `TopGroup` 三层构成。

* 初始状态：`RootPivot.rotation.x = -Math.PI / 2`（贴地平躺），`TopGroup.scale.set(0.01, 0.01, 0.01)`。

* 触发条件：距离玩家车辆小于 `58` 单位时激活，按时间轴推进：

  * `0.00s ~ 0.35s`：`RootPivot` 使用 `easeOutBack` 从 `-90°` 弹起到 `0°`；

  * `0.15s ~ 0.55s`：`TopGroup`（树冠、风车叶片、花瓣）使用 `easeOutBack` 弹开到 `1.0`；

  * 触发瞬间播放轻柔的纸张翻折沙沙声（做好并发节流，100ms 内最多触发 1 次音效避免吵闹）。

## 五、原创数值与 4 条赛道精确配色表

### 1. 赛道精确配色（Hex 色值锁死，确保道路与草地对比鲜明）

| 赛道名称 | 天空/雾色 | 地面底色 | 赛道本体 | 路肩颜色 | 远景纸山 | 专属立体书景物 | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| **1. 晨露手账草甸** | `#dbeee4` | `#8eb87a` | `#faf3e3` | `#e05a47` / `#fffdf8` | `#9dc09d` | 三层折纸松树、旋转纸风车、彩色纸花丛 | 
| **2. 霓虹瓦楞夜巷** | `#161e30` | `#222c42` | `#444e66` | `#e07a5f` / `#ffd166` | `#2b3752` | 暖黄自发光纸灯笼塔、夜色折纸屋檐 | 
| **3. 冰霜信封峡谷** | `#d6ebf5` | `#a9d0e5` | `#ffffff` | `#4b8ab0` / `#d8f3dc` | `#8bbbd6` | 半透明感折纸冰晶簇、银白信封山脊 | 
| **4. 午后木质书桌** | `#f4e3cc` | `#c79a6b` | `#fcf8ef` | `#c86d51` / `#f4d35e` | `#b08154` | 立起的彩色便利贴森林、折纸铅笔与橡皮 | 

### 2. 漂移与道具机制（`PhysicsSystem.ts`）

* **二段蓄力漂移**：按住 `Shift / Space` 并转向进入漂移状态，车身向弯心侧倾，车尾喷出彩色纸屑；持续漂移 `0.8s` 变为蓝色火花、持续 `1.6s` 变为金色火花，松开漂移键立即获得 `0.7s ~ 1.2s` 的小涡轮加速（Mini-Turbo）。

* **4 种原创纸艺道具**：

  * `透明胶带护盾`：5 秒免疫碰撞与双面胶减速；

  * `纸飞机冲刺`：2.4 秒大幅加速并伴随纸屑尾迹；

  * `双面胶陷阱`：在车后贴出一块黄色粘性纸垫，踩中者减速 2 秒；

  * `折纸回旋镖`：向前方发射旋转折纸镖，击中前方对手使其打滑减速 1.5 秒。

## 六、分阶段开发与本地验收协议

Claude Code 必须按以下 5 个阶段顺序实现，**每完成一个阶段必须在本地运行 `npm run build` 检查类型错误，并启动 `npm run dev` 用浏览器/Playwright 截图检查实际画面无黑屏、无过曝、无穿模后再进入下一阶段**：

1. **Stage 1 — 渲染底座与材质系统**：搭好 Vite + TS + Three.js + N8AO 后处理，验证单色块测试场景阴影正常、不发白。

2. **Stage 2 — 赛道与立体书景物**：完成 `TrackBuilder`（含棋盘格起跑线、红白路肩、加速带）与 `PopupPropBuilder`（3 级关节展开动画）。

3. **Stage 3 — 折纸车建模与手感**：完成 8 辆车建模，打通二段漂移、动态 FOV 相机与纸屑粒子。

4. **Stage 4 — AI、幽灵车、道具与音效**：实现 7 名 AI 竞速、计时赛 Ghost 回放、4 种道具与 Web Audio 音效。

5. **Stage 5 — 4 步手账 UI 与本地终验**：完成 React 透明悬浮大厅、第 3 步 3D 展台特写、四角 HUD 与左下角小地图、触屏按键；最终执行 `npm run build` 与 `npm run preview` 完成全流程试玩验收。
---

## 七、核心代码架构与参考骨架（TypeScript）

以下核心接口与关键模块骨架用于锁定渲染质感、折纸描边、3 级立体书展开与二段漂移手感，请严格在此骨架基础上扩展完整实现。

### 1. 核心类型定义（`src/types/game.ts`）
```ts
import * as THREE from 'three';

export interface PaperSpec {
  id: 'light' | 'medium' | 'heavy';
  name: string;
  weightGrams: number;
  accelMul: number;
  speedMul: number;
  steerMul: number;
  weightMul: number;
}

export interface RacerSpec {
  id: string;
  name: string;
  earType: 'wing' | 'fox' | 'bear' | 'sail' | 'box' | 'rabbit';
  primaryColor: number;
  accentColor: number;
  stats: { speed: number; accel: number; steer: number; weight: number; offroad: number };
}

export interface PopupPropRig {
  rootPivot: THREE.Group;     // 地面枢轴 y = 0，初始 rotation.x = -Math.PI / 2
  topGroup: THREE.Group;      // 树冠/花瓣/风车叶片，初始 scale = 0.01
  spinner?: THREE.Object3D;   // 可选持续旋转部件（如风车叶）
  popped: boolean;
  elapsed: number;            // 展开计时器
}

export interface CarRuntimeState {
  id: string;
  isPlayer: boolean;
  racer: RacerSpec;
  paper: PaperSpec;
  root: THREE.Group;
  tiltGroup: THREE.Group;
  wheels: THREE.Object3D[];
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  roll: number;
  driftDir: -1 | 0 | 1;
  driftCharge: number;        // 0.8s 蓝火，1.6s 金火
  boostTimer: number;
  shieldTimer: number;
  slowTimer: number;
  lap: number;
  lastT: number;
  progress: number;
  finished: boolean;
  finishTime: number;
}
```

### 2. 纸张材质与折痕描边工厂（`src/materials/PaperMaterial.ts`）
```ts
import * as THREE from 'three';

const SHARED_EDGE_MAT = new THREE.LineBasicMaterial({
  color: 0x3b2f27,
  transparent: true,
  opacity: 0.42,
});

export function createPaperMaterial(
  color: number,
  bumpMap: THREE.Texture,
  roughness = 0.9
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.0,
    flatShading: true,
    bumpMap,
    bumpScale: 0.055,
  });
}

export function attachOrigamiEdges(mesh: THREE.Mesh, thresholdAngle = 22): THREE.Mesh {
  const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
  const line = new THREE.LineSegments(edges, SHARED_EDGE_MAT);
  mesh.add(line);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
```

### 3. 3 级关节立体书展开控制器（`src/models/PopupPropBuilder.ts`）
```ts
import * as THREE from 'three';
import { PopupPropRig } from '../types/game';

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function updatePopupProps(
  props: PopupPropRig[],
  playerPos: THREE.Vector3,
  dt: number,
  onPop?: () => void
): void {
  let playedThisFrame = false;
  for (const prop of props) {
    if (!prop.popped && playerPos.distanceTo(prop.rootPivot.position) < 58) {
      prop.popped = true;
      if (!playedThisFrame && onPop) {
        onPop();
        playedThisFrame = true;
      }
    }
    if (prop.popped && prop.elapsed < 0.6) {
      prop.elapsed = Math.min(0.6, prop.elapsed + dt);
      const tBase = Math.min(1, prop.elapsed / 0.35);
      const eBase = easeOutBack(tBase);
      prop.rootPivot.rotation.x = (-Math.PI / 2) * (1 - eBase);

      const tTop = Math.max(0, Math.min(1, (prop.elapsed - 0.15) / 0.4));
      const sTop = Math.max(0.01, easeOutBack(tTop));
      prop.topGroup.scale.set(sTop, sTop, sTop);
    }
    if (prop.popped && prop.spinner) {
      prop.spinner.rotation.z += dt * 2.2;
    }
  }
}
```

### 4. 渲染与 N8AO 后处理底座（`src/engine/SceneManager.ts`）
```ts
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { N8AOPass } from 'n8ao';

export function createScenePipeline(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const n8aoPass = new N8AOPass(scene, camera, window.innerWidth, window.innerHeight);
  n8aoPass.configuration.aoRadius = 1.6;
  n8aoPass.configuration.intensity = 1.35;
  composer.addPass(n8aoPass);
  composer.addPass(new OutputPass());

  return { renderer, composer, n8aoPass };
}
```

### 5. 二段蓄力漂移与纸张克重物理骨架（`src/gameplay/PhysicsSystem.ts`）
```ts
import { CarRuntimeState } from '../types/game';

export interface PlayerInput {
  throttle: number; // -1 ~ 1
  steer: number;    // -1 ~ 1
  drift: boolean;
}

export function stepCarPhysics(car: CarRuntimeState, input: PlayerInput, dt: number): void {
  const s = car.racer.stats;
  const boostMul = car.boostTimer > 0 ? 1.42 : 1.0;
  const slowMul = car.slowTimer > 0 ? 0.52 : 1.0;
  const maxSpeed = (36 + s.speed * 0.18) * car.paper.speedMul * boostMul * slowMul;
  const accel = (23 + s.accel * 0.16) * car.paper.accelMul;
  const steerRate = (1.8 + s.steer * 0.011) * car.paper.steerMul;

  if (input.throttle > 0) car.speed += accel * input.throttle * dt;
  else if (input.throttle < 0) car.speed += accel * 1.15 * input.throttle * dt;
  else car.speed *= Math.pow(0.25, dt);

  car.speed = Math.max(-14, Math.min(maxSpeed, car.speed));

  // 二段蓄力漂移状态机
  if (input.drift && Math.abs(car.speed) > 16 && input.steer !== 0) {
    if (car.driftDir === 0) car.driftDir = input.steer > 0 ? 1 : -1;
    car.driftCharge += dt;
  } else {
    if (car.driftCharge >= 1.6) car.boostTimer = Math.max(car.boostTimer, 1.2);
    else if (car.driftCharge >= 0.8) car.boostTimer = Math.max(car.boostTimer, 0.7);
    car.driftDir = 0;
    car.driftCharge = 0;
  }

  const turnMul = car.driftDir !== 0 ? 1.35 : 1.0;
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.heading += input.steer * steerRate * turnMul * dirSign * Math.min(1, Math.abs(car.speed) / 8) * dt;

  const targetRoll = -input.steer * (car.driftDir !== 0 ? 0.24 : 0.14);
  car.roll += (targetRoll - car.roll) * 10 * dt;
  car.tiltGroup.rotation.z = car.roll;

  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  car.root.position.copy(car.pos);
  car.root.rotation.y = car.heading;
}
```
