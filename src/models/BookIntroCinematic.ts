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

/** 绘制复古墨绿布纹 + 烫金花环 + 中央水彩童话插画圆窗封面 */
function createStorybookCoverTexture(): THREE.CanvasTexture {
  const W = 768;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. 复古森林墨绿亚麻布纹底色
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#274c43');
  bg.addColorStop(0.55, '#1d3a33');
  bg.addColorStop(1, '#142924');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 细腻布艺纹理
  ctx.fillStyle = 'rgba(255, 245, 220, 0.035)';
  for (let i = 0; i < 7000; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 3, 1);
  }

  // 2. 左侧压痕书脊带
  const spine = ctx.createLinearGradient(0, 0, 58, 0);
  spine.addColorStop(0, 'rgba(255,255,255,0.08)');
  spine.addColorStop(0.65, 'rgba(0,0,0,0.42)');
  spine.addColorStop(1, 'rgba(255,235,190,0.12)');
  ctx.fillStyle = spine;
  ctx.fillRect(0, 0, 58, H);

  // 3. 双层精致烫金雕花边线
  ctx.strokeStyle = 'rgba(238, 204, 130, 0.85)';
  ctx.lineWidth = 5;
  ctx.strokeRect(86, 54, W - 134, H - 108);
  ctx.strokeStyle = 'rgba(238, 204, 130, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(102, 70, W - 166, H - 140);

  // 4. 中央童话水彩圆窗插画（蓝天 + 青绿山丘 + 白云 + 暖红小车剪影）
  const cx = W * 0.525;
  const cy = H * 0.4;
  const R = 168;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // 圆窗内渐变蓝天
  const sky = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
  sky.addColorStop(0, '#6dc3f2');
  sky.addColorStop(0.62, '#d8f1ff');
  sky.addColorStop(1, '#fff6df');
  ctx.fillStyle = sky;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // 暖太阳光晕
  const sun = ctx.createRadialGradient(cx + 55, cy - 68, 6, cx + 55, cy - 68, 72);
  sun.addColorStop(0, '#fff7cc');
  sun.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // 远近两层剪纸小山丘
  ctx.fillStyle = '#8ad09a';
  ctx.beginPath();
  ctx.arc(cx - 75, cy + 120, 145, 0, Math.PI * 2);
  ctx.arc(cx + 85, cy + 135, 135, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#62a85f';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 148, 210, 92, 0, 0, Math.PI * 2);
  ctx.fill();

  // 蜿蜒卡其小路
  ctx.strokeStyle = '#d4b895';
  ctx.lineWidth = 32;
  ctx.beginPath();
  ctx.moveTo(cx - 110, cy + 170);
  ctx.quadraticCurveTo(cx - 10, cy + 95, cx + 95, cy + 78);
  ctx.stroke();

  // 一朵柔软白云
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.arc(cx - 65, cy - 62, 22, 0, Math.PI * 2);
  ctx.arc(cx - 42, cy - 70, 28, 0, Math.PI * 2);
  ctx.arc(cx - 18, cy - 60, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 圆窗外双层烫金画框
  ctx.strokeStyle = '#f2cf82';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(242, 207, 130, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 16, 0, Math.PI * 2);
  ctx.stroke();

  // 5. 烫金书名与副标
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fcf4df';
  ctx.font = 'bold 74px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('折纸大奖赛', cx, H * 0.72);

  ctx.fillStyle = 'rgba(242, 207, 130, 0.92)';
  ctx.font = '600 28px Georgia, serif';
  ctx.fillText('ORIGAMI GRAND PRIX', cx, H * 0.78);

  ctx.fillStyle = 'rgba(232, 240, 232, 0.7)';
  ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('VOL. I · 午后书桌的奇幻竞速', cx, H * 0.86);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 书页侧面细腻的纸层横纹贴图 */
function createPageEdgeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8f0dc';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(130, 105, 75, 0.22)' : 'rgba(255, 252, 242, 0.5)';
    ctx.fillRect(0, y, 128, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

/** 暖胡桃木书房桌面纹理（带自然木纹与柔和暗角） */
function createWarmDeskTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#4a3121';
  ctx.fillRect(0, 0, size, size);

  // 柔和横向木纹
  for (let y = 0; y < size; y += 2) {
    const shade = Math.sin(y * 0.08) * 10 + Math.sin(y * 0.31) * 6;
    ctx.fillStyle = `rgba(${72 + shade}, ${46 + shade * 0.6}, ${30 + shade * 0.4}, 0.45)`;
    ctx.fillRect(0, y, size, 2);
  }

  // 中心台灯暖晕 + 四周柔和暗角
  const vig = ctx.createRadialGradient(size * 0.5, size * 0.48, size * 0.08, size * 0.5, size * 0.5, size * 0.65);
  vig.addColorStop(0, 'rgba(255, 214, 150, 0.24)');
  vig.addColorStop(0.55, 'rgba(42, 26, 16, 0.15)');
  vig.addColorStop(1, 'rgba(18, 11, 7, 0.78)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDustTexture(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255, 248, 216, 1)');
  g.addColorStop(0.42, 'rgba(255, 224, 148, 0.5)');
  g.addColorStop(1, 'rgba(255, 224, 148, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 精致轻盈的 3D 白金折纸千纸鹤 */
function buildIntroCrane(): {
  root: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
} {
  const root = new THREE.Group();
  const whiteMat = createPaperMaterial(0xfffdf6, undefined, 0.85);
  const goldMat = createPaperMaterial(0xf4d35e, undefined, 0.78);
  const beakMat = createEmissivePaper(0xe05a47, 0xe05a47, 0.35);

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), whiteMat);
  body.scale.set(0.85, 0.65, 1.55);
  body.castShadow = true;
  root.add(body);

  const neck = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.5, 4), whiteMat);
  neck.position.set(0, 1.15, 1.8);
  neck.rotation.x = 0.65;
  neck.castShadow = true;
  root.add(neck);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 4), beakMat);
  head.rotation.x = Math.PI / 2 + 0.3;
  head.position.set(0, 1.98, 2.7);
  root.add(head);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.46, 2.7, 4), goldMat);
  tail.position.set(0, 1.25, -2.1);
  tail.rotation.x = -0.68;
  tail.castShadow = true;
  root.add(tail);

  const makeWing = (s: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.58, 0.18, 0.08);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0, 1.25,      s * 4.8, 0.35, -0.45,   0, 0, -1.3,
          0, 0, 1.25,      s * 2.6, 0.65, 1.0,     s * 4.8, 0.35, -0.45,
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
 * 电影级 3D 午后书房桌面开场：
 * - 真实 3:4 厚精装硬壳绘本（层叠纸页 + 圆弧烫金书脊 + 铜包角 + 红丝带 + 水彩插画封面）
 * - 专属暖胡桃木书桌舞台 + 暖金台灯聚光灯 + 金色阳光微尘
 * - 栖息书角的千纸鹤振翅起飞吹开书页 -> 立体世界按涟漪依次弹出
 */
