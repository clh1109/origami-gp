import * as THREE from 'three';
import type { PopupPropRig, PropTheme, TrackColors } from '../types/game';
import { paperMesh, createEmissivePaper, createTranslucentPaper, attachOrigamiEdges } from '../materials/PaperMaterial';

/**
 * 3 级父子关节立体书景物：
 * RootPivot(地面 y=0) → BodyGroup(主干) → TopGroup(树冠/花瓣/风车叶)。
 * 初始贴地平躺，靠近玩家时按时间轴弹起展开。
 */

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

interface PropParts {
  body: THREE.Group;
  top: THREE.Group;
  spinner?: THREE.Object3D;
}

// ---------- 草甸 ----------
function pineTree(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const trunk = paperMesh(new THREE.CylinderGeometry(0.32, 0.42, 2.2, 6), 0x8a6a48);
  trunk.position.y = 1.1;
  body.add(trunk);
  const greens = [0x6f9f6a, 0x7fae76, 0x93c08a];
  for (let i = 0; i < 3; i++) {
    const r = 2.6 - i * 0.7;
    const h = 2.4 - i * 0.3;
    const cone = paperMesh(new THREE.ConeGeometry(r, h, 6), greens[i]);
    cone.position.y = 2.2 + i * 1.5 + h / 2 - 0.6;
    top.add(cone);
  }
  top.position.y = 0;
  return { body, top };
}

function pinwheel(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const stick = paperMesh(new THREE.CylinderGeometry(0.14, 0.18, 4.4, 5), 0xd9c9a8);
  stick.position.y = 2.2;
  body.add(stick);
  const spinner = new THREE.Group();
  const bladeColors = [0xe05a47, 0xf4d35e, 0x4b8ab0, 0x8eb87a];
  for (let i = 0; i < 4; i++) {
    const blade = paperMesh(new THREE.ConeGeometry(0.9, 2.0, 3), bladeColors[i], { threshold: 10 });
    blade.rotation.z = Math.PI / 2;
    blade.rotation.y = (i / 4) * Math.PI * 2;
    blade.position.set(Math.cos((i / 4) * Math.PI * 2) * 1.0, Math.sin((i / 4) * Math.PI * 2) * 1.0, 0);
    blade.rotation.x = Math.PI / 2;
    spinner.add(blade);
  }
  const hub = paperMesh(new THREE.SphereGeometry(0.28, 6, 5), 0xfaf3e3);
  spinner.add(hub);
  spinner.position.y = 4.5;
  top.add(spinner);
  return { body, top, spinner };
}

function flower(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const stem = paperMesh(new THREE.CylinderGeometry(0.1, 0.14, 2.4, 5), 0x6f9f6a);
  stem.position.y = 1.2;
  body.add(stem);
  const petalColor = [0xf4a6b8, 0xf4d35e, 0xe07a5f, 0xb79ced][Math.floor(Math.random() * 4)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = paperMesh(new THREE.ConeGeometry(0.5, 1.2, 4), petalColor, { threshold: 10 });
    petal.position.set(Math.cos(a) * 0.7, 2.5, Math.sin(a) * 0.7);
    petal.rotation.z = Math.cos(a) * 0.9;
    petal.rotation.x = -Math.sin(a) * 0.9;
    top.add(petal);
  }
  const center = paperMesh(new THREE.SphereGeometry(0.42, 6, 5), 0xffd166);
  center.position.y = 2.5;
  top.add(center);
  return { body, top };
}

// ---------- 夜巷 ----------
function lanternTower(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const pole = paperMesh(new THREE.CylinderGeometry(0.2, 0.26, 5.2, 6), 0x2b3752);
  pole.position.y = 2.6;
  body.add(pole);
  const lanternMat = createEmissivePaper(0xffb347, 0xffa028, 1.6);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.7, 8), lanternMat);
  attachOrigamiEdges(lantern, 20);
  lantern.position.y = 5.4;
  top.add(lantern);
  const cap = paperMesh(new THREE.ConeGeometry(1.3, 0.7, 8), 0x3b2f27);
  cap.position.y = 6.5;
  top.add(cap);
  const tassel = paperMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 4), 0xe07a5f);
  tassel.position.y = 4.3;
  top.add(tassel);
  return { body, top };
}

function nightEave(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const wall = paperMesh(new THREE.BoxGeometry(3.4, 3.2, 2.6), 0x2b3752);
  wall.position.y = 1.6;
  body.add(wall);
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.0),
    createEmissivePaper(0xffd166, 0xffc94d, 1.3)
  );
  win.position.set(0, 1.8, 1.32);
  body.add(win);
  const roof = paperMesh(new THREE.ConeGeometry(3.0, 1.5, 4), 0x1b2438);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.9;
  roof.scale.set(1.2, 1, 0.9);
  top.add(roof);
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.16, 3.2),
    createEmissivePaper(0xe07a5f, 0xe07a5f, 0.7)
  );
  trim.position.y = 3.25;
  top.add(trim);
  return { body, top };
}

// ---------- 冰霜 ----------
function iceCrystal(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const mound = paperMesh(new THREE.ConeGeometry(1.8, 0.9, 7), 0xeaf6fb);
  mound.position.y = 0.45;
  body.add(mound);
  const iceMat = createTranslucentPaper(0xbfe3f2, 0.62, 0x9fd4ea, 0.25);
  for (let i = 0; i < 4; i++) {
    const h = 2.4 + Math.random() * 2.4;
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.4, h, 5), iceMat);
    attachOrigamiEdges(crystal, 15);
    const a = (i / 4) * Math.PI * 2 + Math.random();
    crystal.position.set(Math.cos(a) * 0.8, 0.7 + h / 2, Math.sin(a) * 0.8);
    crystal.rotation.z = (Math.random() - 0.5) * 0.3;
    crystal.rotation.x = (Math.random() - 0.5) * 0.3;
    top.add(crystal);
  }
  return { body, top };
}

