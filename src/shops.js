/* shops.js — boutiques à entrer : armurerie, mode, pharmacie, maquis, supermarché, concession, banque,
   commissariat, barbier, garage, studio. Façades placées dans la ville, intérieurs dans une zone à part. */
import { THREE, G, scene, $, clamp, feed, DAYLEN, PI } from './core.js';
import { placeShop, SHOPFRONTS, POI } from './world.js';
import { LOOKS, COP_SPEC, makeHuman, animHuman, setHeld } from './chars.js';
import { WEAP, giveWeapon, recalcDiff } from './combat.js';
import { VT, makeModel, spawnVehicle } from './vehicles.js';
import { sfx } from './audio.js';
import { say, banner, fade } from './ui.js';
import { CAM } from './player.js';
import { night } from './sky.js';

/* ---------- définitions des boutiques ---------- */
const DEFS = [
  { id: 'armu1', type: 'arms', name: 'Armurerie Le Dozo', near: 'maquis', sign: 16, wall: '#8d8a80', awning: '#3f3f46', col: '#9ca3af', ic: 'A' },
  { id: 'armu2', type: 'arms', name: 'Armurerie Marcory', near: 'zone4', sign: 16, wall: '#8d8a80', awning: '#3f3f46', col: '#9ca3af', ic: 'A' },
  { id: 'mode', type: 'clothes', name: 'Wax & Style', near: 'marcory2', sign: 19, wall: '#f3d9e8', awning: '#a21caf', col: '#e879f9', ic: 'V' },
  { id: 'pharma', type: 'pharma', name: 'Pharmacie du Plateau', near: 'hopital', sign: 3, wall: '#e8f3ea', awning: '#15803d', col: '#4ade80', ic: '+' },
  { id: 'resto', type: 'resto', name: 'Maquis Chez Tantie', near: 'treich', sign: 1, wall: '#f1d6a8', awning: '#c2410c', col: '#fb923c', ic: 'M' },
  { id: 'super', type: 'super', name: 'Supermarché Ébène', near: 'marche', sign: 9, wall: '#f4f0e6', awning: '#be123c', col: '#f472b6', ic: 'S' },
  { id: 'auto', type: 'dealer', name: 'Auto Plateau', near: 'cocody2', sign: 18, wall: '#dfe6ee', awning: '#b91c1c', col: '#f87171', ic: '$', w: 11, d: 8 },
  { id: 'banque', type: 'bank', name: 'Banque Atlas', near: 'banque', sign: 8, wall: '#cfd6de', awning: '#334155', col: '#facc15', ic: 'B' },
  { id: 'police', type: 'police', name: 'Commissariat Central', near: 'tour', sign: 17, wall: '#c9d6ea', awning: '#1e40af', col: '#60a5fa', ic: 'P', w: 11, d: 8 },
  { id: 'police2', type: 'police', name: 'Commissariat de Yopougon', near: 'yop_sud', sign: 17, wall: '#c9d6ea', awning: '#1e40af', col: '#60a5fa', ic: 'P', w: 11, d: 8 },
  { id: 'barbier', type: 'barber', name: 'Barbier Le Rasoir', near: 'yop_nord', sign: 21, wall: '#e7e1d3', awning: '#92400e', col: '#fbbf24', ic: 'C' },
  { id: 'garage', type: 'garage', name: 'Garage Express', near: 'garage', sign: 2, wall: '#d6d3cb', awning: '#b91c1c', col: '#fb7185', ic: 'G', w: 11, d: 8 },
  { id: 'studio', type: 'home', name: 'Studio (planque)', near: 'planque', sign: 20, wall: '#d9e4e0', awning: '#0f766e', col: '#2dd4bf', ic: 'H' }
];
export const SHOPS = [];
G.hooks.placeShops = () => { for (const d of DEFS) { const s = placeShop(d); if (s) SHOPS.push(s); } };

/* ---------- sauvegarde ---------- */
const KEY = 'ac3d_v5';
const S = { bank: 0, owned: [], outfit: -1, hair: -1 };
function load() { try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ok */ } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ok */ } }
export const shopState = S;

