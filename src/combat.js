/* combat.js — armes, tirs, projectiles, explosions, dégâts, chaleur, ramassables */
import { I } from './input.js';
import { THREE, G, scene, BOX, MB, M, pb, PI, clamp, lerp, rand, irand, pick, adiff, feed, N, WORLD } from './core.js';
import { collide, segBuildingT, airHit, sidewalkPoint, POI } from './world.js';
import { sfx } from './audio.js';
import { smoke, fire, sparks, boomFX, tracer, flash, debris } from './fx.js';
import { setHeld } from './chars.js';
import { damageVehicle } from './vehicles.js';

export const WEAP = {
  fists: { name: 'Poings', melee: true, dmg: 12, range: 1.9, rate: .38 },
  bat: { name: 'Batte', melee: true, dmg: 30, range: 2.6, rate: .65 },
  pistol: { name: 'Pistolet', dmg: 22, range: 45, rate: .34, mag: 12, spread: .02, pel: 1, snd: 'shot', kick: .012, bloom: .22 },
  smg: { name: 'Mitraillette', dmg: 11, range: 38, rate: .085, mag: 30, spread: .05, pel: 1, auto: true, snd: 'smg', kick: .007, bloom: .09 },
  shotgun: { name: 'Fusil à pompe', dmg: 11, range: 20, rate: .85, mag: 6, spread: .12, pel: 6, snd: 'shotgun', kick: .05, bloom: .5 },
  rpg: { name: 'Lance-roquettes', proj: true, dmg: 130, range: 120, rate: 1.5, mag: 1, spread: 0, pel: 1, snd: 'rocket', radius: 8, kick: .08, bloom: .6 }
};
export const ORDER = ['fists', 'bat', 'pistol', 'smg', 'shotgun', 'rpg'];
export const heat = x => { G.wanted = clamp(G.wanted + x, 0, 5); G.crimeT = 0; };
export const stars = () => G.wanted > .15 ? Math.min(5, Math.ceil(G.wanted)) : 0;
export const recalcDiff = () => { G.diff = clamp(.85 + G.kills * .015 - G.deaths * .15, .6, 1.5); };

/* ---------- dégâts ---------- */
export function hurtP(d, src) {
  const P = G.P; if (P.dead > 0 || G.cine || P.invuln) return;
  if (P.car && P.car.kind !== 'tank') { /* protégé en partie par la carrosserie */ d *= P.car.kind === 'moto' ? 1 : .55; }
  d *= G.effDiff; if (P.armor > 0) { const ab = Math.min(P.armor, d * .65); P.armor -= ab; d -= ab; }
  P.hp -= d; G.hurtT = .3; P.lean = .2; G.combatT = 0;
  if (P.hp <= 0) playerDie();
}
export function damage(h, dmg, src) {
  if (h.dead > 0 || h.invuln) return;
  h.hp -= dmg; h.lean = .2; const P = G.P;
  if (h.kind === 'ped') { h.flee = 6; h.fx = src.x; h.fz = src.z; if (src === P) heat(.25); }
  else if (h.kind === 'gang') h.agg = true;
  else if (h.kind === 'cop' && src === P) heat(.5);
  if (src === P) G.hitMark = .18;
  if (h.hp <= 0) killHuman(h, src);
}
export function killHuman(h, src) {
  if (h.dead > 0) return; h.dead = .01; h.model.sh.visible = false; const P = G.P;
  if (G.hooks.onKill) G.hooks.onKill(h, src);
  if (src !== P) return;
  G.kills++; recalcDiff();
  if (h.kind === 'gang') { const g = irand(30, 90); G.cash += g; feed('+$' + g, '#7dff9a'); if (Math.random() < .4 && h.weapon !== 'fists' && h.weapon !== 'bat') addPickup(h.x, h.z, h.weapon, true); else if (Math.random() < .35) addPickup(h.x, h.z, 'cash', true); }
  else if (h.kind === 'ped') { heat(.5); feed('Civil touché !', '#fca5a5'); }
  else if (h.kind === 'cop') { heat(1); feed('Policier à terre !', '#93c5fd'); if (h.weapon !== 'fists' && Math.random() < .5) addPickup(h.x, h.z, h.weapon, true); }
}
export function playerDie() {
  const P = G.P; if (P.dead > 0) return; P.hp = 0; P.armor = 0; P.dead = 3.2; G.deaths++; recalcDiff(); const fee = Math.floor(G.cash * .1); G.cash -= fee;
  if (P.car) G.hooks.exitVehicle && G.hooks.exitVehicle(true);
  feed('K.O. — Hôpital : -$' + fee, '#fca5a5'); if (G.hooks.onPlayerDie) G.hooks.onPlayerDie();
}
export function respawn() {
  const P = G.P, h = POI.hopital; P.hp = P.maxhp; P.dead = 0; P.x = h.x + 6; P.z = h.z + 6; P.a = 0; G.wanted = 0; P.model.root.rotation.set(0, 0, 0); P.model.root.position.y = 0; P.model.sh.visible = true; P.fallDir = null;
  for (const x of G.humans) if (x.kind === 'cop' && !x.keep) x.remove = true;
  if (G.hooks.onRespawn) G.hooks.onRespawn();
}

