import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';
import type { TrackColors } from '../types/game';
import { makeTiltShiftPass, makeBloomPass, setTiltResolution, setTiltFocus } from './PostFX';
import { setPaperSunDirection } from '../materials/PaperMaterial';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const SHADOW_HALF_SIZE = 28; // [-28, 28]，相比 [-55, 55] 阴影清晰度提升约 4 倍
const SHADOW_MAP_SIZE = 2048;
const SHADOW_TEXEL_SIZE = (SHADOW_HALF_SIZE * 2) / SHADOW_MAP_SIZE;

/**
 * 渲染底座：ACESFilmic 色调映射、紧跟且纹素对齐的 2048 锐利软阴影、N8AO 折缝遮蔽。
 */
export class SceneManager {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  n8aoPass: N8AOPass;
  renderPass: RenderPass;
  outputPass: OutputPass;
  bloomPass: UnrealBloomPass;
  smaaPass: SMAAPass;
  tiltH: ShaderPass;
  tiltV: ShaderPass;

  dirLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;

  // 压低太阳仰角，让纸片树、风车和车身拉出更有立体书感的修长投影
  private shadowOffset = new THREE.Vector3(26, 28, 18);
  private snappedFocus = new THREE.Vector3();
  private highQuality = true;
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0; // 从 1.15 回调，保留纸面高光细节不发白
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xebe6d6);
    this.scene.fog = new THREE.Fog(0xebe6d6, 120, 480);

    // near 从 0.1 提到 0.5，显著降低路面多层薄片的远处 Z-fighting
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.5, 900);
    this.camera.position.set(0, 30, 60);

    // 主方向光：午后低角度暖金斜阳
    this.dirLight = new THREE.DirectionalLight(0xffebc7, 2.15);
    this.dirLight.position.copy(this.shadowOffset);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    this.dirLight.shadow.bias = -0.00025;
    this.dirLight.shadow.normalBias = 0.018;
    const sc = this.dirLight.shadow.camera;
    sc.near = 2;
    sc.far = 160;
    sc.left = -SHADOW_HALF_SIZE;
    sc.right = SHADOW_HALF_SIZE;
    sc.top = SHADOW_HALF_SIZE;
    sc.bottom = -SHADOW_HALF_SIZE;
    sc.updateProjectionMatrix();
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 同步主光方向给纸张逆光透射着色器
    setPaperSunDirection(this.shadowOffset);

    // 柔和轮廓光
    this.rimLight = new THREE.DirectionalLight(0xffe4be, 0.35);
    this.rimLight.position.set(-24, 28, -26);
    this.scene.add(this.rimLight);

    // 半球光：压低强度并拉出冷暖对比（暖白天空 + 淡灰蓝阴影面）
    this.hemiLight = new THREE.HemisphereLight(0xfff8ea, 0x93a8cc, 0.62);
    this.scene.add(this.hemiLight);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.0);
    this.scene.add(this.ambient);

    // 后处理管线：同步高分屏像素比，消除拉大发糊
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(dpr);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.renderPass.enabled = false;
    this.composer.addPass(this.renderPass);

    // 收紧 AO 半径并提高强度，N8AO 改为全分辨率（关掉 halfRes），消除暗部马赛克块
    this.n8aoPass = new N8AOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    this.n8aoPass.configuration.aoRadius = 0.65;
    this.n8aoPass.configuration.intensity = 1.55;
    this.n8aoPass.configuration.distanceFalloff = 1.0;
    this.n8aoPass.configuration.denoiseSamples = 8;
    this.n8aoPass.configuration.denoiseRadius = 8;
    this.n8aoPass.configuration.halfRes = false;
    this.n8aoPass.configuration.depthAwareUpsampling = false;
    this.n8aoPass.configuration.gammaCorrection = false;
    this.n8aoPass.setQualityMode('High');
    this.composer.addPass(this.n8aoPass);

    // 限制 Bloom 阈值，只让自发光道具/加速带泛光，不让白纸发糊
    this.bloomPass = makeBloomPass(window.innerWidth, window.innerHeight);
    this.bloomPass.threshold = 0.95;
    this.bloomPass.strength = 0.22;
    this.bloomPass.radius = 0.35;
    this.composer.addPass(this.bloomPass);

    this.tiltH = makeTiltShiftPass(true, false);
    this.tiltV = makeTiltShiftPass(false, true);
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);

    // 挂载电影级 SMAA 抗锯齿（在 OutputPass 之前以 Linear 线性色彩空间执行边缘平滑）
    this.smaaPass = new SMAAPass(window.innerWidth * dpr, window.innerHeight * dpr);
    this.composer.addPass(this.smaaPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.resize(window.innerWidth, window.innerHeight);
  }

  setTheme(colors: TrackColors, fogNear: number, fogFar: number, night: boolean): void {
    (this.scene.background as THREE.Color).setHex(colors.sky);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(colors.sky);
    fog.near = fogNear;
    fog.far = fogFar;

    if (night) {
      this.dirLight.color.setHex(0xbfd0ff);
      this.dirLight.intensity = 0.55;
      this.rimLight.color.setHex(0x5a709a);
      this.rimLight.intensity = 0.28;
      this.hemiLight.color.setHex(0x3a4a72);
      this.hemiLight.groundColor.setHex(0x141a2a);
      this.hemiLight.intensity = 0.48;
      this.ambient.color.setHex(0x2a3550);
      this.ambient.intensity = 0.45;
      this.bloomPass.threshold = 0.72;
      this.bloomPass.strength = 0.38;
    } else {
      this.dirLight.color.setHex(0xffebc7);
      this.dirLight.intensity = 2.15;
      this.rimLight.color.setHex(0xffe4be);
      this.rimLight.intensity = 0.35;
      this.hemiLight.color.setHex(0xfff8ea);
      this.hemiLight.groundColor.setHex(0x93a8cc);
      this.hemiLight.intensity = 0.62;
      this.ambient.intensity = 0.0;
      this.bloomPass.threshold = 0.95;
      this.bloomPass.strength = 0.22;
    }
  }

  setHighQuality(on: boolean): void {
    this.highQuality = on;
    this.n8aoPass.enabled = on;
    this.renderPass.enabled = !on;
    this.bloomPass.enabled = on;
    this.smaaPass.enabled = on;
  }

  setDofFocus(y: number): void {
    setTiltFocus([this.tiltH, this.tiltV], y);
  }

  setShadows(on: boolean): void {
    this.dirLight.castShadow = on;
  }

  setAOIntensity(v: number): void {
    this.n8aoPass.configuration.intensity = v;
  }

  /** 阴影相机跟随焦点，并按世界纹素网格对齐防止阴影边缘抖动 */
  updateShadowFocus(pos: THREE.Vector3): void {
    this.snappedFocus.set(
      Math.round(pos.x / SHADOW_TEXEL_SIZE) * SHADOW_TEXEL_SIZE,
      pos.y,
      Math.round(pos.z / SHADOW_TEXEL_SIZE) * SHADOW_TEXEL_SIZE
    );
    this.dirLight.target.position.copy(this.snappedFocus);
    this.dirLight.target.updateMatrixWorld();
    this.dirLight.position.copy(this.snappedFocus).add(this.shadowOffset);
  }

  resize(width: number, height: number): void {
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(this.width, this.height);
    this.smaaPass.setSize(this.width * dpr, this.height * dpr);
    setTiltResolution([this.tiltH, this.tiltV], this.width * dpr, this.height * dpr);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  render(dt: number): void {
    if (this.disposed) return;
    this.composer.render(dt);
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  dispose(): void {
    this.disposed = true;
    this.composer.dispose?.();
    this.n8aoPass.dispose?.();
    this.smaaPass.dispose?.();
    this.renderer.dispose();
  }
}