/* ---------- tenues & coiffures ---------- */
const OUTFITS = [
  { n: 'Tenue de départ', d: 'Ton look d\'origine', p: 0 },
  { n: 'Wax doré', d: 'Chemise en pagne et pantalon noir', p: 220, shirt: '#d4a017', pants: '#1f2937', hat: 'none' },
  { n: 'Costume du Plateau', d: 'Noir, chic, banquier', p: 600, shirt: '#111827', pants: '#111827', hat: 'none' },
  { n: 'Maillot des Éléphants', d: 'Orange, fierté nationale', p: 150, shirt: '#ff8200', pants: '#ffffff', hat: 'none' },
  { n: 'Streetwear violet', d: 'Hoodie et casquette', p: 280, shirt: '#7c3aed', pants: '#0f172a', hat: 'cap', hatCol: '#111827' },
  { n: 'Treillis militaire', d: 'Tenue de camp', p: 320, shirt: '#4b5320', pants: '#3f4d2c', hat: 'cap', hatCol: '#3f4d2c' },
  { n: 'Boubou blanc', d: 'Élégance de Cocody', p: 400, shirt: '#f5f5f5', pants: '#f5f5f5', hat: 'none' },
  { n: 'Cuir rouge', d: 'Blouson rouge, jean sombre', p: 500, shirt: '#b91c1c', pants: '#1e3a8a', hat: 'cap', hatCol: '#b91c1c' }
];
const HAIRS = [{ n: 'Noir', c: '#0b0b0b', p: 0 }, { n: 'Blond platine', c: '#d6b25e', p: 90 }, { n: 'Rouge cuivré', c: '#a3321c', p: 90 }, { n: 'Gris argent', c: '#9ca3af', p: 90 }, { n: 'Bleu électrique', c: '#1d4ed8', p: 120 }, { n: 'Vert néon', c: '#22c55e', p: 120 }];
let baseSpec = null;
function rebuildPlayer() {
  const P = G.P; if (!baseSpec) baseSpec = { ...P.hero.spec };
  const sp = { ...baseSpec }; const o = OUTFITS[S.outfit]; if (o && S.outfit > 0) { sp.shirt = o.shirt; sp.pants = o.pants; sp.hat = o.hat; if (o.hatCol) sp.hatCol = o.hatCol; sp.stripe = undefined; sp.sash = undefined; sp.cuffs = undefined; }
  const hr = HAIRS[S.hair]; if (hr && S.hair > 0) sp.hair = hr.c;
  scene.remove(P.model.root); P.model = makeHuman(sp); scene.add(P.model.root); setHeld(P, P.cur); P.model.root.position.set(P.x, 0, P.z);
}
export function applyStyle() { load(); if (!G.P || G.P.hero.spec.glb) return; baseSpec = { ...G.P.hero.spec }; if (S.outfit > 0 || S.hair > 0) rebuildPlayer(); }

