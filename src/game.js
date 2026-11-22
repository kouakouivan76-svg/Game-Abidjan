import * as THREE from 'three';

/* =====================================================================
   ABIDJAN CITY 3D — KJ Industries
   Convention : x = est, z = sud. Un angle `a` => direction avant (sin a, cos a).
   ===================================================================== */

const $ = id => document.getElementById(id);
const PI = Math.PI;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const adiff = (a, b) => { let d = a - b; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; };
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const C = h => new THREE.Color(h);

/* ---------------------------------------------------------------- 3D de base */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.4, 700);
const hemi = new THREE.HemisphereLight(0xdfefff, 0x8a7a5a, 1.6);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.4); sun.position.set(120, 220, 70);
scene.add(hemi, sun);
scene.background = C('#8ec9f0'); scene.fog = new THREE.Fog(0x8ec9f0, 70, 380);
function onResize() { renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', onResize); onResize();

/* ---------------------------------------------------------------- Monde */
const N = 8, BLOCK = 84, ROAD = 18, WORLD = N * BLOCK;
const SPAWN = { x: 3 * BLOCK + ROAD / 2, z: 3 * BLOCK + ROAD / 2 };
const DIST = {
  plateau: { name: 'LE PLATEAU', ground: '#8d9096', walls: ['#7fa6c4', '#9bb7c9', '#6f8da8', '#a9b5be', '#8aa0a8'], roofs: ['#6b7280'] },
  cocody: { name: 'COCODY', ground: '#5f9a52', walls: ['#f2ead8', '#ecdcc0', '#e6c9a8', '#dfe8d6', '#f5f0e6'], roofs: ['#b5532f', '#9c4a2c'] },
  yop: { name: 'YOPOUGON', ground: '#b89a6b', walls: ['#d8b98a', '#c9a27a', '#bfae96', '#e0c9a6', '#b08968', '#c8c0b0'], roofs: ['#7b7f86', '#9a5b3a', '#5d7a8a', '#8d6e63', '#a1a5ab'] },
  marcory: { name: 'MARCORY', ground: '#9a9382', walls: ['#e9a6a6', '#a6c8e9', '#e9d6a6', '#a6e9c0', '#d6a6e9', '#f0c48a'], roofs: ['#6b7280', '#4b5563'] },
  adjame: { name: 'ADJAMÉ', ground: '#8a7f72', walls: ['#c9c2b4', '#b7b09f', '#d0b79a', '#aab4b9', '#c4a98a'], roofs: ['#4b5563', '#7b6f66'] }
};
function distOf(gx, gy) {
  if (gx >= 3 && gx <= 4 && gy >= 3 && gy <= 4) return 'plateau';
  if (gx <= 2) return 'yop';
  if (gy <= 2) return 'cocody';
  if (gy >= 5) return 'marcory';
  return 'adjame';
}
const distAt = (x, z) => distOf(clamp(Math.floor(x / BLOCK), 0, N - 1), clamp(Math.floor(z / BLOCK), 0, N - 1));

/* Constructeur de géométrie fusionnée (très peu d'appels de dessin) */
class GB {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.v = 0; }
  quad(a, b, c, col, uv) {
    const d = [a[0] + c[0] - b[0], a[1] + c[1] - b[1], a[2] + c[2] - b[2]];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = ab[1] * ac[2] - ab[2] * ac[1], ny = ab[2] * ac[0] - ab[0] * ac[2], nz = ab[0] * ac[1] - ab[1] * ac[0];
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const q of [a, b, c, d]) { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
    this.u.push(...(uv || [0, 0, 0, 0, 0, 0, 0, 0]));
    const v = this.v; this.i.push(v, v + 1, v + 2, v, v + 2, v + 3); this.v += 4;
  }
  tri(a, b, c, col) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = ab[1] * ac[2] - ab[2] * ac[1], ny = ab[2] * ac[0] - ab[0] * ac[2], nz = ab[0] * ac[1] - ab[1] * ac[0];
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const q of [a, b, c]) { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
    this.u.push(0, 0, 0, 0, 0, 0);
    const v = this.v; this.i.push(v, v + 1, v + 2); this.v += 3;
  }
  box(x, y, z, w, h, d, col, wall) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y0 = y, y1 = y + h;
    const U = wall ? L => [0, 0, L / 12, 0, L / 12, h / 12, 0, h / 12] : () => null;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], col, U(d));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], col, U(d));
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], col, U(w));
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], col, U(w));
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], col, null);
  }
  flat(x0, z0, x1, z1, y, col) { this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], col, null); }
  pyramid(cx, cz, s, h, col) {
    const x0 = cx - s / 2, x1 = cx + s / 2, z0 = cz - s / 2, z1 = cz + s / 2, ap = [cx, h, cz];
    const k = [[x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [x0, 0, z1]];
    for (let i = 0; i < 4; i++) this.tri(k[i], k[(i + 1) % 4], ap, col);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); scene.add(m); return m;
  }
}

function winTexture(emissive) {
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d'), r = mulberry(11);
  g.fillStyle = emissive ? '#000' : '#ececec'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * 32 + 7, y = j * 32 + 8;
    if (emissive) { if (r() < .45) { g.fillStyle = '#ffd37a'; g.fillRect(x, y, 18, 16); } }
    else { g.fillStyle = '#46556a'; g.fillRect(x, y, 18, 16); g.fillStyle = '#7b93b0'; g.fillRect(x, y, 18, 5); }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const wallMat = new THREE.MeshLambertMaterial({ map: winTexture(false), vertexColors: true, emissive: 0xffffff, emissiveMap: winTexture(true), emissiveIntensity: 0 });

const walls = new GB(), solid = new GB(), lamps = new GB();
const bmap = {};
function addRect(x, z, w, d) {
  const gx = clamp(Math.floor(x / BLOCK), 0, N - 1), gz = clamp(Math.floor(z / BLOCK), 0, N - 1);
  (bmap[gx + ',' + gz] || (bmap[gx + ',' + gz] = [])).push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
}
function addBuilding(x, z, w, d, h, wc, rc) {
  walls.box(x, 0, z, w, h, d, C(wc), true);
  solid.box(x, h, z, w + .6, .5, d + .6, C(rc));
  addRect(x, z, w, d);
}
const cTrunk = C('#7a5230'), cLeaf = C('#2e8b3a'), cLeaf2 = C('#3fa34d'), cPole = C('#555a60'), cLamp = C('#ffe9a8');
function palm(x, z) {
  const h = 5.5 + Math.random() * 2;
  solid.box(x, 0, z, .45, h, .45, cTrunk); solid.box(x, h, z, 5.4, .22, 1.1, cLeaf); solid.box(x, h + .05, z, 1.1, .22, 5.4, cLeaf2); solid.box(x, h + .2, z, 1.5, .3, 1.5, cLeaf);
}
function lamp(x, z) { lamps.box(x, 0, z, .22, 6.5, .22, cPole); lamps.box(x, 6.4, z, .9, .2, .5, cLamp); }
function kiosk(x, z) {
  const col = C(pick(['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#fcbf49', '#8338ec']));
  solid.box(x, 0, z, 3.2, 2.5, 2.4, col); solid.box(x, 2.5, z, 3.8, .2, 3, C('#3a3a3a')); addRect(x, z, 3.2, 2.4);
}

(function genCity() {
  const r = mulberry(2026);
  for (let gx = 0; gx < N; gx++) for (let gy = 0; gy < N; gy++) {
    const D = distOf(gx, gy), cfg = DIST[D];
    const x0 = gx * BLOCK + ROAD, z0 = gy * BLOCK + ROAD, S = BLOCK - ROAD;
    solid.flat(x0, z0, x0 + S, z0 + S, .04, C(cfg.ground));
    const m = 4, ax = x0 + m, az = z0 + m, A = S - 2 * m;
    const wc = () => cfg.walls[Math.floor(r() * cfg.walls.length)], rc = () => cfg.roofs[Math.floor(r() * cfg.roofs.length)];
    if (D === 'plateau') {
      if (gx === 3 && gy === 3) {   // La Pyramide
        const cx = x0 + S / 2, cz = z0 + S / 2; solid.pyramid(cx, cz, 36, 40, C('#d4d8dc')); addRect(cx, cz, 34, 34);
      } else {
        addBuilding(ax + A * .27, az + A * .27, 20 + r() * 8, 20 + r() * 8, 38 + r() * 40, wc(), rc());
        addBuilding(ax + A * .74, az + A * .72, 22 + r() * 8, 22 + r() * 6, 28 + r() * 36, wc(), rc());
      }
    } else if (D === 'cocody') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
        addBuilding(ax + (i + .5) * A / 2 + rand(-2, 2), az + (j + .5) * A / 2 + rand(-2, 2), 15 + r() * 5, 15 + r() * 5, 6 + r() * 3, wc(), rc());
    } else if (D === 'yop') {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
        addBuilding(ax + (i + .5) * A / 3, az + (j + .5) * A / 3, 11 + r() * 5, 11 + r() * 5, 4 + r() * 3, wc(), rc());
    } else if (D === 'marcory') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
        addBuilding(ax + (i + .5) * A / 2, az + (j + .5) * A / 2, 20 + r() * 6, 20 + r() * 6, 12 + r() * 14, wc(), rc());
    } else {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
        addBuilding(ax + (i + .5) * A / 3, az + (j + .5) * A / 2, 13 + r() * 4, 20 + r() * 6, 8 + r() * 10, wc(), rc());
    }
    if (D === 'cocody' || D === 'plateau' || D === 'marcory') {
      for (let t = 8; t < S - 6; t += 13) { palm(x0 + 2, z0 + t); palm(x0 + S - 2, z0 + t + 4); palm(x0 + t + 3, z0 + 2); palm(x0 + t, z0 + S - 2); }
    }
    lamp(x0 + 1, z0 + S * .3); lamp(x0 + S - 1, z0 + S * .7); lamp(x0 + S * .3, z0 + S - 1); lamp(x0 + S * .7, z0 + 1);
    if (D === 'yop' || D === 'adjame' || D === 'marcory') { kiosk(x0 + 3, z0 + S * (.2 + r() * .6)); if (r() < .6) kiosk(x0 + S - 3, z0 + S * (.2 + r() * .6)); }
  }
  // routes
  const cRoad = C('#2b2d31'), cLine = C('#d8c75a'), cWhite = C('#e6e6e6');
  for (let k = 0; k < N; k++) {
    solid.flat(k * BLOCK, 0, k * BLOCK + ROAD, WORLD, .08, cRoad);
    solid.flat(0, k * BLOCK, WORLD, k * BLOCK + ROAD, .08, cRoad);
  }
  for (let k = 0; k < N; k++) {
    const c = k * BLOCK + ROAD / 2;
    for (let t = 0; t < WORLD; t += 7) {
      if ((t % BLOCK) < ROAD + 2) continue;
      solid.flat(c - .15, t, c + .15, t + 3.5, .12, cLine);
      solid.flat(t, c - .15, t + 3.5, c + .15, .12, cLine);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * BLOCK, z = j * BLOCK;
    for (let s = 1.5; s < ROAD - 1; s += 2.6) {
      solid.flat(x + s, z - 3.2, x + s + 1.2, z - .6, .12, cWhite); solid.flat(x + s, z + ROAD + .6, x + s + 1.2, z + ROAD + 3.2, .12, cWhite);
      solid.flat(x - 3.2, z + s, x - .6, z + s + 1.2, .12, cWhite); solid.flat(x + ROAD + .6, z + s, x + ROAD + 3.2, z + s + 1.2, .12, cWhite);
    }
  }
  walls.mesh(wallMat);
  solid.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  lamps.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: 0x7d7a6e }));
  ground.rotation.x = -PI / 2; ground.position.set(WORLD / 2, 0, WORLD / 2); scene.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 700), new THREE.MeshLambertMaterial({ color: 0x2a6f9e }));
  water.rotation.x = -PI / 2; water.position.set(WORLD / 2, .05, -8 - 350); scene.add(water);   // la lagune, au nord
})();

