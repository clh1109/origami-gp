import * as THREE from 'three';

export type CameraMode = 'lobby' | 'showcase' | 'race';

function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * 相机装备：大厅绕飞、选人特写、局内弹簧阻尼跟随 + 动态速度感 FOV。
 */
export class CameraRig {
  camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'lobby';

  private smoothPos = new THREE.Vector3(0, 30, 60);
  private smoothLook = new THREE.Vector3(0, 0, 0);
  private followHeading = 0;
  private currentFov = 52;
  private shakeAmp = 0;
  private shakeDecay = 0;
  private tmpForward = new THREE.Vector3();
  private tmpDesired = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();
  private initialized = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  addShake(amp: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeDecay = 1;
  }

  /** 大厅绕飞：lookSide > 0 时注视点向镜头左侧偏移，把展示台让到画面右侧黄金区 */
  updateLobby(dt: number, center: THREE.Vector3, radius: number, height: number, time: number, lookSide = 0): void {
    const angle = time * 0.16;
    this.tmpDesired.set(
      center.x + Math.sin(angle) * radius,
      center.y + height,
      center.z + Math.cos(angle) * radius
    );
    this.tmpLook.copy(center).add(new THREE.Vector3(0, 3.4, 0));
    if (lookSide !== 0) {
      // 镜头右向量 = forward × up（水平）
      const fx = center.x - this.tmpDesired.x;
      const fz = center.z - this.tmpDesired.z;
      const len = Math.hypot(fx, fz) || 1;
      this.tmpLook.x -= (-fz / len) * lookSide;
      this.tmpLook.z -= (fx / len) * lookSide;
    }
    const k = this.initialized ? 1 - Math.exp(-3.2 * dt) : 1;
    this.smoothPos.lerp(this.tmpDesired, k);
    this.smoothLook.lerp(this.tmpLook, k);
    this.currentFov += (50 - this.currentFov) * (1 - Math.exp(-4 * dt));
    this.applyCamera(dt);
    this.initialized = true;
  }

  /** 第 3 步选车手特写：展示台前方 (0, 4.2, 9.5)，FOV 45 */
  updateShowcase(dt: number, target: THREE.Vector3): void {
    this.tmpDesired.set(target.x, target.y + 4.2, target.z + 9.5);
    this.tmpLook.set(target.x, target.y + 1.35, target.z);
    const k = 1 - Math.exp(-4.5 * dt);
    this.smoothPos.lerp(this.tmpDesired, k);
    this.smoothLook.lerp(this.tmpLook, k);
    this.currentFov += (45 - this.currentFov) * (1 - Math.exp(-5 * dt));
    this.applyCamera(dt);
    this.initialized = true;
  }

  /** 进入比赛时对齐到车后，避免从大厅飞入 */
  snapToRace(carPos: THREE.Vector3, heading: number): void {
    this.followHeading = heading;
    this.tmpForward.set(Math.sin(heading), 0, Math.cos(heading));
    this.smoothPos.copy(carPos).addScaledVector(this.tmpForward, -8.5).add(new THREE.Vector3(0, 4.3, 0));
    this.smoothLook.copy(carPos).addScaledVector(this.tmpForward, 5.8).add(new THREE.Vector3(0, 1.4, 0));
    this.currentFov = 52;
    this.initialized = true;
  }

  /** 局内跟随 */
  updateRace(
    dt: number,
    carPos: THREE.Vector3,
    heading: number,
    speed: number,
    maxSpeed: number,
    boost: boolean
  ): void {
    // 转向略微滞后
    this.followHeading = lerpAngle(this.followHeading, heading, 1 - Math.exp(-7 * dt));
    this.tmpForward.set(Math.sin(this.followHeading), 0, Math.cos(this.followHeading));

    this.tmpDesired
      .copy(carPos)
      .addScaledVector(this.tmpForward, -8.5)
      .add(new THREE.Vector3(0, 4.3, 0));

    const actualForward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    this.tmpLook.copy(carPos).addScaledVector(actualForward, 5.8).add(new THREE.Vector3(0, 1.4, 0));

    const kPos = 1 - Math.exp(-9 * dt);
    const kLook = 1 - Math.exp(-11 * dt);
    this.smoothPos.lerp(this.tmpDesired, kPos);
    this.smoothLook.lerp(this.tmpLook, kLook);

    // 动态 FOV：52 → 64（速度），冲刺瞬间 70
    const speedRatio = Math.max(0, Math.min(1, speed / Math.max(1, maxSpeed)));
    let targetFov = 52 + speedRatio * 12;
    let fovK = 1 - Math.exp(-6 * dt);
    if (boost) {
      targetFov = 70;
      fovK = 1 - Math.exp(-16 * dt);
    }
    this.currentFov += (targetFov - this.currentFov) * fovK;

    this.applyCamera(dt);
  }

  private applyCamera(dt: number): void {
    this.camera.position.copy(this.smoothPos);
    // 相机抖动
    if (this.shakeAmp > 0.001) {
      const a = this.shakeAmp;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
      this.camera.position.z += (Math.random() - 0.5) * a;
      this.shakeAmp *= Math.pow(0.02, dt); // 快速衰减
      this.shakeDecay -= dt;
      if (this.shakeDecay <= 0) this.shakeAmp = 0;
    }
    this.camera.lookAt(this.smoothLook);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  reset(): void {
    this.initialized = false;
    this.shakeAmp = 0;
    this.currentFov = 52;
  }
}