import * as THREE from 'three';
import type { RacerSpec, PaperSpec } from '../types/game';
import {
  createPaperMaterial,
  createTexturedPaperMaterial,
  createTranslucentPaper,
  createEmissivePaper,
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
let cachedBodyGeo: THREE.BufferGeometry | null = null;

/** 柔边径向渐变贴地接触阴影 */
function getSoftShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTex) return cachedShadowTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
  grad.addColorStop(0, 'rgba(24, 18, 14, 0.48)');
  grad.addColorStop(0.55, 'rgba(24, 18, 14, 0.22)');
  grad.addColorStop(1, 'rgba(24, 18, 14, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedShadowTex = tex;
  return tex;
}

/** 圆底手账赛车编号贴纸 */
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

  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.fillStyle = '#fcf8ee';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = `#${accentHex.toString(16).padStart(6, '0')}`;
  ctx.stroke();

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

/** 平滑温润纸质材质（用于圆润车壳与 Q 版车手头雕，避免低模碎三角感） */
function makeSmoothPaperMat(color: number, ghost: boolean, roughness = 0.88): THREE.MeshStandardMaterial {
  if (ghost) return createTranslucentPaper(color, 0.35);
  const mat = createPaperMaterial(color, undefined, roughness);
  mat.flatShading = false;
  return mat;
}

/** 挺括折纸切面材质（用于耳朵、围巾、尾翼、小船帽等折纸配饰） */
function makeCrispPaperMat(color: number, ghost: boolean, roughness = 0.9): THREE.MeshStandardMaterial {
  if (ghost) return createTranslucentPaper(color, 0.35);
  return createPaperMaterial(color, undefined, roughness);
}

/**
 * 贝塞尔侧轮廓 + 圆角倒角挤出的一体式复古胖卡丁车壳
 * 局部坐标：+Z 为车头，-Z 为车尾，零接缝且自带饱满圆角
 */
function getCozyKartBodyGeo(): THREE.BufferGeometry {
  if (cachedBodyGeo) return cachedBodyGeo;

  const shape = new THREE.Shape();
  // 在 2D 平面画侧轮廓：x 对应世界 +Z（-1.65 车尾 -> +1.85 车头），y 对应高度
  shape.moveTo(-1.62, 0.24);
  shape.lineTo(1.55, 0.24);
  // 圆润低伏车头鼻尖
  shape.bezierCurveTo(1.92, 0.24, 1.98, 0.56, 1.62, 0.72);
  // 流畅上扬的引擎盖
  shape.bezierCurveTo(1.22, 0.88, 0.82, 0.92, 0.46, 0.88);
  // 座舱凹口曲线
  shape.bezierCurveTo(0.18, 0.74, -0.45, 0.74, -0.78, 0.94);
  // 饱满圆润的复古车尾驼峰
  shape.bezierCurveTo(-1.18, 1.06, -1.62, 0.96, -1.72, 0.62);
  shape.bezierCurveTo(-1.76, 0.42, -1.72, 0.24, -1.62, 0.24);

  const depth = 1.18;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.24,
    bevelSize: 0.18,
    bevelSegments: 4,
    curveSegments: 18,
  });
  // 沿挤出轴居中，再绕 Y 轴旋 -90° 让 2D 的 +x 精准朝向世界 +Z（车头）
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  ensureBoxUV(geo, 0.42);
  cachedBodyGeo = geo;
  return geo;
}

/** 敦实宽厚的大圆角玩具轮胎（深炭灰圆肩胎皮 + 奶油白轮毂 + 撞色铆钉） */
function makeChunkyWheel(accent: number, ghost: boolean): { spin: THREE.Group; mesh: THREE.Mesh } {
  const spin = new THREE.Group();

  const tireMat = makeSmoothPaperMat(ghost ? 0x484c56 : 0x2f333b, ghost, 0.92);
  const hubMat = makeSmoothPaperMat(0xfdf8ec, ghost, 0.86);
  const capMat = makeSmoothPaperMat(accent, ghost, 0.82);

  // 主胎面
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.48, 20), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = !ghost;
  tire.receiveShadow = !ghost;
  spin.add(tire);

  // 两侧圆润胎肩（消除生硬圆柱直角）
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.11, 8, 20), tireMat);
    shoulder.rotation.y = Math.PI / 2;
    shoulder.position.x = s * 0.18;
    spin.add(shoulder);
  }

  // 奶油白内凹轮毂盘
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.54, 18), hubMat);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);

  // 4 颗小圆装饰钉（让车轮转动更直观可爱）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.57, 8), tireMat);
    lug.rotation.z = Math.PI / 2;
    lug.position.set(0, Math.cos(a) * 0.22, Math.sin(a) * 0.22);
    spin.add(lug);
  }

  // 撞色中心轴盖
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.58, 12), capMat);
  cap.rotation.z = Math.PI / 2;
  spin.add(cap);

  return { spin, mesh: tire };
}