/* ---------- intérieurs ---------- */
const mats = {}; const mat = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
const RW = 14, RD = 11, WH = 4.2;
const rooms = []; let lightI = null;
function buildRoom(sp, idx) {
  const g = new THREE.Group(), ox = 2600 + (idx % 6) * 40, oz = 2600 + Math.floor(idx / 6) * 40; g.position.set(ox, 0, oz); g.visible = false; scene.add(g);
  const R = { g, ox, oz, minX: ox - RW / 2 + .2, maxX: ox + RW / 2 - .2, minZ: oz - RD / 2 + .2, maxZ: oz + RD / 2 - .2, rects: [], def: sp, anim: [], clerkH: null };
  const bx = (x, y, z, w, h, d, col, solid) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col)); m.position.set(x, y + h / 2, z); g.add(m); if (solid) R.rects.push({ x0: ox + x - w / 2, x1: ox + x + w / 2, z0: oz + z - d / 2, z1: oz + z + d / 2 }); return m; };
  const t = sp.type, wallC = { arms: '#6b6f73', clothes: '#f1d0e3', pharma: '#eef6f0', resto: '#f0d6a6', super: '#f2efe6', dealer: '#e3e8ef', bank: '#c9d1db', police: '#c3d0e6', barber: '#e3dccb', garage: '#bdbab0', home: '#d9e4e0' }[t], floorC = { arms: '#3b3b3f', clothes: '#b98a9e', pharma: '#dfe9e3', resto: '#8a5a3b', super: '#d7d3c7', dealer: '#9aa3ad', bank: '#7b8794', police: '#6b7280', barber: '#4a4036', garage: '#4b5563', home: '#8b6f5a' }[t];
  bx(0, -.1, 0, RW, .1, RD, floorC); bx(0, WH, 0, RW, .15, RD, '#e9e6df');
  bx(0, 0, -RD / 2, RW, WH, .3, wallC); bx(0, 0, RD / 2, RW, WH, .3, wallC); bx(-RW / 2, 0, 0, .3, WH, RD, wallC); bx(RW / 2, 0, 0, .3, WH, RD, wallC);
  bx(0, 0, RD / 2 - .2, 2.2, 2.6, .15, '#1b2733'); bx(0, 2.6, RD / 2 - .25, 2.6, .25, .2, sp.col); // porte de sortie
  bx(0, 0, -2.7, 7, 1.1, 1.2, '#7a5230', true); bx(0, 1.1, -2.7, 7.2, .1, 1.4, '#3f2a18'); // comptoir
  const shelf = (x, z, w, d, cols, rows = 3) => { bx(x, 0, z, w, 2.4, d, '#5b4636', true); for (let r = 0; r < rows; r++) for (let k = 0; k < Math.floor(w / .6); k++) bx(x - w / 2 + .35 + k * .6, .35 + r * .75, z + (d > 1 ? 0 : 0) + .05, .4, .45, d * .9, cols[(k + r) % cols.length]); };
  if (t === 'arms') {
    for (let k = 0; k < 7; k++) { bx(-5.6 + k * 1.85, 1.7, -RD / 2 + .3, 1.1, .12, .1, '#111'); bx(-5.6 + k * 1.85 - .3, 1.55, -RD / 2 + .3, .4, .35, .1, '#2b2b2b'); bx(-5.6 + k * 1.85, 2.25, -RD / 2 + .3, 1.3, .1, .1, '#4a3b2a'); }
    bx(-4.5, 0, 1, 2.4, 1, 1, '#3d4a2c', true); bx(4.5, 0, 1, 2.4, 1, 1, '#3d4a2c', true); bx(5.5, 0, -2, 1.4, 1.2, 1.4, '#222', true); bx(5.5, 1.2, -2, 1.4, .08, 1.4, '#7fb7d9');
  } else if (t === 'clothes') {
    const cc = ['#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#a21caf', '#facc15'];
    for (let r = 0; r < 3; r++) { bx(-4.5 + r * 4.5, 0, 2.4, 3, 1.7, .08, '#444'); for (let k = 0; k < 6; k++) bx(-5.6 + r * 4.5 + k * .45, .5, 2.4, .35, 1.1, .3, cc[(k + r) % 6]); }
    bx(6.4, 0, -1, .12, 2.6, 2.4, '#9fd0e6'); bx(-6.4, 0, -3, .5, 2.4, 3, '#5b4636', true);
    for (let k = 0; k < 5; k++) bx(-6.1, .6 + (k % 3) * .7, -4 + k * .6, .3, .4, .5, cc[k]);
  } else if (t === 'pharma') {
    shelf(-4.5, -4.3, 4.4, .6, ['#ffffff', '#16a34a', '#ef4444', '#60a5fa']); shelf(4.5, -4.3, 4.4, .6, ['#ffffff', '#16a34a', '#facc15', '#60a5fa']);
    bx(0, 2.3, -RD / 2 + .2, 1.6, .5, .1, '#16a34a'); bx(0, 1.9, -RD / 2 + .2, .5, 1.3, .1, '#16a34a'); bx(-5.5, 0, 1, 1.2, 1, 2.5, '#e5e7eb', true);
  } else if (t === 'resto') {
    for (const [x, z] of [[-4.5, 1.2], [0, 2.2], [4.5, 1.2], [-4.5, 3.6], [4.5, 3.6]]) { bx(x, 0, z, 1.5, .8, 1.5, '#a16207', true); bx(x - 1.1, 0, z, .5, .5, .5, '#6b4423'); bx(x + 1.1, 0, z, .5, .5, .5, '#6b4423'); }
    bx(0, 1.3, -RD / 2 + .2, 6, 1.6, .1, '#2a1a0e'); bx(5.8, 0, -4.2, 1.2, 1.6, 1.2, '#444', true);
  } else if (t === 'super') {
    for (const x of [-4.5, -1.5, 1.5, 4.5]) shelf(x, 1.6, .9, 4.2, ['#ef4444', '#facc15', '#16a34a', '#2563eb', '#f97316'], 3);
  } else if (t === 'dealer') {
    R.cars = []; const types = ['sport', 'suv', 'taxi'];
    types.forEach((ty, k) => { const x = -4.4 + k * 4.4, z = .2; bx(x, 0, z, 3, .25, 4.2, '#222', true); const m = makeModel(ty, VT[ty].cols[0]); m.root.position.set(x, .25, z); m.root.scale.setScalar(.6); g.add(m.root); R.cars.push(m.root); });
  } else if (t === 'bank') {
    bx(-5, 0, 1, .15, 2.6, 6, '#9fd0e6'); bx(5.5, 0, -3.5, 1.2, 2, .9, '#334155', true); bx(5.5, 1.3, -3.9, .9, .6, .05, '#22c55e'); const v = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, .5, 20), mat('#9ca3af')); v.rotation.x = PI / 2; v.position.set(-4.6, 1.4, -RD / 2 + .5); g.add(v);
  } else if (t === 'police') {
    bx(-4.5, 0, 2.5, 2.2, .8, 1.1, '#7a5230', true); bx(4.5, 0, 2.5, 2.2, .8, 1.1, '#7a5230', true); bx(4.5, .8, 2.5, .6, .45, .1, '#111');
    for (let k = 0; k < 8; k++) bx(-6.4 + 0, 0, -4.7 + k * .55, .06, 2.6, .06, '#222'); bx(-6.4, 2.6, -2.5, .1, .08, 4.6, '#222'); bx(-6.7, 0, -3.5, .8, .4, 1.8, '#555'); // cellule
    bx(3.5, 1.2, -RD / 2 + .2, 3.2, 1.8, .08, '#7f1d1d'); for (let k = 0; k < 6; k++) bx(2.3 + k * .5, 1.5 + (k % 2) * .6, -RD / 2 + .25, .4, .5, .05, '#f3f4f6');
  } else if (t === 'barber') {
    for (const x of [-3.5, 0, 3.5]) { bx(x, 0, 1.2, 1, .8, 1, '#111', true); bx(x, .8, 1.5, .9, 1, .2, '#7f1d1d'); bx(x, 1.1, -RD / 2 + .2, 1.8, 1.4, .08, '#9fd0e6'); }
  } else if (t === 'garage') {
    bx(-3, 0, 1.5, 3.2, .35, 5, '#facc15', true); bx(4.8, 0, 1.5, 1.6, 1.2, 1.6, '#b91c1c', true); for (let k = 0; k < 4; k++) bx(5.4, k * .3, -4.2, 1.2, .3, 1.2, '#111');
    bx(-5.8, 1.2, -RD / 2 + .2, 3, 1.4, .08, '#6b7280');
  } else if (t === 'home') {
    bx(-4.5, 0, -3.6, 3, .6, 2.2, '#1d4ed8', true); bx(-4.5, .6, -4.4, 3, .3, .6, '#f5f5f5'); bx(4.4, 0, -4.8, 3.4, 1.6, .5, '#111'); bx(4.4, 0, -3.2, 2, .6, 1.2, '#7a5230', true); bx(6, 0, 2.4, 1.2, 2.2, 1.6, '#5b4636', true);
  }
  // clerk
  const spec = t === 'police' ? { ...COP_SPEC } : t === 'clothes' || t === 'barber' ? { ...LOOKS.passante, shirt: sp.col } : { ...LOOKS.passant, shirt: sp.col };
  const clerk = makeHuman(spec); clerk.root.position.set(0, 0, -3.9); g.add(clerk.root); R.clerkH = { model: clerk, kind: 'clerk' };
  R.collide = (e, r) => {
    let hit = false;
    for (const b of R.rects) { const cx = clamp(e.x, b.x0, b.x1), cz = clamp(e.z, b.z0, b.z1), dx = e.x - cx, dz = e.z - cz, d2 = dx * dx + dz * dz; if (d2 < r * r) { hit = true; if (d2 > 1e-6) { const d = Math.sqrt(d2); e.x += dx / d * (r - d); e.z += dz / d * (r - d); } else e.z = b.z1 + r; } }
    const x = e.x, z = e.z; e.x = clamp(e.x, R.minX + r, R.maxX - r); e.z = clamp(e.z, R.minZ + r, R.maxZ - r); return hit || x !== e.x || z !== e.z;
  };
  R.collide = R.collide.bind(R); return R;
}

