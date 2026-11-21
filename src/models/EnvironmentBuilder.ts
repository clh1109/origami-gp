import * as THREE from 'three';
import type { TrackSpec } from '../types/game';
import { paperMesh, createPaperMaterial, createTexturedPaperMaterial } from '../materials/PaperMaterial';
import { getChecker, getWatercolor, getWood, getGroundBump } from '../materials/PaperTextures';

export interface EnvironmentResult {
  group: THREE.Group;
  clouds: THREE.Object3D[];
}

/** 4 层环绕式剪纸波浪山峦（多层弧形卡纸，层与层之间有阴影透视） */
function buildLayeredWaveMountains(
  center: THREE.Vector3,
  baseR: number,
  mountainColor: THREE.Color,
  skyColor: THREE.Color,
  night: boolean
): THREE.Group {
  const mountainGroup = new THREE.Group();

  // 4 层环形剪纸山（由近至远，高度递增，颜色向天际虚化）
  const layerConfigs = [
    { radiusOffset: 70,  baseHeight: 16, freq: 3.5, amp: 5.5,  colorLerp: 0.05, ring: 0 },
    { radiusOffset: 110, baseHeight: 26, freq: 4.5, amp: 8.5,  colorLerp: 0.22, ring: 1 },
    { radiusOffset: 155, baseHeight: 40, freq: 3.0, amp: 12.0, colorLerp: 0.42, ring: 2 },
    { radiusOffset: 205, baseHeight: 56, freq: 2.2, amp: 16.0, colorLerp: 0.65, ring: 3 },
  ];

  const SEGMENTS = 96;

  for (const cfg of layerConfigs) {
    const r = baseR + cfg.radiusOffset;
    const layerColor = mountainColor.clone().lerp(skyColor, cfg.colorLerp);
    const mat = createPaperMaterial(layerColor.getHex(), undefined, 0.95);
    mat.side = THREE.DoubleSide;

    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);

      // 柔和起伏的剪纸波浪轮廓（大波浪 + 小波浪叠合）
      const wave =
        Math.sin(a * cfg.freq + cfg.ring * 1.2) * cfg.amp +
        Math.cos(a * (cfg.freq * 2.2) + cfg.ring * 0.8) * (cfg.amp * 0.35);
      const h = Math.max(4, cfg.baseHeight + wave);

      const x = center.x + cosA * r;
      const z = center.z + sinA * r;

      // 底部贴地点 (y=0) 与 顶部剪纸波浪点 (y=h)
      positions.push(x, 0, z);
      positions.push(x, h, z);

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

    const layerMesh = new THREE.Mesh(geo, mat);
    layerMesh.castShadow = cfg.ring < 2 && !night;
    layerMesh.receiveShadow = cfg.ring > 0;
    mountainGroup.add(layerMesh);
  }

  return mountainGroup;
}

/** 飘浮棉纸折纸云朵（蓬松柔软棉纸团） */
function buildCottonPaperClouds(
  center: THREE.Vector3,
  baseR: number,
  night: boolean
): { cloudGroup: THREE.Group; clouds: THREE.Object3D[] } {
  const cloudGroup = new THREE.Group();
  const clouds: THREE.Object3D[] = [];

  const cloudColor = night ? 0x3a4a72 : 0xffffff;
  const cloudMat = createPaperMaterial(cloudColor, undefined, 0.95);
  cloudMat.emissive = new THREE.Color(night ? 0x1a2440 : 0xfff9ee);
  cloudMat.emissiveIntensity = night ? 0.25 : 0.18;
  cloudMat.flatShading = true;

  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(Math.random() * 3);
    for (let k = 0; k < puffs; k++) {
      const s = 4.2 + Math.random() * 2.6;
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), cloudMat);
      puff.position.set((k - puffs / 2) * s * 0.78, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2.2);
      puff.scale.y = 0.55;
      puff.castShadow = false;
      cloud.add(puff);
    }
    const a = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const r = baseR * (1.2 + Math.random() * 1.35);
    cloud.position.set(center.x + Math.cos(a) * r, 24 + Math.random() * 14, center.z + Math.sin(a) * r);
    cloud.userData.driftSpeed = 0.35 + Math.random() * 0.5;
    cloud.userData.baseX = cloud.position.x;
    cloudGroup.add(cloud);
    clouds.push(cloud);
  }

  return { cloudGroup, clouds };
}