/* Collisions */
function collide(e, r) {
  let hit = false; const gx = Math.floor(e.x / BLOCK), gz = Math.floor(e.z / BLOCK);
  for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) {
    const L = bmap[i + ',' + j]; if (!L) continue;
    for (const b of L) {
      const cx = clamp(e.x, b.x0, b.x1), cz = clamp(e.z, b.z0, b.z1), dx = e.x - cx, dz = e.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) { const d = Math.sqrt(d2); e.x += dx / d * (r - d); e.z += dz / d * (r - d); }
        else {
          const l = e.x - b.x0, rr = b.x1 - e.x, t = e.z - b.z0, bb = b.z1 - e.z, mn = Math.min(l, rr, t, bb);
          if (mn === l) e.x = b.x0 - r; else if (mn === rr) e.x = b.x1 + r; else if (mn === t) e.z = b.z0 - r; else e.z = b.z1 + r;
        }
      }
    }
  }
  e.x = clamp(e.x, 3, WORLD - 3); e.z = clamp(e.z, 3, WORLD - 3);
  return hit;
}
function rayRect(ox, oz, dx, dz, b, maxT) {
  let t0 = 0, t1 = maxT;
  const ps = [-dx, dx, -dz, dz], qs = [ox - b.x0, b.x1 - ox, oz - b.z0, b.z1 - oz];
  for (let i = 0; i < 4; i++) {
    const p = ps[i], q = qs[i];
    if (Math.abs(p) < 1e-9) { if (q < 0) return Infinity; }
    else { const r = q / p; if (p < 0) { if (r > t1) return Infinity; if (r > t0) t0 = r; } else { if (r < t0) return Infinity; if (r < t1) t1 = r; } }
  }
  return t0;
}
function segBuildingT(ox, oz, dx, dz, maxT) {
  const ex = ox + dx * maxT, ez = oz + dz * maxT;
  const g0 = clamp(Math.floor(Math.min(ox, ex) / BLOCK), 0, N - 1), g1 = clamp(Math.floor(Math.max(ox, ex) / BLOCK), 0, N - 1);
  const h0 = clamp(Math.floor(Math.min(oz, ez) / BLOCK), 0, N - 1), h1 = clamp(Math.floor(Math.max(oz, ez) / BLOCK), 0, N - 1);
  let best = Infinity;
  for (let i = g0; i <= g1; i++) for (let j = h0; j <= h1; j++) { const L = bmap[i + ',' + j]; if (!L) continue; for (const b of L) { const t = rayRect(ox, oz, dx, dz, b, maxT); if (t < best) best = t; } }
  return best;
}
function insideBuilding(x, z) {
  const gx = clamp(Math.floor(x / BLOCK), 0, N - 1), gz = clamp(Math.floor(z / BLOCK), 0, N - 1), L = bmap[gx + ',' + gz]; if (!L) return false;
  for (const b of L) if (x > b.x0 - .6 && x < b.x1 + .6 && z > b.z0 - .6 && z < b.z1 + .6) return true; return false;
}

/* ---------------------------------------------------------------- Matériaux partagés */
const BOX = new THREE.BoxGeometry(1, 1, 1);
const MATS = {}, BMATS = {};
const M = c => MATS[c] || (MATS[c] = new THREE.MeshLambertMaterial({ color: c }));
const MB = c => BMATS[c] || (BMATS[c] = new THREE.MeshBasicMaterial({ color: c }));
function pb(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; }
const SH_G = new THREE.CircleGeometry(1, 14), SH_M = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .32, depthWrite: false });
function shadow(parent, sx, sz) { const s = new THREE.Mesh(SH_G, SH_M); s.rotation.x = -PI / 2; s.position.y = .14; s.scale.set(sx, sz, 1); parent.add(s); return s; }

/* ---------------------------------------------------------------- Personnages (humanoïdes low-poly) */
function makeHuman(s) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = M(s.skin), shirt = M(s.shirt), pants = M(s.pants);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-.14, .92, 0); legR.position.set(.14, .92, 0);
  pb(legL, .23, .92, .25, pants, 0, -.46, 0); pb(legR, .23, .92, .25, pants, 0, -.46, 0); body.add(legL, legR);
  if (s.long) pb(body, .62, 1.3, .38, shirt, 0, .98, 0); else pb(body, .56, .66, .32, shirt, 0, 1.25, 0);
  if (s.skirt) pb(body, .52, .5, .36, M(s.skirt), 0, .78, 0);
  if (s.vest) pb(body, .6, .5, .36, M(s.vest), 0, 1.28, 0);
  pb(body, .3, .32, .3, skin, 0, 1.78, 0);
  const hc = M(s.hatCol || s.hair || '#111111');
  switch (s.hat) {
    case 'cap': pb(body, .34, .12, .34, hc, 0, 1.97, 0); pb(body, .3, .04, .18, hc, 0, 1.93, .22); break;
    case 'police': pb(body, .35, .13, .35, hc, 0, 1.98, 0); pb(body, .3, .04, .18, hc, 0, 1.93, .22); break;
    case 'wrap': pb(body, .38, .22, .38, hc, 0, 1.98, 0); break;
    case 'kufi': pb(body, .33, .13, .33, hc, 0, 1.97, 0); break;
    case 'helmet': pb(body, .38, .24, .38, hc, 0, 1.96, 0); break;
    case 'bandana': pb(body, .32, .1, .32, M(s.hair || '#111111'), 0, 1.97, 0); pb(body, .33, .07, .33, hc, 0, 1.87, 0); break;
    default: pb(body, .32, .1, .32, M(s.hair || '#0b0b0b'), 0, 1.97, 0);
  }
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-.38, 1.52, 0); armR.position.set(.38, 1.52, 0);
  const am = s.sleeveSkin ? skin : shirt; pb(armL, .17, .62, .2, am, 0, -.31, 0); pb(armR, .17, .62, .2, am, 0, -.31, 0); body.add(armL, armR);
  const sh = shadow(root, .55, .55);
  if (s.scale) root.scale.setScalar(s.scale);
  return { root, body, legL, legR, armL, armR, sh, wp: null };
}
function wmodel(w) {
  const g = new THREE.Group(), dk = M('#1f2328'), gr = M('#444a52'), wd = M('#7a4f2a');
  if (w === 'pistol') { pb(g, .07, .1, .3, dk, 0, .04, .14); pb(g, .06, .17, .08, gr, 0, -.07, .02); }
  else if (w === 'smg') { pb(g, .09, .13, .5, dk, 0, .04, .22); pb(g, .06, .22, .08, gr, 0, -.12, .14); pb(g, .06, .14, .08, gr, 0, -.08, 0); }
  else if (w === 'shotgun') { pb(g, .07, .08, .95, gr, 0, .05, .4); pb(g, .09, .13, .38, wd, 0, 0, -.05); }
  else if (w === 'bat') { pb(g, .09, .09, .95, wd, 0, 0, .35); }
  return g;
}
function setHeld(h, w) {
  const m = h.model; if (m.wp) { m.armR.remove(m.wp); m.wp = null; }
  h.weapon = w; if (w === 'fists') return;
  const g = wmodel(w); g.position.set(0, -.6, .02); g.rotation.x = PI / 2; m.armR.add(g); m.wp = g;
}
function animHuman(h, dt, spd) {
  const m = h.model;
  if (h.dead) { m.root.rotation.x = lerp(m.root.rotation.x, -PI / 2, clamp(dt * 9, 0, 1)); m.root.position.y = lerp(m.root.position.y, .22, clamp(dt * 9, 0, 1)); m.sh.visible = false; return; }
  h.wt += dt * spd * 1.5; const s = Math.sin(h.wt) * Math.min(1, spd / 3.5) * .85;
  m.legL.rotation.x = s; m.legR.rotation.x = -s;
  if (h.aim > 0) { h.aim -= dt; m.armR.rotation.x = -1.5; m.armL.rotation.x = -.5; } else { m.armR.rotation.x = -s * .9; m.armL.rotation.x = s * .9; }
  if (h.swing > 0) { h.swing -= dt; m.armR.rotation.x = lerp(-2.6, .5, 1 - h.swing / .28); }
  if (h.lean > 0) { h.lean -= dt; m.body.rotation.x = -.35 * (h.lean / .2); } else m.body.rotation.x = 0;
}