/* ---------- marqueurs devant les portes ---------- */
const rings = [];
export function initShops() {
  load(); rooms.length = 0;
  SHOPS.forEach((sp, i) => {
    sp.room = buildRoom(sp, i); rooms.push(sp.room);
    const col = new THREE.Color(sp.col);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.3, 28), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false })); ring.rotation.x = -PI / 2; ring.position.set(sp.door.x, .22, sp.door.z); scene.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 7, 14, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false })); beam.position.set(sp.door.x, 3.5, sp.door.z); scene.add(beam);
    rings.push(ring);
  });
  lightI = new THREE.PointLight(0xfff0d0, 0, 40, 2); scene.add(lightI);
}
export const shopMarkers = () => SHOPS.map(s => ({ x: s.door.x, z: s.door.z, c: s.col, r: 3.4, label: s.name, sq: true, shop: s, icon: s.ic }));

/* ---------- entrée / sortie ---------- */
const P_ = () => G.P;
let nearDoor = null, nearCounter = false, nearExit = false;
function enter(sp) {
  const P = P_();
  if (G.wanted > 0 && sp.type !== 'police') { feed('Recherché ! La boutique ferme ses portes', '#f87171'); sfx('hit'); return; }
  if (G.transition) return; G.transition = true; fade(1, 160);
  setTimeout(() => {
    const R = sp.room; G.interior = R; R.g.visible = true; R.ret = { x: sp.door.x + sp.nx * 1.6, z: sp.door.z + sp.nz * 1.6, a: Math.atan2(sp.nx, sp.nz) };
    P.x = R.ox; P.z = R.oz + 3.7; P.a = PI; P.vx = P.vz = 0; CAM.yaw = PI; CAM.inited = false; if (P.model) P.model.root.rotation.y = P.a;
    fade(0, 260); G.transition = false; sfx('pickup'); say('', 'Bienvenue chez ' + sp.name + ' — va au comptoir (E)', 3);
  }, 180);
}
function leave() {
  const P = P_(), R = G.interior; if (!R || G.transition) return; closeShop(); G.transition = true; fade(1, 160);
  setTimeout(() => {
    const r = R.ret; G.interior = null; R.g.visible = false; P.x = r.x; P.z = r.z; P.a = r.a; P.vx = P.vz = 0; CAM.yaw = r.a; CAM.inited = false; lightI.intensity = 0;
    fade(0, 260); G.transition = false;
  }, 180);
}
/* E : renvoie true si l'appui a été consommé */
export function shopInteract() {
  if (G.shopOpen || G.transition) return true;
  if (G.interior) { if (nearExit) { leave(); return true; } if (nearCounter) { openShop(G.interior.def); return true; } return false; }
  if (nearDoor && !P_().car) { enter(nearDoor); return true; }
  return false;
}
export const isShopOpen = () => !!G.shopOpen;

