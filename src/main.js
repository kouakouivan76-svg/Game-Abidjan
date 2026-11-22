/* main.js — démarrage, boucle de jeu, pause, qualité graphique */
import { THREE, G, $, scene, camera, renderer, clamp, lerp, setShadows, setPixelRatio, feed, PI, WORLD } from './core.js';
import { updateSky, followSun, night } from './sky.js';
import { buildWorld, updateWorld, POI, bmap, cmap } from './world.js';
import { HEROES } from './chars.js';
import { initAudio, engine, siren, music, setVolume, sfx } from './audio.js';
import { I } from './input.js';
import { createPlayer, updPlayer, updCamera, CAM } from './player.js';
import { updateHumans, updSpawns, initAmbient, updAmbient } from './ai.js';
import { VT, spawnVehicle, exitVehicle, updVehicle, removeVehicle, initVehicleSpawns, updateVehicleSpawns } from './vehicles.js';
import { updProjectiles, updatePickups, initPickups, recalcDiff, stars, hurtP } from './combat.js';
import { updateFX } from './fx.js';
import { updateHUD, drawMinimap, staticMarkers, buildHeroSelect, setStoryHeroMode, selectedHero, banner, fade, say } from './ui.js';
import { initMissions, updateMissions, missionInfo, missionMarkers, startStory, continueStory, retryMission, saveGame, hasSave, journalHTML } from './missions.js';
import { runCode, cheatTick } from './cheats.js';
import { loadModels } from './models.js';
import { updateCine, isCine, skipCine } from './cine.js';
import { openMap, closeMap, toggleMap, mapOpen, drawBig, gpsMarker, updGps } from './mapui.js';
import { SHOPS, initShops, updShops, applyStyle, shopMarkers, isShopOpen, closeShop } from './shops.js';
import { netUpdate, netJoin, netActive, netMarkers } from './net.js';

/* ---------- qualité ---------- */
const mobile = () => (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches) || /Mobi|Android/i.test(navigator.userAgent);
const LEVELS = ['high', 'medium', 'low'];
function applyQuality(q) {
  G.settings.quality = q; const lvl = q === 'auto' ? (mobile() ? 'medium' : 'high') : q; G.qLevel = lvl; const dpr = window.devicePixelRatio || 1;
  if (lvl === 'high') { setShadows(true); setPixelRatio(Math.min(dpr, 1.5)); G.qf = 1; }
  else if (lvl === 'medium') { setShadows(false); setPixelRatio(Math.min(dpr, 1.2)); G.qf = .85; }
  else { setShadows(false); setPixelRatio(.75); G.qf = .55; }
}
buildWorld(); initShops(); G.hooks.save = () => saveGame(); applyQuality('auto');
const ready = loadModels();

/* ---------- radio ---------- */
const RADIO = ['gbaka', 'lagune', 'action', 'calme', null]; let radioI = 0;
function syncMusic() { if (G.P && G.P.car && G.settings.music) music(RADIO[radioI]); else music(null); }
G.hooks.onEnterVehicle = v => { G.vehLabel = VT[v.type].name; syncMusic(); };
G.hooks.onExitVehicle = () => { engine(null); syncMusic(); };

/* ---------- démarrage ---------- */
let started = false;
function startGame(mode, hero, opts = {}) {
  if (started) return; started = true; ready.then(() => realStart(mode, hero, opts));
}
function realStart(mode, hero, opts) {
   G.mode = mode; initAudio(); setVolume(G.settings.volume);
  createPlayer(hero); applyStyle(); const P = G.P, start = mode === 'story' ? POI.planque : POI.spawn; P.x = start.x + 3; P.z = start.z + 3; recalcDiff();
  initVehicleSpawns(); initAmbient(); initMissions(mode, opts); G.running = true; G.started = true; $('start').classList.add('hide');
  if (mode === 'free' || mode === 'multi') { const { giveWeapon } = G; }
  if (mode !== 'story') { import('./combat.js').then(c => { c.giveWeapon('bat'); c.giveWeapon('smg'); c.giveWeapon('shotgun', 3); }); G.cash = 500; }
  if (mode === 'story' && opts.load) continueStory(); else if (mode === 'story') startStory();
  if (mode === 'multi' && opts.net) netJoin(opts.net.url, opts.net.room, opts.net.name);
  CAM.yaw = 0; CAM.inited = false;
}
$('bStory').onclick = () => { setStoryHeroMode(true); startGame('story', selectedHero); };
$('bContinue').onclick = () => { setStoryHeroMode(true); startGame('story', selectedHero, { load: true }); };
$('bFree').onclick = () => startGame('free', selectedHero);
$('bMulti').onclick = () => { $('menu').classList.add('hide'); $('multi').classList.remove('hide'); try { $('mName').value = localStorage.getItem('ac_name') || ''; $('mUrl').value = localStorage.getItem('ac_url') || ''; $('mRoom').value = localStorage.getItem('ac_room') || 'yop'; } catch (e) { /* ok */ } };
$('bBack').onclick = () => { $('multi').classList.add('hide'); $('menu').classList.remove('hide'); };
$('bJoin').onclick = () => {
  const name = ($('mName').value || 'Joueur').slice(0, 14), url = $('mUrl').value || ('ws://' + (location.hostname || 'localhost') + ':8080'), room = ($('mRoom').value || 'yop').slice(0, 12);
  try { localStorage.setItem('ac_name', name); localStorage.setItem('ac_url', $('mUrl').value); localStorage.setItem('ac_room', room); } catch (e) { /* ok */ }
  $('mStatus').textContent = 'Connexion…'; startGame('multi', selectedHero, { net: { url, room, name } });
};
buildHeroSelect(false); try { if (hasSave()) $('bContinue').classList.remove('hide'); } catch (e) { /* ok */ }

