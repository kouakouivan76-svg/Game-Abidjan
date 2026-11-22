/* net.js — client multijoueur (WebSocket). Le serveur relaie ; chaque joueur est maître de sa propre vie. */
import { THREE, G, scene, feed, clamp, lerp, adiff } from './core.js';
import { HEROES, makeHuman, animHuman, setHeld } from './chars.js';
import { hurtP } from './combat.js';
import { spawnVehicle, removeVehicle } from './vehicles.js';
import { tracer } from './fx.js';
import { sfx } from './audio.js';
import { say } from './ui.js';

let ws = null, ready = false, me = 0, sendT = 0, st = null;
const R = new Map();
export const netActive = () => ready;
export const netMarkers = () => [...R.values()].map(r => ({ x: r.x, z: r.z, c: '#34d399', r: 3, label: r.name }));

function tag(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.font = 'bold 28px system-ui'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 4, 256, 40); x.fillStyle = '#7dffb0'; x.fillText(name, 128, 36);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(2.6, .5, 1); s.position.y = 2.5; s.renderOrder = 9; return s;
}
function addRemote(id, name, hero) {
  const H = HEROES[hero] || HEROES[0], model = makeHuman(H.spec); scene.add(model.root); model.root.add(tag(name));
  const r = { id, name, hero, model, x: 0, z: 0, a: 0, tx: 0, tz: 0, ta: 0, hp: 100, maxhp: 100, car: null, veh: null, weapon: 'fists', wt: 0, bt: 0, dead: 0, aim: 0, swing: 0, lean: 0, spd: 0, first: true };
  setHeld(r, 'fists'); R.set(id, r); G.remote.push(r); feed(name + ' a rejoint la partie', '#7dffb0'); return r;
}
function dropRemote(id) { const r = R.get(id); if (!r) return; scene.remove(r.model.root); if (r.veh) removeVehicle(r.veh); R.delete(id); G.remote.splice(G.remote.indexOf(r), 1); feed(r.name + ' est parti', '#fca5a5'); }
const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

export function netJoin(url, room, name) {
  const status = document.getElementById('mStatus');
  try { ws = new WebSocket(url); } catch (e) { feed('Serveur injoignable', '#fca5a5'); return; }
  ws.onopen = () => { ready = true; send({ t: 'join', room, name, hero: Math.max(0, HEROES.indexOf(G.hero)) }); feed('Connecté au salon « ' + room + ' »', '#7dffb0'); };
  ws.onclose = () => { if (ready) feed('Connexion perdue', '#fca5a5'); ready = false; for (const id of [...R.keys()]) dropRemote(id); };
  ws.onerror = () => { feed('Serveur multijoueur injoignable : le jeu continue en solo', '#fca5a5'); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
  G.hooks.onRemoteHit = (r, dmg) => send({ t: 'hit', to: r.id, dmg: Math.round(dmg) });
  G.hooks.onShoot = (x, z, a) => send({ t: 'shot', x, z, a });
  G.hooks.onPlayerDie = () => send({ t: 'died', by: G.lastHitBy || 0 });
}
function handle(m) {
  switch (m.t) {
    case 'welcome': me = m.id; for (const p of m.players) addRemote(p.id, p.name, p.hero); break;
    case 'join': addRemote(m.id, m.name, m.hero); break;
    case 'leave': dropRemote(m.id); break;
    case 's': { const r = R.get(m.id); if (!r) break; r.tx = m.x; r.tz = m.z; r.ta = m.a; r.hp = m.hp; r.ty = m.y || 0; r.pitch = m.p || 0; r.roll = m.r || 0; r.cw = m.w; r.sp = m.sp || 0; r.carType = m.c || null; if (r.first) { r.x = m.x; r.z = m.z; r.a = m.a; r.first = false; } break; }
    case 'shot': { const r = R.get(m.id); if (!r) break; r.swing = .2; r.aim = .4; sfx('shot', .5); tracer(m.x + Math.sin(m.a) * .6, 1.4, m.z + Math.cos(m.a) * .6, m.x + Math.sin(m.a) * 40, 1.3, m.z + Math.cos(m.a) * 40); break; }
    case 'hit': { G.lastHitBy = m.from; hurtP(m.dmg, { remote: true }); break; }
    case 'killed': { const r = R.get(m.id); if (r) { r.dead = 3; } const by = R.get(m.by); say('', (by ? by.name : (m.by === me ? 'Toi' : '?')) + ' a mis K.O. ' + (r ? r.name : (m.id === me ? 'toi' : '?')), 3); if (m.by === me) { G.cash += 100; feed('+$100 (frag)', '#7dff9a'); } break; }
    case 'chat': say(m.name, m.text, 4); break;
  }
}
export function netUpdate(dt) {
  if (!ready) return; const P = G.P; sendT -= dt;
  if (sendT <= 0) { sendT = .09; const c = P.car; send({ t: 's', x: +P.x.toFixed(2), z: +P.z.toFixed(2), a: +(c ? c.a : P.a).toFixed(3), hp: Math.round(P.hp), y: c ? +c.y.toFixed(1) : 0, p: c ? +c.pitch.toFixed(2) : 0, r: c ? +c.roll.toFixed(2) : 0, c: c ? c.type : null, w: P.cur, sp: c ? +c.sp.toFixed(1) : 0 }); }
  for (const r of R.values()) {
    const k = clamp(dt * 10, 0, 1); const px = r.x, pz = r.z; r.x = lerp(r.x, r.tx, k); r.z = lerp(r.z, r.tz, k); r.a += adiff(r.ta, r.a) * k; const sp = Math.hypot(r.x - px, r.z - pz) / Math.max(dt, .001);
    if (r.cw && r.cw !== r.weapon) { r.weapon = r.cw; setHeld(r, r.weapon); }
    if (r.carType) {
      if (!r.veh || r.veh.type !== r.carType) { if (r.veh) removeVehicle(r.veh); r.veh = spawnVehicle(r.carType, r.x, r.z, r.a, 'parked', undefined, { remote: true }); }
      Object.assign(r.veh, { x: r.x, z: r.z, a: r.a, y: r.ty || 0, pitch: r.pitch, roll: r.roll, sp: r.sp }); r.model.root.visible = false;
    } else { if (r.veh) { removeVehicle(r.veh); r.veh = null; } r.model.root.visible = true; animHuman(r, dt, sp > .4 ? clamp(sp, 0, 7) : 0); r.model.root.position.set(r.x, 0, r.z); r.model.root.rotation.y = r.a; if (r.dead > 0) { r.dead -= dt; r.model.root.rotation.x = -1.4; } else r.model.root.rotation.x = 0; }
  }
}
