/* models.js — modèles GLB (voitures, avions, soldat animé) intégrés dans assets.js (base64) pour fonctionner hors-ligne / file:// */
import { THREE, G, blob, clamp, lerp, PI } from './core.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const MODELS = {}; export const ANIMS = {};
const b2buf = b64 => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
export function loadModels() {
  const src = window.__GLB || {}, L = new GLTFLoader();
  return Promise.all(Object.keys(src).map(n => new Promise(res => { try { L.parse(b2buf(src[n]), '', g => { MODELS[n] = g.scene; ANIMS[n] = g.animations; res(); }, () => res()); } catch (e) { res(); } })));
}
/* réglages : len = longueur cible (m) sur l'axe le plus long horizontal, yaw = rotation pour que l'avant soit +z */
const VCFG = { taxi: { m: 'taxi', len: 4.5 }, police: { m: 'police', len: 4.6 }, sport: { m: 'sport', len: 4.7 }, avion: { m: 'prop', len: 7.6, yaw: PI, prop: true }, jet: { m: 'jet', len: 34 } };
export const hasGLB = t => !!(VCFG[t] && MODELS[VCFG[t].m]);
export function vehicleGLB(type) {
  const c = VCFG[type]; if (!c || !MODELS[c.m]) return null;
  const obj = MODELS[c.m].clone(true), pivotRoot = new THREE.Group(), yawG = new THREE.Group(); yawG.add(obj); pivotRoot.add(yawG); yawG.rotation.y = c.yaw || 0; pivotRoot.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(pivotRoot), sz = b.getSize(new THREE.Vector3()), s = c.len / Math.max(sz.x, sz.z); obj.scale.multiplyScalar(s); pivotRoot.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(pivotRoot); const ct = b.getCenter(new THREE.Vector3()); obj.position.set(obj.position.x - ct.x, obj.position.y - b.min.y, obj.position.z - ct.z); pivotRoot.updateMatrixWorld(true);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = true; if (o.material) o.material.envMapIntensity = .4; } });
  let prop = null;
  if (c.prop) { // hélice : on regroupe pales + cône autour de son centre
    const parts = []; obj.traverse(o => { if (/Prop_(Spinner|Blade)/.test(o.name)) parts.push(o); });
    if (parts.length) { const bb = new THREE.Box3(); parts.forEach(p => bb.expandByObject(p)); const cen = bb.getCenter(new THREE.Vector3()); prop = new THREE.Group(); pivotRoot.add(prop); prop.position.copy(cen); prop.updateMatrixWorld(true); parts.forEach(p => prop.attach(p)); }
  }
  return { root: pivotRoot, prop };
}

