import * as THREE from 'three';
import type { PopupPropRig } from '../types/game';
import { createPaperMaterial, createEmissivePaper } from '../materials/PaperMaterial';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 3D 精装绘本封面纹理（深海蓝布纹 + 烫金花纹边框 + 红丝带 + 书名） */
function createBookCoverTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2c4466');
  bg.addColorStop(0.55, '#1e304a');
  bg.addColorStop(1, '#142133');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255, 248, 230, 0.03)';
  for (let i = 0; i < 6000; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1);
  }

  const spine = ctx.createLinearGradient(0, 0, 76, 0);
  spine.addColorStop(0, 'rgba(255,255,255,0.08)');
  spine.addColorStop(0.65, 'rgba(0,0,0,0.38)');
  spine.addColorStop(1, 'rgba(255,240,200,0.12)');
  ctx.fillStyle = spine;
  ctx.fillRect(0, 0, 76, H);

  ctx.strokeStyle = 'rgba(238, 204, 130, 0.78)';
  ctx.lineWidth = 6;
  ctx.strokeRect(112, 72, W - 180, H - 144);
  ctx.strokeStyle = 'rgba(238, 204, 130, 0.38)';
  ctx.lineWidth = 2;
  ctx.strokeRect(132, 92, W - 220, H - 184);

  const cx = W * 0.54;
  const cy = H * 0.34;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(244, 214, 148, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f2cf82';
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.lineTo(18, -18);
  ctx.lineTo(56, 0);
  ctx.lineTo(18, 18);
  ctx.lineTo(0, 56);
  ctx.lineTo(-18, 18);
  ctx.lineTo(-56, 0);
  ctx.lineTo(-18, -18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fcf4df';
  ctx.font = 'bold 84px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('折纸大奖赛', cx, H * 0.56);

  ctx.fillStyle = 'rgba(242, 207, 130, 0.9)';
  ctx.font = '600 32px Georgia, serif';
  ctx.fillText('ORIGAMI GRAND PRIX', cx, H * 0.63);

  ctx.fillStyle = 'rgba(225, 236, 250, 0.75)';
  ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('POP-UP STORYBOOK EDITION', cx, H * 0.74);

  ctx.fillStyle = '#d94e3f';
  ctx.beginPath();
  ctx.moveTo(W - 180, 0);
  ctx.lineTo(W - 122, 0);
  ctx.lineTo(W - 122, 185);
  ctx.lineTo(W - 151, 148);
  ctx.lineTo(W - 180, 185);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createDustTexture(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255, 246, 210, 1)');
  g.addColorStop(0.45, 'rgba(255, 224, 150, 0.45)');
  g.addColorStop(1, 'rgba(255, 224, 150, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 栖息在书角、随后起飞吹开书本的 3D 白金折纸千纸鹤 */
function buildIntroCrane(): {
  root: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
} {
  const root = new THREE.Group();
  const whiteMat = createPaperMaterial(0xfffdf6, undefined, 0.88);
  const goldMat = createPaperMaterial(0xf4d35e, undefined, 0.82);
  const beakMat = createEmissivePaper(0xe05a47, 0xe05a47, 0.35);

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(2.1, 0), whiteMat);
  body.scale.set(0.85, 0.65, 1.55);
  body.castShadow = true;
  root.add(body);

  const neck = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.0, 4), whiteMat);
  neck.position.set(0, 1.85, 2.9);
  neck.rotation.x = 0.65;
  neck.castShadow = true;
  root.add(neck);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 4), beakMat);
  head.rotation.x = Math.PI / 2 + 0.3;
  head.position.set(0, 3.2, 4.35);
  root.add(head);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.75, 4.4, 4), goldMat);
  tail.position.set(0, 2.0, -3.4);
  tail.rotation.x = -0.68;
  tail.castShadow = true;
  root.add(tail);

  const makeWing = (s: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.95, 0.3, 0.1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0, 2.0,       s * 7.6, 0.55, -0.75,   0, 0, -2.1,
          0, 0, 2.0,       s * 4.2, 1.0, 1.6,      s * 7.6, 0.55, -0.75,
        ],
        3
      )
    );
    geo.computeVertexNormals();
    const wMat = whiteMat.clone();
    wMat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, wMat);
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  };

  const leftWing = makeWing(-1);
  const rightWing = makeWing(1);
  root.add(leftWing, rightWing);
  return { root, leftWing, rightWing };
}

