import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TrackSpec, PopupPropRig, ItemBoxEntity, BoostPadEntity } from '../types/game';
import { createPaperMaterial, createEmissivePaper, paperMesh, attachOrigamiEdges, ensureBoxUV } from '../materials/PaperMaterial';
import { getChecker, getPaperFiberBump } from '../materials/PaperTextures';
import { buildPopupProp, getFenceSectionGeos, getBushGeo, getFlowerGeos } from '../models/PopupPropBuilder';

export interface TrackQueryResult {
  t: number;
  dist: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
}

export interface TrackBuildResult {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  length: number;
  width: number;
  itemBoxes: ItemBoxEntity[];
  boostPads: BoostPadEntity[];
  props: PopupPropRig[];
  startPositions: { pos: THREE.Vector3; heading: number }[];
  center: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  outline: [number, number][];
  query: (pos: THREE.Vector3) => TrackQueryResult;
  pointAt: (t: number) => THREE.Vector3;
  tangentAt: (t: number) => THREE.Vector3;
}

const ROAD_SAMPLES = 320;

function questionTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(59,47,39,0.5)';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 120, 120);
  ctx.fillStyle = '#3b2f27';
  ctx.font = 'bold 84px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 高饱和橙黄加速带 + 亮白滚动箭头（Canvas 纹理，offset.y 由引擎每帧推进） */
function boostArrowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  // 深橙底：补偿白天强光 + ACES 的提亮，屏幕上仍呈高饱和橙黄
  ctx.fillStyle = '#d96a00';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = 'rgba(255,220,160,0.10)';
  for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 8, 256);
  // 雪佛龙顶点朝画布下方 = 行进方向；间距取 256/3 保证无缝滚动
  ctx.strokeStyle = '#fffdf8';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < 3; k++) {
    const y0 = 12 + (k * 256) / 3;
    ctx.beginPath();
    ctx.moveTo(20, y0);
    ctx.lineTo(64, y0 + 42);
    ctx.lineTo(108, y0);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1, 2);
  tex.anisotropy = 4;
  return tex;
}

