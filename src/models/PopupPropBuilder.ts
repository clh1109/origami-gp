import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PopupPropRig, PropTheme, TrackColors } from '../types/game';
import {
  paperMesh,
  createEmissivePaper,
  createTranslucentPaper,
  attachOrigamiEdges,
  createCutoutCardboardMaterials,
  createTexturedPaperMaterial,
} from '../materials/PaperMaterial';

/**
 * 3 级父子关节立体书景物（剪纸白边插画卡纸 + 底部 V 形折页铰链）：
 * RootPivot(地面 y=0) -> BodyGroup(主干/底座) -> TopGroup(剪纸树冠/花盘/风车叶)。
 */
function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

interface PropParts {
  body: THREE.Group;
  top: THREE.Group;
  spinner?: THREE.Object3D;
}

// ---------- 缓存的手绘白边剪纸纹理与几何 ----------
const treeMatCache = new Map<string, [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]>();
const flowerMatCache = new Map<number, [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]>();
let cachedTreeGeo: THREE.ExtrudeGeometry | null = null;
let cachedFlowerGeo: THREE.ExtrudeGeometry | null = null;
let cachedNoteTex: THREE.CanvasTexture | null = null;

/** 归一化 ExtrudeGeometry 的正背面 UV 到 [0, 1]，确保手绘插画与剪纸轮廓严格对齐 */
function normalizeExtrudeUV(geo: THREE.ExtrudeGeometry, halfW: number, height: number): void {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const ux = (uv.getX(i) + halfW) / (halfW * 2);
    const uy = uv.getY(i) / height;
    uv.setXY(i, ux, uy);
  }
  uv.needsUpdate = true;
}

/** 立体书剪纸松树轮廓挤出体（带 0.14 厚度米白卡纸切边） */
function getDieCutTreeGeo(): THREE.ExtrudeGeometry {
  if (cachedTreeGeo) return cachedTreeGeo;
  const s = new THREE.Shape();
  // 三层锯齿剪纸松树轮廓，范围 x ∈ [-2.4, 2.4], y ∈ [0, 5.4]
  s.moveTo(-0.36, 0);
  s.lineTo(0.36, 0);
  s.lineTo(0.42, 1.0);
  s.lineTo(2.35, 1.12);
  s.lineTo(1.32, 2.45);
  s.lineTo(1.95, 2.55);
  s.lineTo(0.95, 3.85);
  s.lineTo(1.38, 3.95);
  s.lineTo(0.0, 5.4);
  s.lineTo(-1.38, 3.95);
  s.lineTo(-0.95, 3.85);
  s.lineTo(-1.95, 2.55);
  s.lineTo(-1.32, 2.45);
  s.lineTo(-2.35, 1.12);
  s.lineTo(-0.42, 1.0);
  s.closePath();

  const depth = 0.14;
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  normalizeExtrudeUV(geo, 2.4, 5.4);
  geo.translate(0, 0, -depth / 2);
  cachedTreeGeo = geo;
  return geo;
}

/** 手绘水彩剪纸树贴图（四周留米白裁切边 + 树冠色阶 + 彩铅叶脉与小红果点缀） */
function getDieCutTreeMaterials(
  key: string,
  cDark: string,
  cMid: string,
  cLight: string
): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
  const hit = treeMatCache.get(key);
  if (hit) return hit;

  const W = 256;
  const H = 288;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 底色铺米白卡纸白边
  ctx.fillStyle = '#fcf8ee';
  ctx.fillRect(0, 0, W, H);

  // 内部留出 10px 裁切白边后画树干与三层水彩松枝
  const drawTri = (cx: number, topY: number, botY: number, halfW: number, fill: string) => {
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx + halfW, botY);
    ctx.lineTo(cx - halfW, botY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  // 树干
  ctx.fillStyle = '#8b6343';
  ctx.fillRect(W / 2 - 14, H - 62, 28, 56);

  // 三层水彩渐变树冠（内缩保留白边）
  drawTri(W / 2, 118, 224, 108, cDark);
  drawTri(W / 2, 66, 152, 86, cMid);
  drawTri(W / 2, 14, 92, 58, cLight);

  // 柔和纸纹竖向叶脉笔触
  ctx.strokeStyle = 'rgba(255, 250, 238, 0.32)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const px = W / 2 + (Math.random() - 0.5) * 120;
    const py = 55 + Math.random() * 155;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (px < W / 2 ? -10 : 10), py + 14);
    ctx.stroke();
  }

  // 点缀几颗暖色小浆果/小花点
  const dots = [
    [W / 2 - 34, 185],
    [W / 2 + 42, 178],
    [W / 2 - 18, 122],
    [W / 2 + 24, 108],
    [W / 2 + 4, 62],
  ];
  for (const [dx, dy] of dots) {
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f4d35e';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mats = createCutoutCardboardMaterials(tex, 0xfcf8ee);
  treeMatCache.set(key, mats);
  return mats;
}

