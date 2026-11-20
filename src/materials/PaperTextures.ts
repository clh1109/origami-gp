import * as THREE from 'three';

/**
 * 程序化纸张纹理体系：手账网格纸 / 牛皮纸 / 瓦楞卡纸 / 水彩纸。
 * 使用 OffscreenCanvas（不可用时回退到普通 Canvas）生成凹凸图与颜色图。
 */

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function createCanvas(size: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: Ctx2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    return { canvas, ctx };
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  return { canvas, ctx };
}

function toTexture(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  srgb: boolean,
  repeat = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// 简单可复现随机
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, THREE.Texture>();

function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** 纸张纤维凹凸图（灰度，线性空间） */
export function getPaperFiberBump(): THREE.Texture {
  return cached('fiber', () => {
    const size = 256;
    const { canvas, ctx } = createCanvas(size);
    const rnd = mulberry(1337);
    const img = (ctx as CanvasRenderingContext2D).createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        // 基础纤维噪声 + 轻微横向拉丝
        const n = rnd();
        const streak = Math.sin(x * 0.35 + y * 0.06) * 0.5 + 0.5;
        let v = 128 + (n - 0.5) * 46 + (streak - 0.5) * 16;
        // 偶发粗纤维
        if (rnd() > 0.994) v += 40;
        if (rnd() > 0.994) v -= 40;
        v = Math.max(0, Math.min(255, v));
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas, false, 1);
  });
}

/** 手账网格纸颜色图 */
export function getGridPaper(base = '#faf3e3', line = 'rgba(59,47,39,0.10)'): THREE.Texture {
  return cached(`grid-${base}-${line}`, () => {
    const size = 512;
    const { canvas, ctx } = createCanvas(size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    // 纸张斑点
    const rnd = mulberry(7);
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      ctx.fillStyle = `rgba(59,47,39,${rnd() * 0.04})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    // 网格
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    const cell = 32;
    for (let i = 0; i <= size; i += cell) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(size, i + 0.5);
      ctx.stroke();
    }
    // 主格线
    ctx.strokeStyle = line.replace(/[\d.]+\)$/, '0.18)');
    ctx.lineWidth = 1.6;
    for (let i = 0; i <= size; i += cell * 4) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(size, i + 0.5);
      ctx.stroke();
    }
    return toTexture(canvas, true, 1);
  });
}

/** 棋盘格起跑线 */
export function getChecker(a = '#3b2f27', b = '#fffdf8'): THREE.Texture {
  return cached(`checker-${a}-${b}`, () => {
    const size = 128;
    const cells = 8;
    const { canvas, ctx } = createCanvas(size);
    const c = size / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
        ctx.fillRect(x * c, y * c, c, c);
      }
    }
    return toTexture(canvas, true, 1);
  });
}

/** 牛皮纸 */
export function getKraft(base = '#c79a6b'): THREE.Texture {
  return cached(`kraft-${base}`, () => {
    const size = 256;
    const { canvas, ctx } = createCanvas(size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const rnd = mulberry(21);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const dark = rnd() > 0.5;
      ctx.fillStyle = dark ? `rgba(90,60,35,${rnd() * 0.10})` : `rgba(255,235,205,${rnd() * 0.10})`;
      ctx.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    // 长纤维
    for (let i = 0; i < 120; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      ctx.strokeStyle = `rgba(90,60,35,${rnd() * 0.06})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 6);
      ctx.stroke();
    }
    return toTexture(canvas, true, 1);
  });
}

/** 瓦楞卡纸（竖向浪纹） */
export function getCorrugated(base = '#d9b382'): THREE.Texture {
  return cached(`corr-${base}`, () => {
    const size = 256;
    const { canvas, ctx } = createCanvas(size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const flute = 12;
    for (let x = 0; x < size; x++) {
      const s = Math.sin((x / flute) * Math.PI * 2);
      const shade = 0.5 + s * 0.5;
      ctx.fillStyle = `rgba(90,60,35,${(1 - shade) * 0.16})`;
      ctx.fillRect(x, 0, 1, size);
      ctx.fillStyle = `rgba(255,240,215,${shade * 0.10})`;
      ctx.fillRect(x, 0, 1, size);
    }
    const rnd = mulberry(5);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(90,60,35,${rnd() * 0.05})`;
      ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
    }
    return toTexture(canvas, true, 1);
  });
}

/** 水彩纸（柔和晕染斑点） */
export function getWatercolor(base = '#ffffff'): THREE.Texture {
  return cached(`wc-${base}`, () => {
    const size = 256;
    const { canvas, ctx } = createCanvas(size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const rnd = mulberry(99);
    for (let i = 0; i < 60; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 8 + rnd() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = rnd() > 0.5 ? '210,225,235' : '235,225,205';
      g.addColorStop(0, `rgba(${tone},${rnd() * 0.10})`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 冷压颗粒
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = `rgba(120,120,120,${rnd() * 0.05})`;
      ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
    }
    return toTexture(canvas, true, 1);
  });
}

/** 木纹（午后书桌地面） */
export function getWood(base = '#c79a6b'): THREE.Texture {
  return cached(`wood-${base}`, () => {
    const size = 512;
    const { canvas, ctx } = createCanvas(size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const rnd = mulberry(31);
    for (let i = 0; i < 70; i++) {
      const y = rnd() * size;
      ctx.strokeStyle = `rgba(90,58,32,${0.04 + rnd() * 0.10})`;
      ctx.lineWidth = 0.8 + rnd() * 2.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      let cy = y;
      for (let x = 0; x <= size; x += 16) {
        cy += (rnd() - 0.5) * 5;
        ctx.lineTo(x, cy);
      }
      ctx.stroke();
    }
    // 木节
    for (let i = 0; i < 5; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      for (let r = 12; r > 0; r -= 3) {
        ctx.strokeStyle = `rgba(90,58,32,0.08)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.6, rnd(), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    return toTexture(canvas, true, 1);
  });
}

/** 通用细噪声凹凸（用于地面等） */
export function getGroundBump(): THREE.Texture {
  return cached('groundbump', () => {
    const size = 256;
    const { canvas, ctx } = createCanvas(size);
    const rnd = mulberry(55);
    const img = (ctx as CanvasRenderingContext2D).createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (rnd() - 0.5) * 30;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas, false, 1);
  });
}

export function disposeTextures(): void {
  cache.forEach((t) => t.dispose());
  cache.clear();
}