/** 书本旁边散落的书房文具（折纸铅笔 + 双色橡皮 + 和纸胶带卷），营造午后书桌氛围 */
function buildDeskStationery(center: THREE.Vector3, bookW: number): THREE.Group {
  const group = new THREE.Group();

  // 1. 斜放在书本右侧的六棱折纸铅笔
  const pencil = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 72, 6), createPaperMaterial(0xf4d35e));
  shaft.rotation.z = Math.PI / 2;
  shaft.castShadow = true;
  pencil.add(shaft);
  const tipWood = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8, 6), createPaperMaterial(0xe8c9a0));
  tipWood.rotation.z = -Math.PI / 2;
  tipWood.position.x = 40;
  pencil.add(tipWood);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3, 6), createPaperMaterial(0x3b2f27));
  lead.rotation.z = -Math.PI / 2;
  lead.position.x = 44.5;
  pencil.add(lead);
  const eraserCap = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 5.5, 6), createPaperMaterial(0xf4a6b8));
  eraserCap.rotation.z = Math.PI / 2;
  eraserCap.position.x = -38.5;
  pencil.add(eraserCap);
  pencil.position.set(center.x + bookW * 0.64, 2.4, center.z + 24);
  pencil.rotation.y = 0.65;
  group.add(pencil);

  // 2. 一卷珊瑚红和纸胶带
  const tape = new THREE.Group();
  const outerRoll = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 6.5, 18, 1, true),
    createPaperMaterial(0xe05a47)
  );
  outerRoll.castShadow = true;
  tape.add(outerRoll);
  const topRing = new THREE.Mesh(new THREE.RingGeometry(6.5, 11, 18), createPaperMaterial(0xfaf3e3));
  topRing.rotation.x = -Math.PI / 2;
  topRing.position.y = 3.26;
  tape.add(topRing);
  tape.position.set(center.x + bookW * 0.66, 3.25, center.z - 42);
  group.add(tape);

  return group;
}

export interface BookIntroTargets {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  center: THREE.Vector3;
  trackGroup: THREE.Group;
  props: PopupPropRig[];
  pedestal: THREE.Group | null;
  showcaseCar: THREE.Object3D | null;
  onComplete: () => void;
}

export class BookIntroCinematic {
  private targets: BookIntroTargets;
  private group = new THREE.Group();
  private coverPivot = new THREE.Group();
  private coverMats: THREE.MeshStandardMaterial[] = [];
  private crane: ReturnType<typeof buildIntroCrane>;
  private stationery: THREE.Group;
  private dustPoints: THREE.Points;
  private dustBaseY: Float32Array;

  private orderedProps: { prop: PopupPropRig; delay: number; localT: number }[] = [];
  private state: 'idle' | 'opening' | 'done' = 'idle';
  private idleTime = 0;
  private elapsed = 0;
  private readonly duration = 5.4;

  private cranePerch = new THREE.Vector3();
  private camStart = new THREE.Vector3();
  private camMid = new THREE.Vector3();
  private camEnd = new THREE.Vector3();
  private lookStart = new THREE.Vector3();
  private lookEnd = new THREE.Vector3();
  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();

