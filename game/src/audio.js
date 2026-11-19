// WebAudio synthesized sound: engine, sirens, gunshots, music loop. No assets.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.musicTimer = 0; this.note = 0; }
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ctx.destination); } catch (e) { } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  tone(freq, dur, type = 'square', vol = 0.2, slide = 0) { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur); }
  noise(dur, vol = 0.3, freq = 1000) { if (!this.ctx || this.muted) return; const n = Math.floor(this.ctx.sampleRate * dur); const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = this.ctx.createBufferSource(); s.buffer = buf; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = this.ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.master); s.start(); }
  shoot(smg) { this.noise(0.09, 0.35, 2600); this.tone(smg ? 700 : 420, 0.07, 'square', 0.12, -300); }
  punch() { this.noise(0.06, 0.25, 700); }
  hit() { this.tone(140, 0.08, 'sawtooth', 0.15, -60); }
  pickup() { this.tone(660, 0.08, 'sine', 0.2); setTimeout(() => this.tone(990, 0.12, 'sine', 0.2), 70); }
  cash() { this.tone(880, 0.07, 'triangle', 0.2); setTimeout(() => this.tone(1320, 0.1, 'triangle', 0.2), 60); }
  crash() { this.noise(0.25, 0.4, 500); this.tone(90, 0.2, 'sawtooth', 0.2, -40); }
  sirenTick(t) { if (!this.ctx || this.muted) return; const f = 650 + Math.sin(t * 6) * 220; this.tone(f, 0.12, 'triangle', 0.05); }
  engine(speedRatio) { if (!this.ctx || this.muted) return; this.tone(55 + Math.abs(speedRatio) * 130, 0.09, 'sawtooth', 0.045); }
  music(dt) { if (!this.ctx || this.muted) return; this.musicTimer -= dt; if (this.musicTimer <= 0) { this.musicTimer = 0.24; const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 82.4]; const b = bass[this.note % bass.length]; this.tone(b, 0.22, 'triangle', 0.16); if (this.note % 2 === 0) this.tone(b * 4, 0.1, 'sine', 0.05); this.note++; } }
}
