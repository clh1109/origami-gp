import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * 清透绘本后处理：
 * - 非对称移轴景深：只轻柔虚化屏幕顶部的远景天际，绝不模糊下方主角赛车
 * - 清透暖调微饱和：保持蓝天与嫩绿草地的通透感
 */
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    direction: { value: new THREE.Vector2(1, 0) },
    focusY: { value: 0.55 },
    band: { value: 0.22 },
    maxBlur: { value: 1.5 },
    grade: { value: 0 },
    saturation: { value: 1.14 },
    warmth: { value: 0.012 },
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
      // 只对屏幕上方远景做轻柔景深虚化，主角车所在的中下半屏保持 100% 清晰
      float topDist = max(0.0, vUv.y - (focusY + 0.14));
      float blur = smoothstep(0.0, 0.34, topDist) * maxBlur;
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
        col += vec3(warmth, warmth * 0.5, -warmth * 0.35) * (0.35 + 0.65 * l);
        vec2 vigUv = (vUv - 0.5) * 1.75;
        float vig = 1.0 - dot(vigUv, vigUv) * 0.08;
        col *= clamp(vig, 0.88, 1.0);
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
  return new UnrealBloomPass(new THREE.Vector2(width, height), 0.22, 0.35, 0.95);
}

export function setTiltResolution(passes: ShaderPass[], width: number, height: number): void {
  for (const p of passes) p.uniforms.resolution.value.set(width, height);
}

export function setTiltFocus(passes: ShaderPass[], y: number): void {
  for (const p of passes) p.uniforms.focusY.value = y;
}
