import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { CameraRig } from './CameraRig';
import { AudioEngine } from './AudioEngine';
import { ParticleSystem } from '../gameplay/ParticleSystem';
import { buildTrack, type TrackBuildResult, type TrackQueryResult } from '../tracks/TrackBuilder';
import { buildEnvironment, buildGround, updateClouds, type EnvironmentResult } from '../models/EnvironmentBuilder';
import { updatePopupProps, popAllInstant } from '../models/PopupPropBuilder';
import { buildCar } from '../models/CarBuilder';
import { BookIntroCinematic } from '../models/BookIntroCinematic';
import { stepCarPhysics, resolveCarCollisions, computeOffroad } from '../gameplay/PhysicsSystem';
import { computeAIInput } from '../gameplay/AIController';
import { GhostRecorder, GhostPlayer, loadBestGhost, saveBestGhost } from '../gameplay/GhostRecorder';
import { getTrack } from '../data/tracks';
import { getRacer, RACERS } from '../data/racers';
import { getPaper } from '../data/papers';
import type {
  CarRuntimeState, GameMode, GamePhase, PlayerInput, Settings, HudSnapshot,
  RacerResult, MinimapData, ItemType, TrapEntity, BoomerangEntity, LobbyStep,
} from '../types/game';

export interface RaceConfig {
  mode: GameMode;
  paperId: string;
  racerId: string;
  trackId: string;
}

export interface EngineEvents {
  onHud?: (h: HudSnapshot) => void;
  onPhase?: (p: GamePhase) => void;
  onResults?: (r: RacerResult[]) => void;
  onBookIntroDone?: () => void;
}

const ITEM_POOL: ItemType[] = ['shield', 'boost', 'trap', 'boomerang'];

export class GameEngine {
  sm: SceneManager;
  rig: CameraRig;
  audio: AudioEngine;
  particles: ParticleSystem;
  events: EngineEvents = {};

  phase: GamePhase = 'lobby';
  mode: GameMode = 'grandprix';
  lobbyStep: LobbyStep = 1;
  config: RaceConfig = { mode: 'grandprix', paperId: 'medium', racerId: 'fox', trackId: 'meadow' };
  settings: Settings = {
    shadows: true, highQuality: true, touch: true, volume: 0.7, muted: false,
    cameraShake: true, showGhost: true,
  };

  track: TrackBuildResult | null = null;
  private env: EnvironmentResult | null = null;
  private ground: THREE.Mesh | null = null;
  private worldTrackId = '';

  cars: CarRuntimeState[] = [];
  player: CarRuntimeState | null = null;
  private ghostCar: CarRuntimeState | null = null;
  private recorder = new GhostRecorder();
  private ghostPlayer = new GhostPlayer();

  private traps: TrapEntity[] = [];
  private boomerangs: BoomerangEntity[] = [];

  private pedestal: THREE.Group | null = null;
  private showcaseCar: CarRuntimeState | null = null;
  private bookIntro: BookIntroCinematic | null = null;
  hasPlayedIntro = false;

  private time = 0;
  private raceTime = 0;
  private countdown = 3;
  private lastCountInt = 4;
  private hudTimer = 0;
  private resultsSent = false;

  private keys = new Set<string>();
  private touch = { throttle: 0, steer: 0, drift: false };
  private itemRequested = false;
  autopilot = false;