/** 组装圆润胖卡丁车一体车身（带牛皮纸底裙、引擎盖条纹、编号贴纸、圆灯与双排气） */
function buildCozyKartBody(
  racer: RacerSpec,
  primaryMat: THREE.Material,
  accentMat: THREE.Material,
  darkMat: THREE.Material,
  kraftMat: THREE.Material,
  creamMat: THREE.Material,
  ghost: boolean
): THREE.Group {
  const group = new THREE.Group();

  // 1. 一体式圆角贝塞尔胖车壳
  const body = new THREE.Mesh(getCozyKartBodyGeo(), primaryMat);
  body.castShadow = !ghost;
  body.receiveShadow = !ghost;
  group.add(body);

  // 2. 紧凑牛皮纸底盘围边（增加厚卡纸手工玩具质感）
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 3.25), kraftMat);
  base.position.set(0, 0.28, 0.05);
  base.castShadow = !ghost;
  base.receiveShadow = !ghost;
  group.add(base);

  // 前后圆润防撞保险杠
  const frontBumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.18, 6, 10), creamMat);
  frontBumper.rotation.z = Math.PI / 2;
  frontBumper.position.set(0, 0.34, 1.94);
  frontBumper.castShadow = !ghost;
  group.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.22, 6, 10), creamMat);
  rearBumper.rotation.z = Math.PI / 2;
  rearBumper.position.set(0, 0.36, -1.78);
  rearBumper.castShadow = !ghost;
  group.add(rearBumper);

  // 3. 引擎盖暖白装饰条 + 圆底编号贴纸 + 复古双圆大灯
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 1.2), creamMat);
  stripe.position.set(0, 0.99, 1.05);
  stripe.rotation.x = 0.18;
  group.add(stripe);

  if (!ghost) {
    const numText = RACER_NUMBER_MAP[racer.id] ?? '01';
    const badgeMat = createTexturedPaperMaterial(getNumberBadgeTexture(numText, racer.accentColor));
    badgeMat.polygonOffset = true;
    badgeMat.polygonOffsetFactor = -2;

    // 车头编号贴纸
    const hoodBadge = new THREE.Mesh(new THREE.CircleGeometry(0.32, 18), badgeMat);
    hoodBadge.position.set(0, 1.03, 1.18);
    hoodBadge.rotation.x = -Math.PI / 2 + 0.24;
    group.add(hoodBadge);

    // 车尾编号贴纸（比赛视角最显眼）
    const rearBadge = new THREE.Mesh(new THREE.CircleGeometry(0.28, 18), badgeMat);
    rearBadge.position.set(0, 0.86, -1.89);
    rearBadge.rotation.y = Math.PI;
    rearBadge.rotation.x = 0.2;
    group.add(rearBadge);

    // 复古萌系双圆前灯
    const lampGlow = createEmissivePaper(0xfff6cf, 0xffe082, 1.05);
    for (const s of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), creamMat);
      pod.scale.set(1, 1, 0.85);
      pod.position.set(s * 0.56, 0.72, 1.78);
      pod.castShadow = true;
      group.add(pod);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), lampGlow);
      lens.position.set(s * 0.56, 0.72, 1.94);
      group.add(lens);
    }

    // 车尾复古红圆尾灯
    const tailGlow = createEmissivePaper(0xff5b4a, 0xff3b2f, 1.1);
    for (const s of [-1, 1]) {
      const tLamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), tailGlow);
      tLamp.position.set(s * 0.56, 0.78, -1.84);
      group.add(tLamp);
    }
  }

  // 4. 座舱内衬 + 小弧形透明挡风玻璃
  const cockpit = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.52, 0.34, 14), darkMat);
  cockpit.position.set(0, 0.84, -0.2);
  cockpit.scale.set(1.08, 1, 1.2);
  group.add(cockpit);

  const windScreen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.6, 0.24, 12, 1, true, -Math.PI / 3, (2 * Math.PI) / 3),
    createTranslucentPaper(0xdbf2ff, 0.42)
  );
  windScreen.position.set(0, 1.08, 0.34);
  windScreen.rotation.x = 0.24;
  group.add(windScreen);

  // 5. 精致低矮单层弧形尾翼（衬托车尾但绝不遮挡大头动物车手）
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.16), darkMat);
    strut.position.set(s * 0.44, 1.24, -1.52);
    strut.rotation.x = -0.22;
    strut.castShadow = !ghost;
    group.add(strut);
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.09, 0.34), accentMat);
  wing.position.set(0, 1.44, -1.62);
  wing.rotation.x = -0.14;
  wing.castShadow = !ghost;
  group.add(wing);

  // 6. 尾部双出饱满圆筒排气管
  for (const s of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.56, 12), darkMat);
    pipe.rotation.x = Math.PI / 2 - 0.12;
    pipe.position.set(s * 0.38, 0.58, -1.96);
    pipe.castShadow = !ghost;
    group.add(pipe);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 10),
      createEmissivePaper(0xff784f, 0xff4518, 1.25)
    );
    glow.position.set(s * 0.38, 0.55, -2.25);
    glow.rotation.y = Math.PI;
    group.add(glow);
  }

  return group;
}

