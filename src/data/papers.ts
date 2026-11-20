import type { PaperSpec } from '../types/game';

/** 3 种纸张克重：克重直接影响物理手感 */
export const PAPERS: PaperSpec[] = [
  {
    id: 'light',
    name: '宣纸',
    weightGrams: 80,
    desc: '轻盈灵动 · 起步与转向极快，极速略低，易被碰撞推开',
    accelMul: 1.18,
    speedMul: 0.94,
    steerMul: 1.12,
    weightMul: 0.72,
    swatch: 0xf7f3ea,
  },
  {
    id: 'medium',
    name: '道林纸',
    weightGrams: 180,
    desc: '均衡之选 · 手感适中，兼顾加速与稳定',
    accelMul: 1.0,
    speedMul: 1.0,
    steerMul: 1.0,
    weightMul: 1.0,
    swatch: 0xfaf3e3,
  },
  {
    id: 'heavy',
    name: '瓦楞卡纸',
    weightGrams: 320,
    desc: '厚重稳健 · 极速更高、抗撞性强，但起步与转向偏慢',
    accelMul: 0.86,
    speedMul: 1.08,
    steerMul: 0.9,
    weightMul: 1.35,
    swatch: 0xd9b382,
  },
];

export function getPaper(id: string): PaperSpec {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[1];
}