/* Fiches de personnages */
const SKINS = ['#5a3825', '#6b4429', '#7a4a2e', '#8a5a3b', '#9c6b47', '#a87850'];
const HEROES = [
  { id: 'koffi', name: 'Koffi', desc: 'Équilibré', speed: 1, hp: 100, dmg: 1, acc: 1, spec: { skin: '#8a5a3b', shirt: '#f77f00', pants: '#2c3e50', hat: 'none', hair: '#0b0b0b', sleeveSkin: true } },
  { id: 'awa', name: 'Awa', desc: 'Rapide et agile', speed: 1.12, hp: 88, dmg: 1, acc: 1.1, spec: { skin: '#7a4a2e', shirt: '#1fa34d', pants: '#3b2a20', hat: 'wrap', hatCol: '#ffb400', skirt: '#d4380d', sleeveSkin: true } },
  { id: 'moussa', name: 'Moussa', desc: 'Costaud', speed: .92, hp: 125, dmg: 1.2, acc: .9, spec: { skin: '#5a3825', shirt: '#f1ede2', pants: '#f1ede2', long: true, hat: 'kufi', hatCol: '#ffffff', sleeveSkin: false } },
  { id: 'yao', name: 'Yao', desc: 'Tireur précis', speed: 1.04, hp: 95, dmg: 1.1, acc: 1.45, spec: { skin: '#9c6b47', shirt: '#4338ca', pants: '#1f2937', hat: 'cap', hatCol: '#111827', sleeveSkin: false } }
];
function civSpec() {
  const skin = pick(SKINS);
  switch (irand(0, 5)) {
    case 0: return { skin, shirt: '#2f3640', pants: '#2f3640', hat: 'none', hair: '#0b0b0b' };
    case 1: return { skin, shirt: '#1fa34d', pants: '#3b2a20', hat: 'wrap', hatCol: '#ffb400', skirt: '#d4380d', sleeveSkin: true };
    case 2: return { skin, shirt: pick(['#3b82f6', '#e11d48', '#f59e0b']), pants: '#1f2937', hat: 'none', hair: '#0b0b0b', sleeveSkin: true };
    case 3: return { skin, shirt: '#94a3b8', pants: '#334155', vest: '#ff7a00', hat: 'helmet', hatCol: '#f5c518' };
    case 4: return { skin, shirt: pick(['#e7e0cf', '#2c5aa0']), pants: '#e7e0cf', long: true, hat: 'kufi', hatCol: '#f5f5f5' };
    default: return { skin, shirt: '#c026d3', pants: '#4a044e', skirt: '#c026d3', hat: 'wrap', hatCol: '#facc15', sleeveSkin: true };
  }
}
const GANGS = {
  corbeaux: { name: 'Les Corbeaux', shirt: '#16161a', pants: '#2a2a30', hat: 'bandana', hatCol: '#c1121f' },
  lions: { name: 'Les Lions Rouges', shirt: '#b91c1c', pants: '#111111', hat: 'cap', hatCol: '#111111' },
  port: { name: 'Les Dockers', shirt: '#1d4ed8', pants: '#1e3a8a', hat: 'cap', hatCol: '#fbbf24' }
};
function gangSpec(g, role) { const G = GANGS[g]; return { skin: pick(SKINS), shirt: G.shirt, pants: G.pants, hat: G.hat, hatCol: G.hatCol, hair: '#0b0b0b', scale: role === 'chef' ? 1.12 : role === 'bruiser' ? 1.05 : 1 }; }
const COP_SPEC = { shirt: '#1e3a8a', pants: '#111827', hat: 'police', hatCol: '#0f172a' };
const SWAT_SPEC = { shirt: '#111827', pants: '#111827', vest: '#1f2937', hat: 'helmet', hatCol: '#0b0f19', scale: 1.04 };

/* ---------------------------------------------------------------- Armes */
const WEAP = {
  fists: { name: 'Poings', melee: true, dmg: 12, range: 1.9, rate: .38 },
  bat: { name: 'Batte', melee: true, dmg: 30, range: 2.5, rate: .65 },
  pistol: { name: 'Pistolet', dmg: 22, range: 45, rate: .34, mag: 12, spread: .02, pel: 1 },
  smg: { name: 'Mitraillette', dmg: 11, range: 38, rate: .085, mag: 30, spread: .06, pel: 1, auto: true },
  shotgun: { name: 'Fusil à pompe', dmg: 11, range: 20, rate: .85, mag: 6, spread: .13, pel: 6 }
};
const ORDER = ['fists', 'bat', 'pistol', 'smg', 'shotgun'];

/* ---------------------------------------------------------------- Voitures (silhouettes inspirées de modèles courants à Abidjan, sans marques) */
const SHAPES = {
  sedan: { len: 4.4, w: 1.78, wx: 1.38, body: [[-2.2, .32], [-2.2, .92], [-1.45, .98], [-.8, 1.46], [.55, 1.46], [1.2, .98], [2.2, .86], [2.2, .32]], glass: [[-1.38, 1.0], [-.76, 1.38], [.5, 1.38], [1.1, 1.0]], stripe: [[-2.15, .52], [2.15, .52], [2.15, .7], [-2.15, .7]], r: 1.7 },
  suv: { len: 4.7, w: 1.9, wx: 1.5, body: [[-2.35, .42], [-2.35, 1.85], [.5, 1.9], [1.3, 1.25], [2.35, 1.1], [2.35, .42]], glass: [[-2.25, 1.3], [-2.25, 1.78], [.45, 1.82], [1.15, 1.3]], stripe: [[-2.3, .6], [2.3, .6], [2.3, .78], [-2.3, .78]], r: 1.85 },
  gbaka: { len: 5.2, w: 1.95, wx: 1.7, body: [[-2.6, .38], [-2.6, 2.2], [1.7, 2.2], [2.1, 1.5], [2.6, 1.05], [2.6, .38]], glass: [[-2.4, 1.3], [-2.4, 2.0], [1.6, 2.0], [2.05, 1.35]], stripe: [[-2.55, .7], [2.55, .7], [2.55, .95], [-2.55, .95]], r: 2.05 },
  pickup: { len: 5, w: 1.9, wx: 1.6, body: [[-2.5, .45], [-2.5, 1.15], [-.3, 1.15], [-.3, 1.85], [.7, 1.85], [1.25, 1.15], [2.5, 1.05], [2.5, .45]], glass: [[-.2, 1.2], [-.2, 1.78], [.65, 1.78], [1.15, 1.2]], stripe: [[-2.45, .62], [2.45, .62], [2.45, .8], [-2.45, .8]], r: 1.95 }
};
const CARS = {
  taxi: { name: 'Taxi communal', shape: 'sedan', cols: ['#e8452c'], stripe: '#f4f4f0', sign: true, acc: 11, max: 25 },
  woro: { name: 'Woro-woro', shape: 'sedan', cols: ['#1e88e5', '#43a047', '#fdd835', '#8e24aa'], stripe: '#ffffff', acc: 11, max: 25 },
  sedan: { name: 'Berline', shape: 'sedan', cols: ['#e5e7eb', '#9ca3af', '#1f2937', '#7f1d1d', '#1e3a8a', '#e6e1d3'], acc: 11.5, max: 27 },
  suv: { name: '4x4', shape: 'suv', cols: ['#1b1b20', '#e5e7eb', '#3d4a5c'], acc: 10, max: 26 },
  gbaka: { name: 'Gbaka', shape: 'gbaka', cols: ['#f4f4f0'], stripe: '#2a9d4a', acc: 7, max: 20 },
  pickup: { name: 'Pick-up', shape: 'pickup', cols: ['#3d7a3a', '#d9d9d9', '#b45309'], acc: 9, max: 23 },
  police: { name: 'Voiture de police', shape: 'sedan', cols: ['#f1f5f9'], stripe: '#1d4ed8', bar: true, acc: 13, max: 31 }
};
const GEO = {};
function carGeo(shape) {
  if (GEO[shape]) return GEO[shape];
  const S = SHAPES[shape];
  const ext = (pts, depth) => { const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g; };
  return GEO[shape] = { body: ext(S.body, S.w), glass: ext(S.glass, S.w + .06), stripe: ext(S.stripe, S.w + .04), wheel: (() => { const g = new THREE.CylinderGeometry(.38, .38, .26, 10); g.rotateX(PI / 2); return g; })() };
}
function makeCar(type, col) {
  const T = CARS[type], S = SHAPES[T.shape], g = carGeo(T.shape);
  const root = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = -PI / 2; root.add(inner);
  inner.add(new THREE.Mesh(g.body, M(col))); inner.add(new THREE.Mesh(g.glass, M('#1c2733')));
  if (T.stripe) inner.add(new THREE.Mesh(g.stripe, M(T.stripe)));
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(g.wheel, M('#111111')); w.position.set(sx * S.wx, .38, sz * (S.w / 2 - .02)); inner.add(w); wheels.push(w); }
  pb(inner, .06, .14, .34, MB('#fff2b0'), S.len / 2, .66, .55); pb(inner, .06, .14, .34, MB('#fff2b0'), S.len / 2, .66, -.55);
  pb(inner, .06, .14, .34, MB('#ff2a2a'), -S.len / 2, .66, .55); pb(inner, .06, .14, .34, MB('#ff2a2a'), -S.len / 2, .66, -.55);
  if (T.sign) pb(inner, .5, .2, .3, MB('#ffd33a'), -.1, 1.56, 0);
  let barA = null, barB = null;
  if (T.bar) { barA = pb(inner, .25, .16, .5, MB('#ff2020'), -.1, 1.55, .35); barB = pb(inner, .25, .16, .5, MB('#2060ff'), -.1, 1.55, -.35); }
  shadow(root, S.len * .55, S.w * .65);
  return { root, wheels, barA, barB };
}

