import * as THREE from 'three';
import type { TrackSpec, PopupPropRig, ItemBoxEntity, BoostPadEntity } from '../types/game';
import { createPaperMaterial, createEmissivePaper, paperMesh, attachOrigamiEdges } from '../materials/PaperMaterial';
import { getChecker, getPaperFiberBump } from '../materials/PaperTextures';
import { buildPopupProp } from '../models/PopupPropBuilder';

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
  const center = new THREE.Vector3(
    (bounds.minX + bounds.maxX) / 2,
    0,
    (bounds.minZ + bounds.maxZ) / 2
  );

  const normalAt = (i: number) => {
    const tg = tangents[i % ROAD_SAMPLES];
    return new THREE.Vector3(-tg.z, 0, tg.x).normalize();
  };

  // ---------- 路面 ----------
  const roadPos: number[] = [];
  const roadUv: number[] = [];
  const roadIdx: number[] = [];
  for (let i = 0; i <= ROAD_SAMPLES; i++) {
    const idx = i % ROAD_SAMPLES;
    const p = samples[idx];
    const n = normalAt(idx);
    const l = p.clone().addScaledVector(n, -half);
    const r = p.clone().addScaledVector(n, half);
    roadPos.push(l.x, 0.05, l.z, r.x, 0.05, r.z);
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

  // ---------- 红白路肩（顶点色交替） ----------
  const curbW = 1.3;
  const curbPos: number[] = [];
  const curbCol: number[] = [];
  const curbIdx: number[] = [];
  const cA = new THREE.Color(spec.colors.curbA);
  const cB = new THREE.Color(spec.colors.curbB);
  let vertCount = 0;
  const segLen = 4;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < ROAD_SAMPLES; i++) {
      const idx = i % ROAD_SAMPLES;
      const p = samples[idx];
      const n = normalAt(idx);
      const inner = p.clone().addScaledVector(n, side * half);
      const outer = p.clone().addScaledVector(n, side * (half + curbW));
      const col = Math.floor(i / segLen) % 2 === 0 ? cA : cB;
      curbPos.push(inner.x, 0.12, inner.z, outer.x, 0.12, outer.z);
      curbCol.push(col.r, col.g, col.b, col.r, col.g, col.b);
      if (i < ROAD_SAMPLES - 1) {
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
  const curbMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
    bumpMap: getPaperFiberBump(),
    bumpScale: 0.04,
  });
  const curbs = new THREE.Mesh(curbGeo, curbMat);
  curbs.receiveShadow = true;
  curbs.castShadow = false;
  group.add(curbs);

  // ---------- 棋盘格起跑线 ----------
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
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.4), startMat);
  startLine.rotation.x = -Math.PI / 2;
  startLine.rotation.z = -startHeading;
  startLine.position.set(sp.x, 0.09, sp.z);
  startLine.receiveShadow = true;
  group.add(startLine);

  // ---------- 发光加速带 ----------
  const boostPads: BoostPadEntity[] = [];
  const boostColor = spec.theme === 'neon' ? 0xffd166 : spec.theme === 'frost' ? 0x9fd4ea : 0xf4d35e;
  for (const bt of spec.boostT) {
    const p = curve.getPointAt(bt);
    const tg = curve.getTangentAt(bt);
    const heading = Math.atan2(tg.x, tg.z);
    const padGroup = new THREE.Group();
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.7, 5),
      createEmissivePaper(boostColor, boostColor, 1.1)
    );
    pad.rotation.x = -Math.PI / 2;
    padGroup.add(pad);
    // 箭头雪佛龙
    for (let k = 0; k < 3; k++) {
      const chev = paperMesh(new THREE.ConeGeometry(1.1, 1.6, 3), 0xfffdf8, { edges: false });
      chev.rotation.x = -Math.PI / 2;
      chev.rotation.z = Math.PI;
      chev.position.set(0, 0.06, -1.4 + k * 1.4);
      chev.scale.set(1, 1, 0.2);
      padGroup.add(chev);
    }
    padGroup.position.set(p.x, 0.1, p.z);
    padGroup.rotation.y = heading;
    group.add(padGroup);
    boostPads.push({ mesh: padGroup, t: bt, pos: p.clone(), dir: tg.clone() });
  }

  // ---------- 道具箱 ----------
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
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), boxMat);
      attachOrigamiEdges(box, 20);
      box.position.set(pos.x, 1.5, pos.z);
      box.castShadow = true;
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
    let bestD = Infinity;
    for (let i = 0; i < ROAD_SAMPLES; i++) {
      const dx = samples[i].x - pos.x;
      const dz = samples[i].z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return {
      t: best / ROAD_SAMPLES,
      dist: Math.sqrt(bestD),
      point: samples[best],
      tangent: tangents[best],
    };
  };

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