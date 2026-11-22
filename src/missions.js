/* missions.js — moteur de missions : étapes, balises, échec/reprise, sauvegarde, journal, contrats */
import { THREE, G, scene, clamp, rand, pick, PI } from './core.js';
import { POI, resolve, routeBetween, collide } from './world.js';
import { spawnHuman } from './ai.js';
import { gangSpec, NPC, COP_SPEC } from './chars.js';
import { spawnVehicle, removeVehicle, enterVehicle, explodeVehicle, VT } from './vehicles.js';
import { giveWeapon, killHuman, WEAP } from './combat.js';
import { say, banner, fade, hideHUD } from './ui.js';
import { feed } from './core.js';
import { playCine, isCine, skipCine } from './cine.js';
import { CAMP, CHAPTERS, makeContract } from './campaign.js';
import { sfx } from './audio.js';

const A = { m: null, i: -1, st: null, hs: [], cs: [], refs: {}, idx: 0, contract: false, failT: 0, failed: false, cool: 0, retry: false };
const SAVE = 'ac3d_save_v1';
const fmt = s => (s || '').replace(/\{h\}/g, G.hero ? G.hero.name : 'Koffi');
const P0 = (at, off) => { const b = resolve(at); return off ? { x: b.x + off[0], z: b.z + off[1], y: b.y } : b; };

/* ---------- balise 3D ---------- */
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
beacon.visible = false; beacon.frustumCulled = false; scene.add(beacon);

export function initMissions(mode, opts) { A.mode = mode; A.idx = 0; A.m = null; G.flags.story = mode === 'story'; window.__game && (window.__game.M = DBG); }
export function hasSave() { try { return !!localStorage.getItem(SAVE); } catch (e) { return false; } }
export function saveGame() {
  if (G.mode !== 'story') return; try {
    const P = G.P; localStorage.setItem(SAVE, JSON.stringify({ i: A.idx, cash: G.cash, kills: G.kills, hero: G.hero.name, inv: Object.fromEntries(Object.entries(P.inv).map(([k, v]) => [k, v.mag != null ? v.mag + v.res : 0])) }));
  } catch (e) { /* ok */ }
}
export function startStory() { A.idx = 0; beginMission(CAMP[0]); }
export function continueStory() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE)); A.idx = clamp(s.i || 0, 0, CAMP.length); G.cash = s.cash || 0; G.kills = s.kills || 0;
    for (const k in (s.inv || {})) giveWeapon(k, 1);
    const nx = CAMP[A.idx]; if (nx) { const p = resolve(nx.start); G.P.x = p.x + 3; G.P.z = p.z + 3; } feed('Partie chargée', '#7dff9a');
  } catch (e) { startStory(); }
}
export const journalHTML = () => {
  let h = '', last = -1; CAMP.forEach((m, i) => { if (m.ch !== last) { last = m.ch; h += '<div class="ch">Chapitre ' + (m.ch + 1) + ' — ' + CHAPTERS[m.ch] + '</div>'; } h += '<div class="' + (i < A.idx ? 'done' : '') + '">' + (i < A.idx ? '✓ ' : i === A.idx ? '▶ ' : '· ') + (i <= A.idx || m.ch <= (CAMP[A.idx] || {}).ch ? m.title : '???') + '</div>'; });
  return h || 'Aucune mission (mode libre)';
};