/* ---------------------------------------------------------------- État du jeu */
const humans = [], cars = [], pickups = [];
let combatT = 99, cash = 0, wanted = 0, kills = 0, deaths = 0, diff = 1, effDiff = 1, gameTime = 0, crimeT = 99, hurtT = 0, hitMark = 0;
let running = false, qf = 1;
const P = { kind: 'player', x: SPAWN.x, z: SPAWN.z, a: 0, hp: 100, maxhp: 100, r: .45, car: null, cd: 0, swing: 0, aim: 0, reload: 0, cur: 'pistol', inv: {}, dead: 0, wt: 0, lean: 0, hero: HEROES[0], model: null, weapon: 'fists', speedNow: 0 };
let camYaw = 0, camH = 2.6, camPos = new THREE.Vector3(SPAWN.x, 6, SPAWN.z - 8);
const noise = { x: 0, z: 0, t: 99 };
let mission = null, missionNo = 0, zoneName = '';

function feed(t, col) { const d = document.createElement('div'); d.className = 'fi'; d.textContent = t; d.style.color = col || '#fff'; $('feed').appendChild(d); setTimeout(() => d.remove(), 2400); while ($('feed').children.length > 4) $('feed').firstChild.remove(); }
const recalcDiff = () => { diff = clamp(.85 + kills * .02 - deaths * .15, .6, 1.5); };
const stars = () => wanted > .15 ? Math.min(5, Math.ceil(wanted)) : 0;

/* Sons (WebAudio) */
let AC = null;
function sfx(k) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const len = k === 'shot' ? .12 : .08, buf = AC.createBuffer(1, Math.floor(AC.sampleRate * len), AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, k === 'hit' ? 3 : 2);
    const s = AC.createBufferSource(); s.buffer = buf; const g = AC.createGain(); g.gain.value = k === 'shot' ? .22 : .16;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = k === 'shot' ? 2400 : 800; s.connect(f); f.connect(g); g.connect(AC.destination); s.start();
  } catch (e) { /* pas de son */ }
}

/* ---------------------------------------------------------------- Création d'entités */
function sidewalkPoint(cx, cz, rmin, rmax) {
  for (let t = 0; t < 14; t++) {
    const ang = rand(0, 6.28), d = rand(rmin, rmax); let x = cx + Math.sin(ang) * d, z = cz + Math.cos(ang) * d;
    if (Math.random() < .5) { const k = clamp(Math.round(x / BLOCK), 0, N - 1); x = k * BLOCK + (Math.random() < .5 ? ROAD + rand(.8, 3) : -rand(.8, 3)); }
    else { const k = clamp(Math.round(z / BLOCK), 0, N - 1); z = k * BLOCK + (Math.random() < .5 ? ROAD + rand(.8, 3) : -rand(.8, 3)); }
    x = clamp(x, 6, WORLD - 6); z = clamp(z, 6, WORLD - 6);
    const tmp = { x, z }; if (!collide(tmp, .7)) return tmp;
  }
  return null;
}
function spawnHuman(kind, sub, x, z, o = {}) {
  const spec = o.spec, model = makeHuman(spec); scene.add(model.root);
  const hp = o.hp || (kind === 'ped' ? 40 : kind === 'cop' ? (sub === 'swat' ? 130 : 70) : (sub === 'chef' ? 140 : 75));
  const h = { kind, sub, gang: o.gang, x, z, a: rand(0, 6.28), hp, maxhp: hp, r: .45, model, weapon: 'fists', cd: rand(.3, 1.2), dead: 0, flee: 0, wt: 0, aim: 0, swing: 0, lean: 0, tm: 0, wa: rand(0, 6.28), dir: Math.random() < .5 ? 1 : -1, keep: !!o.keep, client: !!o.client, agg: false, remove: false };
  setHeld(h, o.weapon || 'fists'); humans.push(h); return h;
}
function spawnCar(type, x, z, a, mode, colOverride) {
  const T = CARS[type], col = colOverride || pick(T.cols), model = makeCar(type, col); scene.add(model.root);
  const c = { type, x, z, a, sp: 0, v: rand(8, 12.5), r: SHAPES[T.shape].r, hp: 100, mode, model, stuck: 0, rev: 0, deployed: false, keep: false };
  cars.push(c); return c;
}
function lanePoint(cx, cz, rmin, rmax) {
  const dir = irand(0, 3), k = irand(0, N - 1), c0 = k * BLOCK + ROAD / 2; let x, z, a;
  const along = (dir < 2 ? cx : cz) + rand(-rmax, rmax);
  if (dir === 0) { a = PI / 2; z = c0 + ROAD / 4; x = along; } else if (dir === 1) { a = -PI / 2; z = c0 - ROAD / 4; x = along; }
  else if (dir === 2) { a = 0; x = c0 - ROAD / 4; z = along; } else { a = PI; x = c0 + ROAD / 4; z = along; }
  x = clamp(x, 8, WORLD - 8); z = clamp(z, 8, WORLD - 8);
  if (Math.hypot(x - cx, z - cz) < rmin) return null;
  return { x, z, a };
}
function trafficType(x, z) {
  const D = distAt(x, z);
  if (D === 'yop' || D === 'adjame') return pick(['gbaka', 'gbaka', 'taxi', 'pickup', 'sedan']);
  if (D === 'marcory') return pick(['woro', 'woro', 'taxi', 'sedan']);
  return pick(['sedan', 'suv', 'taxi', 'sedan']);
}
function spawnTraffic() {
  const p = lanePoint(P.x, P.z, 70, 170); if (!p) return;
  const type = trafficType(p.x, p.z); spawnCar(type, p.x, p.z, p.a, 'traffic');
}

/* ---------------------------------------------------------------- Ramassables */
const PK_COL = { pistol: '#c0c4ca', smg: '#f59e0b', shotgun: '#a16207', bat: '#d6a76b', health: '#ef4444', cash: '#22c55e', ammo: '#38bdf8' };
function addPickup(x, z, type, tmp) { const m = new THREE.Mesh(BOX, MB(PK_COL[type])); m.scale.set(.7, .7, .7); m.position.set(x, 1, z); scene.add(m); pickups.push({ x, z, type, m, t: 0, tmp: !!tmp }); }
function collect(pk) {
  const t = pk.type;
  if (ORDER.includes(t)) {
    const w = WEAP[t];
    if (!P.inv[t]) { P.inv[t] = w.melee ? {} : { mag: w.mag, res: w.mag * 2 }; feed(w.name + ' récupéré(e)', '#ffd23a'); }
    else if (!w.melee) { P.inv[t].res += w.mag; feed('Munitions +' + w.mag, '#7dd3fc'); }
  } else if (t === 'health') { P.hp = Math.min(P.maxhp, P.hp + 40); feed('Soins +40', '#fca5a5'); }
  else if (t === 'cash') { const g = irand(40, 150); cash += g; feed('+$' + g, '#7dff9a'); }
  else if (t === 'ammo') { const w = WEAP[P.cur]; if (!w.melee) { P.inv[P.cur].res += w.mag * 2; feed('Munitions +' + w.mag * 2, '#7dd3fc'); } else { const g = P.inv.pistol; if (g) { g.res += 24; feed('Munitions pistolet +24', '#7dd3fc'); } } }
  sfx('hit');
  if (pk.tmp) { scene.remove(pk.m); pk.dead = true; } else { pk.m.visible = false; pk.t = 45; }
}
(function initPickups() {
  const types = ['pistol', 'smg', 'shotgun', 'bat', 'health', 'cash', 'ammo', 'health', 'cash', 'ammo'];
  for (let i = 0; i < 40; i++) { const p = sidewalkPoint(rand(40, WORLD - 40), rand(40, WORLD - 40), 0, 1); if (p) addPickup(p.x, p.z, types[i % types.length]); }
})();

/* ---------------------------------------------------------------- Combat */
const tracers = [];
for (let i = 0; i < 8; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9a0 })); l.visible = false; l.frustumCulled = false; scene.add(l); tracers.push({ l, t: 0 }); }
let tri = 0;
function tracer(x0, y0, z0, x1, y1, z1) { const T = tracers[tri++ % tracers.length], p = T.l.geometry.attributes.position; p.setXYZ(0, x0, y0, z0); p.setXYZ(1, x1, y1, z1); p.needsUpdate = true; T.l.visible = true; T.t = .07; }

