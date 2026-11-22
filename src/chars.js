/* chars.js — personnages 3D construits à partir de tes SVG (hero, rival, passant, passante) + animations */
import { THREE, pb, M, capsule, sphere, blob, shadowAll, C, PI, clamp, lerp, rand, pick, irand, adiff } from './core.js';
import { makeGLBHuman, animGLB, humanGLBReady, makeMaleHuman, maleReady } from './models.js';

/* ---------- textures ---------- */
let _face = null, _pagne = null;
function faceTex() {
  if (_face) return _face;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const g = cv.getContext('2d');
  g.fillStyle = '#0a0a0a'; g.beginPath(); g.ellipse(38, 44, 8, 6, 0, 0, 7); g.ellipse(90, 44, 8, 6, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(35, 42, 2.4, 0, 7); g.arc(87, 42, 2.4, 0, 7); g.fill();
  g.strokeStyle = '#0a0a0a'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(26, 28); g.lineTo(50, 26); g.moveTo(78, 26); g.lineTo(102, 28); g.stroke();
  g.strokeStyle = '#3a1a10'; g.lineWidth = 4; g.beginPath(); g.moveTo(50, 76); g.quadraticCurveTo(64, 82, 78, 76); g.stroke();
  g.fillStyle = 'rgba(60,25,10,.35)'; g.beginPath(); g.ellipse(64, 60, 7, 5, 0, 0, 7); g.fill();
  _face = new THREE.CanvasTexture(cv); _face.colorSpace = THREE.SRGBColorSpace; return _face;
}
function pagneTex() {
  if (_pagne) return _pagne;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const cols = ['#1fa34d', '#ffb400', '#d4380d', '#1fa34d']; for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect(i * 32, 0, 32, 128); }
  g.fillStyle = 'rgba(255,255,255,.75)'; for (let y = 8; y < 128; y += 22) for (let x = 8; x < 128; x += 24) { g.beginPath(); g.arc(x + ((y / 22) % 2 ? 12 : 0), y, 3.6, 0, 7); g.fill(); }
  _pagne = new THREE.CanvasTexture(cv); _pagne.wrapS = _pagne.wrapT = THREE.RepeatWrapping; _pagne.colorSpace = THREE.SRGBColorSpace; return _pagne;
}
const faceMat = () => faceMatC || (faceMatC = new THREE.MeshBasicMaterial({ map: faceTex(), transparent: true, alphaTest: .4, depthWrite: false })); let faceMatC = null;
const pagneMat = () => pagneM || (pagneM = new THREE.MeshLambertMaterial({ map: pagneTex() })); let pagneM = null;
const FACE_GEO = new THREE.PlaneGeometry(.23, .17);

