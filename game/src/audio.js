// WebAudio synth: engine, siren, shots, pickups, and a tiny music loop. No assets.
export class AudioSys {
  constructor() { this.ctx = null; this.muted = false; this.musicTimer = 0; this.step = 0; }
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* silent */ } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, type = 'square', vol = 0.08, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur);
  }
  noise(dur = 0.12, vol = 0.15) {
    if (!this.ctx || this.muted) return;
    const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g).connect(this.ctx.destination); s.start();
  }
  shoot(kind) { this.noise(kind === 'smg' ? 0.07 : 0.14, 0.2); this.tone(kind === 'smg' ? 700 : 420, 0.08, 'sawtooth', 0.06, -300); }
  punch() { this.noise(0.06, 0.12); }
  crash() { this.noise(0.25, 0.25); this.tone(90, 0.25, 'triangle', 0.15, -40); }
  cash() { this.tone(880, 0.09, 'sine', 0.1); setTimeout(() => this.tone(1320, 0.14, 'sine', 0.1), 70); }
  pickup() { this.tone(660, 0.08, 'sine', 0.09); setTimeout(() => this.tone(990, 0.1, 'sine', 0.09), 60); }
  sirenTick(t) { if (!this.muted) this.tone(650 + Math.sin(t * 6) * 220, 0.09, 'triangle', 0.025); }
  engine(speed) { if (Math.random() < 0.3) this.tone(55 + Math.abs(speed) * 22, 0.07, 'sawtooth', 0.02); }
  update(dt, driving) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 0.24;
      const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
      const lead = [220, 0, 262, 0, 330, 0, 262, 196];
      const i = this.step % 8;
      this.tone(bass[i], 0.22, 'triangle', 0.05);
      if (lead[i]) this.tone(lead[i], 0.18, 'sine', 0.03);
      if (driving && this.step % 2 === 0) this.tone(110, 0.05, 'square', 0.015);
      this.step++;
    }
  }
}
