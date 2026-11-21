import * as THREE from 'three';
import { createPaperMaterial, createEmissivePaper } from '../materials/PaperMaterial';

interface ConfettiPiece {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;
  phase: number;
  scale: number;
}

/** 红白手绘终点纸带纹理 */
function createFinishTapeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#e05a47';
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 0, 16, 32);
    ctx.fillRect(x + 16, 32, 16, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/** 绕车庆祝的 3D 白金折纸千纸鹤 */
function buildCelebrationCrane(): {
  root: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
} {
  const root = new THREE.Group();
  const whiteMat = createPaperMaterial(0xfffdf6, undefined, 0.88);
  const goldMat = createPaperMaterial(0xf4d35e, undefined, 0.82);
  const beakMat = createEmissivePaper(0xe05a47, 0xe05a47, 0.35);

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), whiteMat);
  body.scale.set(0.85, 0.65, 1.55);
  body.castShadow = true;
  root.add(body);

  const neck = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.6, 4), whiteMat);
  neck.position.set(0, 0.72, 1.18);
  neck.rotation.x = 0.65;
  root.add(neck);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.72, 4), beakMat);
  head.rotation.x = Math.PI / 2 + 0.3;
  head.position.set(0, 1.28, 1.78);
  root.add(head);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.75, 4), goldMat);
  tail.position.set(0, 0.8, -1.35);
  tail.rotation.x = -0.68;
  root.add(tail);

  const makeWing = (s: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.4, 0.12, 0.05);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0, 0.8,   s * 3.0, 0.22, -0.3,   0, 0, -0.85,
          0, 0, 0.8,   s * 1.65, 0.4, 0.65,   s * 3.0, 0.22, -0.3,
        ],
        3
      )
    );
    geo.computeVertexNormals();
    const wMat = whiteMat.clone();
    wMat.side = THREE.DoubleSide;
    pivot.add(new THREE.Mesh(geo, wMat));
    return pivot;
  };

  const leftWing = makeWing(-1);
  const rightWing = makeWing(1);
  root.add(leftWing, rightWing);
  return { root, leftWing, rightWing };
}

/**
 * 冲线唯美庆祝控制器：
 * - 两截手绘终点纸带在车头冲过时从中央撕裂飘飞
 * - 220 片彩色折纸花瓣雨慢动作摇曳飘落（InstancedMesh 高性能）
 * - 白金折纸千纸鹤绕主角赛车盘旋致意
 * - 镜头温柔环绕主角车 2.6 秒后回调弹出成绩单
 */
export class FinishCelebrationController {
  private scene: THREE.Scene;
  private group = new THREE.Group();

  // 终点两截撕裂纸带
  private tapeGroup = new THREE.Group();
  private leftTapePivot = new THREE.Group();
  private rightTapePivot = new THREE.Group();
  private tapeMat: THREE.MeshStandardMaterial;

  // 220 片折纸花瓣雨
  private confettiMesh: THREE.InstancedMesh;
  private pieces: ConfettiPiece[] = [];
  private readonly confettiCount = 220;
  private dummy = new THREE.Object3D();

  // 绕车千纸鹤
  private crane = buildCelebrationCrane();

