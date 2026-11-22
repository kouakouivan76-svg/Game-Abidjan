/* world.js — la ville d'Abidjan : quartiers, routes, lagune, port, camp militaire, aéroport, stade */
import { THREE, G, scene, nightFX, GB, C, N, BLOCK, ROAD, WORLD, AIRZ, ZMAX, clamp, rand, irand, pick, mulberry, PI } from './core.js';
import { wallMatRef } from './sky.js';

export const DIST = {
  plateau: { name: 'LE PLATEAU', ground: '#8d9096', walls: ['#7fa6c4', '#9bb7c9', '#6f8da8', '#a9b5be', '#8aa0a8'], roofs: ['#6b7280'] },
  cocody: { name: 'COCODY', ground: '#5f9a52', walls: ['#f2ead8', '#ecdcc0', '#e6c9a8', '#dfe8d6', '#f5f0e6'], roofs: ['#b5532f', '#9c4a2c'] },
  yop: { name: 'YOPOUGON', ground: '#b89a6b', walls: ['#d8b98a', '#c9a27a', '#bfae96', '#e0c9a6', '#b08968', '#c8c0b0'], roofs: ['#7b7f86', '#9a5b3a', '#5d7a8a', '#8d6e63', '#a1a5ab'] },
  marcory: { name: 'MARCORY', ground: '#9a9382', walls: ['#e9a6a6', '#a6c8e9', '#e9d6a6', '#a6e9c0', '#d6a6e9', '#f0c48a'], roofs: ['#6b7280', '#4b5563'] },
  adjame: { name: 'ADJAMÉ', ground: '#8a7f72', walls: ['#c9c2b4', '#b7b09f', '#d0b79a', '#aab4b9', '#c4a98a'], roofs: ['#4b5563', '#7b6f66'] },
  port: { name: 'PORT AUTONOME', ground: '#7d8186', walls: ['#a8b0b8', '#9aa3ab'], roofs: ['#5b636b'] },
  camp: { name: 'CAMP COMMANDO', ground: '#6e7a52', walls: ['#6b7f4a', '#5f7243'], roofs: ['#3f4d2c'] },
  air: { name: 'AÉROPORT', ground: '#7a7d80', walls: ['#d0d4d8'], roofs: ['#7b8087'] }
};
export function distOf(gx, gy) {
  if (gx >= 3 && gx <= 4 && gy >= 3 && gy <= 4) return 'plateau';
  if (gy === 0 && gx >= 5) return 'port';
  if (gx === 7 && gy === 3) return 'camp';
  if (gx <= 2) return 'yop';
  if (gy <= 2) return 'cocody';
  if (gy >= 5) return 'marcory';
  return 'adjame';
}
export function distAt(x, z) {
  if (z > WORLD + ROAD) return 'air';
  return distOf(clamp(Math.floor(x / BLOCK), 0, N - 1), clamp(Math.floor(z / BLOCK), 0, N - 1));
}
export const zoneName = (x, z) => z < -2 ? 'LAGUNE EBRIÉ' : DIST[distAt(x, z)].name;

/* Points d'intérêt (intersections et lieux) */
const I = (i, j) => ({ x: i * BLOCK + ROAD / 2, z: j * BLOCK + ROAD / 2 });
export const POI = {
  spawn: { ...I(3, 3), name: 'Place de la Pyramide' },
  planque: { ...I(1, 4), name: 'Planque' },
  maquis: { ...I(1, 3), name: "Maquis d'Adjoua" },
  yop_nord: { ...I(0, 1), name: 'Yopougon Nord' },
  yop_sud: { ...I(0, 6), name: 'Yopougon Sud' },
  garage: { ...I(2, 5), name: 'Garage Express' },
  stade: { x: 93, z: 135, name: 'Stade de Yop' },
  stade_c: { x: 135, z: 135, name: 'Pelouse du Stade' },
  marche: { ...I(6, 4), name: "Marché d'Adjamé" },
  gare: { ...I(5, 3), name: "Gare d'Adjamé" },
  port: { ...I(6, 0), name: 'Port Autonome' },
  port2: { ...I(7, 0), name: 'Quai des Conteneurs' },
  camp: { ...I(7, 2), name: 'Camp Commando' },
  camp_gate: { x: 597, z: 303, name: 'Porte du Camp' },
  camp_yard: { x: 645, z: 303, name: 'Cour du Camp' },
  aeroport: { x: 345, z: 681, name: 'Entrée Aéroport' },
  piste: { x: 345, z: 760, name: 'Piste' },
  piste_est: { x: 560, z: 760, name: 'Bout de piste' },
  piste_ouest: { x: 90, z: 760, name: 'Seuil de piste' },
  helipad: { x: 120, z: 716, name: 'Héliport' },
  tour: { ...I(4, 3), name: 'Tour Ébène' },
  banque: { ...I(4, 4), name: 'Banque Atlas' },
  villa: { ...I(5, 1), name: 'Villa de Cocody' },
  cocody2: { ...I(3, 1), name: 'Boulevard de Cocody' },
  zone4: { ...I(3, 6), name: 'Zone 4' },
  treich: { ...I(6, 6), name: 'Treichville' },
  marcory2: { ...I(5, 5), name: 'Marcory Résidentiel' },
  yop_haut: { ...I(2, 2), name: 'Yop Hauteurs' },
  hopital: { ...I(2, 1), name: 'Hôpital Général' },
  dock1: { x: 130, z: -3.4, name: 'Embarcadère Ouest' },
  dock2: { x: 345, z: -3.4, name: 'Embarcadère Plateau' },
  dock3: { x: 540, z: -3.4, name: 'Embarcadère du Port' },
  lagune1: { x: 200, z: -120, name: 'Lagune Ouest' },
  lagune2: { x: 345, z: -200, name: 'Lagune Centre' },
  lagune3: { x: 520, z: -140, name: 'Lagune Est' },
  lagune4: { x: 700, z: -260, name: 'Large' },
  lagune5: { x: 40, z: -260, name: 'Baie' },
  ile: { x: 400, z: -330, name: 'Île aux Contrebandiers' }
};
export function resolve(at) {
  if (!at) return null;
  if (typeof at === 'string') { const p = POI[at]; if (!p) throw new Error('POI inconnu: ' + at); return { x: p.x, z: p.z, y: p.y || 0 }; }
  if (Array.isArray(at)) return { x: at[0], z: at[1], y: at[2] || 0 };
  return { x: at.x, z: at.z, y: at.y || 0 };
}

