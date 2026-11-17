import { SenseType } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playPotionPickup(sense: SenseType) {
    const baseFreqs: Record<SenseType, number> = {
      touch: 523.25,
      smell: 587.33,
      taste: 659.25,
      sight: 783.99,
      hearing: 880.0,
    };
    const f = baseFreqs[sense];
    this.tone(f, 0.14, 'triangle', 0.11, 0);
    this.tone(f * 1.25, 0.18, 'sine', 0.1, 0.07);
  }

  public playDoorToggle(closing: boolean) {
    this.tone(closing ? 240 : 340, 0.08, 'square', 0.06, 0);
    this.tone(closing ? 180 : 420, 0.07, 'triangle', 0.07, 0.04);
  }

  public playInvite() {
    this.tone(440, 0.09, 'sine', 0.08, 0);
    this.tone(554.37, 0.12, 'sine', 0.09, 0.06);
  }

  public playFriendshipSuccess(hasBonus: boolean) {
    this.tone(523.25, 0.16, 'triangle', 0.12, 0);
    this.tone(659.25, 0.16, 'triangle', 0.12, 0.08);
    this.tone(783.99, 0.24, 'sine', 0.13, 0.16);
    if (hasBonus) {
      this.tone(1046.5, 0.3, 'sine', 0.12, 0.24);
    }
  }

  public playConflictPenalty() {
    this.tone(190, 0.18, 'sawtooth', 0.11, 0);
    this.tone(145, 0.25, 'sawtooth', 0.11, 0.12);
  }

  public playSparkTick(urgency: number) {
    // urgency 0..1
    const freq = 620 + urgency * 560;
    this.tone(freq, 0.07, 'square', 0.08, 0);
  }

  public playBombEvaded() {
    this.tone(392, 0.1, 'sine', 0.09, 0);
    this.tone(587.33, 0.16, 'triangle', 0.1, 0.07);
  }

  public playSiren911() {
    this.tone(680, 0.18, 'sawtooth', 0.12, 0);
    this.tone(920, 0.18, 'sawtooth', 0.12, 0.18);
    this.tone(680, 0.2, 'sawtooth', 0.12, 0.36);
  }

  public playLevelUp() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, 0.22, 'triangle', 0.12, idx * 0.09);
    });
  }

  public playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((n, idx) => {
      this.tone(n, 0.35, 'triangle', 0.13, idx * 0.1);
    });
  }
}

export const soundEngine = new SoundEngine();