/** 1.35 倍放大 Q 版萌系手办车手（平滑饱满脸庞 + 标志大耳朵/帽子 + 飘逸双叉折纸围巾） */
function buildChibiDriver(racer: RacerSpec, ghost: boolean): { driverGroup: THREE.Group; steeringRig: THREE.Group } {
  const driverGroup = new THREE.Group();
  const steeringRig = new THREE.Group();

  const whiteSmooth = makeSmoothPaperMat(0xfffdf7, ghost, 0.88);
  const primarySmooth = makeSmoothPaperMat(racer.primaryColor, ghost, 0.86);
  const accentSmooth = makeSmoothPaperMat(racer.accentColor, ghost, 0.86);
  const primaryCrisp = makeCrispPaperMat(racer.primaryColor, ghost, 0.9);
  const accentCrisp = makeCrispPaperMat(racer.accentColor, ghost, 0.9);
  const whiteCrisp = makeCrispPaperMat(0xfffdf7, ghost, 0.9);
  const darkBrown = makeSmoothPaperMat(0x2b2019, ghost, 0.45);
  const blushMat = makeSmoothPaperMat(0xff9eb5, ghost, 0.9);

  // 1. 圆滚滚小身体 + 围巾领圈
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.24, 6, 12), primarySmooth);
  body.position.set(0, -0.34, 0);
  body.castShadow = !ghost;
  driverGroup.add(body);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.095, 8, 16), accentSmooth);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, -0.1, 0);
  collar.castShadow = !ghost;
  driverGroup.add(collar);

  // 脖后迎风飘逸的两条折纸围巾尾带（比赛车尾视角超有动感）
  for (const [idx, s] of [-1, 1].entries()) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.68 + idx * 0.14), accentCrisp);
    tail.position.set(s * 0.16, -0.12 - idx * 0.04, -0.52);
    tail.rotation.set(-0.18 - idx * 0.08, s * 0.22, s * 0.1);
    tail.castShadow = !ghost;
    driverGroup.add(tail);
  }

  // 2. 1.35 倍放大 Q 版手办大头（圆润平滑苹果肌）
  const isBox = racer.earType === 'box';
  const headGeo = isBox
    ? new THREE.BoxGeometry(0.96, 0.88, 0.9)
    : new THREE.SphereGeometry(0.56, 18, 14);
  if (!isBox) headGeo.scale(1.08, 0.94, 0.98);
  const headColor =
    racer.earType === 'fox' || racer.earType === 'bear' || isBox ? primarySmooth : whiteSmooth;
  const head = new THREE.Mesh(headGeo, headColor);
  head.position.set(0, 0.34, 0);
  head.castShadow = !ghost;
  driverGroup.add(head);

  // 3. 萌系大眼 + 双高光点 + 粉嫩腮红（box 除外）
  if (!isBox) {
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), darkBrown);
      eye.scale.set(1, 1.2, 0.5);
      eye.position.set(s * 0.23, 0.38, 0.51);
      eye.rotation.y = s * 0.18;
      driverGroup.add(eye);

      const sparkle = new THREE.Mesh(new THREE.CircleGeometry(0.036, 8), whiteSmooth);
      sparkle.position.set(s * 0.24 + 0.02, 0.42, 0.56);
      sparkle.rotation.y = s * 0.18;
      driverGroup.add(sparkle);

      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.095, 10), blushMat);
      cheek.position.set(s * 0.35, 0.23, 0.45);
      cheek.rotation.y = s * 0.48;
      driverGroup.add(cheek);
    }
  }

  // 4. 8 位车手专属大轮廓折纸特征（从车尾一眼可辨！）
  switch (racer.earType) {
    case 'fox': {
      // 奶白小脸颊吻部 + 黑鼻尖
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), whiteSmooth);
      snout.scale.set(1.15, 0.78, 1.1);
      snout.position.set(0, 0.22, 0.48);
      driverGroup.add(snout);

      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), darkBrown);
      nose.position.set(0, 0.27, 0.72);
      driverGroup.add(nose);

      // 超大双色折纸尖狐耳
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.76, 4), primaryCrisp);
        ear.scale.set(0.85, 1, 0.55);
        ear.position.set(s * 0.36, 0.94, -0.02);
        ear.rotation.set(-0.14, s * 0.2, -s * 0.34);
        ear.castShadow = !ghost;
        driverGroup.add(ear);

        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.52, 4), whiteCrisp);
        inner.scale.set(0.75, 1, 0.35);
        inner.position.set(s * 0.34, 0.9, 0.07);
        inner.rotation.set(-0.12, s * 0.2, -s * 0.34);
        driverGroup.add(inner);
      }

      // 复古飞行员风镜 + 绕脑后皮带
      for (const s of [-1, 1]) {
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 14), darkBrown);
        frame.position.set(s * 0.22, 0.64, 0.46);
        frame.rotation.y = s * 0.2;
        driverGroup.add(frame);

        const lens = new THREE.Mesh(
          new THREE.CircleGeometry(0.13, 12),
          createEmissivePaper(0x82d2f5, 0x4aa3cc, 0.75)
        );
        lens.position.set(s * 0.22, 0.64, 0.47);
        lens.rotation.y = s * 0.2;
        driverGroup.add(lens);
      }
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 16, 1, true), darkBrown);
      strap.position.set(0, 0.64, 0);
      driverGroup.add(strap);
      break;
    }
    case 'rabbit': {
      // 超高萌系长兔耳（一只直立微后扬，一只俏皮弯折）
      const earL = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.85, 6, 10), whiteSmooth);
      earL.scale.set(0.75, 1, 0.45);
      earL.position.set(-0.26, 1.18, -0.06);
      earL.rotation.set(-0.22, 0, 0.16);
      earL.castShadow = !ghost;
      driverGroup.add(earL);

      const earRBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.45, 6, 10), whiteSmooth);
      earRBase.scale.set(0.75, 1, 0.45);
      earRBase.position.set(0.26, 0.98, -0.04);
      earRBase.rotation.z = -0.22;
      earRBase.castShadow = !ghost;
      driverGroup.add(earRBase);

      const earRTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.45, 6, 10), accentSmooth);
      earRTip.scale.set(0.75, 1, 0.45);
      earRTip.position.set(0.5, 1.2, 0.08);
      earRTip.rotation.set(0.25, 0, -1.05);
      earRTip.castShadow = !ghost;
      driverGroup.add(earRTip);
      break;
    }
    case 'bear': {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), primarySmooth);
        ear.scale.set(1, 1, 0.55);
        ear.position.set(s * 0.46, 0.82, -0.02);
        ear.castShadow = !ghost;
        driverGroup.add(ear);

        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), accentSmooth);
        inner.scale.set(1, 1, 0.4);
        inner.position.set(s * 0.46, 0.82, 0.07);
        driverGroup.add(inner);
      }
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), accentSmooth);
      snout.scale.set(1.15, 0.82, 0.85);
      snout.position.set(0, 0.22, 0.48);
      driverGroup.add(snout);

      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), darkBrown);
      nose.position.set(0, 0.28, 0.68);
      driverGroup.add(nose);

      // 赛车头带 + 脑后飘带结
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 16, 1, true), accentCrisp);
      band.position.set(0, 0.54, 0);
      driverGroup.add(band);
      break;
    }
    case 'wing': {
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.46, 5), accentCrisp);
      beak.rotation.x = Math.PI / 2 + 0.25;
      beak.position.set(0, 0.24, 0.62);
      driverGroup.add(beak);

      // 三层飞扬折纸羽冠（车尾视角极帅）
      for (let i = 0; i < 3; i++) {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.3 - i * 0.04, 0.95, 4), primaryCrisp);
        feather.scale.set(0.45, 1, 0.22);
        feather.position.set(0, 0.78 - i * 0.16, -0.45 - i * 0.16);
        feather.rotation.x = -1.2 - i * 0.12;
        feather.castShadow = !ghost;
        driverGroup.add(feather);
      }
      break;
    }
    case 'sail': {
      // 招牌折纸小船水手帽
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.4, 0.28, 4), whiteCrisp);
      hull.rotation.y = Math.PI / 4;
      hull.scale.set(0.76, 1, 1.38);
      hull.position.set(0, 0.92, 0.02);
      hull.castShadow = !ghost;
      driverGroup.add(hull);

      const sail = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.68, 3), primaryCrisp);
      sail.scale.set(0.35, 1, 1.15);
      sail.position.set(0, 1.24, 0);
      sail.castShadow = !ghost;
      driverGroup.add(sail);

      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.09, 0.88), accentCrisp);
      ribbon.position.set(0, 0.82, 0.02);
      driverGroup.add(ribbon);
      break;
    }
    case 'box': {
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.28, 0.12),
        createEmissivePaper(0x56e39f, 0x3ac481, 1.2)
      );
      visor.position.set(0, 0.4, 0.44);
      driverGroup.add(visor);

      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.65, 8), darkBrown);
      antenna.position.set(0.26, 1.05, -0.05);
      antenna.rotation.z = -0.24;
      driverGroup.add(antenna);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        createEmissivePaper(0xff5b4a, 0xff4757, 1.35)
      );
      bulb.position.set(0.42, 1.38, -0.05);
      driverGroup.add(bulb);
      break;
    }
  }

  // 5. 圆润方向盘 + 搭在方向盘上的 Q 版小手
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.055, 8, 16), darkBrown);
  rim.rotation.x = Math.PI / 3;
  rim.position.set(0, -0.2, 0.56);
  steeringRig.add(rim);

  for (const s of [-1, 1]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), isBox ? darkBrown : primarySmooth);
    paw.position.set(s * 0.24, -0.18, 0.52);
    steeringRig.add(paw);
  }

  return { driverGroup, steeringRig };
}

