import * as THREE from 'three';

// ============ 纸张克重 ============
export type PaperId = 'light' | 'medium' | 'heavy';

export interface PaperSpec {
  id: PaperId;
  name: string;
  weightGrams: number;
  desc: string;
  accelMul: number;
  speedMul: number;
  steerMul: number;
  weightMul: number;
  swatch: number;
}

// ============ 车手 ============
export type EarType = 'wing' | 'fox' | 'bear' | 'sail' | 'box' | 'rabbit';

export interface RacerSpec {
  id: string;
  name: string;
  title: string;
  earType: EarType;
  primaryColor: number;
  accentColor: number;
  stats: { speed: number; accel: number; steer: number; weight: number; offroad: number };
}

// ============ 赛道 ============
export type PropTheme = 'meadow' | 'neon' | 'frost' | 'desk';

export interface TrackColors {
  sky: number;
  ground: number;
  road: number;
  curbA: number;
  curbB: number;
  mountain: number;
}

export interface TrackSpec {
  id: string;
  name: string;
  subtitle: string;
  theme: PropTheme;
  colors: TrackColors;
  /** 闭合样条控制点 (x, y, z) */
  points: [number, number, number][];
  width: number;
  laps: number;
  /** 加速带在样条上的参数位置 0~1 */
  boostT: number[];
  /** 道具箱排布参数位置 0~1 */
  itemT: number[];
  fogNear: number;
  fogFar: number;
}

// ============ 立体书景物 3 级关节 ============
export interface PopupPropRig {
  rootPivot: THREE.Group; // 地面枢轴 y = 0，初始 rotation.x = -Math.PI / 2
  bodyGroup: THREE.Group; // 主干
  topGroup: THREE.Group; // 树冠/花瓣/风车叶片，初始 scale = 0.01
  spinner?: THREE.Object3D; // 可选持续旋转部件（如风车叶）
  popped: boolean;
  elapsed: number; // 展开计时器
  swayPhase: number; // 展开后轻微摆动相位
  baseY: number;
}

// ============ 道具 ============
export type ItemType = 'shield' | 'boost' | 'trap' | 'boomerang';

export interface ItemMeta {
  id: ItemType;
  name: string;
  desc: string;
  color: number;
  icon: string;
}

// ============ 车辆运行时状态 ============
export interface CarRuntimeState {
  id: string;
  isPlayer: boolean;
  isGhost: boolean;
  racer: RacerSpec;
  paper: PaperSpec;
  root: THREE.Group;
  tiltGroup: THREE.Group;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  shieldMesh?: THREE.Object3D;
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  roll: number;
  pitch: number;
  driftDir: -1 | 0 | 1;
  driftCharge: number; // 0.8s 蓝火，1.6s 金火
  boostTimer: number;
  shieldTimer: number;
  slowTimer: number;
  spinTimer: number; // 回旋镖打滑
  lap: number;
  lastT: number;
  nearestT: number;
  progress: number;
  finished: boolean;
  finishTime: number;
  offroad: boolean;
  heldItem: ItemType | null;
  rouletteTimer: number; // 道具轮盘动画计时
  wheelSpin: number;
  steerVisual: number;
  // AI
  aiSkill: number;
  aiOffset: number;
  aiTargetOffset: number;
  aiItemCooldown: number;
  aiDriftTimer: number;
  // 计时
  lapStart: number;
  bestLap: number;
  lapTimes: number[];
  place: number;
}

// ============ 输入 ============
export interface PlayerInput {
  throttle: number; // -1 ~ 1
  steer: number; // -1 ~ 1
  drift: boolean;
}

// ============ 幽灵车 ============
export interface GhostFrame {
  t: number; // 比赛时间
  x: number;
  y: number;
  z: number;
  heading: number;
  roll: number;
}

export interface GhostData {
  trackId: string;
  racerId: string;
  paperId: PaperId;
  totalTime: number;
  frames: GhostFrame[];
}

// ============ 场上实体 ============
export interface TrapEntity {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  owner: string;
  life: number;
  armed: number;
}

export interface BoomerangEntity {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  owner: string;
  life: number;
  speed: number;
}

export interface ItemBoxEntity {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  t: number;
  respawn: number;
  active: boolean;
}

export interface BoostPadEntity {
  mesh: THREE.Object3D;
  t: number;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
}

// ============ 游戏流程 ============
export type GameMode = 'grandprix' | 'timetrial';
export type GamePhase = 'lobby' | 'countdown' | 'racing' | 'finished';
export type LobbyStep = 1 | 2 | 3 | 4;

export interface Settings {
  shadows: boolean;
  highQuality: boolean; // N8AO 后处理
  touch: boolean; // 触屏按键
  volume: number; // 0~1
  muted: boolean;
  cameraShake: boolean;
  showGhost: boolean;
}

export interface RacerResult {
  id: string;
  name: string;
  racerId: string;
  isPlayer: boolean;
  place: number;
  totalTime: number;
  bestLap: number;
  finished: boolean;
  color: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  countdown: number; // 3,2,1,0(GO)
  speed: number; // 显示用 km/h
  lap: number;
  totalLaps: number;
  place: number;
  totalRacers: number;
  heldItem: ItemType | null;
  roulette: boolean;
  driftCharge: number;
  driftTier: 0 | 1 | 2;
  boost: boolean;
  shield: boolean;
  slow: boolean;
  raceTime: number;
  currentLapTime: number;
  bestLap: number;
  lastLap: number;
  offroad: boolean;
  wrongWay: boolean;
}

export interface MinimapCar {
  x: number;
  z: number;
  heading: number;
  color: number;
  isPlayer: boolean;
  isGhost: boolean;
}

export interface MinimapData {
  outline: [number, number][];
  cars: MinimapCar[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  playerT: number;
}