/* ---------- fiches (look) ---------- */
export const LOOKS = {
  hero: { male: true, look: 'hero', skin: '#8a5a3b', shirt: '#ff9a2e', pants: '#2c3e50', hair: '#0b0b0b', hat: 'none', cuffs: '#ffffff', sash: '#1a8a3c', sleeveSkin: true },
  rival: { male: true, look: 'rival', skin: '#6b4429', shirt: '#3b3f4a', pants: '#1c1f26', hair: '#0b0b0b', hat: 'cap', hatCol: '#e23a3a', stripe: '#e23a3a', rings: '#d4af37', chain: true },
  passant: { male: true, look: 'passant', skin: '#a87850', shirt: '#4aa3e0', pants: '#2b3a55', hair: '#111111', hat: 'none' },
  passante: { look: 'passante', skin: '#9c6140', shirt: '#ffffff', pants: '#d4380d', hair: '#111111', hat: 'wrap', hatCol: '#ffd23a', pagne: true, sleeveSkin: true }
};
export const HEROES = [
  { id: 'koffi', name: 'Koffi', svg: 'hero.svg', desc: 'Équilibré', speed: 1, hp: 100, dmg: 1, acc: 1, spec: LOOKS.hero },
  { id: 'awa', name: 'Awa', svg: 'passante.svg', desc: 'Rapide et agile', speed: 1.12, hp: 90, dmg: 1, acc: 1.1, spec: LOOKS.passante },
  { id: 'yao', name: 'Yao', svg: 'passant.svg', desc: 'Tireur précis', speed: 1.03, hp: 95, dmg: 1.05, acc: 1.45, spec: LOOKS.passant },
  { id: 'winter', name: 'Sgt Winter', svg: 'winter.png', desc: 'Soldat · anim. 3D réelle', speed: 1.05, hp: 115, dmg: 1.15, acc: 1.2, spec: { glb: 'winter', height: 1.8, look: 'rival', shirt: '#999', pants: '#999' } },
  { id: 'rouge', name: 'Le Rouge', svg: 'rival.svg', desc: 'Costaud (hors histoire)', speed: .96, hp: 130, dmg: 1.25, acc: .95, spec: LOOKS.rival, noStory: true }
];
const SKINS = ['#5a3825', '#6b4429', '#7a4a2e', '#8a5a3b', '#9c6b47', '#a87850'];
export function civSpec() {
  const skin = pick(SKINS), r = irand(0, 7);
  switch (r) {
    case 0: return { male: true, look: 'passant', skin, shirt: pick(['#4aa3e0', '#e11d48', '#f59e0b', '#10b981']), pants: '#2b3a55', hair: '#0b0b0b', hat: 'none' };
    case 1: return { ...LOOKS.passante, skin };
    case 2: return { male: true, look: 'civ', skin, shirt: '#f1f5f9', pants: '#1f2937', hair: '#0b0b0b', hat: 'none', tie: '#b91c1c' };
    case 3: return { male: true, look: 'worker', skin, shirt: '#94a3b8', pants: '#334155', vest: '#ff7a00', hat: 'helmet', hatCol: '#f5c518' };
    case 4: return { look: 'boubou', skin, shirt: pick(['#e7e0cf', '#2c5aa0', '#8b5a2b']), pants: '#e7e0cf', long: true, hat: 'kufi', hatCol: '#f5f5f5' };
    case 5: return { ...LOOKS.passante, skin, hatCol: pick(['#facc15', '#c026d3', '#38bdf8']), pants: '#c026d3', shirt: '#ffffff' };
    case 6: return { male: true, look: 'civ', skin, shirt: pick(['#2f3640', '#374151', '#7c3aed']), pants: '#111827', hair: '#0b0b0b', hat: 'cap', hatCol: '#111827' };
    default: return { male: true, look: 'student', skin, shirt: pick(['#2563eb', '#16a34a']), pants: '#1e293b', hair: '#0b0b0b', hat: 'none' };
  }
}
export const GANGS = {
  corbeaux: { name: 'Les Corbeaux', shirt: '#16161a', pants: '#2a2a30', hat: 'bandana', hatCol: '#c1121f', stripe: '#c1121f' },
  lions: { name: 'Les Lions Rouges', shirt: '#3b3f4a', pants: '#1c1f26', hat: 'cap', hatCol: '#e23a3a', stripe: '#e23a3a' },
  port: { name: 'Les Dockers', shirt: '#1d4ed8', pants: '#1e3a8a', hat: 'cap', hatCol: '#fbbf24', stripe: '#fbbf24' },
  army: { name: 'Soldats', shirt: '#5f7243', pants: '#4a5a32', hat: 'helmet', hatCol: '#3f4d2c', vest: '#3f4d2c' },
  ebene: { name: 'Sécurité Ébène', shirt: '#111827', pants: '#111827', hat: 'none', hair: '#0b0b0b', tie: '#d4af37', vest: '#1f2937' }
};
export function gangSpec(g, role) { const G_ = GANGS[g]; if (g === 'army') return { glb: 'winter', tint: '#6f8a4a', height: role === 'chef' ? 1.9 : 1.78, scale: 1, skin: '#8a5a3b', ...(role === 'chef' ? {} : {}), look: 'rival', shirt: G_.shirt, pants: G_.pants, hat: G_.hat, hatCol: G_.hatCol, vest: G_.vest }; return { male: true, look: 'rival', skin: pick(SKINS), shirt: G_.shirt, pants: G_.pants, hat: G_.hat, hatCol: G_.hatCol, stripe: G_.stripe, vest: G_.vest, tie: G_.tie, hair: G_.hair || '#0b0b0b', rings: role === 'chef' ? '#d4af37' : null, chain: role === 'chef', scale: role === 'chef' ? 1.1 : role === 'bruiser' ? 1.06 : 1 }; }
export const COP_SPEC = { male: true, look: 'cop', skin: '#6b4429', shirt: '#1e3a8a', pants: '#0f172a', hat: 'police', hatCol: '#0f172a', badge: true };
export const SWAT_SPEC = { glb: 'winter', tint: '#3a4352', height: 1.85, look: 'swat', skin: '#6b4429', shirt: '#111827', pants: '#111827', vest: '#1f2937', hat: 'helmet', hatCol: '#0b0f19', scale: 1.05 };
export const SPECS = { rival: LOOKS.rival, hero: LOOKS.hero, passant: LOOKS.passant, passante: LOOKS.passante };

