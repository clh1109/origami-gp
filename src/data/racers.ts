import type { RacerSpec } from '../types/game';

/** 8 名原创折纸动物 / 纸模车手，五维属性（0~100） */
export const RACERS: RacerSpec[] = [
  {
    id: 'fox',
    name: '折狐·焰',
    title: '尖耳的弯道猎手',
    earType: 'fox',
    primaryColor: 0xe05a47,
    accentColor: 0xffd166,
    stats: { speed: 78, accel: 70, steer: 66, weight: 52, offroad: 48 },
  },
  {
    id: 'rabbit',
    name: '纸兔·跃',
    title: '长耳的起步闪电',
    earType: 'rabbit',
    primaryColor: 0xfffdf8,
    accentColor: 0xf4a6b8,
    stats: { speed: 66, accel: 84, steer: 80, weight: 40, offroad: 56 },
  },
  {
    id: 'crane',
    name: '千鹤·翔',
    title: '双翼的滑翔诗人',
    earType: 'wing',
    primaryColor: 0xf5f7fa,
    accentColor: 0x4b8ab0,
    stats: { speed: 72, accel: 66, steer: 74, weight: 46, offroad: 62 },
  },
  {
    id: 'bear',
    name: '憨熊·墩',
    title: '圆耳的重装堡垒',
    earType: 'bear',
    primaryColor: 0xb08154,
    accentColor: 0xf4e3cc,
    stats: { speed: 62, accel: 58, steer: 52, weight: 90, offroad: 70 },
  },
  {
    id: 'boat',
    name: '帆舟·浪',
    title: '风帆的越野水手',
    earType: 'sail',
    primaryColor: 0x4b8ab0,
    accentColor: 0xffd166,
    stats: { speed: 70, accel: 62, steer: 60, weight: 68, offroad: 78 },
  },
  {
    id: 'box',
    name: '方盒·灵',
    title: '纸盒的全能匠人',
    earType: 'box',
    primaryColor: 0x8eb87a,
    accentColor: 0xfaf3e3,
    stats: { speed: 64, accel: 72, steer: 68, weight: 60, offroad: 60 },
  },
  {
    id: 'cat',
    name: '玄猫·影',
    title: '夜行的极速刺客',
    earType: 'fox',
    primaryColor: 0x3b2f27,
    accentColor: 0xe07a5f,
    stats: { speed: 84, accel: 74, steer: 62, weight: 48, offroad: 42 },
  },
  {
    id: 'owl',
    name: '雪鸮·霜',
    title: '霜翼的操控大师',
    earType: 'wing',
    primaryColor: 0xd8f3dc,
    accentColor: 0x8bbbd6,
    stats: { speed: 68, accel: 68, steer: 78, weight: 50, offroad: 66 },
  },
];

export function getRacer(id: string): RacerSpec {
  return RACERS.find((r) => r.id === id) ?? RACERS[0];
}

export const STAT_LABELS: { key: keyof RacerSpec['stats']; label: string }[] = [
  { key: 'speed', label: '速度' },
  { key: 'accel', label: '加速' },
  { key: 'steer', label: '操控' },
  { key: 'weight', label: '重量' },
  { key: 'offroad', label: '越野' },
];