export class BookIntroCinematic {
  private targets: BookIntroTargets;
  private group = new THREE.Group();
  private bookGroup = new THREE.Group();
  private coverPivot = new THREE.Group();
  private fadeMats: THREE.Material[] = [];
  private spotLight: THREE.SpotLight;
  private crane: ReturnType<typeof buildIntroCrane>;
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

    // 1. 专属暖胡桃木书房桌面舞台（开场完全遮住四周草地，翻书后温柔淡出）
    const deskMat = new THREE.MeshStandardMaterial({
      map: createWarmDeskTexture(),
      roughness: 0.72,
      metalness: 0.05,
      transparent: true,
      opacity: 1,
    });
    this.fadeMats.push(deskMat);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(540, 540), deskMat);
    desk.rotation.x = -Math.PI / 2;
    desk.position.set(center.x, 1.5, center.z);
    desk.receiveShadow = true;
    this.group.add(desk);

    // 2. 真实 3:4 比例厚精装硬壳绘本（宽 72 x 长 96 x 厚 9.6）
    const bookW = 72;
    const bookD = 96;
    const pageH = 8.4;
    const boardH = 1.1;
    this.bookGroup.position.set(center.x, 1.55, center.z);

    const coverBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1c3831,
      roughness: 0.82,
      transparent: true,
      opacity: 1,
    });
    const goldBrassMat = new THREE.MeshStandardMaterial({
      color: 0xe6c170,
      roughness: 0.35,
      metalness: 0.55,
      transparent: true,
      opacity: 1,
    });
    const pageEdgeMat = new THREE.MeshStandardMaterial({
      map: createPageEdgeTexture(),
      roughness: 0.92,
      transparent: true,
      opacity: 1,
    });
    const innerPageMat = new THREE.MeshStandardMaterial({
      color: 0xfcf6e8,
      roughness: 0.94,
      transparent: true,
      opacity: 1,
    });
    const topCoverMat = new THREE.MeshStandardMaterial({
      map: createStorybookCoverTexture(),
      roughness: 0.75,
      metalness: 0.08,
      transparent: true,
      opacity: 1,
    });
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xd94e3f,
      roughness: 0.65,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });
    this.fadeMats.push(coverBaseMat, goldBrassMat, pageEdgeMat, innerPageMat, topCoverMat, ribbonMat);

    // 下封底硬壳
    const backCover = new THREE.Mesh(new THREE.BoxGeometry(bookW + 2, boardH, bookD + 3), coverBaseMat);
    backCover.position.set(0, boardH / 2, 0);
    backCover.castShadow = true;
    backCover.receiveShadow = true;
    this.bookGroup.add(backCover);

    // 厚实层叠米白书页块
    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(bookW - 2.5, pageH, bookD - 3),
      [pageEdgeMat, pageEdgeMat, innerPageMat, innerPageMat, pageEdgeMat, pageEdgeMat]
    );
    pageBlock.position.set(0.6, boardH + pageH / 2, 0);
    pageBlock.castShadow = true;
    pageBlock.receiveShadow = true;
    this.bookGroup.add(pageBlock);

    // 左侧圆弧精装书脊 + 4 道烫金书脊棱条
    const spineR = (pageH + boardH * 2) * 0.52;
    const spineMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(spineR, spineR, bookD + 3, 18, 1, false, Math.PI, Math.PI),
      coverBaseMat
    );
    spineMesh.rotation.x = Math.PI / 2;
    spineMesh.position.set(-bookW / 2 - 0.6, spineR, 0);
    spineMesh.castShadow = true;
    this.bookGroup.add(spineMesh);

    for (const zOff of [-34, -12, 12, 34]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(spineR + 0.15, 0.35, 8, 18, Math.PI), goldBrassMat);
      rib.rotation.y = Math.PI / 2;
      rib.rotation.z = Math.PI / 2;
      rib.position.set(-bookW / 2 - 0.6, spineR, zOff);
      this.bookGroup.add(rib);
    }

    // 垂出书页底部的红丝带书签
    const bookmark = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 16), ribbonMat);
    bookmark.rotation.x = -Math.PI / 2 + 0.04;
    bookmark.position.set(12, 0.35, bookD / 2 + 6);
    this.bookGroup.add(bookmark);

    // 顶层精装硬壳封面（绕左侧书脊顶部铰链翻转）
    this.coverPivot.position.set(-bookW / 2 - 0.8, boardH + pageH, 0);
    const lidGeo = new THREE.BoxGeometry(bookW + 2, boardH, bookD + 3);
    lidGeo.translate((bookW + 2) / 2, boardH / 2, 0);
    const lid = new THREE.Mesh(lidGeo, [
      goldBrassMat,
      coverBaseMat,
      topCoverMat,
      innerPageMat,
      goldBrassMat,
      goldBrassMat,
    ]);
    lid.castShadow = true;
    lid.receiveShadow = true;
    this.coverPivot.add(lid);

    // 封面右侧两个精致黄铜护角
    for (const zSign of [-1, 1]) {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(5.5, boardH + 0.25, 5.5), goldBrassMat);
      corner.position.set(bookW - 0.5, boardH / 2, zSign * (bookD / 2 - 1.2));
      this.coverPivot.add(corner);
    }
    this.bookGroup.add(this.coverPivot);

    // 书桌右侧散落的文艺文具（铅笔 + 珊瑚红和纸胶带）
    const pencil = new THREE.Group();
    const pMat1 = createPaperMaterial(0xf4d35e);
    const pMat2 = createPaperMaterial(0xe8c9a0);
    const pMat3 = createPaperMaterial(0x2d241e);
    const pMat4 = createPaperMaterial(0xf4a6b8);
    [pMat1, pMat2, pMat3, pMat4].forEach((m) => {
      m.transparent = true;
      this.fadeMats.push(m);
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 46, 6), pMat1);
    shaft.rotation.z = Math.PI / 2;
    shaft.castShadow = true;
    pencil.add(shaft);
    const wood = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5.5, 6), pMat2);
    wood.rotation.z = -Math.PI / 2;
    wood.position.x = 25.5;
    pencil.add(wood);
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 6), pMat3);
    lead.rotation.z = -Math.PI / 2;
    lead.position.x = 28.8;
    pencil.add(lead);
    const era = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4, 6), pMat4);
    era.rotation.z = Math.PI / 2;
    era.position.x = -24.5;
    pencil.add(era);
    pencil.position.set(bookW * 0.78, 1.45, 16);
    pencil.rotation.y = 0.85;
    this.bookGroup.add(pencil);

    const tapeMat = createPaperMaterial(0xe05a47);
    const tapeCoreMat = createPaperMaterial(0xfaf3e3);
    tapeMat.transparent = true;
    tapeCoreMat.transparent = true;
    this.fadeMats.push(tapeMat, tapeCoreMat);
    const tapeRoll = new THREE.Group();
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 4.4, 20, 1, true), tapeMat);
    roll.castShadow = true;
    tapeRoll.add(roll);
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.4, 7.2, 20), tapeCoreMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2.22;
    tapeRoll.add(ring);
    tapeRoll.position.set(bookW * 0.82, 2.25, -26);
    this.bookGroup.add(tapeRoll);

    this.group.add(this.bookGroup);

    // 3. 专属午后台灯暖金聚光灯（只打亮精装书与千纸鹤，营造电影暗角）
    this.spotLight = new THREE.SpotLight(0xffe1a8, 120, 260, Math.PI / 4, 0.65, 1.2);
    this.spotLight.position.set(center.x + 36, 76, center.z + 42);
    this.spotLight.target.position.set(center.x, 6, center.z);
    this.group.add(this.spotLight);
    this.group.add(this.spotLight.target);

    // 4. 停在精装书右下角的白金千纸鹤
    this.crane = buildIntroCrane();
    this.cranePerch.set(center.x + bookW * 0.28, 1.55 + boardH * 2 + pageH + 1.5, center.z + bookD * 0.25);
    this.crane.root.position.copy(this.cranePerch);
    this.crane.root.rotation.y = -0.95;
    this.group.add(this.crane.root);

    // 5. 180 颗金色阳光微尘
    const dustCount = 180;
    const dustPos = new Float32Array(dustCount * 3);
    this.dustBaseY = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = center.x + (Math.random() - 0.5) * 140;
      const y = 4 + Math.random() * 44;
      dustPos[i * 3 + 1] = y;
      this.dustBaseY[i] = y;
      dustPos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 140;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      map: createDustTexture(),
      size: 2.0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.group.add(this.dustPoints);
    scene.add(this.group);

    // 6. 收纳书内 3D 世界，等待翻书后依次弹出
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
      const delay = 2.05 + (idx / total) * 2.0;
      return { prop, delay, localT: 0 };
    });

    // 黄金低斜角电影机位（突出书本厚度、圆弧书脊与千纸鹤立体剪影）
    this.camStart.set(center.x + 28, 46, center.z + 94);
    this.camMid.set(center.x + 26, 36, center.z + 64);
    this.camEnd.set(center.x + 17, 8.5, center.z + 17);
    this.lookStart.set(center.x + 2, 7, center.z + 4);
    this.lookEnd.set(center.x, 3.6, center.z);
  }

  get isFinished(): boolean {
    return this.state === 'done';
  }

  get isIdle(): boolean {
    return this.state === 'idle';
  }

  triggerOpen(): void {
    if (this.state !== 'idle') return;
    this.state = 'opening';
    this.elapsed = 0;
    this.camStart.copy(this.targets.camera.position);
  }

  update(dt: number): void {
    if (this.state === 'done') return;

    const dustTime = this.state === 'idle' ? this.idleTime : this.idleTime + this.elapsed;
    const dPos = this.dustPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dPos.count; i++) {
      dPos.setY(i, this.dustBaseY[i] + Math.sin(dustTime * 0.9 + i * 0.7) * 2.0);
    }
    dPos.needsUpdate = true;

    if (this.state === 'idle') {
      this.idleTime += dt;
      // 柔和的电影呼吸微移镜头
      this.targets.camera.position.set(
        this.camStart.x + Math.sin(this.idleTime * 0.35) * 9,
        this.camStart.y + Math.sin(this.idleTime * 0.48) * 2.4,
        this.camStart.z + Math.cos(this.idleTime * 0.28) * 5
      );
      this.targets.camera.lookAt(this.lookStart);

      // 千纸鹤在书角轻扇翅膀呼吸
      const breathFlap = 0.2 + Math.sin(this.idleTime * 2.5) * 0.14;
      this.crane.leftWing.rotation.z = breathFlap;
      this.crane.rightWing.rotation.z = -breathFlap;
      this.crane.root.position.y = this.cranePerch.y + Math.sin(this.idleTime * 2.5) * 0.25;
      return;
    }

    // ---------- 阶段 2：千纸鹤振翅飞起 -> 吹开精装厚封面 -> 书桌沉降淡出 -> 3D 世界涟漪弹出 ----------
    this.elapsed += dt;
    const t = this.elapsed;

    // 1. 千纸鹤振翅腾空盘旋
    const flap = Math.sin(t * 11.5) * 0.56;
    this.crane.leftWing.rotation.z = flap;
    this.crane.rightWing.rotation.z = -flap;
    const craneU = THREE.MathUtils.clamp(t / 3.6, 0, 1);
    const orbitAngle = -0.9 + craneU * Math.PI * 1.5;
    const orbitR = 44 * (1 - craneU * 0.3);
    const craneY = this.cranePerch.y + Math.sin(craneU * Math.PI * 0.85) * 32 + craneU * 30;
    const nx = this.targets.center.x + Math.cos(orbitAngle) * orbitR;
    const nz = this.targets.center.z + Math.sin(orbitAngle) * orbitR;
    this.crane.root.lookAt(nx, craneY + 1.5, nz);
    this.crane.root.position.set(nx, craneY, nz);
    this.crane.root.visible = t < 3.8;

    // 2. 精装硬壳封面绕圆弧书脊翻开（0.55s -> 2.15s）
    const openT = THREE.MathUtils.clamp((t - 0.55) / 1.6, 0, 1);
    this.coverPivot.rotation.z = easeInOutCubic(openT) * Math.PI * 0.96;

    // 3. 封面展开后（1.75s -> 2.75s），外部书壳与暗木桌面平滑淡出沉降，无缝切入整个 3D 立体书世界
    if (t > 1.75) {
      const fade = 1 - THREE.MathUtils.clamp((t - 1.75) / 1.0, 0, 1);
      for (const m of this.fadeMats) {
        if ('opacity' in m) (m as THREE.MeshStandardMaterial).opacity = fade;
      }
      this.spotLight.intensity = 120 * fade;
      this.bookGroup.position.y = 1.55 - (1 - fade) * 4.5;
      this.bookGroup.visible = fade > 0.02;
    }

    // 4. 赛道从书页浮起（1.8s -> 2.65s）
    const trackT = THREE.MathUtils.clamp((t - 1.8) / 0.85, 0, 1);
    const trackScaleY = Math.max(0.01, easeOutBack(trackT));
    this.targets.trackGroup.scale.set(1, Math.min(1.06, trackScaleY), 1);
    if (trackT >= 1) this.targets.trackGroup.scale.set(1, 1, 1);

    // 5. 92 个立体书景物按涟漪依次弹出
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

    // 6. 中央展示台与胖卡丁车压轴弹出（3.35s -> 4.35s）
    const heroT = THREE.MathUtils.clamp((t - 3.35) / 0.85, 0, 1);
    if (heroT > 0) {
      const sHero = Math.max(0.01, easeOutBack(heroT));
      if (this.targets.pedestal) this.targets.pedestal.scale.setScalar(sHero);
      if (this.targets.showcaseCar) this.targets.showcaseCar.scale.setScalar(sHero);
    }

    // 7. 唯美二阶贝塞尔俯冲运镜
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
      prop.elapsed = 0.72;
      prop.rootPivot.rotation.x = 0;
      prop.topGroup.scale.set(1, 1, 1);
    }
    this.targets.scene.remove(this.group);
    this.targets.onComplete();
  }

  dispose(): void {
    this.targets.scene.remove(this.group);
    this.fadeMats.forEach((m) => m.dispose());
    this.dustPoints.geometry.dispose();
    (this.dustPoints.material as THREE.Material).dispose();
  }
}
