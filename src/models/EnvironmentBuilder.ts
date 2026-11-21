import * as THREE from 'three';
import type { TrackSpec } from '../types/game';
import {
  paperMesh,
  createPaperMaterial,
  createTexturedPaperMaterial,
  createEmissivePaper,
  ensureBoxUV,
} from '../materials/PaperMaterial';
import { getChecker, getWatercolor, getWood, getGroundBump } from '../materials/PaperTextures';

export interface EnvironmentResult {
  group: THREE.Group;
  clouds: THREE.Object3D[];
}

/** 4 层环绕式剪纸波浪山峦（带纤维 UV 与顶部厚卡纸米白裁切轮廓） */
function buildLayeredWaveMountains(
  center: THREE.Vector3,
  baseR: number,
  mountainColor: THREE.Color,
  skyColor: THREE.Color,
  night: boolean
): THREE.Group {
  const mountainGroup = new THREE.Group();
  const layerConfigs = [
    { radiusOffset: 85, baseHeight: 8, freq: 4, amp: 3.0, colorLerp: 0.18, ring: 0 },
    { radiusOffset: 130, baseHeight: 13, freq: 5, amp: 4.5, colorLerp: 0.38, ring: 1 },
    { radiusOffset: 180, baseHeight: 19, freq: 3, amp: 6.0, colorLerp: 0.58, ring: 2 },
    { radiusOffset: 235, baseHeight: 26, freq: 2, amp: 8.0, colorLerp: 0.78, ring: 3 },
  ];

  const SEGMENTS = 96;
  const ridgeEdgeMat = new THREE.LineBasicMaterial({
    color: night ? 0x7b92c4 : 0xfffaf0,
    transparent: true,
    opacity: night ? 0.35 : 0.55,
  });

  for (const cfg of layerConfigs) {
    const r = baseR + cfg.radiusOffset;
    const layerColor = mountainColor.clone().lerp(skyColor, cfg.colorLerp);
    const mat = createPaperMaterial(layerColor.getHex(), undefined, 0.95);
    mat.side = THREE.DoubleSide;

    const positions: number[] = [];
    const ridgePoints: THREE.Vector3[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const wave =
        Math.sin(a * cfg.freq + cfg.ring * 1.2) * cfg.amp +
        Math.cos(a * (cfg.freq * 2) + cfg.ring * 0.8) * (cfg.amp * 0.35);
      const h = Math.max(4, cfg.baseHeight + wave);
      const x = center.x + cosA * r;
      const z = center.z + sinA * r;

      positions.push(x, 0, z);
      positions.push(x, h, z);
      ridgePoints.push(new THREE.Vector3(x, h + 0.08, z));

      if (i < SEGMENTS) {
        const v = i * 2;
        indices.push(v, v + 1, v + 2);
        indices.push(v + 1, v + 3, v + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    ensureBoxUV(geo, 0.08);

    const layerMesh = new THREE.Mesh(geo, mat);
    layerMesh.castShadow = cfg.ring < 2 && !night;
    layerMesh.receiveShadow = cfg.ring > 0;
    mountainGroup.add(layerMesh);

    // 顶部剪纸裁切米白亮边，强化立体纸雕灯箱的层次感
    const ridgeGeo = new THREE.BufferGeometry().setFromPoints(ridgePoints);
    const ridgeLine = new THREE.Line(ridgeGeo, ridgeEdgeMat);
    mountainGroup.add(ridgeLine);
  }

  return mountainGroup;
}

/** 吊线剪纸白云 + 折纸热气球 + 盘旋纸飞机 */
function buildPaperSkyStage(
  center: THREE.Vector3,
  baseR: number,
  night: boolean
): { skyGroup: THREE.Group; animItems: THREE.Object3D[] } {
  const skyGroup = new THREE.Group();
  const animItems: THREE.Object3D[] = [];

  const cloudColor = night ? 0x3f507a : 0xfffdf7;
  const cloudMat = createPaperMaterial(cloudColor, undefined, 0.95);
  cloudMat.emissive = new THREE.Color(night ? 0x1b2745 : 0xfff8eb);
  cloudMat.emissiveIntensity = night ? 0.25 : 0.14;

  const stringMat = new THREE.LineBasicMaterial({
    color: night ? 0x6f82ad : 0xd2c7b4,
    transparent: true,
    opacity: 0.42,
  });

  // 1. 吊线剪纸厚卡纸白云（14 朵）
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const lobes: [number, number, number][] = [
      [-4.6, -0.5, 2.9],
      [-1.8, 0.9, 3.8],
      [1.9, 0.6, 3.4],
      [4.7, -0.6, 2.6],
    ];

    for (const [lx, ly, rad] of lobes) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.42, 12), cloudMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(lx, ly, (Math.random() - 0.5) * 0.28);
      cloud.add(disc);
    }

    // 顶部向上垂吊的极细微缩舞台棉线
    const threadGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 3.8, 0),
      new THREE.Vector3(0, 36, 0),
    ]);
    cloud.add(new THREE.Line(threadGeo, stringMat));

    const a = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const r = baseR * (1.15 + Math.random() * 1.15);
    const x = center.x + Math.cos(a) * r;
    const y = 26 + Math.random() * 14;
    const z = center.z + Math.sin(a) * r;

    cloud.position.set(x, y, z);
    cloud.lookAt(center.x, y, center.z);
    cloud.userData = {
      kind: 'cloud',
      driftSpeed: 0.4 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      baseX: x,
      baseY: y,
    };

    skyGroup.add(cloud);
    animItems.push(cloud);
  }

  // 2. 漂浮折纸热气球（4 只）
  const balloonPalettes = [
    [0xe05a47, 0xfdf6e3],
    [0x4b8ab0, 0xf4d35e],
    [0x8eb87a, 0xfff8eb],
    [0xf4a6b8, 0xf4d35e],
  ];

  for (let i = 0; i < 4; i++) {
    const balloon = new THREE.Group();
    const [cA, cB] = balloonPalettes[i % balloonPalettes.length];

    // 折纸气球主体（上下拼色八棱球）
    const topDome = paperMesh(new THREE.IcosahedronGeometry(3.8, 1), cA, { threshold: 22 });
    topDome.scale.set(1, 1.18, 1);
    topDome.position.y = 3.2;
    balloon.add(topDome);

    const band = paperMesh(new THREE.CylinderGeometry(3.55, 2.35, 2.2, 8), cB, { threshold: 22 });
    band.position.y = 0.7;
    balloon.add(band);

    // 暖光火焰心（夜场也会温柔发亮）
    const flame = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.65, 0),
      createEmissivePaper(0xffd166, 0xff9f1c, night ? 1.8 : 0.9)
    );
    flame.position.y = -0.8;
    balloon.add(flame);

    // 牛皮纸吊篮 + 四根细绳
    const basket = paperMesh(new THREE.BoxGeometry(1.5, 1.15, 1.5), 0xb88b5a, { threshold: 20 });
    basket.position.y = -2.4;
    balloon.add(basket);

    for (const sx of [-0.65, 0.65]) {
      for (const sz of [-0.65, 0.65]) {
        const ropeGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(sx, -1.85, sz),
          new THREE.Vector3(sx * 1.4, -0.3, sz * 1.4),
        ]);
        balloon.add(new THREE.Line(ropeGeo, stringMat));
      }
    }

    const a = (i / 4) * Math.PI * 2 + 0.55;
    const r = baseR * (0.95 + (i % 2) * 0.45);
    const y = 30 + i * 4.5;
    balloon.position.set(center.x + Math.cos(a) * r, y, center.z + Math.sin(a) * r);
    balloon.userData = {
      kind: 'balloon',
      phase: i * 1.6,
      baseY: y,
    };

    skyGroup.add(balloon);
    animItems.push(balloon);
  }

  // 3. 盘旋折纸小飞机（3 架）
  const planeColors = [0xfffdf8, 0xf4d35e, 0x9fd4ea];
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Group();
    const planeGeo = new THREE.BufferGeometry();

    // 经典尖头折纸飞机三角翼 + 底部龙骨
    const verts = [
      // 左翼
      0, 0, 2.4,
      -1.8, 0.15, -1.6,
      0, 0.05, -1.2,
      // 右翼
      0, 0, 2.4,
      0, 0.05, -1.2,
      1.8, 0.15, -1.6,
      // 底部折纸龙骨
      0, 0, 2.4,
      0, -0.55, -1.3,
      0, 0.05, -1.2,
    ];
    planeGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    planeGeo.computeVertexNormals();

    const planeMat = createPaperMaterial(planeColors[i % planeColors.length], undefined, 0.9);
    planeMat.side = THREE.DoubleSide;
    ensureBoxUV(planeGeo, 0.5);

    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    plane.add(planeMesh);

    const orbitR = baseR * (0.68 + i * 0.24);
    const y = 21 + i * 5.5;

    plane.userData = {
      kind: 'plane',
      centerX: center.x,
      centerZ: center.z,
      orbitR,
      baseY: y,
      speed: (i % 2 === 0 ? 1 : -1) * (0.14 + i * 0.03),
      phase: (i * Math.PI * 2) / 3,
    };

    skyGroup.add(plane);
    animItems.push(plane);
  }

  return { skyGroup, animItems };
}

