/* vehicles.js — voitures, moto, bus, camion, bateaux, hélicoptères, avion, char : modèles + physique + IA */
import { THREE, G, scene, nightFX, BOX, M, MB, MP, pb, blob, shadowAll, C, PI, clamp, lerp, rand, irand, pick, adiff, feed, WORLD, ZMAX, N, BLOCK } from './core.js';
import { vehicleGLB } from './models.js';
import { glowTexture, collide, collideBox, pushFromBox, collideBoat, airHit, POI, segBuildingT } from './world.js';
import { I, firing } from './input.js';
import { sfx } from './audio.js';
import { smoke, fire, sparks, dust, emit, tracer, debris } from './fx.js';
import { explosion, fireProjectile, hurtP, damage, heat, splash } from './combat.js';

/* ---------- table des véhicules ---------- */
export const VT = {
  taxi: { kind: 'car', name: 'Taxi communal', shape: 'sedan', cols: ['#e8452c'], stripe: '#f4f4f0', sign: true, acc: 11, max: 25, hp: 100, r: 1.7 },
  woro: { kind: 'car', name: 'Woro-woro', shape: 'sedan', cols: ['#1e88e5', '#43a047', '#fdd835', '#8e24aa'], stripe: '#ffffff', acc: 11, max: 25, hp: 100, r: 1.7 },
  sedan: { kind: 'car', name: 'Berline', shape: 'sedan', cols: ['#e5e7eb', '#9ca3af', '#1f2937', '#7f1d1d', '#1e3a8a', '#e6e1d3'], acc: 11.5, max: 27, hp: 100, r: 1.7 },
  suv: { kind: 'car', name: '4x4', shape: 'suv', cols: ['#1b1b20', '#e5e7eb', '#3d4a5c'], acc: 10, max: 26, hp: 130, r: 1.85 },
  gbaka: { kind: 'car', name: 'Gbaka', shape: 'gbaka', cols: ['#f4f4f0'], stripe: '#2a9d4a', acc: 7, max: 20, hp: 130, r: 2.05 },
  pickup: { kind: 'car', name: 'Pick-up', shape: 'pickup', cols: ['#3d7a3a', '#d9d9d9', '#b45309'], acc: 9, max: 23, hp: 130, r: 1.95 },
  police: { kind: 'car', name: 'Voiture de police', shape: 'sedan', cols: ['#f1f5f9'], stripe: '#1d4ed8', bar: true, cop: true, acc: 13, max: 31, hp: 110, r: 1.7 },
  camion: { kind: 'car', name: 'Camion', shape: 'truck', cols: ['#c2410c', '#1d4ed8', '#15803d'], acc: 6, max: 17, hp: 190, r: 2.6 },
  bus: { kind: 'car', name: 'Bus SOTRA', shape: 'bus', cols: ['#16a34a'], stripe: '#ffffff', acc: 5.5, max: 16, hp: 240, r: 3.3 },
  moto: { kind: 'moto', name: 'Moto-taxi', cols: ['#ef4444', '#f59e0b', '#2563eb'], acc: 15, max: 33, hp: 60, r: 1.0 },
  pinasse: { kind: 'boat', name: 'Pinasse', cols: ['#2a9d8f', '#e76f51', '#e9c46a'], acc: 5, max: 13, hp: 120, r: 2.6 },
  speedboat: { kind: 'boat', name: 'Hors-bord', cols: ['#f8fafc'], acc: 11, max: 29, hp: 110, r: 2.2 },
  ferry: { kind: 'boat', name: 'Bateau-bus', cols: ['#f8fafc'], acc: 3, max: 9, hp: 320, r: 5.5 },
  patrol: { kind: 'boat', name: 'Patrouilleur', cols: ['#e2e8f0'], cop: true, acc: 10, max: 25, hp: 190, r: 2.6 },
  heli: { kind: 'heli', name: 'Hélicoptère', cols: ['#e5e7eb'], max: 28, hp: 170, r: 3 },
  heli_police: { kind: 'heli', name: 'Hélico de police', cols: ['#1e3a8a'], cop: true, max: 30, hp: 190, r: 3 },
  heli_army: { kind: 'heli', name: 'Hélico militaire', cols: ['#4b5320'], max: 30, hp: 240, r: 3 },
  sport: { kind: 'car', name: 'Muscle car', shape: 'sedan', cols: ['#14151a'], acc: 14, max: 34, hp: 115, r: 1.85 },
  jet: { kind: 'plane', name: 'Avion de ligne', cols: ['#f8fafc'], max: 82, lift: 44, hp: 420, r: 6 },
  avion: { kind: 'plane', name: 'Avion léger', cols: ['#f8fafc'], max: 64, lift: 27, hp: 150, r: 3 },
  tank: { kind: 'tank', name: 'Char de combat', cols: ['#556b2f'], max: 9.5, hp: 480, r: 3.2 }
};
const LAND = k => k === 'car' || k === 'moto' || k === 'tank', AIR = k => k === 'heli' || k === 'plane';

const SHAPES = {
  sedan: { len: 4.4, w: 1.78, wx: [1.38, -1.38], body: [[-2.2, .32], [-2.2, .92], [-1.45, .98], [-.8, 1.46], [.55, 1.46], [1.2, .98], [2.2, .86], [2.2, .32]], glass: [[-1.38, 1.0], [-.76, 1.38], [.5, 1.38], [1.1, 1.0]], stripe: [[-2.15, .52], [2.15, .52], [2.15, .7], [-2.15, .7]] },
  suv: { len: 4.7, w: 1.9, wx: [1.5, -1.5], body: [[-2.35, .42], [-2.35, 1.85], [.5, 1.9], [1.3, 1.25], [2.35, 1.1], [2.35, .42]], glass: [[-2.25, 1.3], [-2.25, 1.78], [.45, 1.82], [1.15, 1.3]], stripe: [[-2.3, .6], [2.3, .6], [2.3, .78], [-2.3, .78]] },
  gbaka: { len: 5.2, w: 1.95, wx: [1.7, -1.7], body: [[-2.6, .38], [-2.6, 2.2], [1.7, 2.2], [2.1, 1.5], [2.6, 1.05], [2.6, .38]], glass: [[-2.4, 1.3], [-2.4, 2.0], [1.6, 2.0], [2.05, 1.35]], stripe: [[-2.55, .7], [2.55, .7], [2.55, .95], [-2.55, .95]] },
  pickup: { len: 5, w: 1.9, wx: [1.6, -1.6], body: [[-2.5, .45], [-2.5, 1.15], [-.3, 1.15], [-.3, 1.85], [.7, 1.85], [1.25, 1.15], [2.5, 1.05], [2.5, .45]], glass: [[-.2, 1.2], [-.2, 1.78], [.65, 1.78], [1.15, 1.2]], stripe: [[-2.45, .62], [2.45, .62], [2.45, .8], [-2.45, .8]] },
  truck: { len: 6.2, w: 2.3, wx: [1.7, -1.5, -2.5], body: [[-3.3, .55], [-3.3, 3.2], [.9, 3.2], [.9, 2.4], [1.3, 2.4], [2.0, 1.7], [2.4, 1.4], [2.4, .55]], glass: [[1.1, 1.7], [1.35, 2.3], [1.9, 2.0], [2.1, 1.6]], stripe: [[-3.25, 1.0], [.85, 1.0], [.85, 1.25], [-3.25, 1.25]] },
  bus: { len: 9.6, w: 2.6, wx: [3.4, -3.0], body: [[-4.8, .4], [-4.8, 3.2], [4.2, 3.2], [4.8, 2.4], [4.8, .4]], glass: [[-4.6, 1.7], [-4.6, 2.95], [4.1, 2.95], [4.55, 2.3], [4.55, 1.7]], stripe: [[-4.8, .85], [4.8, .85], [4.8, 1.15], [-4.8, 1.15]] }
};
const GEO = {};
function extrude(pts, depth) { const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g; }
function carGeo(shape) { if (GEO[shape]) return GEO[shape]; const S = SHAPES[shape]; return GEO[shape] = { body: extrude(S.body, S.w), glass: extrude(S.glass, S.w + .06), stripe: extrude(S.stripe, S.w + .04), wheel: (() => { const g = new THREE.CylinderGeometry(.4, .4, .28, 10); g.rotateX(PI / 2); return g; })() }; }
function hullGeo(L, W, H, tip = .3) { const s = new THREE.Shape(); s.moveTo(-L / 2, -W / 2); s.lineTo(L / 2 - L * tip, -W / 2); s.lineTo(L / 2, 0); s.lineTo(L / 2 - L * tip, W / 2); s.lineTo(-L / 2, W / 2); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false }); g.rotateX(-PI / 2); g.rotateY(-PI / 2); return g; }

