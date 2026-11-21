import * as THREE from 'three';
import type { RacerSpec, PaperSpec } from '../types/game';
import { loadPaperGLB } from './ModelLoader';
import {
  createPaperMaterial,
  createTexturedPaperMaterial,
  createTranslucentPaper,
  createEmissivePaper,
  attachOrigamiEdges,
  ensureBoxUV,
} from '../materials/PaperMaterial';

export interface CarVisual {
  root: THREE.Group;
  tiltGroup: THREE.Group;
  wheels: THREE.Object3D[]; // 自转组
  frontWheels: THREE.Object3D[]; // 转向枢轴
  shieldMesh: THREE.Object3D;
}

const RACER_NUMBER_MAP: Record<string, string> = {
  fox: '01',
  rabbit: '02',
  crane: '03',
  bear: '04',
  boat: '05',
  box: '06',
  cat: '07',
  owl: '08',
};

let cachedShadowTex: THREE.CanvasTexture | null = null;
const badgeTexCache = new Map<string, THREE.CanvasTexture>();

/** 柔边径向渐变接触阴影贴图（替代硬边黑圆片） */
function getSoftShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTex) return cachedShadowTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
  grad.addColorStop(0, 'rgba(24, 18, 14, 0.46)');
  grad.addColorStop(0.55, 'rgba(24, 18, 14, 0.22)');
  grad.addColorStop(1, 'rgba(24, 18, 14, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedShadowTex = tex;
  return tex;
}

/** 手工圆底赛车编号贴纸（带虚线缝线与白边） */
function getNumberBadgeTexture(numText: string, accentHex: number): THREE.CanvasTexture {
  const key = `${numText}-${accentHex}`;
  const hit = badgeTexCache.get(key);
  if (hit) return hit;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // 米白剪纸圆底
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = '#fcf8ee';
  ctx.fill();

  // 彩色外圈 + 虚线手账缝边
  ctx.lineWidth = 6;
  ctx.strokeStyle = `#${accentHex.toString(16).padStart(6, '0')}`;
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(72, 54, 42, 0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 手绘感粗体编号
  ctx.fillStyle = '#2d221c';
  ctx.font = '900 54px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numText, cx, cy + 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  badgeTexCache.set(key, tex);
  return tex;
}

function finalizePart(mesh: THREE.Mesh, ghost: boolean, threshold = 24, lightEdge = true): THREE.Mesh {
  ensureBoxUV(mesh.geometry);
  mesh.castShadow = !ghost;
  mesh.receiveShadow = !ghost;
  if (!ghost) {
    attachOrigamiEdges(mesh, threshold, lightEdge);
  }
  return mesh;
}

/** 叠层圆卡纸车轮：炭灰纸胎 + 奶油白内凹轮毂 + 十字卡纸辐条 + 彩色纸铆钉 */
function makeWheel(accent: number, ghost: boolean): { spin: THREE.Group; mesh: THREE.Mesh } {
  const spin = new THREE.Group();

  const tireColor = ghost ? 0x484c56 : 0x343840;
  const tireMat = ghost ? createTranslucentPaper(tireColor, 0.35) : createPaperMaterial(tireColor, undefined, 0.94);
  const tireGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.44, 14);
  const tire = finalizePart(new THREE.Mesh(tireGeo, tireMat), ghost, 22, true);
  tire.rotation.z = Math.PI / 2;
  spin.add(tire);

  const hubMat = ghost ? createTranslucentPaper(0xfdfaf2, 0.35) : createPaperMaterial(0xfdfaf2, undefined, 0.9);
  const hubGeo = new THREE.CylinderGeometry(0.41, 0.34, 0.46, 14);
  const hub = finalizePart(new THREE.Mesh(hubGeo, hubMat), ghost, 26, false);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);

  // 十字剪纸辐条（让轮子转动时的动态更明显）
  const spokeMat = ghost ? createTranslucentPaper(0xdccbb2, 0.35) : createPaperMaterial(0xdccbb2, undefined, 0.92);
  for (let i = 0; i < 2; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.475, 0.58, 0.1), spokeMat);
    spoke.rotation.x = (i * Math.PI) / 2;
    spin.add(spoke);
  }

  // 中心撞色纸铆钉
  const dotMat = ghost ? createTranslucentPaper(accent, 0.35) : createPaperMaterial(accent, undefined, 0.85);
  const dotGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.5, 8);
  const dot = finalizePart(new THREE.Mesh(dotGeo, dotMat), ghost, 26, true);
  dot.rotation.z = Math.PI / 2;
  spin.add(dot);

  return { spin, mesh: tire };
}