/* ---------- pause & menus ---------- */
function setPause(on) {
  if (!G.running || G.cine) return; G.paused = on; $('pause').classList.toggle('hide', !on);
  if (on) { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* ok */ } engine(null); siren(false); music(null); } else syncMusic();
}
$('pResume').onclick = () => setPause(false);
$('pRetry').onclick = () => { setPause(false); retryMission(); };
$('pSave').onclick = () => { saveGame(); feed('Partie sauvegardée', '#7dff9a'); };
$('pQuit').onclick = () => { saveGame(); location.reload(); };
$('pMissions').onclick = () => { $('logList').innerHTML = journalHTML(); $('log').classList.remove('hide'); };
function openCodes(on) { if (on && !G.running) return; $('codes').classList.toggle('hide', !on); if (on) { if (!G.paused) setPause(true); try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* ok */ } $('codeIn').focus(); if (!$('codeOut').innerHTML) $('codeOut').innerHTML = '<span class="ok">Tape « aide » pour tous les codes.</span>'; } else { for (const k in I.keys) I.keys[k] = false; for (const k in I.want) if (typeof I.want[k] === 'boolean') I.want[k] = false; if (G.paused) setPause(false); } }
$('pCodes').onclick = () => openCodes(true); $('codeClose').onclick = () => openCodes(false);
$('codeForm').onsubmit = e => { e.preventDefault(); const t = $('codeIn').value; $('codeIn').value = ''; if (!t.trim()) return; const o = runCode(t), box = $('codeOut'); box.innerHTML += '<div class="in">&gt; ' + t.replace(/</g, '&lt;') + '</div>' + o.map(x => '<div>' + x.replace(/</g, '&lt;') + '</div>').join(''); box.scrollTop = 1e9; };
addEventListener('keydown', e => { if (e.code === 'F2' || e.key === '`' || e.key === '²') { e.preventDefault(); openCodes($('codes').classList.contains('hide')); } else if (e.code === 'Escape' && !$('codes').classList.contains('hide')) { e.stopPropagation(); openCodes(false); } }, true);
$('logClose').onclick = () => $('log').classList.add('hide');
$('oQuality').onchange = e => applyQuality(e.target.value); $('oVol').oninput = e => setVolume(+e.target.value); $('oMusic').onchange = e => { G.settings.music = e.target.checked; syncMusic(); };