/* Bâtiments : obstacles au sol (rectangles avec hauteur) */
export const bmap = {};
export function addRect(x, z, w, d, h, kind) {
  const gx = clamp(Math.floor(x / BLOCK), 0, N - 1), gz = clamp(Math.floor(z / BLOCK), 0, N - 1);
  (bmap[gx + ',' + gz] || (bmap[gx + ',' + gz] = [])).push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h, kind: kind || 'bld' });
}
/* Colliders ronds : palmiers, arbres, lampadaires, bancs, poubelles… (kind = type d'objet) */
export const cmap = {};
export function addCircle(x, z, r, h, kind) {
  const gx = clamp(Math.floor(x / BLOCK), 0, N - 1), gz = clamp(Math.floor(z / BLOCK), 0, N - 1);
  (cmap[gx + ',' + gz] || (cmap[gx + ',' + gz] = [])).push({ x, z, r, h, kind: kind || 'deco' });
}
const walls = new GB(), solid = new GB(), lamps = new GB(), signsGB = new GB(), glass = new GB();
const SIGNS = ['KJ INDUSTRIES', "CHEZ ADJOUA", 'GARAGE EXPRESS', 'PHARMACIE', 'ATTIÉKÉ POISSON', 'BOUTIQUE', 'CYBER CAFÉ', 'HÔTEL LAGUNE', 'BANQUE ATLAS', 'SUPERMARCHÉ', 'COIFFURE AWA', 'ALLOCO FRIT', 'PRESSING', 'PÂTISSERIE', 'TRANSFERT $', 'GROUPE ÉBÈNE', 'ARMURERIE DOZO', 'COMMISSARIAT', 'AUTO PLATEAU', 'WAX & STYLE', 'STUDIO', 'BARBIER'];
const SIGNCOL = ['#0a7d3e', '#c2410c', '#b91c1c', '#15803d', '#a16207', '#7c3aed', '#0e7490', '#1d4ed8', '#334155', '#be123c', '#c026d3', '#ea580c', '#0369a1', '#b45309', '#4d7c0f', '#111827', '#3f3f46', '#1e40af', '#b91c1c', '#a21caf', '#0f766e', '#92400e'];
function signAtlas() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 384; const g = cv.getContext('2d');
  SIGNS.forEach((s, i) => { const cx = (i % 4) * 128, cy = Math.floor(i / 4) * 64; g.fillStyle = SIGNCOL[i]; g.fillRect(cx, cy, 128, 64); g.strokeStyle = '#ffffffaa'; g.lineWidth = 3; g.strokeRect(cx + 3, cy + 3, 122, 58); g.fillStyle = '#fff'; g.font = 'bold 15px system-ui,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = s.split(' '); if (w.length > 1 && s.length > 11) { g.fillText(w[0], cx + 64, cy + 24); g.fillText(w.slice(1).join(' '), cx + 64, cy + 42); } else g.fillText(s, cx + 64, cy + 32); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function addSign(idx, face, cx, cz, w, d, y, sw, sh) {
  const col = C('#ffffff'), c = idx % 4, r = Math.floor(idx / 4), u0 = c / 4, u1 = (c + 1) / 4, v1 = 1 - r / 6, v0 = 1 - (r + 1) / 6, e = .08;
  const uv = [u0, v0, u1, v0, u1, v1, u0, v1];
  if (face === 0) signsGB.quad([cx - sw / 2, y, cz + d / 2 + e], [cx + sw / 2, y, cz + d / 2 + e], [cx + sw / 2, y + sh, cz + d / 2 + e], col, uv);
  else if (face === 1) signsGB.quad([cx + sw / 2, y, cz - d / 2 - e], [cx - sw / 2, y, cz - d / 2 - e], [cx - sw / 2, y + sh, cz - d / 2 - e], col, uv);
  else if (face === 2) signsGB.quad([cx + w / 2 + e, y, cz + sw / 2], [cx + w / 2 + e, y, cz - sw / 2], [cx + w / 2 + e, y + sh, cz - sw / 2], col, uv);
  else signsGB.quad([cx - w / 2 - e, y, cz - sw / 2], [cx - w / 2 - e, y, cz + sw / 2], [cx - w / 2 - e, y + sh, cz + sw / 2], col, uv);
}

/* ---------- boutiques : placement d'une façade dans un espace libre près d'un point ---------- */
function freeSpot(x, z, w, d, m) {
  const gx = clamp(Math.floor(x / BLOCK), 0, N - 1), gz = clamp(Math.floor(z / BLOCK), 0, N - 1);
  for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) {
    for (const b of bmap[i + ',' + j] || []) if (x - w / 2 - m < b.x1 && x + w / 2 + m > b.x0 && z - d / 2 - m < b.z1 && z + d / 2 + m > b.z0) return false;
    for (const c of cmap[i + ',' + j] || []) if (Math.abs(c.x - x) < w / 2 + m + c.r && Math.abs(c.z - z) < d / 2 + m + c.r) return false;
  }
  return true;
}
export const SHOPFRONTS = [];
export function placeShop(def) {
  const t = typeof def.near === 'string' ? POI[def.near] : { x: def.near[0], z: def.near[1] }, w = def.w || 9, d = def.d || 7;
  let best = null, bd = 1e9;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const bx0 = i * BLOCK + ROAD + 4, bx1 = (i + 1) * BLOCK - 4, bz0 = j * BLOCK + ROAD + 4, bz1 = (j + 1) * BLOCK - 4;
    if (Math.hypot((bx0 + bx1) / 2 - t.x, (bz0 + bz1) / 2 - t.z) > 260) continue; if (distOf(i, j) === 'camp' || distOf(i, j) === 'port') continue;
    for (let x = bx0 + w / 2; x <= bx1 - w / 2; x += 2) for (let z = bz0 + d / 2; z <= bz1 - d / 2; z += 2) {
      const dd = Math.hypot(x - t.x, z - t.z); if (dd >= bd) continue;
      // proche d'un bord de bloc : la façade regarde la rue
      const ex = Math.min(x - w / 2 - (bx0 - 4), (bx1 + 4) - (x + w / 2)), ez = Math.min(z - d / 2 - (bz0 - 4), (bz1 + 4) - (z + d / 2)); if (Math.min(ex, ez) > 12) continue;
      if (!freeSpot(x, z, w, d, 2.6)) continue; bd = dd; best = [x, z, i, j, bx0 - 4, bx1 + 4, bz0 - 4, bz1 + 4];
    }
  }
  if (!best) return null;
  const [x, z, i, j, ax0, ax1, az0, az1] = best, dW = x - w / 2 - ax0, dE = ax1 - (x + w / 2), dN = z - d / 2 - az0, dS = az1 - (z + d / 2), mn = Math.min(dW, dE, dN, dS);
  const face = mn === dS ? 0 : mn === dN ? 1 : mn === dE ? 2 : 3, nx = face === 2 ? 1 : face === 3 ? -1 : 0, nz = face === 0 ? 1 : face === 1 ? -1 : 0;
  const h = def.h || 5.2;
  addBuilding(x, z, w, d, h, def.wall || '#e8dcc4', def.roof || '#555', { noSign: true, noWin: false });
  const hw = nx ? d : w, ox = nx * (w / 2 + .06), oz = nz * (d / 2 + .06);
  // porte + vitrines + auvent
  const dk = C('#1b2733'), aw = C(def.awning || '#c2410c');
  if (nx) { solid.box(x + ox, 0, z, .2, 2.5, 1.8, dk); solid.box(x + ox, 1, z - 2.8, .2, 1.6, 2, C('#7fb7d9')); solid.box(x + ox, 1, z + 2.8, .2, 1.6, 2, C('#7fb7d9')); solid.box(x + nx * (w / 2 + .9), 3, z, 1.8, .15, Math.min(d - .6, 8), aw); }
  else { solid.box(x, 0, z + oz, 1.8, 2.5, .2, dk); solid.box(x - 2.8, 1, z + oz, 2, 1.6, .2, C('#7fb7d9')); solid.box(x + 2.8, 1, z + oz, 2, 1.6, .2, C('#7fb7d9')); solid.box(x, 3, z + nz * (d / 2 + .9), Math.min(w - .6, 8), .15, 1.8, aw); }
  addSign(def.sign, face, x, z, w, d, 3.5, Math.min(hw * .85, 7), Math.min(hw * .85, 7) * .42);
  const door = { x: x + nx * (w / 2 + 1.7), z: z + nz * (d / 2 + 1.7) };
  const sp = { ...def, x, z, w, d, face, nx, nz, door, gx: i, gz: j }; SHOPFRONTS.push(sp); return sp;
}
const rnd = mulberry(2026);
function addBuilding(x, z, w, d, h, wc, rc, o = {}) {
  walls.box(x, 0, z, w, h, d, C(wc), !o.noWin);
  solid.box(x, h, z, w + .7, .5, d + .7, C(rc));
  addRect(x, z, w, d, h + .5);
  // accessoires de toit
  if (h > 5 && rnd() < .7) { solid.box(x + (rnd() - .5) * w * .5, h + .5, z + (rnd() - .5) * d * .5, 1.8, 1.4, 1.8, C('#9ca3af')); }
  if (h > 8 && rnd() < .5) { const ax = x + (rnd() - .5) * w * .6, az = z + (rnd() - .5) * d * .6; solid.box(ax, h + .5, az, .25, 5, .25, C('#4b5563')); }
  if (o.balc) for (let k = 0; k < Math.floor(h / 3.4); k++) solid.box(x, 2.3 + k * 3.4, z + d / 2 + .5, w * .6, .22, 1, C('#e5e7eb'));
  // enseigne
  if (!o.noSign && h > 3 && rnd() < (o.signP ?? .4)) {
    const idx = o.signIdx ?? irand(0, SIGNS.length - 1), face = irand(0, 3), tall = h > 14;
    const sw = Math.min((face < 2 ? w : d) * .8, tall ? 9 : 6), sh = sw * .42;
    addSign(idx, face, x, z, w, d, tall ? Math.min(h * .45, 10) : 2.1, sw, sh);
  }
}
const cTrunk = C('#7a5230'), cLeaf = C('#2e8b3a'), cLeaf2 = C('#3fa34d'), cPole = C('#555a60'), cLamp = C('#ffe9a8');
function palm(x, z) {
  const h = 5.5 + rnd() * 2.4, lean = (rnd() - .5) * .5;
  solid.box(x, 0, z, .42, h * .55, .42, cTrunk); solid.box(x + lean * .4, h * .5, z, .36, h * .52, .36, cTrunk);
  addCircle(x, z, .45, h, 'tree');
  const y = h; solid.box(x + lean, y, z, 5.4, .2, 1.1, cLeaf); solid.box(x + lean, y + .06, z, 1.1, .2, 5.4, cLeaf2);
  solid.box(x + lean, y + .12, z, 3.6, .2, 3.6, cLeaf); solid.box(x + lean, y + .2, z, 1.3, .35, 1.3, C('#2b6b2f'));
}
function leafTree(x, z) { const h = 3 + rnd() * 2; addCircle(x, z, .6, h + 2, 'tree'); solid.box(x, 0, z, .5, h, .5, cTrunk); solid.box(x, h - .4, z, 3.4, 2.4, 3.4, cLeaf); solid.box(x, h + 1.6, z, 2.2, 1.4, 2.2, cLeaf2); }
export const lampPts = [];
function lamp(x, z) { addCircle(x, z, .3, 6.5, 'pole'); lamps.box(x, 0, z, .22, 6.5, .22, cPole); lamps.box(x, 6.4, z, .9, .2, .5, cLamp); lampPts.push(x, z); }
function kiosk(x, z) {
  const col = C(pick(['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#fcbf49', '#8338ec']));
  solid.box(x, 0, z, 3.2, 2.5, 2.4, col); solid.box(x, 2.5, z, 3.8, .2, 3, C('#3a3a3a')); addRect(x, z, 3.2, 2.4, 2.7);
}
function container(x, z, w, d, stack) {
  const col = C(pick(['#c1121f', '#1d4ed8', '#15803d', '#d97706', '#6b7280', '#7c3aed', '#0e7490']));
  for (let s = 0; s < stack; s++) { solid.box(x, s * 2.6, z, w, 2.55, d, s % 2 ? col.clone().multiplyScalar(.85) : col); }
  addRect(x, z, w, d, stack * 2.6);
}
function wall(x0, z0, x1, z1, h, col) { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; solid.box(cx, 0, cz, x1 - x0, h, z1 - z0, C(col)); addRect(cx, cz, x1 - x0, z1 - z0, h); }

