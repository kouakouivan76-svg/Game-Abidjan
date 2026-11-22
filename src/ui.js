/* ui.js — interface : HUD, sous-titres, bannières, cartes, menus */
import { G, $, N, BLOCK, ROAD, WORLD, ZMAX, clamp, PI } from './core.js';
import { DIST, distOf, zoneName, POI, bmap } from './world.js';
import { HEROES } from './chars.js';
import { WEAP, stars } from './combat.js';
import { clockString } from './sky.js';
import { I } from './input.js';

/* ---------- sous-titres, bannières, fondu, bandes de cinéma ---------- */
export function say(who, text, dur = 4.5) {
  const box = $('subs'); const d = document.createElement('div'); d.className = 'sub'; d.style.animationDuration = dur + 's';
  d.innerHTML = (who ? '<b>' + who + ' :</b> ' : '') + text; box.appendChild(d); setTimeout(() => d.remove(), dur * 1000); while (box.children.length > 3) box.firstChild.remove();
}
let bnT = null;
export function banner(title, sub, color = '#fff', dur = 3.2) { const b = $('banner'); $('bt').textContent = title; $('bt').style.color = color; $('bs').textContent = sub || ''; b.classList.add('on'); clearTimeout(bnT); bnT = setTimeout(() => b.classList.remove('on'), dur * 1000); }
export function fade(a, ms) { const f = $('fade'); if (ms != null) f.style.transitionDuration = ms + 'ms'; f.style.opacity = a; }
export function letterbox(on) { $('bars').classList.toggle('on', on); }
export const clearSubs = () => { $('subs').innerHTML = ''; };