/* ---------- nettoyage ---------- */
function clean(keepCar) {
  for (const h of A.hs) { if (h.dead <= 0 || true) h.remove = true; } A.hs = [];
  for (const v of A.cs) { if (v === G.P.car) { v.mission = false; continue; } v.remove = true; try { removeVehicle(v); } catch (e) { /* ok */ } } A.cs = [];
  A.refs = {}; A.st = null; beacon.visible = false;
}
/* ---------- création d'objets ---------- */
function spawnObj(sp) {
  const b = P0(sp.at || A.st.at0 || 'spawn', sp.off);
  if (sp.k === 'npc') {
    const spec = typeof sp.look === 'string' ? NPC[sp.look] : sp.look; const h = spawnHuman('ped', 'npc', b.x, b.z, { spec, client: true, keep: true, name: sp.name || spec.name, a: sp.a || 0 }); h.client = true; A.hs.push(h); if (sp.id) A.refs[sp.id] = h; return h;
  }
  if (sp.k === 'veh') {
    const T = VT[sp.type]; let route = null, a = sp.a || 0;
    if (sp.route) { route = sp.route.map(r => resolve(r)); a = Math.atan2(route[0].x - b.x, route[0].z - b.z); } else if (sp.to) { route = T.kind === 'car' || T.kind === 'moto' ? routeBetween(b, resolve(sp.to)) : [resolve(sp.to)]; a = Math.atan2(route[0].x - b.x, route[0].z - b.z); }
    const air = T.kind === 'heli' || T.kind === 'plane';
    const v = spawnVehicle(sp.type, b.x, b.z, a, sp.mode || (route ? 'route' : 'parked'), sp.col, { route, loop: !!sp.loop, rSpeed: sp.spd, ri: 0, y: sp.y != null ? sp.y : air && sp.mode !== 'parked' ? 30 : 0, cruiseY: sp.cruiseY, sp: sp.sp || 0, mission: true }); if (sp.hp) { v.hp = v.maxhp = sp.hp; }
    A.cs.push(v); if (sp.id) A.refs[sp.id] = v; return v;
  }
}
function spawnEnemies(s, st, n) {
  const c = P0(s.at, s.off), R = s.spread || 9, out = [];
  for (let k = 0; k < n; k++) {
    const an = rand(0, 6.28), d = rand(3, R), role = s.kind === 'cop' ? 'agent' : (k === 0 && s.boss) ? 'chef' : (k % 4 === 3 ? 'bruiser' : 'grunt');
    const x = c.x + Math.sin(an) * d, z = c.z + Math.cos(an) * d; const gw = s.weapon || (s.gang === 'army' ? 'smg' : s.gang === 'lions' ? 'shotgun' : 'pistol');
    const spec = s.kind === 'cop' ? COP_SPEC : gangSpec(s.gang || 'corbeaux', role === 'agent' ? 'grunt' : role);
    const h = spawnHuman(s.kind === 'cop' ? 'cop' : 'gang', role, x, z, { spec, weapon: role === 'chef' && s.bossWeapon ? s.bossWeapon : (k % 3 === 2 && !s.weapon ? 'bat' : gw), gang: s.gang, keep: true, hold: !!s.hold, hp: s.boss && k === 0 ? s.boss.hp || 420 : (s.tough ? 130 : undefined), name: s.boss && k === 0 ? s.boss.name : undefined });
    collide(h, .45); if (s.alert || s.boss) h.agg = true; if (s.kind === 'cop') h.keep = true; A.hs.push(h); out.push(h); st.en.push(h);
  }
  return out;
}
const alive = h => h.dead <= 0 && G.humans.includes(h);
const valive = v => !v.wreck && G.cars.includes(v);