  constructor(targets: BookIntroTargets) {
    this.targets = targets;
    const { center, scene, props, trackGroup, pedestal, showcaseCar } = targets;

    const bookW = 210;
    const bookD = 210;
    const bookThick = 1.6;
    this.coverPivot.position.set(center.x - bookW * 0.5, 1.8, center.z);

    const coverTex = createBookCoverTexture();
    const topMat = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.78,
      metalness: 0.08,
      transparent: true,
      opacity: 1,
    });
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xfcf6e8,
      roughness: 0.94,
      transparent: true,
      opacity: 1,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xe6c47a,
      roughness: 0.55,
      metalness: 0.25,
      transparent: true,
      opacity: 1,
    });
    this.coverMats = [topMat, innerMat, edgeMat];

    const lidGeo = new THREE.BoxGeometry(bookW, bookThick, bookD);
    lidGeo.translate(bookW * 0.5, bookThick * 0.5, 0);
    const lid = new THREE.Mesh(lidGeo, [edgeMat, edgeMat, topMat, innerMat, edgeMat, edgeMat]);
    lid.castShadow = true;
    lid.receiveShadow = true;
    this.coverPivot.add(lid);
    this.group.add(this.coverPivot);

    // 栖息在书本右上角的折纸千纸鹤
    this.crane = buildIntroCrane();
    this.cranePerch.set(center.x + bookW * 0.32, 6.2, center.z + bookD * 0.26);
    this.crane.root.position.copy(this.cranePerch);
    this.crane.root.rotation.y = -0.85;
    this.group.add(this.crane.root);

    // 书桌右侧散落的折纸文具
    this.stationery = buildDeskStationery(center, bookW);
    this.group.add(this.stationery);

    // 180 颗金色阳光微尘
    const dustCount = 180;
    const dustPos = new Float32Array(dustCount * 3);
    this.dustBaseY = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = center.x + (Math.random() - 0.5) * 210;
      const y = 4 + Math.random() * 58;
      dustPos[i * 3 + 1] = y;
      this.dustBaseY[i] = y;
      dustPos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 210;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      map: createDustTexture(),
      size: 2.8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.group.add(this.dustPoints);
    scene.add(this.group);

    // 收纳书内世界
    trackGroup.scale.set(1, 0.01, 1);
    if (pedestal) pedestal.scale.set(0.01, 0.01, 0.01);
    if (showcaseCar) showcaseCar.scale.set(0.01, 0.01, 0.01);

    const sorted = [...props].sort(
      (a, b) => a.rootPivot.position.distanceTo(center) - b.rootPivot.position.distanceTo(center)
    );
    const total = Math.max(1, sorted.length);
    this.orderedProps = sorted.map((prop, idx) => {
      prop.popped = false;
      prop.elapsed = 0;
      prop.rootPivot.rotation.x = -Math.PI / 2;
      prop.topGroup.scale.set(0.01, 0.01, 0.01);
      const delay = 1.9 + (idx / total) * 2.05;
      return { prop, delay, localT: 0 };
    });

    this.camStart.set(center.x + 28, 128, center.z + 148);
    this.camMid.set(center.x + 30, 54, center.z + 82);
    this.camEnd.set(center.x + 17, 8.5, center.z + 17);
    this.lookStart.set(center.x + 6, 4, center.z + 6);
    this.lookEnd.set(center.x, 3.6, center.z);
  }

  get isFinished(): boolean {
    return this.state === 'done';
  }

  get isIdle(): boolean {
    return this.state === 'idle';
  }

  /** 玩家点击「翻开绘本」时调用：千纸鹤起飞并吹开 3D 书本 */
  triggerOpen(): void {
    if (this.state !== 'idle') return;
    this.state = 'opening';
    this.elapsed = 0;
    // 以当前呼吸镜头位置作为俯冲起点，保证丝滑无跳变
    this.camStart.copy(this.targets.camera.position);
  }

  update(dt: number): void {
    if (this.state === 'done') return;

    // 金色微尘始终柔缓飘升
    const dustTime = this.state === 'idle' ? this.idleTime : this.idleTime + this.elapsed;
    const dPos = this.dustPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dPos.count; i++) {
      dPos.setY(i, this.dustBaseY[i] + Math.sin(dustTime * 0.85 + i * 0.7) * 2.6);
    }
    dPos.needsUpdate = true;

    if (this.state === 'idle') {
      this.idleTime += dt;
      // 镜头在书桌上方做温柔的呼吸式慢移
      const swayX = Math.sin(this.idleTime * 0.32) * 14;
      const swayY = Math.sin(this.idleTime * 0.45) * 4;
      this.targets.camera.position.set(
        this.camStart.x + swayX,
        this.camStart.y + swayY,
        this.camStart.z + Math.cos(this.idleTime * 0.26) * 8
      );
      this.targets.camera.lookAt(this.lookStart);

      // 停在书角的千纸鹤温柔地慢扇翅膀呼吸
      const breathFlap = 0.18 + Math.sin(this.idleTime * 2.4) * 0.14;
      this.crane.leftWing.rotation.z = breathFlap;
      this.crane.rightWing.rotation.z = -breathFlap;
      this.crane.root.position.y = this.cranePerch.y + Math.sin(this.idleTime * 2.4) * 0.35;
      return;
    }

    // ---------- 阶段 2：千纸鹤起飞 -> 吹开书本 -> 景物依次冒出 ----------
    this.elapsed += dt;
    const t = this.elapsed;

    // 1. 千纸鹤起飞盘旋并飞向蓝天
    const flap = Math.sin(t * 11) * 0.56;
    this.crane.leftWing.rotation.z = flap;
    this.crane.rightWing.rotation.z = -flap;
    const craneU = THREE.MathUtils.clamp(t / 3.8, 0, 1);
    const orbitAngle = -0.8 + craneU * Math.PI * 1.45;
    const orbitR = 72 * (1 - craneU * 0.35);
    const craneY = this.cranePerch.y + Math.sin(craneU * Math.PI * 0.85) * 48 + craneU * 42;
    const nextX = this.targets.center.x + Math.cos(orbitAngle) * orbitR;
    const nextZ = this.targets.center.z + Math.sin(orbitAngle) * orbitR;
    this.crane.root.lookAt(nextX, craneY + 2, nextZ);
    this.crane.root.position.set(nextX, craneY, nextZ);
    this.crane.root.visible = t < 4.0;

    // 2. 千纸鹤掠过后，3D 精装封面缓缓翻开（0.65s -> 2.45s）
    const openT = THREE.MathUtils.clamp((t - 0.65) / 1.8, 0, 1);
    this.coverPivot.rotation.z = easeInOutCubic(openT) * Math.PI * 0.96;

    if (t > 2.9) {
      const fade = 1 - THREE.MathUtils.clamp((t - 2.9) / 1.0, 0, 1);
      for (const m of this.coverMats) m.opacity = fade;
      this.coverPivot.visible = fade > 0.02;
      this.stationery.visible = fade > 0.05;
    }

    // 3. 赛道浮起（1.6s -> 2.45s）
    const trackT = THREE.MathUtils.clamp((t - 1.6) / 0.85, 0, 1);
    const trackScaleY = Math.max(0.01, easeOutBack(trackT));
    this.targets.trackGroup.scale.set(1, Math.min(1.06, trackScaleY), 1);
    if (trackT >= 1) this.targets.trackGroup.scale.set(1, 1, 1);

    // 4. 92 个立体书景物按涟漪波浪依次“啪嗒”冒出来
    for (const item of this.orderedProps) {
      if (t >= item.delay && item.localT < 0.65) {
        item.localT = Math.min(0.65, item.localT + dt);
        const tBase = Math.min(1, item.localT / 0.36);
        item.prop.rootPivot.rotation.x = (-Math.PI / 2) * (1 - easeOutBack(tBase));
        const tTop = THREE.MathUtils.clamp((item.localT - 0.14) / 0.42, 0, 1);
        const sTop = Math.max(0.01, easeOutBack(tTop));
        item.prop.topGroup.scale.set(sTop, sTop, sTop);
        item.prop.popped = true;
        item.prop.elapsed = 0.6;
      }
    }

    // 5. 展示台与主角赛车压轴弹出（3.3s -> 4.3s）
    const heroT = THREE.MathUtils.clamp((t - 3.3) / 0.85, 0, 1);
    if (heroT > 0) {
      const sHero = Math.max(0.01, easeOutBack(heroT));
      if (this.targets.pedestal) this.targets.pedestal.scale.setScalar(sHero);
      if (this.targets.showcaseCar) this.targets.showcaseCar.scale.setScalar(sHero);
    }

    // 6. 二阶贝塞尔唯美运镜俯冲进大厅
    const camU = easeInOutCubic(THREE.MathUtils.clamp(t / this.duration, 0, 1));
    const om = 1 - camU;
    this.tmpPos
      .set(0, 0, 0)
      .addScaledVector(this.camStart, om * om)
      .addScaledVector(this.camMid, 2 * om * camU)
      .addScaledVector(this.camEnd, camU * camU);
    this.tmpLook.copy(this.lookStart).lerp(this.lookEnd, camU);
    this.targets.camera.position.copy(this.tmpPos);
    this.targets.camera.lookAt(this.tmpLook);

    if (t >= this.duration) {
      this.finish();
    }
  }

  finish(): void {
    if (this.state === 'done') return;
    this.state = 'done';
    this.targets.trackGroup.scale.set(1, 1, 1);
    if (this.targets.pedestal) this.targets.pedestal.scale.set(1, 1, 1);
    if (this.targets.showcaseCar) this.targets.showcaseCar.scale.set(1, 1, 1);
    for (const { prop } of this.orderedProps) {
      prop.popped = true;
      prop.elapsed = 0.6;
      prop.rootPivot.rotation.x = 0;
      prop.topGroup.scale.set(1, 1, 1);
    }
    this.targets.scene.remove(this.group);
    this.targets.onComplete();
  }

  dispose(): void {
    this.targets.scene.remove(this.group);
    this.coverMats.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    this.dustPoints.geometry.dispose();
    (this.dustPoints.material as THREE.Material).dispose();
  }
}
