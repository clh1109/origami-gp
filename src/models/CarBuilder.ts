import * as THREE from 'three';
import type { RacerSpec, PaperSpec } from '../types/game';
import {
  paperMesh,
  createPaperMaterial,
  createTranslucentPaper,
  createEmissivePaper,
} from '../materials/PaperMaterial';

export interface CarVisual {
  root: THREE.Group;
  tiltGroup: THREE.Group;
  wheels: THREE.Object3D[]; // 自转组
  frontWheels: THREE.Object3D[]; // 转向枢轴
  shieldMesh: THREE.Object3D;
}

/** 14边倒角圆润多面体折纸轮胎 + 内凹深盘轮毂 + 撞色轴心 */
function makeWheel(accent: number, ghost: boolean): { spin: THREE.Group; mesh: THREE.Mesh } {
  const spin = new THREE.Group();

  // 1. 14边形圆润深炭灰折纸轮胎（带侧壁倒角斜面）
  const tireColor = ghost ? 0x484c56 : 0x343840;
  const tireMat = ghost
    ? createTranslucentPaper(tireColor, 0.35)
    : createPaperMaterial(tireColor, undefined, 0.94);
  const tireGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.44, 14);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = !ghost;
  tire.receiveShadow = !ghost;
  spin.add(tire);

  // 2. 内凹深盘折纸轮毂（阶梯收窄，营造真实汽车轮圈的深浅层次）
  const hubMat = ghost
    ? createTranslucentPaper(0xfdfaf2, 0.35)
    : createPaperMaterial(0xfdfaf2, undefined, 0.88);
  const hubGeo = new THREE.CylinderGeometry(0.40, 0.32, 0.46, 14);
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);

  // 3. 轮毂内凹星形轴承座（带车身撞色点缀）
  const dotMat = ghost
    ? createTranslucentPaper(accent, 0.35)
    : createPaperMaterial(accent, undefined, 0.8);
  const dotGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.49, 7);
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.rotation.z = Math.PI / 2;
  spin.add(dot);

  return { spin, mesh: tire };
}

/** 弯曲冲压折纸轮拱 / 挡泥板（半圆弧形卡纸罩在车轮上方） */
function createWheelFender(primaryMat: THREE.Material, ghost: boolean, isLeft: boolean): THREE.Mesh {
  // 半圆弧形折纸壳：开角 PI，半径 0.75，宽 0.52，由 8 个平直折面构成的优雅弧线
  const fenderGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.50, 8, 1, true, 0, Math.PI);
  // 调整朝向：使其呈拱桥状横跨在车轮上
  fenderGeo.rotateZ(Math.PI / 2);
  fenderGeo.rotateY(isLeft ? 0 : Math.PI);

  const fender = new THREE.Mesh(fenderGeo, primaryMat);
  fender.castShadow = !ghost;
  fender.receiveShadow = !ghost;
  return fender;
}