/** 绘制带真实厘米刻度的木头直尺贴图 */
function createWoodRulerTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // 暖蜂蜜木纹底色
  ctx.fillStyle = '#e5be7e';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(155, 105, 45, 0.14)' : 'rgba(255, 240, 200, 0.08)';
    ctx.fillRect(0, y, W, 2);
  }

  // 两侧精细毫米/厘米刻度线与数字
  ctx.fillStyle = '#3b2919';
  ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  const totalCm = 30;
  const step = W / totalCm;
  for (let i = 0; i <= totalCm * 2; i++) {
    const x = i * (step / 2);
    const isMajor = i % 2 === 0;
    const tickH = isMajor ? 42 : 22;
    ctx.fillRect(x - 1.5, 0, isMajor ? 3 : 2, tickH);
    ctx.fillRect(x - 1.5, H - tickH, isMajor ? 3 : 2, tickH);
    if (isMajor && i > 0 && i < totalCm * 2) {
      ctx.fillText(String(i / 2), x, 68);
      ctx.fillText(String(i / 2), x, H - 52);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 在赛道上构建巨物尺度反差奇观：60m 刻度木直尺立交桥 + 25m 巨型信封隧道 + 精装书峡谷 */
function buildStoryLandmarks(
  spec: TrackSpec,
  curve: THREE.CatmullRomCurve3,
  half: number,
  group: THREE.Group
): void {
  if (spec.theme !== 'meadow') return;

  // ★ 奇观 1：60 米带刻度木头直尺高架立交桥（位于 8 字形上层立交正中 t ≈ 0.54）
  {
    // 寻找上层最高点（y > 11）作为直尺中心
    let topT = 0.54;
    let maxY = -Infinity;
    for (let i = 0; i < 200; i++) {
      const t = i / 200;
      const pt = curve.getPointAt(t);
      if (pt.y > maxY) {
        maxY = pt.y;
        topT = t;
      }
    }
    const p = curve.getPointAt(topT);
    const tg = curve.getTangentAt(topT);
    const heading = Math.atan2(tg.x, tg.z);

    const rulerGroup = new THREE.Group();
    rulerGroup.position.set(p.x, p.y + 0.08, p.z);
    rulerGroup.rotation.y = heading;

    const rulerMat = new THREE.MeshStandardMaterial({
      map: createWoodRulerTexture(),
      roughness: 0.78,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const sideMat = createPaperMaterial(0xc69652, undefined, 0.85);
    const rulerGeo = new THREE.BoxGeometry(half * 2 + 2.4, 0.9, 64);
    const rulerMesh = new THREE.Mesh(rulerGeo, [
      sideMat, sideMat, rulerMat, sideMat, sideMat, sideMat,
    ]);
    rulerMesh.position.y = -0.35;
    rulerMesh.castShadow = true;
    rulerMesh.receiveShadow = true;
    rulerGroup.add(rulerMesh);
    group.add(rulerGroup);
  }

  // ★ 奇观 2：25 米巨型敞开牛皮纸信封隧道（位于右侧直道 t = 0.31，车直接钻进去！）
  {
    const p = curve.getPointAt(0.31);
    const tg = curve.getTangentAt(0.31);
    const heading = Math.atan2(tg.x, tg.z);

    const env = new THREE.Group();
    env.position.set(p.x, p.y, p.z);
    env.rotation.y = heading;

    const w = half * 2 + 6;
    const h = 16;
    const len = 38;
    const kraftOuter = createPaperMaterial(0xdcb98a, undefined, 0.92);
    const kraftInner = createPaperMaterial(0xf5e8cf, undefined, 0.94);
    kraftOuter.side = THREE.DoubleSide;
    kraftInner.side = THREE.DoubleSide;

    // 左右信封厚墙 + 顶部信封背盖
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, len), kraftOuter);
      wall.position.set(s * (w / 2), h / 2, 0);
      wall.castShadow = true;
      wall.receiveShadow = true;
      env.add(wall);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 1.2, len), kraftInner);
    roof.position.set(0, h, 0);
    roof.castShadow = true;
    env.add(roof);

    // 入口与出口上扬的巨大三角形信封掀盖 + 巨型红色火漆印章
    for (const zSign of [-1, 1]) {
      const flapGeo = new THREE.ConeGeometry(w * 0.56, 12, 3);
      flapGeo.scale(1.0, 1.0, 0.08);
      const flap = new THREE.Mesh(flapGeo, kraftOuter);
      flap.position.set(0, h + 4.8, zSign * (len / 2 + 2.5));
      flap.rotation.x = zSign * 0.42;
      flap.castShadow = true;
      env.add(flap);

      // 巨型红火漆印章
      const seal = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6, 2.8, 0.65, 16),
        createPaperMaterial(0xd94336, undefined, 0.65)
      );
      seal.rotation.x = Math.PI / 2;
      seal.position.set(0, h + 1.4, zSign * (len / 2 + 1.1));
      env.add(seal);
    }

    group.add(env);
  }

  // ★ 奇观 3：堆叠巨型精装书大峡谷（位于左侧大弯 t = 0.75 ~ 0.85 两侧，巨物尺度反差！）
  {
    const bookColors = [0x264b42, 0x8f3430, 0x2a4066, 0xc7923c, 0x5c426e];
    const pageMat = createPaperMaterial(0xf8f0dc, undefined, 0.92);
    const goldMat = createPaperMaterial(0xe6c170, undefined, 0.45);

    const canyonTs = [0.74, 0.78, 0.82, 0.86];
    canyonTs.forEach((t, idx) => {
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t);
      const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
      const heading = Math.atan2(tg.x, tg.z);

      for (const side of [-1, 1]) {
        const stackCount = 2 + ((idx + (side > 0 ? 1 : 0)) % 2);
        let curY = 0;
        for (let b = 0; b < stackCount; b++) {
          const bw = 18 - b * 2.5;
          const bh = 6.5 + (b % 2) * 2.2;
          const bd = 26 - b * 2;
          const cMat = createPaperMaterial(bookColors[(idx * 2 + b + (side > 0 ? 1 : 0)) % bookColors.length], undefined, 0.88);
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bh, bd),
            [pageMat, cMat, cMat, cMat, pageMat, pageMat]
          );
          const offsetDist = half + bw * 0.5 + 4.5 + b * 1.2;
          const pos = p.clone().addScaledVector(n, side * offsetDist);
          book.position.set(pos.x, curY + bh / 2, pos.z);
          book.rotation.y = heading + (b - 0.5) * 0.18 * side;
          book.castShadow = true;
          book.receiveShadow = true;
          group.add(book);

          // 书脊烫金横条装饰
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, bd * 0.7), goldMat);
          stripe.position.set(-bw / 2 - 0.1, 0, 0);
          book.add(stripe);

          curY += bh;
        }
      }
    });
  }
}

