/* cheats.js — console de codes : faire apparaître n'importe quoi, boosts, aide aux missions */
import { G, THREE, clamp, feed, PI, rand, DAYLEN, scene } from './core.js';
import { POI, resolve } from './world.js';
import { VT, spawnVehicle, enterVehicle, explodeVehicle, exitVehicle } from './vehicles.js';
import { spawnHuman } from './ai.js';
import { civSpec, gangSpec, COP_SPEC, SWAT_SPEC, GANGS, HEROES } from './chars.js';
import { WEAP, ORDER, giveWeapon, explosion, addPickup, heat } from './combat.js';
import { MC } from './missions.js';
import { I } from './input.js';
import { SHOPS } from './shops.js';

const VALIAS = { char: 'tank', tank: 'tank', blinde: 'tank', helico: 'heli', helicoptere: 'heli', hélico: 'heli', avion: 'avion', jet: 'jet', avionligne: 'jet', airbus: 'jet', bateau: 'speedboat', vedette: 'speedboat', horsbord: 'speedboat', patrouilleur: 'patrol', ferry: 'ferry', pinasse: 'pinasse', moto: 'moto', voiture: 'sedan', berline: 'sedan', sport: 'sport', muscle: 'sport', flic: 'police', police: 'police', taxi: 'taxi', woro: 'woro', gbaka: 'gbaka', bus: 'bus', sotra: 'bus', camion: 'camion', pickup: 'pickup', suv: 'suv', '4x4': 'suv', helipolice: 'heli_police', helimilitaire: 'heli_army', armee: 'heli_army' };
const GALIAS = { corbeaux: 'corbeaux', corbeau: 'corbeaux', lions: 'lions', lion: 'lions', dockers: 'port', port: 'port', soldats: 'army', soldat: 'army', armee: 'army', army: 'army', ebene: 'ebene', garde: 'ebene' };
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 +]/g, '');
const front = d => ({ x: G.P.x + Math.sin(G.P.a) * d, z: G.P.z + Math.cos(G.P.a) * d });
const out = []; let god = false;
const say = t => out.push(t);

function spawnV(key, enter) {
  const t = VALIAS[key] || (VT[key] ? key : null); if (!t) return say('Véhicule inconnu : ' + key + ' (tape « liste »)');
  const P = G.P, T = VT[t]; let p = front(T.kind === 'plane' ? 12 : 7), y = 0;
  if (T.kind === 'boat') { p = { x: P.x, z: Math.min(-14, P.z - 12) }; if (P.z > 30) p = { x: POI.dock1.x, z: -14 }; }
  if (P.car) exitVehicle(true);
  const v = spawnVehicle(t, p.x, p.z, T.kind === 'plane' ? PI / 2 : P.a, 'parked', null, { y }); v.cheat = true; say('✔ ' + T.name + ' apparu'); if (enter) { P.x = v.x + 2; P.z = v.z; enterVehicle(); } return v;
}
function spawnH(kind, n) {
  n = clamp(n || 3, 1, 15); for (let i = 0; i < n; i++) {
    const p = front(8 + rand(-2, 6)); p.x += rand(-5, 5);
    if (kind === 'civils') spawnHuman('ped', 'walk', p.x, p.z, { spec: civSpec() });
    else if (kind === 'flics') { spawnHuman('cop', 'agent', p.x, p.z, { spec: COP_SPEC, weapon: 'pistol', keep: true }); G.wanted = Math.max(G.wanted, 2); }
    else if (kind === 'swat') { spawnHuman('cop', 'swat', p.x, p.z, { spec: SWAT_SPEC, weapon: 'smg', keep: true }); G.wanted = Math.max(G.wanted, 3); }
    else { const g = GALIAS[kind] || 'corbeaux'; const role = i === 0 && n > 3 ? 'chef' : i % 4 === 3 ? 'bruiser' : 'grunt'; const h = spawnHuman('gang', role, p.x, p.z, { spec: gangSpec(g, role), weapon: g === 'army' ? 'smg' : i % 3 === 2 ? 'bat' : 'pistol', gang: g, keep: true }); h.agg = true; }
  } say('✔ ' + n + ' × ' + kind);
}
const HOURS = { nuit: 23, jour: 12, aube: 6, soir: 19 };
function setHour(h) { G.time = ((((h / 24) - G.startHour) % 1) + 1) % 1 * DAYLEN; }

