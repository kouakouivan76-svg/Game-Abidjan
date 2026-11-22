/* audio.js — sons synthétisés (aucun fichier externe) : tirs, impacts, explosions, moteurs, sirène, musique */
import { G, clamp, lerp } from './core.js';

let AC = null, master = null, engOsc = null, engGain = null, engOsc2 = null, sirenOsc = null, sirenGain = null, musicTimer = null, musicGain = null;
export function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = G.settings.volume; master.connect(AC.destination);
    musicGain = AC.createGain(); musicGain.gain.value = .5; musicGain.connect(master);
  } catch (e) { AC = null; }
}
export function setVolume(v) { G.settings.volume = v; if (master) master.gain.value = v; }

const noiseCache = {};
function noiseBuf(len) { const k = len.toFixed(2); if (noiseCache[k]) return noiseCache[k]; const b = AC.createBuffer(1, Math.floor(AC.sampleRate * len), AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noiseCache[k] = b; }
function burst(len, freq, vol, decay = 2, type = 'lowpass') {
  if (!AC) return; const s = AC.createBufferSource(); s.buffer = noiseBuf(len); const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + len);
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
export function sfx(k, vol = 1) {
  if (!AC || G.settings.volume <= 0) return;
  try {
    if (k === 'shot') burst(.14, 2600, .3 * vol);
    else if (k === 'smg') burst(.09, 3200, .22 * vol);
    else if (k === 'shotgun') { burst(.3, 1800, .5 * vol); }
    else if (k === 'hit') burst(.08, 900, .25 * vol);
    else if (k === 'swing') burst(.1, 1400, .08 * vol, 2, 'highpass');
    else if (k === 'boom') { burst(1.1, 380, .9 * vol); burst(.4, 1500, .4 * vol); }
    else if (k === 'rocket') burst(.35, 1200, .35 * vol, 2, 'bandpass');
    else if (k === 'pickup') { tone(660, .08, .12 * vol); setTimeout(() => tone(990, .1, .12 * vol), 70); }
    else if (k === 'win') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, .18, .16 * vol), i * 110)); }
    else if (k === 'fail') { [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, .25, .16 * vol, 'sawtooth'), i * 160)); }
    else if (k === 'ui') tone(880, .05, .1 * vol);
    else if (k === 'crash') burst(.35, 700, .5 * vol);
  } catch (e) { /* ignore */ }
}
function tone(f, d, v, type = 'sine') {
  if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(v, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d); o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime + d);
}
/* Moteur : kind = car|moto|boat|heli|plane|tank ; sp01 = vitesse normalisée */
export function engine(kind, sp01) {
  if (!AC) return;
  if (!kind) { if (engGain) engGain.gain.value = 0; return; }
  if (!engOsc) {
    engOsc = AC.createOscillator(); engOsc.type = 'sawtooth'; engOsc2 = AC.createOscillator(); engOsc2.type = 'square';
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; engGain = AC.createGain(); engGain.gain.value = 0;
    engOsc.connect(f); engOsc2.connect(f); f.connect(engGain); engGain.connect(master); engOsc.start(); engOsc2.start(); engOsc.f = f;
  }
  const base = { car: 55, moto: 80, boat: 45, heli: 28, plane: 70, tank: 32 }[kind] || 55, mx = { car: 90, moto: 120, boat: 50, heli: 18, plane: 90, tank: 30 }[kind] || 80;
  engOsc.frequency.value = base + sp01 * mx; engOsc2.frequency.value = (base + sp01 * mx) * 1.5; engOsc.f.frequency.value = 300 + sp01 * 700;
  engGain.gain.value = (kind === 'heli' ? .08 : .045) * (.5 + sp01) * G.settings.volume;
}
export function siren(on) {
  if (!AC) return;
  if (!sirenOsc) { sirenOsc = AC.createOscillator(); sirenOsc.type = 'triangle'; sirenGain = AC.createGain(); sirenGain.gain.value = 0; sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start(); }
  sirenGain.gain.value = on ? .035 : 0; if (on) sirenOsc.frequency.value = 700 + Math.sin(performance.now() / 280) * 260;
}

/* Musique : boucle afro-beat simple (basse + percussions) */
const SCALES = { gbaka: { root: 98, notes: [0, 3, 5, 7, 10, 12], bpm: 112 }, lagune: { root: 82, notes: [0, 2, 5, 7, 9, 12], bpm: 96 }, action: { root: 73, notes: [0, 3, 6, 7, 10], bpm: 128 }, calme: { root: 110, notes: [0, 4, 7, 11, 12], bpm: 80 } };
let style = null, step = 0;
export function music(name) {
  if (!AC) return; if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  style = name && G.settings.music ? SCALES[name] : null; if (!style) return;
  step = 0; const dur = 60 / style.bpm / 2;
  musicTimer = setInterval(() => {
    if (!AC || G.paused || !G.settings.music) return; const t = AC.currentTime + .02, s = step % 16; step++;
    const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (s % 4 === 0) mk(t, 'k'); if (s % 2 === 1) mk(t, 'h'); if (s === 4 || s === 12) mk(t, 's');
    if (pat[s]) { const n = style.notes[(s * 3 + (step >> 4)) % style.notes.length]; mn(t, style.root * Math.pow(2, n / 12), dur * 1.6); }
    if (s % 8 === 2) { const n = style.notes[(step >> 3) % style.notes.length]; mn(t, style.root * 4 * Math.pow(2, n / 12), dur, 'triangle', .05); }
  }, dur * 1000);
}
function mk(t, k) {
  if (k === 'k') { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + .18); }
  else { const s = AC.createBufferSource(); s.buffer = noiseBuf(.08); const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = k === 'h' ? 7000 : 1800; const g = AC.createGain(); g.gain.setValueAtTime(k === 'h' ? .08 : .2, t); g.gain.exponentialRampToValueAtTime(.001, t + .07); s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); }
}
function mn(t, f, d, type = 'sawtooth', v = .12) {
  const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 900;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(fl); fl.connect(g); g.connect(musicGain); o.start(t); o.stop(t + d + .02);
}
