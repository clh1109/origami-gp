import * as THREE from 'three';
import { createPaperMaterial, createEmissivePaper } from '../materials/PaperMaterial';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export interface RescueCarTarget {
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  driftDir: number;
  driftCharge: number;
  root: THREE.Group;
  tiltGroup: THREE.Group;
}

/** 构建精致的 3D 折纸千纸鹤（含左右独立扇动翅膀 + 金色尾羽 + 双根淡金丝带） */
function buildOrigamiCraneMesh(): {
  root: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  ribbons: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
} {
  const root = new THREE.Group();
  const whiteMat = createPaperMaterial(0xfffdf6, undefined, 0.88);
  const goldMat = createPaperMaterial(0xf4d35e, undefined, 0.82);
  const beakMat = createEmissivePaper(0xe05a47, 0xe05a47, 0.35);
  whiteMat.transparent = true;
  goldMat.transparent = true;
  beakMat.transparent = true;

  // 1. 菱形折纸躯干
  const bodyGeo = new THREE.OctahedronGeometry(0.95, 0);
  bodyGeo.scale(0.85, 0.65, 1.55);
  const body = new THREE.Mesh(bodyGeo, whiteMat);
  body.castShadow = true;
  root.add(body);

  // 2. 前伸折纸长颈 + 鹤头 + 红纸尖喙
  const neckGeo = new THREE.ConeGeometry(0.32, 1.85, 4);
  const neck = new THREE.Mesh(neckGeo, whiteMat);
  neck.position.set(0, 0.85, 1.35);
  neck.rotation.x = 0.65;
  neck.castShadow = true;
  root.add(neck);

  const headGeo = new THREE.ConeGeometry(0.24, 0.82, 4);
  headGeo.rotateX(Math.PI / 2 + 0.3);
  const head = new THREE.Mesh(headGeo, beakMat);
  head.position.set(0, 1.48, 2.02);
  root.add(head);

  // 3. 上翘金色折纸尾羽
  const tailGeo = new THREE.ConeGeometry(0.34, 2.0, 4);
  const tail = new THREE.Mesh(tailGeo, goldMat);
  tail.position.set(0, 0.92, -1.55);
  tail.rotation.x = -0.68;
  tail.castShadow = true;
  root.add(tail);

  // 4. 左右可扇动折纸宽翼（双段折叠感 + 金色翼尖）
  const makeWing = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.45, 0.15, 0.05);

    const wingGeo = new THREE.BufferGeometry();
    const s = side;
    wingGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0, 0.9,        s * 3.4, 0.25, -0.35,   0, 0, -0.95,
          0, 0, 0.9,        s * 1.9, 0.45, 0.75,    s * 3.4, 0.25, -0.35,
        ],
        3
      )
    );
    wingGeo.computeVertexNormals();
    const wingMat = whiteMat.clone();
    wingMat.side = THREE.DoubleSide;
    const wingMesh = new THREE.Mesh(wingGeo, wingMat);
    wingMesh.castShadow = true;
    pivot.add(wingMesh);

    // 金色翼尖点缀
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          s * 2.55, 0.3, 0.15,   s * 3.85, 0.18, -0.55,   s * 2.65, 0.12, -0.65,
        ],
        3
      )
    );
    tipGeo.computeVertexNormals();
    const tipMat = goldMat.clone();
    tipMat.side = THREE.DoubleSide;
    pivot.add(new THREE.Mesh(tipGeo, tipMat));

    return pivot;
  };

  const leftWing = makeWing(-1);
  const rightWing = makeWing(1);
  root.add(leftWing, rightWing);

  // 5. 运送赛车时垂下的两根淡金色丝带
  const ribbons = new THREE.Group();
  const ribbonMat = new THREE.MeshBasicMaterial({
    color: 0xffe082,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  for (const zOff of [-0.55, 0.55]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 3.6), ribbonMat);
    strip.position.set(0, -1.9, zOff);
    ribbons.add(strip);
  }
  ribbons.visible = false;
  root.add(ribbons);

  return { root, leftWing, rightWing, ribbons, materials: [whiteMat, goldMat, beakMat] };
}

/**
 * 3D 折纸千纸鹤救援控制器：
 * - carrying = true 期间接管玩家赛车位置与朝向（物理循环跳过玩家）
 * - 放下赛车后立即归还操控，千纸鹤自己振翅飞向天空并渐隐
 */
export class CraneRescueController {
  private scene: THREE.Scene;
  private crane: ReturnType<typeof buildOrigamiCraneMesh>;
  private active = false;
  private carrying = false;
  private elapsed = 0;

  private car: RescueCarTarget | null = null;
  private startPos = new THREE.Vector3();
  private endPos = new THREE.Vector3();
  private startHeading = 0;
  private endHeading = 0;
  private craneStart = new THREE.Vector3();
  private craneLeaveDir = new THREE.Vector3();

