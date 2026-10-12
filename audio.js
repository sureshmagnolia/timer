/**
 * Auditorium Countdown Timer - Audio Synthesis Engine
 * Generates clear, pleasant auditorium chimes and alerts using the Web Audio API.
 * 100% offline, zero external sound files required.
 */

class StageAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, parseFloat(val)));
  }

  setEnabled(val) {
    this.enabled = !!val;
  }

  // Dual tone gentle auditorium bell (Warning alert)
  playWarningChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // First chime: 659.25 Hz (E5)
    this._playHarmonicTone(659.25, now, 0.9, 0.4 * this.volume);
    // Second chime: 880 Hz (A5) slightly delayed
    this._playHarmonicTone(880.00, now + 0.22, 1.2, 0.5 * this.volume);
  }

  // Attention-grabbing double pulse (Danger alert)
  playDangerAlert() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this._playBeep(784.0, now, 0.18, 0.5 * this.volume);
    this._playBeep(784.0, now + 0.25, 0.25, 0.6 * this.volume);
  }

  // Deep gong / final buzzer when time reaches 00:00
  playTimeUpSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Resonant final chord (3 harmonics)
    this._playHarmonicTone(440, now, 2.5, 0.6 * this.volume);
    this._playHarmonicTone(554.37, now + 0.05, 2.3, 0.45 * this.volume);
    this._playHarmonicTone(659.25, now + 0.1, 2.2, 0.45 * this.volume);
  }

  // Subtle tick for final 5 seconds
  playFinalTick(secondsLeft) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freq = secondsLeft <= 3 ? 950 : 700;
    this._playBeep(freq, now, 0.08, 0.3 * this.volume);
  }

  _playHarmonicTone(freq, startTime, duration, gainValue) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  _playBeep(freq, startTime, duration, gainValue) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(gainValue, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }
}

// Global instance
window.stageAudio = new StageAudio();
