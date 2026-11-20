import * as THREE from 'three';

/**
 * Web Audio API 合成音效：引擎音、纸张沙沙声、漂移、道具、倒计时。
 * 全部程序化合成，无外部音频资源。首次用户手势时初始化以符合自动播放策略。
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private driftSource: AudioBufferSourceNode | null = null;
  private driftGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;

  private volume = 0.7;
  private muted = false;
  private lastRustle = 0;
  private started = false;

  /** 在用户手势中调用 */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      // 白噪声缓冲
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    } catch {
      this.ctx = null;
    }
  }

  setVolume(v: number): void {
    this.volume = THREE.MathUtils.clamp(v, 0, 1);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  // ============ 引擎音 ============
  startEngine(): void {
    if (!this.ctx || !this.master || this.started) return;
    this.started = true;
    const t = this.now();
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 700;
    this.engineFilter.Q.value = 3;

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 70;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 105;

    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start(t);
    this.engineOsc2.start(t);
  }

  updateEngine(speedRatio: number, boosting: boolean, offroad: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineOsc2 || !this.engineGain || !this.engineFilter) return;
    const t = this.now();
    const base = 62 + speedRatio * 190 + (boosting ? 40 : 0);
    this.engineOsc.frequency.setTargetAtTime(base, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(base * 1.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(500 + speedRatio * 1500 + (boosting ? 600 : 0), t, 0.1);
    const g = 0.035 + speedRatio * 0.05 + (boosting ? 0.03 : 0) + (offroad ? 0.015 : 0);
    this.engineGain.gain.setTargetAtTime(g, t, 0.1);
  }

  stopEngine(): void {
    if (!this.ctx || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(0, this.now(), 0.1);
  }

  // ============ 漂移沙沙声 ============
  startDrift(): void {
    if (!this.ctx || !this.master || this.driftSource) return;
    const src = this.noiseSource();
    if (!src) return;
    this.driftSource = src;
    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.value = 2600;
    this.driftFilter.Q.value = 0.8;
    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.value = 0;
    src.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.master);
    src.start();
  }

  updateDrift(intensity: number): void {
    if (!this.ctx || !this.driftGain || !this.driftFilter) return;
    const t = this.now();
    this.driftGain.gain.setTargetAtTime(0.05 * intensity, t, 0.05);
    this.driftFilter.frequency.setTargetAtTime(2200 + intensity * 1800, t, 0.08);
  }

  stopDrift(): void {
    if (!this.ctx || !this.driftGain || !this.driftSource) return;
    const t = this.now();
    this.driftGain.gain.setTargetAtTime(0, t, 0.06);
    const src = this.driftSource;
    this.driftSource = null;
    try {
      src.stop(t + 0.2);
    } catch {
      /* noop */
    }
  }

  // ============ 一次性音效 ============
  private blip(freq: number, dur: number, type: OscillatorType, gain: number, sweepTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, gain: number, filterFreq: number, type: BiquadFilterType = 'bandpass', sweepTo?: number): void {
    if (!this.ctx || !this.master) return;
    const src = this.noiseSource();
    if (!src) return;
    const t = this.now();
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    filter.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** 纸张翻折沙沙声（100ms 节流） */
  playRustle(): void {
    if (!this.ctx) return;
    const t = this.now();
    if (t - this.lastRustle < 0.1) return;
    this.lastRustle = t;
    this.noiseBurst(0.18, 0.06, 3200, 'highpass');
  }

  playBoost(): void {
    this.noiseBurst(0.5, 0.12, 600, 'bandpass', 4200);
    this.blip(300, 0.45, 'sawtooth', 0.06, 900);
  }

  playMiniTurbo(tier: number): void {
    const base = tier >= 2 ? 660 : 520;
    this.blip(base, 0.22, 'triangle', 0.09, base * 1.8);
    this.noiseBurst(0.24, 0.07, 1800, 'bandpass', 3600);
  }

  playPickup(): void {
    this.blip(880, 0.1, 'square', 0.05, 1320);
    this.blip(1320, 0.12, 'triangle', 0.04);
  }

  playShield(): void {
    this.blip(520, 0.3, 'sine', 0.07, 780);
    this.blip(780, 0.35, 'sine', 0.05, 1040);
    this.noiseBurst(0.3, 0.03, 5000, 'highpass');
  }

  playTrap(): void {
    this.noiseBurst(0.22, 0.09, 900, 'lowpass', 300);
    this.blip(200, 0.18, 'sine', 0.06, 90);
  }

  playBoomerang(): void {
    this.noiseBurst(0.4, 0.07, 1400, 'bandpass', 2600);
    this.blip(440, 0.35, 'triangle', 0.05, 660);
  }

  playCollision(): void {
    this.noiseBurst(0.2, 0.12, 500, 'lowpass', 160);
    this.blip(120, 0.16, 'sine', 0.08, 60);
  }

  playSpin(): void {
    this.blip(400, 0.5, 'sawtooth', 0.06, 120);
    this.noiseBurst(0.4, 0.05, 1200, 'bandpass', 400);
  }

  playCountdown(final: boolean): void {
    if (final) {
      this.blip(880, 0.4, 'square', 0.09, 1320);
      this.blip(1320, 0.5, 'triangle', 0.06);
    } else {
      this.blip(440, 0.18, 'square', 0.07);
    }
  }

  playLap(): void {
    this.blip(660, 0.12, 'triangle', 0.07, 990);
    this.blip(990, 0.16, 'triangle', 0.05);
  }

  playFinish(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => {
      setTimeout(() => this.blip(n, 0.3, 'triangle', 0.08), i * 110);
    });
  }

  playUIClick(): void {
    this.blip(620, 0.06, 'triangle', 0.04, 820);
  }

  playUIBack(): void {
    this.blip(420, 0.07, 'triangle', 0.035, 300);
  }

  dispose(): void {
    this.stopDrift();
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc2?.stop();
      } catch {
        /* noop */
      }
    }
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.started = false;
  }
}