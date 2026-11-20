import * as THREE from 'three';
import type { CarRuntimeState, PlayerInput } from '../types/game';
import type { TrackBuildResult } from '../tracks/TrackBuilder';

export interface AIOutput {
  input: PlayerInput;
  useItem: boolean;
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** 7 名 AI 沿样条寻路、横向避让、道具使用 */
export function computeAIInput(
  car: CarRuntimeState,
  track: TrackBuildResult,
  cars: CarRuntimeState[],
  dt: number
): AIOutput {
  const skill = car.aiSkill; // 0~1
  const q = track.query(car.pos);
  car.nearestT = q.t;

  // 前瞻距离随速度变化
  const lookahead = 0.016 + Math.abs(car.speed) * 0.00055 * (0.8 + skill * 0.4);
  const targetT = (q.t + lookahead) % 1;
  const basePoint = track.pointAt(targetT);
  const tan = track.tangentAt(targetT);
  const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

  // 横向避让：检测前方近距车辆
  let avoid = 0;
  const fwd = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
  for (const other of cars) {
    if (other === car || other.isGhost) continue;
    const dx = other.pos.x - car.pos.x;
    const dz = other.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 7 && dist > 0.01) {
      const ahead = (dx * fwd.x + dz * fwd.z) / dist;
      if (ahead > 0.4) {
        const side = (dx * normal.x + dz * normal.z) / dist;
        avoid -= Math.sign(side || 1) * (1 - dist / 7) * 3.2;
      }
    }
  }
  car.aiTargetOffset += (car.aiOffset + avoid - car.aiTargetOffset) * Math.min(1, 4 * dt);
  const offset = THREE.MathUtils.clamp(car.aiTargetOffset, -track.width * 0.34, track.width * 0.34);
  const target = basePoint.clone().addScaledVector(normal, offset);

  const desired = Math.atan2(target.x - car.pos.x, target.z - car.pos.z);
  const diff = wrapAngle(desired - car.heading);
  const steerGain = 2.0 + skill * 1.2;
  const steer = THREE.MathUtils.clamp(diff * steerGain, -1, 1);

  // 弯道减速
  const farT = (q.t + lookahead * 2.4) % 1;
  const farPoint = track.pointAt(farT);
  const farDesired = Math.atan2(farPoint.x - car.pos.x, farPoint.z - car.pos.z);
  const curvature = Math.abs(wrapAngle(farDesired - desired));
  let throttle = 1;
  if (curvature > 0.5) throttle = 0.45;
  else if (curvature > 0.28) throttle = 0.75;
  if (Math.abs(diff) > 0.9) throttle = 0.3;
  // 技能低的 AI 偶尔犹豫
  throttle *= 0.86 + skill * 0.14;

  // 弯道漂移蓄力
  const drift = Math.abs(diff) > 0.3 && Math.abs(car.speed) > 20 && curvature > 0.12;

  // 道具使用
  car.aiItemCooldown = Math.max(0, car.aiItemCooldown - dt);
  let useItem = false;
  if (car.heldItem && car.aiItemCooldown <= 0) {
    const wantBoost = car.heldItem === 'boost' && curvature < 0.2;
    const wantShield = car.heldItem === 'shield';
    const wantTrap = car.heldItem === 'trap' && Math.random() < 0.02;
    const wantBoomerang = car.heldItem === 'boomerang' && Math.random() < 0.03;
    if (wantBoost || wantShield || wantTrap || wantBoomerang) {
      useItem = true;
      car.aiItemCooldown = 2 + Math.random() * 3;
    }
  }

  return { input: { throttle, steer, drift }, useItem };
}