/* ---------- armes ---------- */
export const owned = () => ORDER.filter(k => G.P.inv[k]);
export function selectWeapon(k) { const P = G.P; if (!P.inv[k] || P.cur === k) return; P.cur = k; P.reload = 0; setHeld(P, k); }
export function giveWeapon(k, ammoMul = 2) { const P = G.P, w = WEAP[k]; if (!P.inv[k]) P.inv[k] = w.melee ? {} : { mag: w.mag, res: w.mag * ammoMul }; else if (!w.melee) P.inv[k].res += w.mag * ammoMul; }
export function startReload() { const P = G.P, w = WEAP[P.cur]; if (w.melee || P.reload > 0) return; const inv = P.inv[P.cur]; if (inv.mag >= w.mag || inv.res <= 0) return; P.reload = P.cur === 'rpg' ? 2 : 1.3; P.reloadT = P.reload; feed('Rechargement…', '#cbd5e1'); }
export function bestTarget(range, cone, ref, ox, oz) {
  const P = G.P; let best = null, bs = 1e9; if (ref == null) ref = P.a; const X = ox ?? P.x, Z = oz ?? P.z;
  for (const h of G.humans) {
    if (h.dead > 0 || h.client || h.ally) continue; const dx = h.x - X, dz = h.z - Z, d = Math.hypot(dx, dz); if (d > range || d < .1) continue;
    const ad = Math.abs(adiff(Math.atan2(dx, dz), ref)); if (ad > cone) continue; if (segBuildingT(X, Z, dx / d, dz / d, d, 1.4) < d) continue;
    const hostile = h.kind === 'gang' || (h.kind === 'cop' && G.wanted > 0); const s = ad * 8 + d * .1 - (hostile ? 3 : 0); if (s < bs) { bs = s; best = h; }
  }
  return best;
}
export function hitscan(ox, oz, dx, dz, range, shooter, oy) {
  const occ = segBuildingT(ox, oz, dx, dz, range, oy || 1.4); let bt = Math.min(range, occ), best = null, kind = null;
  for (const h of G.humans.concat([G.P])) {
    if (h === shooter || h.dead > 0 || (h === G.P && (G.P.dead > 0 || G.P.car)) || h.client || (shooter === G.P && h.ally)) continue;
    const px = h.x - ox, pz = h.z - oz, t = px * dx + pz * dz; if (t < 0 || t > bt) continue; if (Math.abs(px * dz - pz * dx) < h.r + .18) { best = h; bt = t; kind = 'human'; }
  }
  for (const v of G.cars) {
    if (v.wreck || v === G.P.car || v.y > 6 || v.remote) continue; const px = v.x - ox, pz = v.z - oz, t = px * dx + pz * dz; if (t < 0 || t > bt) continue;
    if (Math.abs(px * dz - pz * dx) < v.r * .75) { best = v; bt = t; kind = 'veh'; }
  }
  if (shooter === G.P) for (const rp of G.remote) { const px = rp.x - ox, pz = rp.z - oz, t = px * dx + pz * dz; if (t < 0 || t > bt) continue; if (Math.abs(px * dz - pz * dx) < .7) { best = rp; bt = t; kind = 'remote'; } }
  tracer(ox, oy || 1.4, oz, ox + dx * bt, oy || 1.4, oz + dz * bt);
  return best ? { obj: best, kind, t: bt } : { obj: null, t: bt, x: ox + dx * bt, z: oz + dz * bt };
}
let kickFn = () => {}; export const setKick = f => { kickFn = f; }; const CAM_KICK = k => kickFn(k);
export function attack() {
  const P = G.P; if (P.cd > 0 || P.dead > 0 || P.reload > 0 || G.cine) return;
  const w = WEAP[P.cur], hero = P.hero, inCar = !!P.car;
  if (inCar && (w.melee || !['car', 'moto', 'boat'].includes(P.car.kind))) { if (w.melee && P.cd <= 0) { feed('Prends une arme à feu pour tirer en conduisant', '#fca5a5'); P.cd = 1; } return; }
  if (w.melee) {
    const t = bestTarget(3.6, 1.4); if (t) P.a = Math.atan2(t.x - P.x, t.z - P.z);
    P.cd = w.rate; P.swing = .28; let any = false;
    for (const h of G.humans) {
      if (h.dead > 0 || h.client || h.ally) continue; const dx = h.x - P.x, dz = h.z - P.z, d = Math.hypot(dx, dz);
      if (d < w.range + .45 && Math.abs(adiff(Math.atan2(dx, dz), P.a)) < 1.0) { any = true; damage(h, w.dmg * hero.dmg, P); h.x += dx / (d || 1) * .5; h.z += dz / (d || 1) * .5; sparks(h.x, 1.3, h.z, 3, '#ffffff'); }
    }
    for (const rp of G.remote) { const d = Math.hypot(rp.x - P.x, rp.z - P.z); if (d < w.range + .6 && Math.abs(adiff(Math.atan2(rp.x - P.x, rp.z - P.z), P.a)) < 1) { any = true; G.hooks.onRemoteHit && G.hooks.onRemoteHit(rp, w.dmg * hero.dmg); } }
    sfx(any ? 'hit' : 'swing'); return;
  }
  const inv = P.inv[P.cur];
  if (inv.mag <= 0) { startReload(); if (inv.res <= 0) { P.cd = .4; feed('Plus de munitions !', '#fca5a5'); } return; }
  inv.mag--; P.cd = w.rate; P.aim = .6;
  // visée : clavier-souris = direction de la caméra (+ léger aimant sur l'ennemi dans le viseur) ; tactile = visée assistée
  const free = !I.touch || I.locked, camA = G.camYaw ?? P.a, aimHold = I.keys.Aim; let ang, tg;
  if (free) { tg = bestTarget(w.range, aimHold ? .13 : .07, camA); ang = tg ? camA + adiff(Math.atan2(tg.x - P.x, tg.z - P.z), camA) * (aimHold ? .85 : .55) : camA; if (!inCar) P.a = ang; }
  else { tg = bestTarget(w.range, inCar ? 3.2 : .8, inCar ? P.car.a : P.a); ang = tg ? Math.atan2(tg.x - P.x, tg.z - P.z) : (inCar ? P.car.a : P.a); if (!inCar) P.a = ang; }
  P.bloom = Math.min(1, (P.bloom || 0) + (w.bloom || .1)); const spreadK = (1 + P.bloom * 1.8) * (aimHold ? .5 : 1) * (inCar ? 1.9 : 1) * (P.speedNow > 2 && !inCar ? 1.25 : 1);
  if (free) { CAM_KICK(w.kick || .01); }
  const mx = P.x + Math.sin(ang) * (inCar ? 1.6 : .7), mz = P.z + Math.cos(ang) * (inCar ? 1.6 : .7); flash(mx, inCar ? 1.3 : 1.5, mz, '#ffd27a', 6, .06); sparks(mx, 1.4, mz, 2);
  if (w.proj) { fireProjectile({ x: mx, y: 1.5, z: mz, dx: Math.sin(ang), dy: .02, dz: Math.cos(ang), speed: 48, kind: 'rocket', owner: P, radius: w.radius, dmg: w.dmg, life: 4 }); }
  else for (let i = 0; i < w.pel; i++) {
    const a2 = ang + rand(-1, 1) * w.spread * spreadK / hero.acc, dx = Math.sin(a2), dz = Math.cos(a2), r = hitscan(P.x + dx * .6, P.z + dz * .6, dx, dz, w.range, P, 1.4);
    if (r.obj) { if (r.kind === 'human') damage(r.obj, w.dmg * hero.dmg, P); else if (r.kind === 'veh') { damageVehicle(r.obj, w.dmg * .6, P); sparks(r.obj.x, 1, r.obj.z, 4); } else if (r.kind === 'remote') G.hooks.onRemoteHit && G.hooks.onRemoteHit(r.obj, w.dmg * hero.dmg); }
    else sparks(r.x, 1, r.z, 2, '#d9d4c0');
  }
  sfx(w.snd); G.noise.x = P.x; G.noise.z = P.z; G.noise.t = 0; G.combatT = 0;
  if (G.hooks.onShoot) G.hooks.onShoot(P.x, P.z, ang);
  if (inv.mag <= 0 && inv.res > 0) startReload();
}