/** 流线型折纸赛车底盘（流线机盖、可乐瓶收腰、四轮弧形轮拱） */
function buildStreamlinedChassis(
  primaryMat: THREE.Material,
  accentMat: THREE.Material,
  darkMat: THREE.Material,
  ghost: boolean
): THREE.Group {
  const group = new THREE.Group();

  // 1. 流线型下压车头机盖（中央隆起脊骨，向两侧与前方平滑低伏）
  const hoodGeo = new THREE.BufferGeometry();
  const hoodVerts = [
    // 脊骨中央向两侧展开的折面
    0.0, 0.68, 1.45,   -0.58, 0.38, 1.25,    0.0, 0.46, 2.25,
    0.0, 0.68, 1.45,    0.0, 0.46, 2.25,    0.58, 0.38, 1.25,
    // 前端收口低伏鼻尖
    0.0, 0.46, 2.25,   -0.58, 0.38, 1.25,   -0.35, 0.32, 2.45,
    0.0, 0.46, 2.25,   -0.35, 0.32, 2.45,    0.0, 0.36, 2.55,
    0.0, 0.46, 2.25,    0.0, 0.36, 2.55,    0.35, 0.32, 2.45,
    0.0, 0.46, 2.25,    0.35, 0.32, 2.45,    0.58, 0.38, 1.25,
    // 机盖向后延伸至座舱前围
    0.0, 0.68, 1.45,   -0.62, 0.58, 0.45,   -0.58, 0.38, 1.25,
    0.0, 0.68, 1.45,    0.58, 0.38, 1.25,    0.62, 0.58, 0.45,
    0.0, 0.68, 1.45,    0.0, 0.82, 0.42,   -0.62, 0.58, 0.45,
    0.0, 0.68, 1.45,    0.62, 0.58, 0.45,    0.0, 0.82, 0.42,
  ];
  hoodGeo.setAttribute('position', new THREE.Float32BufferAttribute(hoodVerts, 3));
  hoodGeo.computeVertexNormals();
  const hoodMesh = new THREE.Mesh(hoodGeo, primaryMat);
  hoodMesh.castShadow = !ghost;
  hoodMesh.receiveShadow = !ghost;
  group.add(hoodMesh);

  // 2. 座舱两侧可乐瓶流线收腰侧板 + 底部整流板
  const flankGeo = new THREE.BufferGeometry();
  const flankVerts = [
    // 左侧板
    -0.62, 0.58, 0.45,  -0.55, 0.28, 0.45,  -0.68, 0.68, -1.25,
    -0.55, 0.28, 0.45,  -0.62, 0.28, -1.25, -0.68, 0.68, -1.25,
    // 右侧板
    0.62, 0.58, 0.45,   0.68, 0.68, -1.25,   0.55, 0.28, 0.45,
    0.55, 0.28, 0.45,   0.68, 0.68, -1.25,   0.62, 0.28, -1.25,
    // 车尾流线背板
    0.0, 0.82, -1.35,  -0.68, 0.68, -1.25,   0.68, 0.68, -1.25,
    0.0, 0.82, -1.35,  -0.58, 0.42, -2.05, -0.68, 0.68, -1.25,
    0.0, 0.82, -1.35,   0.68, 0.68, -1.25,   0.58, 0.42, -2.05,
    0.0, 0.82, -1.35,   0.0, 0.48, -2.12,  -0.58, 0.42, -2.05,
    0.0, 0.82, -1.35,   0.58, 0.42, -2.05,   0.0, 0.48, -2.12,
  ];
  flankGeo.setAttribute('position', new THREE.Float32BufferAttribute(flankVerts, 3));
  flankGeo.computeVertexNormals();
  const flankMesh = new THREE.Mesh(flankGeo, primaryMat);
  flankMesh.castShadow = !ghost;
  flankMesh.receiveShadow = !ghost;
  group.add(flankMesh);

  // 3. 四个车轮的优雅拱形挡泥板（前后轮拱）
  const fenderPositions: [number, number, number, boolean][] = [
    [-1.12, 0.60, 1.34, true],   // 左前
    [1.12, 0.60, 1.34, false],   // 右前
    [-1.12, 0.60, -1.34, true],  // 左后
    [1.12, 0.60, -1.34, false],  // 右后
  ];
  for (const [x, y, z, isLeft] of fenderPositions) {
    const fender = createWheelFender(accentMat, ghost, isLeft);
    fender.position.set(x, y, z);
    group.add(fender);
  }

  // 4. 左右流线型进气侧箱（侧向弧度延伸，连接前后轮拱）
  for (const s of [-1, 1]) {
    const podGeo = new THREE.CylinderGeometry(0.24, 0.32, 1.6, 7);
    podGeo.rotateX(Math.PI / 2);
    const pod = new THREE.Mesh(podGeo, primaryMat);
    pod.position.set(s * 0.94, 0.52, 0.0);
    pod.scale.set(0.75, 0.9, 1.0);
    pod.castShadow = !ghost;
    group.add(pod);

    // 侧箱前置黑色进气滤网
    const scoopGeo = new THREE.CircleGeometry(0.22, 8);
    const scoop = new THREE.Mesh(scoopGeo, darkMat);
    scoop.position.set(s * 0.94, 0.52, 0.81);
    group.add(scoop);
  }

  // 5. 环抱式内凹座舱与真皮质感深色底座
  const cockpitGeo = new THREE.CylinderGeometry(0.48, 0.42, 0.38, 10);
  const cockpit = new THREE.Mesh(cockpitGeo, darkMat);
  cockpit.position.set(0, 0.62, -0.32);
  cockpit.scale.set(1.15, 1, 1.35);
  cockpit.castShadow = !ghost;
  group.add(cockpit);

  // 座舱前方小折纸弧形风挡 (Windscreen)
  const screenGeo = new THREE.CylinderGeometry(0.52, 0.55, 0.18, 8, 1, true, -Math.PI / 3, (2 * Math.PI) / 3);
  screenGeo.rotateX(0.2);
  const screen = new THREE.Mesh(screenGeo, createTranslucentPaper(0xd8effa, 0.45));
  screen.position.set(0, 0.88, 0.28);
  group.add(screen);

  // 弧形防滚架 (Roll Hoop)
  const hoopGeo = new THREE.TorusGeometry(0.38, 0.055, 6, 12, Math.PI);
  const hoop = new THREE.Mesh(hoopGeo, darkMat);
  hoop.position.set(0, 0.96, -0.92);
  hoop.rotation.x = -0.15;
  hoop.castShadow = !ghost;
  group.add(hoop);

  return group;
}