/** 起跑绘本纸门（双面棋盘格 + 弧形彩色三角旗串 + 暖光纸灯笼） */
function buildStartingArch(
  spec: TrackSpec,
  startPos: THREE.Vector3,
  startHeading: number,
  night: boolean
): THREE.Group {
  const arch = new THREE.Group();
  const pillarColor = night ? 0x2b3752 : spec.colors.curbA;
  const pillarH = 9.5;
  const gap = spec.width * 0.5 + 2.2;

  for (const side of [-1, 1]) {
    const pillar = paperMesh(new THREE.CylinderGeometry(0.7, 0.8, pillarH, 8), pillarColor);
    pillar.position.set(side * gap, pillarH / 2, 0);
    arch.add(pillar);

    // 柱身牛皮纸腰箍装饰
    const wrap = paperMesh(new THREE.CylinderGeometry(0.84, 0.84, 1.0, 8), 0xfaf3e3);
    wrap.position.set(side * gap, pillarH * 0.52, 0);
    arch.add(wrap);

    const foot = paperMesh(new THREE.CylinderGeometry(1.25, 1.45, 0.85, 8), spec.colors.curbB);
    foot.position.set(side * gap, 0.42, 0);
    arch.add(foot);

    // 门柱内侧悬吊暖光折纸小灯笼
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.85, 8),
      createEmissivePaper(0xffd166, 0xffa933, night ? 1.8 : 0.85)
    );
    lantern.position.set(side * (gap - 1.15), pillarH - 0.65, 0);
    arch.add(lantern);
  }

  const banner = paperMesh(new THREE.BoxGeometry(gap * 2 + 1.8, 2.2, 0.48), night ? 0x1b2438 : 0xfdfaf2);
  banner.position.set(0, pillarH + 1.1, 0);
  arch.add(banner);

  // 正反双面棋盘格贴条
  const checker = getChecker();
  checker.repeat.set(10, 1);
  const stripMat = new THREE.MeshStandardMaterial({ map: checker, roughness: 0.9 });

  for (const zSign of [1, -1]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(gap * 2 + 1.7, 0.82), stripMat);
    strip.position.set(0, pillarH + 1.1, zSign * 0.25);
    if (zSign < 0) strip.rotation.y = Math.PI;
    arch.add(strip);
  }

  // 门洞下方弧形垂挂小彩旗串
  const pennantColors = [spec.colors.curbA, 0xf4d35e, spec.colors.curbB, 0x8eb87a];
  const count = 9;
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const x = -gap + 1.2 + u * (gap * 2 - 2.4);
    const sag = Math.sin(u * Math.PI) * 1.05;
    const flag = paperMesh(
      new THREE.ConeGeometry(0.42, 0.95, 3),
      pennantColors[i % pennantColors.length],
      { edges: false }
    );
    flag.position.set(x, pillarH - 0.15 - sag, 0.12);
    flag.rotation.x = Math.PI;
    arch.add(flag);
  }

  // 门顶小三角纸旗
  for (let i = 0; i < 5; i++) {
    const flag = paperMesh(
      new THREE.ConeGeometry(0.5, 1.1, 3),
      i % 2 ? spec.colors.curbA : spec.colors.curbB,
      { edges: false }
    );
    flag.position.set(-gap + (i / 4) * gap * 2, pillarH + 2.6, 0);
    flag.rotation.x = Math.PI;
    arch.add(flag);
  }

  arch.position.set(startPos.x, startPos.y, startPos.z);
  arch.rotation.y = startHeading;
  return arch;
}

