// Audio sintetis (WebAudio) — tanpa file eksternal
let ctx = null, master = null, muted = false, amb = null;
function init() {
  if (ctx) return; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; }
}
function tone(f, d, type = 'sine', vol = 0.2, when = 0, slide = 0) {
  if (!ctx || muted) return; const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
}
export const Sound = {
  unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
  click() { tone(660, 0.07, 'triangle', 0.12); },
  hover() { tone(900, 0.03, 'sine', 0.04); },
  build() { tone(180, 0.12, 'square', 0.12); tone(260, 0.12, 'square', 0.1, 0.1); tone(180, 0.1, 'square', 0.1, 0.2); },
  done() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, i * 0.09)); },
  coin() { tone(988, 0.08, 'square', 0.08); tone(1319, 0.25, 'square', 0.08, 0.07); },
  alert() { tone(440, 0.18, 'sawtooth', 0.12); tone(330, 0.3, 'sawtooth', 0.12, 0.17); },
  bad() { tone(220, 0.4, 'sawtooth', 0.14, 0, -120); },
  win() { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.4, 'triangle', 0.16, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.12, i * 0.22)); },
  tick() { tone(1200, 0.02, 'square', 0.03); },
  ambient(on) {
    init(); if (!ctx) return;
    if (!on) { if (amb) { amb.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1); const a = amb; setTimeout(() => a.oscs.forEach(o => o.stop()), 1200); amb = null; } return; }
    if (amb) return;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(muted ? 0 : 0.05, ctx.currentTime + 3); g.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g);
    const oscs = [110, 164.8, 220, 277.2, 329.6].map((f, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (i - 2) * 6; const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.05 + i * 0.03; lg.gain.value = 4; lfo.connect(lg); lg.connect(o.detune); lfo.start(); o.connect(lp); o.start(); return o; });
    amb = { g, oscs };
  },
  mute(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; if (amb) amb.g.gain.value = m ? 0 : 0.05; },
  get muted() { return muted; },
};
