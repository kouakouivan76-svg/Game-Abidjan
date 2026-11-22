/* =====================================================================
   core.js — outils, constantes, état partagé, rendu de base
   Convention : x = est, z = sud, y = haut. Angle `a` => avant = (sin a, cos a).
   ===================================================================== */
import * as THREE from 'three';
export { THREE };

export const $ = id => document.getElementById(id);
export const PI = Math.PI;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const irand = (a, b) => Math.floor(rand(a, b + 1));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const adiff = (a, b) => { let d = a - b; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; };
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const C = h => new THREE.Color(h);

/* Grille de la ville */
export const N = 8, BLOCK = 84, ROAD = 18, WORLD = N * BLOCK, AIRZ = 140, ZMAX = WORLD + ROAD + AIRZ;
export const DAYLEN = 420; // secondes réelles pour un jour de jeu

/* État global partagé entre modules */
export const G = {
  running: false, paused: false, cine: false, mode: 'story', started: false,
  time: 0, startHour: .33, cash: 0, wanted: 0, kills: 0, deaths: 0, diff: 1, effDiff: 1,
  crimeT: 99, combatT: 99, hurtT: 0, hitMark: 0, qf: 1, shadows: true,
  humans: [], cars: [], pickups: [], proj: [], remote: [],
  P: null, hero: null, hooks: {}, flags: {}, debug: {},
  settings: { quality: 'auto', volume: .7, music: true },
  noise: { x: 0, z: 0, t: 99 }
};

/* Rendu */
export const canvas = $('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
export let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(62, 1, .4, 900);
export const hemi = new THREE.HemisphereLight(0xdfefff, 0x8a7a5a, 1.5);
export const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 500;
sun.shadow.bias = -.0005; sun.shadow.normalBias = .06;
scene.add(hemi, sun, sun.target);
scene.background = C('#8ec9f0'); scene.fog = new THREE.Fog(0x8ec9f0, 80, 420);

export function setPixelRatio(p) { pixelRatio = p; onResize(); }
export function onResize() { renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', onResize); onResize();

export function setShadows(on) { G.shadows = on; renderer.shadowMap.enabled = on; sun.castShadow = on; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }

/* Messages à l'écran */
export function feed(t, col) {
  const box = $('feed'); if (!box) return; const d = document.createElement('div'); d.className = 'fi'; d.textContent = t; d.style.color = col || '#fff'; box.appendChild(d);
  setTimeout(() => d.remove(), 2600); while (box.children.length > 4) box.firstChild.remove();
}

/* Matériaux et géométries partagés */
export const BOX = new THREE.BoxGeometry(1, 1, 1);
const MATS = {}, BMATS = {}, PMATS = {};
export const M = c => MATS[c] || (MATS[c] = new THREE.MeshLambertMaterial({ color: c }));
export const MB = c => BMATS[c] || (BMATS[c] = new THREE.MeshBasicMaterial({ color: c }));
export const MP = (c, sh = 60) => PMATS[c + sh] || (PMATS[c + sh] = new THREE.MeshPhongMaterial({ color: c, shininess: sh, specular: 0x555555 }));
export function pb(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; }
const SH_G = new THREE.CircleGeometry(1, 14), SH_M = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false });
export function blob(parent, sx, sz) { const s = new THREE.Mesh(SH_G, SH_M); s.rotation.x = -PI / 2; s.position.y = .14; s.scale.set(sx, sz, 1); parent.add(s); s.userData.blob = true; return s; }
export const nightFX = { pool: null, haloMesh: null };
export const GC = {};
export const capsule = (r, l, a = 3, b = 8) => GC['c' + r + '_' + l] || (GC['c' + r + '_' + l] = new THREE.CapsuleGeometry(r, l, a, b));
export const sphere = (r, w = 10, h = 8) => GC['s' + r + w + h] || (GC['s' + r + w + h] = new THREE.SphereGeometry(r, w, h));
export function shadowAll(root, cast = true, recv = false) { root.traverse(o => { if (o.isMesh && !o.userData.blob) { o.castShadow = cast; o.receiveShadow = recv; } }); }

/* Constructeur de géométrie fusionnée (peu d'appels de dessin) */
export class GB {
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
  mesh(mat, cast = true, recv = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = recv; scene.add(m); return m;
  }
}