/** 剪纸花盘轮廓挤出体（8 瓣花朵白卡纸） */
function getDieCutFlowerGeo(): THREE.ExtrudeGeometry {
  if (cachedFlowerGeo) return cachedFlowerGeo;
  const s = new THREE.Shape();
  const petals = 8;
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = 1.08 + Math.abs(Math.sin(a * (petals / 2))) * 0.34;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r + 1.45;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();

  const depth = 0.09;
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  normalizeExtrudeUV(geo, 1.45, 2.9);
  geo.translate(0, -1.45, -depth / 2);
  cachedFlowerGeo = geo;
  return geo;
}

function getDieCutFlowerMaterials(petalHex: number): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
  const hit = flowerMatCache.get(petalHex);
  if (hit) return hit;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#fcf8ee';
  ctx.fillRect(0, 0, size, size);

  // 8 瓣手绘花瓣（外围保留一圈米白剪纸边）
  ctx.fillStyle = `#${petalHex.toString(16).padStart(6, '0')}`;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32, 18, 12, a, 0, Math.PI * 2);
    ctx.fill();
  }

  // 暖黄花蕊 + 虚线手绘圈
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb732';
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fcf8ee';
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mats = createCutoutCardboardMaterials(tex, 0xfcf8ee);
  flowerMatCache.set(petalHex, mats);
  return mats;
}

function getStickyNoteTexture(): THREE.CanvasTexture {
  if (cachedNoteTex) return cachedNoteTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff5b8';
  ctx.fillRect(0, 0, 128, 128);

  // 浅蓝横线手账便签
  ctx.strokeStyle = 'rgba(110, 150, 195, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 30; y < 118; y += 16) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(116, y);
    ctx.stroke();
  }

  // 顶部粉色和纸胶带
  ctx.fillStyle = 'rgba(244, 166, 184, 0.85)';
  ctx.fillRect(36, 4, 56, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedNoteTex = tex;
  return tex;
}

/** 立体书底部 45° V 形折纸拉条支撑铰链 (V-Fold Tab) */
function createVFoldTab(width = 0.8, height = 0.9, color = 0xded2be): THREE.Mesh {
  const tabGeo = new THREE.BufferGeometry();
  const w = width / 2;
  const h = height;
  const verts = [
    -w, 0, 0,
    w, 0, 0,
    0, h, -h * 0.5,

    -w, 0, 0,
    0, h, -h * 0.5,
    -w * 0.4, 0, -h * 0.4,

    w, 0, 0,
    w * 0.4, 0, -h * 0.4,
    0, h, -h * 0.5,
  ];
  tabGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  tabGeo.computeVertexNormals();
  const tab = paperMesh(tabGeo, color, { roughness: 0.95, threshold: 12 });
  tab.position.y = 0.01;
  return tab;
}

// ---------- 草甸（升级为夹心白边插画剪纸立体书） ----------
function pineTree(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  body.add(createVFoldTab(1.2, 1.3, 0xd8cbb4));

  const palettes: [string, string, string, string][] = [
    ['spring', '#4c804b', '#67a160', '#8cc27e'],
    ['mint', '#4a8572', '#64a38d', '#8ec7b0'],
    ['warm', '#6d8f47', '#8cb05c', '#b0cf7a'],
  ];
  const [key, cD, cM, cL] = palettes[Math.floor(Math.random() * palettes.length)];
  const geo = getDieCutTreeGeo();
  const mats = getDieCutTreeMaterials(key, cD, cM, cL);

  // 两张厚卡纸剪纸树十字插接（立体书经典卡槽结构）
  for (let k = 0; k < 2; k++) {
    const slab = new THREE.Mesh(geo, mats);
    slab.rotation.y = (k * Math.PI) / 2;
    slab.castShadow = true;
    slab.receiveShadow = true;
    top.add(slab);
  }

  return { body, top };
}