/* ---------- modèles ---------- */
function mCar(T, col) {
  const S = SHAPES[T.shape], g = carGeo(T.shape), root = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = -PI / 2; root.add(inner);
  inner.add(new THREE.Mesh(g.body, MP(col, 70))); inner.add(new THREE.Mesh(g.glass, MP('#1c2733', 120)));
  if (T.stripe) inner.add(new THREE.Mesh(g.stripe, M(T.stripe)));
  const wheels = []; for (const wx of S.wx) for (const sz of [-1, 1]) { const w = new THREE.Mesh(g.wheel, M('#111111')); w.position.set(wx, .4, sz * (S.w / 2 - .02)); inner.add(w); wheels.push(w); }
  const hl = S.len / 2; pb(inner, .06, .16, .36, MB('#fff2b0'), hl, .7, S.w * .3); pb(inner, .06, .16, .36, MB('#fff2b0'), hl, .7, -S.w * .3); pb(inner, .06, .16, .36, MB('#ff2a2a'), -hl, .7, S.w * .3); pb(inner, .06, .16, .36, MB('#ff2a2a'), -hl, .7, -S.w * .3);
  pb(inner, .25, .3, S.w * .98, M('#1a1a1a'), hl, .45, 0); pb(inner, .25, .3, S.w * .98, M('#1a1a1a'), -hl, .45, 0);
  if (T.sign) pb(inner, .5, .2, .3, MB('#ffd33a'), -.1, 1.56, 0);
  let barA = null, barB = null; if (T.bar) { barA = pb(inner, .25, .16, .5, MB('#ff2020'), -.1, 1.55, .35); barB = pb(inner, .25, .16, .5, MB('#2060ff'), -.1, 1.55, -.35); }
  blob(root, S.len * .55, S.w * .65); return { root, wheels, barA, barB, wheelAxis: 'z' };
}
function mMoto(T, col) {
  const root = new THREE.Group(), dk = M('#1a1a1a'), wheels = [];
  pb(root, .22, .45, 1.5, MP(col, 50), 0, .8, 0); pb(root, .34, .3, .55, MP(col, 70), 0, 1.1, .25); pb(root, .3, .12, .7, dk, 0, 1.02, -.35);
  const fk = pb(root, .08, .85, .08, M('#9ca3af'), 0, .7, .85); fk.rotation.x = .25; pb(root, .9, .07, .07, dk, 0, 1.22, .75); pb(root, .16, .16, .1, MB('#fff2b0'), 0, 1.05, .98);
  for (const z of [.95, -.9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .14, 12).rotateZ(PI / 2), dk); w.position.set(0, .38, z); root.add(w); wheels.push(w); }
  pb(root, .4, .62, .3, M('#1f2937'), 0, 1.5, -.25); const hd = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), M('#a87850')); hd.position.set(0, 2.0, -.2); root.add(hd); pb(root, .24, .1, .24, M('#e23a3a'), 0, 2.1, -.2);
  pb(root, .1, .5, .1, M('#1f2937'), -.28, 1.35, .1).rotation.x = -.9; pb(root, .1, .5, .1, M('#1f2937'), .28, 1.35, .1).rotation.x = -.9;
  blob(root, 1.1, .5); return { root, wheels, wheelAxis: 'x' };
}
function mBoat(type, T, col) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  if (type === 'pinasse') {
    const h = new THREE.Mesh(hullGeo(8, 1.9, .9, .28), M(col)); h.position.y = -.2; body.add(h); const st = new THREE.Mesh(hullGeo(8.05, 1.95, .12, .28), M('#f8fafc')); st.position.y = .35; body.add(st);
    for (const x of [-.8, .8]) for (const z of [-2, 0, 2]) pb(body, .1, 1.5, .1, M('#7a4f2a'), x, .9, z); pb(body, 2.0, .12, 4.8, M('#c2410c'), 0, 1.7, 0); pb(body, .5, .6, .6, M('#111827'), 0, .6, -3.9);
  } else if (type === 'speedboat') {
    const h = new THREE.Mesh(hullGeo(6.4, 2.3, .8, .35), MP('#f8fafc', 90)); h.position.y = -.2; body.add(h); const s = new THREE.Mesh(hullGeo(6.45, 2.35, .12, .35), M('#0ea5e9')); s.position.y = .42; body.add(s);
    pb(body, 1.6, .7, .1, MP('#7dd3fc', 120), 0, 1.1, .5).rotation.x = -.5; pb(body, .8, .4, .7, M('#1f2937'), 0, .8, -.8); pb(body, .4, .5, .5, M('#111827'), 0, .7, -3);
  } else if (type === 'ferry') {
    const h = new THREE.Mesh(hullGeo(15, 4.4, 1.5, .18), M('#1d4ed8')); h.position.y = -.4; body.add(h); pb(body, 3.9, 1.5, 11, M('#f8fafc'), 0, 1.7, -.6); pb(body, 3.4, 1.3, 7, M('#f8fafc'), 0, 3.2, -1.2); pb(body, 4, .15, 11.2, M('#38bdf8'), 0, 2.3, -.6); pb(body, 3.5, .2, 7.2, M('#94a3b8'), 0, 3.95, -1.2); pb(body, .3, 1.8, .3, M('#475569'), 0, 4.8, -2);
  } else {
    const h = new THREE.Mesh(hullGeo(7, 2.5, .9, .3), MP('#cbd5e1', 80)); h.position.y = -.2; body.add(h); pb(body, 1.8, .9, 2.4, M('#1e3a8a'), 0, 1.0, -.6); pb(body, 1.6, .5, .1, MP('#7dd3fc', 120), 0, 1.2, .62); pb(body, .3, .2, .9, MB('#ff2020'), -.5, 1.65, -.6); pb(body, .3, .2, .9, MB('#2060ff'), .5, 1.65, -.6);
  }
  blob(root, T.r * 1.2, T.r * .8); return { root, body, wheels: [] };
}
function mHeli(T, col) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); const cm = MP(col, 70);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), cm); cab.position.set(0, 1.5, .3); cab.scale.set(1.15, 1.05, 2); body.add(cab);
  const gl = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), MP('#1e3a5f', 120)); gl.position.set(0, 1.6, 1.3); gl.scale.set(.95, .8, 1.1); body.add(gl);
  pb(body, .4, .45, 4.4, cm, 0, 1.7, -3.2); pb(body, .12, 1.3, .9, cm, 0, 2.2, -5.1); pb(body, .08, .08, .08, M('#111'), 0, 1, 0);
  const rotor = new THREE.Group(); rotor.position.set(0, 2.65, .2); pb(rotor, 6.6, .05, .26, M('#222222'), 0, 0, 0); pb(rotor, .26, .05, 6.6, M('#222222'), 0, 0, 0); pb(rotor, .3, .25, .3, M('#555'), 0, -.1, 0); body.add(rotor);
  const tail = new THREE.Group(); tail.position.set(.22, 2.0, -5.1); pb(tail, .05, 1.3, .14, M('#222'), 0, 0, 0); body.add(tail);
  for (const x of [-.95, .95]) { pb(body, .1, .1, 3, M('#222'), x, .15, .3); pb(body, .08, .7, .08, M('#222'), x, .5, -.6); pb(body, .08, .7, .08, M('#222'), x, .5, 1.2); }
  if (T.cop) pb(body, .3, .15, .6, MB('#ff2020'), 0, 2.7, -.8);
  blob(root, 2.4, 2.4); return { root, body, rotor, tail, wheels: [] };
}
function mPlane(T, col) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); const cm = MP(col, 80);
  const fu = new THREE.Mesh(new THREE.CapsuleGeometry(.62, 3.6, 4, 10), cm); fu.rotation.x = PI / 2; fu.position.set(0, 1.1, 0); body.add(fu);
  pb(body, 9.4, .14, 1.55, MP('#e2e8f0', 60), 0, 1.65, .3); pb(body, 3.2, .1, .95, cm, 0, 1.3, -3.4); pb(body, .1, 1.35, 1.1, MP('#dc2626', 60), 0, 1.8, -3.3);
  const gl = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), MP('#1e3a5f', 120)); gl.position.set(0, 1.55, .7); gl.scale.set(.55, .5, 1.1); body.add(gl);
  pb(body, 9.4, .08, .5, M('#dc2626'), 0, 1.66, .3).position.z = -.55;
  const prop = new THREE.Group(); prop.position.set(0, 1.1, 2.45); pb(prop, .14, 2.4, .07, M('#222'), 0, 0, 0); pb(prop, 2.4, .14, .07, M('#222'), 0, 0, 0); pb(prop, .25, .25, .3, M('#9ca3af'), 0, 0, -.1); body.add(prop);
  const wheels = []; for (const [x, z] of [[-.95, .3], [.95, .3], [0, 1.9]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .18, 10).rotateZ(PI / 2), M('#111')); w.position.set(x, .32, z); body.add(w); wheels.push(w); pb(body, .08, .6, .08, M('#444'), x, .65, z); }
  blob(root, 3, 4); return { root, body, prop, wheels, wheelAxis: 'x' };
}
function mTank(T, col) {
  const root = new THREE.Group(), cm = MP(col, 30), dk = M('#2b3320');
  pb(root, 3.1, .9, 5.2, cm, 0, .85, 0); const sl = pb(root, 3.1, .3, 1.6, cm, 0, 1.0, 2.6); sl.rotation.x = .4;
  for (const x of [-1.65, 1.65]) { pb(root, .8, .9, 5.6, dk, x, .6, 0); for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .86, 8).rotateZ(PI / 2), M('#1a1f14')); w.position.set(x, .4, -2.2 + i * 1.1); root.add(w); } }
  const turret = new THREE.Group(); turret.position.set(0, 1.5, -.2); pb(turret, 2.3, .85, 2.7, cm, 0, .3, 0); pb(turret, .9, .4, .9, cm, -.6, .9, -.3);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.14, .17, 3.8, 8).rotateX(PI / 2), dk); barrel.position.set(0, .35, 2.5); turret.add(barrel); root.add(turret);
  blob(root, 3.4, 3.4); return { root, turret, wheels: [] };
}
let BEAMGEO = null;
export function makeModel(type, col) {
  const T = VT[type]; let m;
  switch (T.kind) { case 'car': m = mCar(T, col); break; case 'moto': m = mMoto(T, col); break; case 'boat': m = mBoat(type, T, col); break; case 'heli': m = mHeli(T, col); break; case 'plane': m = mPlane(T, col); break; case 'tank': m = mTank(T, col); break; }
  const gm = vehicleGLB(type); if (gm) { for (const ch of m.root.children) ch.visible = !!ch.userData.blob; m.root.add(gm.root); m.wheels = []; m.barA = m.barB = null; m.prop = gm.prop; m.rotor = null; }
  if (T.kind === 'car' || T.kind === 'moto') { // phares : faisceau au sol visible la nuit
    if (!nightFX.beam) nightFX.beam = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0xfff0c0 });
    if (!BEAMGEO) { BEAMGEO = new THREE.PlaneGeometry(9, 15); BEAMGEO.rotateX(-PI / 2); BEAMGEO.translate(0, .12, 10); }
    const bm = new THREE.Mesh(BEAMGEO, nightFX.beam); bm.renderOrder = 4; bm.frustumCulled = false; m.root.add(bm);
  }
  root(m); if (!gm) shadowAll(m.root, true, false); return m;
  function root(mm) { mm.root.rotation.order = 'YXZ'; }
}