/** 远景多层剪纸山峦 + 奇幻纸艺天空 + 终点拱门 */
export function buildEnvironment(
  spec: TrackSpec,
  center: THREE.Vector3,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  startPos: THREE.Vector3,
  startHeading: number
): EnvironmentResult {
  const group = new THREE.Group();
  const night = spec.theme === 'neon';

  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const baseR = Math.max(spanX, spanZ) * 0.5;

  // 渐变天空穹顶（打破单调纯色背景）
  const skyGeo = new THREE.SphereGeometry(520, 24, 16);
  const posAttr = skyGeo.attributes.position;
  const skyCols = new Float32Array(posAttr.count * 3);
  const cTop = new THREE.Color(night ? 0x161f3b : 0x5eb8f2);
  const cMid = new THREE.Color(spec.colors.sky);
  const cBot = new THREE.Color(night ? 0x2e3c62 : 0xfff8eb);
  const tmpC = new THREE.Color();
  for (let i = 0; i < posAttr.count; i++) {
    const yn = THREE.MathUtils.clamp(posAttr.getY(i) / 520, 0, 1);
    if (yn < 0.22) tmpC.copy(cBot).lerp(cMid, yn / 0.22);
    else tmpC.copy(cMid).lerp(cTop, Math.pow((yn - 0.22) / 0.78, 0.7));
    skyCols[i * 3] = tmpC.r;
    skyCols[i * 3 + 1] = tmpC.g;
    skyCols[i * 3 + 2] = tmpC.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCols, 3));
  const skyDome = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  skyDome.position.set(center.x, 0, center.z);
  group.add(skyDome);

  const mountains = buildLayeredWaveMountains(
    center,
    baseR,
    new THREE.Color(spec.colors.mountain),
    new THREE.Color(spec.colors.sky),
    night
  );
  group.add(mountains);

  const { skyGroup, animItems } = buildPaperSkyStage(center, baseR, night);
  group.add(skyGroup);

  const arch = buildStartingArch(spec, startPos, startHeading, night);
  group.add(arch);

  return { group, clouds: animItems };
}

