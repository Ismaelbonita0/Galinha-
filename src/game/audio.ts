import { WeaponId } from './types';

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock() {
    if (this.muted) return;
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private buildNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  private pitchVar(base: number, pct = 0.08): number {
    return base * (1 + (Math.random() * 2 - 1) * pct);
  }

  public playWeaponFire(weapon: WeaponId) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (weapon === 'ak_galo') {
      this.noiseBurst(ctx, now, 0.08, 1200, 0.22);
      this.tone(ctx, now, 'sawtooth', this.pitchVar(170), 65, 0.075, 0.16);
    } else if (weapon === 'shotgun') {
      this.noiseBurst(ctx, now, 0.2, 650, 0.34);
      this.tone(ctx, now, 'triangle', this.pitchVar(130), 42, 0.18, 0.28);
    } else if (weapon === 'bazooka') {
      this.noiseBurst(ctx, now, 0.26, 420, 0.25);
      this.tone(ctx, now, 'sawtooth', this.pitchVar(240), 90, 0.25, 0.2);
    } else if (weapon === 'laser') {
      this.tone(ctx, now, 'sine', this.pitchVar(980), 220, 0.15, 0.18);
      this.tone(ctx, now, 'square', this.pitchVar(1420), 340, 0.11, 0.08);
    } else if (weapon === 'pan') {
      // Metallic clang!
      this.tone(ctx, now, 'triangle', this.pitchVar(520), 480, 0.24, 0.22);
      this.tone(ctx, now, 'sine', this.pitchVar(1180), 1040, 0.28, 0.15);
    }
  }

  public playPanHit() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, now, 'square', this.pitchVar(660), 590, 0.18, 0.18);
    this.tone(ctx, now, 'triangle', this.pitchVar(1480), 1210, 0.32, 0.24);
  }

  public playExplosion(intensity = 1) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.min(0.45, 0.3 * intensity);
    this.noiseBurst(ctx, now, 0.48, 280, vol);
    this.tone(ctx, now, 'sine', 110, 28, 0.42, vol * 0.9);
  }

  public playCluck(urgent = false) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const base = urgent ? 580 : 410;
    this.tone(ctx, now, 'sawtooth', this.pitchVar(base, 0.12), base * 1.35, 0.06, 0.11);
    this.tone(ctx, now + 0.065, 'sawtooth', this.pitchVar(base * 1.15, 0.12), base * 0.72, 0.08, 0.1);
  }

  public playHitmarker(isKill: boolean) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (isKill) {
      this.tone(ctx, now, 'triangle', 740, 1120, 0.09, 0.16);
      this.tone(ctx, now + 0.05, 'sine', 1180, 1560, 0.11, 0.14);
    } else {
      this.tone(ctx, now, 'triangle', this.pitchVar(860, 0.06), 540, 0.045, 0.11);
    }
  }

  public playJump(jetpack = false) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (jetpack) {
      this.noiseBurst(ctx, now, 0.09, 900, 0.09);
      this.tone(ctx, now, 'sine', 190, 320, 0.08, 0.08);
    } else {
      this.tone(ctx, now, 'sine', this.pitchVar(220), 420, 0.1, 0.12);
    }
  }

  public playPickup() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, now, 'sine', 660, 880, 0.08, 0.14);
    this.tone(ctx, now + 0.07, 'sine', 880, 1320, 0.12, 0.14);
  }

  public playHurt() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, now, 'sawtooth', 260, 120, 0.16, 0.18);
    this.noiseBurst(ctx, now, 0.12, 500, 0.14);
  }

  public playTelegraph() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, now, 'square', 440, 880, 0.18, 0.08);
  }

  public playBuild() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, now, 'triangle', 180, 290, 0.08, 0.16);
    this.noiseBurst(ctx, now, 0.06, 950, 0.1);
  }

  private tone(
    ctx: AudioContext,
    startTime: number,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    gainVal: number,
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFreq), startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  private noiseBurst(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    cutoffHz: number,
    gainVal: number,
  ) {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoffHz * 0.25), startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startTime);
    src.stop(startTime + duration + 0.01);
  }
}

export const gameAudio = new GameAudioEngine();
