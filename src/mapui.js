/* mapui.js — grande carte interactive : clic sur la minimap, déplacement, zoom, infos des lieux, GPS */
import { THREE, G, scene, $, clamp, WORLD, ZMAX } from './core.js';
import { drawMap, staticMarkers } from './ui.js';
import { zoneName } from './world.js';
import { feed } from './core.js';

const big = $('bmc'), bctx = big.getContext('2d'), info = $('bmInfo'), gpsEl = $('gps');
const MV = { cx: WORLD / 2, cz: 330, span: 1100 }; let S = 420, sel = null, lastMk = [];
function size() { const s = Math.floor(clamp(Math.min(innerWidth - 24, innerHeight - 150, 760), 280, 760)), d = Math.min(devicePixelRatio || 1, 2); S = s; big.style.width = s + 'px'; big.style.height = s + 'px'; big.width = Math.round(s * d); big.height = Math.round(s * d); bctx.setTransform(d, 0, 0, d, 0, 0); }
export const mapOpen = () => $('bigmap').classList.contains('on');
export function openMap(at) {
  size(); $('bigmap').classList.add('on'); G.mapOpen = true; G.uiGrace = .7; try { document.exitPointerLock(); } catch (e) { /* ok */ }
  if (at) { MV.cx = at.x; MV.cz = at.z; MV.span = 260; } else if (G.P) { MV.cx = G.P.x; MV.cz = G.P.z; MV.span = 520; }
  sel = null; showInfo();
}
export function closeMap() { $('bigmap').classList.remove('on'); G.mapOpen = false; }
export const toggleMap = () => mapOpen() ? closeMap() : openMap();
addEventListener('resize', () => { if (mapOpen()) size(); });

/* conversions */
const sc = () => S / MV.span, toW = (px, py) => ({ x: MV.cx + (px - S / 2) / sc(), z: MV.cz + (py - S / 2) / sc() });
function zoomAt(px, py, k) { const a = toW(px, py); MV.span = clamp(MV.span / k, 90, 1500); const b = toW(px, py); MV.cx += a.x - b.x; MV.cz += a.z - b.z; }

/* gestes */
const pts = new Map(); let moved = 0, pinch = 0;
const local = e => { const r = big.getBoundingClientRect(); return { x: (e.clientX - r.left) * S / r.width, y: (e.clientY - r.top) * S / r.height }; };
big.addEventListener('pointerdown', e => { e.stopPropagation(); big.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
big.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return; const p = local(e), o = pts.get(e.pointerId);
  if (pts.size === 2) { pts.set(e.pointerId, p); const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch); pinch = d; moved += 10; return; }
  const dx = p.x - o.x, dz = p.y - o.y; moved += Math.abs(dx) + Math.abs(dz); MV.cx -= dx / sc(); MV.cz -= dz / sc(); pts.set(e.pointerId, p);
});
const up = e => { const was = pts.size; const p = pts.get(e.pointerId); pts.delete(e.pointerId); if (was === 1 && p && moved < 7) click(p.x, p.y); if (pts.size < 2) pinch = 0; };
big.addEventListener('pointerup', up); big.addEventListener('pointercancel', e => { pts.delete(e.pointerId); });
big.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.25 : .8); }, { passive: false });
$('bmIn').onclick = () => { MV.span = clamp(MV.span / 1.4, 90, 1500); }; $('bmOut').onclick = () => { MV.span = clamp(MV.span * 1.4, 90, 1500); };
$('bmMe').onclick = () => { if (G.P) { MV.cx = G.P.x; MV.cz = G.P.z; } }; $('bmClose').onclick = () => closeMap();
$('map').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (G.running && !G.cine) toggleMap(); });
$('bigmap').addEventListener('pointerdown', e => e.stopPropagation());

/* sélection d'un lieu ou d'un point libre */
function click(px, py) {
  const w = toW(px, py), s = sc(); let best = null, bd = 16 / s;
  for (const m of lastMk) { if (m.x == null || !(m.label || m.shop)) continue; const d = Math.hypot(m.x - w.x, m.z - w.z); if (d < bd) { bd = d; best = m; } }
  sel = best ? { x: best.x, z: best.z, name: best.label || 'Lieu', shop: best.shop, kind: best.shop ? 'Boutique' : 'Lieu d\'intérêt' } : { x: clamp(w.x, 0, WORLD), z: clamp(w.z, -300, ZMAX), name: 'Point sur la carte', kind: zoneName(w.x, w.z) };
  showInfo();
}
function showInfo() {
  info.innerHTML = '';
  if (!sel) { info.innerHTML = '<b>Carte d\'Abidjan</b><small>Touche un lieu ou la carte pour poser un repère · glisse pour te déplacer · molette / pincement pour zoomer.</small>'; return; }
  const P = G.P, d = P ? Math.round(Math.hypot(sel.x - P.x, sel.z - P.z)) : 0;
  const b = document.createElement('b'); b.textContent = sel.name; info.appendChild(b);
  const sm = document.createElement('small'); sm.textContent = sel.kind + ' · ' + zoneName(sel.x, sel.z) + ' · ' + (d > 999 ? (d / 1000).toFixed(1) + ' km' : d + ' m') + (sel.shop ? ' · ' + ({ arms: 'armes & protections', clothes: 'vêtements', pharma: 'soins', resto: 'repas', super: 'courses & munitions', dealer: 'véhicules', bank: 'dépôt / retrait', police: 'police & caution', barber: 'coiffure', garage: 'réparation & peinture', home: 'repos & sauvegarde' }[sel.shop.type] || '') : ''); info.appendChild(sm);
  const g = document.createElement('button'); g.textContent = '📍 Définir le GPS'; g.onclick = () => { setGps(sel.x, sel.z, sel.name); showInfo(); }; info.appendChild(g);
  if (G.gps) { const c = document.createElement('button'); c.className = 'alt'; c.textContent = 'Retirer le GPS'; c.onclick = () => { clearGps(); showInfo(); }; info.appendChild(c); }
}

/* GPS */
let beam = null;
export function setGps(x, z, name) {
  G.gps = { x, z, name }; if (!beam) { beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 90, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false })); scene.add(beam); }
  beam.position.set(x, 45, z); beam.visible = true; feed('GPS : ' + name, '#38bdf8');
}
export function clearGps() { G.gps = null; if (beam) beam.visible = false; gpsEl.classList.remove('on'); }
export const gpsMarker = () => G.gps ? [{ x: G.gps.x, z: G.gps.z, c: '#38bdf8', r: 4, edge: true, label: G.gps.name }] : [];
export function updGps() {
  if (!G.gps || !G.P) return; const d = Math.hypot(G.gps.x - G.P.x, G.gps.z - G.P.z);
  if (d < 12 && !G.interior) { feed('Destination atteinte : ' + G.gps.name, '#38bdf8'); clearGps(); return; }
  gpsEl.textContent = '📍 ' + G.gps.name + ' · ' + (d > 999 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'); gpsEl.classList.add('on');
}

/* dessin (appelé chaque image quand la carte est ouverte) */
export function drawBig(markers) {
  lastMk = staticMarkers().concat(markers);
  const mk = lastMk.map(m => ({ ...m, r: Math.max(m.r || 0, 3) }));
  if (sel) mk.push({ x: sel.x, z: sel.z, c: '#ffffff', r: 5 });
  drawMap(bctx, S, MV.cx, MV.cz, MV.span, mk, true);
}