function pinwheel(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  body.add(createVFoldTab(0.8, 1.1, 0xd8cca8));

  const stick = paperMesh(new THREE.CylinderGeometry(0.12, 0.16, 4.5, 6), 0xd9c9a8);
  stick.position.y = 2.25;
  body.add(stick);

  const spinner = new THREE.Group();
  const bladeColors = [0xe05a47, 0xf4d35e, 0x4b8ab0, 0x8eb87a];
  for (let i = 0; i < 4; i++) {
    const bladeGeo = new THREE.ConeGeometry(0.88, 2.35, 4);
    bladeGeo.scale(0.3, 1, 0.85);
    bladeGeo.rotateZ(Math.PI / 2);
    const blade = paperMesh(bladeGeo, bladeColors[i]);
    blade.rotation.y = (i / 4) * Math.PI * 2;
    blade.position.set(Math.cos((i / 4) * Math.PI * 2) * 1.15, Math.sin((i / 4) * Math.PI * 2) * 1.15, 0);
    blade.rotation.x = Math.PI / 2.3;
    spinner.add(blade);
  }
  const hub = paperMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10), 0xfdfaf0);
  hub.rotation.x = Math.PI / 2;
  spinner.add(hub);

  spinner.position.y = 4.5;
  top.add(spinner);

  return { body, top, spinner };
}

function flower(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  body.add(createVFoldTab(0.7, 0.9, 0xc8dba8));

  const stem = paperMesh(new THREE.CylinderGeometry(0.09, 0.13, 2.3, 6), 0x5e9258);
  stem.position.y = 1.15;
  body.add(stem);

  for (const s of [-1, 1]) {
    const leafGeo = new THREE.ConeGeometry(0.32, 1.1, 4);
    leafGeo.scale(0.45, 1, 0.18);
    const leaf = paperMesh(leafGeo, 0x76ab70);
    leaf.position.set(s * 0.42, 1.15, 0);
    leaf.rotation.z = -s * 0.85;
    body.add(leaf);
  }

  // 8 瓣手绘白边厚卡纸花朵
  const petalPalette = [0xf4a6b8, 0xfff0a6, 0x9fd4ea, 0xffb38a];
  const petalHex = petalPalette[Math.floor(Math.random() * petalPalette.length)];
  const headMesh = new THREE.Mesh(getDieCutFlowerGeo(), getDieCutFlowerMaterials(petalHex));
  headMesh.position.set(0, 2.55, 0);
  headMesh.rotation.x = -0.32;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  top.add(headMesh);

  return { body, top };
}

// ---------- 夜巷 ----------
function lanternTower(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  body.add(createVFoldTab(0.9, 1.2, 0x242e44));

  const pole = paperMesh(new THREE.CylinderGeometry(0.2, 0.26, 5.2, 6), 0x2b3752);
  pole.position.y = 2.6;
  body.add(pole);

  const lanternMat = createEmissivePaper(0xffb347, 0xffa028, 1.6);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.7, 8), lanternMat);
  attachOrigamiEdges(lantern, 20);
  lantern.position.y = 5.4;
  top.add(lantern);

  const cap = paperMesh(new THREE.ConeGeometry(1.3, 0.7, 8), 0x3b2f27);
  cap.position.y = 6.5;
  top.add(cap);

  const tassel = paperMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 4), 0xe07a5f);
  tassel.position.y = 4.3;
  top.add(tassel);

  return { body, top };
}

function nightEave(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  body.add(createVFoldTab(1.6, 1.4, 0x1f273b));

  const wall = paperMesh(new THREE.BoxGeometry(3.4, 3.2, 2.6), 0x2b3752);
  wall.position.y = 1.6;
  body.add(wall);

  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.0),
    createEmissivePaper(0xffd166, 0xffc94d, 1.3)
  );
  win.position.set(0, 1.8, 1.32);
  body.add(win);

  const roof = paperMesh(new THREE.ConeGeometry(3.0, 1.5, 4), 0x1b2438);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.9;
  roof.scale.set(1.2, 1, 0.9);
  top.add(roof);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.16, 3.2),
    createEmissivePaper(0xe07a5f, 0xe07a5f, 0.7)
  );
  trim.position.y = 3.25;
  top.add(trim);

  return { body, top };
}

