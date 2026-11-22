/* player.js — contrôle du joueur à pied / en véhicule, caméra, lumière des phares */
import { THREE, G, scene, camera, clamp, lerp, adiff, PI, feed } from './core.js';
import { collide, insideBuilding } from './world.js';
import { I, firing, eatLook } from './input.js';
import { animHuman, makeHuman, setHeld } from './chars.js';
import { WEAP, ORDER, setKick, attack, startReload, owned, selectWeapon, respawn } from './combat.js';
import { enterVehicle, exitVehicle, pushOutOfVehicles } from './vehicles.js';
import { night } from './sky.js';

export const CAM = { yaw: 0, h: 2.6, pos: new THREE.Vector3(), look: new THREE.Vector3(), inited: false, shake: 0 };
G.camYaw = 0; G.freeLook = 0;
setKick(k => { CAM.yaw += (Math.random() - .5) * k * 2.2; G.shake = Math.max(G.shake || 0, Math.min(.5, k * 5)); });
const head = new THREE.SpotLight(0xfff1c8, 0, 70, .55, .6, 1.2); scene.add(head, head.target);

export function createPlayer(hero) {
  const P = { kind: 'player', x: 261, y: 0, z: 261, a: 0, hp: hero.hp, maxhp: hero.hp, r: .45, car: null, cd: 0, swing: 0, aim: 0, reload: 0, reloadT: 0, cur: 'pistol', inv: { fists: {}, pistol: { mag: 12, res: 48 } }, dead: 0, wt: 0, lean: 0, hero, model: null, weapon: 'fists', speedNow: 0, pose: null };
  P.model = makeHuman(hero.spec); scene.add(P.model.root); setHeld(P, 'pistol'); G.P = P; G.hero = hero; return P;
}

