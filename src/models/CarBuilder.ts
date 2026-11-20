import * as THREE from 'three';
import type { RacerSpec, PaperSpec } from '../types/game';
import { paperMesh, createPaperMaterial, createTranslucentPaper, attachOrigamiEdges } from '../materials/PaperMaterial';

export interface CarVisual {
  root: THREE.Group;
  tiltGroup: THREE.Group;
  wheels: THREE.Object3D[]; // 自转组
  frontWheels: THREE.Object3D[]; // 转向枢轴
  shieldMesh: THREE.Object3D;
}

/** 楔形多面体底盘几何（前低后高） */
function wedgeGeometry(w: number, L: number, hF: number, hB: number): THREE.BufferGeometry {
  const A = [-w, 0, L], B = [w, 0, L], C = [w, 0, -L], D = [-w, 0, -L];
  const E = [-w * 0.85, hF, L], F = [w * 0.85, hF, L], G = [w * 0.9, hB, -L], H = [-w * 0.9, hB, -L];
  const quads = [
    [A, B, C, D], // bottom
    [E, F, G, H], // top
    [A, B, F, E], // front
    [D, C, G, H], // back
    [A, D, H, E], // left
    [B, C, G, F], // right
  ];
  const pos: number[] = [];
  for (const q of quads) {
    const [p0, p1, p2, p3] = q;
    pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeWheel(primary: number, accent: number, ghost: boolean): { spin: THREE.Group; mesh: THREE.Mesh } {
  const spin = new THREE.Group();
  const mat = ghost ? createTranslucentPaper(0x3b2f27, 0.35) : createPaperMaterial(0x3b2f27, undefined, 0.95);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 8), mat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = !ghost;
  spin.add(tire);
  const hubMat = ghost ? createTranslucentPaper(accent, 0.35) : createPaperMaterial(accent, undefined, 0.85);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.46, 8), hubMat);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);
  return { spin, mesh: tire };
}

/** 车手头部 + 特征折纸配件 */
function buildHead(racer: RacerSpec, ghost: boolean): THREE.Group {
  const head = new THREE.Group();
  const paper = ghost ? createTranslucentPaper(0xfaf3e3, 0.35) : createPaperMaterial(0xfaf3e3, undefined, 0.9);
  const accent = ghost ? createTranslucentPaper(racer.accentColor, 0.35) : createPaperMaterial(racer.accentColor, undefined, 0.9);
  const primary = ghost ? createTranslucentPaper(racer.primaryColor, 0.35) : createPaperMaterial(racer.primaryColor, undefined, 0.9);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.66, 0.72), racer.earType === 'box' ? primary : paper);
  attachOrigamiEdges(skull, 22);
  head.add(skull);
  // 眼睛
  const eyeMat = ghost ? createTranslucentPaper(0x3b2f27, 0.4) : createPaperMaterial(0x3b2f27, undefined, 0.6);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), eyeMat);
    eye.position.set(s * 0.18, 0.05, 0.37);
    head.add(eye);
  }

  switch (racer.earType) {
    case 'fox': {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 4), accent);
        ear.position.set(s * 0.26, 0.55, 0);
        ear.rotation.z = -s * 0.25;
        head.add(ear);
      }
      break;
    }
    case 'rabbit': {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.1), accent);
        ear.position.set(s * 0.22, 0.75, -0.05);
        ear.rotation.z = -s * 0.15;
        head.add(ear);
      }
      break;
    }
    case 'bear': {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), accent);
        ear.position.set(s * 0.32, 0.4, 0);
        head.add(ear);
      }
      break;
    }
    case 'wing': {
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 3), accent);
        wing.position.set(s * 0.55, 0.15, -0.1);
        wing.rotation.z = s * 1.2;
        wing.rotation.x = -0.3;
        wing.scale.set(1, 1, 0.25);
        head.add(wing);
      }
      break;
    }
    case 'sail': {
      const sail = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 3), accent);
      sail.position.set(0, 0.6, -0.35);
      sail.scale.set(1, 1, 0.2);
      head.add(sail);
      break;
    }
    case 'box': {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 4), accent);
      antenna.position.set(0, 0.55, 0);
      head.add(antenna);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), accent);
      tip.position.set(0, 0.82, 0);
      head.add(tip);
      break;
    }
  }
  return head;
}