function origamiCrane(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  const post = paperMesh(new THREE.CylinderGeometry(0.12, 0.16, 3.8, 5), 0x2b3752);
  post.position.y = 1.9;
  body.add(post);

  const crane = new THREE.Group();
  const craneBody = paperMesh(new THREE.ConeGeometry(0.55, 1.4, 4), 0xfffdf8, { threshold: 10 });
  craneBody.rotation.x = Math.PI / 2;
  crane.add(craneBody);

  for (const s of [-1, 1]) {
    const wing = paperMesh(new THREE.ConeGeometry(0.6, 1.8, 3), 0xffe066, { threshold: 8 });
    wing.position.set(s * 0.9, 0.3, 0);
    wing.rotation.z = s * 0.55;
    wing.rotation.y = Math.PI / 2;
    crane.add(wing);
  }

  const neck = paperMesh(new THREE.CylinderGeometry(0.1, 0.15, 0.8, 4), 0xe07a5f);
  neck.position.set(0, 0.6, 0.6);
  neck.rotation.x = -0.6;
  crane.add(neck);

  crane.position.y = 4.2;
  top.add(crane);

  return { body, top };
}

// ---------- 冰霜 ----------
function iceCrystal(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  const mound = paperMesh(new THREE.ConeGeometry(1.8, 0.9, 7), 0xeaf6fb);
  mound.position.y = 0.45;
  body.add(mound);

  const iceMat = createTranslucentPaper(0xbfe3f2, 0.62, 0x9fd4ea, 0.25);
  for (let i = 0; i < 4; i++) {
    const h = 2.4 + Math.random() * 2.4;
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.4, h, 5), iceMat);
    attachOrigamiEdges(crystal, 15);
    const a = (i / 4) * Math.PI * 2 + Math.random();
    crystal.position.set(Math.cos(a) * 0.8, 0.7 + h / 2, Math.sin(a) * 0.8);
    crystal.rotation.z = (Math.random() - 0.5) * 0.3;
    crystal.rotation.x = (Math.random() - 0.5) * 0.3;
    top.add(crystal);
  }

  return { body, top };
}

function envelopeRidge(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  const env = paperMesh(new THREE.BoxGeometry(3.2, 2.2, 0.5), 0xf4f9fc);
  env.position.y = 1.1;
  body.add(env);

  const flap = paperMesh(new THREE.ConeGeometry(2.2, 1.4, 3), 0xdfeaf2, { threshold: 10 });
  flap.rotation.x = Math.PI;
  flap.rotation.z = Math.PI / 2;
  flap.position.y = 2.4;
  flap.scale.set(1, 1, 0.3);
  top.add(flap);

  const seal = paperMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8), 0x4b8ab0);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, 1.4, 0.3);
  top.add(seal);

  return { body, top };
}

// ---------- 书桌（便利贴升级带横线手账纹理与粉色胶带） ----------
function stickyNote(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  const base = paperMesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), 0xb08154);
  base.position.y = 0.15;
  body.add(base);

  const noteMat = createTexturedPaperMaterial(getStickyNoteTexture());
  const note = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.12), noteMat);
  note.position.y = 1.6;
  note.rotation.x = -0.12;
  note.castShadow = true;
  note.receiveShadow = true;
  top.add(note);

  const curl = paperMesh(new THREE.BoxGeometry(2.4, 0.5, 0.12), 0xfff5b8);
  curl.position.set(0, 0.45, 0.22);
  curl.rotation.x = 0.6;
  top.add(curl);

  return { body, top };
}

function pencil(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  const shaft = paperMesh(new THREE.CylinderGeometry(0.5, 0.5, 5.0, 6), 0xf4d35e);
  shaft.position.y = 2.5;
  body.add(shaft);

  const wood = paperMesh(new THREE.ConeGeometry(0.5, 1.1, 6), 0xe8c9a0);
  wood.position.y = 5.5;
  top.add(wood);

  const lead = paperMesh(new THREE.ConeGeometry(0.18, 0.4, 6), 0x3b2f27);
  lead.position.y = 6.15;
  top.add(lead);

  const eraser = paperMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 6), 0xf4a6b8);
  eraser.position.y = 0.3;
  body.add(eraser);

  return { body, top };
}

