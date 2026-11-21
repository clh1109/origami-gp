import * as THREE from 'three';
import type { PopupPropRig } from '../types/game';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 绘制高精细 3D 精装绘本封面纹理（深蓝布纹 + 烫金花纹边框 + 红丝带 + 书名） */
function createBookCoverTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. 深海蓝精装布纹底色
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2c4466');
  bg.addColorStop(0.55, '#1e304a');
  bg.addColorStop(1, '#142133');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 细腻布纹肌理
  ctx.fillStyle = 'rgba(255, 248, 230, 0.03)';
  for (let i = 0; i < 6000; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1);
  }

  // 2. 左侧精装书脊压痕带
  const spine = ctx.createLinearGradient(0, 0, 76, 0);
  spine.addColorStop(0, 'rgba(255,255,255,0.08)');
  spine.addColorStop(0.65, 'rgba(0,0,0,0.38)');
  spine.addColorStop(1, 'rgba(255,240,200,0.12)');
  ctx.fillStyle = spine;
  ctx.fillRect(0, 0, 76, H);

  // 3. 双层烫金雕花外框
  ctx.strokeStyle = 'rgba(238, 204, 130, 0.78)';
  ctx.lineWidth = 6;
  ctx.strokeRect(112, 72, W - 180, H - 144);
  ctx.strokeStyle = 'rgba(238, 204, 130, 0.38)';
  ctx.lineWidth = 2;
  ctx.strokeRect(132, 92, W - 220, H - 184);

  // 4. 烫金折纸星星与四叶徽章
  const cx = W * 0.54;
  const cy = H * 0.34;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(244, 214, 148, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.stroke();
  // 折纸菱形星
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

  // 5. 烫金书名与副标
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

  // 6. 右上角红丝带书签
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

/** 唯美金色阳光微尘粒子贴图 */
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

/**
 * 3D 唯美自动翻书开场演出控制器（总时长约 5.2 秒）：
 * 0.0–0.6s 书桌定格微尘飘动 -> 0.6–2.3s 精装书封面自动翻开
 * -> 1.7–4.2s 赛道与 92 个立体书景物按涟漪波浪顺序依次弹起
 * -> 3.3–4.4s 展台与主角赛车弹起 -> 5.2s 镜头丝滑落位大厅
 */
export class BookIntroCinematic {
  private targets: BookIntroTargets;
  private group = new THREE.Group();
  private coverPivot = new THREE.Group();
  private coverMats: THREE.MeshStandardMaterial[] = [];
  private dustPoints: THREE.Points;
  private dustBaseY: Float32Array;

  // 按离中心距离排序的立体书景物及其延迟触发时间
  private orderedProps: { prop: PopupPropRig; delay: number; localT: number }[] = [];
  private elapsed = 0;
  private finished = false;
  private readonly duration = 5.2;

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

    // 1. 构建 3D 精装书封面（覆盖在立体书舞台上，左侧书脊为铰链）
    const bookW = 210;
    const bookD = 210;
    const bookThick = 1.4;
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
      color: 0xe6c47a, // 金边书页
      roughness: 0.55,
      metalness: 0.25,
      transparent: true,
      opacity: 1,
    });
    this.coverMats = [topMat, innerMat, edgeMat];

    // BoxGeometry 材质顺序: [+x, -x, +y(封面朝上), -y(翻开后的米白内封), +z, -z]
    const lidGeo = new THREE.BoxGeometry(bookW, bookThick, bookD);
    lidGeo.translate(bookW * 0.5, bookThick * 0.5, 0);
    const lid = new THREE.Mesh(lidGeo, [edgeMat, edgeMat, topMat, innerMat, edgeMat, edgeMat]);
    lid.castShadow = true;
    lid.receiveShadow = true;
    this.coverPivot.add(lid);
    this.group.add(this.coverPivot);

    // 2. 空气中缓缓飘升的 180 颗暖金色阳光微尘（营造唯美绘本光感）
    const dustCount = 180;
    const dustPos = new Float32Array(dustCount * 3);
    this.dustBaseY = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = center.x + (Math.random() - 0.5) * 190;
      const y = 3 + Math.random() * 52;
      dustPos[i * 3 + 1] = y;
      this.dustBaseY[i] = y;
      dustPos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 190;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      map: createDustTexture(),
      size: 2.6,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.group.add(this.dustPoints);
    scene.add(this.group);

    // 3. 把书里的世界先压平收纳进书页里，准备依次弹起
    trackGroup.scale.set(1, 0.01, 1);
    if (pedestal) pedestal.scale.set(0.01, 0.01, 0.01);
    if (showcaseCar) showcaseCar.scale.set(0.01, 0.01, 0.01);

    // 将 92 个立体书景物按距离中心由近到远排队，形成“一个接一个冒出来”的波浪效果
    const sorted = [...props].sort(
      (a, b) => a.rootPivot.position.distanceTo(center) - b.rootPivot.position.distanceTo(center)
    );
    const total = Math.max(1, sorted.length);
    this.orderedProps = sorted.map((prop, idx) => {
      prop.popped = false;
      prop.elapsed = 0;
      prop.rootPivot.rotation.x = -Math.PI / 2;
      prop.topGroup.scale.set(0.01, 0.01, 0.01);
      // 1.75s 开始，每隔 ~0.02s 依次冒出一个，持续到 3.8s
      const delay = 1.75 + (idx / total) * 2.05;
      return { prop, delay, localT: 0 };
    });

    // 4. 设定唯美运镜三点（高空俯瞰合上的绘本 -> 翻书时的斜45°全景 -> 落位大厅展台）
    this.camStart.set(center.x + 22, 138, center.z + 148);
    this.camMid.set(center.x + 28, 52, center.z + 78);
    this.camEnd.set(center.x + 17, 8.5, center.z + 17);
    this.lookStart.set(center.x, 2, center.z);
    this.lookEnd.set(center.x, 3.6, center.z);
  }

  get isFinished(): boolean {
    return this.finished;
  }

  update(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;
    const t = this.elapsed;

    // 1. 封面自动打开（0.55s -> 2.35s，从 0° 缓缓翻开到 174°）
    const openT = THREE.MathUtils.clamp((t - 0.55) / 1.8, 0, 1);
    this.coverPivot.rotation.z = easeInOutCubic(openT) * Math.PI * 0.96;

    // 封面翻开平放后（2.8s -> 3.8s）柔和淡出，避免挡住左侧远景
    if (t > 2.8) {
      const fade = 1 - THREE.MathUtils.clamp((t - 2.8) / 1.0, 0, 1);
      for (const m of this.coverMats) m.opacity = fade;
      this.coverPivot.visible = fade > 0.02;
    }

    // 2. 赛道纸带随书页展开浮起（1.45s -> 2.35s）
    const trackT = THREE.MathUtils.clamp((t - 1.45) / 0.9, 0, 1);
    const trackScaleY = Math.max(0.01, easeOutBack(trackT));
    this.targets.trackGroup.scale.set(1, Math.min(1.06, trackScaleY), 1);
    if (trackT >= 1) this.targets.trackGroup.scale.set(1, 1, 1);

    // 3. 92 个立体书景物（树、花、风车）按距离由近及远一个一个“啪嗒”弹出来！
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

    // 4. 中央展示台与主角折纸赛车压轴弹出（3.1s -> 4.1s）
    const heroT = THREE.MathUtils.clamp((t - 3.1) / 0.85, 0, 1);
    if (heroT > 0) {
      const sHero = Math.max(0.01, easeOutBack(heroT));
      if (this.targets.pedestal) this.targets.pedestal.scale.setScalar(sHero);
      if (this.targets.showcaseCar) this.targets.showcaseCar.scale.setScalar(sHero);
    }

    // 5. 金色微尘柔缓漂浮
    const dPos = this.dustPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dPos.count; i++) {
      const y = this.dustBaseY[i] + Math.sin(t * 0.9 + i * 0.7) * 2.4 + t * 0.8;
      dPos.setY(i, y);
    }
    dPos.needsUpdate = true;

    // 6. 二阶贝塞尔唯美运镜俯冲
    const camU = easeInOutCubic(THREE.MathUtils.clamp(t / this.duration, 0, 1));
    const oneMinus = 1 - camU;
    this.tmpPos
      .set(0, 0, 0)
      .addScaledVector(this.camStart, oneMinus * oneMinus)
      .addScaledVector(this.camMid, 2 * oneMinus * camU)
      .addScaledVector(this.camEnd, camU * camU);
    this.tmpLook.copy(this.lookStart).lerp(this.lookEnd, camU);
    this.targets.camera.position.copy(this.tmpPos);
    this.targets.camera.lookAt(this.tmpLook);

    if (t >= this.duration) {
      this.finish();
    }
  }

  /** 跳过或自然结束：确保全部物体 100% 展开并清理封面 */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
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
    this.dustPoints.geometry.dispose();
    const dustMat = this.dustPoints.material as THREE.PointsMaterial;
    dustMat.map?.dispose();
    dustMat.dispose();
  }
}
