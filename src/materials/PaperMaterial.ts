import * as THREE from 'three';
import { getPaperFiberBump, getPaperRoughnessMap } from './PaperTextures';

/**
 * 哑光纸张 PBR 材质工厂 + 自动盒状 UV 补全 + 逆光透纸着色 + 柔和折痕露白。
 */

const SHARED_SUN_DIR = { value: new THREE.Vector3(26, 28, 18).normalize() };

/** 供 SceneManager 同步主方向光向量 */
export function setPaperSunDirection(dir: THREE.Vector3): void {
  SHARED_SUN_DIR.value.copy(dir).normalize();
}

/** 浅米白“折痕露白”细线：模拟厚卡纸折弯处微微泛白的纸纤维 */
const CREASE_HIGHLIGHT_MAT = new THREE.LineBasicMaterial({
  color: 0xfffaf0,
  transparent: true,
  opacity: 0.28,
});

/** 柔和暖棕折线（暗色或浅白纸面需要压线时可用） */
const SHARED_EDGE_MAT = new THREE.LineBasicMaterial({
  color: 0x5c4a3d,
  transparent: true,
  opacity: 0.22,
});

export const LIGHT_EDGE_MAT = new THREE.LineBasicMaterial({
  color: 0xfffcf2,
  transparent: true,
  opacity: 0.42,
});

export function getEdgeMaterial(): THREE.LineBasicMaterial {
  return SHARED_EDGE_MAT;
}

export function getLightEdgeMaterial(): THREE.LineBasicMaterial {
  return LIGHT_EDGE_MAT;
}

/**
 * 给缺少 UV 的自定义 BufferGeometry 自动生成盒状投影 UV，
 * 解决手工拼装折纸车壳 / 路肩时 bumpMap & roughnessMap 失效的问题。
 */
export function ensureBoxUV(geometry: THREE.BufferGeometry, uvScale = 0.45): THREE.BufferGeometry {
  if (geometry.attributes.uv) return geometry;
  const pos = geometry.attributes.position;
  if (!pos) return geometry;
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }
  const norm = geometry.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    if (ny >= nx && ny >= nz) {
      uvs[i * 2] = x * uvScale;
      uvs[i * 2 + 1] = z * uvScale;
    } else if (nx >= ny && nx >= nz) {
      uvs[i * 2] = z * uvScale;
      uvs[i * 2 + 1] = y * uvScale;
    } else {
      uvs[i * 2] = x * uvScale;
      uvs[i * 2 + 1] = y * uvScale;
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

/**
 * 注入纸张微弱“逆光透纸暖色”与“棉纸绒面掠射泛白”
 */
function enhancePaperShader(mat: THREE.MeshStandardMaterial, translucency = 0.2): THREE.MeshStandardMaterial {
  mat.customProgramCacheKey = () => `origami-paper-v1-${translucency.toFixed(2)}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPaperSunDir = SHARED_SUN_DIR;
    shader.uniforms.uPaperTranslucency = { value: translucency };

    shader.fragmentShader =
      `
uniform vec3 uPaperSunDir;
uniform float uPaperTranslucency;
` +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
vec3 paperViewDir = normalize(vViewPosition);
vec3 paperSunViewDir = normalize((viewMatrix * vec4(uPaperSunDir, 0.0)).xyz);

// 逆光透纸暖光
float paperBackLight = pow(clamp(dot(-paperSunViewDir, paperViewDir), 0.0, 1.0), 3.0);
gl_FragColor.rgb += diffuseColor.rgb * vec3(1.0, 0.88, 0.68) * paperBackLight * uPaperTranslucency;

// 掠射角棉纸微绒感
float paperRim = pow(1.0 - clamp(dot(normal, paperViewDir), 0.0, 1.0), 3.5);
gl_FragColor.rgb += vec3(0.98, 0.95, 0.89) * paperRim * 0.08;

#include <dithering_fragment>
`
      );
  };
  return mat;
}

export function createPaperMaterial(
  color: number,
  bumpMap: THREE.Texture = getPaperFiberBump(),
  roughness = 0.93
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    roughnessMap: getPaperRoughnessMap(),
    metalness: 0.0,
    flatShading: true,
    bumpMap,
    bumpScale: 0.062,
  });
  return enhancePaperShader(mat, 0.22);
}

/** 带颜色贴图（手账网格 / 牛皮纸 / 水彩插画等）的纸张材质 */
export function createTexturedPaperMaterial(
  map: THREE.Texture,
  color = 0xffffff,
  bumpMap: THREE.Texture = getPaperFiberBump(),
  roughness = 0.94
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    map,
    roughness,
    roughnessMap: getPaperRoughnessMap(),
    metalness: 0.0,
    flatShading: false,
    bumpMap,
    bumpScale: 0.045,
  });
  return enhancePaperShader(mat, 0.16);
}

/**
 * 厚卡纸剪纸双材质：[正背面手绘插画材质, 侧面米白卡纸切口材质]
 * 供 ExtrudeGeometry 立体书道具与纸片车手使用。
 */
export function createCutoutCardboardMaterials(
  frontMap: THREE.Texture,
  edgeColor = 0xf6f0e4
): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
  const frontMat = createTexturedPaperMaterial(frontMap, 0xffffff, getPaperFiberBump(), 0.92);
  frontMat.alphaTest = 0.1;
  const edgeMat = createPaperMaterial(edgeColor, getPaperFiberBump(), 0.96);
  return [frontMat, edgeMat];
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

export function attachOrigamiEdges(mesh: THREE.Mesh, thresholdAngle = 24, light = true): THREE.Mesh {
  ensureBoxUV(mesh.geometry);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // 避免重复挂载折痕线
  if (!mesh.userData.__origamiEdgesAdded) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
    const line = new THREE.LineSegments(edges, light ? CREASE_HIGHLIGHT_MAT : SHARED_EDGE_MAT);
    line.renderOrder = 1;
    mesh.add(line);
    mesh.userData.__origamiEdgesAdded = true;
  }
  return mesh;
}

/** 一步创建带纤维 UV 与柔和折痕露白的折纸网格 */
export function paperMesh(
  geometry: THREE.BufferGeometry,
  color: number,
  opts: { roughness?: number; edges?: boolean; threshold?: number; bump?: THREE.Texture; lightEdges?: boolean } = {}
): THREE.Mesh {
  ensureBoxUV(geometry);
  const mat = createPaperMaterial(color, opts.bump ?? getPaperFiberBump(), opts.roughness ?? 0.93);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (opts.edges !== false) {
    attachOrigamiEdges(mesh, opts.threshold ?? 24, opts.lightEdges ?? true);
  }
  return mesh;
}

/** 批量补全阴影与折痕 */
export function addEdgesToGroup(group: THREE.Object3D, threshold = 24): void {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      attachOrigamiEdges(m, threshold, true);
    }
  });
}

export function disposeEdgeMaterial(): void {
  CREASE_HIGHLIGHT_MAT.dispose();
  SHARED_EDGE_MAT.dispose();
  LIGHT_EDGE_MAT.dispose();
}