/** 弯曲冲压折纸轮拱 / 挡泥板 */
function createWheelFender(primaryMat: THREE.Material, ghost: boolean, isLeft: boolean): THREE.Mesh {
  const fenderGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.5, 8, 1, true, 0, Math.PI);
  fenderGeo.rotateZ(Math.PI / 2);
  fenderGeo.rotateY(isLeft ? 0 : Math.PI);
  const fender = finalizePart(new THREE.Mesh(fenderGeo, primaryMat), ghost, 20, true);
  return fender;
}

/** 流线型折纸赛车底盘（带牛皮纸底裙、白边赛车条纹、圆底编号贴纸、复古圆灯） */
function buildStreamlinedChassis(
  racer: RacerSpec,
  primaryMat: THREE.Material,
  accentMat: THREE.Material,
  darkMat: THREE.Material,
  kraftMat: THREE.Material,
  creamMat: THREE.Material,
  ghost: boolean
): THREE.Group {
  const group = new THREE.Group();

  // 0. 瓦楞牛皮纸厚底盘托板（手工模型感的核心锚点）
  const basePlateGeo = new THREE.BoxGeometry(1.48, 0.14, 4.35);
  const basePlate = finalizePart(new THREE.Mesh(basePlateGeo, kraftMat), ghost, 20, true);
  basePlate.position.set(0, 0.24, 0.08);
  group.add(basePlate);

  // 1. 流线型下压车头机盖
  const hoodGeo = new THREE.BufferGeometry();
  const hoodVerts = [
    0.0, 0.68, 1.45, -0.58, 0.38, 1.25, 0.0, 0.46, 2.25,
    0.0, 0.68, 1.45, 0.0, 0.46, 2.25, 0.58, 0.38, 1.25,
    0.0, 0.46, 2.25, -0.58, 0.38, 1.25, -0.35, 0.32, 2.45,
    0.0, 0.46, 2.25, -0.35, 0.32, 2.45, 0.0, 0.36, 2.55,
    0.0, 0.46, 2.25, 0.0, 0.36, 2.55, 0.35, 0.32, 2.45,
    0.0, 0.46, 2.25, 0.35, 0.32, 2.45, 0.58, 0.38, 1.25,
    0.0, 0.68, 1.45, -0.62, 0.58, 0.45, -0.58, 0.38, 1.25,
    0.0, 0.68, 1.45, 0.58, 0.38, 1.25, 0.62, 0.58, 0.45,
    0.0, 0.68, 1.45, 0.0, 0.82, 0.42, -0.62, 0.58, 0.45,
    0.0, 0.68, 1.45, 0.62, 0.58, 0.45, 0.0, 0.82, 0.42,
  ];
  hoodGeo.setAttribute('position', new THREE.Float32BufferAttribute(hoodVerts, 3));
  hoodGeo.computeVertexNormals();
  group.add(finalizePart(new THREE.Mesh(hoodGeo, primaryMat), ghost, 18, true));

  // 车头奶白纸贴条 + 编号圆贴纸
  if (!ghost) {
    const numText = RACER_NUMBER_MAP[racer.id] ?? '01';
    const badgeMat = createTexturedPaperMaterial(getNumberBadgeTexture(numText, racer.accentColor));
    badgeMat.polygonOffset = true;
    badgeMat.polygonOffsetFactor = -2;
    const hoodBadge = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), badgeMat);
    hoodBadge.position.set(0, 0.63, 1.58);
    hoodBadge.rotation.x = -Math.PI / 2 + 0.27;
    group.add(hoodBadge);

    // 车头复古双圆大灯（纸框 + 暖黄发光灯芯）
    const lampGlow = createEmissivePaper(0xfff6cf, 0xffe082, 1.1);
    for (const s of [-1, 1]) {
      const bezel = finalizePart(
        new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.14, 10), creamMat),
        false,
        24,
        false
      );
      bezel.rotation.x = Math.PI / 2;
      bezel.position.set(s * 0.44, 0.48, 2.02);
      bezel.rotation.y = s * 0.16;
      group.add(bezel);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), lampGlow);
      lens.position.set(s * 0.45, 0.48, 2.1);
      lens.rotation.y = s * 0.16;
      group.add(lens);
    }
  }

  // 2. 座舱两侧可乐瓶收腰侧板 + 车尾流线背板
  const flankGeo = new THREE.BufferGeometry();
  const flankVerts = [
    -0.62, 0.58, 0.45, -0.55, 0.28, 0.45, -0.68, 0.68, -1.25,
    -0.55, 0.28, 0.45, -0.62, 0.28, -1.25, -0.68, 0.68, -1.25,
    0.62, 0.58, 0.45, 0.68, 0.68, -1.25, 0.55, 0.28, 0.45,
    0.55, 0.28, 0.45, 0.68, 0.68, -1.25, 0.62, 0.28, -1.25,
    0.0, 0.82, -1.35, -0.68, 0.68, -1.25, 0.68, 0.68, -1.25,
    0.0, 0.82, -1.35, -0.58, 0.42, -2.05, -0.68, 0.68, -1.25,
    0.0, 0.82, -1.35, 0.68, 0.68, -1.25, 0.58, 0.42, -2.05,
    0.0, 0.82, -1.35, 0.0, 0.48, -2.12, -0.58, 0.42, -2.05,
    0.0, 0.82, -1.35, 0.58, 0.42, -2.05, 0.0, 0.48, -2.12,
  ];
  flankGeo.setAttribute('position', new THREE.Float32BufferAttribute(flankVerts, 3));
  flankGeo.computeVertexNormals();
  group.add(finalizePart(new THREE.Mesh(flankGeo, primaryMat), ghost, 18, true));

  // 3. 四轮拱形挡泥板
  const fenderPositions: [number, number, number, boolean][] = [
    [-1.12, 0.6, 1.34, true],
    [1.12, 0.6, 1.34, false],
    [-1.12, 0.6, -1.34, true],
    [1.12, 0.6, -1.34, false],
  ];
  for (const [x, y, z, isLeft] of fenderPositions) {
    const fender = createWheelFender(accentMat, ghost, isLeft);
    fender.position.set(x, y, z);
    group.add(fender);
  }

  // 4. 左右流线型进气侧箱 + 白色装饰条
  for (const s of [-1, 1]) {
    const podGeo = new THREE.CylinderGeometry(0.24, 0.32, 1.6, 7);
    podGeo.rotateX(Math.PI / 2);
    const pod = finalizePart(new THREE.Mesh(podGeo, primaryMat), ghost, 24, true);
    pod.position.set(s * 0.94, 0.52, 0.0);
    pod.scale.set(0.75, 0.9, 1.0);
    group.add(pod);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 1.25), creamMat);
    stripe.position.set(s * 1.12, 0.56, -0.05);
    group.add(stripe);

    const scoopGeo = new THREE.CircleGeometry(0.22, 8);
    const scoop = new THREE.Mesh(scoopGeo, darkMat);
    scoop.position.set(s * 0.94, 0.52, 0.81);
    scoop.scale.set(0.75, 0.9, 1);
    group.add(scoop);
  }

  // 5. 座舱、弧形风挡与防滚架
  const cockpitGeo = new THREE.CylinderGeometry(0.48, 0.42, 0.38, 10);
  const cockpit = finalizePart(new THREE.Mesh(cockpitGeo, darkMat), ghost, 24, true);
  cockpit.position.set(0, 0.62, -0.32);
  cockpit.scale.set(1.15, 1, 1.35);
  group.add(cockpit);

  const screenGeo = new THREE.CylinderGeometry(0.52, 0.55, 0.18, 8, 1, true, -Math.PI / 3, (2 * Math.PI) / 3);
  screenGeo.rotateX(0.2);
  const screen = new THREE.Mesh(screenGeo, createTranslucentPaper(0xd8effa, 0.45));
  screen.position.set(0, 0.88, 0.28);
  group.add(screen);

  const hoopGeo = new THREE.TorusGeometry(0.38, 0.055, 6, 12, Math.PI);
  const hoop = finalizePart(new THREE.Mesh(hoopGeo, creamMat), ghost, 28, false);
  hoop.position.set(0, 0.96, -0.92);
  hoop.rotation.x = -0.15;
  group.add(hoop);

  return group;
}