/* ---------- construction du personnage ---------- */
export function makeHuman(s) {
  if (s.glb && humanGLBReady()) return makeGLBHuman(s);
  if (s.male && maleReady()) return makeMaleHuman(s);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = M(s.skin || '#8a5a3b'), shirt = M(s.shirt || '#555'), pants = M(s.pants || '#222'), shoe = M('#15161a');
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-.13, .96, 0); legR.position.set(.13, .96, 0);
  for (const l of [legL, legR]) { const m = new THREE.Mesh(capsule(.1, .62), s.long ? M(s.shirt) : pants); m.position.y = -.46; l.add(m); pb(l, .2, .1, .34, shoe, 0, -.9, .07); body.add(l); }
  // torse
  const torsoMat = s.pagne ? pagneMat() : shirt;
  const torso = new THREE.Mesh(capsule(.2, .3), torsoMat); torso.position.y = 1.3; torso.scale.set(1.22, 1, .82); body.add(torso);
  if (s.skirt || s.pagne) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(.26, .31, .78, 10, 1, true), pagneMat()); sk.position.y = .78; sk.material.side = THREE.DoubleSide; body.add(sk); }
  if (s.long) { const rb = new THREE.Mesh(new THREE.CylinderGeometry(.27, .34, .95, 10), shirt); rb.position.set(0, .76, 0); body.add(rb); }
  if (s.vest) pb(body, .56, .5, .36, M(s.vest), 0, 1.3, 0);
  if (s.sash) { const sh = pb(body, .07, .8, .03, M(s.sash), 0, 1.3, .17); sh.rotation.z = .55; }
  if (s.tie) pb(body, .06, .34, .02, M(s.tie), 0, 1.38, .17);
  if (s.badge) pb(body, .07, .07, .02, M('#facc15'), .11, 1.45, .17);
  if (s.chain) { const ch = new THREE.Mesh(new THREE.TorusGeometry(.12, .014, 5, 12), M('#d4af37')); ch.rotation.x = PI / 2; ch.position.set(0, 1.62, .02); body.add(ch); }
  // bras
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-.34, 1.55, 0); armR.position.set(.34, 1.55, 0);
  for (const [a, side] of [[armL, -1], [armR, 1]]) {
    const am = new THREE.Mesh(capsule(.075, .42), s.sleeveSkin ? skin : shirt); am.position.y = -.3; a.add(am);
    if (s.sleeveSkin) { const sl = new THREE.Mesh(capsule(.085, .12), shirt); sl.position.y = -.13; a.add(sl); }
    if (s.cuffs) pb(a, .17, .07, .17, M(s.cuffs), 0, -.5, 0);
    if (s.stripe) pb(a, .02, .4, .05, M(s.stripe), side * .075, -.3, 0);
    const hd = new THREE.Mesh(sphere(.078), skin); hd.position.y = -.62; a.add(hd);
    if (s.rings) { const rg = new THREE.Mesh(new THREE.TorusGeometry(.06, .016, 5, 10), M(s.rings)); rg.position.y = -.6; rg.rotation.x = PI / 2; a.add(rg); }
    body.add(a);
  }
  // tête
  const head = new THREE.Mesh(sphere(.17, 12, 10), skin); head.position.y = 1.83; head.scale.set(1, 1.1, 1); body.add(head);
  pb(body, .09, .1, .09, skin, 0, 1.68, 0);
  const face = new THREE.Mesh(FACE_GEO, faceMat()); face.position.set(0, 1.84, .157); body.add(face);
  const hc = s.hatCol || s.hair || '#111111', hairM = M(s.hair || '#0b0b0b'), hatM = M(hc);
  const hair = () => { const h = new THREE.Mesh(sphere(.18, 10, 8), hairM); h.position.set(0, 1.9, -.012); h.scale.set(1, .68, 1.02); body.add(h); };
  switch (s.hat) {
    case 'cap': hair(); { const c = new THREE.Mesh(sphere(.19, 10, 8), hatM); c.position.set(0, 1.93, -.005); c.scale.set(1, .55, 1.03); body.add(c); pb(body, .2, .025, .16, hatM, 0, 1.9, .2); } break;
    case 'police': { const c = new THREE.Mesh(sphere(.19, 10, 8), hatM); c.position.set(0, 1.94, -.005); c.scale.set(1, .5, 1.03); body.add(c); pb(body, .21, .03, .16, M('#020617'), 0, 1.89, .2); pb(body, .04, .04, .02, M('#facc15'), 0, 1.96, .19); } break;
    case 'wrap': { const w = new THREE.Mesh(sphere(.2, 10, 8), hatM); w.position.set(0, 1.96, -.01); w.scale.set(1.12, .72, 1.12); body.add(w); const k = new THREE.Mesh(sphere(.085, 8, 6), hatM); k.position.set(0, 2.08, -.06); body.add(k); pb(body, .12, .1, .08, hatM, .17, 1.98, -.02).rotation.z = -.5; } break;
    case 'kufi': { const k = new THREE.Mesh(sphere(.175, 10, 8), hatM); k.position.set(0, 1.94, -.005); k.scale.set(1, .5, 1); body.add(k); } break;
    case 'helmet': { const h = new THREE.Mesh(sphere(.2, 10, 8), hatM); h.position.set(0, 1.93, -.01); h.scale.set(1.04, .7, 1.1); body.add(h); } break;
    case 'bandana': hair(); pb(body, .36, .07, .36, hatM, 0, 1.97, -.01); pb(body, .1, .12, .05, hatM, 0, 1.92, -.19).rotation.x = .3; break;
    default: hair();
  }
  const sh = blob(root, .5, .5); if (s.scale) root.scale.setScalar(s.scale);
  shadowAll(root, true, false);
  return { root, body, legL, legR, armL, armR, head, sh, wp: null };
}