/** 萌趣有机弧面折纸车手（圆润多面脸颊、立体萌耳、弧形风镜、圆滚滚小身体与方向盘小爪） */
function buildOrganicDriver(racer: RacerSpec, ghost: boolean): { driverGroup: THREE.Group; steeringRig: THREE.Group } {
  const driverGroup = new THREE.Group();
  const steeringRig = new THREE.Group();

  const paperWhite = ghost ? createTranslucentPaper(0xfefcf6, 0.35) : createPaperMaterial(0xfefcf6, undefined, 0.92);
  const accent = ghost ? createTranslucentPaper(racer.accentColor, 0.35) : createPaperMaterial(racer.accentColor, undefined, 0.9);
  const primary = ghost ? createTranslucentPaper(racer.primaryColor, 0.35) : createPaperMaterial(racer.primaryColor, undefined, 0.9);
  const darkBrown = ghost ? createTranslucentPaper(0x2d221c, 0.4) : createPaperMaterial(0x2d221c, undefined, 0.7);

  // 1. 圆滚滚的折纸身体（穿赛车服的小身板）
  const bodyGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.48, 10);
  const bodyMesh = new THREE.Mesh(bodyGeo, primary);
  bodyMesh.position.set(0, -0.28, 0);
  bodyMesh.castShadow = !ghost;
  driverGroup.add(bodyMesh);

  // 2. 圆润有机的折纸多面头雕（圆弧下巴与饱满苹果肌，彻底消除方块盒子的生硬感）
  // 使用细分的十二面多面体，缩放出微微压扁的圆嘟嘟脸庞
  const headGeo = new THREE.DodecahedronGeometry(0.44, 1);
  headGeo.scale(1.05, 0.94, 0.96);
  const headMesh = new THREE.Mesh(headGeo, racer.earType === 'box' ? primary : paperWhite);
  headMesh.castShadow = !ghost;
  driverGroup.add(headMesh);

  // 3. 有神采的萌系眼睛（弧形纽扣高光眼）
  for (const s of [-1, 1]) {
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 6);
    eyeGeo.scale(1, 1.25, 0.4);
    const eye = new THREE.Mesh(eyeGeo, darkBrown);
    eye.position.set(s * 0.20, 0.04, 0.41);
    eye.rotation.y = s * 0.18;
    driverGroup.add(eye);

    // 灵动高光小圆点
    const pupilGeo = new THREE.CircleGeometry(0.032, 6);
    const pupil = new THREE.Mesh(pupilGeo, paperWhite);
    pupil.position.set(s * 0.21 + 0.015, 0.07, 0.44);
    pupil.rotation.y = s * 0.18;
    driverGroup.add(pupil);
  }

  // 4. 各具性格的生动折纸动物五官与配饰
  switch (racer.earType) {
    case 'fox': {
      // 赤狐·焰：立体微翘狐狸吻部 + 双色弧度折叠狐耳 + 圆弧复古飞行风镜
      // 凸起小嘴吻部
      const snoutGeo = new THREE.ConeGeometry(0.20, 0.38, 6);
      snoutGeo.rotateX(Math.PI / 2);
      const snout = new THREE.Mesh(snoutGeo, primary);
      snout.position.set(0, -0.06, 0.46);
      driverGroup.add(snout);

      // 黑鼻尖
      const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), darkBrown);
      noseTip.position.set(0, -0.03, 0.65);
      driverGroup.add(noseTip);

      // 弧形双色狐狸折耳（稍向前倾，外红内白）
      for (const s of [-1, 1]) {
        // 外耳
        const earGeo = new THREE.ConeGeometry(0.22, 0.62, 5);
        earGeo.scale(0.8, 1, 0.5);
        const ear = new THREE.Mesh(earGeo, primary);
        ear.position.set(s * 0.28, 0.46, -0.02);
        ear.rotation.z = -s * 0.32;
        ear.rotation.x = -0.15;
        ear.rotation.y = s * 0.22;
        driverGroup.add(ear);

        // 内耳暖白绒毛折面
        const innerGeo = new THREE.ConeGeometry(0.14, 0.45, 4);
        innerGeo.scale(0.7, 1, 0.3);
        const inner = new THREE.Mesh(innerGeo, paperWhite);
        inner.position.set(s * 0.26, 0.44, 0.05);
        inner.rotation.z = -s * 0.32;
        inner.rotation.x = -0.12;
        inner.rotation.y = s * 0.22;
        driverGroup.add(inner);
      }

      // 复古双圆弧飞行员风镜（皮革环 + 浅蓝透光镜片）
      for (const s of [-1, 1]) {
        const frameGeo = new THREE.TorusGeometry(0.12, 0.035, 6, 10);
        const frame = new THREE.Mesh(frameGeo, darkBrown);
        frame.position.set(s * 0.18, 0.24, 0.38);
        frame.rotation.y = s * 0.2;
        driverGroup.add(frame);

        const lensGeo = new THREE.CircleGeometry(0.11, 8);
        const lens = new THREE.Mesh(lensGeo, createEmissivePaper(0x82d2f5, 0x4aa3cc, 0.85));
        lens.position.set(s * 0.18, 0.24, 0.39);
        lens.rotation.y = s * 0.2;
        driverGroup.add(lens);
      }
      // 风镜皮带连接
      const strapGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 12, 1, true);
      const strap = new THREE.Mesh(strapGeo, darkBrown);
      strap.position.set(0, 0.24, 0);
      driverGroup.add(strap);
      break;
    }
    case 'rabbit': {
      // 纸兔·跃：优雅弧线弯曲长耳 + 粉嫩圆润腮红 + 萌系兔唇
      // 左耳（微后扬自然弯曲）
      const earLGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.95, 6);
      earLGeo.scale(0.6, 1, 0.3);
      const earL = new THREE.Mesh(earLGeo, paperWhite);
      earL.position.set(-0.22, 0.72, -0.08);
      earL.rotation.z = 0.16;
      earL.rotation.x = -0.25;
      driverGroup.add(earL);

      // 右耳（自然前倾可爱折角垂耳）
      const earRGeo1 = new THREE.CylinderGeometry(0.12, 0.16, 0.55, 6);
      earRGeo1.scale(0.6, 1, 0.3);
      const earR1 = new THREE.Mesh(earRGeo1, paperWhite);
      earR1.position.set(0.22, 0.58, -0.05);
      earR1.rotation.z = -0.22;
      driverGroup.add(earR1);

      const earRGeo2 = new THREE.ConeGeometry(0.14, 0.48, 5);
      earRGeo2.scale(0.6, 1, 0.3);
      const earR2 = new THREE.Mesh(earRGeo2, accent);
      earR2.position.set(0.38, 0.86, 0.06);
      earR2.rotation.z = -0.92;
      earR2.rotation.x = 0.32;
      driverGroup.add(earR2);

      // 粉圆腮红
      for (const s of [-1, 1]) {
        const blush = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), accent);
        blush.position.set(s * 0.28, -0.06, 0.36);
        blush.rotation.y = s * 0.45;
        driverGroup.add(blush);
      }
      break;
    }
    case 'bear': {
      // 憨熊·墩：圆润贝壳双耳 + 宽厚弧形口鼻 + 红色赛车头巾
      for (const s of [-1, 1]) {
        const earGeo = new THREE.TorusGeometry(0.15, 0.08, 6, 8, Math.PI);
        earGeo.rotateZ(s > 0 ? 0 : Math.PI);
        const ear = new THREE.Mesh(earGeo, primary);
        ear.position.set(s * 0.36, 0.36, -0.05);
        ear.rotation.y = s * 0.25;
        driverGroup.add(ear);
      }
      // 圆弧口鼻部
      const snoutGeo = new THREE.SphereGeometry(0.22, 8, 6);
      snoutGeo.scale(1.1, 0.85, 0.8);
      const snout = new THREE.Mesh(snoutGeo, accent);
      snout.position.set(0, -0.08, 0.38);
      driverGroup.add(snout);
      const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), darkBrown);
      noseTip.position.set(0, -0.02, 0.54);
      driverGroup.add(noseTip);

      // 动感赛车头巾
      const bandGeo = new THREE.CylinderGeometry(0.47, 0.47, 0.12, 12, 1, true);
      const band = new THREE.Mesh(bandGeo, accent);
      band.position.set(0, 0.18, 0);
      driverGroup.add(band);
      break;
    }
    case 'wing': {
      // 苍鹰/飞鹰：优雅向下弯曲的折纸流线鸟喙 + 头部三叠羽翎
      const beakGeo = new THREE.ConeGeometry(0.18, 0.48, 5);
      beakGeo.rotateX(Math.PI / 2 + 0.35);
      beakGeo.rotateZ(Math.PI);
      const beak = new THREE.Mesh(beakGeo, accent);
      beak.position.set(0, -0.06, 0.48);
      driverGroup.add(beak);

      // 后脑勺三叠弧形羽翎
      for (let i = 0; i < 3; i++) {
        const featherGeo = new THREE.ConeGeometry(0.32 - i * 0.05, 0.85, 4);
        featherGeo.scale(0.5, 1, 0.2);
        const feather = new THREE.Mesh(featherGeo, primary);
        feather.position.set(0, 0.38 - i * 0.14, -0.38 - i * 0.18);
        feather.rotation.x = -1.25 - i * 0.12;
        driverGroup.add(feather);
      }
      break;
    }
    case 'box': {
      // 智械魔盒：倒角复古太空机体 + 像素发光眼屏 + 弯曲柔光天线
      const eyeVisorGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.18, 8, 1, true, -Math.PI / 4, Math.PI / 2);
      const eyeVisor = new THREE.Mesh(eyeVisorGeo, createEmissivePaper(0x56e39f, 0x3ac481, 1.4));
      eyeVisor.position.set(0, 0.06, 0.05);
      driverGroup.add(eyeVisor);

      // 弧形天线
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.65, 6), darkBrown);
      antenna.position.set(0.24, 0.58, -0.08);
      antenna.rotation.z = -0.28;
      antenna.rotation.x = -0.15;
      driverGroup.add(antenna);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 6),
        createEmissivePaper(0xff4757, 0xff4757, 1.5)
      );
      tip.position.set(0.39, 0.90, -0.12);
      driverGroup.add(tip);
      break;
    }
  }

  // 5. 赛车方向盘与两只抱住方向盘的折纸圆润小爪子
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12), darkBrown);
  wheelHub.rotation.x = Math.PI / 3;
  wheelHub.position.set(0, -0.28, 0.52);
  steeringRig.add(wheelHub);

  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 6, 12), accent);
  wheelRim.rotation.x = Math.PI / 3;
  wheelRim.position.set(0, -0.28, 0.52);
  steeringRig.add(wheelRim);

  // 左右圆润折纸小手臂和小爪（自然前伸搭在方向盘上）
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