/* ---------- étapes ---------- */
function nextStep() {
  A.i++; if (A.i >= A.steps.length) return complete();
  const s = A.steps[A.i], st = A.st = { s, t: 0, en: [], vs: [], done: false, at0: s.at, wave: 1, text: fmt(s.text) };
  for (const sp of s.spawn || []) spawnObj(sp);
  const P = G.P;
  switch (s.t) {
    case 'car': { const v = spawnObj({ k: 'veh', type: s.type, at: s.at, off: s.off, a: s.a, col: s.col, id: s.id || 'car', mode: 'parked' }); st.v = v; break; }
    case 'kill': spawnEnemies(s, st, s.n || 4); if (s.kind === 'cop') G.wanted = Math.max(G.wanted, 2); st.boss = s.boss ? st.en[0] : null; break;
    case 'vkill': {
      const c = P0(s.at, s.off); for (let k = 0; k < (s.n || 1); k++) {
        const an = k * 2.4, d = s.n > 1 ? 14 : 0, v = spawnObj({ k: 'veh', type: s.type, at: { x: c.x + Math.sin(an) * d, z: c.z + Math.cos(an) * d }, a: rand(0, 6), mode: s.route ? 'route' : 'hostile', route: s.route, loop: true, spd: s.spd, y: s.y, cruiseY: s.cruiseY, hp: s.hp }); st.vs.push(v);
      } st.boss = s.boss ? st.vs[0] : null; if (s.boss) st.bossName = s.boss; break;
    }
    case 'follow': { const v = spawnObj({ k: 'veh', type: s.type, at: s.at, a: 0, id: s.id || 'lead', col: s.col, route: s.via ? s.via : null, to: s.via ? null : s.to, spd: s.spd || 14, y: s.y }); st.v = v; st.to = resolve(s.to || s.via[s.via.length - 1]); break; }
    case 'lose': G.wanted = Math.max(G.wanted, s.stars || 3); G.crimeT = 0; st.clear = 0; break;
    case 'talk': st.lineI = 0; st.lt = 0; break;
    case 'cine': playCine(s.id, () => { st.done = true; }); break;
    case 'fn': s.f(st); st.done = true; break;
  }
  if (s.give) for (const k of [].concat(s.give)) giveWeapon(k, 3);
  if (s.cash) G.cash += s.cash; if (s.heal) { P.hp = P.maxhp; if (P.car) P.car.hp = P.car.maxhp; }
  if (s.clearWanted) G.wanted = 0;
  if (s.time) st.left = s.time;
  if (s.t === 'goto' && s.text) { /* texte affiché */ }
}
function target(st) {
  const s = st.s;
  if (s.t === 'goto') { if (s.ref && A.refs[s.ref] && G.P.car !== A.refs[s.ref] && !s.onFoot) return { x: A.refs[s.ref].x, z: A.refs[s.ref].z, veh: true }; return P0(s.at, s.off); }
  if (s.t === 'car') return st.v ? { x: st.v.x, z: st.v.z, veh: true } : null;
  if (s.t === 'follow') return st.v ? { x: st.v.x, z: st.v.z, veh: true } : null;
  return null;
}
function needVeh(s) { const P = G.P; if (s.ref) return A.refs[s.ref] && P.car !== A.refs[s.ref] ? A.refs[s.ref] : null; if (s.veh) { const c = P.car; if (!c || !(c.kind === s.veh || c.type === s.veh)) return true; } return null; }