/** 萌趣有机弧面折纸车手（含补全后的 sail 折纸小船帽） */
function buildOrganicDriver(
  racer: RacerSpec,
  ghost: boolean
): { driverGroup: THREE.Group; steeringRig: THREE.Group } {
  const driverGroup = new THREE.Group();
  const steeringRig = new THREE.Group();

  const paperWhite = ghost
    ? createTranslucentPaper(0xfefcf6, 0.35)
    : createPaperMaterial(0xfefcf6, undefined, 0.92);
  const accent = ghost
    ? createTranslucentPaper(racer.accentColor, 0.35)
    : createPaperMaterial(racer.accentColor, undefined, 0.9);
  const primary = ghost
    ? createTranslucentPaper(racer.primaryColor, 0.35)
    : createPaperMaterial(racer.primaryColor, undefined, 0.9);
  const darkBrown = ghost
    ? createTranslucentPaper(0x2d221c, 0.4)
    : createPaperMaterial(0x2d221c, undefined, 0.72);

  // 1. 赛车服小身板 + 奶白围领
  const bodyGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.48, 10);
  const bodyMesh = finalizePart(new THREE.Mesh(bodyGeo, primary), ghost, 24, true);
  bodyMesh.position.set(0, -0.28, 0);
  driverGroup.add(bodyMesh);

  const collar = finalizePart(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.075, 6, 12), accent), ghost, 28, true);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, -0.06, 0);
  driverGroup.add(collar);

  // 2. 圆润多面头雕
  const headGeo = new THREE.DodecahedronGeometry(0.44, 1);
  headGeo.scale(1.05, 0.94, 0.96);
  const headMesh = finalizePart(
    new THREE.Mesh(headGeo, racer.earType === 'box' ? primary : paperWhite),
    ghost,
    26,
    false
  );
  driverGroup.add(headMesh);

  // 3. 纽扣高光眼
  for (const s of [-1, 1]) {
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 6);
    eyeGeo.scale(1, 1.25, 0.4);
    const eye = new THREE.Mesh(eyeGeo, darkBrown);
    eye.position.set(s * 0.2, 0.04, 0.41);
    eye.rotation.y = s * 0.18;
    driverGroup.add(eye);

    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.032, 6), paperWhite);
    pupil.position.set(s * 0.21 + 0.015, 0.07, 0.44);
    pupil.rotation.y = s * 0.18;
    driverGroup.add(pupil);
  }

  // 4. 各角色特征配饰
  switch (racer.earType) {
    case 'fox': {
      const snoutGeo = new THREE.ConeGeometry(0.2, 0.38, 6);
      snoutGeo.rotateX(Math.PI / 2);
      const snout = finalizePart(new THREE.Mesh(snoutGeo, primary), ghost, 24, true);
      snout.position.set(0, -0.06, 0.46);
      driverGroup.add(snout);

      const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), darkBrown);
      noseTip.position.set(0, -0.03, 0.65);
      driverGroup.add(noseTip);

      for (const s of [-1, 1]) {
        const earGeo = new THREE.ConeGeometry(0.22, 0.62, 5);
        earGeo.scale(0.8, 1, 0.5);
        const ear = finalizePart(new THREE.Mesh(earGeo, primary), ghost, 22, true);
        ear.position.set(s * 0.28, 0.46, -0.02);
        ear.rotation.set(-0.15, s * 0.22, -s * 0.32);
        driverGroup.add(ear);

        const innerGeo = new THREE.ConeGeometry(0.14, 0.45, 4);
        innerGeo.scale(0.7, 1, 0.3);
        const inner = new THREE.Mesh(innerGeo, paperWhite);
        inner.position.set(s * 0.26, 0.44, 0.05);
        inner.rotation.set(-0.12, s * 0.22, -s * 0.32);
        driverGroup.add(inner);
      }

      for (const s of [-1, 1]) {
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 10), darkBrown);
        frame.position.set(s * 0.18, 0.24, 0.38);
        frame.rotation.y = s * 0.2;
        driverGroup.add(frame);

        const lens = new THREE.Mesh(
          new THREE.CircleGeometry(0.11, 8),
          createEmissivePaper(0x82d2f5, 0x4aa3cc, 0.85)
        );
        lens.position.set(s * 0.18, 0.24, 0.39);
        lens.rotation.y = s * 0.2;
        driverGroup.add(lens);
      }

      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 12, 1, true), darkBrown);
      strap.position.set(0, 0.24, 0);
      driverGroup.add(strap);
      break;
    }
    case 'rabbit': {
      const earLGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.95, 6);
      earLGeo.scale(0.6, 1, 0.3);
      const earL = finalizePart(new THREE.Mesh(earLGeo, paperWhite), ghost, 22, false);
      earL.position.set(-0.22, 0.72, -0.08);
      earL.rotation.set(-0.25, 0, 0.16);
      driverGroup.add(earL);

      const earRGeo1 = new THREE.CylinderGeometry(0.12, 0.16, 0.55, 6);
      earRGeo1.scale(0.6, 1, 0.3);
      const earR1 = finalizePart(new THREE.Mesh(earRGeo1, paperWhite), ghost, 22, false);
      earR1.position.set(0.22, 0.58, -0.05);
      earR1.rotation.z = -0.22;
      driverGroup.add(earR1);

      const earRGeo2 = new THREE.ConeGeometry(0.14, 0.48, 5);
      earRGeo2.scale(0.6, 1, 0.3);
      const earR2 = finalizePart(new THREE.Mesh(earRGeo2, accent), ghost, 22, true);
      earR2.position.set(0.38, 0.86, 0.06);
      earR2.rotation.set(0.32, 0, -0.92);
      driverGroup.add(earR2);

      for (const s of [-1, 1]) {
        const blush = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), accent);
        blush.position.set(s * 0.28, -0.06, 0.36);
        blush.rotation.y = s * 0.45;
        driverGroup.add(blush);
      }
      break;
    }
    case 'bear': {
      for (const s of [-1, 1]) {
        const earGeo = new THREE.TorusGeometry(0.15, 0.08, 6, 8, Math.PI);
        earGeo.rotateZ(s > 0 ? 0 : Math.PI);
        const ear = finalizePart(new THREE.Mesh(earGeo, primary), ghost, 24, true);
        ear.position.set(s * 0.36, 0.36, -0.05);
        ear.rotation.y = s * 0.25;
        driverGroup.add(ear);
      }

      const snoutGeo = new THREE.SphereGeometry(0.22, 8, 6);
      snoutGeo.scale(1.1, 0.85, 0.8);
      const snout = new THREE.Mesh(snoutGeo, accent);
      snout.position.set(0, -0.08, 0.38);
      driverGroup.add(snout);

      const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), darkBrown);
      noseTip.position.set(0, -0.02, 0.54);
      driverGroup.add(noseTip);

      const band = finalizePart(
        new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 12, 1, true), accent),
        ghost,
        26,
        false
      );
      band.position.set(0, 0.18, 0);
      driverGroup.add(band);
      break;
    }
    case 'wing': {
      const beakGeo = new THREE.ConeGeometry(0.18, 0.48, 5);
      beakGeo.rotateX(Math.PI / 2 + 0.35);
      beakGeo.rotateZ(Math.PI);
      const beak = finalizePart(new THREE.Mesh(beakGeo, accent), ghost, 22, true);
      beak.position.set(0, -0.06, 0.48);
      driverGroup.add(beak);

      for (let i = 0; i < 3; i++) {
        const featherGeo = new THREE.ConeGeometry(0.32 - i * 0.05, 0.85, 4);
        featherGeo.scale(0.5, 1, 0.2);
        const feather = finalizePart(new THREE.Mesh(featherGeo, primary), ghost, 20, true);
        feather.position.set(0, 0.38 - i * 0.14, -0.38 - i * 0.18);
        feather.rotation.x = -1.25 - i * 0.12;
        driverGroup.add(feather);
      }
      break;
    }
    case 'sail': {
      // 帆舟·浪：头顶标志性折纸小船水手帽 + 蓝色帽带
      const hatHullGeo = new THREE.CylinderGeometry(0.46, 0.32, 0.24, 4);
      hatHullGeo.rotateY(Math.PI / 4);
      hatHullGeo.scale(0.75, 1, 1.35);
      const hatHull = finalizePart(new THREE.Mesh(hatHullGeo, paperWhite), ghost, 18, false);
      hatHull.position.set(0, 0.46, 0.02);
      driverGroup.add(hatHull);

      const sailGeo = new THREE.ConeGeometry(0.28, 0.56, 3);
      sailGeo.scale(0.35, 1, 1.1);
      const sail = finalizePart(new THREE.Mesh(sailGeo, primary), ghost, 18, true);
      sail.position.set(0, 0.72, 0.0);
      driverGroup.add(sail);

      const hatRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.72), accent);
      hatRibbon.position.set(0, 0.38, 0.02);
      driverGroup.add(hatRibbon);
      break;
    }
    case 'box': {
      const eyeVisor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.18, 8, 1, true, -Math.PI / 4, Math.PI / 2),
        createEmissivePaper(0x56e39f, 0x3ac481, 1.4)
      );
      eyeVisor.position.set(0, 0.06, 0.05);
      driverGroup.add(eyeVisor);

      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.65, 6), darkBrown);
      antenna.position.set(0.24, 0.58, -0.08);
      antenna.rotation.set(-0.15, 0, -0.28);
      driverGroup.add(antenna);

      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 6),
        createEmissivePaper(0xff4757, 0xff4757, 1.5)
      );
      tip.position.set(0.39, 0.9, -0.12);
      driverGroup.add(tip);
      break;
    }
  }

  // 5. 方向盘与小爪子
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12), darkBrown);
  wheelHub.rotation.x = Math.PI / 3;
  wheelHub.position.set(0, -0.28, 0.52);
  steeringRig.add(wheelHub);

  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 6, 12), accent);
  wheelRim.rotation.x = Math.PI / 3;
  wheelRim.position.set(0, -0.28, 0.52);
  steeringRig.add(wheelRim);

  for (const s of [-1, 1]) {
    const armGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.32, 6);
    armGeo.rotateZ(s * 0.4);
    armGeo.rotateX(0.4);
    const arm = new THREE.Mesh(armGeo, primary);
    arm.position.set(s * 0.28, -0.24, 0.36);
    driverGroup.add(arm);

    const pawGeo = new THREE.SphereGeometry(0.09, 6, 5);
    pawGeo.scale(1, 0.8, 1.2);
    const paw = new THREE.Mesh(pawGeo, racer.earType === 'box' ? darkBrown : primary);
    paw.position.set(s * 0.21, -0.24, 0.49);
    paw.rotation.y = s * 0.3;
    steeringRig.add(paw);
  }

  return { driverGroup, steeringRig };
}

