import * as THREE from 'three';
import type { CarRuntimeState, GhostData, GhostFrame, PaperId } from '../types/game';

const STORAGE_KEY = 'origami-gp-ghosts';
const SAMPLE_HZ = 30;

/** 计时挑战幽灵车录制 */
export class GhostRecorder {
  frames: GhostFrame[] = [];
  private acc = 0;
  recording = false;

  start(): void {
    this.frames = [];
    this.acc = 0;
    this.recording = true;
  }

  record(t: number, car: CarRuntimeState, dt: number): void {
    if (!this.recording) return;
    this.acc += dt;
    if (this.acc < 1 / SAMPLE_HZ) return;
    this.acc = 0;
    this.frames.push({
      t,
      x: car.pos.x,
      y: car.pos.y,
      z: car.pos.z,
      heading: car.heading,
      roll: car.roll,
    });
  }

  stop(totalTime: number, trackId: string, racerId: string, paperId: PaperId): GhostData {
    this.recording = false;
    return { trackId, racerId, paperId, totalTime, frames: this.frames };
  }
}

/** 幽灵车回放（半透明） */
export class GhostPlayer {
  data: GhostData | null = null;
  private idx = 0;

  load(data: GhostData | null): void {
    this.data = data;
    this.idx = 0;
  }

  update(t: number, car: CarRuntimeState): void {
    if (!this.data || this.data.frames.length === 0) return;
    const frames = this.data.frames;
    if (t >= this.data.totalTime) {
      const last = frames[frames.length - 1];
      car.pos.set(last.x, last.y, last.z);
      car.heading = last.heading;
      car.root.position.copy(car.pos);
      car.root.rotation.y = car.heading;
      car.root.visible = false;
      return;
    }
    car.root.visible = true;
    while (this.idx < frames.length - 2 && frames[this.idx + 1].t < t) this.idx++;
    while (this.idx > 0 && frames[this.idx].t > t) this.idx--;
    const a = frames[this.idx];
    const b = frames[Math.min(frames.length - 1, this.idx + 1)];
    const span = Math.max(0.0001, b.t - a.t);
    const k = THREE.MathUtils.clamp((t - a.t) / span, 0, 1);
    car.pos.set(
      THREE.MathUtils.lerp(a.x, b.x, k),
      THREE.MathUtils.lerp(a.y, b.y, k),
      THREE.MathUtils.lerp(a.z, b.z, k)
    );
    let dh = b.heading - a.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading = a.heading + dh * k;
    car.roll = THREE.MathUtils.lerp(a.roll, b.roll, k);
    car.root.position.copy(car.pos);
    car.root.rotation.y = car.heading;
    car.tiltGroup.rotation.z = car.roll;
  }
}

// ---------- 最佳幽灵持久化 ----------
export function loadBestGhost(trackId: string): GhostData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, GhostData>;
    return all[trackId] ?? null;
  } catch {
    return null;
  }
}

export function saveBestGhost(data: GhostData): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, GhostData>) : {};
    const prev = all[data.trackId];
    if (prev && prev.totalTime <= data.totalTime) return false;
    all[data.trackId] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}