export function buildTrack(spec: TrackSpec): TrackBuildResult {
  const group = new THREE.Group();
  const pts = spec.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  const length = curve.getLength();
  const w = spec.width;
  const half = w / 2;

  // 采样查找表
  const samples: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < ROAD_SAMPLES; i++) {
    const t = i / ROAD_SAMPLES;
    samples.push(curve.getPointAt(t));
    tangents.push(curve.getTangentAt(t));
  }

  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of samples) {
    bounds.minX = Math.min(bounds.minX, p.x);
    bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.minZ = Math.min(bounds.minZ, p.z);
    bounds.maxZ = Math.max(bounds.maxZ, p.z);
  }

  const normalAt = (i: number) => {
    const tg = tangents[i % ROAD_SAMPLES];
    return new THREE.Vector3(-tg.z, 0, tg.x).normalize();
  };

  // ---------- 路面（沿样条 p.y 起伏，形成 3D 坡道纸带） ----------
  const roadPos: number[] = [];
  const roadUv: number[] = [];
  const roadIdx: number[] = [];
  for (let i = 0; i <= ROAD_SAMPLES; i++) {
    const idx = i % ROAD_SAMPLES;
    const p = samples[idx];
    const n = normalAt(idx);
    const l = p.clone().addScaledVector(n, -half);
    const r = p.clone().addScaledVector(n, half);
    roadPos.push(l.x, p.y + 0.05, l.z, r.x, p.y + 0.05, r.z);
    roadUv.push(0, i / 8, 1, i / 8);
    if (i < ROAD_SAMPLES) {
      const a = i * 2;
      roadIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
  roadGeo.setIndex(roadIdx);
  roadGeo.computeVertexNormals();
  const roadMat = createPaperMaterial(spec.colors.road, getPaperFiberBump(), 0.95);
  roadMat.flatShading = false;
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  group.add(road);

  // ---------- 赛道白色虚线中心标线 (Dashed Centerline) ----------
  const dashPos: number[] = [];
  const dashIdx: number[] = [];
  const dashW = 0.42;
  let dashVerts = 0;
  for (let i = 0; i < ROAD_SAMPLES; i++) {
    // 6 个切片为一个周期：前 3 个铺设白色折纸虚线，后 3 个留空
    if (i % 6 >= 3) continue;
    const p0 = samples[i];
    const p1 = samples[(i + 1) % ROAD_SAMPLES];
    const n0 = normalAt(i);
    const n1 = normalAt((i + 1) % ROAD_SAMPLES);
    const l0 = p0.clone().addScaledVector(n0, -dashW / 2);
    const r0 = p0.clone().addScaledVector(n0, dashW / 2);
    const l1 = p1.clone().addScaledVector(n1, -dashW / 2);
    const r1 = p1.clone().addScaledVector(n1, dashW / 2);
    dashPos.push(
      l0.x, p0.y + 0.08, l0.z,
      r0.x, p0.y + 0.08, r0.z,
      l1.x, p1.y + 0.08, l1.z,
      r1.x, p1.y + 0.08, r1.z
    );
    const b = dashVerts;
    dashIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    dashVerts += 4;
  }
  if (dashPos.length > 0) {
    const dashGeo = new THREE.BufferGeometry();
    dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashPos, 3));
    dashGeo.setIndex(dashIdx);
    dashGeo.computeVertexNormals();
    ensureBoxUV(dashGeo, 0.35);
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xfffdf8,
      roughness: 0.92,
      metalness: 0,
      flatShading: true,
      bumpMap: getPaperFiberBump(),
      bumpScale: 0.03,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const dashes = new THREE.Mesh(dashGeo, dashMat);
    dashes.receiveShadow = true;
    group.add(dashes);
  }

  // ---------- 红白路肩（顶点色交替，随坡道起伏，闭环无接缝） ----------
  const curbW = 1.3;
  const curbPos: number[] = [];
  const curbCol: number[] = [];
  const curbIdx: number[] = [];
  const cA = new THREE.Color(spec.colors.curbA);
  const cB = new THREE.Color(spec.colors.curbB);
  let vertCount = 0;
  const segLen = 4;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i <= ROAD_SAMPLES; i++) {
      const idx = i % ROAD_SAMPLES;
      const p = samples[idx];
      const n = normalAt(idx);
      const inner = p.clone().addScaledVector(n, side * half);
      const outer = p.clone().addScaledVector(n, side * (half + curbW));
      const col = Math.floor(idx / segLen) % 2 === 0 ? cA : cB;
      curbPos.push(inner.x, p.y + 0.12, inner.z, outer.x, p.y + 0.12, outer.z);
      curbCol.push(col.r, col.g, col.b, col.r, col.g, col.b);
      if (i < ROAD_SAMPLES) {
        const a = vertCount;
        curbIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      vertCount += 2;
    }
  }
  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
  curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbCol, 3));
  curbGeo.setIndex(curbIdx);
  curbGeo.computeVertexNormals();
  ensureBoxUV(curbGeo, 0.35);
  const curbMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
    bumpMap: getPaperFiberBump(),
    bumpScale: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const curbs = new THREE.Mesh(curbGeo, curbMat);
  curbs.receiveShadow = true;
  curbs.castShadow = false;
  group.add(curbs);

  // ---------- 手工和纸胶带贴片 (Washi Tape Seams) ----------
  {
    const tapeCanvas = document.createElement('canvas');
    tapeCanvas.width = 64;
    tapeCanvas.height = 64;
    const tctx = tapeCanvas.getContext('2d')!;
    tctx.fillStyle = '#fff8eb';
    tctx.fillRect(0, 0, 64, 64);
    tctx.strokeStyle = 'rgba(224, 90, 71, 0.45)';
    tctx.lineWidth = 8;
    for (let k = -64; k < 128; k += 20) {
      tctx.beginPath();
      tctx.moveTo(k, 0);
      tctx.lineTo(k + 64, 64);
      tctx.stroke();
    }
    const tapeTex = new THREE.CanvasTexture(tapeCanvas);
    tapeTex.colorSpace = THREE.SRGBColorSpace;
    const tapeMat = new THREE.MeshStandardMaterial({
      map: tapeTex,
      transparent: true,
      opacity: 0.78,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const tapeGeo = new THREE.PlaneGeometry(2.6, 1.05);
    tapeGeo.rotateX(-Math.PI / 2);

    for (let i = 12; i < ROAD_SAMPLES; i += 22) {
      const p = samples[i];
      if (p.y > 0.8) continue;
      const n = normalAt(i);
      const tg = tangents[i];
      const side = (i / 22) % 2 === 0 ? 1 : -1;
      const pos = p.clone().addScaledVector(n, side * (half + curbW * 0.65));
      const tape = new THREE.Mesh(tapeGeo, tapeMat);
      tape.position.set(pos.x, p.y + 0.14, pos.z);
      tape.rotation.y = Math.atan2(tg.x, tg.z) + (side * 0.32);
      tape.receiveShadow = true;
      group.add(tape);
    }
  }

  // ---------- 卡纸厚度裙边：路肩外沿垂直向下 1.4，高架段像有厚度的折纸带 ----------
  const skirtPos: number[] = [];
  const skirtIdx: number[] = [];
  let skirtVert = 0;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i <= ROAD_SAMPLES; i++) {
      const idx = i % ROAD_SAMPLES;
      const p = samples[idx];
      const n = normalAt(idx);
      const e = p.clone().addScaledVector(n, side * (half + curbW));
      const topY = p.y + 0.12;
      skirtPos.push(e.x, topY, e.z, e.x, topY - 1.4, e.z);
      if (i < ROAD_SAMPLES) {
        const a = skirtVert;
        skirtIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      skirtVert += 2;
    }
  }
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
  skirtGeo.setIndex(skirtIdx);
  skirtGeo.computeVertexNormals();
  const skirtMat = new THREE.MeshStandardMaterial({
    color: 0xe8dcc8,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
    bumpMap: getPaperFiberBump(),
    bumpScale: 0.04,
  });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  group.add(skirt);

  // ---------- 高架段折纸桥墩（V 形折叠支撑，立体书结构感） ----------
  const pierGeos: THREE.BufferGeometry[] = [];
  {
    const pierProto = new THREE.BoxGeometry(w * 0.62, 1, 0.36);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    for (let i = 0; i < ROAD_SAMPLES; i += 12) {
      const p = samples[i];
      if (p.y < 1.5) continue;
      const tg = tangents[i];
      const heading = Math.atan2(tg.x, tg.z);
      const h = p.y - 0.05;
      for (const fold of [-0.42, 0.42]) {
        const g = pierProto.clone();
        e.set(0, heading + fold, 0, 'YXZ');
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(p.x, h / 2, p.z), q, sc.set(1, h, 1));
        g.applyMatrix4(m4);
        pierGeos.push(g.index ? g.toNonIndexed() : g);
        if (g.index) g.dispose();
      }
    }
    pierProto.dispose();
    if (pierGeos.length) {
      const merged = mergeGeometries(pierGeos, false);
      pierGeos.forEach((g) => g.dispose());
      if (merged) {
        const piers = new THREE.Mesh(merged, createPaperMaterial(0xd9c9a8, getPaperFiberBump(), 0.92));
        attachOrigamiEdges(piers, 22);
        group.add(piers);
      }
    }
  }

  // ---------- 棋盘格起跑线（贴合坡道切线俯仰） ----------
  const startT = 0;
  const sp = curve.getPointAt(startT);
  const st = curve.getTangentAt(startT);
  const startHeading = Math.atan2(st.x, st.z);
  const checker = getChecker();
  checker.repeat.set(8, 2);
  const startMat = new THREE.MeshStandardMaterial({
    map: checker,
    roughness: 0.9,
    metalness: 0,
  });
  const startGroup = new THREE.Group();
  startGroup.rotation.order = 'YXZ';
  startGroup.rotation.y = startHeading;
  startGroup.rotation.x = -Math.atan2(st.y, Math.hypot(st.x, st.z));
  startGroup.position.set(sp.x, sp.y + 0.09, sp.z);
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.4), startMat);
  startLine.rotation.x = -Math.PI / 2;
  startLine.receiveShadow = true;
  startGroup.add(startLine);
  group.add(startGroup);

  // ---------- 发光加速带（立体折纸箭羽 + 厚卡纸底座与双翼导流） ----------
  const boostPads: BoostPadEntity[] = [];
  const boostTex = boostArrowTexture();
  group.userData.boostTex = boostTex;
  const padMat = new THREE.MeshStandardMaterial({
    map: boostTex,
    emissive: 0xffffff,
    emissiveMap: boostTex,
    emissiveIntensity: 0.3,
    roughness: 0.75,
    metalness: 0,
  });
  const padBaseMat = createPaperMaterial(0xfcf6e8, undefined, 0.9);
  const finMat = createPaperMaterial(0xe05a47, undefined, 0.85);
  const chevronMat = createEmissivePaper(0xff8811, 0xff4400, 0.75);

  for (const bt of spec.boostT) {
    const p = curve.getPointAt(bt);
    const tg = curve.getTangentAt(bt);
    const heading = Math.atan2(tg.x, tg.z);
    const padGroup = new THREE.Group();
    padGroup.rotation.order = 'YXZ';
    padGroup.rotation.y = heading;
    padGroup.rotation.x = -Math.atan2(tg.y, Math.hypot(tg.x, tg.z));

    // 厚卡纸垫板底座
    const padBase = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.12, 5.2), padBaseMat);
    padBase.position.y = -0.04;
    padBase.receiveShadow = true;
    padGroup.add(padBase);

    // 动态滚动箭头跑道面
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.68, 5.0), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    pad.receiveShadow = true;
    padGroup.add(pad);

    // 左右折纸导流小翼与包边
    for (const s of [-1, 1]) {
      const rail = paperMesh(new THREE.BoxGeometry(0.24, 0.18, 5.1), 0xe8dcc8, { edges: false });
      rail.position.set(s * (w * 0.35 + 0.12), 0.06, 0);
      padGroup.add(rail);

      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.38, 4.8, 3), finMat);
      fin.rotation.x = Math.PI / 2;
      fin.rotation.z = s * 0.35;
      fin.scale.set(0.32, 1, 0.65);
      fin.position.set(s * (w * 0.36 + 0.18), 0.24, 0);
      fin.castShadow = true;
      padGroup.add(fin);
    }

    // 3 阶立体折角自发光折纸箭羽
    for (let k = -1; k <= 1; k++) {
      const cz = k * 1.45;
      const cy = 0.06 + (k + 1) * 0.03;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, 0.07, 0.28), chevronMat);
      armL.position.set(-w * 0.11, cy, cz - 0.2);
      armL.rotation.y = 0.42;
      const armR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, 0.07, 0.28), chevronMat);
      armR.position.set(w * 0.11, cy, cz - 0.2);
      armR.rotation.y = -0.42;
      padGroup.add(armL, armR);
    }

    padGroup.position.set(p.x, p.y + 0.1, p.z);
    group.add(padGroup);
    boostPads.push({ mesh: padGroup, t: bt, pos: p.clone(), dir: tg.clone() });
  }

  // ---------- 道具箱（丝带蝴蝶结折纸礼盒） ----------
  function createOrigamiGiftBox(qMat: THREE.Material): THREE.Group {
    const gift = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.65, 1.65), qMat);
    box.castShadow = true;
    attachOrigamiEdges(box, 20);
    gift.add(box);

    // 交叉珊瑚红纸丝带
    const ribbonMat = createPaperMaterial(0xe05a47, undefined, 0.82);
    const bandX = new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.72, 0.28), ribbonMat);
    const bandZ = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.72, 1.72), ribbonMat);
    gift.add(bandX, bandZ);

    // 顶部立体四叶折纸蝴蝶结
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const loop = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.68, 4), ribbonMat);
      loop.scale.set(0.65, 1, 0.38);
      loop.rotation.z = Math.PI / 2 - 0.35;
      loop.rotation.y = a;
      loop.position.set(Math.cos(a) * 0.32, 1.02, Math.sin(a) * 0.32);
      gift.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), createPaperMaterial(0xf4d35e));
    knot.position.y = 0.96;
    gift.add(knot);
    return gift;
  }

  const itemBoxes: ItemBoxEntity[] = [];
  const qTex = questionTexture();
  const boxMat = new THREE.MeshStandardMaterial({
    map: qTex,
    roughness: 0.6,
    metalness: 0,
    emissive: 0xffd166,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.95,
  });
  for (const it of spec.itemT) {
    const p = curve.getPointAt(it);
    const tg = curve.getTangentAt(it);
    const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
    for (let k = -2; k <= 2; k++) {
      const pos = p.clone().addScaledVector(n, k * (w * 0.18));
      const box = createOrigamiGiftBox(boxMat);
      box.position.set(pos.x, pos.y + 1.5, pos.z);
      box.userData.baseY = pos.y + 1.5;
      group.add(box);
      itemBoxes.push({ mesh: box, pos: pos.clone(), t: it, respawn: 0, active: true });
    }
  }

  // ---------- 路边立体书景物 ----------
  const props: PopupPropRig[] = [];
  const propCount = 92;
  for (let i = 0; i < propCount; i++) {
    const t = i / propCount;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
    const side = i % 2 === 0 ? 1 : -1;
    const off = half + 4 + Math.random() * 12;
    const pos = p.clone().addScaledVector(n, side * off);
    const rig = buildPopupProp(spec.theme, i, spec.colors);
    rig.rootPivot.position.set(pos.x, 0, pos.z);
    rig.rootPivot.rotation.y = Math.random() * Math.PI * 2;
    const s = 1.0 + Math.random() * 0.7;
    rig.rootPivot.scale.setScalar(s);
    group.add(rig.rootPivot);
    props.push(rig);
  }

  // ---------- 弯道小栅栏 / 灌木带 / 彩色纸花簇（合并为少量静态网格） ----------
  {
    const fenceWhite: THREE.BufferGeometry[] = [];
    const fenceWood: THREE.BufferGeometry[] = [];
    const bushGeos: THREE.BufferGeometry[] = [];
    const stemGeos: THREE.BufferGeometry[] = [];
    const headBuckets = new Map<number, THREE.BufferGeometry[]>();
    const fenceProto = getFenceSectionGeos();
    const bushProto = getBushGeo();
    const flowerProto = getFlowerGeos();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    const place = (
      list: THREE.BufferGeometry[],
      proto: THREE.BufferGeometry,
      pos: THREE.Vector3,
      rotY: number,
      scale: number
    ): void => {
      let g = proto.clone();
      e.set(0, rotY, 0, 'YXZ');
      q.setFromEuler(e);
      m4.compose(pos, q, sc.setScalar(scale));
      g.applyMatrix4(m4);
      if (g.index) {
        const ng = g.toNonIndexed();
        g.dispose();
        g = ng;
      }
      list.push(g);
    };
    const addMerged = (geos: THREE.BufferGeometry[], mat: THREE.Material, edges = false): void => {
      if (!geos.length) return;
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (edges) attachOrigamiEdges(mesh, 22);
      group.add(mesh);
    };

    for (let i = 0; i < ROAD_SAMPLES; i += 2) {
      const tgA = tangents[i];
      const tgB = tangents[(i + 5) % ROAD_SAMPLES];
      const crossY = tgA.z * tgB.x - tgA.x * tgB.z;
      const dot = tgA.x * tgB.x + tgA.z * tgB.z;
      const turn = Math.atan2(crossY, dot);
      const p = samples[i];
      if (Math.abs(turn) > 0.16) {
        // 急弯外侧：左转 → 外侧在右（normalAt 方向）
        const side = turn > 0 ? 1 : -1;
        const n = normalAt(i);
        const elevated = p.y > 1.2;
        const off = elevated ? half + curbW - 0.02 : half + curbW + 1.05;
        const pos = p.clone().addScaledVector(n, side * off);
        pos.y = elevated ? p.y + 0.12 : 0;
        const heading = Math.atan2(tgA.x, tgA.z) - Math.PI / 2;
        const bucket = Math.floor(i / 2) % 2 === 0 ? fenceWhite : fenceWood;
        const s = elevated ? 0.8 : 1;
        for (const proto of fenceProto) place(bucket, proto, pos, heading, s);
      } else if (i % 10 === 0 && p.y < 1.2) {
        // 缓弯 / 直道外侧灌木带（草地高度）
        const side = (i / 10) % 2 === 0 ? 1 : -1;
        const n = normalAt(i);
        const off = half + curbW + 1.7 + Math.random() * 2.4;
        const pos = p.clone().addScaledVector(n, side * off);
        pos.y = 0;
        place(bushGeos, bushProto, pos, Math.random() * Math.PI, 0.75 + Math.random() * 0.6);
        const pos2 = pos.clone().addScaledVector(tangents[i], 1.3 + Math.random());
        place(bushGeos, bushProto, pos2, Math.random() * Math.PI, 0.45 + Math.random() * 0.4);
      }
    }

    // 彩色纸花簇：草地上随机团簇，填补留白
    const petalPalette = [0xe05a47, 0xf4d35e, 0xf4a6b8, 0xb79ced, 0xff9f1c];
    for (let c = 0; c < 44; c++) {
      const t = Math.random();
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t);
      const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
      const side = Math.random() > 0.5 ? 1 : -1;
      const base = p.clone().addScaledVector(n, side * (half + 3.5 + Math.random() * 13));
      base.y = 0;
      const count = 5 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        const pos = base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0, (Math.random() - 0.5) * 2.2));
        const s = 0.7 + Math.random() * 0.7;
        const rotY = Math.random() * Math.PI;
        place(stemGeos, flowerProto.stem, pos, rotY, s);
        const color = petalPalette[Math.floor(Math.random() * petalPalette.length)];
        let bucket = headBuckets.get(color);
        if (!bucket) {
          bucket = [];
          headBuckets.set(color, bucket);
        }
        place(bucket, flowerProto.head, pos, rotY, s);
      }
    }

    const night = spec.theme === 'neon';
    addMerged(fenceWhite, createPaperMaterial(night ? 0xdfe6f2 : 0xfffdf8, getPaperFiberBump(), 0.9), true);
    addMerged(fenceWood, createPaperMaterial(night ? 0x3a4a72 : 0xd9c9a8, getPaperFiberBump(), 0.92), true);
    const bushColor = spec.theme === 'meadow' ? 0x7fae76 : spec.theme === 'frost' ? 0xeaf6fb : spec.theme === 'desk' ? 0xd9c9a8 : 0x2b3752;
    addMerged(bushGeos, createPaperMaterial(bushColor, getPaperFiberBump(), 0.95));
    addMerged(stemGeos, createPaperMaterial(night ? 0x3a4a72 : 0x6f9f6a, getPaperFiberBump(), 0.95));
    headBuckets.forEach((geos, color) => {
      addMerged(geos, night ? createEmissivePaper(color, color, 0.55) : createPaperMaterial(color, getPaperFiberBump(), 0.85));
    });
  }

  // ---------- 发车格（起跑线之后，避免开局即误判过线） ----------
  const startPositions: { pos: THREE.Vector3; heading: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const t = 0.04 - row * 0.009;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
    const lateral = (col === 0 ? -1 : 1) * w * 0.24;
    const pos = p.clone().addScaledVector(n, lateral);
    startPositions.push({ pos, heading: Math.atan2(tg.x, tg.z) });
  }

  // ---------- 小地图轮廓 ----------
  const outline: [number, number][] = [];
  for (let i = 0; i < 120; i++) {
    const p = curve.getPointAt(i / 120);
    outline.push([p.x, p.z]);
  }

  const query = (pos: THREE.Vector3): TrackQueryResult => {
    let best = 0;
    let bestScore = Infinity;
    let bestHorizSq = Infinity;
    for (let i = 0; i < ROAD_SAMPLES; i++) {
      const dx = samples[i].x - pos.x;
      const dy = samples[i].y - pos.y;
      const dz = samples[i].z - pos.z;
      const horizSq = dx * dx + dz * dz;
      const score = horizSq + dy * dy * 4.0;
      if (score < bestScore) {
        bestScore = score;
        bestHorizSq = horizSq;
        best = i;
      }
    }
    return {
      t: best / ROAD_SAMPLES,
      dist: Math.sqrt(bestHorizSq),
      point: samples[best],
      tangent: tangents[best],
    };
  };

  // 默认取包围盒中心；若是 8 字形等赛道穿过中心，自动寻找环内离赛道最远的开阔空地作为展台与中岛中心
  const { minX, maxX, minZ, maxZ } = bounds;
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  if (query(center).dist < half + 22) {
    let bestPt = center.clone();
    let bestClearance = query(center).dist;
    const probe = new THREE.Vector3();
    const steps = 14;
    for (let ix = 2; ix < steps - 1; ix++) {
      for (let iz = 2; iz < steps - 1; iz++) {
        const px = minX + ((maxX - minX) * ix) / steps;
        const pz = minZ + ((maxZ - minZ) * iz) / steps;
        probe.set(px, 0, pz);
        const d = query(probe).dist;
        if (d > bestClearance) {
          bestClearance = d;
          bestPt.copy(probe);
        }
      }
    }
    center.copy(bestPt);
  }

  buildStoryLandmarks(spec, curve, half, group);

  return {
    group,
    curve,
    length,
    width: w,
    itemBoxes,
    boostPads,
    props,
    startPositions,
    center,
    bounds,
    outline,
    query,
    pointAt: (t) => curve.getPointAt(((t % 1) + 1) % 1),
    tangentAt: (t) => curve.getTangentAt(((t % 1) + 1) % 1),
  };
}