function hitscan(ox, oz, dx, dz, range, shooter, oy) {
  const occ = segBuildingT(ox, oz, dx, dz, range); let bt = Math.min(range, occ), best = null;
  const list = humans.concat([P]);
  for (const h of list) {
    if (h === shooter || h.dead > 0 || (h === P && P.dead > 0) || h.client) continue;
    const px = h.x - ox, pz = h.z - oz, t = px * dx + pz * dz; if (t < 0 || t > bt) continue;
    if (Math.abs(px * dz - pz * dx) < h.r + .18) { best = h; bt = t; }
  }
  tracer(ox, oy || 1.4, oz, ox + dx * bt, oy || 1.4, oz + dz * bt);
  return best;
}
function hurtP(d) {
  if (P.dead > 0) return;
  P.hp -= d * effDiff; hurtT = .3; P.lean = .2; combatT = 0;
  if (P.hp <= 0) playerDie();
}
function damage(h, dmg, src) {
  if (h.dead > 0) return;
  h.hp -= dmg; h.lean = .2;
  if (h.kind === 'ped') { h.flee = 6; h.fx = src.x; h.fz = src.z; if (src === P) { wanted = Math.min(5, wanted + .25); crimeT = 0; } }
  else if (h.kind === 'gang') h.agg = true;
  else if (h.kind === 'cop' && src === P) { wanted = Math.min(5, wanted + .5); crimeT = 0; }
  if (src === P) hitMark = .18;
  if (h.hp <= 0) killHuman(h, src);
}
function killHuman(h, src) {
  h.dead = .01; h.model.sh.visible = false;
  if (src !== P) return;
  kills++; recalcDiff();
  if (h.kind === 'gang') { const g = irand(30, 90); cash += g; feed('+$' + g, '#7dff9a'); if (Math.random() < .4 && h.weapon !== 'fists') addPickup(h.x, h.z, h.weapon, true); else if (Math.random() < .3) addPickup(h.x, h.z, 'cash', true); }
  else if (h.kind === 'ped') { wanted = Math.min(5, wanted + .5); crimeT = 0; feed('Civil touché !', '#fca5a5'); }
  else if (h.kind === 'cop') { wanted = Math.min(5, wanted + 1); crimeT = 0; feed('Policier à terre !', '#93c5fd'); if (h.weapon !== 'fists' && Math.random() < .5) addPickup(h.x, h.z, h.weapon, true); }
  if (mission && mission.type === 'boss' && mission.target === h) finishMission(true);
}
function bestTarget(range, cone) {
  let best = null, bs = 1e9;
  for (const h of humans) {
    if (h.dead > 0 || h.client) continue;
    const dx = h.x - P.x, dz = h.z - P.z, d = Math.hypot(dx, dz); if (d > range || d < .1) continue;
    const ad = Math.abs(adiff(Math.atan2(dx, dz), P.a)); if (ad > cone) continue;
    if (segBuildingT(P.x, P.z, dx / d, dz / d, d) < d) continue;
    const hostile = h.kind === 'gang' || (h.kind === 'cop' && wanted > 0);
    const s = ad * 8 + d * .1 - (hostile ? 3 : 0); if (s < bs) { bs = s; best = h; }
  }
  return best;
}
function startReload() { const w = WEAP[P.cur]; if (w.melee || P.reload > 0) return; const inv = P.inv[P.cur]; if (inv.mag >= w.mag || inv.res <= 0) return; P.reload = 1.3; feed('Rechargement…', '#cbd5e1'); }
function attack() {
  if (P.cd > 0 || P.car || P.dead > 0 || P.reload > 0) return;
  const w = WEAP[P.cur], hero = P.hero;
  if (w.melee) {
    const t = bestTarget(3.6, 1.4); if (t) P.a = Math.atan2(t.x - P.x, t.z - P.z);
    P.cd = w.rate; P.swing = .28; let any = false;
    for (const h of humans) {
      if (h.dead > 0 || h.client) continue;
      const dx = h.x - P.x, dz = h.z - P.z, d = Math.hypot(dx, dz);
      if (d < w.range + .45 && Math.abs(adiff(Math.atan2(dx, dz), P.a)) < 1.0) { any = true; damage(h, w.dmg * hero.dmg, P); h.x += dx / (d || 1) * .5; h.z += dz / (d || 1) * .5; }
    }
    sfx(any ? 'hit' : 'swing'); return;
  }
  const inv = P.inv[P.cur];
  if (inv.mag <= 0) { startReload(); if (inv.res <= 0) { P.cd = .4; feed('Plus de munitions !', '#fca5a5'); } return; }
  inv.mag--; P.cd = w.rate; P.aim = .6;
  const tg = bestTarget(w.range, .75); let ang = P.a; if (tg) { ang = Math.atan2(tg.x - P.x, tg.z - P.z); P.a = ang; }
  for (let i = 0; i < w.pel; i++) {
    const a2 = ang + rand(-1, 1) * w.spread / hero.acc, dx = Math.sin(a2), dz = Math.cos(a2);
    const h = hitscan(P.x + dx * .6, P.z + dz * .6, dx, dz, w.range, P, 1.4);
    if (h) { if (h === P) continue; damage(h, w.dmg * hero.dmg, P); }
  }
  sfx('shot'); noise.x = P.x; noise.z = P.z; noise.t = 0;
  for (const h of humans) if (h.kind === 'ped' && h.dead <= 0 && Math.hypot(h.x - P.x, h.z - P.z) < 40) { wanted = Math.min(5, wanted + .02); crimeT = 0; break; }
  if (inv.mag <= 0 && inv.res > 0) startReload();
}
function playerDie() {
  P.hp = 0; P.dead = 3; deaths++; recalcDiff(); const fee = Math.floor(cash * .1); cash -= fee;
  if (P.car) exitCar(true);
  feed('K.O. — Hôpital : -$' + fee, '#fca5a5');
  if (mission) finishMission(false);
}
function respawn() {
  P.hp = P.maxhp; P.dead = 0; P.x = SPAWN.x + 6; P.z = SPAWN.z; P.a = 0; wanted = 0; P.model.root.rotation.x = 0; P.model.root.position.y = 0; P.model.sh.visible = true;
  for (const h of humans) if (h.kind === 'cop' && !h.keep) h.remove = true;
}

/* ---------------------------------------------------------------- IA humaine */
function updHuman(h, dt) {
  if (h.dead > 0) { h.dead += dt; animHuman(h, dt, 0); h.model.root.position.x = h.x; h.model.root.position.z = h.z; if (h.dead > 7) h.remove = true; return; }
  if (h.client) { animHuman(h, dt, 0); h.model.root.position.set(h.x, 0, h.z); h.model.root.rotation.y = h.a; return; }
  h.cd -= dt;
  const dx = P.x - h.x, dz = P.z - h.z, d = Math.hypot(dx, dz) || 1;
  let mx = 0, mz = 0, sp = 0, face = null;
  if (noise.t < 1.2 && h.kind === 'ped' && Math.hypot(h.x - noise.x, h.z - noise.z) < 38 && h.flee <= 0) { h.flee = 5; h.fx = noise.x; h.fz = noise.z; }
  if (h.kind === 'ped') {
    if (h.flee > 0) { h.flee -= dt; const fx = h.x - (h.fx != null ? h.fx : P.x), fz = h.z - (h.fz != null ? h.fz : P.z), fd = Math.hypot(fx, fz) || 1; mx = fx / fd; mz = fz / fd; sp = 5.2; }
    else { h.tm -= dt; if (h.tm <= 0) { h.tm = rand(2, 6); h.wa = Math.random() < .3 ? h.wa + rand(-1, 1) : rand(0, 6.28); h.idle = Math.random() < .25; } if (!h.idle) { mx = Math.sin(h.wa); mz = Math.cos(h.wa); sp = 1.5; } }
  } else {
    const w = WEAP[h.weapon], active = h.kind === 'gang' ? (h.agg ? 60 : 26) : (wanted > 0 ? 200 : 0);
    const leaving = h.kind === 'cop' && wanted <= 0;
    if (leaving) { mx = -dx / d; mz = -dz / d; sp = 3; if (d > 70) h.remove = true; }
    else if (P.dead > 0 || d > active) { h.tm -= dt; if (h.tm <= 0) { h.tm = rand(2, 5); h.wa = rand(0, 6.28); h.idle = Math.random() < .4; } if (!h.idle) { mx = Math.sin(h.wa); mz = Math.cos(h.wa); sp = 1.3; } }
    else {
      if (h.kind === 'gang') h.agg = true;
      face = Math.atan2(dx, dz);
      if (w.melee) {
        if (d > 1.5) { mx = dx / d; mz = dz / d; sp = 4.5; }
        else if (h.cd <= 0 && !P.car) { h.cd = 1.1; h.swing = .28; hurtP(w.dmg * .5); sfx('hit'); }
      } else {
        const want = h.sub === 'chef' ? 11 : 13;
        if (d > want + 3) { mx = dx / d; mz = dz / d; sp = h.kind === 'cop' ? 5 : 3.8; }
        else if (d < want - 4) { mx = -dx / d; mz = -dz / d; sp = 2.6; }
        else { mx = -dz / d * h.dir; mz = dx / d * h.dir; sp = 1.8; }
        if (h.cd <= 0 && d < 34) {
          h.cd = w.rate * (h.sub === 'chef' || h.sub === 'swat' ? 2.4 : 3.6); h.aim = .5; sfx('shot');
          const los = segBuildingT(h.x, h.z, dx / d, dz / d, d) >= d;
          tracer(h.x + dx / d * .6, 1.4, h.z + dz / d * .6, los ? P.x : h.x + dx / d * 14, 1.3, los ? P.z : h.z + dz / d * 14);
          if (los && Math.random() < clamp(.55 - d * .011, .1, .5) * (P.car ? .6 : 1)) hurtP(w.dmg * (h.kind === 'cop' ? .45 : .55));
        }
      }
    }
  }
  if (face !== null) h.a += adiff(face, h.a) * clamp(dt * 10, 0, 1); else if (sp > 0) h.a += adiff(Math.atan2(mx, mz), h.a) * clamp(dt * 8, 0, 1);
  if (sp) { h.x += mx * sp * dt; h.z += mz * sp * dt; if (collide(h, .45)) h.wa += 1.7; }
  h.model.root.position.set(h.x, 0, h.z); h.model.root.rotation.y = h.a; animHuman(h, dt, sp);
}