/* ---------- armes tenues ---------- */
export function wmodel(w) {
  const g = new THREE.Group(), dk = M('#1f2328'), gr = M('#444a52'), wd = M('#7a4f2a'), ol = M('#4b5320');
  if (w === 'pistol') { pb(g, .07, .1, .3, dk, 0, .04, .14); pb(g, .06, .17, .08, gr, 0, -.07, .02); }
  else if (w === 'smg') { pb(g, .09, .13, .5, dk, 0, .04, .22); pb(g, .06, .22, .08, gr, 0, -.12, .14); pb(g, .06, .14, .08, gr, 0, -.08, 0); }
  else if (w === 'shotgun') { pb(g, .07, .08, .95, gr, 0, .05, .4); pb(g, .09, .13, .38, wd, 0, 0, -.05); }
  else if (w === 'bat') { pb(g, .09, .09, .95, wd, 0, 0, .35); }
  else if (w === 'rpg') { pb(g, .12, .12, 1.1, ol, 0, .05, .3); pb(g, .2, .2, .3, ol, 0, .05, .95); pb(g, .06, .2, .08, dk, 0, -.1, .1); }
  return g;
}
export function setHeld(h, w) {
  const m = h.model; if (m.wp) { m.armR.remove(m.wp); m.wp = null; }
  h.weapon = w; if (w === 'fists') return;
  const g = wmodel(w); g.position.set(0, m.glb ? -.05 : -.6, m.glb ? .1 : .02); g.rotation.x = PI / 2; m.armR.add(g); m.wp = g; g.traverse(o => { if (o.isMesh) o.castShadow = true; });
}