  private active = false;
  private elapsed = 0;
  private resultsShown = false;
  private readonly delayToResults = 2.6;
  private onShowResults: (() => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. 终点手绘纸带（左右两半，从中央断开向外摆动）
    this.tapeMat = new THREE.MeshStandardMaterial({
      map: createFinishTapeTexture(),
      roughness: 0.9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
    });
    const halfLen = 9.5;
    const leftGeo = new THREE.PlaneGeometry(halfLen, 0.65);
    leftGeo.translate(halfLen / 2, 0, 0);
    const leftMesh = new THREE.Mesh(leftGeo, this.tapeMat);
    this.leftTapePivot.position.set(-halfLen, 1.45, 0);
    this.leftTapePivot.add(leftMesh);

    const rightGeo = new THREE.PlaneGeometry(halfLen, 0.65);
    rightGeo.translate(-halfLen / 2, 0, 0);
    const rightMesh = new THREE.Mesh(rightGeo, this.tapeMat);
    this.rightTapePivot.position.set(halfLen, 1.45, 0);
    this.rightTapePivot.add(rightMesh);

    this.tapeGroup.add(this.leftTapePivot, this.rightTapePivot);
    this.group.add(this.tapeGroup);

    // 2. 220 片彩色折纸花瓣（菱形小纸片）
    const petalGeo = new THREE.BufferGeometry();
    petalGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0.36, 0,   -0.22, 0, 0,    0, -0.36, 0,
          0, 0.36, 0,    0, -0.36, 0,   0.22, 0, 0,
        ],
        3
      )
    );
    petalGeo.computeVertexNormals();
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    this.confettiMesh = new THREE.InstancedMesh(petalGeo, petalMat, this.confettiCount);
    this.confettiMesh.frustumCulled = false;

    const palette = [0xe05a47, 0xf4d35e, 0xf4a6b8, 0x9fd4ea, 0x8eb87a, 0xfffdf6];
    const tmpColor = new THREE.Color();
    for (let i = 0; i < this.confettiCount; i++) {
      tmpColor.setHex(palette[i % palette.length]);
      this.confettiMesh.setColorAt(i, tmpColor);
      this.pieces.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
        scale: 0.65 + Math.random() * 0.75,
      });
    }
    if (this.confettiMesh.instanceColor) this.confettiMesh.instanceColor.needsUpdate = true;
    this.group.add(this.confettiMesh);

    // 3. 千纸鹤
    this.group.add(this.crane.root);

    this.group.visible = false;
    this.scene.add(this.group);
  }

  get isActive(): boolean {
    return this.active;
  }

  trigger(
    carPos: THREE.Vector3,
    carHeading: number,
    onShowResults: () => void
  ): void {
    this.active = true;
    this.elapsed = 0;
    this.resultsShown = false;
    this.onShowResults = onShowResults;

    // 摆放终点撕裂纸带在冲线位置
    this.tapeGroup.position.copy(carPos);
    this.tapeGroup.rotation.set(0, carHeading, 0);
    this.leftTapePivot.rotation.set(0, 0, 0);
    this.rightTapePivot.rotation.set(0, 0, 0);
    this.tapeMat.opacity = 0.96;
    this.tapeGroup.visible = true;

    // 在车头上方绽放 220 片彩色折纸花瓣雨
    for (const p of this.pieces) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 14;
      p.pos.set(
        carPos.x + Math.cos(a) * r,
        carPos.y + 3.5 + Math.random() * 10,
        carPos.z + Math.sin(a) * r
      );
      p.vel.set(
        (Math.random() - 0.5) * 6,
        3.5 + Math.random() * 6.5,
        (Math.random() - 0.5) * 6
      );
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.rotVel.set(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      );
    }
    this.group.visible = true;
  }

  update(dt: number, carPos: THREE.Vector3, camera: THREE.PerspectiveCamera): void {
    if (!this.active) return;
    this.elapsed += dt;
    const t = this.elapsed;

    // 1. 终点纸带从中间撕裂，向两侧剧烈摆开并飘散淡出
    const ripT = Math.min(1, t / 0.9);
    const swing = (1 - Math.pow(1 - ripT, 3)) * 1.45;
    this.leftTapePivot.rotation.y = -swing;
    this.leftTapePivot.rotation.z = Math.sin(t * 14) * 0.14 * (1 - ripT * 0.5);
    this.rightTapePivot.rotation.y = swing;
    this.rightTapePivot.rotation.z = -Math.sin(t * 14) * 0.14 * (1 - ripT * 0.5);

    if (t > 1.2) {
      const fade = Math.max(0, 1 - (t - 1.2) / 1.0);
      this.tapeMat.opacity = fade;
      this.tapeGroup.visible = fade > 0.02;
    }

    // 2. 220 片彩色折纸花瓣慢动作摇曳下落
    for (let i = 0; i < this.confettiCount; i++) {
      const p = this.pieces[i];
      p.vel.y = Math.max(-2.6, p.vel.y - 7.5 * dt); // 纸片空气阻力终端下落速度很慢
      p.vel.x *= 1 - Math.min(1, dt * 1.4);
      p.vel.z *= 1 - Math.min(1, dt * 1.4);
      p.pos.x += (p.vel.x + Math.sin(t * 3.2 + p.phase) * 1.35) * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += (p.vel.z + Math.cos(t * 2.8 + p.phase) * 1.35) * dt;
      if (p.pos.y < 0.08) {
        p.pos.y = 0.08;
        p.vel.set(0, 0, 0);
      } else {
        p.rot.x += p.rotVel.x * dt;
        p.rot.y += p.rotVel.y * dt;
        p.rot.z += p.rotVel.z * dt;
      }
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.copy(p.rot);
      this.dummy.scale.setScalar(p.scale);
      this.dummy.updateMatrix();
      this.confettiMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.confettiMesh.instanceMatrix.needsUpdate = true;

    // 3. 白金千纸鹤振翅绕着主角赛车盘旋致意
    const flap = Math.sin(t * 10.5) * 0.55;
    this.crane.leftWing.rotation.z = flap;
    this.crane.rightWing.rotation.z = -flap;
    const angle = t * 1.55;
    const r = 6.2;
    const cx = carPos.x + Math.cos(angle) * r;
    const cz = carPos.z + Math.sin(angle) * r;
    const cy = carPos.y + 4.4 + Math.sin(t * 2.4) * 0.65;
    const lookX = carPos.x + Math.cos(angle + 0.25) * r;
    const lookZ = carPos.z + Math.sin(angle + 0.25) * r;
    this.crane.root.position.set(cx, cy, cz);
    this.crane.root.lookAt(lookX, cy, lookZ);

    // 4. 电影感唯美慢环绕特写镜头
    const camAngle = t * 0.55 + 0.5;
    const camR = 11.5;
    const targetCamX = carPos.x + Math.cos(camAngle) * camR;
    const targetCamZ = carPos.z + Math.sin(camAngle) * camR;
    const targetCamY = carPos.y + 4.6 + Math.sin(t * 0.6) * 0.4;
    camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), Math.min(1, dt * 3.5));
    camera.lookAt(carPos.x, carPos.y + 1.3, carPos.z);

    // 5. 2.6 秒后优雅弹出结算成绩单
    if (!this.resultsShown && t >= this.delayToResults) {
      this.resultsShown = true;
      this.onShowResults?.();
    }
  }

  reset(): void {
    this.active = false;
    this.resultsShown = false;
    this.onShowResults = null;
    this.group.visible = false;
  }

  dispose(): void {
    this.reset();
    this.scene.remove(this.group);
    this.tapeMat.dispose();
    this.confettiMesh.geometry.dispose();
    (this.confettiMesh.material as THREE.Material).dispose();
  }
}