/* ---------- projectiles & explosions ---------- */
export function fireProjectile(o) {
  let mesh;
  if (o.kind === 'shell') { mesh = new THREE.Mesh(BOX, MB('#222222')); mesh.scale.set(.25, .25, .8); }
  else { mesh = new THREE.Group(); pb(mesh, .2, .2, .9, MB('#4b5320'), 0, 0, 0); pb(mesh, .26, .26, .2, MB('#ef4444'), 0, 0, .5); }
  mesh.position.set(o.x, o.y, o.z); mesh.lookAt(o.x + o.dx, o.y + o.dy, o.z + o.dz); scene.add(mesh);
  G.proj.push({ ...o, vx: o.dx * o.speed, vy: o.dy * o.speed, vz: o.dz * o.speed, mesh, t: 0 }); sfx('rocket');
}
export function explosion(x, y, z, radius, dmg, src) {
  boomFX(x, y, z, radius); sfx('boom'); const P = G.P;
  G.shake = Math.max(G.shake || 0, clamp(1 - Math.hypot(P.x - x, P.z - z) / 70, 0, 1) * 1.2);
  for (const h of G.humans) {
    if (h.dead > 0) continue; const d = Math.hypot(h.x - x, h.z - z); if (d < radius) { damage(h, dmg * (1 - d / radius) + 8, src || {}); h.x += (h.x - x) / (d || 1) * 1.5; h.z += (h.z - z) / (d || 1) * 1.5; }
    else if (h.kind === 'ped' && d < radius * 4) { h.flee = 6; h.fx = x; h.fz = z; }
  }
  if (!P.car && P.dead <= 0) { const d = Math.hypot(P.x - x, P.z - z); if (d < radius) hurtP(dmg * (1 - d / radius) * .8 + 4); }
  for (const v of G.cars) { if (v.wreck || v.remote) continue; const d = Math.hypot(v.x - x, v.z - z); if (d < radius + v.r) damageVehicle(v, dmg * (1 - d / (radius + v.r)) * 1.3 + 8, src || {}); }
  if (src === P) heat(.3);
  G.hooks.onExplosion && G.hooks.onExplosion(x, y, z, radius, src);
}
export function splash(x, z, r, dmg, src) {
  for (const h of G.humans) { if (h.dead > 0) continue; if (Math.hypot(h.x - x, h.z - z) < r) damage(h, dmg, src || {}); }
  for (const v of G.cars) { if (v.wreck || v.remote || v.y > 4 || v === src) continue; if (Math.hypot(v.x - x, v.z - z) < r + v.r) damageVehicle(v, dmg * .7, src || {}); }
  const P = G.P; if (!P.car && P.dead <= 0 && Math.hypot(P.x - x, P.z - z) < r && src !== P) hurtP(dmg * .6);
  sparks(x, .3, z, 4); smoke(x, .3, z, 1, .5);
}
export function updProjectiles(dt) {
  for (let i = G.proj.length - 1; i >= 0; i--) {
    const p = G.proj[i]; p.t += dt; let boom = p.t > p.life;
    for (let s = 0; s < 3 && !boom; s++) {
      const h = dt / 3; p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
      if (p.y <= .2) boom = true; else if (airHit(p.x, p.y, p.z, .2)) boom = true;
      else {
        for (const v of G.cars) { if (v.wreck || v === p.owner || v === p.ownerVeh || v.remote) continue; if (Math.hypot(v.x - p.x, v.z - p.z) < v.r + .4 && Math.abs((v.y || 0) + 1.2 - p.y) < 3.2) { boom = true; break; } }
        if (!boom) for (const hm of G.humans) { if (hm.dead > 0 || hm === p.owner) continue; if (Math.hypot(hm.x - p.x, hm.z - p.z) < .8 && p.y < 2.3) { boom = true; break; } }
        if (!boom && p.owner !== G.P && !G.P.car && Math.hypot(G.P.x - p.x, G.P.z - p.z) < .8 && p.y < 2.3) boom = true;
        if (!boom && p.owner !== G.P && G.P.car && Math.hypot(G.P.car.x - p.x, G.P.car.z - p.z) < G.P.car.r + .4 && Math.abs((G.P.car.y || 0) + 1.2 - p.y) < 3.2) boom = true;
      }
      if (boom) break;
    }
    if (p.kind === 'rocket') smoke(p.x, p.y, p.z, 1, .45); else if (p.kind === 'shell') sparks(p.x, p.y, p.z, 1, '#fde68a');
    p.mesh.position.set(p.x, p.y, p.z);
    if (boom) { explosion(p.x, Math.max(.5, p.y), p.z, p.radius || 6, p.dmg || 100, p.owner || p.ownerVeh); scene.remove(p.mesh); G.proj.splice(i, 1); }
  }
}