/** 组装 Q 版圆润胖卡丁车 + 大头萌系折纸车手 */
export function buildCar(racer: RacerSpec, _paper: PaperSpec, ghost = false): CarVisual {
  const root = new THREE.Group();
  const tiltGroup = new THREE.Group();
  root.add(tiltGroup);

  const primary = makeSmoothPaperMat(racer.primaryColor, ghost, 0.86);
  const accent = makeSmoothPaperMat(racer.accentColor, ghost, 0.86);
  const dark = makeSmoothPaperMat(0x2d241e, ghost, 0.9);
  const kraft = makeSmoothPaperMat(0xc8a97e, ghost, 0.94);
  const cream = makeSmoothPaperMat(0xfcf6e8, ghost, 0.9);

  // 1. 一体式圆润胖卡丁车壳
  const body = buildCozyKartBody(racer, primary, accent, dark, kraft, cream, ghost);
  body.position.y = 0.24;
  tiltGroup.add(body);

  // 2. 柔边径向渐变贴地接触阴影
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.9, 5.2),
    new THREE.MeshBasicMaterial({
      map: getSoftShadowTexture(),
      transparent: true,
      opacity: ghost ? 0.12 : 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  // 3. 四只紧贴车身的宽厚大轮胎
  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];
  const wheelPos: [number, number, number, boolean][] = [
    [-1.02, 0.54, 1.18, true],
    [1.02, 0.54, 1.18, true],
    [-1.06, 0.56, -1.16, false],
    [1.06, 0.56, -1.16, false],
  ];

  for (const [x, y, z, isFront] of wheelPos) {
    const { spin } = makeChunkyWheel(racer.accentColor, ghost);
    if (isFront) {
      const steer = new THREE.Group();
      steer.position.set(x, y, z);
      steer.add(spin);
      tiltGroup.add(steer);
      frontWheels.push(steer);
    } else {
      spin.position.set(x, y, z);
      spin.scale.setScalar(1.06); // 后轮略大于前轮，卡丁车视觉更稳更有冲劲
      tiltGroup.add(spin);
    }
    wheels.push(spin);
  }

  // 4. 1.35 倍 Q 版大头萌系动物车手
  const { driverGroup, steeringRig } = buildChibiDriver(racer, ghost);
  driverGroup.position.set(0, 1.56, -0.22);
  tiltGroup.add(driverGroup);
  steeringRig.position.set(0, 1.24, -0.22);
  tiltGroup.add(steeringRig);

  // 5. 透明胶带护盾球
  const shieldMesh = new THREE.Group();
  const shieldSolid = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.45, 1),
    createTranslucentPaper(0xbfe3f2, 0.18, 0x9fd4ea, 0.35)
  );
  shieldMesh.add(shieldSolid);
  shieldMesh.position.y = 1.05;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  return { root, tiltGroup, wheels, frontWheels, shieldMesh };
}
