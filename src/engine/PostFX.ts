import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * 微缩模型质感后处理：
 * - 移轴景深（tilt-shift）：焦平面外上下渐晕模糊，营造"微缩纸艺沙盘"观感
 * - 轻量泛光：仅让自发光纸灯笼 / 加速带溢出柔光
 * - 暖调饱和调色：消除灰白塑料感
 */

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    direction: { value: new THREE.Vector2(1, 0) },
    focusY: { value: 0.55 },
    band: { value: 0.22 },
    maxBlur: { value: 2.8 },
    grade: { value: 0 }, // 1 时在竖向 pass 做调色
    saturation: { value: 1.18 },
    warmth: { value: 0.045 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform vec2 direction;
    uniform float focusY;
    uniform float band;
    uniform float maxBlur;
    uniform float grade;
    uniform float saturation;
    uniform float warmth;
    varying vec2 vUv;

    void main() {
      float d = abs(vUv.y - focusY);
      float blur = smoothstep(band, band + 0.38, d) * maxBlur;
      vec2 px = direction / resolution * blur;
      vec4 c = texture2D(tDiffuse, vUv) * 0.227027;
      c += texture2D(tDiffuse, vUv + px * 1.3846) * 0.3162162;
      c += texture2D(tDiffuse, vUv - px * 1.3846) * 0.3162162;
      c += texture2D(tDiffuse, vUv + px * 3.2308) * 0.0702703;
      c += texture2D(tDiffuse, vUv - px * 3.2308) * 0.0702703;
      vec3 col = c.rgb;
      if (grade > 0.5) {
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(l), col, saturation);
        col += vec3(warmth, warmth * 0.45, -warmth * 0.5) * (0.35 + 0.65 * l);
        // 微距暗角（Vignette）：边缘产生柔和的摄影微距暗部过渡
        vec2 vigUv = (vUv - 0.5) * 1.85;
        float vig = 1.0 - dot(vigUv, vigUv) * 0.14;
        col *= clamp(vig, 0.82, 1.0);
        col = clamp(col, 0.0, 1.0);
      }
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

export function makeTiltShiftPass(horizontal: boolean, withGrade: boolean): ShaderPass {
  const pass = new ShaderPass(TiltShiftShader);
  pass.uniforms.direction.value.set(horizontal ? 1 : 0, horizontal ? 0 : 1);
  pass.uniforms.grade.value = withGrade ? 1 : 0;
  return pass;
}

export function makeBloomPass(width: number, height: number): UnrealBloomPass {
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.28, 0.7, 0.82);
  return bloom;
}

export function setTiltResolution(passes: ShaderPass[], width: number, height: number): void {
  for (const p of passes) p.uniforms.resolution.value.set(width, height);
}

export function setTiltFocus(passes: ShaderPass[], y: number): void {
  for (const p of passes) p.uniforms.focusY.value = y;
}