/* ---------------------------------------------------------------- Voitures : conduite et IA */
function carHitHumans(c) {
  if (Math.abs(c.sp) < 5) return;
  for (const h of humans) {
    if (h.dead > 0 || h.client) continue;
    if (Math.hypot(h.x - c.x, h.z - c.z) < c.r * .75 + .5) {
      const d = Math.abs(c.sp) * 4; damage(h, d, c.mode === 'player' ? P : c);
      h.x += Math.sin(c.a) * c.sp * .12; h.z += Math.cos(c.a) * c.sp * .12; c.sp *= .93; sfx('hit');
    }
  }
}
function updCar(c, dt) {
  const T = CARS[c.type];
  if (c.mode === 'player') {
    const k = keys;
    const thr = clamp((k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - joy.y, -1, 1);
    const st = clamp((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + joy.x, -1, 1);
    const brake = k.Space || k.ShiftLeft || k.ShiftRight || btn.sprint;
    if (Math.abs(thr) > .05) c.sp += thr * (thr * c.sp >= 0 ? T.acc : T.acc * 1.7) * dt; else c.sp *= Math.max(0, 1 - .9 * dt);
    if (brake) c.sp *= Math.max(0, 1 - 3.5 * dt);
    c.sp = clamp(c.sp, -9, T.max);
    c.a -= st * dt * 1.9 * clamp(c.sp / 6, -1, 1) * (1 - .3 * Math.min(1, Math.abs(c.sp) / T.max));
  } else if (c.mode === 'traffic') {
    const ax = c.x + Math.sin(c.a) * 9, az = c.z + Math.cos(c.a) * 9; let block = !P.car && Math.hypot(ax - P.x, az - P.z) < 3.5;
    if (!block && P.car && P.car !== c && Math.hypot(ax - P.x, az - P.z) < 4.5) block = true;
    for (const h of humans) if (!block && h.dead <= 0 && Math.hypot(ax - h.x, az - h.z) < 3) block = true;
    for (const o of cars) if (!block && o !== c && Math.hypot(ax - o.x, az - o.z) < 4.2) block = true;
    c.sp = lerp(c.sp, block ? 0 : c.v, clamp(dt * 3, 0, 1));
    if (Math.hypot(c.x - P.x, c.z - P.z) > 230 || c.x < 2 || c.z < 2 || c.x > WORLD - 2 || c.z > WORLD - 2) c.remove = true;
  } else if (c.mode === 'police') {
    const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz);
    if (wanted <= 0 || P.dead > 0) { c.sp = lerp(c.sp, 0, dt); if (d > 120) c.remove = true; }
    else if (d < 15 && !P.car) { c.sp *= Math.max(0, 1 - 4 * dt); if (!c.deployed && c.sp < 2) { c.deployed = true; for (let i = 0; i < 2; i++) spawnHuman('cop', 'agent', c.x + Math.cos(c.a) * (i ? 2.4 : -2.4), c.z - Math.sin(c.a) * (i ? 2.4 : -2.4), { spec: COP_SPEC, weapon: 'pistol' }); c.mode = 'parked'; } }
    else {
      let target = Math.atan2(dx, dz); if (c.rev > 0) { c.rev -= dt; target += PI; }
      const turn = clamp(adiff(target, c.a), -1, 1);
      c.a += turn * dt * 2.3 * clamp(Math.abs(c.sp) / 5, .2, 1) * (c.rev > 0 ? -1 : 1);
      c.sp = lerp(c.sp, c.rev > 0 ? -7 : T.max * (.55 + .12 * stars()), clamp(dt * 1.6, 0, 1));
      if (P.car && d < c.r + P.car.r + .6) { P.car.hp -= 6 * dt * 6; hurtT = Math.max(hurtT, .1); c.sp *= .9; }
    }
  } else c.sp *= Math.max(0, 1 - 2 * dt);
  c.x += Math.sin(c.a) * c.sp * dt; c.z += Math.cos(c.a) * c.sp * dt;
  if (collide(c, c.r)) {
    if (Math.abs(c.sp) > 4) { c.hp -= Math.abs(c.sp) * .9; if (c.mode === 'player') { hurtT = Math.max(hurtT, .12); sfx('hit'); } }
    if (c.mode === 'police') { c.stuck += dt; if (c.stuck > .4) { c.rev = 1.1; c.stuck = 0; } }
    if (c.mode === 'traffic') c.a += PI;
    c.sp *= -.3;
  }
  for (const o of cars) {
    if (o === c) continue; const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz), m = (c.r + o.r) * .82;
    if (d < m && d > .01) { const p = (m - d) / 2; c.x += dx / d * p; c.z += dz / d * p; o.x -= dx / d * p; o.z -= dz / d * p; const v = Math.abs(c.sp - o.sp); if (v > 5) { c.hp -= v * .5; o.hp -= v * .5; if (c.mode === 'player' || o.mode === 'player') { hurtT = Math.max(hurtT, .12); sfx('hit'); } } const s = (c.sp + o.sp) / 2; c.sp = s; o.sp = s; }
  }
  if (c.mode === 'player') carHitHumans(c);
  if (c.hp <= 0 && !c.wreck) { c.wreck = true; if (c.mode === 'player') { feed('Voiture détruite !', '#fca5a5'); exitCar(true); } c.mode = 'parked'; c.model.root.traverse(o => { if (o.isMesh && o.material !== SH_M) o.material = M('#222222'); }); }
  const m = c.model; m.root.position.set(c.x, 0, c.z); m.root.rotation.y = c.a;
  for (const w of m.wheels) w.rotation.z -= c.sp * dt / .38;
  if (m.barA) { const on = Math.floor(gameTime * 6) % 2 === 0 && c.mode === 'police'; m.barA.visible = on; m.barB.visible = !on; }
}
function enterCar() {
  let best = null, bd = 4.5;
  for (const c of cars) { if (c.mode === 'player' || c.wreck) continue; const d = Math.hypot(c.x - P.x, c.z - P.z) - c.r * .6; if (d < bd) { bd = d; best = c; } }
  if (!best) { feed('Aucune voiture à portée', '#cbd5e1'); return; }
  if (best.mode === 'traffic' || best.mode === 'police') {
    wanted = Math.min(5, wanted + (best.mode === 'police' ? .8 : .3)); crimeT = 0; feed('Voiture volée !', '#ffcf4a');
    const dv = spawnHuman('ped', 'driver', best.x + Math.cos(best.a) * 2.4, best.z - Math.sin(best.a) * 2.4, { spec: civSpec() }); dv.flee = 8;
  }
  best.mode = 'player'; best.v = 0; P.car = best; P.model.root.visible = false; feed(CARS[best.type].name, '#ffffff');
}
function exitCar(force) {
  const c = P.car; if (!c) return;
  if (!force && Math.abs(c.sp) > 9) { feed('Trop vite !', '#cbd5e1'); return; }
  c.mode = 'parked'; P.car = null; P.model.root.visible = true;
  const spots = [[Math.cos(c.a), -Math.sin(c.a)], [-Math.cos(c.a), Math.sin(c.a)], [Math.sin(c.a), Math.cos(c.a)]];
  for (const s of spots) { P.x = c.x + s[0] * (c.r + 1.2); P.z = c.z + s[1] * (c.r + 1.2); const t = { x: P.x, z: P.z }; if (!collide(t, .5)) break; }
  collide(P, .5);
}

/* ---------------------------------------------------------------- Missions */
const GIVER = { x: 4 * BLOCK + ROAD / 2, z: 3 * BLOCK + ROAD / 2 }, GARAGE = { x: 2 * BLOCK + ROAD / 2, z: 5 * BLOCK + ROAD / 2 };
const beacon = (col, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 70, 14, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false })); m.position.y = 35; scene.add(m); return m; };
const bGiver = beacon(0x38bdf8, 1.6), bGarage = beacon(0xfacc15, 1.8), bMission = beacon(0xff3b30, 1.4);
bGiver.position.x = GIVER.x; bGiver.position.z = GIVER.z; bGarage.position.x = GARAGE.x; bGarage.position.z = GARAGE.z; bMission.visible = false;
function interPoint(minD, notDist) {
  for (let t = 0; t < 30; t++) { const i = irand(0, N - 1), j = irand(0, N - 1), x = i * BLOCK + ROAD / 2, z = j * BLOCK + ROAD / 2; if (Math.hypot(x - P.x, z - P.z) < minD) continue; if (notDist && distOf(i, j) === notDist) continue; return { x, z }; }
  return { x: SPAWN.x + 160, z: SPAWN.z };
}
function startMission() {
  const type = missionNo++ % 2 === 0 ? 'taxi' : 'boss';
  if (type === 'taxi') {
    const p = interPoint(150), cl = spawnHuman('ped', 'client', p.x + 3, p.z + 3, { spec: civSpec(), keep: true, client: true });
    mission = { type, stage: 0, tx: p.x, tz: p.z, client: cl, text: 'TAXI — Va chercher le client (en voiture)' };
  } else {
    const gname = pick(['yop', 'adjame', 'marcory']), gg = gname === 'yop' ? 'corbeaux' : gname === 'adjame' ? 'lions' : 'port';
    const p = interPoint(170, null); const px = clamp(p.x + 12, 10, WORLD - 10), pz = clamp(p.z + 12, 10, WORLD - 10);
    const boss = spawnHuman('gang', 'chef', px, pz, { spec: gangSpec(gg, 'chef'), weapon: 'smg', keep: true, gang: gg }); boss.agg = false;
    for (let i = 0; i < 3; i++) spawnHuman('gang', i ? 'tireur' : 'bruiser', px + rand(-5, 5), pz + rand(-5, 5), { spec: gangSpec(gg, i ? 'tireur' : 'bruiser'), weapon: i ? 'pistol' : 'bat', keep: true, gang: gg });
    mission = { type, target: boss, tx: px, tz: pz, text: 'CONTRAT — Élimine le chef des ' + GANGS[gg].name };
  }
  feed('Nouvelle mission !', '#38bdf8');
}
function finishMission(ok) {
  if (!mission) return;
  if (ok) { const g = mission.type === 'boss' ? 400 : mission.reward; cash += g; feed('Mission réussie ! +$' + g, '#7dff9a'); }
  else feed('Mission échouée', '#fca5a5');
  if (mission.client) mission.client.remove = true;
  mission = null; bMission.visible = false;
}
function updMission(dt) {
  if (!mission) { if (!P.car && P.dead <= 0 && Math.hypot(P.x - GIVER.x, P.z - GIVER.z) < 4) startMission(); return; }
  const m = mission;
  if (m.type === 'boss') { m.tx = m.target.x; m.tz = m.target.z; if (m.target.dead > 0 && m.target.dead < 1) { /* géré dans killHuman */ } }
  if (m.type === 'taxi') {
    const dd = Math.hypot(P.x - m.tx, P.z - m.tz);
    if (m.stage === 0 && P.car && dd < 6 && Math.abs(P.car.sp) < 9) {
      m.client.remove = true; m.client = null; m.stage = 1; const p = interPoint(260, distAt(m.tx, m.tz)); m.tx = p.x; m.tz = p.z; m.time = 150;
      m.dist = Math.hypot(P.x - p.x, P.z - p.z); m.reward = Math.floor(150 + m.dist * .6); m.text = 'TAXI — Dépose le client à ' + DIST[distAt(p.x, p.z)].name; feed('Client à bord', '#fde68a');
    } else if (m.stage === 1) {
      m.time -= dt; if (m.time <= 0) finishMission(false);
      else if (P.car && dd < 7 && Math.abs(P.car.sp) < 9) finishMission(true);
    }
  }
  if (mission) { bMission.visible = true; bMission.position.x = mission.tx; bMission.position.z = mission.tz; }
}

