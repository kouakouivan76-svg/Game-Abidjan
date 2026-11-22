/* ai.js — piétons, gangs, police, circulation, vie ambiante (bateaux, avions) */
import { G, scene, clamp, lerp, rand, irand, pick, adiff, PI, WORLD, ROAD, BLOCK, N, feed } from './core.js';
import { collide, segBuildingT, sidewalkPoint, lanePoint, distAt, POI, bmap } from './world.js';
import { makeHuman, setHeld, animHuman, civSpec, gangSpec, COP_SPEC, SWAT_SPEC } from './chars.js';
import { WEAP, hurtP, heat, stars } from './combat.js';
import { tracer } from './fx.js';
import { sfx } from './audio.js';
import { spawnVehicle, removeVehicle, VT, pushOutOfVehicles } from './vehicles.js';

let HID = 0;
export function spawnHuman(kind, sub, x, z, o = {}) {
  const model = makeHuman(o.spec); scene.add(model.root);
  const hp = o.hp || (kind === 'ped' ? 40 : kind === 'cop' ? (sub === 'swat' ? 130 : 70) : (sub === 'chef' ? 140 : sub === 'bruiser' ? 95 : 75));
  const h = { kind, sub, gang: o.gang, x, z, a: o.a ?? rand(0, 6.28), hp, maxhp: hp, r: .45, model, weapon: 'fists', cd: rand(.3, 1.2), dead: 0, flee: 0, wt: 0, aim: 0, swing: 0, lean: 0, tm: 0, wa: rand(0, 6.28), dir: Math.random() < .5 ? 1 : -1, keep: !!o.keep, client: !!o.client, ally: !!o.ally, hold: !!o.hold, agg: false, remove: false, name: o.name, pose: o.pose || (kind === 'ped' && Math.random() < .25 ? pick(['talk', 'phone']) : null), acc: o.acc || 1, idle: false, tag: o.tag, id: ++HID, hid: rand(.3, 1.5), pk: 0, aimT: 0, seenT: 0, retreat: 0, cover: null, coverT: 0 }; h.flank = ((h.id % 3) - 1) * .9;
  if (h.pose) { h.idle = true; h.tm = rand(6, 14); }
  setHeld(h, o.weapon || 'fists'); G.humans.push(h); return h;
}
export function removeHuman(h) { scene.remove(h.model.root); const i = G.humans.indexOf(h); if (i >= 0) G.humans.splice(i, 1); }


