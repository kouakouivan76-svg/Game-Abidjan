/* fx.js — particules (fumée, feu, étincelles, débris), flash lumineux, traceurs */
import { THREE, scene, BOX, PI, rand, clamp } from './core.js';

const MAX = 420;
const inst = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({ fog: true }), MAX);
inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst.frustumCulled = false; inst.count = 0;
inst.setColorAt(0, new THREE.Color(1, 1, 1)); inst.instanceColor.setUsage(THREE.DynamicDrawUsage);
scene.add(inst);
const P = [];   // {x,y,z,vx,vy,vz,life,max,size,grow,grav,drag,c0,c1}
const dummy = new THREE.Object3D(), col = new THREE.Color();
const c = h => new THREE.Color(h);

export function emit(x, y, z, vx, vy, vz, life, size, c0, c1, grav = 0, grow = 0, drag = .9) {
  if (P.length >= MAX) P.shift();
  P.push({ x, y, z, vx, vy, vz, life, max: life, size, grow, grav, drag, c0: c(c0), c1: c(c1 || c0), rot: rand(0, 6) });
}
export function smoke(x, y, z, n = 1, size = .8, dark = false) { for (let i = 0; i < n; i++) emit(x + rand(-.3, .3), y, z + rand(-.3, .3), rand(-.6, .6), rand(1.2, 2.6), rand(-.6, .6), rand(1.2, 2.4), size, dark ? '#2a2a2a' : '#777777', '#cfcfcf', -.4, 1.4, .96); }
export function fire(x, y, z, n = 1, size = .7) { for (let i = 0; i < n; i++) emit(x + rand(-.4, .4), y, z + rand(-.4, .4), rand(-.8, .8), rand(1.5, 3.4), rand(-.8, .8), rand(.4, .9), size, '#ffd34a', '#c2410c', -1, -.3, .93); }
export function sparks(x, y, z, n = 6, col = '#ffe08a') { for (let i = 0; i < n; i++) emit(x, y, z, rand(-4, 4), rand(.5, 4), rand(-4, 4), rand(.15, .35), .1, col, '#ff7a00', 9, -.1, .98); }
export function dust(x, y, z, n = 4) { for (let i = 0; i < n; i++) emit(x + rand(-.4, .4), y, z + rand(-.4, .4), rand(-1, 1), rand(.4, 1.2), rand(-1, 1), rand(.5, 1), .5, '#a89f8a', '#c8c0ae', -.3, 1, .95); }
export function debris(x, y, z, n = 8) { for (let i = 0; i < n; i++) emit(x, y, z, rand(-8, 8), rand(2, 9), rand(-8, 8), rand(.7, 1.4), rand(.12, .3), '#3b3b3b', '#111111', 16, -.05, .99); }
export function boomFX(x, y, z, r) {
  for (let i = 0; i < 18; i++) emit(x + rand(-1, 1), y + rand(0, 1), z + rand(-1, 1), rand(-r, r) * 1.2, rand(1, r * 1.1), rand(-r, r) * 1.2, rand(.5, 1.1), rand(1, 2.4), '#ffe08a', '#b91c1c', -2, -.4, .92);
  for (let i = 0; i < 10; i++) emit(x + rand(-1.5, 1.5), y + 1, z + rand(-1.5, 1.5), rand(-2, 2), rand(1.5, 4), rand(-2, 2), rand(1.6, 3), rand(1.6, 3), '#3a3a3a', '#8a8a8a', -.2, 1.8, .96);
  debris(x, y + .5, z, 8); flash(x, y + 2, z, '#ffb347', 12, .35);
}

/* flash lumineux (une seule lumière, créée une fois → pas de recompilation) */
const fl = new THREE.PointLight(0xffaa44, 0, 40, 1.6); scene.add(fl); let flT = 0, flMax = 0, flI = 0;
export function flash(x, y, z, color, intensity, dur) { fl.position.set(x, y, z); fl.color.set(color); flI = intensity; flT = dur; flMax = dur; }

/* traceurs (lignes éphémères) */
const tracers = [];
for (let i = 0; i < 10; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9a0 })); l.visible = false; l.frustumCulled = false; scene.add(l); tracers.push({ l, t: 0 }); }
let ti = 0;
export function tracer(x0, y0, z0, x1, y1, z1) { const T = tracers[ti++ % tracers.length], p = T.l.geometry.attributes.position; p.setXYZ(0, x0, y0, z0); p.setXYZ(1, x1, y1, z1); p.needsUpdate = true; T.l.visible = true; T.t = .06; }

export function updateFX(dt) {
  for (const t of tracers) if (t.l.visible) { t.t -= dt; if (t.t <= 0) t.l.visible = false; }
  if (flT > 0) { flT -= dt; fl.intensity = Math.max(0, flI * (flT / flMax)); } else fl.intensity = 0;
  let n = 0;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.life -= dt; if (p.life <= 0) { P.splice(i, 1); continue; }
    p.vy += p.grav * -dt * (p.grav > 0 ? 1 : 1); p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vz *= d;
    if (p.grav > 0) { p.vy -= p.grav * dt * 0; } if (p.y < .05 && p.grav > 0) { p.y = .05; p.vy *= -.3; p.vx *= .6; p.vz *= .6; }
  }
  for (const p of P) {
    const k = p.life / p.max, s = Math.max(.02, p.size * (1 + p.grow * (1 - k)) * (p.grow < 0 ? k : 1));
    dummy.position.set(p.x, p.y, p.z); dummy.scale.set(s, s, s); dummy.rotation.set(p.rot, p.rot * .7, 0); dummy.updateMatrix(); inst.setMatrixAt(n, dummy.matrix);
    col.copy(p.c0).lerp(p.c1, 1 - k); inst.setColorAt(n, col); n++;
  }
  inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
}
