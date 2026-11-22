(() => {
'use strict';
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const fx = document.createElement('canvas'), fxc = fx.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  fx.width = W * DPR; fx.height = H * DPR;
}
addEventListener('resize', resize); resize();

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const adiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round((n >> 16) * f), 0, 255), g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255), b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

/* ---------- Images (tes SVG) ---------- */
const imgs = {};
['hero', 'rival', 'passant', 'passante', 'voiture', 'voiture2'].forEach(n => { const i = new Image(); i.src = n + '.svg'; imgs[n] = i; });
function spr(img, x, y, a, w, h, alpha) {
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.drawImage(img, -w / 2, -(h || w) / 2, w, h || w); ctx.restore();
}

/* ---------- Monde ---------- */
const N = 8, BLOCK = 400, ROAD = 130, INSET = 18, WORLD = N * BLOCK;
const bmap = {}, builds = [], trees = [];
(function gen() {
  const r = mulberry(77);
  const roofs = ['#b9a58a', '#9aa7b0', '#c98f6b', '#8fa58a', '#b27d7d', '#a8a29a', '#d3c3a0', '#c9b27a'];
  const cell = (BLOCK - ROAD - 2 * INSET - 12) / 2;
  for (let gx = 0; gx < N; gx++) for (let gy = 0; gy < N; gy++) {
    const x0 = gx * BLOCK + ROAD + INSET, y0 = gy * BLOCK + ROAD + INSET, L = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const cx = x0 + i * (cell + 12), cy = y0 + j * (cell + 12);
      if (r() < 0.15) { for (let t = 0; t < 3; t++) trees.push({ x: cx + r() * cell, y: cy + r() * cell, s: 14 + r() * 10 }); continue; }
      const w = cell - r() * 30, h = cell - r() * 30;
      const roof = roofs[Math.floor(r() * roofs.length)];
      const b = { x: cx + r() * (cell - w), y: cy + r() * (cell - h), w, h, z: 30 + r() * 90, roof };
      b.walls = [shade(roof, .82), shade(roof, .6), shade(roof, .7), shade(roof, .9)];
      b.detail = shade(roof, .86);
      L.push(b); builds.push(b);
    }
    bmap[gx + ',' + gy] = L;
  }
})();

function collideB(e) {
  let hit = false;
  const gx = Math.floor(e.x / BLOCK), gy = Math.floor(e.y / BLOCK);
  for (let i = gx - 1; i <= gx + 1; i++) for (let j = gy - 1; j <= gy + 1; j++) {
    const L = bmap[i + ',' + j]; if (!L) continue;
    for (const b of L) {
      const cx = clamp(e.x, b.x, b.x + b.w), cy = clamp(e.y, b.y, b.y + b.h);
      const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
      if (d2 < e.r * e.r) {
        hit = true;
        if (d2 > 0.0001) { const d = Math.sqrt(d2); e.x += dx / d * (e.r - d); e.y += dy / d * (e.r - d); }
        else {
          const l = e.x - b.x, rr = b.x + b.w - e.x, t = e.y - b.y, bb = b.y + b.h - e.y, m = Math.min(l, rr, t, bb);
          if (m === l) e.x = b.x - e.r; else if (m === rr) e.x = b.x + b.w + e.r; else if (m === t) e.y = b.y - e.r; else e.y = b.y + b.h + e.r;
        }
      }
    }
  }
  e.x = clamp(e.x, e.r, WORLD - e.r); e.y = clamp(e.y, e.r, WORLD - e.r);
  return hit;
}
const step = (e, dx, dy) => { e.x += dx; e.y += dy; return collideB(e); };