/* ---------- intelligence : couverts, contournement, regroupement ---------- */
function findCover(h, tx, tz) {
  const gx = clamp(Math.floor(h.x / BLOCK), 0, N - 1), gz = clamp(Math.floor(h.z / BLOCK), 0, N - 1); let best = null, bd = 1e9;
  for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) for (const b of bmap[i + ',' + j] || []) {
    if (b.h < 1.6) continue; const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, hx = (b.x1 - b.x0) / 2, hz = (b.z1 - b.z0) / 2;
    let dx = cx - tx, dz = cz - tz; const dd = Math.hypot(dx, dz) || 1; dx /= dd; dz /= dd;
    const t = Math.min(Math.abs(dx) > 1e-3 ? hx / Math.abs(dx) : 1e9, Math.abs(dz) > 1e-3 ? hz / Math.abs(dz) : 1e9), px = cx + dx * (t + 1.2), pz = cz + dz * (t + 1.2);
    const dh = Math.hypot(px - h.x, pz - h.z); if (dh > 24 || dh >= bd || Math.hypot(px - tx, pz - tz) < 7) continue;
    const vx = px - tx, vz = pz - tz, vd = Math.hypot(vx, vz); if (segBuildingT(tx, tz, vx / vd, vz / vd, vd, 1.4) >= vd) continue;
    bd = dh; best = { x: px, z: pz };
  }
  return best;
}
function steer(h, mx, mz, probe = 2.6) {
  if (segBuildingT(h.x, h.z, mx, mz, probe, .5) >= probe) return [mx, mz];
  for (const a0 of [.7, -.7, 1.4, -1.4, 2.2]) { const a = a0 * h.dir, c = Math.cos(a), s = Math.sin(a), nx = mx * c - mz * s, nz = mx * s + mz * c; if (segBuildingT(h.x, h.z, nx, nz, probe, .5) >= probe) return [nx, nz]; }
  return [mx, mz];
}
function callBackup(h) {
  if (h.kind !== 'gang') return;
  for (const o of G.humans) if (o !== h && o.kind === 'gang' && o.gang === h.gang && o.dead <= 0 && !o.agg && Math.hypot(o.x - h.x, o.z - h.z) < 55) { o.agg = true; o.alert = true; o.hid = rand(.2, 1); }
  if ((G.reinfT || 0) <= 0 && !G.noGangs && cnt('gang') < 9 && Math.random() < .45) {
    G.reinfT = 35; const P = G.P, p = sidewalkPoint(P.x, P.z, 55, 90);
    if (p) { const role = Math.random() < .6 ? 'tireur' : 'bruiser'; const e = spawnHuman('gang', role, p.x, p.z, { spec: gangSpec(h.gang, role), weapon: role === 'tireur' ? 'pistol' : 'bat', gang: h.gang }); e.agg = true; e.alert = true; feed('Renforts de ' + h.gang + ' en route !', '#f87171'); }
  }
}
/* tireur / policier : couvert, apparitions, flanc, retraite, précision progressive */
function ranged(h, dt, P, dx, dz, d, w) {
  const los = segBuildingT(h.x, h.z, dx / d, dz / d, d, 1.4) >= d, run = h.kind === 'cop' ? 5.2 : 4.3, want = h.sub === 'chef' ? 11 : h.sub === 'swat' ? 8.5 : 13;
  let mx = 0, mz = 0, sp = 0, canShoot = los;
  h.seenT = los ? 0 : h.seenT + dt; h.aimT = los ? h.aimT + dt : 0;
  if (h.kind === 'cop') { if (los && d < 90) G.lastSeen = { x: P.x, z: P.z, t: G.clk || 0 }; }
  if (h.kind === 'gang' && h.hp < h.maxhp * .3 && h.sub !== 'chef' && h.retreat <= 0 && !h.fled) { h.retreat = 7; h.fled = true; }
  if (h.retreat > 0) { h.retreat -= dt; [mx, mz] = steer(h, -dx / d, -dz / d); return { mx, mz, sp: run, face: null, shoot: false }; }
  // cible de déplacement : le joueur s'il est perçu, sinon sa dernière position connue (police)
  let tx = P.x, tz = P.z, tdx = dx, tdz = dz, td = d;
  if (h.kind === 'cop' && !los && d > 45 && G.lastSeen) { tx = G.lastSeen.x; tz = G.lastSeen.z; tdx = tx - h.x; tdz = tz - h.z; td = Math.hypot(tdx, tdz) || 1; if (td < 7) { h.tm -= dt; if (h.tm <= 0) { h.tm = rand(1.5, 3); h.wa = rand(0, 6.28); } mx = Math.sin(h.wa); mz = Math.cos(h.wa); [mx, mz] = steer(h, mx, mz); return { mx, mz, sp: 2.2, face: null, shoot: false }; } }
  // couvert
  if ((h.coverT -= dt) <= 0) { h.coverT = rand(3, 5); h.cover = d > 8 && h.sub !== 'swat' ? findCover(h, P.x, P.z) : null; }
  let hiding = false;
  if (h.cover) {
    h.pk -= dt; h.hid -= dt;
    if (h.pk > 0) { /* phase d'apparition : combat à découvert */ }
    else { hiding = true; if (h.hid <= 0) { h.pk = rand(1.3, 2.3); h.hid = rand(1.8, 3.2); hiding = false; } }
  }
  if (hiding) {
    const cx = h.cover.x - h.x, cz = h.cover.z - h.z, cd = Math.hypot(cx, cz);
    if (cd > 1) { [mx, mz] = steer(h, cx / cd, cz / cd); sp = run; } else sp = 0; canShoot = false;
  } else if (td > want + 3 || (h.kind === 'cop' && tx !== P.x)) {
    // approche par un côté différent pour chaque membre du groupe
    const base = Math.atan2(h.x - tx, h.z - tz) + h.flank * clamp((td - want) / 25, 0, 1), px = tx + Math.sin(base) * want, pz = tz + Math.cos(base) * want, ddx = px - h.x, ddz = pz - h.z, dd = Math.hypot(ddx, ddz) || 1;
    [mx, mz] = steer(h, ddx / dd, ddz / dd); sp = run * (h.kind === 'cop' ? 1 : .9);
  } else if (td < want - 4) { [mx, mz] = steer(h, -tdx / td, -tdz / td); sp = 2.8; }
  else { mx = -dz / d * h.dir; mz = dx / d * h.dir; [mx, mz] = steer(h, mx, mz); sp = 1.9; if (Math.random() < dt * .25) h.dir = -h.dir; }
  return { mx, mz, sp, face: Math.atan2(dx, dz), shoot: canShoot };
}