/* ---------------------------------------------------------------- Entrées */
const keys = {}, btn = {}, joy = { x: 0, y: 0 }; let wantEnter = false, wantReload = false, wantCycle = 0, wantSel = -1;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyE') wantEnter = true; if (e.code === 'KeyR') wantReload = true; if (e.code === 'Tab') wantCycle = 1;
  if (/^Digit[1-5]$/.test(e.code)) wantSel = +e.code.slice(5) - 1;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { wantCycle = e.deltaY > 0 ? 1 : -1; }, { passive: true });
let dragId = null, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') { if (e.button === 0) keys.Mouse = true; else { dragId = e.pointerId; lx = e.clientX; ly = e.clientY; } }
  else { dragId = e.pointerId; lx = e.clientX; ly = e.clientY; }
});
addEventListener('pointermove', e => { if (e.pointerId === dragId) { camYaw -= (e.clientX - lx) * .006; camH = clamp(camH + (e.clientY - ly) * .02, 1.2, 7); lx = e.clientX; ly = e.clientY; } });
addEventListener('pointerup', e => { if (e.pointerId === dragId) dragId = null; if (e.pointerType === 'mouse' && e.button === 0) keys.Mouse = false; });
addEventListener('pointercancel', e => { if (e.pointerId === dragId) dragId = null; });
const stick = $('stick'), knob = $('knob'); let sid = null;
function sv(e) {
  const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const m = r.width / 2 * .8, d = Math.hypot(dx, dy);
  if (d > m) { dx = dx / d * m; dy = dy / d * m; } joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
}
stick.addEventListener('pointerdown', e => { sid = e.pointerId; stick.setPointerCapture(e.pointerId); sv(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === sid) sv(e); });
const sEnd = e => { if (e.pointerId === sid) { sid = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
stick.addEventListener('pointerup', sEnd); stick.addEventListener('pointercancel', sEnd);
document.querySelectorAll('.btn').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); btn[k] = true; if (k === 'enter') wantEnter = true; if (k === 'reload') wantReload = true; if (k === 'weapon') wantCycle = 1; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { btn[k] = false; }));
});
function owned() { return ORDER.filter(k => P.inv[k]); }
function selectWeapon(k) { if (!P.inv[k] || P.cur === k) return; P.cur = k; P.reload = 0; setHeld(P, k); }

/* ---------------------------------------------------------------- Mise à jour */
function updPlayer(dt) {
  P.cd -= dt; P.lean = Math.max(0, P.lean - dt);
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); animHuman(P, dt, 0); P.model.root.position.set(P.x, P.model.root.position.y, P.z); return; }
  if (wantEnter) { wantEnter = false; if (P.car) exitCar(); else enterCar(); }
  if (wantReload) { wantReload = false; startReload(); }
  if (wantCycle) { const o = owned(), i = o.indexOf(P.cur); selectWeapon(o[(i + wantCycle + o.length) % o.length]); wantCycle = 0; }
  if (wantSel >= 0) { selectWeapon(ORDER[wantSel]); wantSel = -1; }
  if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { const w = WEAP[P.cur], inv = P.inv[P.cur]; if (inv) { const n = Math.min(w.mag - inv.mag, inv.res); inv.mag += n; inv.res -= n; } } }
  if (P.car) {
    updCar(P.car, dt); if (!P.car) return;
    P.x = P.car.x; P.z = P.car.z; P.a = P.car.a; P.speedNow = Math.abs(P.car.sp);
    camYaw += adiff(P.car.a, camYaw) * clamp(dt * (P.car.sp > 1 ? 2.2 : .6), 0, 1); return;
  }
  const k = keys; camYaw -= ((k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0)) * dt * 2.2;
  let ix = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + joy.x, iy = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0) + joy.y; const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  const mx = fx * -iy + rx * ix, mz = fz * -iy + rz * ix, sprint = k.ShiftLeft || k.ShiftRight || btn.sprint;
  const spd = 4.4 * P.hero.speed * (sprint ? 1.6 : 1) * (P.aim > 0 ? .75 : 1);
  P.speedNow = Math.hypot(mx, mz) * spd;
  P.x += mx * spd * dt; P.z += mz * spd * dt; collide(P, .45);
  if (m > .15) P.a += adiff(Math.atan2(mx, mz), P.a) * clamp(dt * 14, 0, 1);
  if (k.Space || k.Mouse || btn.fire) { if (WEAP[P.cur].melee || WEAP[P.cur].auto || P.cd <= 0) attack(); }
  P.model.root.position.set(P.x, 0, P.z); P.model.root.rotation.y = P.a; animHuman(P, dt, P.speedNow);
}
function updSpawns() {
  const Dn = distAt(P.x, P.z);
  const cnt = k => humans.reduce((n, h) => n + (h.kind === k && h.dead <= 0 && !h.keep ? 1 : 0), 0);
  if (cnt('ped') < Math.round(8 * qf)) { const p = sidewalkPoint(P.x, P.z, 35, 110); if (p) spawnHuman('ped', 'civil', p.x, p.z, { spec: civSpec() }); }
  const gt = Math.round(({ yop: 5, adjame: 5, marcory: 4, cocody: 1, plateau: 1 }[Dn] || 2) * qf * (.8 + .2 * effDiff));
  if (cnt('gang') < gt) {
    const p = sidewalkPoint(P.x, P.z, 45, 100);
    if (p) { const g = Dn === 'yop' ? 'corbeaux' : Dn === 'adjame' ? 'lions' : Dn === 'marcory' ? 'port' : pick(Object.keys(GANGS)), r = Math.random(), role = r < .5 ? 'bruiser' : r < .9 ? 'tireur' : 'chef', wp = role === 'bruiser' ? 'bat' : role === 'tireur' ? 'pistol' : 'smg'; spawnHuman('gang', role, p.x, p.z, { spec: gangSpec(g, role), weapon: wp, gang: g }); }
  }
  const s = stars();
  if (s > 0) {
    const ct = Math.round([0, 2, 3, 4, 5, 6][s] * Math.max(.6, qf));
    if (cnt('cop') < ct) { const p = sidewalkPoint(P.x, P.z, 40, 70); if (p) { const sw = s >= 4 && Math.random() < .6; spawnHuman('cop', sw ? 'swat' : 'agent', p.x, p.z, { spec: sw ? SWAT_SPEC : COP_SPEC, weapon: sw ? 'smg' : 'pistol' }); } }
    const pc = cars.reduce((n, c) => n + (c.mode === 'police' ? 1 : 0), 0);
    if (s >= 2 && pc < Math.min(s - 1, 3)) { const p = lanePoint(P.x, P.z, 110, 170); if (p) spawnCar('police', p.x, p.z, p.a, 'police'); }
  }
  const tr = cars.reduce((n, c) => n + (c.mode === 'traffic' ? 1 : 0), 0);
  if (tr < Math.round(9 * qf)) spawnTraffic();
}
function update(dt) {
  gameTime += dt; combatT += dt; crimeT += dt; noise.t += dt; hurtT = Math.max(0, hurtT - dt); hitMark = Math.max(0, hitMark - dt);
  effDiff = diff * (P.hp < 30 ? .8 : P.hp > 85 ? 1.1 : 1);
  updPlayer(dt);
  for (const h of humans) updHuman(h, dt);
  for (const c of cars) if (c !== P.car) updCar(c, dt);
  for (let i = humans.length - 1; i >= 0; i--) { const h = humans[i]; if (h.remove || (!h.keep && h.dead <= 0 && Math.hypot(h.x - P.x, h.z - P.z) > 190)) { scene.remove(h.model.root); humans.splice(i, 1); } }
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if (c.remove || (c.mode === 'parked' && c !== P.car && Math.hypot(c.x - P.x, c.z - P.z) > 320)) { scene.remove(c.model.root); cars.splice(i, 1); } }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i]; if (pk.dead) { pickups.splice(i, 1); continue; }
    if (pk.t > 0) { pk.t -= dt; if (pk.t <= 0) pk.m.visible = true; continue; }
    pk.m.rotation.y += dt * 2; pk.m.position.y = 1 + Math.sin(gameTime * 3 + pk.x) * .15;
    if (!P.car && P.dead <= 0 && Math.hypot(pk.x - P.x, pk.z - P.z) < 1.8) collect(pk);
  }
  // chaleur
  if (wanted > 0) { let near = 1e9; for (const h of humans) if (h.kind === 'cop' && h.dead <= 0) near = Math.min(near, Math.hypot(h.x - P.x, h.z - P.z)); for (const c of cars) if (c.mode === 'police') near = Math.min(near, Math.hypot(c.x - P.x, c.z - P.z));
    if (crimeT > 8 && near > 45) wanted = Math.max(0, wanted - dt * .09); else if (crimeT > 25) wanted = Math.max(0, wanted - dt * .04); }
  if (P.car && wanted > 0 && Math.hypot(P.x - GARAGE.x, P.z - GARAGE.z) < 6) { wanted = 0; P.car.hp = 100; feed('Garage Express : repeint ! Recherché levé', '#facc15'); for (const h of humans) if (h.kind === 'cop' && !h.keep) h.remove = true; }
  if (P.car && P.car.wreck === undefined && P.car.hp < 100 && Math.hypot(P.x - GARAGE.x, P.z - GARAGE.z) < 6) P.car.hp = 100;
  updMission(dt); spawnT -= dt; if (spawnT <= 0) { spawnT = 1.1; updSpawns(); }
  for (const t of tracers) if (t.l.visible) { t.t -= dt; if (t.t <= 0) t.l.visible = false; }
  // zone
  const z = DIST[distAt(P.x, P.z)].name; if (z !== zoneName) { zoneName = z; const el = $('zone'); el.textContent = z; el.classList.add('on'); clearTimeout(update.zt); update.zt = setTimeout(() => el.classList.remove('on'), 2200); }
}

