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

/** 复古墨绿布纹 + 烫金枝叶星辰 + 中央童话水彩圆窗封面 */
function createStorybookCoverTexture(): THREE.CanvasTexture {
  const W = 768;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#274d44');
  bg.addColorStop(0.55, '#1b3832');
  bg.addColorStop(1, '#122622');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255, 245, 220, 0.035)';
  for (let i = 0; i < 6500; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 3, 1);
  }

  // 左侧精装压痕书脊
  const spine = ctx.createLinearGradient(0, 0, 58, 0);
  spine.addColorStop(0, 'rgba(255,255,255,0.08)');
  spine.addColorStop(0.65, 'rgba(0,0,0,0.42)');
  spine.addColorStop(1, 'rgba(255,235,190,0.12)');
  ctx.fillStyle = spine;
  ctx.fillRect(0, 0, 58, H);

  // 烫金双层花纹外框 + 四角小星芒
  ctx.strokeStyle = 'rgba(244, 212, 138, 0.88)';
  ctx.lineWidth = 5;
  ctx.strokeRect(86, 54, W - 134, H - 108);
  ctx.strokeStyle = 'rgba(244, 212, 138, 0.42)';
  ctx.lineWidth = 2;
  ctx.strokeRect(102, 70, W - 166, H - 140);

  const drawStar = (x: number, y: number, r: number) => {
    ctx.fillStyle = '#fae09e';
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.28, y - r * 0.28);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.28, y + r * 0.28);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.28, y + r * 0.28);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - r * 0.28, y - r * 0.28);
    ctx.closePath();
    ctx.fill();
  };
  drawStar(132, 102, 16);
  drawStar(W - 86, 102, 16);
  drawStar(132, H - 102, 16);
  drawStar(W - 86, H - 102, 16);

  // 中央童话水彩圆窗（蓝天 + 金阳 + 彩虹拱 + 青绿山丘 + 白云）
  const cx = W * 0.525;
  const cy = H * 0.4;
  const R = 168;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  const sky = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
  sky.addColorStop(0, '#6dc3f2');
  sky.addColorStop(0.62, '#d8f1ff');
  sky.addColorStop(1, '#fff6df');
  ctx.fillStyle = sky;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // 柔和童话小彩虹
  const rbColors = ['rgba(244,140,140,0.45)', 'rgba(248,210,120,0.45)', 'rgba(140,215,165,0.45)'];
  rbColors.forEach((col, i) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy + 72, 128 - i * 11, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  });

  const sun = ctx.createRadialGradient(cx + 55, cy - 68, 6, cx + 55, cy - 68, 76);
  sun.addColorStop(0, '#fff9d6');
  sun.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  ctx.fillStyle = '#8ad09a';
  ctx.beginPath();
  ctx.arc(cx - 75, cy + 120, 145, 0, Math.PI * 2);
  ctx.arc(cx + 85, cy + 135, 135, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#62a85f';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 148, 210, 92, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d4b895';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(cx - 110, cy + 170);
  ctx.quadraticCurveTo(cx - 10, cy + 95, cx + 95, cy + 78);
  ctx.stroke();

  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.arc(cx - 65, cy - 62, 22, 0, Math.PI * 2);
  ctx.arc(cx - 42, cy - 70, 28, 0, Math.PI * 2);
  ctx.arc(cx - 18, cy - 60, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

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

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fcf4df';
  ctx.font = 'bold 74px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('折纸大奖赛', cx, H * 0.72);

  ctx.fillStyle = 'rgba(242, 207, 130, 0.92)';
  ctx.font = '600 28px Georgia, serif';
  ctx.fillText('ORIGAMI GRAND PRIX', cx, H * 0.78);

  ctx.fillStyle = 'rgba(232, 240, 232, 0.78)';
  ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('✦ 童话立体绘本 · 第一卷 ✦', cx, H * 0.86);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

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

function createWarmDeskTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#432c1e';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    const shade = Math.sin(y * 0.08) * 10 + Math.sin(y * 0.31) * 6;
    ctx.fillStyle = `rgba(${68 + shade}, ${43 + shade * 0.6}, ${28 + shade * 0.4}, 0.45)`;
    ctx.fillRect(0, y, size, 2);
  }
  const vig = ctx.createRadialGradient(size * 0.5, size * 0.48, size * 0.08, size * 0.5, size * 0.5, size * 0.65);
  vig.addColorStop(0, 'rgba(255, 222, 158, 0.28)');
  vig.addColorStop(0.55, 'rgba(38, 24, 15, 0.18)');
  vig.addColorStop(1, 'rgba(14, 9, 6, 0.84)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGlowTexture(inner = 'rgba(255,248,220,1)', mid = 'rgba(255,224,148,0.5)'): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, 'rgba(255, 232, 180, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 栖息书角的白金折纸千纸鹤 */
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

/** 发光童话折纸小蝴蝶（绕着书本翩翩飞舞） */
function buildFairyButterfly(colorHex: number): {
  root: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
} {
  const root = new THREE.Group();
  const mat = createEmissivePaper(colorHex, colorHex, 0.9);
  mat.side = THREE.DoubleSide;
  const wingGeo = new THREE.CircleGeometry(1.1, 5);
  wingGeo.scale(1.2, 0.85, 1);

  const wingL = new THREE.Mesh(wingGeo, mat);
  wingL.position.x = -0.8;
  const wingR = new THREE.Mesh(wingGeo, mat);
  wingR.position.x = 0.8;
  root.add(wingR, wingL);
  return { root, wingL, wingR };
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
 * 迪士尼/吉卜力风格 3D 魔法童话书开场 + 无缝钻进书页柔光过渡：
 * 1. 待机态：童话墨绿绘本 + 书桌暖光提灯 + 羽毛笔墨水瓶 + 4 只发光折纸蝴蝶 + 书角千纸鹤
 * 2. 唤醒后（0–2.4s）：千纸鹤飞起吹开封面 -> 书页绽放魔法金光与迷你立体树
 * 3. 钻进书页过渡（2.1–3.2s）：镜头俯冲冲进书页暖白柔光中，无缝进入真实的 3D 雏菊草甸
 * 4. 世界苏醒（3.0–5.8s）：92 棵大树、风车、主角车按涟漪依次弹出，镜头丝滑接轨大厅
 */
export class BookIntroCinematic {
  private targets: BookIntroTargets;
  private group = new THREE.Group();
  private bookGroup = new THREE.Group();
  private coverPivot = new THREE.Group();
  private miniPopupGroup = new THREE.Group(); // 翻开书页瞬间从书里长出的迷你童话树与星光
  private portalGlowMesh: THREE.Mesh;
  private transitionVeil: THREE.Mesh; // 跟随相机前的暖白童话柔光过渡纱
  private fadeMats: THREE.Material[] = [];
  private spotLight: THREE.SpotLight;
  private lanternLight: THREE.PointLight;
  private crane: ReturnType<typeof buildIntroCrane>;
  private butterflies: { rig: ReturnType<typeof buildFairyButterfly>; radius: number; speed: number; yBase: number; phase: number }[] = [];
  private dustPoints: THREE.Points;
  private dustBaseY: Float32Array;

  private orderedProps: { prop: PopupPropRig; delay: number; localT: number }[] = [];
  private state: 'idle' | 'opening' | 'done' = 'idle';
  private idleTime = 0;
  private elapsed = 0;
  private readonly duration = 5.8;

  private cranePerch = new THREE.Vector3();
  private camStart = new THREE.Vector3();
  private camDive = new THREE.Vector3();
  private camEnd = new THREE.Vector3();
  private lookStart = new THREE.Vector3();
  private lookEnd = new THREE.Vector3();
  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();

  constructor(targets: BookIntroTargets) {
    this.targets = targets;
    const { center, scene, props, trackGroup, pedestal, showcaseCar } = targets;

    // 1. 暖胡桃木书房桌面
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

    // 2. 真实 3:4 比例厚精装童话绘本
    const bookW = 72;
    const bookD = 96;
    const pageH = 8.4;
    const boardH = 1.1;
    this.bookGroup.position.set(center.x, 1.55, center.z);

    const coverBaseMat = new THREE.MeshStandardMaterial({ color: 0x1b3832, roughness: 0.82, transparent: true, opacity: 1 });
    const goldBrassMat = new THREE.MeshStandardMaterial({ color: 0xebc675, roughness: 0.32, metalness: 0.58, transparent: true, opacity: 1 });
    const pageEdgeMat = new THREE.MeshStandardMaterial({ map: createPageEdgeTexture(), roughness: 0.92, transparent: true, opacity: 1 });
    const innerPageMat = new THREE.MeshStandardMaterial({ color: 0xfcf6e8, roughness: 0.94, transparent: true, opacity: 1 });
    const topCoverMat = new THREE.MeshStandardMaterial({ map: createStorybookCoverTexture(), roughness: 0.74, metalness: 0.08, transparent: true, opacity: 1 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xd94e3f, roughness: 0.65, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    this.fadeMats.push(coverBaseMat, goldBrassMat, pageEdgeMat, innerPageMat, topCoverMat, ribbonMat);

    const backCover = new THREE.Mesh(new THREE.BoxGeometry(bookW + 2, boardH, bookD + 3), coverBaseMat);
    backCover.position.set(0, boardH / 2, 0);
    backCover.castShadow = true;
    backCover.receiveShadow = true;
    this.bookGroup.add(backCover);

    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(bookW - 2.5, pageH, bookD - 3),
      [pageEdgeMat, pageEdgeMat, innerPageMat, innerPageMat, pageEdgeMat, pageEdgeMat]
    );
    pageBlock.position.set(0.6, boardH + pageH / 2, 0);
    pageBlock.castShadow = true;
    pageBlock.receiveShadow = true;
    this.bookGroup.add(pageBlock);

    // 左侧圆弧书脊 + 4 道烫金书脊棱
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

    // 红丝带书签
    const bookmark = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 16), ribbonMat);
    bookmark.rotation.x = -Math.PI / 2 + 0.04;
    bookmark.position.set(12, 0.35, bookD / 2 + 6);
    this.bookGroup.add(bookmark);

    // 顶层精装硬壳封面
    this.coverPivot.position.set(-bookW / 2 - 0.8, boardH + pageH, 0);
    const lidGeo = new THREE.BoxGeometry(bookW + 2, boardH, bookD + 3);
    lidGeo.translate((bookW + 2) / 2, boardH / 2, 0);
    const lid = new THREE.Mesh(lidGeo, [goldBrassMat, coverBaseMat, topCoverMat, innerPageMat, goldBrassMat, goldBrassMat]);
    lid.castShadow = true;
    lid.receiveShadow = true;
    this.coverPivot.add(lid);

    for (const zSign of [-1, 1]) {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(5.5, boardH + 0.25, 5.5), goldBrassMat);
      corner.position.set(bookW - 0.5, boardH / 2, zSign * (bookD / 2 - 1.2));
      this.coverPivot.add(corner);
    }
    this.bookGroup.add(this.coverPivot);

    // 3. 书页中央魔法传送光晕 + 翻开时立刻冒出的迷你童话折纸小树与星星
    const portalMat = new THREE.MeshBasicMaterial({
      map: createGlowTexture('rgba(255,252,232,1)', 'rgba(255,222,140,0.65)'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.portalGlowMesh = new THREE.Mesh(new THREE.PlaneGeometry(66, 66), portalMat);
    this.portalGlowMesh.rotation.x = -Math.PI / 2;
    this.portalGlowMesh.position.set(2, boardH + pageH + 0.25, 0);
    this.bookGroup.add(this.portalGlowMesh);

    this.miniPopupGroup.position.set(2, boardH + pageH + 0.1, 0);
    this.miniPopupGroup.scale.set(0.01, 0.01, 0.01);
    const miniTreeSpots: [number, number, number][] = [
      [-14, -14, 1.2], [14, -10, 1.0], [-10, 14, 0.95], [12, 15, 1.15], [0, -2, 1.4],
    ];
    for (const [mx, mz, ms] of miniTreeSpots) {
      const mt = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 2.5, 6), createPaperMaterial(0x7a5638));
      trunk.position.y = 1.25;
      mt.add(trunk);
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3.8, 7), createPaperMaterial(0x5fa15b));
      c1.position.y = 4.0;
      mt.add(c1);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.2, 7), createPaperMaterial(0x88c77a));
      c2.position.y = 6.2;
      mt.add(c2);
      mt.position.set(mx, 0, mz);
      mt.scale.setScalar(ms);
      this.miniPopupGroup.add(mt);
    }
    this.bookGroup.add(this.miniPopupGroup);

    // 4. 童话魔法书桌摆件：暖光小提灯 + 蓝玻璃墨水瓶与白色鹅毛笔 + 压干小雏菊
    const lanternGroup = new THREE.Group();
    const lanternCore = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.2, 6.2, 8),
      createEmissivePaper(0xffe699, 0xffbe42, 1.8)
    );
    lanternCore.position.y = 4.2;
    lanternGroup.add(lanternCore);
    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3.0, 8), goldBrassMat);
    lanternCap.position.y = 8.6;
    lanternGroup.add(lanternCap);
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.2, 1.2, 8), goldBrassMat);
    lanternBase.position.y = 0.6;
    lanternGroup.add(lanternBase);
    lanternGroup.position.set(-bookW * 0.76, 0, -24);
    this.bookGroup.add(lanternGroup);

    this.lanternLight = new THREE.PointLight(0xffcb6b, 95, 130, 1.5);
    this.lanternLight.position.set(center.x - bookW * 0.76, 12, center.z - 24);
    this.group.add(this.lanternLight);

    // 墨水瓶 + 白色复古羽毛笔
    const inkBottle = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.2, 6.0, 10),
      createPaperMaterial(0x3a648a, undefined, 0.4)
    );
    inkBottle.position.set(bookW * 0.76, 3.0, -20);
    inkBottle.castShadow = true;
    this.bookGroup.add(inkBottle);

    const quill = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 26, 4),
      createPaperMaterial(0xfffdf6, undefined, 0.85)
    );
    quill.scale.set(0.35, 1, 0.9);
    quill.position.set(bookW * 0.78, 13.5, -18);
    quill.rotation.z = -0.35;
    quill.rotation.x = 0.18;
    this.bookGroup.add(quill);

    // 桌角几朵童话小雏菊
    for (const [dx, dz] of [[bookW * 0.72, 22], [bookW * 0.82, 12], [-bookW * 0.72, 28]]) {
      const daisy = new THREE.Group();
      const petals = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.35, 10), innerPageMat);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.55, 10), createPaperMaterial(0xffb732));
      daisy.add(petals, core);
      daisy.position.set(dx, 0.3, dz);
      this.bookGroup.add(daisy);
    }

    this.group.add(this.bookGroup);

    // 5. 午后暖金聚光灯 + 停在书角的折纸千纸鹤 + 4 只绕书发光折纸蝴蝶
    this.spotLight = new THREE.SpotLight(0xffe1a8, 125, 260, Math.PI / 4, 0.65, 1.2);
    this.spotLight.position.set(center.x + 36, 76, center.z + 42);
    this.spotLight.target.position.set(center.x, 6, center.z);
    this.group.add(this.spotLight);
    this.group.add(this.spotLight.target);

    this.crane = buildIntroCrane();
    this.cranePerch.set(center.x + bookW * 0.28, 1.55 + boardH * 2 + pageH + 1.5, center.z + bookD * 0.25);
    this.crane.root.position.copy(this.cranePerch);
    this.crane.root.rotation.y = -0.95;
    this.group.add(this.crane.root);

    const bfColors = [0xffe082, 0xf4a6b8, 0x9fd4ea, 0xfff5b8];
    for (let i = 0; i < 4; i++) {
      const rig = buildFairyButterfly(bfColors[i]);
      this.group.add(rig.root);
      this.butterflies.push({
        rig,
        radius: 34 + i * 7,
        speed: (i % 2 === 0 ? 1 : -1) * (0.55 + i * 0.12),
        yBase: 16 + i * 4.5,
        phase: (i * Math.PI) / 2,
      });
    }

    // 6. 200 颗暖金色阳光微尘
    const dustCount = 200;
    const dustPos = new Float32Array(dustCount * 3);
    this.dustBaseY = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = center.x + (Math.random() - 0.5) * 145;
      const y = 4 + Math.random() * 48;
      dustPos[i * 3 + 1] = y;
      this.dustBaseY[i] = y;
      dustPos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 145;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      map: createGlowTexture(),
      size: 2.2,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.group.add(this.dustPoints);

    // 7. 相机前方的暖白童话柔光过渡纱（钻进书页时柔和亮起再散开，彻底消除硬切感）
    const veilMat = new THREE.MeshBasicMaterial({
      color: 0xfff7e2,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    this.transitionVeil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), veilMat);
    this.transitionVeil.renderOrder = 999;
    this.group.add(this.transitionVeil);

    scene.add(this.group);

    // 8. 收纳真实 3D 世界，等穿过柔光后在眼前依次弹出
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
      const delay = 2.75 + (idx / total) * 1.9;
      return { prop, delay, localT: 0 };
    });

    this.camStart.set(center.x + 28, 46, center.z + 94);
    this.camDive.set(center.x + 2, 17, center.z + 10); // 俯冲钻进发光书页中心点
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

    const animTime = this.state === 'idle' ? this.idleTime : this.idleTime + this.elapsed;

    // 金色微尘与发光折纸蝴蝶始终翩翩起舞
    const dPos = this.dustPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dPos.count; i++) {
      dPos.setY(i, this.dustBaseY[i] + Math.sin(animTime * 0.9 + i * 0.7) * 2.2);
    }
    dPos.needsUpdate = true;

    for (const bf of this.butterflies) {
      const a = animTime * bf.speed + bf.phase;
      const bx = this.targets.center.x + Math.cos(a) * bf.radius;
      const bz = this.targets.center.z + Math.sin(a) * bf.radius;
      const by = bf.yBase + Math.sin(animTime * 2.4 + bf.phase) * 2.5;
      bf.rig.root.position.set(bx, by, bz);
      bf.rig.root.rotation.y = -a;
      const wf = Math.sin(animTime * 14 + bf.phase) * 0.65;
      bf.rig.wingL.rotation.y = wf;
      bf.rig.wingR.rotation.y = -wf;
    }

    if (this.state === 'idle') {
      this.idleTime += dt;
      this.targets.camera.position.set(
        this.camStart.x + Math.sin(this.idleTime * 0.35) * 9,
        this.camStart.y + Math.sin(this.idleTime * 0.48) * 2.4,
        this.camStart.z + Math.cos(this.idleTime * 0.28) * 5
      );
      this.targets.camera.lookAt(this.lookStart);

      const breathFlap = 0.2 + Math.sin(this.idleTime * 2.5) * 0.14;
      this.crane.leftWing.rotation.z = breathFlap;
      this.crane.rightWing.rotation.z = -breathFlap;
      this.crane.root.position.y = this.cranePerch.y + Math.sin(this.idleTime * 2.5) * 0.25;
      return;
    }

    // ---------- 阶段 2：千纸鹤飞起 -> 翻书绽放金光 -> 俯冲钻进书页柔光 -> 真实世界依次弹出 ----------
    this.elapsed += dt;
    const t = this.elapsed;

    // 1. 千纸鹤振翅飞起绕书盘旋
    const flap = Math.sin(t * 11.5) * 0.56;
    this.crane.leftWing.rotation.z = flap;
    this.crane.rightWing.rotation.z = -flap;
    const craneU = THREE.MathUtils.clamp(t / 3.4, 0, 1);
    const orbitAngle = -0.9 + craneU * Math.PI * 1.45;
    const orbitR = 42 * (1 - craneU * 0.35);
    const craneY = this.cranePerch.y + Math.sin(craneU * Math.PI * 0.85) * 28 + craneU * 26;
    const nx = this.targets.center.x + Math.cos(orbitAngle) * orbitR;
    const nz = this.targets.center.z + Math.sin(orbitAngle) * orbitR;
    this.crane.root.lookAt(nx, craneY + 1.5, nz);
    this.crane.root.position.set(nx, craneY, nz);
    this.crane.root.visible = t < 3.4;

    // 2. 封面翻开（0.45s -> 1.95s），书页内部魔法金光与迷你树同步弹出
    const openT = THREE.MathUtils.clamp((t - 0.45) / 1.5, 0, 1);
    this.coverPivot.rotation.z = easeInOutCubic(openT) * Math.PI * 0.96;

    const miniT = THREE.MathUtils.clamp((t - 1.05) / 0.85, 0, 1);
    if (miniT > 0) {
      const ms = Math.max(0.01, easeOutBack(miniT));
      this.miniPopupGroup.scale.setScalar(ms);
      (this.portalGlowMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.95, miniT * 1.1);
    }

    // 3. 镜头两段式电影运镜：
    //    前半段（0 -> 2.7s）温柔俯冲钻进发光书页中央；
    //    后半段（2.7s -> 5.8s）穿过柔光后，在真实草甸里缓缓拉远落位到大厅展台！
    if (t < 2.7) {
      const u = easeInOutCubic(t / 2.7);
      this.tmpPos.lerpVectors(this.camStart, this.camDive, u);
      this.tmpLook.copy(this.lookStart);
    } else {
      const u = easeInOutCubic(THREE.MathUtils.clamp((t - 2.7) / (this.duration - 2.7), 0, 1));
      const emergeStart = new THREE.Vector3(this.targets.center.x + 8, 22, this.targets.center.z + 34);
      this.tmpPos.lerpVectors(emergeStart, this.camEnd, u);
      this.tmpLook.lerpVectors(new THREE.Vector3(this.targets.center.x, 2, this.targets.center.z), this.lookEnd, u);
    }
    this.targets.camera.position.copy(this.tmpPos);
    this.targets.camera.lookAt(this.tmpLook);

    // 4. 2.15s -> 3.35s 暖白童话柔光过渡纱（钻进书页时温柔亮白，峰值 2.7s 无缝切掉书桌换真实世界，再柔缓散开）
    const veilMat = this.transitionVeil.material as THREE.MeshBasicMaterial;
    let veilOpacity = 0;
    if (t >= 2.15 && t < 2.7) {
      veilOpacity = easeInOutCubic((t - 2.15) / 0.55) * 0.96;
    } else if (t >= 2.7 && t < 3.45) {
      veilOpacity = (1 - easeInOutCubic((t - 2.7) / 0.75)) * 0.96;
    }
    veilMat.opacity = veilOpacity;
    this.transitionVeil.visible = veilOpacity > 0.01;
    // 把柔光纱紧贴在相机正前方
    const forward = new THREE.Vector3(0, 0, -2.5).applyQuaternion(this.targets.camera.quaternion);
    this.transitionVeil.position.copy(this.targets.camera.position).add(forward);
    this.transitionVeil.quaternion.copy(this.targets.camera.quaternion);

    // 5. 在柔光峰值（2.7s）悄无声息退场书壳与暗木书桌，真实草甸无缝接管
    if (t >= 2.7) {
      this.bookGroup.visible = false;
      this.spotLight.intensity = 0;
      this.lanternLight.intensity = 0;
      for (const m of this.fadeMats) {
        if ('opacity' in m) (m as THREE.MeshStandardMaterial).opacity = 0;
      }
      for (const bf of this.butterflies) bf.rig.root.visible = false;
    }

    // 6. 穿过柔光后，真实赛道、92 个立体景物与胖卡丁车在眼前依次弹出
    const trackT = THREE.MathUtils.clamp((t - 2.65) / 0.85, 0, 1);
    if (trackT > 0) {
      const sy = Math.max(0.01, easeOutBack(trackT));
      this.targets.trackGroup.scale.set(1, Math.min(1.05, sy), 1);
      if (trackT >= 1) this.targets.trackGroup.scale.set(1, 1, 1);
    }

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

    const heroT = THREE.MathUtils.clamp((t - 3.65) / 0.85, 0, 1);
    if (heroT > 0) {
      const sHero = Math.max(0.01, easeOutBack(heroT));
      if (this.targets.pedestal) this.targets.pedestal.scale.setScalar(sHero);
      if (this.targets.showcaseCar) this.targets.showcaseCar.scale.setScalar(sHero);
    }

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
    (this.transitionVeil.material as THREE.Material).dispose();
  }
}
