import * as THREE from 'three';
import { getPaperFiberBump } from './PaperTextures';

/**
 * 哑光纸张 PBR 材质工厂 + EdgesGeometry 折痕描边工厂。
 * 所有折纸模型共享同一描边材质，统一折痕线稿观感。
 */

const SHARED_EDGE_MAT = new THREE.LineBasicMaterial({
  color: 0x3b2f27,
  transparent: true,
  opacity: 0.42,
});

export function getEdgeMaterial(): THREE.LineBasicMaterial {
  return SHARED_EDGE_MAT;
}

export function createPaperMaterial(
  color: number,
  bumpMap: THREE.Texture = getPaperFiberBump(),
  roughness = 0.9
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.0,
    flatShading: true,
    bumpMap,
    bumpScale: 0.055,
  });
}

/** 带颜色贴图（手账网格 / 牛皮纸等）的纸张材质 */
export function createTexturedPaperMaterial(
  map: THREE.Texture,
  color = 0xffffff,
  bumpMap: THREE.Texture = getPaperFiberBump(),
  roughness = 0.92
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughness,
    metalness: 0.0,
    flatShading: false,
    bumpMap,
    bumpScale: 0.04,
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

export function attachOrigamiEdges(mesh: THREE.Mesh, thresholdAngle = 22): THREE.Mesh {
  const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
  const line = new THREE.LineSegments(edges, SHARED_EDGE_MAT);
  line.renderOrder = 1;
  mesh.add(line);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 一步创建带折痕描边的纸张网格 */
export function paperMesh(
  geometry: THREE.BufferGeometry,
  color: number,
  opts: { roughness?: number; edges?: boolean; threshold?: number; bump?: THREE.Texture } = {}
): THREE.Mesh {
  const mat = createPaperMaterial(color, opts.bump ?? getPaperFiberBump(), opts.roughness ?? 0.9);
  const mesh = new THREE.Mesh(geometry, mat);
  if (opts.edges !== false) attachOrigamiEdges(mesh, opts.threshold ?? 22);
  else {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return mesh;
}

/** 为 group 内所有 mesh 批量补描边（用于导入/组合模型） */
export function addEdgesToGroup(group: THREE.Object3D, threshold = 22): void {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry && !m.userData.noEdges) {
      // 避免重复添加
      const hasEdges = m.children.some((c) => (c as THREE.LineSegments).isLineSegments);
      if (!hasEdges) attachOrigamiEdges(m, threshold);
    }
  });
}

export function disposeEdgeMaterial(): void {
  SHARED_EDGE_MAT.dispose();
}