/* ---------------------------------------------------------------- Caméra, ciel, rendu */
function updCamera(dt) {
  const dist = P.car ? 11 + Math.min(4, Math.abs(P.car.sp) * .12) : 6.5, height = P.car ? 4.4 : camH;
  let t = 1, cx = P.x, cz = P.z;
  for (; t > .2; t -= .1) { cx = P.x - Math.sin(camYaw) * dist * t; cz = P.z - Math.cos(camYaw) * dist * t; if (!insideBuilding(cx, cz)) break; }
  const want = new THREE.Vector3(cx, (P.car ? 1.5 : 1.6) + height * (.55 + .45 * t), cz);
  camPos.lerp(want, 1 - Math.exp(-14 * dt)); camera.position.copy(camPos);
  camera.lookAt(P.x + Math.sin(camYaw) * 2, (P.car ? 1.2 : 1.7), P.z + Math.cos(camYaw) * 2);
  const fov = 62 + (P.car ? Math.min(14, Math.abs(P.car.sp) * .5) : 0) + (P.aim > 0 ? -4 : 0);
  if (Math.abs(camera.fov - fov) > .1) { camera.fov = lerp(camera.fov, fov, clamp(dt * 4, 0, 1)); camera.updateProjectionMatrix(); }
}
const dayC = C('#8ec9f0'), nightC = C('#0b1230'), skyC = new THREE.Color();
function darkness() { const t = (gameTime / 240 + .1) % 1; return clamp((1 - Math.cos(t * PI * 2)) / 2 * 1.25, 0, .92); }
function updSky() {
  const d = darkness(); skyC.copy(dayC).lerp(nightC, d); scene.background.copy(skyC); scene.fog.color.copy(skyC);
  hemi.intensity = lerp(1.6, .55, d); sun.intensity = lerp(2.4, .25, d); wallMat.emissiveIntensity = d * 1.7;
  const t = (gameTime / 240 + .1) % 1, hh = Math.floor((t * 24 + 12) % 24), mm = Math.floor((t * 24 * 60) % 60);
  $('clock').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
/* Mini-carte */
const mapC = $('map'), mctx = mapC.getContext('2d'), MS = 130, SC = MS / WORLD;
const mapBG = document.createElement('canvas'); mapBG.width = mapBG.height = MS;
(function () {
  const g = mapBG.getContext('2d'); g.fillStyle = '#20242b'; g.fillRect(0, 0, MS, MS);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { g.fillStyle = DIST[distOf(i, j)].ground; g.globalAlpha = .55; g.fillRect((i * BLOCK + ROAD) * SC, (j * BLOCK + ROAD) * SC, (BLOCK - ROAD) * SC, (BLOCK - ROAD) * SC); }
  g.globalAlpha = 1;
})();
function drawMap() {
  mctx.drawImage(mapBG, 0, 0);
  const dot = (x, z, c, r) => { mctx.fillStyle = c; mctx.beginPath(); mctx.arc(x * SC, z * SC, r, 0, 7); mctx.fill(); };
  dot(GIVER.x, GIVER.z, '#38bdf8', 3); dot(GARAGE.x, GARAGE.z, '#facc15', 3);
  for (const h of humans) if (h.dead <= 0 && (h.kind === 'cop' || h.kind === 'gang')) dot(h.x, h.z, h.kind === 'cop' ? '#60a5fa' : '#f87171', 1.6);
  for (const c of cars) if (c.mode === 'police') dot(c.x, c.z, Math.floor(gameTime * 4) % 2 ? '#ef4444' : '#3b82f6', 2.4);
  if (mission) dot(mission.tx, mission.tz, '#ff3b30', 3.6);
  mctx.save(); mctx.translate(P.x * SC, P.z * SC); mctx.rotate(-P.a + PI); mctx.fillStyle = '#ffa13a'; mctx.beginPath(); mctx.moveTo(0, -5); mctx.lineTo(3.4, 3.4); mctx.lineTo(-3.4, 3.4); mctx.closePath(); mctx.fill(); mctx.restore();
}
function updHud() {
  $('hp').style.width = clamp(P.hp / P.maxhp * 100, 0, 100) + '%'; $('cash').textContent = '$' + cash;
  const w = WEAP[P.cur], inv = P.inv[P.cur]; $('wname').textContent = w.name; $('ammo').textContent = w.melee ? '' : (P.reload > 0 ? 'recharge…' : inv.mag + ' / ' + inv.res);
  const s = stars(); const el = $('stars'); el.textContent = '★'.repeat(s) + '☆'.repeat(5 - s); el.classList.toggle('hot', s > 0 && crimeT < 3);
  $('diff').textContent = 'Difficulté auto : ' + Math.round(effDiff * 100) + '%';
  const ms = $('mission'); if (mission) { ms.style.display = 'block'; ms.textContent = mission.text + (mission.time ? ' (' + Math.ceil(mission.time) + ' s)' : ''); } else ms.style.display = 'none';
  $('hurt').style.opacity = hurtT > 0 || P.hp < 30 ? Math.max(hurtT * 3, P.hp < 30 ? .5 : 0) : 0;
}

/* ---------------------------------------------------------------- Écran de départ */
let hero = HEROES[0];
function portrait(h) {
  const s = h.spec, hat = { cap: `<path d="M26 28 Q40 12 54 28 L58 30 L26 30Z" fill="${s.hatCol}"/>`, wrap: `<ellipse cx="40" cy="26" rx="17" ry="10" fill="${s.hatCol}"/>`, kufi: `<path d="M27 27 Q40 14 53 27Z" fill="${s.hatCol}"/>`, none: `<path d="M26 32 Q40 12 54 32 Q40 24 26 32Z" fill="${s.hair || '#0b0b0b'}"/>` }[s.hat] || '';
  return `<svg viewBox="0 0 80 80"><rect width="80" height="80" fill="#1b2433"/><path d="M10 80 Q12 52 40 52 Q68 52 70 80Z" fill="${s.shirt}"/><circle cx="40" cy="36" r="15" fill="${s.skin}"/>${hat}<circle cx="34" cy="37" r="1.6" fill="#111"/><circle cx="46" cy="37" r="1.6" fill="#111"/></svg>`;
}
(function buildSelect() {
  const box = $('heroes');
  HEROES.forEach((h, i) => { const d = document.createElement('div'); d.className = 'hero' + (i === 0 ? ' sel' : ''); d.innerHTML = portrait(h) + `<b>${h.name}</b><small>${h.desc}</small>`; d.onclick = () => { hero = h; box.querySelectorAll('.hero').forEach(x => x.classList.remove('sel')); d.classList.add('sel'); }; box.appendChild(d); });
})();
function startGame() {
  P.hero = hero; P.maxhp = hero.hp; P.hp = hero.hp;
  P.model = makeHuman(hero.spec); scene.add(P.model.root); P.inv = { fists: {}, pistol: { mag: 12, res: 36 } }; P.cur = 'pistol'; setHeld(P, 'pistol');
  P.wt = 0; recalcDiff(); camYaw = 0; running = true; $('start').classList.add('hide');
  for (let i = 0; i < 6; i++) spawnTraffic();
  feed('Bienvenue à Abidjan', '#ff9a2e');
}
$('play').addEventListener('click', () => { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* ok */ } startGame(); });

/* ---------------------------------------------------------------- Boucle + qualité adaptative */
let last = 0, fpsT = 0, fpsN = 0, spawnT = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  fpsT += dt; fpsN++;
  if (fpsT > 2.5) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (running && fps < 28 && (qf > .5 || pixelRatio > .8)) { qf = Math.max(.5, qf - .15); pixelRatio = Math.max(.75, pixelRatio - .2); onResize(); } }
  if (running) { update(dt); updCamera(dt); updHud(); drawMap(); }
  else { const a = ts / 9000; camera.position.set(SPAWN.x + Math.sin(a) * 60, 32, SPAWN.z + Math.cos(a) * 60); camera.lookAt(SPAWN.x, 6, SPAWN.z); }
  updSky(); renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = { P, humans, cars, scene, camera, renderer, get wanted() { return wanted; }, set wanted(v) { wanted = v; }, startGame, WEAP, keys, update };