/* ---------- Entrées ---------- */
const keys = {}, btn = {}, joy = { x: 0, y: 0 };
let wantEnter = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyE' && !e.repeat) wantEnter = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('contextmenu', e => e.preventDefault());
const stick = $('stick'), knob = $('knob'); let sid = null;
function sv(e) {
  const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy; const m = r.width / 2 * .8, d = Math.hypot(dx, dy);
  if (d > m) { dx = dx / d * m; dy = dy / d * m; }
  joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
}
stick.addEventListener('pointerdown', e => { sid = e.pointerId; stick.setPointerCapture(e.pointerId); sv(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === sid) sv(e); });
const sEnd = e => { if (e.pointerId === sid) { sid = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
stick.addEventListener('pointerup', sEnd); stick.addEventListener('pointercancel', sEnd);
document.querySelectorAll('.btn').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); btn[k] = true; if (k === 'enter') wantEnter = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { btn[k] = false; }));
});

/* ---------- État du jeu ---------- */
const SPAWN = { x: 3 * BLOCK + ROAD / 2, y: 3 * BLOCK + ROAD / 2 };
const P = { x: SPAWN.x, y: SPAWN.y, a: 0, vx: 0, vy: 0, hp: 100, maxhp: 100, r: 15, cd: 0, atkT: 0, atkDur: .2, atkKind: '', hit: 0, car: null, dead: 0, combo: 0, comboT: 0, sprint: false };
let enemies = [], peds = [], cars = [], floaters = [];
let cash = 0, heat = 0, kills = 0, deaths = 0, diff = 1, effDiff = 1;
let combatT = 99, gameTime = 0, spawnT = 0, msgT = 0, running = false;
const cam = { x: P.x, y: P.y, zoom: 1 };

function say(t, d) { const m = $('msg'); m.textContent = t; m.classList.add('on'); msgT = d || 2.2; }
function float(x, y, txt, col) { floaters.push({ x, y, txt, col: col || '#fff', t: 0 }); }
function recalcDiff() { diff = clamp(.85 + kills * .025 - deaths * .15, .6, 1.6); }

/* ---------- Voitures ---------- */
function repositionCar(c) {
  const k = Math.floor(rand(0, N)), dir = Math.floor(rand(0, 4));
  const c0 = k * BLOCK + ROAD / 2, along = clamp((dir < 2 ? P.x : P.y) + rand(-950, 950), 20, WORLD - 20);
  if (dir === 0) { c.a = 0; c.y = c0 + ROAD / 4; c.x = along; }
  else if (dir === 1) { c.a = Math.PI; c.y = c0 - ROAD / 4; c.x = along; }
  else if (dir === 2) { c.a = Math.PI / 2; c.x = c0 - ROAD / 4; c.y = along; }
  else { c.a = -Math.PI / 2; c.x = c0 + ROAD / 4; c.y = along; }
  if (Math.hypot(c.x - P.x, c.y - P.y) < 450) { if (dir < 2) c.x = clamp(P.x + (c.x > P.x ? 700 : -700), 20, WORLD - 20); else c.y = clamp(P.y + (c.y > P.y ? 700 : -700), 20, WORLD - 20); }
  c.sp = c.v; c.hp = 100;
}
function newCar() {
  const c = { x: 0, y: 0, a: 0, sp: 0, v: rand(85, 130), r: 26, hp: 100, mode: 'traffic', img: Math.random() < .5 ? 'voiture' : 'voiture2' };
  repositionCar(c); return c;
}
for (let i = 0; i < 12; i++) cars.push(newCar());