export function updHuman(h, dt) {
  const P = G.P;
  if (h.dead > 0) { h.dead += dt; animHuman(h, dt, 0); h.model.root.position.x = h.x; h.model.root.position.z = h.z; if (h.dead > 8) h.remove = true; return; }
  if (h.client || h.ally) { animHuman(h, dt, 0); h.model.root.position.set(h.x, 0, h.z); h.model.root.rotation.y = h.a; return; }
  if (h.stunned > 0) h.stunned -= dt; h.cd -= dt;
  const dx = P.x - h.x, dz = P.z - h.z, d = Math.hypot(dx, dz) || 1; let mx = 0, mz = 0, sp = 0, face = null;
  if (h.kind === 'gang' && !h.agg && G.noise.t < 1.2 && Math.hypot(h.x - G.noise.x, h.z - G.noise.z) < 45) h.alert = true;
  if (G.noise.t < 1.2 && h.kind === 'ped' && Math.hypot(h.x - G.noise.x, h.z - G.noise.z) < 38 && h.flee <= 0) { h.flee = 5; h.fx = G.noise.x; h.fz = G.noise.z; h.pose = null; h.idle = false; }
  if (h.kind === 'ped' && h.flee <= 0 && !h.client) {
    // le joueur brandit une arme : les civils proches prennent peur ; ils s'écartent d'une voiture lancée vers eux
    if (!P.car && d < 15 && P.cur && !WEAP[P.cur].melee && (G.clk || 0) > 2 && segBuildingT(h.x, h.z, dx / d, dz / d, d, 1.4) >= d) { h.flee = rand(3, 5); h.fx = P.x; h.fz = P.z; h.pose = null; h.idle = false; h.scared = true; }
    else for (const c of G.cars) { if (c.remote || c.kind === 'boat' || c.kind === 'plane' || c.kind === 'heli' || Math.abs(c.sp) < 7) continue; const vx = h.x - c.x, vz = h.z - c.z, vd = Math.hypot(vx, vz); if (vd > 16 || vd < .5) continue; if ((vx * Math.sin(c.a) + vz * Math.cos(c.a)) / vd * Math.sign(c.sp) > .75) { const side = (vx * Math.cos(c.a) - vz * Math.sin(c.a)) >= 0 ? 1 : -1; h.dodge = .8; h.dx = Math.cos(c.a) * side; h.dz = -Math.sin(c.a) * side; h.pose = null; h.idle = false; break; } }
  }
  if (h.kind === 'ped' && h.dodge > 0) { h.dodge -= dt; mx = h.dx; mz = h.dz; sp = 5.8; }
  else if (h.kind === 'ped') {
    if (h.flee > 0) { h.flee -= dt; if (h.flee <= 0 && h.scared && d < 22 && Math.random() < .5) { h.pose = 'handsup'; h.idle = true; h.tm = rand(2.5, 4.5); } if (h.flee <= 0) h.scared = false; const fx = h.x - (h.fx != null ? h.fx : P.x), fz = h.z - (h.fz != null ? h.fz : P.z), fd = Math.hypot(fx, fz) || 1; mx = fx / fd; mz = fz / fd; sp = 5.2; h.pose = 'handsup' === h.pose ? null : h.pose; }
    else { h.tm -= dt; if (h.tm <= 0) { h.tm = rand(3, 8); if (h.pose && Math.random() < .5) { h.idle = true; } else { h.wa = Math.random() < .3 ? h.wa + rand(-1, 1) : rand(0, 6.28); h.idle = Math.random() < .25; if (!h.idle) h.pose = null; } } if (!h.idle) { mx = Math.sin(h.wa); mz = Math.cos(h.wa); sp = 1.5; } }
  } else {
    const w = WEAP[h.weapon], active = h.kind === 'gang' ? (h.agg || h.alert ? 75 : 26) : (G.wanted > 0 ? 200 : 0), leaving = h.kind === 'cop' && G.wanted <= 0;
    if (leaving) { mx = -dx / d; mz = -dz / d; sp = 3; if (d > 70) h.remove = true; }
    else if (P.dead > 0 || G.cine || d > active) { if (h.hold) { sp = 0; } else { h.tm -= dt; if (h.tm <= 0) { h.tm = rand(2, 5); h.wa = rand(0, 6.28); h.idle = Math.random() < .4; } if (!h.idle) { mx = Math.sin(h.wa); mz = Math.cos(h.wa); sp = 1.3; } } }
    else {
      if (h.kind === 'gang' && !h.agg) { h.agg = true; callBackup(h); }
      face = Math.atan2(dx, dz);
      if (w.melee) {
        if (h.retreat > 0) { h.retreat -= dt; mx = -dx / d; mz = -dz / d; sp = 4.8; }
        else if (d > 1.5) { const base = Math.atan2(h.x - P.x, h.z - P.z) + h.flank * clamp((d - 3) / 18, 0, 1), px = P.x + Math.sin(base) * 1.2, pz = P.z + Math.cos(base) * 1.2, ddx = px - h.x, ddz = pz - h.z, dd = Math.hypot(ddx, ddz) || 1; [mx, mz] = steer(h, ddx / dd, ddz / dd); sp = 4.7; if (h.hp < h.maxhp * .3 && h.kind === 'gang' && !h.fled) { h.retreat = 6; h.fled = true; } }
        else if (h.cd <= 0 && !P.car) { h.cd = 1.1; h.swing = .28; hurtP(w.dmg * .5); sfx('hit'); }
      } else {
        const R = ranged(h, dt, P, dx, dz, d, w); mx = R.mx; mz = R.mz; sp = R.sp; if (R.face !== null) face = R.face; else face = null;
        if (R.shoot && h.cd <= 0 && d < 38 && h.aimT > .55 + h.hid * .2) {
          h.cd = w.rate * (h.sub === 'chef' || h.sub === 'swat' ? 2.4 : 3.6); h.aim = .5; sfx(w.snd || 'shot', .6);
          const ramp = .55 + .45 * Math.min(1, h.aimT / 2), mov = Math.hypot(P.vx || 0, P.vz || 0) > 4 ? .8 : 1, pr = clamp(.62 - d * .012, .1, .55) * ramp * mov * (P.car ? .6 : 1) * (h.acc || 1);
          const hit = Math.random() < pr;
          tracer(h.x + dx / d * .6, 1.4, h.z + dz / d * .6, hit ? P.x : P.x + rand(-2.5, 2.5), 1.3, hit ? P.z : P.z + rand(-2.5, 2.5));
          if (hit) hurtP(w.dmg * (h.kind === 'cop' ? .45 : .55) * (w.pel > 1 ? .35 : 1));
        }
      }
    }
  }
  if (face !== null) h.a += adiff(face, h.a) * clamp(dt * 10, 0, 1); else if (sp > 0) h.a += adiff(Math.atan2(mx, mz), h.a) * clamp(dt * 8, 0, 1);
  if (sp) { h.x += mx * sp * dt; h.z += mz * sp * dt; if (collide(h, .45) || pushOutOfVehicles(h, .45)) h.wa += 1.7; }
  for (const o of G.humans) if (o !== h && o.dead <= 0) { const ox = h.x - o.x, oz = h.z - o.z, od = Math.hypot(ox, oz); if (od > 0 && od < .8) { const k = (.8 - od) * .5; h.x += ox / od * k; h.z += oz / od * k; } }
  { const P = G.P; if (!P.car && !G.interior) { const ox = h.x - P.x, oz = h.z - P.z, od = Math.hypot(ox, oz); if (od > 0 && od < .85) { const k = (.85 - od) * .5; h.x += ox / od * k; h.z += oz / od * k; P.x -= ox / od * k; P.z -= oz / od * k; } } }
  h.model.root.position.set(h.x, 0, h.z); h.model.root.rotation.y = h.a; animHuman(h, dt, sp);
}

