import * as THREE from 'three';
import type { CarRuntimeState, PlayerInput } from '../types/game';

/**
 * 加速/极速、二段蓄力漂移（Mini-Turbo）、碰撞、越野减速。
 * 纸张克重通过 paper 倍率影响手感。
 */

export interface CollisionEvent {
  a: CarRuntimeState;
  b: CarRuntimeState;
  point: THREE.Vector3;
  strength: number;
}

export function stepCarPhysics(car: CarRuntimeState, input: PlayerInput, dt: number): void {
  const s = car.racer.stats;
  const boostMul = car.boostTimer > 0 ? 1.42 : 1.0;
  const slowMul = car.slowTimer > 0 ? 0.52 : 1.0;
  const offroadMul = car.offroad ? 0.5 + (s.offroad / 100) * 0.35 : 1.0;
  const maxSpeed = (36 + s.speed * 0.18) * car.paper.speedMul * boostMul * slowMul * offroadMul;
  const accel = (23 + s.accel * 0.16) * car.paper.accelMul * (car.offroad ? 0.7 : 1.0);
  const steerRate = (1.8 + s.steer * 0.011) * car.paper.steerMul;

  // 计时器衰减
  car.boostTimer = Math.max(0, car.boostTimer - dt);
  car.shieldTimer = Math.max(0, car.shieldTimer - dt);
  car.slowTimer = Math.max(0, car.slowTimer - dt);
  car.spinTimer = Math.max(0, car.spinTimer - dt);

  const spinning = car.spinTimer > 0;

  if (spinning) {
    // 打滑旋转，失去控制
    car.heading += 7.5 * dt;
    car.speed *= Math.pow(0.2, dt);
    car.driftDir = 0;
    car.driftCharge = 0;
  } else {
    if (input.throttle > 0) car.speed += accel * input.throttle * dt;
    else if (input.throttle < 0) car.speed += accel * 1.15 * input.throttle * dt;
    else car.speed *= Math.pow(0.25, dt);

    car.speed = Math.max(-14, Math.min(maxSpeed, car.speed));

    // 二段蓄力漂移状态机
    if (input.drift && Math.abs(car.speed) > 16 && input.steer !== 0) {
      if (car.driftDir === 0) car.driftDir = input.steer > 0 ? 1 : -1;
      car.driftCharge += dt;
      // 漂移轻微scrub
      car.speed *= Math.pow(0.86, dt);
    } else {
      if (car.driftCharge >= 1.6) car.boostTimer = Math.max(car.boostTimer, 1.2);
      else if (car.driftCharge >= 0.8) car.boostTimer = Math.max(car.boostTimer, 0.7);
      car.driftDir = 0;
      car.driftCharge = 0;
    }

    const turnMul = car.driftDir !== 0 ? 1.35 : 1.0;
    const dirSign = car.speed >= 0 ? 1 : -1;
    car.heading +=
      input.steer * steerRate * turnMul * dirSign * Math.min(1, Math.abs(car.speed) / 8) * dt;
  }

  // 侧倾 / 俯仰
  const targetRoll = spinning ? 0 : -input.steer * (car.driftDir !== 0 ? 0.24 : 0.14);
  car.roll += (targetRoll - car.roll) * Math.min(1, 10 * dt);
  const targetPitch = spinning ? 0 : -(input.throttle > 0 ? 0.05 : input.throttle < 0 ? -0.06 : 0) - (car.boostTimer > 0 ? 0.06 : 0);
  car.pitch += (targetPitch - car.pitch) * Math.min(1, 8 * dt);
  car.tiltGroup.rotation.z = car.roll;
  car.tiltGroup.rotation.x = car.pitch;

  // 位移
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  car.root.position.copy(car.pos);
  car.root.rotation.y = car.heading;

  // 车轮自转 / 前轮转向
  car.wheelSpin += (car.speed / 0.55) * dt;
  for (const w of car.wheels) w.rotation.x = car.wheelSpin;
  const targetSteer = spinning ? 0 : input.steer * 0.35;
  car.steerVisual += (targetSteer - car.steerVisual) * Math.min(1, 12 * dt);
  for (const fw of car.frontWheels) fw.rotation.y = car.steerVisual;

  // 护盾视觉
  if (car.shieldMesh) {
    car.shieldMesh.visible = car.shieldTimer > 0;
    if (car.shieldTimer > 0) {
      car.shieldMesh.rotation.y += dt * 2.4;
      car.shieldMesh.rotation.x += dt * 0.8;
    }
  }
}

/** 车-车碰撞：按重量推开 + 速度损失（护盾免疫） */
export function resolveCarCollisions(cars: CarRuntimeState[]): CollisionEvent[] {
  const events: CollisionEvent[] = [];
  const R = 2.5;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.isGhost || b.isGhost) continue;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > R || d < 0.0001) continue;
      const nx = dx / d;
      const nz = dz / d;
      const overlap = R - d;
      const wa = a.racer.stats.weight * a.paper.weightMul;
      const wb = b.racer.stats.weight * b.paper.weightMul;
      const total = wa + wb;
      const pushA = overlap * (wb / total);
      const pushB = overlap * (wa / total);
      a.pos.x -= nx * pushA;
      a.pos.z -= nz * pushA;
      b.pos.x += nx * pushB;
      b.pos.z += nz * pushB;
      a.root.position.copy(a.pos);
      b.root.position.copy(b.pos);

      const relSpeed = Math.abs(a.speed - b.speed);
      const strength = Math.min(1, overlap / R + relSpeed / 60);
      const aShield = a.shieldTimer > 0;
      const bShield = b.shieldTimer > 0;
      if (!aShield) a.speed *= 1 - 0.25 * (wb / total) * strength;
      if (!bShield) b.speed *= 1 - 0.25 * (wa / total) * strength;
      if (strength > 0.25 && (!aShield || !bShield)) {
        events.push({
          a,
          b,
          point: new THREE.Vector3((a.pos.x + b.pos.x) / 2, (a.pos.y + b.pos.y) / 2 + 1, (a.pos.z + b.pos.z) / 2),
          strength,
        });
      }
    }
  }
  return events;
}

/** 越野判定：距样条中心超过半宽 + 路肩 */
export function computeOffroad(car: CarRuntimeState, distToCenter: number, halfWidth: number): boolean {
  return distToCenter > halfWidth + 1.3;
}