function updCar(c, dt) {
  if (c.mode === 'player') {
    const up = keys.KeyW || keys.ArrowUp, dn = keys.KeyS || keys.ArrowDown;
    let thr = (up ? 1 : 0) - (dn ? 1 : 0) - joy.y; thr = clamp(thr, -1, 1);
    const st = clamp((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x, -1, 1);
    const brake = keys.ShiftLeft || keys.ShiftRight || keys.Space || btn.sprint;
    if (Math.abs(thr) > .05) c.sp += thr * (thr * c.sp >= 0 ? 230 : 320) * dt; else c.sp *= (1 - 1.1 * dt);
    if (brake) c.sp *= (1 - 3.2 * dt);
    c.sp = clamp(c.sp, -100, 340);
    c.a += st * dt * 2.4 * clamp(c.sp / 90, -1, 1);
  } else if (c.mode === 'traffic') {
    const ax = c.x + Math.cos(c.a) * 75, ay = c.y + Math.sin(c.a) * 75;
    let block = Math.hypot(ax - P.x, ay - P.y) < 48 && !P.car;
    for (const q of peds) if (!block && Math.hypot(ax - q.x, ay - q.y) < 40) block = true;
    for (const q of enemies) if (!block && Math.hypot(ax - q.x, ay - q.y) < 40) block = true;
    for (const q of cars) if (!block && q !== c && Math.hypot(ax - q.x, ay - q.y) < 55) block = true;
    c.sp = lerp(c.sp, block ? 0 : c.v, clamp(dt * 3, 0, 1));
    if (Math.hypot(c.x - P.x, c.y - P.y) > 1300 || c.x < -30 || c.y < -30 || c.x > WORLD + 30 || c.y > WORLD + 30) repositionCar(c);
  } else { c.sp *= (1 - 2 * dt); }
  c.x += Math.cos(c.a) * c.sp * dt; c.y += Math.sin(c.a) * c.sp * dt;
  if (collideB(c)) {
    if (Math.abs(c.sp) > 60) { c.hp -= Math.abs(c.sp) / 14; if (c.mode === 'player') float(c.x, c.y - 30, 'Choc !', '#ffb04a'); }
    c.sp *= -.3;
    if (c.mode === 'traffic') c.a += Math.PI;
  }
  if (c.mode === 'player' && Math.abs(c.sp) > 110) {
    for (const t of enemies.concat(peds)) {
      if (t.dead) continue;
      if (Math.hypot(t.x - c.x, t.y - c.y) < c.r + t.r + 6) {
        const d = Math.abs(c.sp) / 5;
        t.hp -= d; t.hit = .2; t.stun = .4; t.vx = Math.cos(c.a) * c.sp * 1.2; t.vy = Math.sin(c.a) * c.sp * 1.2;
        float(t.x, t.y - 20, '-' + Math.round(d), '#ff6a6a'); combatT = 0;
        heat += t.gang ? .08 : .25; if (!t.gang) t.flee = 4;
        c.sp *= .88;
        if (t.hp <= 0) kill(t);
      }
    }
  }
  if (c.hp <= 0 && c.mode === 'player') { say('Voiture détruite !'); exitCar(true); c.mode = 'parked'; c.hp = 1; }
}

function enterCar() {
  let best = null, bd = 85;
  for (const c of cars) { if (c.mode === 'player') continue; const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd) { bd = d; best = c; } }
  if (!best) { say('Aucune voiture à portée', 1.2); return; }
  if (best.mode === 'traffic') { heat += .2; combatT = 0; float(best.x, best.y - 30, 'Voiture volée !', '#ffcf4a'); }
  best.mode = 'player'; P.car = best; say('E pour descendre', 1.5);
}
function exitCar(force) {
  const c = P.car; if (!c) return;
  if (!force && Math.abs(c.sp) > 180) { say('Trop vite !', 1); return; }
  c.mode = 'parked'; P.car = null;
  for (const s of [1, -1]) {
    P.x = c.x + Math.cos(c.a + Math.PI / 2 * s) * 46; P.y = c.y + Math.sin(c.a + Math.PI / 2 * s) * 46;
    const probe = { x: P.x, y: P.y, r: P.r }; if (!collideB(probe) || (probe.x === P.x && probe.y === P.y)) break;
  }
  collideB(P);
}