function eraser(_colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();

  const block = paperMesh(new THREE.BoxGeometry(2.6, 1.4, 1.4), 0xf4a6b8);
  block.position.y = 0.7;
  body.add(block);

  const sleeve = paperMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), 0x4b8ab0);
  sleeve.position.y = 0.75;
  top.add(sleeve);

  return { body, top };
}

const BUILDERS: Record<PropTheme, ((c: TrackColors) => PropParts)[]> = {
  meadow: [pineTree, pinwheel, flower],
  neon: [lanternTower, nightEave, origamiCrane],
  frost: [iceCrystal, envelopeRidge],
  desk: [stickyNote, pencil, eraser],
};

export function buildPopupProp(theme: PropTheme, variant: number, colors: TrackColors): PopupPropRig {
  const list = BUILDERS[theme];
  const parts = list[variant % list.length](colors);

  const rootPivot = new THREE.Group();
  const bodyGroup = parts.body;
  const topGroup = parts.top;
  bodyGroup.add(topGroup);
  rootPivot.add(bodyGroup);

  rootPivot.rotation.x = -Math.PI / 2;
  topGroup.scale.set(0.01, 0.01, 0.01);

  return {
    rootPivot,
    bodyGroup,
    topGroup,
    spinner: parts.spinner,
    popped: false,
    elapsed: 0,
    swayPhase: Math.random() * Math.PI * 2,
    baseY: 0,
  };
}

/** 比赛开始前把全部景物重新折平收纳进书页 */
export function foldAllProps(props: PopupPropRig[]): void {
  for (const p of props) {
    p.popped = false;
    p.elapsed = 0;
    p.rootPivot.rotation.x = -Math.PI / 2;
    p.topGroup.scale.set(0.01, 0.01, 0.01);
  }
}

/** 随赛车推进逐渐展开的立体书控制器（前方 68 单位内弹性立起，身后 115 单位外静默折平供下一圈再展开） */
export function updatePopupProps(
  props: PopupPropRig[],
  playerPos: THREE.Vector3,
  dt: number,
  onPop?: () => void
): void {
  let playedThisFrame = false;
  for (const prop of props) {
    const dist = playerPos.distanceTo(prop.rootPivot.position);

    // 赛车靠近到 68 单位内：触发逐渐立起
    if (!prop.popped && dist < 68) {
      prop.popped = true;
      prop.elapsed = 0;
      if (!playedThisFrame && onPop) {
        onPop();
        playedThisFrame = true;
      }
    }

    // 赛车驶离超过 115 单位（已在镜头后方）：悄悄折平，下一圈经过时再次立体弹起
    if (prop.popped && dist > 115) {
      prop.popped = false;
      prop.elapsed = 0;
      prop.rootPivot.rotation.x = -Math.PI / 2;
      prop.topGroup.scale.set(0.01, 0.01, 0.01);
      continue;
    }

    if (prop.popped && prop.elapsed < 0.72) {
      // 柔和的 0.72 秒立体展开曲线（比之前更从容、更有立体书翻立观感）
      prop.elapsed = Math.min(0.72, prop.elapsed + dt);
      const tBase = Math.min(1, prop.elapsed / 0.45);
      const eBase = easeOutBack(tBase);
      prop.rootPivot.rotation.x = (-Math.PI / 2) * (1 - eBase);

      const tTop = Math.max(0, Math.min(1, (prop.elapsed - 0.16) / 0.52));
      const sTop = Math.max(0.01, easeOutBack(tTop));
      prop.topGroup.scale.set(sTop, sTop, sTop);
    } else if (prop.popped) {
      prop.swayPhase += dt;
      prop.bodyGroup.rotation.z = Math.sin(prop.swayPhase * 1.3) * 0.025;
    }

    if (prop.popped && prop.spinner) {
      prop.spinner.rotation.z += dt * 2.2;
    }
  }
}

export function popAllInstant(props: PopupPropRig[]): void {
  for (const p of props) {
    p.popped = true;
    p.elapsed = 0.72;
    p.rootPivot.rotation.x = 0;
    p.topGroup.scale.set(1, 1, 1);
  }
}