/** 驱动吊线云朵、热气球与盘旋纸飞机动画 */
export function updateClouds(clouds: THREE.Object3D[], time: number): void {
  for (const c of clouds) {
    const kind = c.userData.kind as string | undefined;

    if (kind === 'balloon') {
      const phase = c.userData.phase as number;
      c.position.y = (c.userData.baseY as number) + Math.sin(time * 0.65 + phase) * 2.2;
      c.rotation.y = time * 0.16 + phase;
    } else if (kind === 'plane') {
      const angle = time * (c.userData.speed as number) + (c.userData.phase as number);
      const r = c.userData.orbitR as number;
      const cx = c.userData.centerX as number;
      const cz = c.userData.centerZ as number;
      c.position.set(
        cx + Math.cos(angle) * r,
        (c.userData.baseY as number) + Math.sin(time * 1.4 + angle) * 1.2,
        cz + Math.sin(angle) * r
      );
      const dir = (c.userData.speed as number) >= 0 ? 1 : -1;
      c.rotation.y = -angle + (dir > 0 ? 0 : Math.PI);
      c.rotation.z = dir * 0.24;
    } else {
      const sp = (c.userData.driftSpeed as number) ?? 0.5;
      const phase = (c.userData.phase as number) ?? 0;
      c.position.x = (c.userData.baseX as number) + Math.sin(time * 0.08 * sp + phase) * 10;
      c.position.y = (c.userData.baseY as number) + Math.sin(time * 0.55 + phase) * 0.75;
      c.rotation.z = Math.sin(time * 0.45 + phase) * 0.035;
    }
  }
}

/** 桌面立体书沙盘底座：深色暖胡桃木桌面 + 翻开的厚卡纸立体书书页 + 中央书脊折痕 */
export function buildGround(spec: TrackSpec): THREE.Mesh {
  const base = '#' + spec.colors.ground.toString(16).padStart(6, '0');
  const pageTex = getWatercolor(base);
  pageTex.repeat.set(12, 12);
  const pageMat = createTexturedPaperMaterial(pageTex, 0xffffff, getGroundBump(), 0.94);
  pageMat.flatShading = false;

  const groundPage = new THREE.Mesh(new THREE.PlaneGeometry(680, 680), pageMat);
  groundPage.rotation.x = -Math.PI / 2;
  groundPage.position.y = 0;
  groundPage.receiveShadow = true;

  // 书脊柔和暗影折痕（强化“翻开的绘本桌面”世界观）
  const spineGeo = new THREE.PlaneGeometry(14, 680);
  const spineMat = new THREE.MeshBasicMaterial({
    color: 0x3b2d22,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.set(0, 0, 0.02);
  groundPage.add(spine);

  const bookEdgeGeo = new THREE.BoxGeometry(692, 692, 1.8);
  const bookEdgeMat = createPaperMaterial(0x283244, undefined, 0.95);
  const bookCover = new THREE.Mesh(bookEdgeGeo, bookEdgeMat);
  bookCover.position.set(0, 0, -1.0);
  groundPage.add(bookCover);

  const pageEdgeGeo = new THREE.BoxGeometry(684, 684, 1.2);
  const pageEdgeMat = createPaperMaterial(0xfcf8ee, undefined, 0.9);
  const pageEdge = new THREE.Mesh(pageEdgeGeo, pageEdgeMat);
  pageEdge.position.set(0, 0, -0.65);
  groundPage.add(pageEdge);

  const deskTex = getWood('#382417');
  deskTex.repeat.set(16, 16);
  const deskMat = createTexturedPaperMaterial(deskTex, 0xffffff, getGroundBump(), 0.78);
  const deskPlane = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), deskMat);
  deskPlane.position.set(0, 0, -2.2);
  deskPlane.receiveShadow = true;
  groundPage.add(deskPlane);

  return groundPage;
}