/* ---------- animation ---------- */
export function animHuman(h, dt, spd) {
  const m = h.model; if (!m) return;
  if (m.glb) return animGLB(h, dt, spd);
  if (h.dead) {
    const k = clamp(dt * 8, 0, 1); h.fallDir = h.fallDir ?? (Math.random() < .5 ? 1 : -1);
    m.root.rotation.x = lerp(m.root.rotation.x, -PI / 2 + .06, k); m.root.rotation.z = lerp(m.root.rotation.z, .25 * h.fallDir, k);
    m.root.position.y = lerp(m.root.position.y, .2, k); m.sh.visible = false; m.legL.rotation.x = lerp(m.legL.rotation.x, .2, k); m.legR.rotation.x = lerp(m.legR.rotation.x, -.1, k);
    m.armL.rotation.x = lerp(m.armL.rotation.x, -.5, k); m.armR.rotation.x = lerp(m.armR.rotation.x, -.2, k); return;
  }
  h.bt = (h.bt || 0) + dt; h.wt = (h.wt || 0) + dt * spd * 1.75;
  const k = Math.min(1, spd / 3.6), s = Math.sin(h.wt) * k * .95, run = clamp((spd - 4.5) / 3, 0, 1);
  m.legL.rotation.x = s; m.legR.rotation.x = -s;
  m.body.position.y = Math.abs(Math.cos(h.wt)) * .055 * k + Math.sin(h.bt * 2) * .008;
  m.body.rotation.x = .05 * k + run * .16; m.body.rotation.z = Math.sin(h.wt) * .03 * k; m.body.rotation.y = 0;
  m.head.rotation.y = Math.sin(h.bt * .7) * .12 * (1 - k);
  let al = -s * .85, ar = s * .85;
  if (run > 0) { al = -s * 1.1 - .4 * run; ar = s * 1.1 - .4 * run; }
  m.armL.rotation.z = 0; m.armR.rotation.z = 0; m.armL.rotation.y = 0;
  if (h.pose === 'talk') { al = -.6 + Math.sin(h.bt * 3) * .5; ar = -.8 + Math.sin(h.bt * 2.4 + 1) * .6; }
  else if (h.pose === 'phone') { ar = -2.3; m.armR.rotation.z = -.25; al = -.1; }
  else if (h.pose === 'handsup') { al = -3; ar = -3; }
  else if (h.pose === 'point') { ar = -1.5; }
  if (h.aim > 0) {
    h.aim -= dt; const rl = h.reloadT > 0; ar = -1.5; al = rl ? -.8 + Math.sin(h.bt * 14) * .25 : -1.15; m.armL.rotation.y = rl ? 0 : .5; m.body.rotation.y = -.15;
  }
  if (h.swing > 0) { h.swing -= dt; const p = 1 - h.swing / .28; ar = h.weapon === 'fists' ? lerp(-1.1, -1.6, Math.sin(p * PI)) : lerp(-2.7, .5, p); if (h.weapon === 'fists') { al = -.5; m.body.rotation.y = lerp(.3, -.3, p); } else m.body.rotation.y = lerp(.25, -.3, p); }
  if (h.lean > 0) { h.lean -= dt; m.body.rotation.x = -.4 * (h.lean / .2); ar += -.5 * (h.lean / .2); }
  if (h.reloadT > 0) h.reloadT -= dt;
  m.armL.rotation.x = al; m.armR.rotation.x = ar;
  m.root.rotation.x = 0; m.root.rotation.z = 0; m.root.position.y = 0;
}

/* ---------- personnages de l'histoire ---------- */
export const NPC = {
  adjoua: { ...LOOKS.passante, shirt: '#7c3aed', pants: '#be185d', hatCol: '#f59e0b', skin: '#7a4a2e', name: 'Maman Adjoua' },
  zeze: { male: true, look: 'worker', skin: '#6b4429', shirt: '#2563eb', pants: '#1e293b', hat: 'cap', hatCol: '#f59e0b', hair: '#0b0b0b', name: 'Tonton Zézé' },
  rouge: { ...LOOKS.rival, scale: 1.08, name: 'Le Rouge' },
  sylla: { ...COP_SPEC, shirt: '#1e293b', hatCol: '#1e293b', skin: '#7a4a2e', name: 'Capitaine Sylla' },
  diomande: { ...COP_SPEC, shirt: '#0f172a', hatCol: '#7f1d1d', scale: 1.08, name: 'Commissaire Diomandé' },
  kra: { ...LOOKS.passante, hatCol: '#c026d3', pants: '#0e7490', skin: '#6b4429', scale: 1.03, name: 'Madame Kra' },
  directeur: { male: true, look: 'civ', skin: '#8a5a3b', shirt: '#f8fafc', pants: '#111827', hair: '#d1d5db', hat: 'none', tie: '#d4af37', scale: 1.05, name: 'Le Directeur' },
  traore: { male: true, look: 'rival', skin: '#6b4429', shirt: '#5f7243', pants: '#4a5a32', hat: 'cap', hatCol: '#3f4d2c', vest: '#3f4d2c', name: 'Lieutenant Traoré' },
  fanta: { ...LOOKS.passante, hat: 'cap', hatCol: '#111827', shirt: '#e5e7eb', pants: '#1e3a8a', pagne: false, name: 'Fanta' },
  bako: { look: 'boubou', skin: '#5a3825', shirt: '#2c5aa0', pants: '#e7e0cf', hat: 'cap', hatCol: '#f5f5f5', name: 'Bako' },
  gros: { ...gangSpec('corbeaux', 'chef'), scale: 1.2, name: 'Gros Bras' },
  client: { ...LOOKS.passant, shirt: '#f8fafc', pants: '#111827', tie: '#b91c1c', hat: 'none' }
};