/* ---------- Combat ---------- */
function attack(kind) {
  if (P.cd > 0 || P.car || P.dead > 0) return;
  const k = kind === 'punch' ? { dmg: 12, rng: 48, cd: .32, kb: 150, dur: .18 } : { dmg: 22, rng: 66, cd: .66, kb: 340, dur: .3 };
  P.cd = k.cd; P.atkT = k.dur; P.atkDur = k.dur; P.atkKind = kind;
  const mult = 1 + Math.min(P.combo, 5) * .1; let any = false;
  for (const t of enemies.concat(peds)) {
    if (t.dead) continue;
    const dx = t.x - P.x, dy = t.y - P.y, d = Math.hypot(dx, dy) || 1;
    if (d < k.rng + t.r && Math.abs(adiff(Math.atan2(dy, dx), P.a)) < 1.15) {
      any = true; const dmg = Math.round(k.dmg * mult);
      t.hp -= dmg; t.hit = .18; t.stun = .28; t.vx = dx / d * k.kb; t.vy = dy / d * k.kb;
      float(t.x, t.y - 22, '-' + dmg, kind === 'kick' ? '#ffd24a' : '#fff'); combatT = 0;
      if (t.gang) heat += .05; else { heat += .2; t.flee = 4; }
      if (t.hp <= 0) kill(t);
    }
  }
  if (any) { P.combo++; P.comboT = 1.6; if (P.combo >= 3) float(P.x, P.y - 34, 'COMBO x' + P.combo, '#ff9a2e'); } else P.combo = 0;
}
function kill(t) {
  if (t.dead) return; t.dead = true;
  if (t.gang) {
    kills++; const g = Math.round(rand(20, 60) * (1 + heat * .2)); cash += g; heat += .15;
    float(t.x, t.y - 30, '+$' + g, '#7dff9a'); recalcDiff();
  } else { const g = Math.round(rand(5, 15)); cash += g; heat += .35; float(t.x, t.y - 30, '+$' + g, '#7dff9a'); }
}
function hurtPlayer(dmg) {
  if (P.dead > 0) return;
  if (P.sprint && (Math.abs(P.vx) + Math.abs(P.vy)) > 100 && Math.random() < .4) { float(P.x, P.y - 28, 'Esquive !', '#8be9ff'); return; }
  const d = Math.round(dmg * effDiff); P.hp -= d; P.hit = .2; combatT = 0;
  float(P.x, P.y - 26, '-' + d, '#ff5a5a');
  if (P.hp <= 0) {
    P.hp = 0; P.dead = 2.6; deaths++; cash = Math.floor(cash * .9); recalcDiff();
    if (P.car) exitCar(true);
    say('K.O. !', 2.4);
  }
}
function respawn() {
  P.hp = P.maxhp; P.dead = 0; P.x = SPAWN.x; P.y = SPAWN.y; P.vx = P.vy = 0; P.combo = 0;
  heat *= .4; enemies = []; say('Retour dans le quartier…', 2);
}