/* ---------- mise à jour ---------- */
function update(dt) {
  const P = G.P, w = I.want;
  if (w.pause) { w.pause = false; if (G.uiGrace > 0) { /* le verrou souris vient d'être levé par une fenêtre */ } else if (G.shopOpen) closeShop(); else if (mapOpen()) closeMap(); else { setPause(!G.paused); if (G.paused) return; } }
  if (G.paused) return;
  if (w.map) { w.map = false; if (!G.shopOpen && !G.cine) toggleMap(); }
  if (G.mapOpen && G.mode !== 'multi') { drawBig(shopMarkers().concat(missionMarkers(), gpsMarker())); updGps(); return; }
  if (w.skip) { w.skip = false; if (isCine()) skipCine(); }
  if (w.radio) { w.radio = false; if (P.car) { radioI = (radioI + 1) % RADIO.length; syncMusic(); feed(['Radio Gbaka', 'Radio Lagune', 'Radio Action', 'Radio Calme', 'Radio coupée'][radioI], '#ffd23a'); } }
  G.time += dt; G.combatT += dt; G.crimeT += dt; G.noise.t += dt; G.hurtT = Math.max(0, G.hurtT - dt); G.hitMark = Math.max(0, G.hitMark - dt);
  G.effDiff = G.diff * (P.hp < 30 ? .8 : P.hp > 85 ? 1.1 : 1);
  if (G.interior) { updPlayer(dt); updateFX(dt); updShops(dt); updateHUD(missionInfo()); cheatTick(); return; }
  for (const c of G.cars.slice()) updVehicle(c, dt);
  for (let i = G.cars.length - 1; i >= 0; i--) { const c = G.cars[i]; if (c.remove && c !== P.car) removeVehicle(c); }
  updPlayer(dt); updateHumans(dt); updProjectiles(dt); updatePickups(dt); updateFX(dt); updAmbient(dt); updateVehicleSpawns(dt); updateWorld(dt);
  G.spawnT = (G.spawnT || 0) - dt; if (G.spawnT <= 0) { G.spawnT = 1.1; updSpawns(); }
  // chaleur : se calme si on se cache
  if (G.wanted > 0) {
    let near = 1e9; for (const h of G.humans) if (h.kind === 'cop' && h.dead <= 0) near = Math.min(near, Math.hypot(h.x - P.x, h.z - P.z)); for (const c of G.cars) if (c.mode === 'police' || (c.pol && !c.wreck)) near = Math.min(near, Math.hypot(c.x - P.x, c.z - P.z));
    if (G.crimeT > 8 && near > 45) G.wanted = Math.max(0, G.wanted - dt * .09); else if (G.crimeT > 25) G.wanted = Math.max(0, G.wanted - dt * .04);
  }
  if (P.car && Math.hypot(P.x - POI.garage.x, P.z - POI.garage.z) < 7) { if (G.wanted > 0 && !G.noGarage) { G.wanted = 0; feed('Garage Express : repeint ! Recherché levé', '#facc15'); for (const h of G.humans) if (h.kind === 'cop' && !h.keep) h.remove = true; } if (P.car.hp < P.car.maxhp) { P.car.hp = P.car.maxhp; feed('Véhicule réparé', '#7dff9a'); } }
  if (G.wanted <= 0.01 && G.wanted !== 0) G.wanted = 0;
  updateMissions(dt); updateCine(dt); netUpdate(dt); cheatTick(); updShops(dt);
  // son
  if (P.car) { const T = VT[P.car.type]; engine(P.car.kind, clamp(Math.abs(P.car.sp) / T.max, 0, 1)); } else engine(null);
  let pol = false; for (const c of G.cars) if (c.mode === 'police' && Math.hypot(c.x - P.x, c.z - P.z) < 90) { pol = true; break; } siren(pol);
  // HUD
  const info = missionInfo(); updateHUD(info);
  if (!G.cine) {
    const mk = []; for (const h of G.humans) if (h.dead <= 0 && (h.kind === 'cop' || h.kind === 'gang') && Math.hypot(h.x - P.x, h.z - P.z) < 150) mk.push({ x: h.x, z: h.z, c: h.kind === 'cop' ? '#60a5fa' : '#f87171', r: 1.8 });
    for (const c of G.cars) if (c.mode === 'police' || (c.pol && !c.wreck)) mk.push({ x: c.x, z: c.z, c: Math.floor(G.time * 4) % 2 ? '#ef4444' : '#3b82f6', r: 2.6 });
    const mm = missionMarkers(); for (const m of mm) mk.push(m); for (const m of netMarkers()) mk.push(m); for (const m of gpsMarker()) mk.push(m); for (const s of shopMarkers()) if (Math.hypot(s.x - P.x, s.z - P.z) < 190) mk.push({ ...s, r: 2.6 }); drawMinimap(mk);
    if (mapOpen()) drawBig(shopMarkers().concat(mk));
    updGps();
  }
}

/* ---------- boucle ---------- */
let last = 0, fpsT = 0, fpsN = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; fpsT += dt; fpsN++;
  if (fpsT > 2.5) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (G.running && !G.paused && G.settings.quality === 'auto' && fps < 27) { const i = LEVELS.indexOf(G.qLevel); if (i < 2) { G.qLevel = LEVELS[i + 1]; applyQualityLevel(G.qLevel); } } G.fps = fps; }
  if (G.running) { update(dt); if (!G.paused) updCamera(dt); }
  else { const a = ts / 9000, c = POI.spawn; camera.position.set(c.x + Math.sin(a) * 70, 34, c.z + Math.cos(a) * 70); camera.lookAt(c.x, 10, c.z); }
  const sk = updateSky(G.running && !G.paused ? dt : 0); followSun(camera.position.x, 0, camera.position.z, sk.sd);
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
function applyQualityLevel(l) { const dpr = window.devicePixelRatio || 1; G.qLevel = l; if (l === 'medium') { setShadows(false); setPixelRatio(Math.min(dpr, 1.2)); G.qf = .85; } else if (l === 'low') { setShadows(false); setPixelRatio(.75); G.qf = .55; } }
requestAnimationFrame(frame);
window.__game = { shops: SHOPS, shopsApi: { closeShop }, cmap, bmap, run: runCode, spawn: spawnVehicle, exit: exitVehicle, G, THREE, startGame, update, POI, CAM, I, scene, camera, renderer, applyQuality };