/* ---------- création ---------- */
export function spawnVehicle(type, x, z, a, mode = 'parked', col, o = {}) {
  const T = VT[type]; if (!T) throw new Error('véhicule inconnu ' + type);
  const c = col || pick(T.cols), model = makeModel(type, c); scene.add(model.root);
  const v = { type, kind: T.kind, x, y: o.y || 0, z, a, pitch: 0, roll: 0, sp: o.sp || 0, vy: 0, hp: T.hp, maxhp: T.hp, mode, model, r: T.r, v: rand(8, 12.5), cop: !!T.cop, thr: 0, rot: 0, ta: a, fireT: 0, burn: 0, bob: rand(0, 6), col: c, remote: !!o.remote, ...o };
  G.cars.push(v); return v;
}
export function removeVehicle(v) { scene.remove(v.model.root); const i = G.cars.indexOf(v); if (i >= 0) G.cars.splice(i, 1); }
export const vehName = v => VT[v.type].name;

/* ---------- dégâts / explosion ---------- */
export function damageVehicle(v, dmg, src) {
  if (v.wreck || v.invuln) return; v.hp -= dmg;
  if (src === G.P && (v.cop || v.mode === 'police')) heat(.4);
  if (v.hp <= 0) explodeVehicle(v, src);
}
export function explodeVehicle(v, src) {
  if (v.wreck) return; v.wreck = true; const P = G.P, wasP = P.car === v;
  explosion(v.x, (v.y || 0) + 1, v.z, 5 + v.r, 55, src); if (wasP) { exitVehicle(true); hurtP(35); }
  v.mode = 'parked'; v.burn = 25; v.sp = 0; v.vy = 0; v.life = 45;
  v.model.root.traverse(o => { if (o.isMesh && !o.userData.blob) o.material = M('#161616'); });
  if (AIR(v.kind) && v.y > .5) { v.y = 0.2; v.pitch = .3; v.roll = .4; }
  if (src === P && v.mode !== 'player') { heat(.25); }
  if (G.hooks.onVehicleDestroyed) G.hooks.onVehicleDestroyed(v, src);
}