/** 组装高阶手工拼贴折纸赛车 */
export function buildCar(racer: RacerSpec, _paper: PaperSpec, ghost = false): CarVisual {
  const root = new THREE.Group();
  const tiltGroup = new THREE.Group();
  root.add(tiltGroup);

  const primary = ghost ? createTranslucentPaper(racer.primaryColor, 0.35) : createPaperMaterial(racer.primaryColor);
  const accent = ghost ? createTranslucentPaper(racer.accentColor, 0.35) : createPaperMaterial(racer.accentColor);
  const dark = ghost ? createTranslucentPaper(0x28201a, 0.35) : createPaperMaterial(0x28201a, undefined, 0.95);
  const kraft = ghost ? createTranslucentPaper(0xc8a97e, 0.35) : createPaperMaterial(0xc8a97e, undefined, 0.96);
  const cream = ghost ? createTranslucentPaper(0xfaf3e3, 0.35) : createPaperMaterial(0xfaf3e3, undefined, 0.92);

  // 1. 流线型底盘（含牛皮纸底板、贴纸编号与复古圆灯）
  const chassis = buildStreamlinedChassis(racer, primary, accent, dark, kraft, cream, ghost);
  chassis.position.y = 0.34;
  tiltGroup.add(chassis);

  // 外部精致折纸车模（若放入 public/models/kart.glb 或 kart_<id>.glb 则自动优雅替换手搓车壳）
  if (!ghost) {
    (loadPaperGLB(`/models/kart_${racer.id}.glb`, {
      targetSize: 4.4,
      keepOriginalMap: true,
      tintColor: 0xffffff,
      flatShading: true,
    }).then((glb) => glb ?? loadPaperGLB('/models/kart.glb', {
      targetSize: 4.4,
      keepOriginalMap: true,
      tintColor: 0xffffff,
      flatShading: true,
    }))).then((glbCar) => {
      if (!glbCar) return;
      chassis.visible = false;
      glbCar.position.y = 0.28;
      tiltGroup.add(glbCar);
    });
  }

  // 2. 柔边径向渐变贴地接触阴影
  const tray = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 6.2),
    new THREE.MeshBasicMaterial({
      map: getSoftShadowTexture(),
      transparent: true,
      opacity: ghost ? 0.12 : 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );
  tray.rotation.x = -Math.PI / 2;
  tray.position.y = 0.03;
  root.add(tray);

  // 3. 前下扰流铲
  const splitterGeo = new THREE.CylinderGeometry(1.08, 1.15, 0.06, 10, 1, false, -Math.PI / 2, Math.PI);
  splitterGeo.rotateX(Math.PI / 2);
  const splitter = finalizePart(new THREE.Mesh(splitterGeo, kraft), ghost, 24, true);
  splitter.position.set(0, 0.36, 2.22);
  splitter.scale.set(1.0, 0.55, 1.0);
  tiltGroup.add(splitter);

  // 4. 双层弧面竞技大尾翼
  for (const s of [-1, 1]) {
    const postGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.72, 6);
    postGeo.rotateX(0.24);
    const post = finalizePart(new THREE.Mesh(postGeo, dark), ghost, 24, true);
    post.position.set(s * 0.48, 1.18, -1.95);
    tiltGroup.add(post);
  }

  const wingGeo = new THREE.CylinderGeometry(0.88, 0.88, 0.08, 10);
  wingGeo.scale(1.0, 0.5, 0.35);
  wingGeo.rotateZ(Math.PI / 2);
  wingGeo.rotateX(-0.16);
  const mainWing = finalizePart(new THREE.Mesh(wingGeo, accent), ghost, 22, true);
  mainWing.position.set(0, 1.44, -2.08);
  tiltGroup.add(mainWing);

  for (const s of [-1, 1]) {
    const endplateGeo = new THREE.ConeGeometry(0.38, 0.76, 4);
    endplateGeo.scale(0.12, 1, 0.6);
    endplateGeo.rotateZ(Math.PI / 2);
    endplateGeo.rotateY(s * 0.1);
    const endplate = finalizePart(new THREE.Mesh(endplateGeo, primary), ghost, 20, true);
    endplate.position.set(s * 0.92, 1.46, -2.12);
    tiltGroup.add(endplate);
  }

  // 车尾左侧手工竹签小纸旗（增加后视角玩具辨识度）
  if (!ghost) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.15, 6), kraft);
    pole.position.set(-0.78, 1.52, -1.85);
    pole.rotation.z = 0.14;
    pole.rotation.x = -0.18;
    tiltGroup.add(pole);

    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0.24, 0,
          0, -0.16, 0,
          0, 0.04, -0.68,
        ],
        3
      )
    );
    flagGeo.computeVertexNormals();
    const flagMat = createPaperMaterial(racer.accentColor, undefined, 0.88);
    flagMat.side = THREE.DoubleSide;
    const flag = finalizePart(new THREE.Mesh(flagGeo, flagMat), false, 15, true);
    flag.position.set(-0.86, 1.92, -1.94);
    tiltGroup.add(flag);
  }

  // 5. 尾部双出排气管
  for (const s of [-1, 1]) {
    const pipeGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.48, 8);
    pipeGeo.rotateX(Math.PI / 2);
    const pipe = finalizePart(new THREE.Mesh(pipeGeo, dark), ghost, 24, true);
    pipe.position.set(s * 0.32, 0.56, -2.28);
    tiltGroup.add(pipe);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 8),
      createEmissivePaper(0xff6b4a, 0xff3814, 1.3)
    );
    glow.position.set(s * 0.32, 0.56, -2.53);
    tiltGroup.add(glow);
  }

  // 6. 四只叠层纸轮
  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];
  const wheelPos: [number, number, number, boolean][] = [
    [-1.12, 0.56, 1.34, true],
    [1.12, 0.56, 1.34, true],
    [-1.12, 0.56, -1.34, false],
    [1.12, 0.56, -1.34, false],
  ];

  for (const [x, y, z, isFront] of wheelPos) {
    const { spin } = makeWheel(racer.accentColor, ghost);
    if (isFront) {
      const steer = new THREE.Group();
      steer.position.set(x, y, z);
      spin.position.set(0, 0, 0);
      steer.add(spin);
      tiltGroup.add(steer);
      frontWheels.push(steer);
    } else {
      spin.position.set(x, y, z);
      tiltGroup.add(spin);
    }
    wheels.push(spin);
  }

  // 7. 动物车手 + 方向盘联动
  const { driverGroup, steeringRig } = buildOrganicDriver(racer, ghost);
  driverGroup.position.set(0, 1.54, -0.28);
  tiltGroup.add(driverGroup);

  steeringRig.position.set(0, 1.25, -0.28);
  tiltGroup.add(steeringRig);

  // 8. 迎风飘逸折纸小披风 + 行囊
  const capeGeo = new THREE.BufferGeometry();
  capeGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -0.34, 1.74, -0.62,
        0, 1.78, -0.68,
        0, 1.38, -1.24,
        -0.34, 1.74, -0.62,
        0, 1.38, -1.24,
        -0.44, 1.48, -1.14,
        0, 1.78, -0.68,
        0.34, 1.74, -0.62,
        0.44, 1.48, -1.14,
        0, 1.78, -0.68,
        0.44, 1.48, -1.14,
        0, 1.38, -1.24,
      ],
      3
    )
  );
  capeGeo.computeVertexNormals();
  const capeMat = ghost
    ? createTranslucentPaper(racer.accentColor, 0.35)
    : createPaperMaterial(racer.accentColor, undefined, 0.88);
  capeMat.side = THREE.DoubleSide;
  const cape = finalizePart(new THREE.Mesh(capeGeo, capeMat), ghost, 16, true);
  tiltGroup.add(cape);

  const packGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.44, 8);
  packGeo.scale(1, 0.8, 0.6);
  const pack = finalizePart(new THREE.Mesh(packGeo, cream), ghost, 24, false);
  pack.position.set(0, 1.52, -1.34);
  tiltGroup.add(pack);

  // 9. 护盾视觉
  const shieldMesh = new THREE.Group();
  const shieldSolid = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.55, 1),
    createTranslucentPaper(0xbfe3f2, 0.18, 0x9fd4ea, 0.35)
  );
  shieldMesh.add(shieldSolid);
  shieldMesh.position.y = 1.0;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  return { root, tiltGroup, wheels, frontWheels, shieldMesh };
}