/** 组装高阶流线型有机折纸赛车 */
export function buildCar(racer: RacerSpec, paper: PaperSpec, ghost = false): CarVisual {
  const root = new THREE.Group();
  const tiltGroup = new THREE.Group();
  root.add(tiltGroup);

  const primary = ghost ? createTranslucentPaper(racer.primaryColor, 0.35) : createPaperMaterial(racer.primaryColor);
  const accent = ghost ? createTranslucentPaper(racer.accentColor, 0.35) : createPaperMaterial(racer.accentColor);
  const dark = ghost ? createTranslucentPaper(0x28201a, 0.35) : createPaperMaterial(0x28201a, undefined, 0.95);

  // 1. 流线型底盘与四轮弧形挡泥板
  const chassis = buildStreamlinedChassis(primary, accent, dark, ghost);
  chassis.position.y = 0.34;
  tiltGroup.add(chassis);

  // 2. 贴地阴影托盘
  const tray = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 18),
    new THREE.MeshBasicMaterial({
      color: 0x16120e,
      transparent: true,
      opacity: ghost ? 0.05 : 0.22,
      depthWrite: false,
    })
  );
  tray.rotation.x = -Math.PI / 2;
  tray.position.y = 0.02;
  tray.scale.set(0.72, 1.18, 1);
  root.add(tray);

  // 3. 前下扰流铲与前导流小翼（圆角流线收口）
  const splitterGeo = new THREE.CylinderGeometry(1.08, 1.15, 0.06, 10, 1, false, -Math.PI / 2, Math.PI);
  splitterGeo.rotateX(Math.PI / 2);
  const splitter = new THREE.Mesh(splitterGeo, dark);
  splitter.position.set(0, 0.36, 2.22);
  splitter.scale.set(1.0, 0.55, 1.0);
  splitter.castShadow = !ghost;
  tiltGroup.add(splitter);

  // 4. 双层弧面竞技大尾翼 (Curved Aerodynamic Wing + Swept Endplates)
  for (const s of [-1, 1]) {
    const postGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.72, 6);
    postGeo.rotateX(0.24);
    const post = new THREE.Mesh(postGeo, dark);
    post.position.set(s * 0.48, 1.18, -1.95);
    post.castShadow = !ghost;
    tiltGroup.add(post);
  }
  // 主翼片（带弧形切面与迎风角）
  const wingGeo = new THREE.CylinderGeometry(0.88, 0.88, 0.08, 10);
  wingGeo.scale(1.0, 0.5, 0.35);
  wingGeo.rotateZ(Math.PI / 2);
  wingGeo.rotateX(-0.16);
  const mainWing = new THREE.Mesh(wingGeo, accent);
  mainWing.position.set(0, 1.44, -2.08);
  mainWing.castShadow = !ghost;
  tiltGroup.add(mainWing);

  // 左右后掠流线端板 (Swept Endplates)
  for (const s of [-1, 1]) {
    const endplateGeo = new THREE.ConeGeometry(0.38, 0.76, 4);
    endplateGeo.scale(0.12, 1, 0.6);
    endplateGeo.rotateZ(Math.PI / 2);
    endplateGeo.rotateY(s * 0.1);
    const endplate = new THREE.Mesh(endplateGeo, primary);
    endplate.position.set(s * 0.92, 1.46, -2.12);
    endplate.castShadow = !ghost;
    tiltGroup.add(endplate);
  }

  // 5. 尾部双出圆筒排气管（斜切口 + 内部发光）
  for (const s of [-1, 1]) {
    const pipeGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.48, 8);
    pipeGeo.rotateX(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, dark);
    pipe.position.set(s * 0.32, 0.56, -2.28);
    pipe.castShadow = !ghost;
    tiltGroup.add(pipe);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.10, 8),
      createEmissivePaper(0xff6b4a, 0xff3814, 1.3)
    );
    glow.position.set(s * 0.32, 0.56, -2.53);
    tiltGroup.add(glow);
  }

  // 6. 四只 14 边圆润折纸车轮
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

  // 7. 有机圆润车手 + 方向盘连动小爪
  const { driverGroup, steeringRig } = buildOrganicDriver(racer, ghost);
  driverGroup.position.set(0, 1.54, -0.28);
  tiltGroup.add(driverGroup);
  steeringRig.position.set(0, 1.25, -0.28);
  tiltGroup.add(steeringRig);

  // 8. 迎风飘逸的弧面折纸小披风与行囊
  const capeGeo = new THREE.BufferGeometry();
  capeGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -0.34, 1.74, -0.62,   0, 1.78, -0.68,   0, 1.38, -1.24,
        -0.34, 1.74, -0.62,   0, 1.38, -1.24,  -0.44, 1.48, -1.14,
        0, 1.78, -0.68,       0.34, 1.74, -0.62, 0.44, 1.48, -1.14,
        0, 1.78, -0.68,       0.44, 1.48, -1.14, 0, 1.38, -1.24,
      ],
      3
    )
  );
  capeGeo.computeVertexNormals();
  const capeMat = ghost
    ? createTranslucentPaper(racer.accentColor, 0.35)
    : createPaperMaterial(racer.accentColor, undefined, 0.88);
  capeMat.side = THREE.DoubleSide;
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.castShadow = !ghost;
  tiltGroup.add(cape);

  // 圆润折纸小行囊
  const packGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.44, 8);
  packGeo.scale(1, 0.8, 0.6);
  const pack = new THREE.Mesh(packGeo, accent);
  pack.position.set(0, 1.52, -1.34);
  pack.castShadow = !ghost;
  tiltGroup.add(pack);

  // 9. 护盾视觉
  const shieldMesh = new THREE.Group();
  const shieldGeo = new THREE.IcosahedronGeometry(2.55, 1);
  const shieldSolid = new THREE.Mesh(
    shieldGeo,
    createTranslucentPaper(0xbfe3f2, 0.18, 0x9fd4ea, 0.35)
  );
  shieldMesh.add(shieldSolid);
  shieldMesh.position.y = 1.0;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  return { root, tiltGroup, wheels, frontWheels, shieldMesh };
}