/* ---------- entrées de pilotage ---------- */
function drive() {
  const k = I.keys, j = I.joy, b = I.btn;
  return { thr: clamp((k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - j.y, -1, 1), st: clamp((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + j.x, -1, 1), brake: !!(k.Space || k.ShiftLeft || k.ShiftRight || b.sprint), up: !!(k.Space || b.sprint), down: !!(k.ShiftLeft || k.ShiftRight || k.ControlLeft || b.reload), fire: firing() };
}

/* ---------- physique par type ---------- */
for (const k in VT) { const T = VT[k]; if (T.kind === 'car' || T.kind === 'moto') { T.max *= 1.18; T.acc *= 1.12; } else if (T.kind === 'boat') { T.max *= 1.12; } } // SPEED_BOOST
const MASS = { tank: 9, bus: 3.2, truck: 3, gbaka: 1.7, suv: 1.5, pickup: 1.5, moto: .35 };
export function dims(v) {
  if (v.dm) return v.dm; const T = VT[v.type], S = SHAPES[T.shape];
  let d; if (v.kind === 'tank') d = [3.3, 1.6]; else if (v.kind === 'moto') d = [1.05, .45]; else if (v.kind === 'boat') d = [T.r * .95, T.r * .45]; else if (S) d = [S.len / 2 - .05, S.w / 2]; else d = [2.3, 1];
  if (T.hl) d = [T.hl, T.hw]; v.dm = d; v.mass = (v.kind === 'tank' ? MASS.tank : MASS[v.type] || MASS[T.shape] || 1); return d;
}
function landCollide(v, dt) {
  const [hl, hw] = dims(v), c = collideBox(v, hl, hw);
  if (c) {
    const fx = Math.sin(v.a), fz = Math.cos(v.a), dir = v.sp >= 0 ? 1 : -1, dot = (fx * c.nx + fz * c.nz) * dir; // <0 : on fonce dans le mur
    const into = Math.max(0, -dot) * Math.abs(v.sp), graze = 1 - Math.max(0, -dot);
    if (into > 3) { const d = into * (v.kind === 'tank' ? .12 : .8); if (!v.invuln) v.hp -= d; if (v.hp <= 0) explodeVehicle(v, v.mode === 'player' ? G.P : null); if (v.mode === 'player') { G.hurtT = Math.max(G.hurtT, .12); sfx('crash'); G.shake = Math.max(G.shake || 0, Math.min(1, into / 14)); } sparks(v.x - c.nx * hw, .8, v.z - c.nz * hw, Math.min(8, 2 + into * .3)); }
    // glissement : on garde la vitesse tangentielle et on s'aligne sur le mur
    const tx = -c.nz, tz = c.nx, side = (fx * tx + fz * tz) >= 0 ? 1 : -1, wall = Math.atan2(tx * side * dir, tz * side * dir) + (dir < 0 ? PI : 0);
    v.a += adiff(Math.atan2(tx * side, tz * side) + (dir < 0 ? PI : 0), v.a) * clamp(dt * 3 * (1 - graze * .5), 0, .5);
    v.sp *= clamp(graze * .85 + .1, 0, 1) * (into > 8 ? .6 : 1);
    if (v.mode === 'police' || v.mode === 'route') { v.stuck = (v.stuck || 0) + dt; if (v.stuck > .4 && into > 1) { v.rev = 1.1; v.stuck = 0; } }
    if (v.mode === 'traffic' && into > 2) v.a += PI;
  }
}
/* boîte contre boîte (SAT) : séparation + impulsion + dégâts + toupie */
function obbSAT(a, ad, b, bd) {
  const A = [[Math.sin(a.a), Math.cos(a.a)], [Math.cos(a.a), -Math.sin(a.a)], [Math.sin(b.a), Math.cos(b.a)], [Math.cos(b.a), -Math.sin(b.a)]], dx = b.x - a.x, dz = b.z - a.z; let best = null;
  for (let k = 0; k < 4; k++) {
    const ax = A[k][0], az = A[k][1]; const ra = ad[0] * Math.abs(ax * A[0][0] + az * A[0][1]) + ad[1] * Math.abs(ax * A[1][0] + az * A[1][1]), rb = bd[0] * Math.abs(ax * A[2][0] + az * A[2][1]) + bd[1] * Math.abs(ax * A[3][0] + az * A[3][1]);
    const o = ra + rb - Math.abs(dx * ax + dz * az); if (o <= 0) return null; if (!best || o < best.d) { const s = (dx * ax + dz * az) >= 0 ? 1 : -1; best = { d: o, nx: ax * s, nz: az * s }; }
  }
  return best; // normale de a vers b
}
function vehVsVeh(v, dt) {
  const vd = dims(v);
  for (const o of G.cars) {
    if (o === v || o.remote) continue; if (LAND(v.kind) !== LAND(o.kind) || (v.kind === 'boat') !== (o.kind === 'boat')) continue; if (AIR(v.kind) || AIR(o.kind)) continue;
    if (Math.abs(v.x - o.x) > 9 || Math.abs(v.z - o.z) > 9) continue; if (o.mode === 'player' && v.mode !== 'player' && G.cars.indexOf(o) < G.cars.indexOf(v)) continue; // une seule résolution par paire
    const od = dims(o), c = obbSAT(v, vd, o, od); if (!c) continue;
    const m1 = v.mass || 1, m2 = o.mass || 1, w1 = m2 / (m1 + m2), w2 = m1 / (m1 + m2), pen = c.d + .02;
    v.x -= c.nx * pen * w1; v.z -= c.nz * pen * w1; o.x += c.nx * pen * w2; o.z += c.nz * pen * w2;
    const v1 = [Math.sin(v.a) * v.sp, Math.cos(v.a) * v.sp], v2 = [Math.sin(o.a) * o.sp, Math.cos(o.a) * o.sp], rel = (v1[0] - v2[0]) * c.nx + (v1[1] - v2[1]) * c.nz;
    if (rel > 0) {
      const j = rel * (1 + .25) / (1 / m1 + 1 / m2), n1 = [v1[0] - j / m1 * c.nx, v1[1] - j / m1 * c.nz], n2 = [v2[0] + j / m2 * c.nx, v2[1] + j / m2 * c.nz];
      v.sp = n1[0] * Math.sin(v.a) + n1[1] * Math.cos(v.a); o.sp = n2[0] * Math.sin(o.a) + n2[1] * Math.cos(o.a);
      const side1 = (c.nx * Math.cos(v.a) - c.nz * Math.sin(v.a)), side2 = (c.nx * Math.cos(o.a) - c.nz * Math.sin(o.a)); v.a -= clamp(side1 * rel * .02 * w1, -.35, .35); o.a += clamp(side2 * rel * .02 * w2, -.35, .35);
      if (rel > 4) {
        const dv = rel * (o.kind === 'tank' ? 1.6 : .6) * w2 * 1.6, dov = rel * (v.kind === 'tank' ? 1.6 : .6) * w1 * 1.6; if (!v.invuln) v.hp -= dv; if (!o.invuln) o.hp -= dov;
        if (v.mode === 'player' || o.mode === 'player') { G.hurtT = Math.max(G.hurtT, .12); sfx('crash'); G.shake = Math.max(G.shake || 0, Math.min(1, rel / 14)); }
        sparks((v.x + o.x) / 2, .8, (v.z + o.z) / 2, Math.min(9, 2 + rel * .35));
        if (v.hp <= 0) explodeVehicle(v, o.mode === 'player' ? G.P : null); if (o.hp <= 0) explodeVehicle(o, v.mode === 'player' ? G.P : null);
      }
    }
  }
}
/* piétons / joueur à pied : les véhicules terrestres sont solides */
export function pushOutOfVehicles(e, r) {
  let hit = false; for (const v of G.cars) { if (v.remote || v.kind === 'boat' || AIR(v.kind) || v === G.P.car) continue; if (Math.abs(v.x - e.x) > 6 || Math.abs(v.z - e.z) > 6) continue; const d = dims(v); if (pushFromBox(e, r, v.x, v.z, v.a, d[0], d[1])) hit = true; } return hit;
}
function runOver(v) {
  if (Math.abs(v.sp) < 5) return;
  for (const h of G.humans) {
    if (h.dead > 0 || h.client) continue; if (Math.hypot(h.x - v.x, h.z - v.z) < v.r * .75 + .5) { const d = Math.abs(v.sp) * (v.kind === 'tank' ? 12 : 4); damage(h, d, v.mode === 'player' ? G.P : v); h.x += Math.sin(v.a) * v.sp * .12; h.z += Math.cos(v.a) * v.sp * .12; v.sp *= v.kind === 'tank' ? .98 : .93; sfx('hit'); }
  }
}
function followRoute(v, dt, spd) {
  const r = v.route; if (!r || !r.length) { v.sp *= .95; return; }
  const t = r[v.ri || 0]; const dx = t.x - v.x, dz = t.z - v.z, d = Math.hypot(dx, dz);
  if (d < (v.kind === 'boat' ? 16 : 10)) { v.ri = (v.ri || 0) + 1; if (v.ri >= r.length) { if (v.loop) v.ri = 0; else { v.arrived = true; v.mode = 'parked'; return; } } }
  const da = adiff(Math.atan2(dx, dz), v.a); if (v.rev > 0) { v.rev -= dt; v.a -= clamp(da, -1, 1) * dt * 2; v.sp = lerp(v.sp, -6, clamp(dt * 3, 0, 1)); return; }
  v.a += clamp(da, -1, 1) * dt * (v.kind === 'boat' ? 1.1 : 2.4); const sharp = Math.abs(da) > .9 ? .45 : 1; v.sp = lerp(v.sp, spd * sharp, clamp(dt * 2, 0, 1));
}
function stepLand(v, dt, inp, T) {
  const P = G.P;
  if (v.mode === 'player') {
    if (v.kind === 'tank') {
      if (Math.abs(inp.thr) > .05) v.sp += inp.thr * 5 * dt * (inp.thr * v.sp >= 0 ? 1 : 2); else v.sp *= Math.max(0, 1 - 1.6 * dt); if (inp.brake && !I.btn.sprint) v.sp *= Math.max(0, 1 - 4 * dt);
      v.sp = clamp(v.sp, -4, T.max); v.a -= inp.st * dt * 1.0;
      v.ta += adiff(G.camYaw || v.a, v.ta) * clamp(dt * 2.2, 0, 1);
      v.fireT -= dt; if (inp.fire && v.fireT <= 0) { v.fireT = 1.5; fireProjectile({ x: v.x + Math.sin(v.ta) * 3.4, y: 2.0, z: v.z + Math.cos(v.ta) * 3.4, dx: Math.sin(v.ta), dy: .02, dz: Math.cos(v.ta), speed: 70, kind: 'shell', owner: P, ownerVeh: v, radius: 6, dmg: 110, life: 3 }); sfx('boom', .5); G.shake = Math.max(G.shake || 0, .35); G.combatT = 0; heat(.15); smoke(v.x + Math.sin(v.ta) * 3.6, 2, v.z + Math.cos(v.ta) * 3.6, 4, 1); }
    } else {
      if (Math.abs(inp.thr) > .05) v.sp += inp.thr * (inp.thr * v.sp >= 0 ? T.acc : T.acc * 1.7) * dt; else v.sp *= Math.max(0, 1 - .9 * dt);
      if (inp.brake && !I.btn.sprint || (inp.brake && I.btn.sprint && Math.abs(inp.thr) < .05)) v.sp *= Math.max(0, 1 - 3.5 * dt);
      v.sp = clamp(v.sp, -9, T.max); const ts = v.kind === 'moto' ? 2.6 : 1.9; v.a -= inp.st * dt * ts * clamp(v.sp / 6, -1, 1) * (1 - .3 * Math.min(1, Math.abs(v.sp) / T.max));
    }
  } else if (v.mode === 'traffic') {
    const ax = v.x + Math.sin(v.a) * 9, az = v.z + Math.cos(v.a) * 9; let block = !P.car && Math.hypot(ax - P.x, az - P.z) < 3.5;
    if (!block && P.car && P.car !== v && Math.hypot(ax - P.x, az - P.z) < 4.5) block = true;
    for (const h of G.humans) if (!block && h.dead <= 0 && Math.hypot(ax - h.x, az - h.z) < 3) block = true;
    for (const o of G.cars) if (!block && o !== v && !AIR(o.kind) && Math.hypot(ax - o.x, az - o.z) < 4.2) block = true;
    v.sp = lerp(v.sp, block ? 0 : v.v, clamp(dt * 3, 0, 1));
    if (Math.hypot(v.x - P.x, v.z - P.z) > 230 || v.x < 2 || v.z < 2 || v.x > WORLD - 2 || v.z > WORLD + 10) v.remove = true;
  } else if (v.mode === 'police') {
    const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz);
    if (G.wanted <= 0 || P.dead > 0) { v.sp = lerp(v.sp, 0, dt); if (d > 120) v.remove = true; }
    else if (d < 15 && !P.car) { v.sp *= Math.max(0, 1 - 4 * dt); if (!v.deployed && v.sp < 2) { v.deployed = true; G.hooks.deployCops && G.hooks.deployCops(v); v.mode = 'parked'; } }
    else {
      let target = Math.atan2(dx, dz); if (v.rev > 0) { v.rev -= dt; target += PI; }
      const turn = clamp(adiff(target, v.a), -1, 1); v.a += turn * dt * 2.3 * clamp(Math.abs(v.sp) / 5, .2, 1) * (v.rev > 0 ? -1 : 1);
      v.sp = lerp(v.sp, v.rev > 0 ? -7 : T.max * (.55 + .12 * (G.starsN || 1)), clamp(dt * 1.6, 0, 1));
      if (P.car && !AIR(P.car.kind) && d < v.r + P.car.r + .6) { P.car.hp -= 6 * dt * 6; G.hurtT = Math.max(G.hurtT, .1); v.sp *= .9; if (P.car.hp <= 0) explodeVehicle(P.car, null); }
    }
  } else if (v.mode === 'route') followRoute(v, dt, v.rSpeed || 16);
  else if (v.mode === 'hostile' && v.kind === 'tank') {
    const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz), ta = Math.atan2(dx, dz); v.a += clamp(adiff(ta, v.a), -1, 1) * dt * .6; v.ta += adiff(ta, v.ta) * clamp(dt * 1.5, 0, 1);
    v.sp = lerp(v.sp, d > 30 ? 5 : 0, clamp(dt, 0, 1)); v.fireT -= dt;
    if (d < 90 && v.fireT <= 0 && P.dead <= 0) { v.fireT = rand(2.6, 3.6); const tx = P.x + rand(-4, 4), tz = P.z + rand(-4, 4), dd = Math.hypot(tx - v.x, tz - v.z); fireProjectile({ x: v.x + Math.sin(v.ta) * 3.4, y: 2, z: v.z + Math.cos(v.ta) * 3.4, dx: (tx - v.x) / dd, dy: .02, dz: (tz - v.z) / dd, speed: 55, kind: 'shell', ownerVeh: v, radius: 5.5, dmg: 55, life: 3 }); sfx('boom', .4); }
  } else v.sp *= Math.max(0, 1 - 2 * dt);
  if (v.mode === 'player' || v.mode === 'police' || v.mode === 'traffic' || v.mode === 'route' || v.mode === 'hostile') { /* mouvements */ }
  { const n = Math.min(6, Math.ceil(Math.abs(v.sp) * dt / 1.1)) || 1, h = dt / n; for (let k = 0; k < n; k++) { v.x += Math.sin(v.a) * v.sp * h; v.z += Math.cos(v.a) * v.sp * h; landCollide(v, h); } } vehVsVeh(v, dt);
  if (v.mode === 'player' || v.mode === 'route' || v.mode === 'hostile') runOver(v);
  if (v.mode === 'player' && Math.abs(v.sp) > 12 && Math.random() < dt * 8) dust(v.x - Math.sin(v.a) * v.r, .3, v.z - Math.cos(v.a) * v.r, 1);
  // suspension
  const acc = (v.sp - (v.prevSp || 0)) / Math.max(dt, .001); v.pitch = lerp(v.pitch, -clamp(acc * .004, -.05, .05), clamp(dt * 6, 0, 1));
  const lean = v.mode === 'player' ? -inp.st * Math.abs(v.sp) * (v.kind === 'moto' ? .028 : .0035) : 0; v.roll = lerp(v.roll, clamp(lean, -.5, .5), clamp(dt * 5, 0, 1));
}
function stepBoat(v, dt, inp, T) {
  const P = G.P;
  if (v.mode === 'player') {
    if (Math.abs(inp.thr) > .05) v.sp += inp.thr * (inp.thr * v.sp >= 0 ? T.acc : T.acc * 1.2) * dt; else v.sp *= Math.max(0, 1 - .35 * dt);
    if (inp.brake) v.sp *= Math.max(0, 1 - 1.4 * dt); v.sp = clamp(v.sp, -4, T.max); v.a -= inp.st * dt * (.5 + .9 * Math.min(1, Math.abs(v.sp) / 8)) * (v.sp >= 0 ? 1 : -1) * (v.type === 'ferry' ? .5 : 1);
  } else if (v.mode === 'route') followRoute(v, dt, v.rSpeed || 10);
  else if (v.mode === 'hostile') {
    const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz); v.a += clamp(adiff(Math.atan2(dx, dz), v.a), -1, 1) * dt * 1.1; v.sp = lerp(v.sp, d > 28 ? T.max * .7 : 0, clamp(dt, 0, 1)); v.fireT -= dt;
    if (d < 60 && v.fireT <= 0 && P.dead <= 0 && (P.z < -2 || P.car)) { v.fireT = rand(.5, 1); sfx('smg', .6); tracer(v.x, 1.8, v.z, P.x, 1.4, P.z); if (Math.random() < .3) hurtP(5); }
  } else v.sp *= Math.max(0, 1 - .4 * dt);
  v.x += Math.sin(v.a) * v.sp * dt; v.z += Math.cos(v.a) * v.sp * dt;
  if (collideBoat(v, v.r)) { if (Math.abs(v.sp) > 5) { v.hp -= Math.abs(v.sp) * .5; if (v.hp <= 0) explodeVehicle(v, null); if (v.mode === 'player') { G.hurtT = .1; sfx('crash'); } } v.sp *= -.2; }
  vehVsVeh(v, dt); v.bob += dt * 2;
  if (Math.abs(v.sp) > 4 && Math.random() < dt * 20) emit(v.x - Math.sin(v.a) * v.r, .15, v.z - Math.cos(v.a) * v.r, rand(-.5, .5), rand(.4, 1), rand(-.5, .5), .6, .6, '#ffffff', '#9fd0e6', -.2, 1, .95);
  v.roll = lerp(v.roll, v.mode === 'player' ? -inp.st * Math.min(.18, Math.abs(v.sp) * .012) : 0, clamp(dt * 3, 0, 1)); v.pitch = lerp(v.pitch, -clamp(Math.abs(v.sp) * .006, 0, .1), clamp(dt * 3, 0, 1));
  if (v.mode === 'player' && v.sp > 20) { /* fort sillage */ }
}
function aircraftBump(v, dt, r) {
  const b = airHit(v.x, v.y, v.z, r); if (!b) return false;
  if (v.kind === 'plane') { explodeVehicle(v, null); return true; }
  if (b.r) { const dx = v.x - b.x, dz = v.z - b.z, d = Math.hypot(dx, dz) || 1; v.x = b.x + dx / d * (b.r + r); v.z = b.z + dz / d * (b.r + r); v.hp -= 10 * dt * 8; if (v.hp <= 0) explodeVehicle(v, null); v.sp *= .6; sparks(v.x, v.y, v.z, 3); return true; }
  const l = v.x - b.x0, rr = b.x1 - v.x, t = v.z - b.z0, bb = b.z1 - v.z, mn = Math.min(l, rr, t, bb);
  if (mn === l) v.x = b.x0 - r; else if (mn === rr) v.x = b.x1 + r; else if (mn === t) v.z = b.z0 - r; else v.z = b.z1 + r;
  if (v.y < b.h - .5) { v.hp -= 14 * dt * 8; if (v.hp <= 0) explodeVehicle(v, null); } v.sp *= .6; sparks(v.x, v.y, v.z, 3); return true;
}
function stepHeli(v, dt, inp, T) {
  const P = G.P;
  if (v.mode === 'player') {
    v.rot = lerp(v.rot, 1, clamp(dt * 1.2, 0, 1));
    const wantSp = inp.thr > 0 ? inp.thr * T.max : inp.thr * T.max * .45; v.sp = lerp(v.sp, wantSp, clamp(dt * 1.1, 0, 1)); v.a -= inp.st * dt * 1.5;
    const tv = (inp.up ? 8 : 0) - (inp.down ? 8 : 0); v.vy = lerp(v.vy, v.rot > .6 ? tv : 0, clamp(dt * 2.2, 0, 1));
    v.fireT -= dt; if (inp.fire && v.fireT <= 0) { v.fireT = .8; v.side = -(v.side || 1); fireProjectile({ x: v.x + Math.sin(v.a) * 3 + Math.cos(v.a) * v.side, y: v.y + .8, z: v.z + Math.cos(v.a) * 3 - Math.sin(v.a) * v.side, dx: Math.sin(v.a), dy: -.18 + v.pitch * -.5, dz: Math.cos(v.a), speed: 62, kind: 'rocket', owner: P, ownerVeh: v, radius: 6, dmg: 80, life: 3.5 }); G.combatT = 0; heat(.12); }
  } else if (v.mode === 'hostile') {
    v.rot = 1; const ph = v.bob || 0, tx = P.x + Math.cos(G.time * .35 + ph) * 34, tz = P.z + Math.sin(G.time * .35 + ph) * 34, dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz);
    v.a += adiff(Math.atan2(P.x - v.x, P.z - v.z), v.a) * clamp(dt * 1.5, 0, 1); const ta = Math.atan2(dx, dz); const fwd = Math.cos(adiff(ta, v.a)) * Math.min(d, 18);
    v.vx = lerp(v.vx || 0, dx / Math.max(d, 1) * Math.min(d, 18), clamp(dt, 0, 1)); v.vz = lerp(v.vz || 0, dz / Math.max(d, 1) * Math.min(d, 18), clamp(dt, 0, 1));
    v.x += v.vx * dt; v.z += v.vz * dt; v.sp = Math.hypot(v.vx, v.vz); v.vy = lerp(v.vy, clamp(26 - v.y, -6, 6), clamp(dt, 0, 1));
    v.fireT -= dt; const dp = Math.hypot(P.x - v.x, P.z - v.z); if (dp < 80 && v.fireT <= 0 && P.dead <= 0) { v.fireT = rand(.18, .4); sfx('smg', .5); tracer(v.x, v.y - .5, v.z, P.x + rand(-1, 1), 1.2, P.z + rand(-1, 1)); if (Math.random() < .22) hurtP(4.5); }
  } else if (v.mode === 'route') { v.rot = 1; followRoute(v, dt, v.rSpeed || 20); v.vy = lerp(v.vy, clamp((v.cruiseY || 40) - v.y, -8, 8), clamp(dt, 0, 1)); }
  else { v.rot = lerp(v.rot, 0, clamp(dt * .5, 0, 1)); v.sp *= Math.max(0, 1 - 2 * dt); v.vy = lerp(v.vy, 0, clamp(dt * 3, 0, 1)); }
  if (v.mode !== 'hostile') { v.x += Math.sin(v.a) * v.sp * dt; v.z += Math.cos(v.a) * v.sp * dt; }
  v.y += v.vy * dt; if (v.y <= 0) { v.y = 0; if (v.vy < -9 && v.mode === 'player') { v.hp -= 40; if (v.hp <= 0) explodeVehicle(v, null); } v.vy = Math.max(0, v.vy); if (v.mode !== 'hostile') v.sp *= Math.max(0, 1 - 1.5 * dt); }
  if (v.y > 190) { v.y = 190; v.vy = Math.min(0, v.vy); } aircraftBump(v, dt, 2.4);
  v.x = clamp(v.x, -480, WORLD + 480); v.z = clamp(v.z, -480, ZMAX + 480);
  v.pitch = lerp(v.pitch, -clamp(v.sp / T.max * .25, -.12, .25), clamp(dt * 3, 0, 1)); v.roll = lerp(v.roll, v.mode === 'player' ? -inp.st * .22 : 0, clamp(dt * 3, 0, 1));
  if (v.rot > .5 && v.y < 4 && Math.random() < dt * 14) dust(v.x + rand(-4, 4), .3, v.z + rand(-4, 4), 1);
}
function stepPlane(v, dt, inp, T) {
  const P = G.P;
  if (v.mode === 'player') {
    v.thr = clamp(v.thr + ((inp.up ? 1 : 0) - (inp.down ? 1 : 0)) * dt * .45, 0, 1); const ground = v.y <= .05;
    v.sp += (v.thr * T.max - v.sp) * .3 * dt; if (ground && v.thr < .05) v.sp *= Math.max(0, 1 - .8 * dt);
    const pitchT = ground && v.sp < T.lift ? Math.min(0, -inp.thr * .5) : -inp.thr * .6;
    if (ground) v.a -= inp.st * dt * clamp(v.sp / 9, 0, 1) * 1; else v.a -= inp.st * dt * .9 * clamp(v.sp / 25, .3, 1);
    v.pitch = lerp(v.pitch, v.sp < T.lift * .8 && !ground ? Math.min(pitchT, -.2) : pitchT, clamp(dt * 1.8, 0, 1));
    v.fireT -= dt; if (inp.fire && v.fireT <= 0) { v.fireT = .09; sfx('smg', .5); const dy = -Math.sin(v.pitch), dx = Math.sin(v.a) * Math.cos(v.pitch), dz = Math.cos(v.a) * Math.cos(v.pitch); let t = 60; if (dy < -.02) t = Math.min(90, -(v.y + 1) / dy); const hx = v.x + dx * t, hz = v.z + dz * t; tracer(v.x + dx * 3, v.y + .6, v.z + dz * 3, hx, Math.max(0, v.y + dy * t), hz); if (t < 90) splash(hx, hz, 2.6, 10, P); G.combatT = 0; }
    v.rot = lerp(v.rot, 1, clamp(dt * 3, 0, 1));
  } else if (v.mode === 'fly') { v.sp = v.fsp || 55; v.rot = 1; }
  else { v.rot = lerp(v.rot, 0, clamp(dt, 0, 1)); v.sp *= Math.max(0, 1 - 1.5 * dt); }
  const cp = Math.cos(v.pitch); v.x += Math.sin(v.a) * v.sp * cp * dt; v.z += Math.cos(v.a) * v.sp * cp * dt;
  if (v.mode === 'player') {
    v.vy = Math.sin(v.pitch) * v.sp; if (v.y > .05 && v.sp < T.lift * .8) v.vy -= (T.lift * .8 - v.sp) * .5; v.y += v.vy * dt;
    if (v.y <= 0) { const hard = v.vy < -9 || Math.abs(v.roll) > .45 || (v.pitch < -.3 && v.sp > 16); if (v.y < -.01 && hard && !v.landed) { explodeVehicle(v, null); return; } v.y = 0; v.pitch = Math.max(v.pitch, 0); v.vy = 0; v.landed = true; } else v.landed = false;
    const bank = -inp.st * .75; v.roll = lerp(v.roll, v.y > .5 ? bank : 0, clamp(dt * 2.5, 0, 1));
    if (v.y > 230) { v.y = 230; v.pitch = Math.min(v.pitch, 0); }
  } else if (v.mode === 'fly') { v.y = v.cruiseY || 120; v.roll = 0; }
  if (v.mode === 'player' && aircraftBump(v, dt, 2.6)) return;
  if (v.mode === 'player') { v.x = clamp(v.x, -520, WORLD + 520); v.z = clamp(v.z, -520, ZMAX + 520); }
}