/* ---------- Ennemis & passants ---------- */
function spawnEnemy() {
  let x, y, tries = 0;
  do {
    const k = Math.floor(rand(0, N));
    if (Math.random() < .5) { x = k * BLOCK + rand(15, ROAD - 15); y = P.y + rand(-720, 720); }
    else { y = k * BLOCK + rand(15, ROAD - 15); x = P.x + rand(-720, 720); }
    x = clamp(x, 30, WORLD - 30); y = clamp(y, 30, WORLD - 30); tries++;
  } while (Math.hypot(x - P.x, y - P.y) < 420 && tries < 12);
  const hp = 60 + heat * 8;
  enemies.push({ gang: true, x, y, a: rand(0, 6.28), vx: 0, vy: 0, hp, maxhp: hp, r: 15, cd: rand(.3, 1), atkT: 0, pend: 0, hit: 0, stun: 0, wt: 0, wa: rand(0, 6.28), dead: false });
}
function spawnPed() {
  const k = Math.floor(rand(0, N)); let x, y;
  if (Math.random() < .5) { x = k * BLOCK + ROAD + rand(0, 12); y = P.y + rand(-800, 800); }
  else { y = k * BLOCK + ROAD + rand(0, 12); x = P.x + rand(-800, 800); }
  x = clamp(x, 30, WORLD - 30); y = clamp(y, 30, WORLD - 30);
  if (Math.hypot(x - P.x, y - P.y) < 250) return;
  peds.push({ gang: false, x, y, a: rand(0, 6.28), vx: 0, vy: 0, hp: 40, maxhp: 40, r: 13, hit: 0, stun: 0, wt: 0, wa: rand(0, 6.28), flee: 0, dead: false, img: Math.random() < .5 ? 'passant' : 'passante' });
}
function updEnemy(e, dt) {
  e.hit = Math.max(0, e.hit - dt); e.cd -= dt; e.atkT = Math.max(0, e.atkT - dt);
  if (e.stun > 0) { e.stun -= dt; step(e, e.vx * dt, e.vy * dt); e.vx *= .86; e.vy *= .86; return; }
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
  const sp = (105 + heat * 10) * (.85 + effDiff * .15), aggro = 260 + heat * 110;
  let tx = 0, ty = 0, spd = 0;
  if (P.dead > 0 || P.car && d > 90) { e.wt -= dt; if (e.wt <= 0) { e.wt = rand(1, 3); e.wa = rand(0, 6.28); } tx = Math.cos(e.wa); ty = Math.sin(e.wa); spd = 40; e.a = e.wa; }
  else if (e.hp < e.maxhp * .3 && heat < 3.5) { tx = -dx / d; ty = -dy / d; spd = sp * 1.1; e.a = Math.atan2(ty, tx); }
  else if (d < aggro) {
    e.a = Math.atan2(dy, dx);
    if (d > 38) { tx = dx / d; ty = dy / d; spd = sp; }
    else if (e.cd <= 0 && !P.car) { e.cd = rand(.8, 1.5) / (.7 + effDiff * .3); e.atkT = .25; e.pend = .15; }
  } else { e.wt -= dt; if (e.wt <= 0) { e.wt = rand(1, 3); e.wa = rand(0, 6.28); } tx = Math.cos(e.wa); ty = Math.sin(e.wa); spd = 40; e.a = e.wa; }
  if (spd) { if (step(e, tx * spd * dt, ty * spd * dt)) e.wa += 2; }
  for (const o of enemies) if (o !== e) { const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy); if (od > 0 && od < 28) { e.x += ox / od * 40 * dt; e.y += oy / od * 40 * dt; } }
  if (e.pend > 0) { e.pend -= dt; if (e.pend <= 0 && d < 56 && !P.car) hurtPlayer(8 * (.9 + heat * .06)); }
}
function updPed(p, dt) {
  p.hit = Math.max(0, p.hit - dt);
  if (p.stun > 0) { p.stun -= dt; step(p, p.vx * dt, p.vy * dt); p.vx *= .86; p.vy *= .86; return; }
  const dP = Math.hypot(P.x - p.x, P.y - p.y);
  if (P.atkT > 0 && dP < 200) p.flee = Math.max(p.flee, 3);
  if (P.car && Math.abs(P.car.sp) > 150 && dP < 180) p.flee = Math.max(p.flee, 2);
  if (combatT < 1 && dP < 260) p.flee = Math.max(p.flee, 2);
  let tx, ty, spd;
  if (p.flee > 0) { p.flee -= dt; const dx = p.x - P.x, dy = p.y - P.y, d = Math.hypot(dx, dy) || 1; tx = dx / d; ty = dy / d; spd = 150; p.a = Math.atan2(ty, tx); }
  else { p.wt -= dt; if (p.wt <= 0) { p.wt = rand(2, 5); p.wa = rand(0, 6.28); } tx = Math.cos(p.wa); ty = Math.sin(p.wa); spd = 34; p.a = p.wa; }
  if (step(p, tx * spd * dt, ty * spd * dt)) p.wa += 2;
}