/* ---------- ramassables ---------- */
const PK_COL = { pistol: '#c0c4ca', smg: '#f59e0b', shotgun: '#a16207', bat: '#d6a76b', rpg: '#65a30d', health: '#ef4444', cash: '#22c55e', ammo: '#38bdf8', armor: '#3b82f6' };
export function addPickup(x, z, type, tmp) { const m = new THREE.Mesh(BOX, MB(PK_COL[type] || '#fff')); m.scale.set(.7, .7, .7); m.position.set(x, 1, z); scene.add(m); G.pickups.push({ x, z, type, m, t: 0, tmp: !!tmp }); }
function collectPk(pk) {
  const P = G.P, t = pk.type;
  if (ORDER.includes(t)) { const w = WEAP[t]; if (!P.inv[t]) { giveWeapon(t); feed(w.name + ' récupéré(e)', '#ffd23a'); } else if (!w.melee) { P.inv[t].res += w.mag; feed('Munitions +' + w.mag, '#7dd3fc'); } }
  else if (t === 'health') { P.hp = Math.min(P.maxhp, P.hp + 40); feed('Soins +40', '#fca5a5'); }
  else if (t === 'cash') { const g = irand(40, 150); G.cash += g; feed('+$' + g, '#7dff9a'); }
  else if (t === 'ammo') { const w = WEAP[P.cur]; if (!w.melee && P.inv[P.cur]) { P.inv[P.cur].res += w.mag * 2; feed('Munitions +' + w.mag * 2, '#7dd3fc'); } else if (P.inv.pistol) { P.inv.pistol.res += 24; feed('Munitions pistolet +24', '#7dd3fc'); } }
  sfx('pickup'); if (pk.tmp) { scene.remove(pk.m); pk.dead = true; } else { pk.m.visible = false; pk.t = 45; }
}
export function initPickups() {
  const types = ['pistol', 'smg', 'shotgun', 'bat', 'health', 'cash', 'ammo', 'health', 'cash', 'ammo'];
  for (let i = 0; i < 44; i++) { const p = sidewalkPoint(8 + Math.random() * (WORLD - 16), 8 + Math.random() * (WORLD - 16), 0, 1); if (p) addPickup(p.x, p.z, types[i % types.length]); }
  addPickup(POI.camp_gate.x + 12, POI.camp_gate.z + 4, 'rpg'); addPickup(POI.planque.x + 4, POI.planque.z + 4, 'health');
}
export function updatePickups(dt) {
  const P = G.P;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i]; if (pk.dead) { G.pickups.splice(i, 1); continue; }
    if (pk.t > 0) { pk.t -= dt; if (pk.t <= 0) pk.m.visible = true; continue; }
    pk.m.rotation.y += dt * 2; pk.m.position.y = 1 + Math.sin(G.time * 3 + pk.x) * .15;
    if (!P.car && P.dead <= 0 && Math.hypot(pk.x - P.x, pk.z - P.z) < 1.8) collectPk(pk);
  }
}
