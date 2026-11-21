import type { TrackSpec } from '../types/game';

/** 4 条原创赛道（高对比明快绘本配色） */
export const TRACKS: TrackSpec[] = [
  {
    id: 'meadow',
    name: '雏菊草甸',
    subtitle: '春日清晨, 风车与溪流',
    theme: 'meadow',
    colors: {
      sky: 0xbce6ff,
      ground: 0x8fd16a,
      road: 0xc2a887,
      curbA: 0xe85242,
      curbB: 0xfffcf5,
      mountain: 0x7ec99b,
    },
    points: [
      [0, 0.0, -52],     // 起跑直道
      [0, 0.0, 0],       // ★ 下层立交通道（从头顶 12.5m 木直尺桥正下方穿过）
      [14, 0.2, 54],     // 穿出立交进入右侧大环
      [70, 0.8, 72],     // 右下大弯
      [108, 1.2, 22],    // ★ 奇观 2：25 米巨型敞开牛皮纸信封隧道
      [96, 4.8, -32],    // 冲出信封开始爬坡（跨越桥下蓝溪）
      [54, 10.6, -24],   // 爬上木直尺高架引桥
      [0, 12.5, 0],      // ★ 奇观 1：60 米刻度木头直尺高架桥顶（飞跃下层赛道！）
      [-54, 10.6, 24],   // 驶下木直尺引桥
      [-96, 4.8, 32],    // 俯冲进入左侧大环
      [-108, 1.2, -24],  // ★ 奇观 3：堆叠巨型精装书大峡谷
      [-70, 0.6, -72],   // 绕出书本峡谷大弯
      [-24, 0.0, -68],   // 回正冲线直道
    ],
    width: 24,
    laps: 3,
    boostT: [0.12, 0.46, 0.78],
    itemT: [0.3, 0.62, 0.9],
    fogNear: 170,
    fogFar: 520,
  },
  {
    id: 'twilight',
    name: '暮色纸镇',
    subtitle: '晚霞微醺, 夕阳与星空',
    theme: 'neon',
    colors: {
      sky: 0x2c3b63,
      ground: 0x242e44,
      road: 0x525e7a,
      curbA: 0xe05a47,
      curbB: 0xfffdf8,
      mountain: 0x384870,
    },
    points: [
      [0, 0, -60],
      [40, 1.6, -55],
      [60, 3.8, -25],
      [35, 5.2, -5],
      [55, 3.0, 20],
      [30, 1.0, 50],
      [-10, 0.4, 45],
      [-35, 2.4, 60],
      [-60, 4.6, 35],
      [-45, 5.4, 5],
      [-65, 2.6, -25],
      [-35, 0.6, -50],
    ],
    width: 22,
    laps: 3,
    boostT: [0.2, 0.55, 0.85],
    itemT: [0.36, 0.7, 0.95],
    fogNear: 110,
    fogFar: 380,
  },
  {
    id: 'frost',
    name: '冰霜信封峡谷',
    subtitle: '第三章 · 水彩纸的寒冬',
    theme: 'frost',
    colors: {
      sky: 0xc8ebff,
      ground: 0xbde2f5,
      road: 0x8eaec4,
      curbA: 0x4b8ab0,
      curbB: 0xf7fcff,
      mountain: 0x8bbbd6,
    },
    points: [
      [0, 0, -80],
      [60, 1.4, -70],
      [85, 3.6, -30],
      [60, 5.6, 0],
      [80, 4.2, 35],
      [40, 1.8, 70],
      [-10, 0.5, 60],
      [-50, 2.6, 75],
      [-80, 5.0, 40],
      [-60, 6.0, 0],
      [-80, 3.2, -40],
      [-40, 0.8, -70],
    ],
    width: 24,
    laps: 3,
    boostT: [0.16, 0.5, 0.82],
    itemT: [0.32, 0.66, 0.92],
    fogNear: 160,
    fogFar: 480,
  },
  {
    id: 'desk',
    name: '午后木质书桌',
    subtitle: '第四章 · 牛皮纸的午后',
    theme: 'desk',
    colors: {
      sky: 0xf7e7ce,
      ground: 0xd1a777,
      road: 0x9c8268,
      curbA: 0xc86d51,
      curbB: 0xf4d35e,
      mountain: 0xb08154,
    },
    points: [
      [0, 0, -65],
      [45, 1.0, -60],
      [70, 2.8, -30],
      [50, 4.2, -5],
      [70, 2.6, 25],
      [35, 0.8, 55],
      [-5, 0.3, 45],
      [-40, 1.8, 60],
      [-70, 3.6, 30],
      [-50, 4.0, -5],
      [-70, 2.2, -35],
      [-30, 0.6, -60],
    ],
    width: 23,
    laps: 3,
    boostT: [0.14, 0.48, 0.8],
    itemT: [0.3, 0.64, 0.9],
    fogNear: 160,
    fogFar: 480,
  },
];

export function getTrack(id: string): TrackSpec {
  return (
    TRACKS.find(
      (t) => t.id === id || (id === 'nightmarket' && t.id === 'twilight') || (id === 'neon' && t.id === 'twilight')
    ) ?? TRACKS[0]
  );
}