/* ---------- mise à jour ---------- */
export function updVehicle(v, dt) {
  const T = VT[v.type];
  if (v.remote) { v.model.root.position.set(v.x, v.y, v.z); v.model.root.rotation.set(v.pitch, v.a, v.roll); animParts(v, dt); return; }
  const inp = v.mode === 'player' ? drive() : null; v.prevSp = v.sp;
  if (!v.wreck) {
    switch (v.kind) { case 'car': case 'moto': case 'tank': stepLand(v, dt, inp || { thr: 0, st: 0 }, T); break; case 'boat': stepBoat(v, dt, inp || { thr: 0, st: 0 }, T); break; case 'heli': stepHeli(v, dt, inp || { thr: 0, st: 0 }, T); break; case 'plane': stepPlane(v, dt, inp || { thr: 0, st: 0 }, T); break; }
  } else { v.sp = 0; }
  if (v.wreck) { v.burn -= dt; v.life -= dt; if (v.burn > 0) { if (Math.random() < dt * 10) fire(v.x, (v.y || 0) + 1, v.z, 1, .6); if (Math.random() < dt * 8) smoke(v.x, (v.y || 0) + 1.4, v.z, 1, 1, true); } if (v.life < 0 && Math.hypot(v.x - G.P.x, v.z - G.P.z) > 40) v.remove = true; }
  else if (v.hp < v.maxhp * .3 && Math.random() < dt * 6) smoke(v.x + Math.sin(v.a) * v.r * .7, (v.y || 0) + 1.2, v.z + Math.cos(v.a) * v.r * .7, 1, .6, v.hp < v.maxhp * .15);
  const m = v.model; const by = v.kind === 'boat' ? Math.sin(v.bob || 0) * .1 : 0;
  m.root.position.set(v.x, (v.y || 0) + by, v.z); m.root.rotation.set(v.pitch, v.a, v.roll + (v.kind === 'boat' ? Math.sin((v.bob || 0) * .8) * .02 : 0)); animParts(v, dt);
}
function animParts(v, dt) {
  const m = v.model;
  if (m.wheels && m.wheels.length) for (const w of m.wheels) { if (m.wheelAxis === 'x') w.rotation.x += v.sp * dt / .38; else w.rotation.z -= v.sp * dt / .4; }
  if (m.rotor) { m.rotor.rotation.y += v.rot * dt * 28; m.tail.rotation.x += v.rot * dt * 30; }
  if (m.prop) m.prop.rotation.z += v.rot * dt * 40;
  if (m.turret) m.turret.rotation.y = adiff(v.ta, v.a);
  if (m.barA) { const on = Math.floor(G.time * 6) % 2 === 0 && v.mode === 'police'; m.barA.visible = on; m.barB.visible = !on; }
}