/* ---------- humain animé (soldat) ---------- */
const hasHuman = () => !!MODELS.winter;
export const humanGLBReady = hasHuman;
export function makeGLBHuman(s) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const obj = skClone(MODELS.winter), pivot = new THREE.Group(); pivot.add(obj); body.add(pivot);
  obj.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(obj); const h = bb.max.y - bb.min.y || 1.7; const sc = (s.height || 1.78) / h; obj.scale.multiplyScalar(sc); obj.position.y -= bb.min.y * sc;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (s.tint) { o.material = o.material.clone(); o.material.color.set(s.tint); } } });
  const mixer = new THREE.AnimationMixer(obj), clips = ANIMS.winter || [], act = {};
  for (const c of clips) { const a = mixer.clipAction(c); a.play(); a.enabled = true; a.setEffectiveWeight(0); act[c.name.toLowerCase()] = a; }
  const walk = act.walking, run = act.running; if (walk) walk.setEffectiveWeight(1);
  let hand = null; obj.traverse(o => { if (o.name === 'RightHand') hand = o; });
  const armR = new THREE.Group(); armR.rotation.x = -1.5; root.add(armR); const dummy = () => new THREE.Group();
  const sh = blob(root, .55, .55); if (s.scale) root.scale.setScalar(s.scale);
  return { root, body, legL: dummy(), legR: dummy(), armL: dummy(), armR, head: dummy(), sh, wp: null, glb: { mixer, walk, run, hand, obj, t: 0, w: 0 } };
}
const _v = new THREE.Vector3();
/* met à jour l'animation squelettique selon la vitesse au sol (m/s) ; renvoie true si géré */
export function animGLB(h, dt, spd) {
  const m = h.model, g = m.glb;
  if (h.dead) { // chute : on fige l'anim et on couche le corps
    const k = clamp(dt * 8, 0, 1); h.fallDir = h.fallDir ?? (Math.random() < .5 ? 1 : -1); g.walk && g.walk.setEffectiveWeight(0); g.run && g.run.setEffectiveWeight(0);
    m.root.rotation.x = lerp(m.root.rotation.x, -PI / 2 + .06, k); m.root.rotation.z = lerp(m.root.rotation.z, .25 * h.fallDir, k); m.root.position.y = lerp(m.root.position.y, .2, k); m.sh.visible = false; return;
  }
  const rw = clamp((spd - 3.2) / 2.4, 0, 1), mv = clamp(spd / 1.2, 0, 1);
  if (g.walk) { g.walk.setEffectiveWeight((1 - rw)); g.walk.setEffectiveTimeScale(mv * clamp(spd / 1.6, .6, 1.8)); }
  if (g.run) { g.run.setEffectiveWeight(rw); g.run.setEffectiveTimeScale(clamp(spd / 6, .8, 1.6)); }
  g.mixer.update(dt); if (!mv && g.walk) { g.walk.time = 0; g.mixer.update(0); }
  h.bt = (h.bt || 0) + dt; m.body.position.y = 0; m.body.rotation.set(0, 0, 0);
  // gestes : visée / frappe / parole / mains en l'air (inclinaison du buste, simple mais lisible)
  if (h.aim > 0) { h.aim -= dt; m.body.rotation.y = -.12; }
  if (h.swing > 0) { h.swing -= dt; const p = 1 - h.swing / .28; m.body.rotation.x = Math.sin(p * PI) * .35; }
  if (h.lean > 0) { h.lean -= dt; m.body.rotation.x = -.25 * (h.lean / .2); }
  if (h.pose === 'talk') m.body.rotation.z = Math.sin(h.bt * 3) * .05; else if (h.pose === 'handsup') m.body.rotation.x = -.15;
  if (h.reloadT > 0) h.reloadT -= dt;
  m.root.rotation.x = 0; m.root.rotation.z = 0; m.root.position.y = 0;
  // l'arme suit la main droite
  if (g.hand && m.wp) { g.hand.getWorldPosition(_v); m.root.worldToLocal(_v); m.armR.position.copy(_v); }
}