/** 起跑绘本纸门 */
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
    const foot = paperMesh(new THREE.CylinderGeometry(1.2, 1.4, 0.8, 8), spec.colors.curbB);
    foot.position.set(side * gap, 0.4, 0);
    arch.add(foot);
  }

  const banner = paperMesh(new THREE.BoxGeometry(gap * 2 + 1.8, 2.2, 0.45), night ? 0x1b2438 : 0xfdfaf2);
  banner.position.set(0, pillarH + 1.1, 0);
  arch.add(banner);

  const checker = getChecker();
  checker.repeat.set(10, 1);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(gap * 2 + 1.8, 0.8),
    new THREE.MeshStandardMaterial({ map: checker, roughness: 0.9 })
  );
  strip.position.set(0, pillarH + 1.1, 0.24);
  arch.add(strip);

  // 门顶小三角纸旗
  for (let i = 0; i < 5; i++) {
    const flag = paperMesh(new THREE.ConeGeometry(0.5, 1.1, 3), i % 2 ? spec.colors.curbA : spec.colors.curbB, {
      edges: false,
    });
    flag.position.set(-gap + (i / 4) * gap * 2, pillarH + 2.6, 0);
    flag.rotation.x = Math.PI;
    arch.add(flag);
  }

  arch.position.set(startPos.x, startPos.y, startPos.z);
  arch.rotation.y = startHeading;
  return arch;
}

/** 远景多层剪纸山峦 + 棉纸浮云 + 终点拱门 */
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

  // 1. 四层剪纸波浪山峦
  const mountains = buildLayeredWaveMountains(
    center,
    baseR,
    new THREE.Color(spec.colors.mountain),
    new THREE.Color(spec.colors.sky),
    night
  );
  group.add(mountains);

  // 2. 飘浮棉纸折纸云
  const { cloudGroup, clouds } = buildCottonPaperClouds(center, baseR, night);
  group.add(cloudGroup);

  // 3. 起跑门
  const arch = buildStartingArch(spec, startPos, startHeading, night);
  group.add(arch);

  return { group, clouds };
}

/** 云朵缓慢飘移 */
export function updateClouds(clouds: THREE.Object3D[], time: number): void {
  for (const c of clouds) {
    const sp = c.userData.driftSpeed as number;
    c.position.x = (c.userData.baseX as number) + Math.sin(time * 0.05 * sp) * 12;
    c.position.y += Math.sin(time * 0.3 + sp) * 0.002;
  }
}

/** 桌面立体书沙盘底座：深色暖胡桃木桌面 + 翻开的厚卡纸立体书书页 */
export function buildGround(spec: TrackSpec): THREE.Mesh {
  const base = '#' + spec.colors.ground.toString(16).padStart(6, '0');

  // 1. 书页地表（水彩厚卡纸，消除生硬的工程坐标方格网）
  const pageTex = getWatercolor(base);
  pageTex.repeat.set(12, 12);
  const pageMat = createTexturedPaperMaterial(pageTex, 0xffffff, getGroundBump(), 0.94);
  pageMat.flatShading = false;

  // 主书页平面（size 680 x 680）
  const groundPage = new THREE.Mesh(new THREE.PlaneGeometry(680, 680), pageMat);
  groundPage.rotation.x = -Math.PI / 2;
  groundPage.position.y = 0;
  groundPage.receiveShadow = true;

  // 2. 立体书精装厚硬纸板边缘（切面呈现层层压实书页与藏青书皮）
  const bookEdgeGeo = new THREE.BoxGeometry(692, 692, 1.8);
  const bookEdgeMat = createPaperMaterial(0x283244, undefined, 0.95);
  const bookCover = new THREE.Mesh(bookEdgeGeo, bookEdgeMat);
  bookCover.position.set(0, 0, -1.0); // local Z 轴向下（实际世界的 -y）
  groundPage.add(bookCover);

  // 书页切口金边/米白白边（Book Gilt Edges）
  const pageEdgeGeo = new THREE.BoxGeometry(684, 684, 1.2);
  const pageEdgeMat = createPaperMaterial(0xfcf8ee, undefined, 0.9);
  const pageEdge = new THREE.Mesh(pageEdgeGeo, pageEdgeMat);
  pageEdge.position.set(0, 0, -0.65);
  groundPage.add(pageEdge);

  // 3. 深色暖胡桃木书桌底面（Tabletop Surface，铺垫在立体书周围，营造微缩桌面感）
  const deskTex = getWood('#382417');
  deskTex.repeat.set(16, 16);
  const deskMat = createTexturedPaperMaterial(deskTex, 0xffffff, getGroundBump(), 0.78);
  const deskPlane = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), deskMat);
  deskPlane.position.set(0, 0, -2.2); // 处于立体书下方
  deskPlane.receiveShadow = true;
  groundPage.add(deskPlane);

  return groundPage;
}