export function updPlayer(dt) {
  const P = G.P, k = I.keys; G.clk = (G.clk || 0) + dt; P.cd -= dt; P.lean = Math.max(0, P.lean - dt); const w = I.want;
  const look = eatLook(); const sens = I.touch && !I.locked ? .006 : .0042;
  if (!G.cine) { CAM.yaw -= look.dx * sens * (k.Aim ? .7 : 1); CAM.h = clamp(CAM.h + look.dy * .016, 1, 8); if (P.car && (Math.abs(look.dx) > 1 || k.Aim) && (I.locked || k.Aim)) G.freeLook = 1.8; }
  G.freeLook = Math.max(0, (G.freeLook || 0) - dt); P.bloom = Math.max(0, (P.bloom || 0) - dt * 1.6);
  CAM.yaw -= ((k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0)) * dt * 2.2 * (P.car && !(P.car.kind === 'tank') ? 0 : 1);
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); animHuman(P, dt, 0); P.model.root.position.set(P.x, P.model.root.position.y, P.z); return; }
  if (G.cine) { w.enter = w.reload = false; w.cycle = 0; w.sel = -1; P.model.root.position.set(P.x, 0, P.z); P.model.root.rotation.y = P.a; animHuman(P, dt, 0); return; }
  if (w.enter) { w.enter = false; if (!(G.hooks.shop && G.hooks.shop())) { if (P.car) exitVehicle(); else enterVehicle(); } }
  if (G.shopOpen) { w.reload = false; w.cycle = 0; P.model.root.position.set(P.x, 0, P.z); animHuman(P, dt, 0); return; }
  if (w.reload) { w.reload = false; startReload(); }
  if (w.cycle) { const o = owned(), i = o.indexOf(P.cur); selectWeapon(o[(i + w.cycle + o.length) % o.length]); w.cycle = 0; }
  if (w.sel >= 0) { selectWeapon(ORDER[w.sel]); w.sel = -1; }
  if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { const wp = WEAP[P.cur], inv = P.inv[P.cur]; if (inv) { const n = Math.min(wp.mag - inv.mag, inv.res); inv.mag += n; inv.res -= n; } } }
  if (P.car) { P.x = P.car.x; P.z = P.car.z; P.y = P.car.y || 0; P.a = P.car.a; P.speedNow = Math.abs(P.car.sp); if (firing() && ['car', 'moto', 'boat'].includes(P.car.kind)) { const wp = WEAP[P.cur]; if (!wp.melee && (wp.auto || P.cd <= 0)) { const a0 = P.a; attack(); P.a = a0; } } P.aimK = 0; return; }
  let ix = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + I.joy.x, iy = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0) + I.joy.y; const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
  const fx = Math.sin(CAM.yaw), fz = Math.cos(CAM.yaw), rx = -Math.cos(CAM.yaw), rz = Math.sin(CAM.yaw);
  const mx = fx * -iy + rx * ix, mz = fz * -iy + rz * ix, sprint = k.ShiftLeft || k.ShiftRight || I.btn.sprint;
  /* analogique : zone morte, courbe douce, sprint auto quand le stick est poussé à fond */
  let am = 1; if (I.touch && (I.joy.x || I.joy.y)) { const jm = Math.hypot(I.joy.x, I.joy.y); am = jm < .12 ? 0 : clamp((jm - .12) / .8, 0, 1); am = .25 + .75 * am * am * (3 - 2 * am) ; if (jm < .12) am = 0; if (jm > .96) am = 1.35; }
  if (Math.abs(look.dx) + Math.abs(look.dy) > 1) G.lastLook = G.clk;
  /* caméra qui suit le déplacement quand on n'oriente plus la vue (joystick) */
  if (I.touch && m > .2 && !k.Aim && !firing() && G.clk - (G.lastLook || -9) > .7) { const tgt = Math.atan2(mx, mz); CAM.yaw += adiff(tgt, CAM.yaw) * clamp(dt * 1.1 * Math.min(1, m), 0, .1); }
  const aimHold = !!k.Aim, spd = 6.3 * P.hero.speed * am * (sprint && !aimHold ? 1.75 : 1) * (aimHold ? .72 : P.aim > 0 ? .9 : 1) * (G.speedMul || 1);
  const kv = 1 - Math.exp(-14 * dt); P.vx = (P.vx || 0) + (mx * spd - (P.vx || 0)) * kv; P.vz = (P.vz || 0) + (mz * spd - (P.vz || 0)) * kv; P.speedNow = Math.hypot(P.vx, P.vz);
  P.x += P.vx * dt; P.z += P.vz * dt; collide(P, .45); pushOutOfVehicles(P, .45); collide(P, .45);
  P.aimK = lerp(P.aimK || 0, (aimHold || (P.aim > 0 && !I.touch)) ? 1 : 0, clamp(dt * 9, 0, 1));
  if (!I.touch && (aimHold || P.aim > 0 || firing())) P.a += adiff(CAM.yaw, P.a) * clamp(dt * 20, 0, 1); else if (m > .15) P.a += adiff(Math.atan2(mx, mz), P.a) * clamp(dt * 14, 0, 1);
  if (k.Space || firing()) { const wp = WEAP[P.cur]; if (wp.melee || wp.auto || P.cd <= 0) attack(); }
  P.model.root.position.set(P.x, 0, P.z); P.model.root.rotation.y = P.a; animHuman(P, dt, P.speedNow);
}