// ---------- 路边连续地饰几何工厂（栅栏 / 灌木 / 纸花，供 TrackBuilder 批量合并） ----------
let fenceGeos: THREE.BufferGeometry[] | null = null;
/** 童话尖顶折纸小栅栏（带尖顶立柱 + 双横木 + 立体书纸舌底座） */
export function getFenceSectionGeos(): THREE.BufferGeometry[] {
  if (!fenceGeos) {
    const postBody = new THREE.BoxGeometry(0.18, 0.85, 0.14);
    const postTip = new THREE.ConeGeometry(0.13, 0.24, 4);
    postTip.rotateY(Math.PI / 4);
    const foot = new THREE.BoxGeometry(0.32, 0.06, 0.28);
    const rail = new THREE.BoxGeometry(2.58, 0.13, 0.09);

    const makePost = (x: number) => [
      postBody.clone().translate(x, 0.425, 0),
      postTip.clone().translate(x, 0.96, 0),
      foot.clone().translate(x, 0.03, 0),
    ];

    fenceGeos = [
      ...makePost(-1.18),
      ...makePost(0),
      ...makePost(1.18),
      rail.clone().translate(0, 0.68, 0.05),
      rail.clone().translate(0, 0.34, 0.05),
    ];
    postBody.dispose();
    postTip.dispose();
    foot.dispose();
    rail.dispose();
  }
  return fenceGeos;
}

let bushGeo: THREE.BufferGeometry | null = null;
/** 三团错落叠合的云朵剪纸灌木丛 */
export function getBushGeo(): THREE.BufferGeometry {
  if (!bushGeo) {
    const g1 = new THREE.IcosahedronGeometry(0.76, 1);
    g1.scale(1.05, 0.72, 0.95);
    g1.translate(0, 0.52, 0);

    const g2 = new THREE.IcosahedronGeometry(0.56, 1);
    g2.scale(1.0, 0.7, 1.0);
    g2.translate(-0.62, 0.38, 0.16);

    const g3 = new THREE.IcosahedronGeometry(0.52, 1);
    g3.scale(1.0, 0.68, 1.0);
    g3.translate(0.58, 0.35, -0.14);

    const parts = [g1, g2, g3].map((g) => (g.index ? g.toNonIndexed() : g));
    bushGeo = mergeGeometries(parts, false) ?? g1;
    parts.forEach((p) => p.dispose());
  }
  return bushGeo;
}

let flowerGeos: { stem: THREE.BufferGeometry; head: THREE.BufferGeometry } | null = null;
/** 展开的 5 瓣折纸星花 + 带双叶的花茎 */
export function getFlowerGeos(): { stem: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  if (!flowerGeos) {
    // 花茎 + 两侧斜展纸叶
    const stalk = new THREE.CylinderGeometry(0.045, 0.06, 0.62, 5);
    stalk.translate(0, 0.31, 0);
    const leafL = new THREE.ConeGeometry(0.14, 0.36, 4);
    leafL.scale(0.5, 1, 0.25);
    leafL.rotateZ(0.85);
    leafL.translate(-0.14, 0.28, 0);
    const leafR = new THREE.ConeGeometry(0.14, 0.36, 4);
    leafR.scale(0.5, 1, 0.25);
    leafR.rotateZ(-0.85);
    leafR.translate(0.14, 0.32, 0);
    const stemParts = [stalk, leafL, leafR].map((g) => (g.index ? g.toNonIndexed() : g));
    const stem = mergeGeometries(stemParts, false) ?? stalk;
    stemParts.forEach((p) => p.dispose());

    // 5 瓣向外展开的折纸星花花冠
    const petalParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.ConeGeometry(0.14, 0.32, 4);
      p.scale(0.85, 1, 0.3);
      p.rotateX(Math.PI / 2 - 0.35);
      p.rotateY(a);
      p.translate(Math.sin(a) * 0.16, 0.66, Math.cos(a) * 0.16);
      petalParts.push(p.index ? p.toNonIndexed() : p);
    }
    const core = new THREE.OctahedronGeometry(0.11, 0);
    core.translate(0, 0.68, 0);
    petalParts.push(core.index ? core.toNonIndexed() : core);
    const head = mergeGeometries(petalParts, false) ?? core;
    petalParts.forEach((p) => p.dispose());

    flowerGeos = { stem, head };
  }
  return flowerGeos;
}