/* ---------- cartes ---------- */
const mini = $('map'), mctx = mini.getContext('2d');
export function drawMap(ctx, size, cx, cz, span, markers, isBig) {
  const sc = size / span, X = x => size / 2 + (x - cx) * sc, Z = z => size / 2 + (z - cz) * sc;
  ctx.fillStyle = '#20242b'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1f5f8c'; ctx.fillRect(0, 0, size, Math.max(0, Math.min(size, Z(-3))));
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { ctx.fillStyle = DIST[distOf(i, j)].ground; ctx.globalAlpha = .55; ctx.fillRect(X(i * BLOCK + ROAD), Z(j * BLOCK + ROAD), (BLOCK - ROAD) * sc, (BLOCK - ROAD) * sc); }
  ctx.globalAlpha = .6; ctx.fillStyle = '#6a7a50'; ctx.fillRect(X(0), Z(WORLD + ROAD), WORLD * sc, (ZMAX - WORLD - ROAD) * sc); ctx.fillStyle = '#34373b'; ctx.fillRect(X(40), Z(745), (WORLD - 80) * sc, 32 * sc); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(190,195,205,.55)'; ctx.lineWidth = Math.max(1, ROAD * sc * .7); ctx.beginPath();
  for (let k = 0; k < N; k++) { const c = k * BLOCK + ROAD / 2; ctx.moveTo(X(c), Z(0)); ctx.lineTo(X(c), Z(WORLD + ROAD)); } for (let k = 0; k <= N; k++) { const c = k * BLOCK + ROAD / 2; ctx.moveTo(X(0), Z(c)); ctx.lineTo(X(WORLD), Z(c)); } ctx.stroke();
  if (isBig) {
    if (sc > .75) { ctx.fillStyle = 'rgba(215,220,230,.55)'; for (const k in bmap) for (const b of bmap[k]) { if (b.x1 < cx - span / 2 || b.x0 > cx + span / 2 || b.z1 < cz - span / 2 || b.z0 > cz + span / 2) continue; ctx.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * sc, (b.z1 - b.z0) * sc); } }
    ctx.textAlign = 'center'; ctx.font = 'bold ' + clamp(sc * 26, 11, 20) + 'px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    const acc = {}; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const d = distOf(i, j), a = acc[d] || (acc[d] = [0, 0, 0]); a[0] += i * BLOCK + BLOCK / 2; a[1] += j * BLOCK + BLOCK / 2; a[2]++; }
    for (const d in acc) ctx.fillText(DIST[d].name, X(acc[d][0] / acc[d][2]), Z(acc[d][1] / acc[d][2]));
    ctx.fillStyle = 'rgba(180,215,255,.6)'; ctx.fillText('LAGUNE EBRIÉ', X(WORLD / 2), Z(-60)); ctx.fillText('AÉROPORT', X(WORLD / 2), Z(WORLD + 70));
    if (G.gps && G.P) { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(X(G.P.x), Z(G.P.z)); ctx.lineTo(X(G.gps.x), Z(G.gps.z)); ctx.stroke(); ctx.setLineDash([]); }
  }
  for (const m of markers) {
    if (m.x == null) continue; let x = X(m.x), z = Z(m.z); const edge = 6; let off = false;
    if (x < edge || x > size - edge || z < edge || z > size - edge) { if (!m.edge) continue; x = clamp(x, edge, size - edge); z = clamp(z, edge, size - edge); off = true; }
    ctx.fillStyle = m.c; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); if (m.sq) ctx.rect(x - m.r, z - m.r, m.r * 2, m.r * 2); else ctx.arc(x, z, off ? m.r * .8 : m.r, 0, 7); ctx.fill(); if (m.r > 3) ctx.stroke();
    if (isBig && m.icon && sc > .5) { ctx.fillStyle = '#111'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(m.icon, x, z + 3); }
    if (isBig && m.label && (sc > 1.1 || !m.shop)) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.strokeText(m.label, x, z - m.r - 3); ctx.fillText(m.label, x, z - m.r - 3); }
  }
  const P = G.P; if (P) { ctx.save(); ctx.translate(X(P.x), Z(P.z)); ctx.rotate(-P.a + PI); ctx.fillStyle = '#ffa13a'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
}
export function drawMinimap(markers) { drawMap(mctx, 130, G.P.x, G.P.z, 330, markers, false); }
export function staticMarkers() {
  const L = [['maquis', "Maquis"], ['garage', 'Garage'], ['port', 'Port'], ['aeroport', 'Aéroport'], ['camp', 'Camp'], ['tour', 'Tour Ébène'], ['planque', 'Planque'], ['stade', 'Stade']];
  return L.map(([k, l]) => ({ x: POI[k].x, z: POI[k].z, c: '#facc15', r: 3, label: l, sq: true }));
}