/* ---------- monter / descendre ---------- */
export function enterVehicle() {
  const P = G.P; let best = null, bd = 1e9;
  for (const c of G.cars) { if (c === P.car || c.wreck || c.remote) continue; if (AIR(c.kind) && c.y > 3) continue; const d = Math.hypot(c.x - P.x, c.z - P.z) - c.r * .55; const lim = 4.5; if (d < lim && d < bd) { bd = d; best = c; } }
  if (!best) { feed('Aucun véhicule à portée', '#cbd5e1'); return false; }
  if (best.mode === 'traffic' || best.mode === 'police') { heat(best.cop ? .8 : .3); feed('Véhicule volé !', '#ffcf4a'); G.hooks.driverFlees && G.hooks.driverFlees(best); }
  else if (best.cop && best.mode !== 'player') heat(.6);
  best.mode = 'player'; best.sp = 0; best.v = 0; best.rev = 0; P.car = best; P.model.root.visible = false; feed(VT[best.type].name, '#ffffff'); G.hooks.onEnterVehicle && G.hooks.onEnterVehicle(best); return true;
}
export function exitVehicle(force) {
  const P = G.P, c = P.car; if (!c) return; const k = c.kind;
  if (!force) {
    if (AIR(k) && (c.y > 2.5 || Math.abs(c.sp) > 10)) { feed('Impossible de descendre en vol', '#cbd5e1'); return; }
    if (k === 'boat' && c.z > -12) { /* ok près du quai */ } else if (k === 'boat') { feed('Trop loin du quai', '#cbd5e1'); return; }
    if (k !== 'boat' && !AIR(k) && Math.abs(c.sp) > 9) { feed('Trop vite !', '#cbd5e1'); return; }
  }
  c.mode = c.afterExit || 'parked'; c.afterExit = null; P.car = null; P.model.root.visible = true; c.thr = 0;
  if (k === 'boat') { P.x = clamp(c.x, 4, WORLD - 4); P.z = 3.2; }
  else { const sp = [[Math.cos(c.a), -Math.sin(c.a)], [-Math.cos(c.a), Math.sin(c.a)], [Math.sin(c.a), Math.cos(c.a)], [-Math.sin(c.a), -Math.cos(c.a)]]; for (const s of sp) { P.x = c.x + s[0] * (c.r + 1.4); P.z = c.z + s[1] * (c.r + 1.4); const t = { x: P.x, z: P.z }; if (!collide(t, .5)) break; } }
  collide(P, .5); P.y = 0; if (G.hooks.onExitVehicle) G.hooks.onExitVehicle(c);
  engineOff();
}
function engineOff() { /* silence géré par main */ }
G.hooks.exitVehicle = exitVehicle;

