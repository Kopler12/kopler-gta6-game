// WebAudio synth: engine, sirens, gunshots, music loop. No audio files.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.musicTimer = 0; this.step = 0; }
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  tone(freq, dur, type, vol, slideTo) {
    const c = this.ensure(); if (!c || this.muted) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  }
  noise(dur, vol) {
    const c = this.ensure(); if (!c || this.muted) return;
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain(); g.gain.value = vol || 0.15;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  shot() { this.noise(0.12, 0.22); this.tone(160, 0.08, 'square', 0.06, 60); }
  punch() { this.noise(0.07, 0.12); }
  cash() { this.tone(880, 0.09, 'sine', 0.1); setTimeout(() => this.tone(1320, 0.12, 'sine', 0.1), 70); }
  hurt() { this.tone(110, 0.15, 'sawtooth', 0.1, 60); }
  sirenTick() { this.tone(this.step % 2 ? 660 : 880, 0.16, 'triangle', 0.035); }
  engine(speedRatio) { if (Math.random() < 0.3) this.tone(55 + speedRatio * 90, 0.09, 'sawtooth', 0.02); }
  // Tiny bassline loop, called every frame; schedules notes on a beat grid.
  music(dt, active) {
    if (!active || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 0.24;
      const bass = [55, 55, 82.4, 55, 65.4, 55, 98, 73.4];
      this.tone(bass[this.step % 8], 0.2, 'triangle', 0.045);
      if (this.step % 4 === 0) this.tone(220, 0.3, 'sine', 0.02);
      this.step++;
      if (this.step % 8 === 0) this.sirenOn = false;
    }
  }
}
