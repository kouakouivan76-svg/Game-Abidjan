/* cine.js — cinématiques en moteur : caméra scénarisée, acteurs 3D, dialogues sous-titrés */
import { THREE, G, scene, clamp, lerp, smooth, PI, adiff, DAYLEN } from './core.js';
import { resolve } from './world.js';
import { makeHuman, animHuman, setHeld, LOOKS, NPC } from './chars.js';
import { spawnVehicle, removeVehicle } from './vehicles.js';
import { say, banner, fade, letterbox, hideHUD, clearSubs } from './ui.js';
import { engine, music, sfx } from './audio.js';

export const CINES = {};
export const defineCine = (id, def) => { CINES[id] = def; };
let cur = null;
export const isCine = () => !!cur;
const fmt = s => (s || '').replace(/\{h\}/g, G.hero ? G.hero.name : 'Koffi');
function setHour(h) { G.time = ((((h / 24) - G.startHour) % 1) + 1) % 1 * DAYLEN; }

export function playCine(id, done) {
  const def = CINES[id]; if (!def) { console.warn('cinématique inconnue', id); done && done(); return; }
  const P = G.P; const total = def.shots.reduce((a, s) => a + s.d, 0);
  cur = { def, id, t: 0, i: -1, actors: {}, cars: [], done, total, ending: false, wasVisible: P.model.root.visible, base: def.at ? resolve(def.at) : { x: P.x, z: P.z } };
  G.cine = true; G.cineCam = null; hideHUD(true); letterbox(true); clearSubs(); engine(null); music(null);
  if (def.hour != null) setHour(def.hour);
  P.model.root.visible = false;
  for (const a of def.actors || []) {
    const spec = a.look === 'me' ? P.hero.spec : (NPC[a.look] || LOOKS[a.look]); if (!spec) throw new Error('acteur inconnu ' + a.look);
    const model = makeHuman(spec); scene.add(model.root); const b = a.at ? resolve(a.at) : cur.base, o = a.off || [0, 0];
    const h = { id: a.id, model, x: b.x + o[0], z: b.z + o[1], a: typeof a.face === 'number' ? a.face : 0, faceTo: typeof a.face === 'string' ? a.face : null, pose: a.pose || null, wt: 0, bt: Math.random() * 6, weapon: 'fists', dead: 0, aim: 0, swing: 0, lean: 0, spd: 0, dead2: false };
    setHeld(h, a.weapon || 'fists'); model.root.position.set(h.x, 0, h.z); model.root.rotation.y = h.a; cur.actors[a.id] = h;
  }
  for (const c of def.cars || []) { const b = c.at ? resolve(c.at) : cur.base, o = c.off || [0, 0]; const v = spawnVehicle(c.type, b.x + o[0], b.z + o[1], c.a || 0, 'parked', c.col, { cine: true, y: c.y || 0 }); v.invuln = true; cur.cars.push(v); if (c.fly) { v.rot = 1; } }
  fade(1, 0); setTimeout(() => fade(0, 600), 40);
}
function beginShot(sh) {
  const c = cur;
  if (sh.who && sh.line) say(sh.who, fmt(sh.line), Math.max(2.5, sh.d - .2));
  if (sh.title) banner(sh.title, sh.sub || '', sh.col || '#fff', Math.max(2, sh.d - .3));
  if (sh.fade === 'out') fade(1, Math.max(300, sh.d * 1000 * .8)); else if (sh.fade === 'in') { fade(1, 0); setTimeout(() => fade(0, 700), 30); }
  if (sh.sfx) sfx(sh.sfx);
  for (const id in c.actors) { c.actors[id].speaking = id === sh.speak; }
  if (sh.pose) for (const id in sh.pose) if (c.actors[id]) { c.actors[id].pose = sh.pose[id]; if (c.actors[id].pose === 'aim') c.actors[id].aim = 99; }
  if (sh.face) for (const id in sh.face) if (c.actors[id]) { const f = sh.face[id]; if (typeof f === 'number') { c.actors[id].faceTo = null; c.actors[id].a = f; } else c.actors[id].faceTo = f; }
  if (sh.move) for (const m of sh.move) { const a = c.actors[m.id]; if (!a) continue; const b = sh.at ? resolve(sh.at) : c.base; a.tx = b.x + m.to[0]; a.tz = b.z + m.to[1]; a.mspd = m.spd || 1.8; }
  if (sh.kill) { const a = c.actors[sh.kill]; if (a) a.dead = .01; }
}
export function updateCine(dt) {
  if (!cur) return; const c = cur; c.t += dt;
  let acc = 0, idx = -1, st = 0; for (let i = 0; i < c.def.shots.length; i++) { if (c.t < acc + c.def.shots[i].d) { idx = i; st = acc; break; } acc += c.def.shots[i].d; }
  if (idx < 0) { finish(); return; }
  const sh = c.def.shots[idx]; if (idx !== c.i) { c.i = idx; beginShot(sh); }
  const f = clamp((c.t - st) / sh.d, 0, 1), e = smooth(0, 1, f), b = sh.at ? resolve(sh.at) : c.base, p = sh.p, p2 = sh.p2 || sh.p, l = sh.l || [0, 1.6, 0], l2 = sh.l2 || l;
  G.cineCam = { x: b.x + lerp(p[0], p2[0], e), y: lerp(p[1], p2[1], e), z: b.z + lerp(p[2], p2[2], e), lx: b.x + lerp(l[0], l2[0], e), ly: lerp(l[1], l2[1], e), lz: b.z + lerp(l[2], l2[2], e), fov: lerp(sh.fov || 55, sh.fov2 || sh.fov || 55, e) };
  for (const id in c.actors) {
    const a = c.actors[id]; let sp = 0;
    if (a.tx != null) { const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz); if (d > .2) { sp = a.mspd; a.x += dx / d * sp * dt; a.z += dz / d * sp * dt; a.a += adiff(Math.atan2(dx, dz), a.a) * clamp(dt * 8, 0, 1); } else a.tx = null; }
    else if (a.faceTo) { let tx, tz; if (a.faceTo === 'cam') { tx = G.cineCam.x; tz = G.cineCam.z; } else if (c.actors[a.faceTo]) { tx = c.actors[a.faceTo].x; tz = c.actors[a.faceTo].z; } if (tx != null) a.a += adiff(Math.atan2(tx - a.x, tz - a.z), a.a) * clamp(dt * 5, 0, 1); }
    const savedPose = a.pose; if (a.speaking && !a.pose) a.pose = 'talk'; animHuman(a, dt, sp); a.pose = savedPose;
    a.model.root.position.x = a.x; a.model.root.position.z = a.z; a.model.root.rotation.y = a.a;
  }
}
export function skipCine() { if (cur && !cur.ending) cur.t = cur.total + .01; }
function finish() {
  const c = cur; if (!c || c.ending) return; c.ending = true; fade(1, 250);
  setTimeout(() => {
    for (const id in c.actors) scene.remove(c.actors[id].model.root); for (const v of c.cars) removeVehicle(v);
    const P = G.P; P.model.root.visible = !P.car; G.cine = false; G.cineCam = null; cur = null; letterbox(false); hideHUD(false); clearSubs();
    if (c.def.endHour != null) setHour(c.def.endHour);
    fade(0, 600); c.done && c.done();
  }, 280);
}
addEventListener('pointerdown', e => { if (cur && e.target && e.target.id === 'c') skipCine(); });