/* ---------- humain « avatar » (homme réaliste, statique) découpé en pièces articulées : tête, torse, bras, jambes ---------- */
let PARTS = null;
const H = 1.8, HEADY = .865 * H, SHY = .795 * H, SHX = .09 * H, HIPY = .53 * H, HIPX = .075 * H;
function buildParts() {
  const src = MODELS.male; src.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(src), sc = H / (bb.max.y - bb.min.y), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, out = [];
  src.traverse(o => {
    if (!o.isMesh) return; const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index, mw = o.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(mw), v = new THREE.Vector3(), n = new THREE.Vector3();
    const P = new Float32Array(pos.count * 3), N = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mw); P[i * 3] = (v.x - cx) * sc; P[i * 3 + 1] = (v.y - bb.min.y) * sc; P[i * 3 + 2] = (v.z - cz) * sc; if (nor) { n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z; } }
    const nm_ = o.name || '', headOnly = /Head|Eye|Teeth|Eyelash/.test(nm_), groups = {}, n3 = idx ? idx.count : pos.count;
    for (let t = 0; t < n3; t += 3) {
      const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
      const x = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, y = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3; let part;
      if (headOnly || y > HEADY) part = 'head'; else if (Math.abs(x) > SHX + .02 && y > .68 * H) part = x < 0 ? 'armL' : 'armR'; else if (y < HIPY - .04) part = x < 0 ? 'legL' : 'legR'; else part = 'torso';
      (groups[part] = groups[part] || []).push(a, b, c);
    }
    for (const part in groups) {
      const tri = groups[part], px = part === 'armL' ? -SHX : part === 'armR' ? SHX : part === 'legL' ? -HIPX : part === 'legR' ? HIPX : 0, py = part.startsWith('arm') ? SHY : part.startsWith('leg') ? HIPY : part === 'head' ? HEADY : 0;
      const pp = new Float32Array(tri.length * 3), pn = new Float32Array(tri.length * 3), pu = new Float32Array(tri.length * 2);
      tri.forEach((vi, k) => { pp[k * 3] = P[vi * 3] - px; pp[k * 3 + 1] = P[vi * 3 + 1] - py; pp[k * 3 + 2] = P[vi * 3 + 2]; pn[k * 3] = N[vi * 3]; pn[k * 3 + 1] = N[vi * 3 + 1]; pn[k * 3 + 2] = N[vi * 3 + 2]; if (uv) { pu[k * 2] = uv.getX(vi); pu[k * 2 + 1] = uv.getY(vi); } });
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(pp, 3)); ge.setAttribute('normal', new THREE.BufferAttribute(pn, 3)); ge.setAttribute('uv', new THREE.BufferAttribute(pu, 2)); ge.computeBoundingSphere();
      out.push({ part, geo: ge, mat: o.material, name: nm_ });
    }
  });
  return out;
}
export const maleReady = () => !!MODELS.male;
const colOf = (hex, k, lift = 0) => { const c = new THREE.Color(hex); if (lift) c.lerp(new THREE.Color('#ffffff'), lift); return c.multiplyScalar(k); };
export function makeMaleHuman(s) {
  if (!PARTS) PARTS = buildParts();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mk = (px, py) => { const g = new THREE.Group(); g.position.set(px, py, 0); return g; };
  const legL = mk(-HIPX, HIPY), legR = mk(HIPX, HIPY), armL = mk(-SHX, SHY), armR = mk(SHX, SHY), head = mk(0, HEADY);
  const rest = { armL: new THREE.Group(), armR: new THREE.Group() }; rest.armL.rotation.z = 1.38; rest.armR.rotation.z = -1.38; armL.add(rest.armL); armR.add(rest.armR);
  const hold = { torso: body, head, legL, legR, armL: rest.armL, armR: rest.armR }; body.add(legL, legR, armL, armR, head);
  const mats = {}, matFor = (m, name) => {
    if (mats[name]) return mats[name]; const c = m.clone(); c.metalness = 0; c.roughness = name === 'AvatarBody' || name === 'AvatarHead' ? .62 : .9; c.side = THREE.FrontSide; c.normalScale && c.normalScale.set(.6, .6);
    if (name === 'AvatarBody' || name === 'AvatarHead') c.color = colOf(s.skin || '#8a5a3b', 1.0, .1);
    else if (name === 'outfit_top') c.color = colOf(s.shirt || '#4aa3e0', 3.0);
    else if (name === 'outfit_bottom') c.color = colOf(s.pants || '#2b3a55', 3.2);
    else if (name === 'outfit_shoes') c.color = colOf(s.shoes || '#1a1a1e', 2.2);
    return mats[name] = c;
  };
  for (const p of PARTS) { const me = new THREE.Mesh(p.geo, matFor(p.mat, p.name)); me.castShadow = true; me.frustumCulled = false; hold[p.part].add(me); }
  // accessoires simples
  const bx = (w, h, d, col, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col })); m.position.set(x, y, z); (parent || body).add(m); return m; };
  const hcol = s.hatCol || s.hair || '#111';
  if (s.hat === 'cap' || s.hat === 'helmet' || s.hat === 'police' || s.hat === 'kufi') { const c = new THREE.Mesh(new THREE.SphereGeometry(.125, 14, 10, 0, PI * 2, 0, PI * .62), new THREE.MeshLambertMaterial({ color: hcol })); c.position.set(0, .13, -.005); c.scale.set(1, .95, 1.1); head.add(c); if (s.hat !== 'kufi') bx(.2, .02, .13, hcol, 0, .115, .12, head); }
  if (s.vest) bx(.4, .42, .27, s.vest, 0, 1.27, 0);
  if (s.tie) bx(.05, .32, .02, s.tie, 0, 1.32, .13);
  if (s.badge) bx(.06, .06, .02, '#facc15', .1, 1.4, .135);
  if (s.stripe) { bx(.025, .5, .03, s.stripe, SHX * 2.05, 0, 0, rest.armR).position.y = -.3; bx(.025, .5, .03, s.stripe, -SHX * 2.05, 0, 0, rest.armL).position.y = -.3; }
  if (s.chain) { const ch = new THREE.Mesh(new THREE.TorusGeometry(.09, .012, 5, 12), new THREE.MeshLambertMaterial({ color: '#d4af37' })); ch.rotation.x = PI / 2 - .3; ch.position.set(0, 1.52, .05); body.add(ch); }
  if (s.scale) root.scale.setScalar(s.scale);
  const sh = blob(root, .55, .55);
  return { root, body, legL, legR, armL, armR, head, sh, wp: null };
}