/* ---------- apparitions ---------- */
export function spawnTraffic() {
  const p = lanePoint(G.P.x, G.P.z, 70, 170); if (!p) return;
  const D = distAt(p.x, p.z); const type = D === 'yop' || D === 'adjame' ? pick(['gbaka', 'gbaka', 'taxi', 'pickup', 'sedan', 'moto', 'camion']) : D === 'marcory' ? pick(['woro', 'woro', 'taxi', 'sedan', 'bus', 'moto']) : pick(['sedan', 'suv', 'taxi', 'sedan', 'bus']);
  spawnVehicle(type, p.x, p.z, p.a, 'traffic');
}
const cnt = k => G.humans.reduce((n, h) => n + (h.kind === k && h.dead <= 0 && !h.keep ? 1 : 0), 0);
export function updSpawns() {
  const P = G.P, Dn = distAt(P.x, P.z), qf = G.qf; if (G.cine || P.dead > 0) return;
  if (cnt('ped') < Math.round(9 * qf)) { const p = sidewalkPoint(P.x, P.z, 30, 110); if (p) spawnHuman('ped', 'civil', p.x, p.z, { spec: civSpec() }); }
  if (!G.noGangs) {
    const gt = Math.round(({ yop: 5, adjame: 5, marcory: 4, port: 5, cocody: 1, plateau: 1, camp: 0, air: 1 }[Dn] ?? 2) * qf * (.8 + .2 * G.effDiff) * (G.gangMul ?? 1));
    if (cnt('gang') < gt) {
      const p = sidewalkPoint(P.x, P.z, 45, 100);
      if (p) { const g = Dn === 'yop' ? 'corbeaux' : Dn === 'adjame' ? 'lions' : Dn === 'marcory' || Dn === 'port' ? 'port' : pick(['corbeaux', 'lions', 'port']), r = Math.random(), role = r < .5 ? 'bruiser' : r < .9 ? 'tireur' : 'chef', wp = role === 'bruiser' ? 'bat' : role === 'tireur' ? 'pistol' : 'smg'; spawnHuman('gang', role, p.x, p.z, { spec: gangSpec(g, role), weapon: wp, gang: g }); }
    }
  }
  const s = stars(); G.starsN = s;
  if (s > 0) {
    const ct = Math.round([0, 2, 3, 4, 5, 6][s] * Math.max(.6, qf));
    if (cnt('cop') < ct) { const p = sidewalkPoint(P.x, P.z, 40, 70); if (p) { const sw = s >= 4 && Math.random() < .6; spawnHuman('cop', sw ? 'swat' : 'agent', p.x, p.z, { spec: sw ? SWAT_SPEC : COP_SPEC, weapon: sw ? 'smg' : 'pistol' }); } }
    const pc = G.cars.reduce((n, c) => n + (c.mode === 'police' ? 1 : 0), 0);
    if (s >= 2 && pc < Math.min(s - 1, 3)) { const p = lanePoint(P.x, P.z, 110, 170); if (p) spawnVehicle('police', p.x, p.z, p.a, 'police'); }
    if (s >= 4 && !G.cars.some(c => c.type === 'heli_police' && !c.wreck)) { const v = spawnVehicle('heli_police', P.x + 120, P.z + 60, 0, 'hostile', null, { y: 35 }); v.bob = rand(0, 6); v.rot = 1; v.pol = true; }
    if (s >= 3 && P.car && Math.abs(P.car.sp) > 8 && (G.roadT = (G.roadT || 0) - 1.1) <= 0) {
      G.roadT = 40; const v = P.car, hx = Math.sin(v.a), hz = Math.cos(v.a), tx = P.x + hx * 140, tz = P.z + hz * 140, alongZ = Math.abs(hz) > Math.abs(hx);
      const snap = c => Math.round((c - ROAD / 2) / BLOCK) * BLOCK + ROAD / 2, rx = alongZ ? snap(tx) : tx, rz = alongZ ? tz : snap(tz);
      if (rx > 20 && rx < WORLD - 20 && rz > 20 && rz < WORLD - 20) {
        const a0 = alongZ ? PI / 2 : 0;
        for (const o of [-2.8, 2.8]) { const c = spawnVehicle('police', rx + (alongZ ? o : 0), rz + (alongZ ? 0 : o), a0, 'parked'); c.expire = 70; c.pol = true; c.block = true; }
        for (const o of [-1.2, 1.2]) { const cp = spawnHuman('cop', 'agent', rx + (alongZ ? o : 0) - hx * 3, rz + (alongZ ? 0 : o) - hz * 3, { spec: COP_SPEC, weapon: 'pistol', hold: true }); cp.hid = .5; }
        feed('Barrage de police devant !', '#60a5fa');
      }
    }
  } else for (const c of G.cars) if (c.pol && c.mode === 'hostile') { c.mode = 'route'; c.route = [{ x: -300, z: P.z }]; c.cruiseY = 60; c.ri = 0; c.rSpeed = 30; c.expire = 12; }
  const tr = G.cars.reduce((n, c) => n + (c.mode === 'traffic' ? 1 : 0), 0); if (tr < Math.round(9 * qf)) spawnTraffic();
}
G.hooks.deployCops = v => { for (let i = 0; i < 2; i++) spawnHuman('cop', 'agent', v.x + Math.cos(v.a) * (i ? 2.4 : -2.4), v.z - Math.sin(v.a) * (i ? 2.4 : -2.4), { spec: COP_SPEC, weapon: 'pistol' }); };
G.hooks.driverFlees = c => { const d = spawnHuman('ped', 'driver', c.x + Math.cos(c.a) * 2.4, c.z - Math.sin(c.a) * 2.4, { spec: civSpec() }); d.flee = 8; };