/* Génération */
export let wallMat = null;
function winTexture(emissive) {
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s; const g = cv.getContext('2d'), r = mulberry(11);
  g.fillStyle = emissive ? '#000' : '#ececec'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * 32 + 7, y = j * 32 + 8;
    if (emissive) { if (r() < .45) { g.fillStyle = '#ffd37a'; g.fillRect(x, y, 18, 16); } }
    else { g.fillStyle = '#46556a'; g.fillRect(x, y, 18, 16); g.fillStyle = '#7b93b0'; g.fillRect(x, y, 18, 5); g.fillStyle = '#cfcfcf'; g.fillRect(x - 2, y + 17, 22, 2); }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
let waterTex = null, waterMesh = null;
export function buildWorld() {
  wallMat = new THREE.MeshLambertMaterial({ map: winTexture(false), vertexColors: true, emissive: 0xffffff, emissiveMap: winTexture(true), emissiveIntensity: 0 });
  wallMatRef.mat = wallMat;
  const r = rnd;
  for (let gx = 0; gx < N; gx++) for (let gy = 0; gy < N; gy++) {
    const D = distOf(gx, gy), cfg = DIST[D];
    const x0 = gx * BLOCK + ROAD, z0 = gy * BLOCK + ROAD, S = BLOCK - ROAD;
    solid.flat(x0, z0, x0 + S, z0 + S, .04, C(cfg.ground));
    const edge = C('#b4b0a4'); // trottoir
    solid.flat(x0, z0, x0 + S, z0 + 2, .06, edge); solid.flat(x0, z0 + S - 2, x0 + S, z0 + S, .06, edge); solid.flat(x0, z0, x0 + 2, z0 + S, .06, edge); solid.flat(x0 + S - 2, z0, x0 + S, z0 + S, .06, edge);
    const m = 5, ax = x0 + m, az = z0 + m, A = S - 2 * m;
    const wc = () => cfg.walls[Math.floor(r() * cfg.walls.length)], rc = () => cfg.roofs[Math.floor(r() * cfg.roofs.length)];
    if (D === 'plateau') {
      if (gx === 3 && gy === 3) { const cx = x0 + S / 2, cz = z0 + S / 2; solid.pyramid(cx, cz, 36, 40, C('#d4d8dc')); addRect(cx, cz, 34, 34, 28); }
      else if (gx === 4 && gy === 3) { // Tour Ébène
        addBuilding(x0 + S * .5, z0 + S * .5, 22, 22, 92, '#4c6a88', '#334155', { signIdx: 15, signP: 1 });
        addBuilding(x0 + S * .15, z0 + S * .85, 14, 14, 24, wc(), rc());
      } else if (gx === 4 && gy === 4) { addBuilding(x0 + S * .5, z0 + S * .5, 30, 26, 46, '#9bb7c9', '#4b5563', { signIdx: 8, signP: 1 }); }
      else { addBuilding(ax + A * .27, az + A * .27, 20 + r() * 8, 20 + r() * 8, 38 + r() * 40, wc(), rc()); addBuilding(ax + A * .74, az + A * .72, 22 + r() * 8, 22 + r() * 6, 28 + r() * 36, wc(), rc()); }
    } else if (D === 'cocody') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) addBuilding(ax + (i + .5) * A / 2 + rand(-2, 2), az + (j + .5) * A / 2 + rand(-2, 2), 15 + r() * 5, 15 + r() * 5, 6 + r() * 3, wc(), rc(), { signP: .15 });
    } else if (D === 'yop') {
      if (gx === 1 && gy === 1) { // Stade
        const sx = x0, sz = z0, e = sx + S, f = sz + S, hh = 9, col = '#cfd2d6';
        wall(sx, sz, e, sz + 6, hh, col); wall(sx, f - 6, e, f, hh, col); wall(sx, sz + 6, sx + 6, sz + 24, hh, col); wall(sx, sz + 42, sx + 6, f - 6, hh, col); wall(e - 6, sz + 6, e, sz + 24, hh, col); wall(e - 6, sz + 42, e, f - 6, hh, col);
        solid.flat(sx + 6, sz + 6, e - 6, f - 6, .1, C('#2f8f3a')); solid.flat(sx + 30, sz + 6, sx + 31, f - 6, .12, C('#e5e7eb'));
        solid.box(sx + 8, 0, sz + S / 2, .3, 3, 6, C('#e5e7eb')); solid.box(e - 8, 0, sz + S / 2, .3, 3, 6, C('#e5e7eb'));
      } else {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) addBuilding(ax + (i + .5) * A / 3, az + (j + .5) * A / 3, 11 + r() * 5, 11 + r() * 5, 4 + r() * 3, wc(), rc(), { signP: .3 });
      }
    } else if (D === 'marcory') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) addBuilding(ax + (i + .5) * A / 2, az + (j + .5) * A / 2, 20 + r() * 6, 20 + r() * 6, 12 + r() * 14, wc(), rc(), { balc: true });
    } else if (D === 'port') {
      for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) { if ((k + j) % 3 === 0 && gx !== 7) continue; container(ax + 8 + k * 14, az + 7 + j * 13, 11, 4.4, 1 + ((k * 3 + j) % 3)); }
      addBuilding(ax + A * .5, az + A * .88, 40, 10, 11, '#a8b0b8', '#5b636b', { signIdx: 9, signP: 1 });
      solid.box(ax + 6, 0, az + 4, .8, 26, .8, C('#f59e0b')); solid.box(ax + 6, 25, az + 14, .8, .8, 22, C('#f59e0b')); addRect(ax + 6, az + 4, 1, 1, 26);
    } else if (D === 'camp') {
      const f0x = x0, f0z = z0, f1x = x0 + S, f1z = z0 + S, fh = 2.6, fc = '#7a7f6a';
      wall(f0x, f0z, f1x, f0z + .7, fh, fc); wall(f0x, f1z - .7, f1x, f1z, fh, fc); wall(f1x - .7, f0z, f1x, f1z, fh, fc);
      wall(f0x, f0z, f0x + .7, 295, fh, fc); wall(f0x, 311, f0x + .7, f1z, fh, fc);   // portail ouvert à l'ouest
      addBuilding(f0x + 36, f0z + 9, 44, 9, 4.5, '#6b7f4a', '#3f4d2c', { noSign: true }); addBuilding(f0x + 36, f1z - 9, 44, 9, 4.5, '#6b7f4a', '#3f4d2c', { noSign: true });
      for (const [tx, tz] of [[f0x + 4, f0z + 4], [f1x - 4, f0z + 4], [f1x - 4, f1z - 4], [f0x + 4, f1z - 4]]) addBuilding(tx, tz, 5, 5, 11, '#5f7243', '#3f4d2c', { noSign: true, noWin: true });
      solid.flat(f0x + 12, 285, f1x - 8, 322, .1, C('#4b5563'));
    } else {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) addBuilding(ax + (i + .5) * A / 3, az + (j + .5) * A / 2, 13 + r() * 4, 20 + r() * 6, 8 + r() * 10, wc(), rc(), { signP: .5 });
    }
    if (D === 'cocody' || D === 'plateau' || D === 'marcory') for (let t = 8; t < S - 6; t += 13) { palm(x0 + 2, z0 + t); palm(x0 + S - 2, z0 + t + 4); palm(x0 + t + 3, z0 + 2); palm(x0 + t, z0 + S - 2); }
    if (D === 'cocody') for (let t = 0; t < 4; t++) leafTree(x0 + 10 + r() * (S - 20), z0 + 10 + r() * (S - 20));
    lamp(x0 + 1, z0 + S * .3); lamp(x0 + S - 1, z0 + S * .7); lamp(x0 + S * .3, z0 + S - 1); lamp(x0 + S * .7, z0 + 1);
    if (D === 'yop' || D === 'adjame' || D === 'marcory') { kiosk(x0 + 3.5, z0 + S * (.2 + r() * .6)); if (r() < .6) kiosk(x0 + S - 3.5, z0 + S * (.2 + r() * .6)); }
  }
  // routes (y .08) y compris l'allée sud vers l'aéroport
  const cRoad = C('#2b2d31'), cLine = C('#d8c75a'), cWhite = C('#e6e6e6');
  for (let k = 0; k < N; k++) solid.flat(k * BLOCK, 0, k * BLOCK + ROAD, WORLD + ROAD, .08, cRoad);
  for (let k = 0; k <= N; k++) solid.flat(0, k * BLOCK, WORLD, k * BLOCK + ROAD, .08, cRoad);
  for (let k = 0; k <= N; k++) { const c = k * BLOCK + ROAD / 2; for (let t = 0; t < WORLD; t += 7) { if ((t % BLOCK) < ROAD + 2) continue; if (k < N) solid.flat(c - .15, t, c + .15, t + 3.5, .12, cLine); solid.flat(t, c - .15, t + 3.5, c + .15, .12, cLine); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * BLOCK, z = j * BLOCK;
    for (let s = 1.5; s < ROAD - 1; s += 2.6) { solid.flat(x + s, z - 3.2, x + s + 1.2, z - .6, .12, cWhite); solid.flat(x + s, z + ROAD + .6, x + s + 1.2, z + ROAD + 3.2, .12, cWhite); solid.flat(x - 3.2, z + s, x - .6, z + s + 1.2, .12, cWhite); solid.flat(x + ROAD + .6, z + s, x + ROAD + 3.2, z + s + 1.2, .12, cWhite); }
  }
  buildAirport(); buildQuay();
  if (G.hooks.placeShops) G.hooks.placeShops();
  walls.mesh(wallMat); solid.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  lamps.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), false, false);
  makeLampPools();
  const atlas = signAtlas(); signsGB.mesh(new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide, vertexColors: false }), false, false);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x7d7a6e })); ground.rotation.x = -PI / 2; ground.position.set(WORLD / 2, 0, WORLD / 2); ground.receiveShadow = true; scene.add(ground);
  // lagune
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#2a6f9e'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .12})`; g.fillRect(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 16, 1.5); }
  waterTex = new THREE.CanvasTexture(cv); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(60, 20); waterTex.colorSpace = THREE.SRGBColorSpace;
  waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(3000, 700), new THREE.MeshPhongMaterial({ map: waterTex, color: 0xaad4ee, shininess: 90, specular: 0x88aacc })); waterMesh.rotation.x = -PI / 2; waterMesh.position.set(WORLD / 2, .05, -2 - 350); waterMesh.receiveShadow = true; scene.add(waterMesh);
}
export function updateWorld(dt) { if (waterTex) { waterTex.offset.x += dt * .004; waterTex.offset.y += dt * .002; } }