/* ---------- caméra ---------- */
const VIEW = { car: [11, 4.4], moto: [8, 3.4], boat: [14, 5], tank: [15, 6.2], heli: [19, 7], plane: [24, 6.5] };
export function updCamera(dt) {
  const P = G.P; let fov = 62;
  if (G.cine && G.cineCam) {
    const c = G.cineCam; CAM.pos.set(c.x, c.y, c.z); camera.position.copy(CAM.pos); camera.lookAt(c.lx, c.ly, c.lz); if (Math.abs(camera.fov - (c.fov || 55)) > .05) { camera.fov = c.fov || 55; camera.updateProjectionMatrix(); } head.intensity = 0; CAM.inited = true; return;
  }
  const v = P.car;
  if (v) { // la caméra suit le cap du véhicule (sauf char : visée libre)
    if (v.kind !== 'tank' && !(G.freeLook > 0)) { const sp = Math.abs(v.sp); CAM.yaw += adiff(v.a + PI * 0, CAM.yaw) * clamp(dt * (sp > 1 ? 2.4 : .5), 0, 1); }
    G.camYaw = CAM.yaw;
  } else G.camYaw = CAM.yaw;
  let dist, height;
  if (v) { const vw = VIEW[v.kind]; dist = vw[0] + (v.kind === 'plane' || v.kind === 'heli' ? 0 : Math.min(4, Math.abs(v.sp) * .12)); height = vw[1] + (v.kind === 'tank' ? (CAM.h - 2.6) * .5 : 0); }
  else { const ak = P.aimK || 0; dist = lerp(G.interior ? 3.8 : 6.5, 4.8, ak); height = lerp(G.interior ? 2.2 : CAM.h, 3.1, ak); }
  const baseY = v ? (v.y || 0) + (v.kind === 'heli' || v.kind === 'plane' ? 2 : 1.5) : 1.6;
  let t = 1, cx = P.x, cz = P.z;
  if (!v || v.kind === 'car' || v.kind === 'moto') for (; t > .2; t -= .1) { cx = P.x - Math.sin(CAM.yaw) * dist * t; cz = P.z - Math.cos(CAM.yaw) * dist * t; if (!insideBuilding(cx, cz)) break; }
  else { cx = P.x - Math.sin(CAM.yaw) * dist; cz = P.z - Math.cos(CAM.yaw) * dist; }
  const ak = v ? 0 : (P.aimK || 0), sh = .95 * ak; cx += -Math.cos(CAM.yaw) * sh; cz += Math.sin(CAM.yaw) * sh;
  const want = new THREE.Vector3(cx, baseY + height * (.55 + .45 * t), cz);
  if (v && v.kind === 'plane') want.y += Math.max(0, -Math.sin(v.pitch) * -6);
  if (G.interior) { const R = G.interior; want.x = clamp(want.x, R.minX + .3, R.maxX - .3); want.z = clamp(want.z, R.minZ + .3, R.maxZ - .3); want.y = Math.min(want.y, 3.5); }
  if (!CAM.inited) { CAM.pos.copy(want); CAM.inited = true; } CAM.pos.lerp(want, 1 - Math.exp(-(v && (v.kind === 'plane' || v.kind === 'heli') ? 8 : 14) * dt));
  camera.position.copy(CAM.pos);
  if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt * 2.4); camera.position.x += (Math.random() - .5) * G.shake * .7; camera.position.y += (Math.random() - .5) * G.shake * .7; }
  const ly = v ? (v.y || 0) + (v.kind === 'plane' || v.kind === 'heli' ? 1 : 1.2) : 1.7; const la = 2.5 + ak * 7; camera.lookAt(P.x + Math.sin(CAM.yaw) * la - Math.cos(CAM.yaw) * sh * .6, ly - ak * .5, P.z + Math.cos(CAM.yaw) * la + Math.sin(CAM.yaw) * sh * .6);
  fov = 62 + (v ? Math.min(14, Math.abs(v.sp) * (v.kind === 'plane' ? .12 : .5)) : 0) + (P.aimK || 0) * -12 + (v && v.kind === 'plane' ? 8 : 0);
  if (Math.abs(camera.fov - fov) > .1) { camera.fov = lerp(camera.fov, fov, clamp(dt * 4, 0, 1)); camera.updateProjectionMatrix(); }
  // phares
  if (v && night > .25 && (v.kind === 'car' || v.kind === 'moto' || v.kind === 'boat')) { head.intensity = 70 * night; head.position.set(v.x + Math.sin(v.a) * 2.4, 1.1, v.z + Math.cos(v.a) * 2.4); head.target.position.set(v.x + Math.sin(v.a) * 22, 0, v.z + Math.cos(v.a) * 22); } else head.intensity = 0;
}