function tickStep(dt) {
  const st = A.st; if (!st) return; const s = st.s, P = G.P; st.t += dt;
  if (st.left != null) { st.left -= dt; if (st.left <= 0) return fail('Temps écoulé !'); }
  switch (s.t) {
    case 'goto': { const nv = needVeh(s); const tg = P0(s.at, s.off); if (nv) break; if (s.ref && A.refs[s.ref] && !valive(A.refs[s.ref])) return fail('Véhicule détruit !'); if (Math.hypot(P.x - tg.x, P.z - tg.z) < (s.r || 7) && (!s.alt || (P.car ? P.car.y : 0) >= s.alt) && (!s.stop || !P.car || Math.abs(P.car.sp) < 3)) st.done = true; break; }
    case 'car': if (st.v && (!valive(st.v))) return fail('Véhicule détruit !'); if (P.car === st.v) st.done = true; break;
    case 'kill': {
      const left = st.en.filter(alive).length; st.left2 = left;
      if (s.kind === 'cop') G.wanted = Math.max(G.wanted, 1.5);
      if (!left) { if (st.wave < (s.waves || 1)) { st.wt = (st.wt || 0) + dt; if (st.wt > 2) { st.wt = 0; st.wave++; spawnEnemies({ ...s, boss: null }, st, s.n || 4); say('', 'Une autre vague arrive !', 2.5); } } else st.done = true; }
      break;
    }
    case 'vkill': { st.left2 = st.vs.filter(valive).length; if (!st.left2) st.done = true; break; }
    case 'follow': {
      const v = st.v; if (!v || !valive(v)) return fail('Le véhicule suivi est détruit !');
      const d = Math.hypot(P.x - v.x, P.z - v.z); st.far = d > (s.max || 110) ? (st.far || 0) + dt : 0; if (st.far > 9) return fail('Tu as perdu la cible !');
      if (v.arrived || Math.hypot(v.x - st.to.x, v.z - st.to.z) < 18) { if (d < 40 || s.free) st.done = true; } break;
    }
    case 'lose': if (G.wanted <= .01) { st.clear += dt; if (st.clear > 1.5) st.done = true; } break;
    case 'talk': { st.lt -= dt; if (st.lt <= 0) { const l = s.lines[st.lineI++]; if (!l) { st.done = true; break; } say(fmt(l[0]), fmt(l[1]), 3 + l[1].length * .035); st.lt = 2.6 + l[1].length * .045; } break; }
    case 'wait': if (st.t >= (s.t2 || s.d || 2)) st.done = true; break;
    case 'cine': break;
  }
  if (st.done || st.cheatDone) { if (s.ok) say(fmt(s.ok[0]), fmt(s.ok[1]), 4); if (s.reward) { G.cash += s.reward; feed('+$' + s.reward, '#7dff9a'); } sfx && sfx('pickup'); nextStep(); }
}
function complete() {
  const m = A.m, cash = m.cash || 0; G.cash += cash; sfx && sfx('win'); banner('MISSION RÉUSSIE', m.title + (cash ? ' · +$' + cash : ''), '#7dff9a', 4);
  const wasContract = A.contract; clean(); A.m = null; A.contract = false; A.cool = 4;
  if (!wasContract) { A.idx++; saveGame(); if (A.idx >= CAMP.length) { G.flags.finished = true; setTimeout(() => banner('FIN DE L\'HISTOIRE', 'Abidjan est à toi. Mode libre et contrats toujours disponibles.', '#ffd23a', 6), 4500); } }
}
function fail(why) {
  if (A.failed) return; A.failed = true; A.failT = 0; banner('MISSION ÉCHOUÉE', why, '#ff6b6b', 3.2); fade(1, 900); sfx && sfx('fail');
}
export function retryMission() { const m = A.m || CAMP[A.idx]; if (!m) return; const was = A.contract; clean(); A.m = null; A.contract = was; A.retry = true; const p = resolve(m.start); const P = G.P; if (P.car) G.hooks.exitVehicle && G.hooks.exitVehicle(true); P.x = p.x + 3; P.z = p.z + 3; P.hp = P.maxhp; P.dead = 0; G.wanted = 0; beginMission(m, true); }
function beginMission(m, retry) {
  clean(); A.m = m; A.i = -1; A.failed = false; A.st = null; A.retry = !!retry;
  A.steps = m.steps.slice(); if (m.intro && !retry) A.steps.unshift({ t: 'cine', id: m.intro });
  if (!retry && m.chStart) banner('CHAPITRE ' + (m.ch + 1), CHAPTERS[m.ch], '#ffd23a', 3.6);
  if (m.setup) m.setup(); fade(0, 600); nextStep();
}
const restoreSteps = () => {};