function buildAirport() {
  const z0 = WORLD + ROAD;
  solid.flat(0, z0, WORLD, ZMAX, .05, C('#6f8a58')); solid.flat(20, z0 + 4, WORLD - 20, z0 + 38, .07, C('#6a6e73'));
  solid.flat(40, 745, WORLD - 40, 777, .09, C('#35383c'));
  for (let t = 50; t < WORLD - 50; t += 16) solid.flat(t, 760.5, t + 8, 761.5, .11, C('#f1f1f1'));
  for (let k = 0; k < 6; k++) { solid.flat(46, 748 + k * 4.4, 58, 749.6 + k * 4.4, .11, C('#f1f1f1')); solid.flat(WORLD - 58, 748 + k * 4.4, WORLD - 46, 749.6 + k * 4.4, .11, C('#f1f1f1')); }
  solid.flat(WORLD / 2 - 4, 725, WORLD / 2 + 4, 745, .09, C('#35383c'));
  for (const hx of [70, 190, 480]) { addBuilding(hx, z0 + 30, 40, 22, 12, '#d0d4d8', '#7b8087', { signP: .6, signIdx: irand(0, 15) }); }
  addBuilding(540, z0 + 12, 14, 14, 24, '#e5e7eb', '#9ca3af', { noSign: true }); solid.box(540, 24.5, z0 + 12, 18, 3, 18, C('#38bdf8'));
  solid.flat(100, 700, 140, 732, .09, C('#4b5563'));
  const hc = C('#facc15'); solid.flat(114, 708, 116, 724, .11, hc); solid.flat(124, 708, 126, 724, .11, hc); solid.flat(116, 715, 124, 717, .11, hc);
}
function buildQuay() {
  solid.flat(-40, -3.2, WORLD + 40, 0, .1, C('#9a9a94')); solid.box(WORLD / 2, 0, -3.4, WORLD + 80, .35, .6, C('#6b6b66'));
  for (const px of [130, 345, 540]) { solid.box(px, -.05, -10, 6, .4, 14, C('#7a5a36')); solid.box(px - 3, 0, -10, .3, 1.2, 14, C('#5b4126')); solid.box(px + 3, 0, -10, .3, 1.2, 14, C('#5b4126')); }
}