/* ---------- Joueur ---------- */
function updPlayer(dt) {
  P.hit = Math.max(0, P.hit - dt); P.cd -= dt; P.atkT = Math.max(0, P.atkT - dt);
  if (P.comboT > 0) { P.comboT -= dt; if (P.comboT <= 0) P.combo = 0; }
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); return; }
  if (wantEnter) { wantEnter = false; if (P.car) exitCar(); else enterCar(); }
  if (P.car) { updCar(P.car, dt); P.x = P.car.x; P.y = P.car.y; P.vx = Math.cos(P.car.a) * P.car.sp; P.vy = Math.sin(P.car.a) * P.car.sp; P.a = P.car.a; return; }
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
  P.sprint = !!(keys.ShiftLeft || keys.ShiftRight || btn.sprint);
  const spd = P.sprint ? 250 : 170;
  P.vx = lerp(P.vx, ix * spd, clamp(dt * 12, 0, 1)); P.vy = lerp(P.vy, iy * spd, clamp(dt * 12, 0, 1));
  step(P, P.vx * dt, P.vy * dt);
  if (m > .15) P.a += adiff(Math.atan2(iy, ix), P.a) * clamp(dt * 14, 0, 1);
  else if (enemies.length) {
    let bd = 140, bt = null; for (const e of enemies) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < bd) { bd = d; bt = e; } }
    if (bt) P.a += adiff(Math.atan2(bt.y - P.y, bt.x - P.x), P.a) * clamp(dt * 10, 0, 1);
  }
  if (keys.KeyJ || btn.punch) attack('punch');
  if (keys.KeyK || btn.kick) attack('kick');
}

/* ---------- Mise à jour ---------- */
function update(dt) {
  gameTime += dt; combatT += dt; spawnT -= dt;
  effDiff = diff * (P.hp < 30 ? .8 : P.hp > 85 ? 1.1 : 1);
  updPlayer(dt);
  for (const e of enemies) updEnemy(e, dt);
  for (const p of peds) updPed(p, dt);
  for (const c of cars) if (c !== P.car) updCar(c, dt);
  enemies = enemies.filter(e => !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 1200);
  peds = peds.filter(p => !p.dead && Math.hypot(p.x - P.x, p.y - P.y) < 1100);
  if (combatT > 10) heat = Math.max(0, heat - dt * .04);
  heat = clamp(heat, 0, 5);
  const dark = darkness(), target = 2 + Math.floor(heat * 1.5) + (dark > .35 ? 1 : 0);
  if (spawnT <= 0) { spawnT = 1.8; if (enemies.length < Math.min(target, 10)) spawnEnemy(); if (peds.length < 22) spawnPed(); }
  for (const f of floaters) { f.t += dt; f.y -= 24 * dt; } floaters = floaters.filter(f => f.t < 1.1);
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').classList.remove('on'); }
  // Caméra adaptative
  let tz = clamp(Math.min(W, H) / 620, .75, 1.4);
  let near = false; for (const e of enemies) if (Math.hypot(e.x - P.x, e.y - P.y) < 190) { near = true; break; }
  if (P.car) tz *= .82 - Math.min(.22, Math.abs(P.car.sp) / 1300);
  else if (near) tz *= 1.18;
  else if (P.sprint) tz *= .93;
  if (P.hp < 30 && P.dead <= 0) tz *= 1.08;
  cam.zoom = lerp(cam.zoom, tz, clamp(dt * 2.5, 0, 1));
  const la = P.car ? clamp(Math.abs(P.car.sp) * .35, 0, 110) : 40;
  const fx2 = P.x + Math.cos(P.a) * la, fy2 = P.y + Math.sin(P.a) * la;
  cam.x = lerp(cam.x, fx2, clamp(dt * 5, 0, 1)); cam.y = lerp(cam.y, fy2, clamp(dt * 5, 0, 1));
  hud();
}
function darkness() { const t = (gameTime / 200 + .08) % 1; return clamp((1 - Math.cos(t * Math.PI * 2)) / 2 * 1.15, 0, .62); }
function hud() {
  $('hp').style.width = (P.hp / P.maxhp * 100) + '%';
  $('cash').textContent = '$' + cash;
  const s = Math.min(5, Math.floor(heat + .2)); $('heat').textContent = '★'.repeat(s) + '☆'.repeat(5 - s);
  $('diff').textContent = 'Difficulté auto : ' + Math.round(effDiff * 100) + '%';
  const t = (gameTime / 200 + .08) % 1, h = Math.floor((t * 24 + 12) % 24), mi = Math.floor(((t * 24 * 60) % 60));
  $('clock').textContent = String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}

