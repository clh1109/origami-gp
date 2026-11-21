import * as THREE from 'three';
import { getPaperFiberBump, getPaperRoughnessMap } from './PaperTextures';

/**
 * 哑光纸张 PBR 材质工厂 + EdgesGeometry 折痕描边工厂。
 * 所有折纸模型共享统一折痕线稿观感。
 */

const SHARED_EDGE_MAT = new THREE.LineBasicMaterial({
  color: 0x2e241e,
  transparent: true,
  opacity: 0.46,
});

/** 浅暖白折痕线：供轮胎 / 深色底盘等暗部纸件使用，暗面上也能看清折边 */
export const LIGHT_EDGE_MAT = new THREE.LineBasicMaterial({
  color: 0xfffcf2,
  transparent: true,
  opacity: 0.52,
});

export function getEdgeMaterial(): THREE.LineBasicMaterial {
  return SHARED_EDGE_MAT;
}

export function getLightEdgeMaterial(): THREE.LineBasicMaterial {
  return LIGHT_EDGE_MAT;
}

export function createPaperMaterial(
  color: number,
  bumpMap: THREE.Texture = getPaperFiberBump(),
  roughness = 0.92
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    roughnessMap: getPaperRoughnessMap(),
    metalness: 0.0,
    flatShading: true,
    bumpMap,
    bumpScale: 0.048,
  });
}

/** 带颜色贴图（手账网格 / 牛皮纸等）的纸张材质 */
export function createTexturedPaperMaterial(
  map: THREE.Texture,
  color = 0xffffff,
  bumpMap: THREE.Texture = getPaperFiberBump(),
  roughness = 0.94
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughness,
    roughnessMap: getPaperRoughnessMap(),
    metalness: 0.0,
    flatShading: false,
    bumpMap,
    bumpScale: 0.038,
  });
}

/** 自发光纸（灯笼、加速带、霓虹） */
export function createEmissivePaper(
  color: number,
  emissive: number,
  emissiveIntensity = 1.0,
  roughness = 0.85
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness,
    metalness: 0.0,
    flatShading: true,
    bumpMap: getPaperFiberBump(),
    bumpScale: 0.04,
  });
}

/** 半透明纸（冰晶、护盾、幽灵车） */
export function createTranslucentPaper(
  color: number,
  opacity = 0.55,
  emissive = 0x000000,
  emissiveIntensity = 0.0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.4,
    metalness: 0.0,
    flatShading: true,
    emissive,
    emissiveIntensity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function attachOrigamiEdges(mesh: THREE.Mesh, _thresholdAngle = 22, _light = false): THREE.Mesh {
  // 彻底移除人工 LineSegments 线框叠加，回归纯净的 Flat Shading 真实折纸明暗切面
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 一步创建纯净多面折纸网格（无生硬人工线框） */
export function paperMesh(
  geometry: THREE.BufferGeometry,
  color: number,
  opts: { roughness?: number; edges?: boolean; threshold?: number; bump?: THREE.Texture; lightEdges?: boolean } = {}
): THREE.Mesh {
  const mat = createPaperMaterial(color, opts.bump ?? getPaperFiberBump(), opts.roughness ?? 0.9);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 批量设置网格阴影投射与接收 */
export function addEdgesToGroup(group: THREE.Object3D, _threshold = 22): void {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

export function disposeEdgeMaterial(): void {
  SHARED_EDGE_MAT.dispose();
  LIGHT_EDGE_MAT.dispose();
}