/** 组装折纸赛车（6 可见分件 + 状态挂载） */
export function buildCar(racer: RacerSpec, paper: PaperSpec, ghost = false): CarVisual {
  const root = new THREE.Group();
  const tiltGroup = new THREE.Group();
  root.add(tiltGroup);

  const primary = ghost ? createTranslucentPaper(racer.primaryColor, 0.35) : createPaperMaterial(racer.primaryColor);
  const accent = ghost ? createTranslucentPaper(racer.accentColor, 0.35) : createPaperMaterial(racer.accentColor);
  const dark = ghost ? createTranslucentPaper(0x3b2f27, 0.35) : createPaperMaterial(0x3b2f27, undefined, 0.95);

  // 1 底盘（楔形多面体）+ 底部阴影托盘
  const chassis = new THREE.Mesh(wedgeGeometry(1.0, 1.9, 0.55, 1.05), primary);
  chassis.position.y = 0.5;
  if (!ghost) attachOrigamiEdges(chassis, 22);
  chassis.castShadow = !ghost;
  tiltGroup.add(chassis);

  const tray = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: ghost ? 0.06 : 0.16, depthWrite: false })
  );
  tray.rotation.x = -Math.PI / 2;
  tray.position.y = 0.03;
  tray.scale.set(0.62, 1.05, 1);
  root.add(tray);

  // 2 尖锐导流鼻翼（四棱锥）+ 两侧定风翼
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.5, 4), accent);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(0, 0.72, 2.35);
  if (!ghost) attachOrigamiEdges(nose, 20);
  nose.castShadow = !ghost;
  tiltGroup.add(nose);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.95), accent);
    fin.position.set(s * 1.12, 0.62, 1.55);
    fin.rotation.z = s * 0.12;
    fin.castShadow = !ghost;
    tiltGroup.add(fin);
  }

  // 3 独立折纸尾翼（双立柱 + 倾斜翼面）
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), dark);
    post.position.set(s * 0.72, 1.35, -1.72);
    tiltGroup.add(post);
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.75), accent);
  wing.position.set(0, 1.78, -1.72);
  wing.rotation.x = -0.18;
  if (!ghost) attachOrigamiEdges(wing, 20);
  wing.castShadow = !ghost;
  tiltGroup.add(wing);

  // 4 四个独立车轮（八边形轮毂）
  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];
  const wheelPos: [number, number, number, boolean][] = [
    [-1.08, 0.55, 1.32, true],
    [1.08, 0.55, 1.32, true],
    [-1.08, 0.55, -1.32, false],
    [1.08, 0.55, -1.32, false],
  ];
  for (const [x, y, z, isFront] of wheelPos) {
    const { spin } = makeWheel(racer.primaryColor, racer.accentColor, ghost);
    spin.position.set(x, y, z);
    if (isFront) {
      const steer = new THREE.Group();
      steer.position.set(x, y, z);
      spin.position.set(0, 0, 0);
      steer.add(spin);
      tiltGroup.add(steer);
      frontWheels.push(steer);
    } else {
      tiltGroup.add(spin);
    }
    wheels.push(spin);
  }

  // 5 驾驶舱 + 车手头部
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 1.25), dark);
  cockpit.position.set(0, 1.12, -0.25);
  tiltGroup.add(cockpit);
  const head = buildHead(racer, ghost);
  head.position.set(0, 1.62, -0.25);
  tiltGroup.add(head);

  // 6 状态挂载：透明胶带护盾线框罩
  const shieldMesh = new THREE.Group();
  const shieldGeo = new THREE.IcosahedronGeometry(2.5, 0);
  const shieldSolid = new THREE.Mesh(
    shieldGeo,
    createTranslucentPaper(0xbfe3f2, 0.16, 0x9fd4ea, 0.3)
  );
  const shieldWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(shieldGeo, 10),
    new THREE.LineBasicMaterial({ color: 0x9fd4ea, transparent: true, opacity: 0.7 })
  );
  shieldMesh.add(shieldSolid, shieldWire);
  shieldMesh.position.y = 1.0;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  return { root, tiltGroup, wheels, frontWheels, shieldMesh };
}