/* Collisions */
const ZMIN = 3;
export function collide(e, r) {
  if (G.interior) return G.interior.collide(e, r);
  let hit = false; const gx = clamp(Math.floor(e.x / BLOCK), 0, N - 1), gz = clamp(Math.floor(e.z / BLOCK), 0, N - 1);
  for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) {
    const L = bmap[i + ',' + j]; if (!L) continue;
    for (const b of L) {
      const cx = clamp(e.x, b.x0, b.x1), cz = clamp(e.z, b.z0, b.z1), dx = e.x - cx, dz = e.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) { const d = Math.sqrt(d2); e.x += dx / d * (r - d); e.z += dz / d * (r - d); }
        else { const l = e.x - b.x0, rr = b.x1 - e.x, t = e.z - b.z0, bb = b.z1 - e.z, mn = Math.min(l, rr, t, bb); if (mn === l) e.x = b.x0 - r; else if (mn === rr) e.x = b.x1 + r; else if (mn === t) e.z = b.z0 - r; else e.z = b.z1 + r; }
      }
    }
  }
  for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) {
    const L = cmap[i + ',' + j]; if (!L) continue;
    for (const c of L) {
      const dx = e.x - c.x, dz = e.z - c.z, R = r + c.r, d2 = dx * dx + dz * dz;
      if (d2 < R * R) { hit = true; const d = Math.sqrt(d2) || .001; e.x += dx / d * (R - d); e.z += dz / d * (R - d); }
    }
  }
  const x = e.x, z = e.z; e.x = clamp(e.x, 3, WORLD - 3); e.z = clamp(e.z, ZMIN, ZMAX - 3);
  if (e.x !== x || e.z !== z) hit = true;
  return hit;
}
/* Bateaux : seulement sur la lagune */
export function collideBoat(e, r) {
  let hit = false; if (e.z > -3.6 - r * .3) { e.z = -3.6 - r * .3; hit = true; }
  if (e.x < -600) { e.x = -600; hit = true; } if (e.x > WORLD + 600) { e.x = WORLD + 600; hit = true; } if (e.z < -640) { e.z = -640; hit = true; }
  return hit;
}
/* Aéronefs : collisions avec les toits */
export function airHit(x, y, z, r) {
  const gx = clamp(Math.floor(x / BLOCK), 0, N - 1), gz = clamp(Math.floor(z / BLOCK), 0, N - 1);
  for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) { const L = bmap[i + ',' + j]; if (!L) continue; for (const b of L) if (y < b.h + .5 && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return b; }
  return null;
}
export function rayRect(ox, oz, dx, dz, b, maxT) {
  let t0 = 0, t1 = maxT; const ps = [-dx, dx, -dz, dz], qs = [ox - b.x0, b.x1 - ox, oz - b.z0, b.z1 - oz];
  for (let i = 0; i < 4; i++) { const p = ps[i], q = qs[i]; if (Math.abs(p) < 1e-9) { if (q < 0) return Infinity; } else { const r = q / p; if (p < 0) { if (r > t1) return Infinity; if (r > t0) t0 = r; } else { if (r < t0) return Infinity; if (r < t1) t1 = r; } } }
  return t0;
}
export function segBuildingT(ox, oz, dx, dz, maxT, y) {
  const ex = ox + dx * maxT, ez = oz + dz * maxT;
  const g0 = clamp(Math.floor(Math.min(ox, ex) / BLOCK), 0, N - 1), g1 = clamp(Math.floor(Math.max(ox, ex) / BLOCK), 0, N - 1), h0 = clamp(Math.floor(Math.min(oz, ez) / BLOCK), 0, N - 1), h1 = clamp(Math.floor(Math.max(oz, ez) / BLOCK), 0, N - 1);
  let best = Infinity;
  for (let i = g0; i <= g1; i++) for (let j = h0; j <= h1; j++) { const L = bmap[i + ',' + j]; if (!L) continue; for (const b of L) { if (y != null && y > b.h) continue; const t = rayRect(ox, oz, dx, dz, b, maxT); if (t < best) best = t; } }
  return best;
}
export function insideBuilding(x, z) {
  const gx = clamp(Math.floor(x / BLOCK), 0, N - 1), gz = clamp(Math.floor(z / BLOCK), 0, N - 1), L = bmap[gx + ',' + gz]; if (!L) return false;
  for (const b of L) if (x > b.x0 - .6 && x < b.x1 + .6 && z > b.z0 - .6 && z < b.z1 + .6) return true; return false;
}

