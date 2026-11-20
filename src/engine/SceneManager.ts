import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { N8AOPass } from 'n8ao';
import type { TrackColors } from '../types/game';
import { makeTiltShiftPass, makeBloomPass, setTiltResolution, setTiltFocus } from './PostFX';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * 渲染底座：ACESFilmic 色调映射、2048 软阴影、N8AO 后处理。
 * 主方向光阴影相机跟随玩家车辆移动。
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
  tiltH: ShaderPass;
  tiltV: ShaderPass;

  dirLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;

  private shadowOffset = new THREE.Vector3(34, 56, 22);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbeee4);
    this.scene.fog = new THREE.Fog(0xdbeee4, 90, 320);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
    this.camera.position.set(0, 30, 60);

    // 主方向光（暖色）
    this.dirLight = new THREE.DirectionalLight(0xfff3dc, 0.85);
    this.dirLight.position.copy(this.shadowOffset);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    const sc = this.dirLight.shadow.camera;
    sc.near = 1;
    sc.far = 220;
    sc.left = -52;
    sc.right = 52;
    sc.top = 52;
    sc.bottom = -52;
    sc.updateProjectionMatrix();
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 半球光（天空 / 地面反弹）
    this.hemiLight = new THREE.HemisphereLight(0xfffaf0, 0xa89984, 0.62);
    this.scene.add(this.hemiLight);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.0);
    this.scene.add(this.ambient);

    // 后处理管线
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.renderPass.enabled = false; // N8AO 自带 beauty 渲染
    this.composer.addPass(this.renderPass);

    this.n8aoPass = new N8AOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    this.n8aoPass.configuration.aoRadius = 1.6;
    this.n8aoPass.configuration.intensity = 2.5;
    this.n8aoPass.configuration.distanceFalloff = 1.0;
    this.n8aoPass.configuration.denoiseSamples = 8;
    this.n8aoPass.configuration.denoiseRadius = 10;
    this.n8aoPass.configuration.halfRes = true;
    this.n8aoPass.configuration.depthAwareUpsampling = true;
    // OutputPass 已做 sRGB/色调映射，N8AO 内部不再二次 gamma，避免画面发白
    this.n8aoPass.configuration.gammaCorrection = false;
    this.n8aoPass.setQualityMode('Medium');
    this.composer.addPass(this.n8aoPass);

    // 微缩质感：泛光 + 移轴景深 + 暖调调色
    this.bloomPass = makeBloomPass(window.innerWidth, window.innerHeight);
    this.composer.addPass(this.bloomPass);
    this.tiltH = makeTiltShiftPass(true, false);
    this.tiltV = makeTiltShiftPass(false, true);
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);

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
      this.dirLight.intensity = 0.42;
      this.hemiLight.color.setHex(0x3a4a72);
      this.hemiLight.groundColor.setHex(0x141a2a);
      this.hemiLight.intensity = 0.5;
      this.ambient.color.setHex(0x2a3550);
      this.ambient.intensity = 0.55;
    } else {
      this.dirLight.color.setHex(0xfff3dc);
      this.dirLight.intensity = 0.85;
      this.hemiLight.color.setHex(0xfffaf0);
      this.hemiLight.groundColor.setHex(0xa89984);
      this.hemiLight.intensity = 0.62;
      this.ambient.intensity = 0.0;
    }
  }

  setHighQuality(on: boolean): void {
    this.highQuality = on;
    this.n8aoPass.enabled = on;
    this.renderPass.enabled = !on;
    this.bloomPass.enabled = on;
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

  /** 阴影相机跟随焦点（玩家车辆 / 展台） */
  updateShadowFocus(pos: THREE.Vector3): void {
    this.dirLight.target.position.copy(pos);
    this.dirLight.target.updateMatrixWorld();
    this.dirLight.position.copy(pos).add(this.shadowOffset);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setSize(this.width, this.height);
    this.n8aoPass.setSize(this.width, this.height);
    this.bloomPass.setSize(this.width, this.height);
    setTiltResolution([this.tiltH, this.tiltV], this.width, this.height);
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
    this.renderer.dispose();
  }
}