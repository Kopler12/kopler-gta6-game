// SAN VERANO audio engine — all sound synthesized with WebAudio, no assets.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false; this.master = null;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    this.musicTimer = 0; this.noteIdx = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine hum
      this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 60;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      const ef = this.ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 400;
      this.engineOsc.connect(ef); ef.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // siren
      this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  setEngine(on, speedRatio) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.07 : 0, t, 0.1);
    if (this.engineOsc) this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 160, t, 0.1);
  }
  setSiren(on) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.03 : 0, this.ctx.currentTime, 0.2);
  }
  updateSiren(t) { if (this.sirenOsc && this.ctx) this.sirenOsc.frequency.value = 650 + Math.sin(t * 6) * 220; }
  blip(freq, dur, type, vol, slide) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), c.currentTime + dur);
    g.gain.value = vol || 0.12; g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + dur);
  }
  noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, len = Math.max(1, (c.sampleRate * dur) | 0);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200;
    const g = c.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  shoot(rapid) { this.noise(rapid ? 0.07 : 0.12, 0.28, rapid ? 1800 : 900); this.blip(rapid ? 300 : 160, 0.08, 'square', 0.1, 60); }
  punch() { this.noise(0.08, 0.2, 400); }
  crash() { this.noise(0.3, 0.35, 300); this.blip(90, 0.25, 'sawtooth', 0.15, 40); }
  pickup() { this.blip(880, 0.12, 'sine', 0.15); setTimeout(() => this.blip(1320, 0.15, 'sine', 0.15), 60); }
  cash() { this.blip(1200, 0.08, 'square', 0.1); setTimeout(() => this.blip(1600, 0.12, 'square', 0.1), 50); }
  horn() { this.blip(370, 0.25, 'square', 0.08); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.14), i * 110)); }
  fail() { [400, 320, 240, 160].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'triangle', 0.14), i * 130)); }
  updateMusic(dt, playing) {
    if (!this.ctx || this.muted || !playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 0.24;
      const bass = [55, 55, 65.4, 55, 49, 55, 73.4, 82.4];
      const lead = [220, 0, 261.6, 0, 329.6, 0, 261.6, 220];
      const i = this.noteIdx % 8; this.noteIdx++;
      this.blip(bass[i], 0.22, 'triangle', 0.10);
      if (lead[i]) this.blip(lead[i], 0.18, 'sine', 0.045);
      if (i % 4 === 0) this.noise(0.03, 0.03, 6000);
    }
  }
}