  private raf = 0;
  private last = 0;
  private disposed = false;
  private tmpV = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.sm = new SceneManager(canvas);
    this.rig = new CameraRig(this.sm.camera);
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem(this.sm.scene);
    this.bindInput();
    window.addEventListener('resize', this.onResize);
  }

  // ================= 输入 =================
  private bindInput(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }
  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k)) e.preventDefault();
    this.keys.add(k);
    if (k === 'e' || k === 'f' || k === 'enter') this.itemRequested = true;
    this.audio.ensure();
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };
  setTouch(t: { throttle?: number; steer?: number; drift?: boolean }): void {
    if (t.throttle !== undefined) this.touch.throttle = t.throttle;
    if (t.steer !== undefined) this.touch.steer = t.steer;
    if (t.drift !== undefined) this.touch.drift = t.drift;
  }
  requestItem(): void {
    this.itemRequested = true;
    this.audio.ensure();
  }
  private readInput(): PlayerInput {
    const k = this.keys;
    let throttle = (k.has('arrowup') || k.has('w') ? 1 : 0) + (k.has('arrowdown') || k.has('s') ? -1 : 0);
    let steer = (k.has('arrowleft') || k.has('a') ? 1 : 0) + (k.has('arrowright') || k.has('d') ? -1 : 0);
    throttle = THREE.MathUtils.clamp(throttle + this.touch.throttle, -1, 1);
    steer = THREE.MathUtils.clamp(steer + this.touch.steer, -1, 1);
    const drift = k.has('shift') || k.has(' ') || this.touch.drift;
    return { throttle, steer, drift };
  }

  private onResize = (): void => {
    this.sm.resize(window.innerWidth, window.innerHeight);
  };

  // ================= 设置 =================
  applySettings(s: Settings): void {
    this.settings = s;
    this.sm.setShadows(s.shadows);
    this.sm.setHighQuality(s.highQuality);
    this.audio.setVolume(s.volume);
    this.audio.setMuted(s.muted);
  }

  // ================= 世界构建 =================
  private buildWorld(trackId: string): void {
    if (this.worldTrackId === trackId && this.track) return;
    this.clearWorld();
    const spec = getTrack(trackId);
    this.sm.setTheme(spec.colors, spec.fogNear, spec.fogFar, spec.theme === 'neon');
    this.ground = buildGround(spec);
    this.sm.scene.add(this.ground);
    this.track = buildTrack(spec);
    this.sm.scene.add(this.track.group);
    const sp = this.track.startPositions[0];
    this.env = buildEnvironment(spec, this.track.center, this.track.bounds, sp.pos, sp.heading);
    this.sm.scene.add(this.env.group);
    this.worldTrackId = trackId;
  }

  private clearWorld(): void {
    if (this.ground) {
      this.sm.scene.remove(this.ground);
      this.ground.geometry.dispose();
      this.ground = null;
    }
    if (this.track) {
      this.sm.scene.remove(this.track.group);
      this.track = null;
    }
    if (this.env) {
      this.sm.scene.remove(this.env.group);
      this.env = null;
    }
    this.worldTrackId = '';
  }

  private clearCars(): void {
    for (const c of this.cars) this.sm.scene.remove(c.root);
    this.cars = [];
    this.player = null;
    this.ghostCar = null;
    if (this.showcaseCar) {
      this.sm.scene.remove(this.showcaseCar.root);
      this.showcaseCar = null;
    }
    if (this.pedestal) {
      this.sm.scene.remove(this.pedestal);
      this.pedestal = null;
    }
    for (const t of this.traps) this.sm.scene.remove(t.mesh);
    this.traps = [];
    for (const b of this.boomerangs) this.sm.scene.remove(b.mesh);
    this.boomerangs = [];
    this.particles.clear();
  }

  private makeCar(
    racerId: string, paperId: string, isPlayer: boolean, isGhost: boolean,
    pos: THREE.Vector3, heading: number, aiSkill = 0.7, aiOffset = 0
  ): CarRuntimeState {
    const racer = getRacer(racerId);
    const paper = getPaper(paperId);
    const visual = buildCar(racer, paper, isGhost);
    visual.root.position.copy(pos);
    visual.root.rotation.y = heading;
    this.sm.scene.add(visual.root);
    const q = this.track ? this.track.query(pos) : { t: 0 };
    return {
      id: isGhost ? 'ghost' : isPlayer ? 'player' : `ai-${racerId}-${Math.random().toString(36).slice(2, 6)}`,
      isPlayer, isGhost, racer, paper,
      root: visual.root, tiltGroup: visual.tiltGroup, wheels: visual.wheels,
      frontWheels: visual.frontWheels, shieldMesh: visual.shieldMesh,
      pos: pos.clone(), heading, speed: 0, roll: 0, pitch: 0,
      driftDir: 0, driftCharge: 0, boostTimer: 0, shieldTimer: 0, slowTimer: 0, spinTimer: 0,
      lap: 1, lastT: q.t, nearestT: q.t, progress: q.t, finished: false, finishTime: 0,
      offroad: false, heldItem: null, rouletteTimer: 0, wheelSpin: 0, steerVisual: 0,
      aiSkill, aiOffset, aiTargetOffset: aiOffset, aiItemCooldown: 1 + Math.random() * 2, aiDriftTimer: 0,
      lapStart: 0, bestLap: 0, lapTimes: [], place: 1,
    };
  }

  // ================= 贴地 =================
  /** 坡道高度平滑插值 + 路面切线俯仰（越野时回落到草地 y=0） */
  private groundFollow(car: CarRuntimeState, q: TrackQueryResult, dt: number): void {
    const targetY = car.offroad ? 0 : q.point.y;
    car.pos.y += (targetY - car.pos.y) * Math.min(1, 10 * dt);
    car.root.position.y = car.pos.y;
    const tg = q.tangent;
    const horiz = Math.hypot(tg.x, tg.z);
    const fwdDot = Math.sin(car.heading) * tg.x + Math.cos(car.heading) * tg.z;
    const targetPitch = car.offroad || horiz < 1e-4 ? 0 : -Math.atan2(tg.y, horiz) * Math.sign(fwdDot || 1);
    const prev = (car.root.userData.slopePitch as number) ?? 0;
    const next = prev + (targetPitch - prev) * Math.min(1, 8 * dt);
    car.root.userData.slopePitch = next;
    car.tiltGroup.rotation.x = car.pitch + next;
  }

  // ================= 大厅 =================
  enterLobby(config: RaceConfig, step: LobbyStep): void {
    this.config = config;
    this.mode = config.mode;
    this.phase = 'lobby';
    this.lobbyStep = step;
    this.clearCars();
    this.buildWorld(config.trackId);
    // 展示台 + 展示车
    const center = this.track ? this.track.center : new THREE.Vector3();
    this.pedestal = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0xfaf3e3, roughness: 0.9, flatShading: true })
    );
    base.position.y = 0.35;
    base.castShadow = true;
    base.receiveShadow = true;
    this.pedestal.add(base);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.3, 0.12, 6, 24),
      new THREE.MeshStandardMaterial({ color: 0xe05a47, roughness: 0.8, flatShading: true })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.72;
    this.pedestal.add(ring);
    this.pedestal.position.set(center.x, 0, center.z);
    this.sm.scene.add(this.pedestal);
    this.showcaseCar = this.makeCar(config.racerId, config.paperId, false, false, new THREE.Vector3(center.x, 0.7, center.z), 0);

    if (!this.hasPlayedIntro && this.track) {
      this.hasPlayedIntro = true;
      this.startBookIntro();
    } else if (this.track) {
      popAllInstant(this.track.props);
    }
    this.rig.reset();
    this.rig.setMode(step === 3 ? 'showcase' : 'lobby');
    this.audio.stopEngine();
    this.audio.stopDrift();
    this.events.onPhase?.('lobby');
    this.pushHud(true);
  }

  startBookIntro(onDone?: () => void): void {
    if (!this.track) return;
    if (this.bookIntro && !this.bookIntro.isFinished) return;
    this.bookIntro?.dispose();
    this.bookIntro = new BookIntroCinematic({
      scene: this.sm.scene,
      camera: this.sm.camera,
      center: this.track.center,
      trackGroup: this.track.group,
      props: this.track.props,
      pedestal: this.pedestal,
      showcaseCar: this.showcaseCar?.root ?? null,
      onComplete: () => {
        this.bookIntro = null;
        this.rig.reset();
        onDone?.();
        this.events.onBookIntroDone?.();
      },
    });
  }

  skipBookIntro(): void {
    this.bookIntro?.finish();
  }

  get isIntroPlaying(): boolean {
    return !!(this.bookIntro && !this.bookIntro.isFinished);
  }

  setLobbyStep(step: LobbyStep): void {
    this.lobbyStep = step;
    this.rig.setMode(step === 3 ? 'showcase' : 'lobby');
  }

  setLobbyCar(racerId: string, paperId: string): void {
    this.config.racerId = racerId;
    this.config.paperId = paperId;
    if (!this.track) return;
    if (this.showcaseCar) this.sm.scene.remove(this.showcaseCar.root);
    const center = this.track.center;
    this.showcaseCar = this.makeCar(racerId, paperId, false, false, new THREE.Vector3(center.x, 0.7, center.z), 0);
  }

  // ================= 比赛 =================
  startRace(config: RaceConfig): void {
    this.bookIntro?.finish();
    this.config = config;
    this.mode = config.mode;
    this.clearCars();
    this.buildWorld(config.trackId);
    if (!this.track) return;
    const track = this.track;
    this.raceTime = 0;
    this.countdown = 3;
    this.lastCountInt = 4;
    this.resultsSent = false;
    this.recorder.start();

    if (config.mode === 'timetrial') {
      const sp = track.startPositions[0];
      this.player = this.makeCar(config.racerId, config.paperId, true, false, sp.pos, sp.heading);
      this.cars.push(this.player);
      const best = this.settings.showGhost ? loadBestGhost(config.trackId) : null;
      this.ghostPlayer.load(best);
      if (best) {
        this.ghostCar = this.makeCar(best.racerId, best.paperId, false, true, sp.pos, sp.heading);
        this.cars.push(this.ghostCar);
      }
    } else {
      // 玩家 + 7 AI
      const playerRacer = config.racerId;
      const others = RACERS.filter((r) => r.id !== playerRacer);
      const grid = track.startPositions;
      this.player = this.makeCar(playerRacer, config.paperId, true, false, grid[0].pos, grid[0].heading);
      this.cars.push(this.player);
      for (let i = 0; i < 7; i++) {
        const r = others[i % others.length];
        const g = grid[i + 1];
        const skill = 0.55 + Math.random() * 0.4;
        const offset = (Math.random() - 0.5) * track.width * 0.4;
        this.cars.push(this.makeCar(r.id, config.paperId, false, false, g.pos, g.heading, skill, offset));
      }
    }
    // 发车格对齐：立即贴合坡道高度与俯仰
    for (const car of this.cars) {
      if (car.isGhost) continue;
      this.groundFollow(car, track.query(car.pos), 1);
    }
    // 排序发车格：玩家第 1 位
    this.phase = 'countdown';
    this.rig.setMode('race');
    this.rig.snapToRace(this.player.pos, this.player.heading);
    this.audio.ensure();
    this.audio.startEngine();
    this.events.onPhase?.('countdown');
    this.pushHud(true);
  }

  restart(): void {
    this.startRace(this.config);
  }

  toLobby(): void {
    this.enterLobby(this.config, this.lobbyStep);
  }

  // ================= 道具 =================
  private randomItem(): ItemType {
    return ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
  }

  private useItem(car: CarRuntimeState): void {
    if (!car.heldItem) return;
    const item = car.heldItem;
    car.heldItem = null;
    switch (item) {
      case 'shield':
        car.shieldTimer = 5;
        this.audio.playShield();
        this.particles.emitSparkle(car.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x9fd4ea, 10);
        break;
      case 'boost':
        car.boostTimer = Math.max(car.boostTimer, 2.4);
        this.audio.playBoost();
        if (car.isPlayer && this.settings.cameraShake) this.rig.addShake(0.25);
        break;
      case 'trap': {
        const back = new THREE.Vector3(-Math.sin(car.heading), 0, -Math.cos(car.heading));
        const pos = car.pos.clone().addScaledVector(back, 3.2);
        const tq = this.track ? this.track.query(pos) : null;
        pos.y = tq ? tq.point.y : 0;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.12, 3),
          new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.6, transparent: true, opacity: 0.9, emissive: 0xffd166, emissiveIntensity: 0.2 })
        );
        mesh.position.set(pos.x, pos.y + 0.14, pos.z);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.y = car.heading;
        if (tq) {
          const tg = tq.tangent;
          const fwdDot = Math.sin(car.heading) * tg.x + Math.cos(car.heading) * tg.z;
          mesh.rotation.x = -Math.atan2(tg.y, Math.hypot(tg.x, tg.z)) * Math.sign(fwdDot || 1);
        }
        this.sm.scene.add(mesh);
        this.traps.push({ mesh, pos, owner: car.id, life: 9, armed: 0.8 });
        this.audio.playTrap();
        break;
      }
      case 'boomerang': {
        const dir = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
        const pos = car.pos.clone().addScaledVector(dir, 2.5).add(new THREE.Vector3(0, 1, 0));
        const mesh = new THREE.Mesh(
          new THREE.ConeGeometry(0.7, 1.6, 3),
          new THREE.MeshStandardMaterial({ color: 0xe05a47, roughness: 0.7, flatShading: true, emissive: 0xe05a47, emissiveIntensity: 0.3 })
        );
        mesh.position.copy(pos);
        this.sm.scene.add(mesh);
        this.boomerangs.push({ mesh, pos, dir, owner: car.id, life: 2.2, speed: 52 });
        this.audio.playBoomerang();
        break;
      }
    }
    if (car.isPlayer) this.pushHud(true);
  }

  // ================= 主循环 =================
  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private update(dt: number): void {
    this.time += dt;
    this.sm.setDofFocus(this.phase === 'lobby' ? 0.5 : 0.62);
    if (this.phase === 'lobby') this.updateLobby(dt);
    else if (this.phase === 'countdown') this.updateCountdown(dt);
    else if (this.phase === 'racing') this.updateRacing(dt);
    else if (this.phase === 'finished') this.updateFinished(dt);

    if (this.env) updateClouds(this.env.clouds, this.time);
    if (this.track) {
      // 加速带箭头向前滚动
      const boostTex = this.track.group.userData.boostTex as THREE.Texture | undefined;
      if (boostTex) boostTex.offset.y = (this.time * 1.2) % 1;
      for (const b of this.track.itemBoxes) {
        if (!b.active) continue;
        b.mesh.rotation.y += dt * 1.2;
        b.mesh.position.y = (b.mesh.userData.baseY as number) + Math.sin(this.time * 2.2 + b.t * 20) * 0.16;
      }
    }
    this.particles.update(dt);
    this.sm.render(dt);
  }

  private updateLobby(dt: number): void {
    if (!this.track) return;
    const center = this.track.center;
    if (this.bookIntro && !this.bookIntro.isFinished) {
      this.bookIntro.update(dt);
      this.sm.updateShadowFocus(center);
      return;
    }
    if (this.showcaseCar) {
      this.showcaseCar.root.rotation.y += dt * 0.6;
      this.showcaseCar.wheelSpin += dt * 2;
      for (const w of this.showcaseCar.wheels) w.rotation.x = this.showcaseCar.wheelSpin;
    }
    if (this.lobbyStep === 3) {
      this.rig.updateShowcase(dt, this.tmpV.set(center.x, 0.7, center.z));
      this.sm.updateShadowFocus(this.tmpV.set(center.x, 0.7, center.z));
    } else {
      // 收紧半径与高度：展示圆台稳定落在左侧手账面板右边的视觉黄金区
      this.rig.updateLobby(dt, center, 17, 8.5, this.time, 3.6);
      this.sm.updateShadowFocus(center);
    }
    updatePopupProps(this.track.props, this.tmpV.set(center.x, 0, center.z), dt);
  }

  private updateCountdown(dt: number): void {
    if (!this.player) return;
    this.countdown -= dt;
    const ci = Math.ceil(this.countdown);
    if (ci !== this.lastCountInt && ci >= 0) {
      this.lastCountInt = ci;
      this.audio.playCountdown(ci === 0);
    }
    this.rig.updateRace(dt, this.player.pos, this.player.heading, 0, 40, false);
    this.sm.updateShadowFocus(this.player.pos);
    if (this.track) updatePopupProps(this.track.props, this.player.pos, dt, () => this.audio.playRustle());
    if (this.countdown <= 0) {
      this.phase = 'racing';
      this.events.onPhase?.('racing');
    }
    this.pushHud(true);
  }

  private updateRacing(dt: number): void {
    if (!this.track || !this.player) return;
    const track = this.track;
    this.raceTime += dt;
    const playerInput = this.readInput();

    // 道具请求
    if (this.itemRequested) {
      this.itemRequested = false;
      if (this.player.heldItem && this.player.rouletteTimer <= 0) this.useItem(this.player);
    }

    for (const car of this.cars) {
      if (car.isGhost) continue;
      let input: PlayerInput;
      if (car.isPlayer) {
        if (this.autopilot) {
          const ai = computeAIInput(car, track, this.cars, dt);
          input = ai.input;
          if (ai.useItem && car.rouletteTimer <= 0) this.useItem(car);
        } else input = playerInput;
      } else {
        const ai = computeAIInput(car, track, this.cars, dt);
        input = ai.input;
        if (ai.useItem && car.rouletteTimer <= 0) this.useItem(car);
      }
      // 越野判定
      const q = track.query(car.pos);
      car.offroad = computeOffroad(car, q.dist, track.width / 2);
      stepCarPhysics(car, input, dt);
      this.groundFollow(car, q, dt);

      // 圈数 / 进度
      const t = q.t;
      if (car.lastT > 0.8 && t < 0.2) {
        car.lap++;
        const lapTime = this.raceTime - car.lapStart;
        car.lapTimes.push(lapTime);
        car.bestLap = car.bestLap === 0 ? lapTime : Math.min(car.bestLap, lapTime);
        car.lapStart = this.raceTime;
        if (car.isPlayer) this.audio.playLap();
        const totalLaps = getTrack(this.config.trackId).laps;
        if (car.lap > totalLaps && !car.finished) {
          car.finished = true;
          car.finishTime = this.raceTime;
        }
      } else if (car.lastT < 0.2 && t > 0.8) {
        car.lap = Math.max(1, car.lap - 1);
      }
      car.lastT = t;
      car.nearestT = t;
      car.progress = car.lap - 1 + t;

      // 道具轮盘
      if (car.rouletteTimer > 0) {
        car.rouletteTimer -= dt;
        if (car.rouletteTimer <= 0) {
          car.heldItem = this.randomItem();
          if (car.isPlayer) {
            this.audio.playPickup();
            this.pushHud(true);
          }
        }
      }

      // 道具箱拾取
      if (!car.heldItem && car.rouletteTimer <= 0) {
        for (const box of track.itemBoxes) {
          if (!box.active) continue;
          if (car.pos.distanceTo(box.pos) < 2.2) {
            box.active = false;
            box.respawn = 3;
            box.mesh.visible = false;
            car.rouletteTimer = 0.9;
            this.particles.emitSparkle(box.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd166, 8);
            if (car.isPlayer) this.pushHud(true);
            break;
          }
        }
      }

      // 加速带
      for (const pad of track.boostPads) {
        if (car.pos.distanceTo(pad.pos) < 3.2 && car.boostTimer < 0.5) {
          car.boostTimer = Math.max(car.boostTimer, 1.1);
          if (car.isPlayer) {
            this.audio.playBoost();
            if (this.settings.cameraShake) this.rig.addShake(0.18);
          }
        }
      }

      // 粒子
      if (car.driftDir !== 0 && Math.abs(car.speed) > 12) {
        const tier: 0 | 1 | 2 = car.driftCharge >= 1.6 ? 2 : car.driftCharge >= 0.8 ? 1 : 0;
        this.particles.emitDrift(car.pos, car.heading, tier, car.isPlayer ? 3 : 1);
      }
      if (car.boostTimer > 0) this.particles.emitBoost(car.pos, car.heading, car.isPlayer ? 3 : 1);
    }

    // 碰撞
    const collisions = resolveCarCollisions(this.cars);
    for (const c of collisions) {
      this.particles.emitCollision(c.point, c.strength);
      if ((c.a.isPlayer || c.b.isPlayer) && c.strength > 0.3) {
        this.audio.playCollision();
        if (this.settings.cameraShake) this.rig.addShake(0.2 * c.strength);
      }
    }

    this.updateTraps(dt);
    this.updateBoomerangs(dt);
    this.respawnBoxes(dt);

    // 幽灵
    if (this.mode === 'timetrial') {
      this.recorder.record(this.raceTime, this.player, dt);
      if (this.ghostCar) this.ghostPlayer.update(this.raceTime, this.ghostCar);
    }

    // 排名
    this.updatePlaces();

    // 相机 / 阴影 / 音效
    const maxSpeed = (36 + this.player.racer.stats.speed * 0.18) * this.player.paper.speedMul;
    this.rig.updateRace(dt, this.player.pos, this.player.heading, this.player.speed, maxSpeed, this.player.boostTimer > 0);
    this.sm.updateShadowFocus(this.player.pos);
    this.audio.updateEngine(Math.abs(this.player.speed) / maxSpeed, this.player.boostTimer > 0, this.player.offroad);
    if (this.player.driftDir !== 0) {
      this.audio.startDrift();
      this.audio.updateDrift(Math.min(1, this.player.driftCharge / 1.6));
    } else this.audio.stopDrift();
    updatePopupProps(track.props, this.player.pos, dt, () => this.audio.playRustle());

    // 完赛
    if (this.player.finished && !this.resultsSent) {
      this.resultsSent = true;
      this.finishRace();
    }

    this.hudTimer += dt;
    if (this.hudTimer > 0.08) {
      this.hudTimer = 0;
      this.pushHud(false);
    }
  }

  private updateTraps(dt: number): void {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      t.life -= dt;
      t.armed -= dt;
      t.mesh.rotation.y += dt * 0.5;
      let removed = false;
      if (t.armed <= 0) {
        for (const car of this.cars) {
          if (car.isGhost || car.id === t.owner || car.shieldTimer > 0) continue;
          if (car.pos.distanceTo(t.pos) < 2.2) {
            car.slowTimer = Math.max(car.slowTimer, 2);
            this.particles.emitSparkle(t.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xffd166, 10);
            if (car.isPlayer) this.audio.playTrap();
            removed = true;
            break;
          }
        }
      }
      if (removed || t.life <= 0) {
        this.sm.scene.remove(t.mesh);
        this.traps.splice(i, 1);
      }
    }
  }

  private updateBoomerangs(dt: number): void {
    for (let i = this.boomerangs.length - 1; i >= 0; i--) {
      const b = this.boomerangs[i];
      b.life -= dt;
      b.pos.addScaledVector(b.dir, b.speed * dt);
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.y += dt * 16;
      b.mesh.rotation.z += dt * 6;
      let removed = false;
      for (const car of this.cars) {
        if (car.isGhost || car.id === b.owner || car.shieldTimer > 0) continue;
        if (car.pos.distanceTo(b.pos) < 2.6) {
          car.spinTimer = Math.max(car.spinTimer, 1.5);
          this.particles.emitCollision(car.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0.6);
          if (car.isPlayer) {
            this.audio.playSpin();
            if (this.settings.cameraShake) this.rig.addShake(0.35);
          }
          removed = true;
          break;
        }
      }
      if (removed || b.life <= 0) {
        this.sm.scene.remove(b.mesh);
        this.boomerangs.splice(i, 1);
      }
    }
  }

  private respawnBoxes(dt: number): void {
    if (!this.track) return;
    for (const box of this.track.itemBoxes) {
      if (!box.active) {
        box.respawn -= dt;
        if (box.respawn <= 0) {
          box.active = true;
          box.mesh.visible = true;
        }
      }
    }
  }

  private updatePlaces(): void {
    const sorted = [...this.cars].filter((c) => !c.isGhost).sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((c, i) => (c.place = i + 1));
  }

  private updateFinished(dt: number): void {
    if (!this.player || !this.track) return;
    // 滑行
    for (const car of this.cars) {
      if (car.isGhost) continue;
      stepCarPhysics(car, { throttle: 0, steer: 0, drift: false }, dt);
      const q = this.track.query(car.pos);
      car.offroad = computeOffroad(car, q.dist, this.track.width / 2);
      this.groundFollow(car, q, dt);
    }
    const maxSpeed = 40;
    this.rig.updateRace(dt, this.player.pos, this.player.heading, this.player.speed, maxSpeed, false);
    this.sm.updateShadowFocus(this.player.pos);
    this.audio.updateEngine(Math.abs(this.player.speed) / maxSpeed, false, false);
    this.audio.stopDrift();
    updatePopupProps(this.track.props, this.player.pos, dt);
  }

  private finishRace(): void {
    this.phase = 'finished';
    this.audio.stopDrift();
    this.audio.playFinish();
    if (this.mode === 'timetrial' && this.player) {
      const data = this.recorder.stop(this.player.finishTime, this.config.trackId, this.config.racerId, this.config.paperId as 'light' | 'medium' | 'heavy');
      saveBestGhost(data);
    }
    this.updatePlaces();
    const results: RacerResult[] = this.cars
      .filter((c) => !c.isGhost)
      .sort((a, b) => a.place - b.place)
      .map((c) => ({
        id: c.id, name: c.racer.name, racerId: c.racer.id, isPlayer: c.isPlayer,
        place: c.place, totalTime: c.finished ? c.finishTime : 0,
        bestLap: c.bestLap, finished: c.finished, color: c.racer.primaryColor,
      }));
    this.events.onPhase?.('finished');
    this.events.onResults?.(results);
    this.pushHud(true);
  }

  // ================= HUD / 小地图 =================
  private pushHud(force: boolean): void {
    if (!this.events.onHud || !this.player) return;
    const p = this.player;
    const totalLaps = getTrack(this.config.trackId).laps;
    const maxSpeed = (36 + p.racer.stats.speed * 0.18) * p.paper.speedMul;
    const tier: 0 | 1 | 2 = p.driftCharge >= 1.6 ? 2 : p.driftCharge >= 0.8 ? 1 : 0;
    const snap: HudSnapshot = {
      phase: this.phase,
      countdown: Math.max(0, Math.ceil(this.countdown)),
      speed: Math.round(Math.abs(p.speed) * 3.2),
      lap: Math.min(p.lap, totalLaps),
      totalLaps,
      place: p.place,
      totalRacers: this.cars.filter((c) => !c.isGhost).length,
      heldItem: p.heldItem,
      roulette: p.rouletteTimer > 0,
      driftCharge: p.driftCharge,
      driftTier: tier,
      boost: p.boostTimer > 0,
      shield: p.shieldTimer > 0,
      slow: p.slowTimer > 0,
      raceTime: this.raceTime,
      currentLapTime: this.raceTime - p.lapStart,
      bestLap: p.bestLap,
      lastLap: p.lapTimes.length ? p.lapTimes[p.lapTimes.length - 1] : 0,
      offroad: p.offroad,
      wrongWay: false,
    };
    this.events.onHud(snap);
  }

  getMinimapData(): MinimapData | null {
    if (!this.track) return null;
    return {
      outline: this.track.outline,
      cars: this.cars.map((c) => ({
        x: c.pos.x, z: c.pos.z, heading: c.heading,
        color: c.isGhost ? 0x9fd4ea : c.racer.primaryColor,
        isPlayer: c.isPlayer, isGhost: c.isGhost,
      })),
      bounds: this.track.bounds,
      playerT: this.player ? this.player.nearestT : 0,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.bookIntro?.dispose();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.audio.dispose();
    this.clearCars();
    this.clearWorld();
    this.particles.dispose(this.sm.scene);
    this.sm.dispose();
  }
}