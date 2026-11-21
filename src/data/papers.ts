import type { PaperSpec } from '../types/game';

/** 3 种纸张克重：克重直接影响物理手感 (1:1 对标原视频 80g / 120g / 200g 设定) */
export const PAPERS: PaperSpec[] = [
  {
    id: 'light',
    name: '薄纸',
    weightGrams: 80,
    desc: '速度舒适，适合熟悉赛道。',
    accelMul: 1.16,
    speedMul: 0.94,
    steerMul: 1.12,
    weightMul: 0.72,
    swatch: 0xf7f3ea,
  },
  {
    id: 'medium',
    name: '笔记纸',
    weightGrams: 120,
    desc: '速度升级，开始真正的较量。',
    accelMul: 1.0,
    speedMul: 1.0,
    steerMul: 1.0,
    weightMul: 1.0,
    swatch: 0xfaf3e3,
  },
  {
    id: 'heavy',
    name: '硬纸板',
    weightGrams: 200,
    desc: '极限挑战，考验驾驶技巧。',
    accelMul: 0.86,
    speedMul: 1.12,
    steerMul: 0.9,
    weightMul: 1.35,
    swatch: 0xd9b382,
  },
];

export function getPaper(id: string): PaperSpec {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[1];
}