/* Génération de points aléatoires */
export function sidewalkPoint(cx, cz, rmin, rmax) {
  for (let t = 0; t < 14; t++) {
    const ang = rand(0, 6.28), d = rand(rmin, rmax); let x = cx + Math.sin(ang) * d, z = cz + Math.cos(ang) * d;
    if (Math.random() < .5) { const k = clamp(Math.round(x / BLOCK), 0, N - 1); x = k * BLOCK + (Math.random() < .5 ? ROAD + rand(.8, 3) : -rand(.8, 3)); }
    else { const k = clamp(Math.round(z / BLOCK), 0, N - 1); z = k * BLOCK + (Math.random() < .5 ? ROAD + rand(.8, 3) : -rand(.8, 3)); }
    x = clamp(x, 6, WORLD - 6); z = clamp(z, 6, WORLD + ROAD - 4); const tmp = { x, z }; if (!collide(tmp, .7)) return tmp;
  }
  return null;
}
export function lanePoint(cx, cz, rmin, rmax) {
  const dir = irand(0, 3), k = irand(0, N - 1), c0 = k * BLOCK + ROAD / 2; let x, z, a; const along = (dir < 2 ? cx : cz) + rand(-rmax, rmax);
  if (dir === 0) { a = PI / 2; z = c0 + ROAD / 4; x = along; } else if (dir === 1) { a = -PI / 2; z = c0 - ROAD / 4; x = along; } else if (dir === 2) { a = 0; x = c0 - ROAD / 4; z = along; } else { a = PI; x = c0 + ROAD / 4; z = along; }
  x = clamp(x, 8, WORLD - 8); z = clamp(z, 8, WORLD - 8); if (Math.hypot(x - cx, z - cz) < rmin) return null; return { x, z, a };
}
export function interPoint(cx, cz, minD, notDist) {
  for (let t = 0; t < 30; t++) { const i = irand(0, N - 1), j = irand(0, N - 1), x = i * BLOCK + ROAD / 2, z = j * BLOCK + ROAD / 2; if (Math.hypot(x - cx, z - cz) < minD) continue; if (notDist && distOf(i, j) === notDist) continue; return { x, z }; }
  return { x: 261 + 160, z: 261 };
}
/* Itinéraire routier (en L par la grille) */
export function routeBetween(a, b) {
  const ia = clamp(Math.round((a.x - ROAD / 2) / BLOCK), 0, N - 1), ja = clamp(Math.round((a.z - ROAD / 2) / BLOCK), 0, N - 1);
  const ib = clamp(Math.round((b.x - ROAD / 2) / BLOCK), 0, N - 1), jb = clamp(Math.round((b.z - ROAD / 2) / BLOCK), 0, N - 1);
  const pts = []; const gx = i => i * BLOCK + ROAD / 2, gz = j => j * BLOCK + ROAD / 2;
  pts.push({ x: gx(ia), z: gz(ja) }); let i = ia, j = ja;
  while (i !== ib) { i += Math.sign(ib - i); pts.push({ x: gx(i), z: gz(j) }); }
  while (j !== jb) { j += Math.sign(jb - j); pts.push({ x: gx(i), z: gz(j) }); }
  return pts;
}