/* ---------- Rendu ---------- */
function drawWorld() {
  ctx.fillStyle = '#8b8678'; ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.fillStyle = '#2b2d31';
  for (let k = 0; k < N; k++) { ctx.fillRect(k * BLOCK, 0, ROAD, WORLD); ctx.fillRect(0, k * BLOCK, WORLD, ROAD); }
  ctx.strokeStyle = '#d8c75a'; ctx.lineWidth = 3; ctx.setLineDash([26, 22]);
  for (let k = 0; k < N; k++) {
    const c = k * BLOCK + ROAD / 2;
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, WORLD); ctx.moveTo(0, c); ctx.lineTo(WORLD, c); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#2b2d31';
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) ctx.fillRect(i * BLOCK, j * BLOCK, ROAD, ROAD);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * BLOCK, y = j * BLOCK;
    for (let s = 6; s < ROAD - 6; s += 14) { ctx.fillRect(x + s, y - 22, 8, 16); ctx.fillRect(x - 22, y + s, 16, 8); }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
  for (let k = 0; k < N; k++) { ctx.strokeRect(k * BLOCK + 1, 0, ROAD - 2, WORLD); }
}
function drawBuilding(b) {
  const k = b.z / 700, ox = (b.x + b.w / 2 - cam.x) * k, oy = (b.y + b.h / 2 - cam.y) * k;
  const bx = [b.x, b.x + b.w, b.x + b.w, b.x], by = [b.y, b.y, b.y + b.h, b.y + b.h];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    ctx.fillStyle = b.walls[i]; ctx.beginPath();
    ctx.moveTo(bx[i], by[i]); ctx.lineTo(bx[j], by[j]); ctx.lineTo(bx[j] + ox, by[j] + oy); ctx.lineTo(bx[i] + ox, by[i] + oy); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = b.roof; ctx.fillRect(b.x + ox, b.y + oy, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.strokeRect(b.x + ox, b.y + oy, b.w, b.h);
  ctx.fillStyle = b.detail; ctx.fillRect(b.x + ox + b.w * .15, b.y + oy + b.h * .18, b.w * .3, b.h * .26);
  ctx.fillRect(b.x + ox + b.w * .55, b.y + oy + b.h * .55, b.w * .28, b.h * .28);
}
function drawShadow(x, y, rx, ry) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 6, rx, ry, 0, 0, 7); ctx.fill(); }
function drawFighter(e, img, isP) {
  drawShadow(e.x, e.y, 17, 14);
  let off = 0, alpha = 1;
  if (e.atkT > 0) { const dur = isP ? e.atkDur : .25, p = e.atkT / dur; off = Math.sin(p * Math.PI) * (isP && e.atkKind === 'kick' ? 14 : 9); }
  if (e.hit > 0 && Math.floor(e.hit * 30) % 2) alpha = .45;
  spr(imgs[img], e.x + Math.cos(e.a) * off, e.y + Math.sin(e.a) * off, e.a, 62, 62, alpha);
  if (isP && e.atkT > 0) {
    ctx.strokeStyle = e.atkKind === 'kick' ? 'rgba(255,210,80,.8)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = e.atkKind === 'kick' ? 5 : 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.atkKind === 'kick' ? 46 : 36, e.a - .7, e.a + .7); ctx.stroke();
  }
  if (!isP && e.hp < e.maxhp) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - 16, e.y - 34, 32, 5); ctx.fillStyle = '#ff4a4a'; ctx.fillRect(e.x - 16, e.y - 34, 32 * clamp(e.hp / e.maxhp, 0, 1), 5); }
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#1b1d22'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
  drawWorld();
  const vw = W / 2 / cam.zoom + 160, vh = H / 2 / cam.zoom + 160;
  const vis = (x, y) => Math.abs(x - cam.x) < vw && Math.abs(y - cam.y) < vh;
  for (const c of cars) if (vis(c.x, c.y)) { drawShadow(c.x, c.y, 46, 22); spr(imgs[c.img], c.x, c.y, c.a, 104, 52); }
  for (const p of peds) if (vis(p.x, p.y)) { drawShadow(p.x, p.y, 14, 12); spr(imgs[p.img], p.x, p.y, p.a, 56, 56, p.hit > 0 && Math.floor(p.hit * 30) % 2 ? .45 : 1); }
  for (const e of enemies) if (vis(e.x, e.y)) drawFighter(e, 'rival', false);
  if (!P.car) {
    if (P.dead > 0) { ctx.save(); ctx.globalAlpha = .55; spr(imgs.hero, P.x, P.y, P.a + 1.57, 56, 56); ctx.restore(); }
    else drawFighter(P, 'hero', true);
  }
  for (const b of builds) if (Math.abs(b.x + b.w / 2 - cam.x) < vw + 80 && Math.abs(b.y + b.h / 2 - cam.y) < vh + 80) drawBuilding(b);
  for (const t of trees) if (vis(t.x, t.y)) {
    const k = .12, ox = (t.x - cam.x) * k, oy = (t.y - cam.y) * k;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(t.x + 4, t.y + 6, t.s, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f7a3a'; ctx.beginPath(); ctx.arc(t.x + ox, t.y + oy, t.s, 0, 7); ctx.fill();
    ctx.fillStyle = '#3f9a4a'; ctx.beginPath(); ctx.arc(t.x + ox - 3, t.y + oy - 3, t.s * .6, 0, 7); ctx.fill();
  }
  ctx.font = 'bold 16px system-ui,Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)';
  for (const f of floaters) { ctx.globalAlpha = clamp(1.1 - f.t, 0, 1); ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Nuit : lumière autour du joueur
  const dark = darkness();
  if (dark > .02) {
    fxc.setTransform(1, 0, 0, 1, 0, 0); fxc.globalCompositeOperation = 'source-over'; fxc.clearRect(0, 0, fx.width, fx.height);
    fxc.fillStyle = `rgba(6,10,32,${dark})`; fxc.fillRect(0, 0, fx.width, fx.height);
    fxc.globalCompositeOperation = 'destination-out';
    const sx = (W / 2 + (P.x - cam.x) * cam.zoom) * DPR, sy = (H / 2 + (P.y - cam.y) * cam.zoom) * DPR, rad = (P.car ? 340 : 250) * cam.zoom * DPR;
    const g = fxc.createRadialGradient(sx, sy, rad * .1, sx, sy, rad); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fxc.fillStyle = g; fxc.beginPath(); fxc.arc(sx, sy, rad, 0, 7); fxc.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fx, 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  // Vignette rouge : chaleur haute ou vie basse
  const danger = Math.max(heat >= 3 ? (heat - 2) / 6 : 0, P.hp < 30 ? .35 : 0);
  if (danger > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
    g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, `rgba(180,0,0,${danger})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // Mini-carte
  const ms = 118, mx = W - ms - 10, my = 10, sc = ms / WORLD;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(mx, my, ms, ms);
  ctx.strokeStyle = 'rgba(200,200,210,.55)'; ctx.lineWidth = Math.max(1, ROAD * sc);
  ctx.beginPath(); for (let k = 0; k < N; k++) { const c = (k * BLOCK + ROAD / 2) * sc; ctx.moveTo(mx + c, my); ctx.lineTo(mx + c, my + ms); ctx.moveTo(mx, my + c); ctx.lineTo(mx + ms, my + c); } ctx.stroke();
  ctx.fillStyle = '#ff4a4a'; for (const e of enemies) ctx.fillRect(mx + e.x * sc - 1.5, my + e.y * sc - 1.5, 3, 3);
  ctx.fillStyle = '#ffa13a'; ctx.beginPath(); ctx.arc(mx + P.x * sc, my + P.y * sc, 3.5, 0, 7); ctx.fill();
}

/* ---------- Boucle ---------- */
let last = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (running) update(dt);
  render(); requestAnimationFrame(frame);
}
$('play').addEventListener('click', () => {
  $('start').classList.add('hide'); running = true; recalcDiff();
  say('Bienvenue à Abidjan City', 2.5);
});
requestAnimationFrame(frame);
})();