  private readonly swoopDur = 0.55;  // 俯冲到车顶
  private readonly carryDur = 1.05;  // 衔起弧线飞回赛道
  private readonly leaveDur = 0.85;  // 放下后振翅飞远淡出

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.crane = buildOrigamiCraneMesh();
    this.crane.root.visible = false;
    this.scene.add(this.crane.root);
  }

  /** 是否正在救援运送赛车（为 true 时暂停玩家常规物理） */
  get isCarrying(): boolean {
    return this.carrying;
  }

  get isActive(): boolean {
    return this.active;
  }

  trigger(
    car: RescueCarTarget,
    targetPos: THREE.Vector3,
    targetHeading: number,
    onSparkle?: (pos: THREE.Vector3) => void
  ): void {
    if (this.active) return;
    this.active = true;
    this.carrying = true;
    this.elapsed = 0;
    this.car = car;

    // 重置漂移与速度，准备起飞
    car.speed = 0;
    car.driftDir = 0;
    car.driftCharge = 0;

    this.startPos.copy(car.pos);
    this.endPos.copy(targetPos);
    this.startHeading = car.heading;
    this.endHeading = targetHeading;

    // 千纸鹤从高空斜侧方入场
    this.craneStart.set(car.pos.x - 14, car.pos.y + 22, car.pos.z - 12);
    this.craneLeaveDir.set(Math.sin(targetHeading) * 24 + 8, 22, Math.cos(targetHeading) * 24 - 6);

    this.crane.root.visible = true;
    this.crane.ribbons.visible = false;
    this.setOpacity(1);
    onSparkle?.(car.pos.clone().add(new THREE.Vector3(0, 1.6, 0)));
  }

  update(dt: number, onSparkle?: (pos: THREE.Vector3) => void): void {
    if (!this.active || !this.car) return;
    this.elapsed += dt;
    const t = this.elapsed;

    // 柔和流畅的折纸振翅动画
    const flapSpeed = this.carrying ? 10.5 : 13.5;
    const flap = Math.sin(t * flapSpeed) * 0.58;
    this.crane.leftWing.rotation.z = flap;
    this.crane.rightWing.rotation.z = -flap;

    const carryEnd = this.swoopDur + this.carryDur;
    const totalEnd = carryEnd + this.leaveDur;

    if (t < this.swoopDur) {
      // 阶段 1：俯冲到赛车正上方
      const u = easeInOutCubic(t / this.swoopDur);
      const hoverPos = new THREE.Vector3(this.startPos.x, this.startPos.y + 4.0, this.startPos.z);
      this.crane.root.position.lerpVectors(this.craneStart, hoverPos, u);
      this.crane.root.lookAt(hoverPos.x, hoverPos.y - 1.5, hoverPos.z);
      this.crane.ribbons.visible = u > 0.78;
    } else if (t < carryEnd) {
      // 阶段 2：丝带提起赛车，沿唯美抛物线飞回赛道中心并摆正车头
      this.crane.ribbons.visible = true;
      const u = easeInOutCubic((t - this.swoopDur) / this.carryDur);
      const arcHeight = Math.sin(u * Math.PI) * 8.5;

      const curX = THREE.MathUtils.lerp(this.startPos.x, this.endPos.x, u);
      const curZ = THREE.MathUtils.lerp(this.startPos.z, this.endPos.z, u);
      const curY = THREE.MathUtils.lerp(this.startPos.y, this.endPos.y, u) + arcHeight;

      this.car.pos.set(curX, curY, curZ);
      this.car.heading = lerpAngle(this.startHeading, this.endHeading, u);
      this.car.root.position.copy(this.car.pos);
      this.car.root.rotation.y = this.car.heading;
      // 吊在空中时微微轻晃的玩具感
      this.car.tiltGroup.rotation.z = Math.sin(t * 7) * 0.12;
      this.car.tiltGroup.rotation.x = -0.08 * Math.sin(u * Math.PI);

      this.crane.root.position.set(curX, curY + 3.9, curZ);
      this.crane.root.rotation.set(0, this.car.heading, 0);
    } else if (t < totalEnd) {
      // 阶段 3：放下赛车，立刻交还操控，千纸鹤振翅飞向天空并渐隐
      if (this.carrying) {
        this.carrying = false;
        this.crane.ribbons.visible = false;
        this.car.pos.copy(this.endPos);
        this.car.heading = this.endHeading;
        this.car.speed = 18; // 给一点顺滑的起步助推，不卡顿
        this.car.root.position.copy(this.endPos);
        this.car.root.rotation.y = this.endHeading;
        this.car.tiltGroup.rotation.set(0, 0, 0);
        onSparkle?.(this.endPos.clone().add(new THREE.Vector3(0, 1.2, 0)));
      }
      const u = (t - carryEnd) / this.leaveDur;
      const startLeave = new THREE.Vector3(this.endPos.x, this.endPos.y + 3.9, this.endPos.z);
      const endLeave = startLeave.clone().add(this.craneLeaveDir);
      this.crane.root.position.lerpVectors(startLeave, endLeave, easeInOutCubic(u));
      this.crane.root.lookAt(endLeave);
      this.setOpacity(1 - u);
    } else {
      this.reset();
    }
  }

  private setOpacity(alpha: number): void {
    this.crane.root.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'opacity' in m) {
        m.transparent = true;
        m.opacity = Math.max(0, alpha);
      }
    });
  }

  reset(): void {
    this.active = false;
    this.carrying = false;
    this.car = null;
    this.crane.root.visible = false;
    this.crane.ribbons.visible = false;
  }

  dispose(): void {
    this.reset();
    this.scene.remove(this.crane.root);
    this.crane.materials.forEach((m) => m.dispose());
  }
}