/* ---------- boucle ---------- */
export function updateMissions(dt) {
  const P = G.P; A.cool = Math.max(0, A.cool - dt);
  if (A.failed) { A.failT += dt; if (A.failT > 1.2 && P.dead <= 0 || A.failT > 6) { const m = A.m; restoreSteps(m); A.failed = false; retryMission(); } return; }
  if (A.auto) { if (A.m && !A.failed) { for (let k = 0; k < 3; k++) DBG.cheat(); } else A.auto = false; }
  if (!A.m) {
    beacon.visible = false; const ready = !G.cine && A.cool <= 0 && P.dead <= 0;
    if (ready) { const nx = CAMP[A.idx]; if (G.mode === 'story' && nx) { const p = resolve(nx.start); if (Math.hypot(P.x - p.x, P.z - p.z) < (/^dock/.test(nx.start) ? 10 : 4.5)) { restoreSteps(nx); beginMission(nx); return; } } const c = POI.marcory2; if ((G.mode !== 'story' || A.idx >= 4) && Math.hypot(P.x - c.x, P.z - c.z) < 4.5) { A.contract = true; beginMission(makeContract()); } }
    return;
  }
  if (P.dead > 0) { if (!A.failed) fail('Tu es K.O.'); return; }
  if (isCine() && A.st && A.st.s.t === 'cine') { return; }
  tickStep(dt);
  const st = A.st; if (!st) { beacon.visible = false; return; } const tg = target(st);
  if (tg && !G.cine) { beacon.visible = true; const r = st.s.r || 6; beacon.scale.set(r * .55, 1, r * .55); beacon.position.set(tg.x, 30, tg.z); beacon.material.opacity = .26 + Math.sin(G.time * 4) * .08; beacon.material.color.set(tg.veh ? 0x66ddff : 0xffcc33); } else beacon.visible = false;
}
export function missionInfo() {
  const m = A.m, P = G.P; if (!m) {
    const nx = CAMP[A.idx]; if (G.mode === 'story' && nx) { const p = resolve(nx.start); return { title: 'Prochaine mission', text: nx.title + ' — ' + (POI[nx.start] ? POI[nx.start].name : ''), dist: Math.hypot(P.x - p.x, P.z - p.z) }; }
    if (G.mode !== 'story') { const c = POI.marcory2; return { title: 'Contrats', text: 'Va à ' + c.name + ' pour un job', dist: Math.hypot(P.x - c.x, P.z - c.z) }; } return null;
  }
  const st = A.st; if (!st) return { title: m.title, text: '…' }; const s = st.s; let text = st.text || '', dist = null;
  const nv = s.t === 'goto' ? needVeh(s) : null; if (nv && nv !== true) text = 'Remonte dans ' + VT[nv.type].name; else if (nv === true) text = 'Prends un véhicule : ' + ({ boat: 'bateau', heli: 'hélicoptère', plane: 'avion', tank: 'char', car: 'voiture', moto: 'moto' }[s.veh] || s.veh);
  const tg = target(st); if (tg) dist = Math.hypot(P.x - tg.x, P.z - tg.z);
  if (s.t === 'kill') text += ' (' + (st.left2 ?? st.en.length) + ')' + (s.waves ? ' · vague ' + st.wave + '/' + s.waves : ''); if (s.t === 'vkill') text += ' (' + (st.left2 ?? st.vs.length) + ')';
  const info = { title: (A.contract ? 'Contrat · ' : '') + m.title, text, dist, time: st.left };
  if (st.boss) { const b = st.boss; if (b.maxhp) info.boss = { name: s.boss.name || s.boss, hp: Math.max(0, b.hp), max: b.maxhp }; }
  return info;
}
export function missionMarkers() {
  const mk = [], P = G.P;
  if (!A.m) { const nx = CAMP[A.idx]; if (G.mode === 'story' && nx) { const p = resolve(nx.start); mk.push({ x: p.x, z: p.z, c: '#ffd23a', r: 5, edge: true, label: nx.title }); } if (G.mode !== 'story' || A.idx >= 4) mk.push({ x: POI.marcory2.x, z: POI.marcory2.z, c: '#7dff9a', r: 4, edge: true, sq: true, label: 'Contrats' }); return mk; }
  const st = A.st; if (!st) return mk; const tg = target(st); if (tg) mk.push({ x: tg.x, z: tg.z, c: tg.veh ? '#66ddff' : '#ffd23a', r: 5, edge: true, label: 'Objectif' });
  for (const h of st.en) if (alive(h)) mk.push({ x: h.x, z: h.z, c: '#ff4d4d', r: 2.4 }); for (const v of st.vs) if (valive(v)) mk.push({ x: v.x, z: v.z, c: '#ff4d4d', r: 3.4, edge: true });
  return mk;
}