/* ---------- boucle ---------- */
const prompt = $('prompt');
let tt = 0;
export function updShops(dt) {
  const P = P_(); tt += dt; const pr = (txt) => { if (txt) { prompt.textContent = txt; prompt.classList.add('on'); } else prompt.classList.remove('on'); };
  G.uiGrace = Math.max(0, (G.uiGrace || 0) - dt);
  if (G.boostT > 0) { G.boostT -= dt; if (!G.boostOn) { G.boostOn = true; G.speedMul = (G.speedMul || 1) * 1.25; } if (G.boostT <= 0) { G.boostOn = false; G.speedMul = (G.speedMul || 1) / 1.25; feed('L\'effet de l\'adrénaline se dissipe', '#9aa4b2'); } }
  for (const r of rings) { const k = 1 + Math.sin(tt * 3) * .12; r.scale.set(k, k, 1); }
  nearDoor = null; nearCounter = nearExit = false;
  if (G.shopOpen) { pr(''); return; }
  if (G.interior) {
    const R = G.interior; lightI.position.set(R.ox, 3.6, R.oz); lightI.intensity = 40 + 70 * night;
    nearExit = Math.hypot(P.x - R.ox, P.z - (R.oz + 4.4)) < 2.2; nearCounter = Math.hypot(P.x - R.ox, P.z - (R.oz - 2.7)) < 3.8;
    if (R.clerkH) { try { animHuman(R.clerkH, dt, 0); } catch (e) { /* ok */ } }
    if (R.cars) for (const c of R.cars) c.rotation.y += dt * .5;
    pr(nearExit ? 'E : Sortir' : nearCounter ? 'E : Parler au vendeur — ' + R.def.name : '');
    return;
  }
  if (G.cine || P.car) { pr(''); return; }
  let bd = 3.2; for (const s of SHOPS) { const d = Math.hypot(P.x - s.door.x, P.z - s.door.z); if (d < bd) { bd = d; nearDoor = s; } }
  pr(nearDoor ? (G.wanted > 0 && nearDoor.type !== 'police' ? '🔒 ' + nearDoor.name + ' (fermé : recherché)' : 'E : Entrer — ' + nearDoor.name) : '');
}