function envelopeRidge(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const env = paperMesh(new THREE.BoxGeometry(3.2, 2.2, 0.5), 0xf4f9fc);
  env.position.y = 1.1;
  body.add(env);
  const flap = paperMesh(new THREE.ConeGeometry(2.2, 1.4, 3), 0xdfeaf2, { threshold: 10 });
  flap.rotation.x = Math.PI;
  flap.rotation.z = Math.PI / 2;
  flap.position.y = 2.4;
  flap.scale.set(1, 1, 0.3);
  top.add(flap);
  const seal = paperMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8), 0x4b8ab0);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, 1.4, 0.3);
  top.add(seal);
  return { body, top };
}

// ---------- 书桌 ----------
function stickyNote(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const base = paperMesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), 0xb08154);
  base.position.y = 0.15;
  body.add(base);
  const noteColors = [0xf4d35e, 0xf4a6b8, 0x9fd4ea, 0xb5e0a8, 0xffb347];
  const c = noteColors[Math.floor(Math.random() * noteColors.length)];
  const note = paperMesh(new THREE.BoxGeometry(2.4, 2.6, 0.12), c);
  note.position.y = 1.6;
  note.rotation.x = -0.12;
  top.add(note);
  const curl = paperMesh(new THREE.BoxGeometry(2.4, 0.5, 0.12), c);
  curl.position.set(0, 0.45, 0.22);
  curl.rotation.x = 0.6;
  top.add(curl);
  return { body, top };
}

function pencil(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const shaft = paperMesh(new THREE.CylinderGeometry(0.5, 0.5, 5.0, 6), 0xf4d35e);
  shaft.position.y = 2.5;
  body.add(shaft);
  const wood = paperMesh(new THREE.ConeGeometry(0.5, 1.1, 6), 0xe8c9a0);
  wood.position.y = 5.5;
  top.add(wood);
  const lead = paperMesh(new THREE.ConeGeometry(0.18, 0.4, 6), 0x3b2f27);
  lead.position.y = 6.15;
  top.add(lead);
  const eraser = paperMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 6), 0xf4a6b8);
  eraser.position.y = 0.3;
  body.add(eraser);
  return { body, top };
}

function eraser(colors: TrackColors): PropParts {
  const body = new THREE.Group();
  const top = new THREE.Group();
  const block = paperMesh(new THREE.BoxGeometry(2.6, 1.4, 1.4), 0xf4a6b8);
  block.position.y = 0.7;
  body.add(block);
  const sleeve = paperMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), 0x4b8ab0);
  sleeve.position.y = 0.75;
  top.add(sleeve);
  return { body, top };
}

const BUILDERS: Record<PropTheme, ((c: TrackColors) => PropParts)[]> = {
  meadow: [pineTree, pinwheel, flower],
  neon: [lanternTower, nightEave],
  frost: [iceCrystal, envelopeRidge],
  desk: [stickyNote, pencil, eraser],
};

export function buildPopupProp(theme: PropTheme, variant: number, colors: TrackColors): PopupPropRig {
  const list = BUILDERS[theme];
  const parts = list[variant % list.length](colors);

  const rootPivot = new THREE.Group();
  const bodyGroup = parts.body;
  const topGroup = parts.top;
  bodyGroup.add(topGroup);
  rootPivot.add(bodyGroup);

  rootPivot.rotation.x = -Math.PI / 2;
  topGroup.scale.set(0.01, 0.01, 0.01);

  return {
    rootPivot,
    bodyGroup,
    topGroup,
    spinner: parts.spinner,
    popped: false,
    elapsed: 0,
    swayPhase: Math.random() * Math.PI * 2,
    baseY: 0,
  };
}

/** 3 级关节展开控制器（遵循架构时间轴） */
export function updatePopupProps(
  props: PopupPropRig[],
  playerPos: THREE.Vector3,
  dt: number,
  onPop?: () => void
): void {
  let playedThisFrame = false;
  for (const prop of props) {
    if (!prop.popped && playerPos.distanceTo(prop.rootPivot.position) < 58) {
      prop.popped = true;
      if (!playedThisFrame && onPop) {
        onPop();
        playedThisFrame = true;
      }
    }
    if (prop.popped && prop.elapsed < 0.6) {
      prop.elapsed = Math.min(0.6, prop.elapsed + dt);
      const tBase = Math.min(1, prop.elapsed / 0.35);
      const eBase = easeOutBack(tBase);
      prop.rootPivot.rotation.x = (-Math.PI / 2) * (1 - eBase);

      const tTop = Math.max(0, Math.min(1, (prop.elapsed - 0.15) / 0.4));
      const sTop = Math.max(0.01, easeOutBack(tTop));
      prop.topGroup.scale.set(sTop, sTop, sTop);
    } else if (prop.popped) {
      // 展开后轻微纸艺摆动
      prop.swayPhase += dt;
      prop.bodyGroup.rotation.z = Math.sin(prop.swayPhase * 1.3) * 0.02;
    }
    if (prop.popped && prop.spinner) {
      prop.spinner.rotation.z += dt * 2.2;
    }
  }
}

/** 大厅预览：立即全部展开 */
export function popAllInstant(props: PopupPropRig[]): void {
  for (const p of props) {
    p.popped = true;
    p.elapsed = 0.6;
    p.rootPivot.rotation.x = 0;
    p.topGroup.scale.set(1, 1, 1);
  }
}