/* ---------- debug / tests : simule un joueur qui réussit chaque étape ---------- */
export const MC = {
  tpObjective() { const st = A.st, P = G.P; if (!st) return false; const tg = target(st); if (!tg) return false; const c = P.car; if (c) { c.x = tg.x; c.z = tg.z; c.sp = 0; } P.x = tg.x + (c ? 0 : 2); P.z = tg.z; return true; },
  addTime(s) { if (A.st && A.st.left != null) { A.st.left += s; return true; } return false; },
  killStep() { const st = A.st; if (!st) return 0; let n = 0; for (const h of st.en) if (alive(h)) { killHuman(h, G.P); n++; } for (const v of st.vs) if (valive(v)) { explodeVehicle(v, G.P); n++; } return n; },
  finish() { A.auto = true; },
  active: () => !!A.m, idx: () => A.idx, total: () => CAMP.length, titles: () => CAMP.map((m, i) => (i + 1) + ' ' + m.title),
  jump(i) { if (i < 0 || i >= CAMP.length) return false; A.idx = i; if (A.m) clean(); A.contract = false; A.m = null; A.failed = false; beginMission(CAMP[i]); return true; },
  step() { return DBG.cheat(); }
};
const DBG = {
  A, CAMP,
  state: () => ({ idx: A.idx, mission: A.m && A.m.title, step: A.i, type: A.st && A.st.s.t, failed: A.failed, n: CAMP.length }),
  begin: i => { restoreSteps(A.m); A.idx = i; beginMission(CAMP[i]); },
  cheat() {
    const P = G.P; if (!A.m) { const nx = CAMP[A.idx]; if (nx) { const p = resolve(nx.start); if (P.car) G.hooks.exitVehicle(true); P.x = p.x + 1; P.z = p.z + 1; A.cool = 0; } return 'start'; } const st = A.st; if (!st) return 'none'; const s = st.s;
    if (isCine()) { skipCine(); return 'cine'; }
    switch (s.t) {
      case 'goto': { const nv = needVeh(s); if (nv && nv !== true) { P.x = nv.x + 3; P.z = nv.z; enterVehicle(); } else if (nv === true) { const v = spawnVehicle(s.veh === 'boat' ? 'speedboat' : s.veh === 'heli' ? 'heli' : s.veh === 'plane' ? 'avion' : s.veh === 'tank' ? 'tank' : 'taxi', P.x + 4, P.z, 0, 'parked'); if (s.veh === 'boat') { const l = POI.lagune1; v.x = l.x; v.z = l.z; P.x = l.x + 3; P.z = l.z; } enterVehicle(); } const t = P0(s.at, s.off); if (P.car) { P.car.x = t.x; P.car.z = t.z; P.car.sp = 0; if (s.alt) P.car.y = s.alt + 2; } P.x = t.x; P.z = t.z; break; }
      case 'car': P.x = st.v.x + 3; P.z = st.v.z; enterVehicle(); if (P.car !== st.v) { P.car = st.v; } break;
      case 'kill': for (const h of st.en) if (alive(h)) killHuman(h, P); break;
      case 'vkill': for (const v of st.vs) if (valive(v)) explodeVehicle(v, P); break;
      case 'follow': st.v.x = st.to.x; st.v.z = st.to.z; st.v.arrived = true; st.v.mode = 'parked'; P.x = st.v.x + 5; P.z = st.v.z; if (P.car) { P.car.x = P.x; P.car.z = P.z; } break;
      case 'lose': G.wanted = 0; break;
      default: st.t = 999; if (s.t === 'talk') { st.lineI = 999; st.lt = 0; }
    }
    return s.t;
  },
  teleport(x, z) { G.P.x = x; G.P.z = z; }
};