/* ---------- parkings permanents (réapparition) ---------- */
const SPAWNS = [
  { type: 'moto', x: POI.planque.x + 8, z: POI.planque.z + 3, a: 0 }, { type: 'moto', x: POI.garage.x + 10, z: POI.garage.z - 3, a: 1.2 }, { type: 'sedan', x: POI.spawn.x + 14, z: POI.spawn.z + 4, a: 0 },
  { type: 'taxi', x: POI.maquis.x + 8, z: POI.maquis.z + 4, a: PI }, { type: 'gbaka', x: POI.garage.x - 12, z: POI.garage.z - 4, a: 0 }, { type: 'pickup', x: POI.marche.x + 8, z: POI.marche.z + 4, a: 0 },
  { type: 'camion', x: POI.port.x - 12, z: POI.port.z + 5, a: PI / 2 }, { type: 'bus', x: POI.zone4.x + 12, z: POI.zone4.z - 4, a: PI / 2 },
  { type: 'heli', x: POI.helipad.x, z: POI.helipad.z, a: 0 }, { type: 'avion', x: POI.piste_ouest.x + 30, z: POI.piste_ouest.z, a: PI / 2 },
  { type: 'tank', x: POI.camp_yard.x, z: POI.camp_yard.z, a: -PI / 2 }, { type: 'heli_army', x: POI.camp_yard.x - 6, z: POI.camp_yard.z - 24, a: 0 },
  { type: 'pinasse', x: POI.dock1.x, z: POI.dock1.z - 2, a: PI / 2 }, { type: 'speedboat', x: POI.dock2.x, z: POI.dock2.z - 2, a: PI / 2 }, { type: 'patrol', x: POI.dock3.x + 10, z: POI.dock3.z - 2, a: PI / 2 }
];
export function initVehicleSpawns() { for (const s of SPAWNS) { s.veh = spawnVehicle(s.type, s.x, s.z, s.a, 'parked'); s.t = 0; } }
export function updateVehicleSpawns(dt) {
  for (const s of SPAWNS) {
    const v = s.veh; if (v && !v.remove && G.cars.includes(v) && !v.wreck && Math.hypot(v.x - s.x, v.z - s.z) < 400) { s.t = 0; continue; }
    if (v && G.cars.includes(v) && v.mode === 'player') continue; s.t += dt;
    if (s.t > 70 && Math.hypot(G.P.x - s.x, G.P.z - s.z) > 160) { if (v && G.cars.includes(v) && v !== G.P.car) removeVehicle(v); s.veh = spawnVehicle(s.type, s.x, s.z, s.a, 'parked'); s.t = 0; }
  }
}
