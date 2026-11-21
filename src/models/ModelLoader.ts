import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createPaperMaterial,
  createTexturedPaperMaterial,
  ensureBoxUV,
} from '../materials/PaperMaterial';

const loader = new GLTFLoader();
const templateCache = new Map<string, Promise<THREE.Group | null>>();

export interface PaperGlbOptions {
  /** 目标最大边长（自动等比缩放，避免外部模型过大或过小） */
  targetSize?: number;
  /** 是否保留模型自带贴图；false 时统一用 tintColor 折纸纯色覆盖 */
  keepOriginalMap?: boolean;
  /** 统一染色（keepOriginalMap=false 或模型无贴图时生效） */
  tintColor?: number;
  /** 强制开启折纸切面感（flatShading） */
  flatShading?: boolean;
  /** 旋转修正（例如模型朝向不是 +Z 时设 Math.PI） */
  rotateY?: number;
}

/**
 * 加载 public/models/ 下的 .glb 模型（带缓存 + 404 静默降级）。
 * 返回独立克隆的 THREE.Group，未找到文件时返回 null。
 */
export async function loadPaperGLB(
  url: string,
  opts: PaperGlbOptions = {}
): Promise<THREE.Group | null> {
  let promise = templateCache.get(url);
  if (!promise) {
    promise = new Promise<THREE.Group | null>((resolve) => {
      loader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        () => resolve(null) // 文件尚未放入 public/models/ 时静默降级，不报错
      );
    });
    templateCache.set(url, promise);
  }

  const raw = await promise;
  if (!raw) return null;

  const model = raw.clone(true);
  const {
    targetSize = 3.6,
    keepOriginalMap = true,
    tintColor = 0xffffff,
    flatShading = true,
    rotateY = 0,
  } = opts;

  if (rotateY !== 0) {
    model.rotation.y = rotateY;
    model.updateMatrixWorld(true);
  }

  // 1. 自动归一化尺寸，并将模型底面中心精准对齐到原点 (0, 0, 0)
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxDim;
  model.scale.multiplyScalar(scale);

  // 重新计算缩放后包围盒，把底面贴齐 y = 0
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  model.position.x -= scaledCenter.x;
  model.position.z -= scaledCenter.z;
  model.position.y -= scaledBox.min.y;

  // 2. 统一替换为你的折纸 PBR 材质（保留原有贴图或按角色配色染色）
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    ensureBoxUV(mesh.geometry, 0.45);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const oldMat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (keepOriginalMap && oldMat?.map) {
      const mat = createTexturedPaperMaterial(oldMat.map, tintColor, undefined, 0.93);
      mat.flatShading = flatShading;
      mesh.material = mat;
    } else {
      const baseHex =
        tintColor !== 0xffffff
          ? tintColor
          : oldMat?.color
            ? oldMat.color.getHex()
            : 0xfaf3e3;
      const mat = createPaperMaterial(baseHex, undefined, 0.93);
      mat.flatShading = flatShading;
      mesh.material = mat;
    }
  });

  const wrapper = new THREE.Group();
  wrapper.add(model);
  return wrapper;
}
