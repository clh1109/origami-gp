import * as THREE from 'three';

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  gravity: number;
  floor: number;
}

const MAX = 400;

/** 漂移彩纸屑 / 加速尾焰 / 碰撞纸片（实例化池） */
export class ParticleSystem {
  mesh: THREE.InstancedMesh;
  private pool: Particle[] = [];
  private cursor = 0;
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(0.4, 0.4);
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0xffffff),
        gravity: 9,
        floor: 0.05,
      });
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.tmpColor.set(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  private spawn(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: number,
    life: number,
    size: number,
    gravity = 9
  ): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    p.alive = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    p.rotVel.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color.set(color);
    p.gravity = gravity;
    // 纸屑落在出生处的路面 / 草地上，而不是穿透高架坡道
    p.floor = Math.max(0.05, pos.y - 0.25);
  }

  /** 漂移彩纸屑：tier 0 纸白 / 1 蓝 / 2 金 */
  emitDrift(pos: THREE.Vector3, heading: number, tier: 0 | 1 | 2, count = 2): void {
    const colors = tier === 2 ? [0xffd166, 0xffb347, 0xfff3dc] : tier === 1 ? [0x4b8ab0, 0x9fd4ea, 0xd8f3dc] : [0xfaf3e3, 0xe8dcc8, 0xffffff];
    const back = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
    for (let i = 0; i < count; i++) {
      const p = pos.clone().addScaledVector(back, 1.6).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.3, (Math.random() - 0.5) * 1.6));
      const v = back.clone().multiplyScalar(4 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4));
      this.spawn(p, v, colors[Math.floor(Math.random() * colors.length)], 0.5 + Math.random() * 0.4, 0.5 + Math.random() * 0.6, 12);
    }
  }

  /** 加速尾焰纸屑 */
  emitBoost(pos: THREE.Vector3, heading: number, count = 3): void {
    const back = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
    const colors = [0xffb347, 0xffd166, 0xe05a47, 0xfff3dc];
    for (let i = 0; i < count; i++) {
      const p = pos.clone().addScaledVector(back, 1.9).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 1.2));
      const v = back.clone().multiplyScalar(10 + Math.random() * 8).add(new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2));
      this.spawn(p, v, colors[Math.floor(Math.random() * colors.length)], 0.35 + Math.random() * 0.3, 0.5 + Math.random() * 0.7, 4);
    }
  }

  /** 碰撞纸片 */
  emitCollision(point: THREE.Vector3, strength: number): void {
    const n = Math.floor(6 + strength * 10);
    const colors = [0xfaf3e3, 0xe8dcc8, 0xd9b382, 0xffffff];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 12, 3 + Math.random() * 7, (Math.random() - 0.5) * 12);
      this.spawn(point.clone().add(new THREE.Vector3(0, 0.5, 0)), v, colors[Math.floor(Math.random() * colors.length)], 0.6 + Math.random() * 0.5, 0.5 + Math.random() * 0.8, 14);
    }
  }

  /** 道具拾取 / 展开小星屑 */
  emitSparkle(pos: THREE.Vector3, color: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6);
      this.spawn(pos.clone(), v, color, 0.4 + Math.random() * 0.3, 0.35 + Math.random() * 0.4, 6);
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(0.4, dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < p.floor) {
        p.pos.y = p.floor;
        p.vel.y *= -0.3;
      }
      p.rot.x += p.rotVel.x * dt;
      p.rot.y += p.rotVel.y * dt;
      p.rot.z += p.rotVel.z * dt;
      const t = p.life / p.maxLife;
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.copy(p.rot);
      this.dummy.scale.setScalar(p.size * (0.4 + t * 0.8));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}