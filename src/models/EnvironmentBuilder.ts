import * as THREE from 'three';
import type { TrackSpec } from '../types/game';
import { paperMesh, createPaperMaterial, createTexturedPaperMaterial } from '../materials/PaperMaterial';
import { getChecker, getGridPaper, getCorrugated, getWatercolor, getWood, getGroundBump } from '../materials/PaperTextures';

export interface EnvironmentResult {
  group: THREE.Group;
  clouds: THREE.Object3D[];
}

/** 远景折纸群山 + 飘浮折纸云朵 + 起跑拱门 */
export function buildEnvironment(
  spec: TrackSpec,
  center: THREE.Vector3,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  startPos: THREE.Vector3,
  startHeading: number
): EnvironmentResult {
  const group = new THREE.Group();
  const clouds: THREE.Object3D[] = [];
  const night = spec.theme === 'neon';

  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const baseR = Math.max(spanX, spanZ) * 0.5;

  // ---------- 群山（两圈） ----------
  const mountainColor = new THREE.Color(spec.colors.mountain);
  for (let ring = 0; ring < 2; ring++) {
    const radius = baseR + 70 + ring * 55;
    const count = 16 + ring * 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.3;
      const r = radius + (Math.random() - 0.5) * 30;
      const h = 26 + Math.random() * 46 + ring * 14;
      const rad = 16 + Math.random() * 20;
      const shade = mountainColor.clone().multiplyScalar(0.85 + Math.random() * 0.3);
      const m = paperMesh(new THREE.ConeGeometry(rad, h, 5), shade.getHex(), { threshold: 12 });
      m.position.set(center.x + Math.cos(a) * r, h / 2 - 2, center.z + Math.sin(a) * r);
      m.rotation.y = Math.random() * Math.PI;
      m.castShadow = false;
      m.receiveShadow = false;
      group.add(m);
      // 雪顶 / 亮顶
      if (Math.random() > 0.5) {
        const capColor = spec.theme === 'frost' ? 0xffffff : night ? 0x3a4a72 : 0xfaf3e3;
        const cap = paperMesh(new THREE.ConeGeometry(rad * 0.34, h * 0.3, 5), capColor, { edges: false });
        cap.position.set(m.position.x, h - h * 0.15 - 2, m.position.z);
        cap.rotation.y = m.rotation.y;
        cap.castShadow = false;
        group.add(cap);
      }
    }
  }

  // ---------- 飘浮折纸云 ----------
  const cloudColor = night ? 0x3a4a72 : 0xffffff;
  const cloudMat = createPaperMaterial(cloudColor, undefined, 0.95);
  cloudMat.emissive = new THREE.Color(night ? 0x1a2440 : 0xffffff);
  cloudMat.emissiveIntensity = night ? 0.25 : 0.22;
  cloudMat.flatShading = true;
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < puffs; k++) {
      const s = 2.6 + Math.random() * 2.6;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), cloudMat);
      puff.position.set((k - puffs / 2) * s * 0.85, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2);
      puff.scale.y = 0.5;
      puff.castShadow = false;
      cloud.add(puff);
    }
    const a = Math.random() * Math.PI * 2;
    const r = baseR * (0.5 + Math.random() * 0.9);
    cloud.position.set(center.x + Math.cos(a) * r, 50 + Math.random() * 24, center.z + Math.sin(a) * r);
    cloud.userData.driftSpeed = 0.4 + Math.random() * 0.6;
    cloud.userData.baseX = cloud.position.x;
    group.add(cloud);
    clouds.push(cloud);
  }

  // ---------- 起跑拱门 ----------
  const arch = new THREE.Group();
  const pillarColor = night ? 0x2b3752 : spec.colors.curbA;
  const pillarH = 9;
  const gap = spec.width * 0.5 + 2;
  for (const side of [-1, 1]) {
    const pillar = paperMesh(new THREE.BoxGeometry(1.4, pillarH, 1.4), pillarColor);
    pillar.position.set(side * gap, pillarH / 2, 0);
    arch.add(pillar);
    const foot = paperMesh(new THREE.BoxGeometry(2.2, 0.8, 2.2), spec.colors.curbB);
    foot.position.set(side * gap, 0.4, 0);
    arch.add(foot);
  }
  const banner = paperMesh(new THREE.BoxGeometry(gap * 2 + 1.4, 2.2, 0.6), night ? 0x1b2438 : 0xfaf3e3);
  banner.position.set(0, pillarH + 1.1, 0);
  arch.add(banner);
  const checker = getChecker();
  checker.repeat.set(10, 1);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(gap * 2 + 1.4, 0.8),
    new THREE.MeshStandardMaterial({ map: checker, roughness: 0.9 })
  );
  strip.position.set(0, pillarH + 1.1, 0.32);
  arch.add(strip);
  // 小旗
  for (let i = 0; i < 5; i++) {
    const flag = paperMesh(new THREE.ConeGeometry(0.5, 1.1, 3), i % 2 ? spec.colors.curbA : spec.colors.curbB, {
      edges: false,
    });
    flag.position.set(-gap + (i / 4) * gap * 2, pillarH + 2.6, 0);
    flag.rotation.x = Math.PI;
    arch.add(flag);
  }
  arch.position.set(startPos.x, 0, startPos.z);
  arch.rotation.y = startHeading;
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

/** 主题地面（手账网格 / 瓦楞 / 水彩 / 木纹） */
export function buildGround(spec: TrackSpec): THREE.Mesh {
  let tex: THREE.Texture;
  switch (spec.theme) {
    case 'meadow':
      tex = getGridPaper('#8eb87a', 'rgba(59,47,39,0.07)');
      break;
    case 'neon':
      tex = getCorrugated('#222c42');
      break;
    case 'frost':
      tex = getWatercolor('#a9d0e5');
      break;
    case 'desk':
      tex = getWood('#c79a6b');
      break;
  }
  tex.repeat.set(60, 60);
  const mat = createTexturedPaperMaterial(tex, 0xffffff, getGroundBump(), 0.95);
  mat.flatShading = false;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  return ground;
}