export const CODES = {
  aide: ['Affiche les codes', () => HELP.forEach(say)],
  liste: ['Liste des véhicules et lieux', () => { say('Véhicules : ' + Object.keys(VT).join(', ')); say('Alias : char, helico, jet, bateau, sport, flic…'); say('Lieux : ' + Object.keys(POI).join(', ')); }],
  spawn: ['spawn <véhicule> — fait apparaître (ex : spawn char)', a => a[0] ? spawnV(a[0], false) : say('spawn <véhicule>')],
  conduire: ['conduire <véhicule> — apparaît et monte dedans', a => a[0] ? spawnV(a[0], true) : say('conduire <véhicule>')],
  pnj: ['pnj <civils|corbeaux|lions|soldats|dockers|flics|swat> [nombre]', a => spawnH(a[0] || 'corbeaux', +a[1])],
  arme: ['arme <nom|toutes> — pistol, smg, shotgun, bat, rpg', a => { const k = a[0]; if (!k || k === 'toutes') { ORDER.forEach(w => giveWeapon(w, 6)); say('✔ toutes les armes'); } else { const w = ORDER.find(o => o === k || (WEAP[o].name || '').toLowerCase().startsWith(k)); if (w) { giveWeapon(w, 6); say('✔ ' + WEAP[w].name); } else say('Arme inconnue : ' + ORDER.join(', ')); } }],
  munitions: ['Recharge toutes les munitions', () => { for (const k of ORDER) if (G.P.inv[k] && G.P.inv[k].mag != null) G.P.inv[k].res += WEAP[k].mag * 6; say('✔ munitions'); }],
  vie: ['Soigne le joueur et répare le véhicule', () => { G.P.hp = G.P.maxhp; if (G.P.car) G.P.car.hp = G.P.car.maxhp; say('✔ soigné'); }],
  dieu: ['Invincibilité ON/OFF', () => { god = !god; if (!god) { G.P.invuln = false; for (const c of G.cars) if (!c.permInv) c.invuln = false; } say('Invincible : ' + (god ? 'OUI' : 'non')); }],
  argent: ['argent [montant] (défaut 10000)', a => { G.cash += clamp(+a[0] || 10000, 1, 9999999); say('✔ argent'); }],
  recherche: ['recherche <0-5> — niveau de police', a => { G.wanted = clamp(+a[0] || 0, 0, 5); G.crimeT = 0; say('✔ recherché ' + G.wanted + '★'); }],
  heure: ['heure <0-24> | nuit | jour | aube | soir', a => { const h = HOURS[a[0]] ?? +a[0]; if (isNaN(h)) return say('heure <0-24>'); setHour(h); say('✔ ' + h + ' h'); }],
  tp: ['tp <lieu> — téléporte (tape « liste » pour les lieux)', a => { const k = a[0]; if (!POI[k]) return say('Lieu inconnu'); const p = resolve(k), P = G.P, c = P.car; if (c) { c.x = p.x; c.z = p.z; c.sp = 0; if (c.kind === 'plane' || c.kind === 'heli') c.y = Math.max(c.y, 40); } P.x = p.x + (c ? 0 : 3); P.z = p.z + (c ? 0 : 3); say('✔ ' + POI[k].name); }],
  boutique: ['boutique <id> — téléporte devant une boutique (' + 'armu1 armu2 mode pharma resto super auto banque police police2 barbier garage studio)', a => { const s = SHOPS.find(x => x.id === a[0]); if (!s) return say('Boutiques : ' + SHOPS.map(x => x.id).join(', ')); const P = G.P; if (G.interior) return say('Sors d\'abord de la boutique'); if (P.car) exitVehicle(); P.x = s.door.x + s.nx * 3; P.z = s.door.z + s.nz * 3; say('✔ ' + s.name); }],
  armure: ['armure — gilet complet', () => { G.P.armor = 100; say('✔ armure 100'); }],
  vitesse: ['vitesse <1-5> — vitesse à pied', a => { G.speedMul = clamp(+a[0] || 1, .5, 5); say('✔ vitesse x' + G.speedMul); }],
  boom: ['Explosion devant toi', () => { const p = front(14); explosion(p.x, 1, p.z, 9, 120, G.P); say('💥'); }],
  boite: ['Fait apparaître des bonus (vie, argent, munitions) autour de toi', () => { for (let i = 0; i < 6; i++) { const p = front(4 + i); addPickup(p.x + rand(-3, 3), p.z + rand(-3, 3), ['health', 'cash', 'ammo', 'armor'][i % 4]); } say('✔ bonus'); }],
  /* aides pour les missions */
  etape: ['Réussit l\'étape de mission en cours', () => say(MC.active() ? '✔ étape : ' + MC.step() : 'Aucune mission active')],
  finir: ['Termine automatiquement la mission en cours', () => { if (!MC.active()) return say('Aucune mission active'); MC.finish(); say('✔ mission en cours de validation…'); }],
  objectif: ['Te téléporte à l\'objectif de la mission', () => say(MC.tpObjective() ? '✔ téléporté' : 'Pas d\'objectif')],
  tuer: ['Élimine les ennemis de l\'étape', () => say('✔ ' + MC.killStep() + ' éliminés')],
  temps: ['temps [s] — ajoute du temps au chrono (défaut 60)', a => say(MC.addTime(+a[0] || 60) ? '✔ temps ajouté' : 'Pas de chrono')],
  mission: ['mission <1-36> — saute à une mission (histoire) ; sans nombre : liste', a => { if (G.mode !== 'story') return say('Disponible en mode histoire'); const n = +a[0]; if (!n) return MC.titles().forEach(say); say(MC.jump(n - 1) ? '✔ mission ' + n : 'Numéro invalide'); }],
  tout: ['Pack complet : vie, armes, munitions, argent, dieu', () => { CODES.vie[1](); CODES.arme[1]([]); CODES.argent[1]([]); if (!god) CODES.dieu[1](); }]
};
const HELP = Object.entries(CODES).filter(([k]) => k !== 'aide').map(([k, v]) => k + ' : ' + v[0]);

export function runCode(line) {
  out.length = 0; const w = norm(line).trim().split(/\s+/).filter(Boolean); if (!w.length) return [];
  const cmd = w[0]; const c = CODES[cmd];
  if (c) c[1](w.slice(1)); else if (VALIAS[cmd] || VT[cmd]) spawnV(cmd, false); else say('Code inconnu. Tape « aide ».');
  return out.slice();
}
export function cheatTick() { if (god) { G.P.invuln = true; if (G.P.car) G.P.car.invuln = true; } }
export const isGod = () => god;