/* ---------- Collisions orientées (boîte tournée vs bâtiments) ---------- */
/* e : {x,z,a}  hl = demi-longueur (axe avant), hw = demi-largeur.  Retourne null ou {nx,nz,depth} (normale = vers l'extérieur du mur) */
export function collideBox(e, hl, hw) {
  let best = null; const gx = clamp(Math.floor(e.x / BLOCK), 0, N - 1), gz = clamp(Math.floor(e.z / BLOCK), 0, N - 1);
  const fx = Math.sin(e.a), fz = Math.cos(e.a), sx = fz, sz = -fx; // avant / côté
  for (let pass = 0; pass < 2; pass++) {
    let any = false;
    for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) {
      const L = bmap[i + ',' + j]; if (!L) continue;
      for (const b of L) {
        const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2, hx = (b.x1 - b.x0) / 2, hz = (b.z1 - b.z0) / 2, dx = e.x - bx, dz = e.z - bz;
        if (Math.abs(dx) > hx + hl + hw + .1 || Math.abs(dz) > hz + hl + hw + .1) continue;
        // axes : X, Z, avant, côté
        const ex = Math.abs(fx) * hl + Math.abs(sx) * hw, ez = Math.abs(fz) * hl + Math.abs(sz) * hw; // projection de la boîte sur X, Z
        const ox = hx + ex - Math.abs(dx), oz = hz + ez - Math.abs(dz); if (ox <= 0 || oz <= 0) continue;
        const pf = Math.abs(dx * fx + dz * fz), ps = Math.abs(dx * sx + dz * sz);
        const rf = hl + hx * Math.abs(fx) + hz * Math.abs(fz), rs = hw + hx * Math.abs(sx) + hz * Math.abs(sz);
        const of = rf - pf, os = rs - ps; if (of <= 0 || os <= 0) continue;
        let nx = 0, nz = 0, d = ox;
        if (ox <= oz) { nx = dx >= 0 ? 1 : -1; d = ox; } else { nz = dz >= 0 ? 1 : -1; d = oz; }
        if (of < d) { const s = (dx * fx + dz * fz) >= 0 ? 1 : -1; nx = fx * s; nz = fz * s; d = of; }
        if (os < d) { const s = (dx * sx + dz * sz) >= 0 ? 1 : -1; nx = sx * s; nz = sz * s; d = os; }
        e.x += nx * d; e.z += nz * d; any = true; if (!best || d > best.depth) best = { nx, nz, depth: d };
      }
    }
    for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) {
      const L = cmap[i + ',' + j]; if (!L) continue;
      for (const c of L) {
        const dx = c.x - e.x, dz = c.z - e.z, lf = dx * fx + dz * fz, ls = dx * sx + dz * sz;
        const qf = lf - clamp(lf, -hl, hl), qs = ls - clamp(ls, -hw, hw), d2 = qf * qf + qs * qs;
        if (d2 >= c.r * c.r) continue;
        let px, pz, d;
        if (d2 > 1e-6) { const dd = Math.sqrt(d2); d = c.r - dd; px = -(qf * fx + qs * sx) / dd; pz = -(qf * fz + qs * sz) / dd; }
        else { const m = Math.hypot(dx, dz) || 1; d = c.r; px = -dx / m; pz = -dz / m; }
        e.x += px * d; e.z += pz * d; any = true; if (!best || d > best.depth) best = { nx: px, nz: pz, depth: d, kind: c.kind };
      }
    }
    if (!any) break;
  }
  const x = e.x, z = e.z; e.x = clamp(e.x, 3 + hw, WORLD - 3 - hw); e.z = clamp(e.z, ZMIN + hw, ZMAX - 3 - hw);
  if (e.x !== x) best = { nx: x < e.x ? 1 : -1, nz: 0, depth: Math.abs(x - e.x) }; else if (e.z !== z) best = { nx: 0, nz: z < e.z ? 1 : -1, depth: Math.abs(z - e.z) };
  return best;
}
/* Cercle (piéton) contre boîte tournée */
export function pushFromBox(e, r, bx, bz, a, hl, hw) {
  const fx = Math.sin(a), fz = Math.cos(a), dx = e.x - bx, dz = e.z - bz; let lf = dx * fx + dz * fz, ls = dx * fz - dz * fx;
  const cf = clamp(lf, -hl, hl), cs = clamp(ls, -hw, hw), qf = lf - cf, qs = ls - cs, d2 = qf * qf + qs * qs; if (d2 >= r * r) return false;
  let pf, ps;
  if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; pf = qf * k; ps = qs * k; } else { if (hl - Math.abs(lf) < hw - Math.abs(ls)) { pf = (lf >= 0 ? 1 : -1) * (hl - Math.abs(lf) + r); ps = 0; } else { ps = (ls >= 0 ? 1 : -1) * (hw - Math.abs(ls) + r); pf = 0; } }
  e.x += pf * fx + ps * fz; e.z += pf * fz - ps * fx; return true;
}

/* ---------- éclairage nocturne : halos au sol sous chaque lampadaire ---------- */
export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,236,170,1)'); g.addColorStop(.35, 'rgba(255,214,130,.55)'); g.addColorStop(1, 'rgba(255,200,100,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t;
}
function makeLampPools() {
  const n = lampPts.length / 2, tex = glowTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-PI / 2); const im = new THREE.InstancedMesh(geo, mat, n), m = new THREE.Matrix4(), s = new THREE.Vector3(26, 1, 26), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { m.compose(new THREE.Vector3(lampPts[i * 2], .16, lampPts[i * 2 + 1]), q, s); im.setMatrixAt(i, m); }
  im.frustumCulled = false; im.renderOrder = 3; scene.add(im); nightFX.pool = mat;
  const hmat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); nightFX.halo = hmat;
  const hg = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }), n);
  for (let i = 0; i < n; i++) { m.compose(new THREE.Vector3(lampPts[i * 2], 6.4, lampPts[i * 2 + 1]), q, new THREE.Vector3(7, 7, 1)); hg.setMatrixAt(i, m); }
  hg.frustumCulled = false; scene.add(hg); nightFX.haloMesh = hg;
}