/* ---------- interface d'achat ---------- */
let cur = null;
const nf = n => '$' + n.toLocaleString('fr-FR');
export function closeShop() { G.shopOpen = false; cur = null; $('shop').classList.remove('on'); }
function openShop(sp) {
  G.shopOpen = true; G.uiGrace = .7; $('shop').classList.add('on'); cur = sp; try { document.exitPointerLock(); } catch (e) { /* ok */ } render();
}
$('shClose').onclick = () => closeShop();
$('shop').addEventListener('pointerdown', e => e.stopPropagation());
const hasW = k => !!G.P.inv[k];
function pay(price, fn) { if (G.cash < price) { feed('Pas assez d\'argent', '#f87171'); sfx('hit'); return; } G.cash -= price; fn(); sfx('pickup'); render(); }
function render() {
  if (!cur) return; const sp = cur, P = G.P;
  $('shTitle').textContent = sp.name; $('shCash').textContent = nf(G.cash) + (S.bank ? '  ·  banque ' + nf(S.bank) : '');
  const body = $('shBody'); body.innerHTML = ''; $('shSub').textContent = '';
  const sec = t => { const h = document.createElement('h4'); h.textContent = t; body.appendChild(h); };
  const item = (name, desc, price, label, fn, dis) => {
    const d = document.createElement('div'); d.className = 'it'; const t = document.createElement('div'); t.className = 't'; t.innerHTML = '<b></b><small></small>'; t.firstChild.innerHTML = name; t.lastChild.textContent = desc || ''; d.appendChild(t);
    const b = document.createElement('button'); b.textContent = label || (price != null ? nf(price) : 'OK'); if (dis) b.disabled = true; b.onclick = fn; d.appendChild(b); body.appendChild(d);
  };
  const buyI = (name, desc, price, fn, dis, label) => item(name, desc, price, label, () => pay(price, fn), dis || G.cash < price && false);
  const heal = n => { P.hp = Math.min(P.maxhp, P.hp + n); feed('+' + n + ' PV', '#7dff9a'); };
  const t = sp.type;
  if (t === 'arms') {
    $('shSub').textContent = 'Armes, munitions et protections';
    sec('Armes');
    const W = [['bat', 80], ['pistol', 300], ['smg', 1100], ['shotgun', 1300], ['rpg', 5000]], A = { pistol: 60, smg: 150, shotgun: 120, rpg: 800 };
    for (const [k, p] of W) { const w = WEAP[k]; if (!hasW(k)) buyI(w.name, w.melee ? 'Arme de mêlée' : 'Dégâts ' + w.dmg + (w.pel > 1 ? ' ×' + w.pel : '') + ' · chargeur ' + w.mag, p, () => { giveWeapon(k, 2); feed('Acheté : ' + w.name, '#ffd23a'); }); else if (!w.melee) buyI('Munitions ' + w.name, 'Possédé · +' + w.mag * 2 + ' balles', A[k], () => { giveWeapon(k, 2); feed('+' + w.mag * 2 + ' balles', '#ffd23a'); }); }
    sec('Protection');
    buyI('Gilet pare-balles léger', '+50 d\'armure', 350, () => { P.armor = Math.min(100, (P.armor || 0) + 50); feed('Armure ' + Math.round(P.armor), '#60a5fa'); });
    buyI('Gilet lourd', 'Armure complète (100)', 800, () => { P.armor = 100; feed('Armure 100', '#60a5fa'); });
  } else if (t === 'clothes') {
    $('shSub').textContent = P.hero.spec.glb ? 'Cette tenue de soldat ne se change pas — choisis un autre héros pour essayer les vêtements.' : 'Essaie une tenue : elle est appliquée tout de suite et sauvegardée';
    sec('Tenues');
    OUTFITS.forEach((o, i) => { const on = (S.outfit < 0 ? 0 : S.outfit) === i; buyI(o.n, o.d, o.p, () => { S.outfit = i; save(); rebuildPlayer(); feed('Tu portes : ' + o.n, '#e879f9'); }, on || !!P.hero.spec.glb, on ? 'Porté' : null); });
  } else if (t === 'barber') {
    sec('Couleur de cheveux');
    HAIRS.forEach((h, i) => { const on = (S.hair < 0 ? 0 : S.hair) === i; buyI('<span class="sw" style="background:' + h.c + '"></span>' + h.n, '', h.p, () => { S.hair = i; save(); rebuildPlayer(); feed('Nouvelle coupe : ' + h.n, '#fbbf24'); }, on || !!P.hero.spec.glb, on ? 'Actuel' : null); });
  } else if (t === 'pharma') {
    sec('Soins');
    buyI('Pansement', '+30 PV', 60, () => heal(30)); buyI('Trousse de secours', 'Soigne complètement', 150, () => heal(999));
    buyI('Adrénaline', 'Vitesse +25 % pendant 60 s', 200, () => { G.boostT = 60; feed('Adrénaline !', '#fbbf24'); });
    buyI('Gilet médical', '+30 d\'armure', 200, () => { P.armor = Math.min(100, (P.armor || 0) + 30); });
  } else if (t === 'resto') {
    sec('Au menu');
    buyI('Garba', 'Thon frit et attiéké · +25 PV', 25, () => heal(25)); buyI('Alloco poisson', '+40 PV', 40, () => heal(40)); buyI('Poulet braisé + bissap', 'Repas complet · soin total', 90, () => heal(999));
  } else if (t === 'super') {
    sec('Rayons');
    buyI('Bouteille d\'eau', '+5 PV', 10, () => heal(5)); buyI('Boisson énergisante', 'Vitesse +25 % pendant 30 s', 40, () => { G.boostT = 30; });
    const cu = P.cur; if (!WEAP[cu].melee && P.inv[cu]) buyI('Munitions ' + WEAP[cu].name, '+' + WEAP[cu].mag * 2 + ' balles', 90, () => { giveWeapon(cu, 2); feed('+' + WEAP[cu].mag * 2 + ' balles', '#ffd23a'); });
    buyI('Kit de réparation', 'Répare le véhicule le plus proche (< 80 m)', 120, () => repairNear());
  } else if (t === 'dealer') {
    $('shSub').textContent = 'Véhicules livrés devant la boutique (avions, bateaux, hélicos : au point d\'attache)';
    sec('À vendre');
    const CAT = [['moto', 1500], ['woro', 3500], ['sedan', 4000], ['gbaka', 5200], ['pickup', 6500], ['suv', 9000], ['speedboat', 14000], ['sport', 24000], ['avion', 45000], ['heli', 70000], ['tank', 120000]];
    for (const [ty, p] of CAT) { const T = VT[ty]; buyI(T.name, 'Vitesse max ' + Math.round(T.max * 3.6) + ' km/h · robustesse ' + T.hp, p, () => { const col = T.cols[0]; S.owned.push({ type: ty, col }); save(); deliver({ type: ty, col }, sp); feed('Livré : ' + T.name, '#ffd23a'); }); }
    ownedList(sec, item, sp);
  } else if (t === 'garage') {
    $('shSub').textContent = 'Travaille sur le véhicule le plus proche (moins de 80 m)';
    sec('Atelier');
    buyI('Réparation complète', 'Remet la caisse à neuf', 200, () => repairNear());
    buyI('Blindage', 'Robustesse ×1,6', 900, () => { const v = nearCar(); if (!v) { G.cash += 900; feed('Aucun véhicule à proximité', '#f87171'); return; } v.maxhp = (v.maxhp || v.hp) * 1.6; v.hp = v.maxhp; feed('Véhicule blindé', '#60a5fa'); });
    sec('Peinture');
    for (const [n, c] of [['Rouge', '#dc2626'], ['Noir', '#111827'], ['Blanc', '#f3f4f6'], ['Or', '#d4a017'], ['Bleu', '#1d4ed8'], ['Vert', '#16a34a']]) buyI('<span class="sw" style="background:' + c + '"></span>' + n, '', 120, () => paintNear(c));
    G.wanted > 0 || null;
  } else if (t === 'bank') {
    $('shSub').textContent = 'Solde en banque : ' + nf(S.bank) + ' — protégé si tu meurs';
    sec('Dépôt'); for (const a of [500, 2000, 5000]) item('Déposer ' + nf(a), '', null, 'Déposer', () => { if (G.cash < a) { feed('Pas assez de liquide', '#f87171'); return; } G.cash -= a; S.bank += a; save(); sfx('pickup'); render(); });
    item('Tout déposer', nf(G.cash), null, 'Tout', () => { S.bank += G.cash; G.cash = 0; save(); sfx('pickup'); render(); });
    sec('Retrait'); for (const a of [500, 2000, 5000]) item('Retirer ' + nf(a), '', null, 'Retirer', () => { if (S.bank < a) { feed('Solde insuffisant', '#f87171'); return; } S.bank -= a; G.cash += a; save(); sfx('pickup'); render(); });
    item('Tout retirer', nf(S.bank), null, 'Tout', () => { G.cash += S.bank; S.bank = 0; save(); sfx('pickup'); render(); });
  } else if (t === 'police') {
    $('shSub').textContent = G.wanted > 0 ? 'Tu es recherché : tu peux te rendre et payer la caution.' : 'Poste de police — tout est calme.';
    if (G.wanted > 0) { const bail = Math.round(G.cash * .1) + 100; sec('Justice'); item('Payer la caution', 'Casier effacé, les policiers rentrent', bail, nf(bail), () => pay(bail, () => { G.wanted = 0; for (const h of G.humans) if (h.kind === 'cop' && !h.keep) h.remove = true; for (const c of G.cars) if (c.mode === 'police') c.remove = true; feed('Caution payée. Tu es libre.', '#7dff9a'); })); }
    sec('Casier & statistiques'); item('Tes chiffres', G.kills + ' ennemis neutralisés · ' + G.deaths + ' fois K.O. · recherche : ' + (G.wanted > 0 ? Math.ceil(G.wanted) + ' ★' : 'aucune'), null, 'Info', () => { /* info */ }, true);
    sec('Équipement officiel'); buyI('Gilet pare-balles de police', '+60 d\'armure', 450, () => { P.armor = Math.min(100, (P.armor || 0) + 60); });
    item('Cellules', 'Visite interdite — ne cherche pas les ennuis.', null, '—', () => { }, true);
  } else if (t === 'home') {
    $('shSub').textContent = 'Ta planque : repos, sauvegarde et garage perso';
    sec('Repos'); item('Dormir jusqu\'au matin', 'Soins complets, 6 h du matin, sauvegarde', null, 'Dormir', () => { P.hp = P.maxhp; G.time = ((((6 / 24) - G.startHour) % 1) + 1) % 1 * DAYLEN; if (G.hooks.save) G.hooks.save(); feed('Bien dormi. Partie sauvegardée.', '#7dff9a'); sfx('win'); render(); });
    item('Sauvegarder', 'Enregistre l\'avancée de l\'histoire', null, 'Sauver', () => { if (G.hooks.save) G.hooks.save(); feed('Sauvegardé', '#7dff9a'); });
    ownedList(sec, item, sp);
  }
}
function ownedList(sec, item, sp) {
  sec('Mes véhicules'); if (!S.owned.length) { item('Aucun véhicule', 'Achète-en un chez Auto Plateau', null, '—', () => { }, true); return; }
  S.owned.forEach((o, i) => item(VT[o.type].name, 'Faire livrer devant la boutique', null, 'Livrer', () => { deliver(o, sp); feed('Véhicule livré', '#7dff9a'); }));
}
function curb(sp, k) {
  const gx = sp.gx, gz = sp.gz; let x = sp.x, z = sp.z;
  if (sp.nz === 1) z = (gz + 1) * 84 + 5; else if (sp.nz === -1) z = gz * 84 + 13; else if (sp.nx === 1) x = (gx + 1) * 84 + 5; else x = gx * 84 + 13;
  const al = sp.nz ? 1 : 0; return { x: x + (al ? (k % 4) * 6 - 6 : 0), z: z + (al ? 0 : (k % 4) * 6 - 6), a: al ? PI / 2 : 0 };
}
let dk = 0;
function deliver(o, sp) {
  const ty = o.type; let at;
  if (VT[ty].kind === 'boat') at = { x: POI.dock2.x + (dk++ % 3) * 9 - 9, z: -10, a: 0 }; else if (VT[ty].kind === 'plane') at = { x: POI.piste.x - 40 + (dk++ % 3) * 20, z: POI.piste.z, a: PI / 2 };
  else if (VT[ty].kind === 'heli') at = { x: POI.helipad.x + (dk++ % 3) * 10, z: POI.helipad.z, a: 0 }; else at = curb(sp, dk++);
  spawnVehicle(ty, at.x, at.z, at.a, 'parked', o.col);
}
function nearCar() { const P = G.P, R = G.interior; const ref = R ? R.ret : P; let b = null, bd = 80; for (const c of G.cars) { if (c.remote || c.wreck) continue; const d = Math.hypot(c.x - ref.x, c.z - ref.z); if (d < bd) { bd = d; b = c; } } return b; }
function repairNear() { const v = nearCar(); if (!v) { feed('Aucun véhicule à moins de 80 m', '#f87171'); return; } v.hp = v.maxhp || v.hp; feed('Véhicule réparé', '#7dff9a'); }
function paintNear(c) { const v = nearCar(); if (!v) { feed('Aucun véhicule à moins de 80 m', '#f87171'); return; } v.model.root.traverse(m => { if (m.isMesh && m.material && m.material.color && m.userData.body !== false && m.material.name !== 'glass') { /* repeint uniquement les matériaux sombres/colorés de carrosserie */ } }); tintBody(v, c); feed('Repeint !', '#fbbf24'); }
function tintBody(v, c) { const col = new THREE.Color(c); v.model.root.traverse(m => { if (m.isMesh && m.material && m.material.color && !m.material.transparent) { const l = m.material.color.getHSL({}).l; if (l > .12 && l < .9) { m.material = m.material.clone(); m.material.color.copy(col); } } }); }
G.hooks.shop = shopInteract;