/* ---------- HUD ---------- */
let lastZone = '';
export function updateHUD(info) {
  const P = G.P; $('hp').style.width = clamp(P.hp / P.maxhp * 100, 0, 100) + '%'; { const ab = $('abar'); ab.classList.toggle('on', (P.armor || 0) > 0); $('armor').style.width = clamp(P.armor || 0, 0, 100) + '%'; } $('cash').textContent = '$' + G.cash;
  const w = WEAP[P.cur], inv = P.inv[P.cur], v = P.car;
  if (v) { const arm = ['car', 'moto', 'boat'].includes(v.kind) && !w.melee; $('wname').textContent = (G.vehLabel || '') + (arm ? ' · ' + w.name : ''); $('ammo').textContent = Math.round(Math.abs(v.sp) * 3.6) + ' km/h' + (v.kind === 'heli' || v.kind === 'plane' ? ' · alt ' + Math.round(v.y) : '') + (arm ? ' · ' + inv.mag + '/' + inv.res : ''); }
  else { $('wname').textContent = w.name; $('ammo').textContent = w.melee ? '' : (P.reload > 0 ? 'recharge…' : inv.mag + ' / ' + inv.res); }
  const s = stars(), el = $('stars'); el.textContent = '★'.repeat(s) + '☆'.repeat(5 - s); el.classList.toggle('hot', s > 0 && G.crimeT < 3);
  $('diff').textContent = 'Difficulté auto : ' + Math.round(G.effDiff * 100) + '%'; $('clock').textContent = clockString();
  const ms = $('mission'); if (info && info.text) { ms.style.display = 'block'; $('mtitle').textContent = info.title || ''; $('mtext').textContent = info.text; $('mdist').textContent = info.dist != null ? Math.round(info.dist) + ' m' + (info.time ? ' · ' + Math.ceil(info.time) + ' s' : '') : (info.time ? Math.ceil(info.time) + ' s' : ''); } else ms.style.display = 'none';
  const bb = $('bossbar'); if (info && info.boss) { bb.style.display = 'block'; $('bossname').textContent = info.boss.name; $('bosshp').style.width = clamp(info.boss.hp / info.boss.max * 100, 0, 100) + '%'; } else bb.style.display = 'none';
  $('hurt').style.opacity = G.hurtT > 0 || P.hp < 30 ? Math.max(G.hurtT * 3, P.hp < 30 ? .5 : 0) : 0;
  const armed = !w.melee && (!v || ['car', 'moto', 'boat'].includes(v.kind)); $('cross').style.display = armed && !G.cine ? 'block' : 'none'; if (armed) { const e = $('cross'); e.style.transform = 'translate(-50%,-50%) scale(' + (1 + (P.bloom || 0) * 1.6 + (v ? .8 : 0)) * (1 - (P.aimK || 0) * .35) + ')'; let hot = false; const ca = G.camYaw; for (const h of G.humans) { if (h.dead > 0 || h.client || h.ally) continue; const dx = h.x - P.x, dz = h.z - P.z, d = Math.hypot(dx, dz); if (d < w.range && d > 1 && Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - ca), Math.cos(Math.atan2(dx, dz) - ca))) < .06 && (h.kind === 'gang' || (h.kind === 'cop' && G.wanted > 0))) { hot = true; break; } } e.style.color = hot ? '#ff4d4d' : '#fff'; }
  const z = G.interior ? G.interior.def.name.toUpperCase() : zoneName(P.x, P.z); if (z !== lastZone) { lastZone = z; const e = $('zone'); e.textContent = z; e.classList.add('on'); clearTimeout(updateHUD.zt); updateHUD.zt = setTimeout(() => e.classList.remove('on'), 2400); }
  // libellés des boutons tactiles selon le véhicule
  const k = v ? v.kind : 'foot'; if (updateHUD.k !== k) { updateHUD.k = k; $('bsprint').textContent = k === 'heli' || k === 'plane' ? 'MONTER' : k === 'foot' ? 'COURIR' : 'FREIN'; $('breload').textContent = k === 'heli' || k === 'plane' ? 'DESC.' : 'R'; }
}
export function hideHUD(on) { for (const id of ['hud', 'rightcol', 'mission', 'cross', 'touch', 'stars']) { const e = $(id); if (e) e.style.visibility = on ? 'hidden' : 'visible'; } }

/* ---------- menu de départ ---------- */
export let selectedHero = HEROES[0];
export function buildHeroSelect(storyMode) {
  const box = $('heroes'); box.innerHTML = '';
  HEROES.forEach(h => {
    const d = document.createElement('div'); d.className = 'hero' + (h === selectedHero ? ' sel' : '') + (storyMode && h.noStory ? ' lock' : ''); d.innerHTML = `<img src="${h.svg}" alt="${h.name}"><b>${h.name}</b><small>${h.desc}</small>`;
    d.onclick = () => { if (storyMode && h.noStory) return; selectedHero = h; box.querySelectorAll('.hero').forEach(x => x.classList.remove('sel')); d.classList.add('sel'); }; box.appendChild(d);
  });
}
export function setStoryHeroMode(on) { if (on && selectedHero.noStory) selectedHero = HEROES[0]; buildHeroSelect(on); }