/* ---------- vie ambiante ---------- */
let flightT = 25;
export function initAmbient() {
  const lag = [{ x: 60, z: -90 }, { x: 330, z: -60 }, { x: 560, z: -110 }, { x: 640, z: -220 }, { x: 330, z: -250 }, { x: 80, z: -200 }];
  for (let i = 0; i < 2; i++) { const route = lag.slice(i * 3).concat(lag.slice(0, i * 3)); const v = spawnVehicle(i ? 'pinasse' : 'ferry', route[0].x, route[0].z, PI / 2, 'route', null, { route, ri: 1, loop: true, rSpeed: i ? 6 : 5, ambient: true }); v.invuln = false; }
}
export function updAmbient(dt) {
  flightT -= dt; if (flightT <= 0) { flightT = rand(70, 130); const z = rand(80, 600); spawnVehicle(Math.random() < .45 ? 'jet' : 'avion', -450, z, PI / 2, 'fly', null, { y: 130, cruiseY: rand(110, 160), fsp: 58, ambient: true, fly: true }); }
  for (const v of G.cars) { if (v.mode === 'fly' && v.x > WORLD + 500) v.remove = true; if (v.expire != null) { v.expire -= dt; if (v.expire < 0) v.remove = true; } }
}
export function updateHumans(dt) {
  const P = G.P; G.reinfT = Math.max(0, (G.reinfT || 0) - dt); for (const h of G.humans) updHuman(h, dt);
  for (let i = G.humans.length - 1; i >= 0; i--) { const h = G.humans[i]; if (h.remove || (!h.keep && h.dead <= 0 && Math.hypot(h.x - P.x, h.z - P.z) > 190)) { scene.remove(h.model.root); G.humans.splice(i, 1); } }
}
