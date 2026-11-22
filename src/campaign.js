/* campaign.js — 36 missions en 6 chapitres, cinématiques, contrats secondaires */
import { rand, pick, irand } from './core.js';
import { defineCine } from './cine.js';
import { POI } from './world.js';

export const CHAPTERS = ['Yop City', 'Plateau', 'La Lagune', 'Le Port', 'Le Camp', 'Ciel d\'Abidjan'];

/* ---------- raccourcis d'écriture ---------- */
const go = (at, text, o = {}) => ({ t: 'goto', at, text, ...o });
const car = (type, at, text, o = {}) => ({ t: 'car', type, at, text, ...o });
const kill = (gang, n, at, text, o = {}) => ({ t: 'kill', gang, n, at, text, ...o });
const vk = (type, n, at, text, o = {}) => ({ t: 'vkill', type, n, at, text, ...o });
const talk = (...lines) => ({ t: 'talk', lines, text: 'Écoute' });
const cine = id => ({ t: 'cine', id });
const fol = (type, at, to, text, o = {}) => ({ t: 'follow', type, at, to, text, ...o });
const lose = (stars, text) => ({ t: 'lose', stars, text });
const wait = (d, text) => ({ t: 'wait', d, text });
const gv = (...w) => ({ t: 'fn', f: () => {}, give: w });
const M = (id, ch, title, start, cash, steps, o = {}) => ({ id, ch, title, start, cash, steps, ...o });
const ADJ = 'Maman Adjoua', ZEZ = 'Tonton Zézé', ME = '{h}', ROU = 'Le Rouge', SYL = 'Capitaine Sylla', KRA = 'Madame Kra', BAK = 'Bako', TRA = 'Lt Traoré', DIR = 'Le Directeur', FAN = 'Fanta';

/* ========================= CAMPAGNE ========================= */
export const CAMP = [
  /* ---- CHAPITRE 1 : YOP CITY ---- */
  M(1, 0, 'Premier jour à Yop', 'planque', 150, [
    talk([ME, 'Nouveau jour à Yopougon. Il faut que je trouve du boulot, vite.'], [ME, 'Maman Adjoua cherche quelqu\'un de confiance au maquis.']),
    go('maquis', 'Va au maquis d\'Adjoua', { r: 7 }),
    cine('c_adjoua'),
    gv('bat'),
    go('garage', 'Apporte le message à Tonton Zézé au garage', { r: 8, ok: [ZEZ, 'Ah, tu es le petit de Maman Adjoua ! Bienvenue au garage.'] }),
  ], { intro: 'c_intro', chStart: true, auto: true }),
  M(2, 0, 'Taxi woro-woro', 'garage', 200, [
    talk([ZEZ, 'J\'ai un woro-woro à livrer au marché d\'Adjamé. Le client attend.'], [ZEZ, 'Conduis doucement… et évite la police.']),
    car('woro', 'garage', 'Prends le woro-woro devant le garage', { off: [8, 4] }),
    go('marche', 'Livre le taxi au marché d\'Adjamé', { veh: 'woro', r: 9, time: 190 }),
    go('garage', 'Reviens à pied ou en voiture au garage', { r: 9, ok: [ZEZ, 'Propre ! Les clients vont parler de toi.'] }),
  ]),
  M(3, 0, 'Les Corbeaux au maquis', 'maquis', 250, [
    talk([ADJ, 'Les Corbeaux viennent me faire payer "la protection". Ils sont là, devant !'], [ME, 'Reste derrière, Maman. Je m\'en occupe.']),
    gv('pistol'),
    kill('corbeaux', 4, 'maquis', 'Chasse les Corbeaux du maquis', { spread: 12, alert: true }),
    talk([ADJ, 'Merci mon fils. Mais ce n\'est que le début : Le Rouge ne pardonne pas.']),
  ]),
  M(4, 0, 'Course du gbaka', 'gare', 300, [
    talk([ZEZ, 'Le gbaka de la gare doit rejoindre le stade avant le match. Les passagers sont pressés !']),
    car('gbaka', 'gare', 'Prends le gbaka', { off: [8, 5] }),
    go('stade', 'Conduis le gbaka au Stade de Yop', { veh: 'gbaka', r: 12, time: 150 }),
    go('maquis', 'Retourne au maquis fêter ça', { r: 9 }),
  ]),
  M(5, 0, 'Attiéké express', 'maquis', 350, [
    talk([ADJ, 'Livre ces cartons d\'attiéké-poisson à la gare d\'Adjamé. Attention, les Corbeaux guettent.']),
    car('pickup', 'maquis', 'Prends le pick-up chargé', { off: [8, 5] }),
    go('gare', 'Livre l\'attiéké à la gare', { veh: 'pickup', r: 10, time: 170, ok: ['Cliente', 'Hmm ça sent bon ! Tiens, pour la peine.'] }),
    kill('corbeaux', 5, 'gare', 'Les Corbeaux arrivent ! Défends-toi', { alert: true, spread: 14 }),
  ]),
  M(6, 0, 'Le Rouge se présente', 'stade', 400, [
    go('stade_c', 'Rejoins la pelouse du stade', { r: 10 }),
    cine('c_rouge'),
    gv('smg'),
    kill('corbeaux', 7, 'stade_c', 'Survis à l\'embuscade du Rouge', { alert: true, spread: 18, waves: 2, weapon: 'pistol' }),
    go('planque', 'Fuis vers la planque', { r: 8 }),
  ]),
  M(7, 0, 'Nuit sur Yopougon', 'planque', 500, [
    talk([ZEZ, 'Les Corbeaux tiennent Yop Haut. Si on les chasse, Le Rouge perd sa vitrine.']),
    go('yop_haut', 'Monte à Yop Haut', { r: 12 }),
    kill('corbeaux', 6, 'yop_haut', 'Nettoie Yop Haut', { alert: true, spread: 16, waves: 2 }),
    kill('corbeaux', 1, 'yop_haut', 'Un lieutenant arrive : Gros Bras !', { boss: { name: 'Gros Bras', hp: 420 }, spread: 6, alert: true, n: 3 }),
    talk([ME, 'Yop Haut est libre.'], [ZEZ, 'Bien joué ! Mais une cliente veut te voir au Plateau…']),
  ], { outro: 'c_chap1' }),

  /* ---- CHAPITRE 2 : PLATEAU ---- */
  M(8, 1, 'Madame Kra', 'banque', 600, [
    cine('c_kra'),
    go('villa', 'Va repérer la villa du Plateau', { r: 10 }),
    talk([KRA, 'Mon associé Diomandé garde des documents. Récupère-les… discrètement.'], [ME, 'Discret, c\'est mon deuxième prénom.']),
  ], { chStart: true }),
  M(9, 1, 'Le casse de la banque', 'banque', 900, [
    car('sedan', 'banque', 'Prends la berline de fuite', { off: [8, 5] }),
    kill('lions', 6, 'banque', 'Neutralise les gardes de la banque', { alert: true, spread: 14, weapon: 'smg' }),
    go('banque', 'Entre dans la banque', { r: 6 }),
    wait(3, 'Récupère la mallette…'),
    lose(3, 'Perds la police !'),
  ], { setup: null }),
  M(10, 1, 'Le Commissaire', 'cocody2', 700, [
    cine('c_diom'),
    car('suv', 'cocody2', 'Prends le SUV du commissaire', { off: [8, 5] }),
    fol('suv', 'cocody2', 'zone4', 'Suis le convoi du commissaire sans te faire repérer', { max: 90, off: [-10, 0] }),
    go('zone4', 'Observe la rencontre à Zone 4', { r: 25 }),
    kill('lions', 5, 'zone4', 'Les hommes du commissaire t\'ont repéré !', { alert: true, weapon: 'pistol', spread: 14 }),
  ]),
  M(11, 1, 'Villa à Cocody', 'villa', 800, [
    go('cocody2', 'Rejoins le quartier des ambassades', { r: 12 }),
    kill('lions', 8, 'villa', 'Prends d\'assaut la villa de Diomandé', { alert: true, weapon: 'smg', spread: 16, waves: 2, tough: true }),
    go('villa', 'Fouille la villa', { r: 6, ok: [ME, 'Des dossiers, des billets… et un lien avec le Directeur de la Tour Ébène.'] }),
    gv('shotgun'),
  ]),
  M(12, 1, 'Poursuite sur le pont', 'zone4', 900, [
    talk([KRA, 'Le commissaire s\'enfuit avec nos preuves ! Rattrape-le !']),
    car('sport', 'zone4', 'Prends le muscle car', { off: [8, 5] }),
    vk('sport', 1, 'zone4', 'Détruis la voiture de fuite du commissaire', { off: [60, 0], route: ['zone4', 'marcory2', 'treich', 'marche', 'yop_nord', 'zone4'], spd: 24, boss: { name: 'Voiture du Commissaire' }, hp: 220 }),
    lose(2, 'Sème les motards'),
  ]),
  M(13, 1, 'Trahison au Plateau', 'banque', 1000, [
    go('tour', 'Rejoins Madame Kra à la Tour Ébène', { r: 12 }),
    cine('c_traitre'),
    kill('lions', 6, 'tour', 'Madame Kra t\'a vendu ! Défends-toi', { alert: true, weapon: 'smg', spread: 14, waves: 2 }),
    lose(3, 'Disparais dans la ville'),
    talk([ADJ, 'Viens à la lagune, Bako peut te cacher. Tu as de vrais ennemis maintenant.']),
  ], { outro: 'c_chap2' }),

  /* ---- CHAPITRE 3 : LA LAGUNE ---- */
  M(14, 2, 'La pinasse de Bako', 'dock1', 800, [
    cine('c_bako'),
    car('pinasse', 'dock1', 'Monte dans la pinasse', { off: [0, -6] }),
    go('lagune2', 'Traverse la lagune jusqu\'au point 2', { veh: 'boat', r: 14 }),
    go('ile', 'Rejoins l\'île du Silence', { veh: 'boat', r: 16, time: 200 }),
  ], { chStart: true }),
  M(15, 2, 'Contrebande nocturne', 'dock2', 900, [
    talk([BAK, 'Des caisses doivent passer avant l\'aube. Une vedette, trois points, pas de lumière.']),
    car('speedboat', 'dock2', 'Prends la vedette', { off: [0, -6] }),
    go('lagune1', 'Premier point de livraison', { veh: 'boat', r: 15, time: 150 }),
    go('lagune3', 'Deuxième point', { veh: 'boat', r: 15, time: 120 }),
    go('dock3', 'Quai final', { veh: 'boat', r: 14, time: 120 }),
  ]),
  M(16, 2, 'Patrouille sur l\'eau', 'dock1', 1000, [
    talk([BAK, 'La patrouille fluviale nous a repérés. Coule-la avant qu\'elle appelle des renforts !']),
    car('speedboat', 'dock1', 'Prends la vedette', { off: [0, -6] }),
    vk('patrol', 2, 'lagune3', 'Coule les patrouilleurs', { spread: 20 }),
    go('dock1', 'Reviens à quai', { veh: 'boat', r: 14 }),
  ]),
  M(17, 2, 'Bagarre sur les docks', 'dock3', 900, [
    kill('port', 6, 'dock3', 'Les dockers du Rouge bloquent le quai', { alert: true, spread: 14 }),
    kill('port', 5, 'dock2', 'Deuxième quai : nettoie', { alert: true, spread: 12, weapon: 'smg' }),
    talk([BAK, 'Ils cherchent une cargaison au port. Du matériel militaire, je crois.']),
  ]),
  M(18, 2, 'Le ferry', 'dock2', 1100, [
    talk([BAK, 'Le Rouge a pris des otages sur le ferry. Monte à bord avant qu\'il ne parte !']),
    car('speedboat', 'dock2', 'Prends la vedette', { off: [0, -6] }),
    fol('ferry', 'lagune5', 'dock1', 'Rattrape le ferry', { via: ['lagune3', 'lagune2', 'lagune1', 'dock1'], spd: 7, free: true, max: 160 }),
    kill('corbeaux', 7, 'dock1', 'Libère le ferry', { alert: true, spread: 12, waves: 2 }),
  ]),
  M(19, 2, 'Fuite de Bako', 'dock1', 1000, [
    cine('c_bako2'),
    car('pinasse', 'dock1', 'Prends la pinasse de Bako', { off: [0, -7] }),
    vk('patrol', 3, 'lagune2', 'Repousse les patrouilleurs du Directeur', { spread: 26 }),
    go('dock3', 'Mène Bako au port', { veh: 'boat', r: 14 }),
  ], { outro: 'c_chap3' }),

  /* ---- CHAPITRE 4 : LE PORT ---- */
  M(20, 3, 'Conteneurs du Port', 'port', 1100, [
    cine('c_port'),
    go('port2', 'Fouille le quai des conteneurs', { r: 10 }),
    kill('port', 8, 'port2', 'Les gardes du port ouvrent le feu', { alert: true, weapon: 'smg', spread: 16, waves: 2 }),
  ], { chStart: true }),
  M(21, 3, 'Les grues', 'port2', 1200, [
    kill('port', 6, 'port', 'Nettoie le pied des grues', { alert: true, spread: 18, tough: true }),
    gv('rpg'),
    vk('patrol', 1, 'dock3', 'Une vedette armée du Rouge bloque la sortie : RPG !', { spread: 6 }),
    wait(2, 'Fouille les caisses…'),
  ]),
  M(22, 3, 'Convoi de camions', 'port', 1200, [
    car('camion', 'port', 'Prends le camion de marchandises', { off: [10, 4] }),
    go('marche', 'Livre au Marché d\'Adjamé', { veh: 'camion', r: 12, time: 190 }),
    kill('lions', 5, 'marche', 'Les Lions attaquent le camion', { alert: true, weapon: 'shotgun', spread: 14 }),
    go('garage', 'Cache le camion au garage', { r: 10 }),
  ]),
  M(23, 3, 'Gros Bras revient', 'port2', 1400, [
    talk([ME, 'Gros Bras garde les armes volées.']),
    kill('corbeaux', 1, 'port2', 'Combat contre Gros Bras', { boss: { name: 'Gros Bras', hp: 750 }, n: 5, alert: true, spread: 8, bossWeapon: 'smg', weapon: 'pistol' }),
  ]),
  M(24, 3, 'Armes volées', 'port', 1300, [
    car('camion', 'port', 'Prends le camion d\'armes', { off: [10, 4] }),
    go('camp_gate', 'Livre-les à la porte du Camp', { veh: 'camion', r: 14, time: 220 }),
    vk('suv', 2, 'marcory2', 'Le Rouge envoie des SUV !', { route: ['marcory2', 'treich', 'marche', 'camp_gate'], spd: 22, hp: 160 }),
  ]),
  M(25, 3, 'Explosion au port', 'port2', 1500, [
    talk([ZEZ, 'Les conteneurs piégés vont sauter ! Sors de là !']),
    go('port', 'Cours vers la sortie du port', { r: 14, time: 50 }),
    wait(2, 'BOUM'),
    lose(3, 'L\'armée est sur tes talons'),
  ], { outro: 'c_chap4' }),

  /* ---- CHAPITRE 5 : LE CAMP ---- */
  M(26, 4, 'Lieutenant Traoré', 'camp_gate', 1300, [
    cine('c_traore'),
    go('camp_yard', 'Entre dans la cour du camp', { r: 12 }),
    kill('army', 6, 'camp_yard', 'Les soldats de Traoré se méfient', { alert: true, weapon: 'smg', spread: 16 }),
  ], { chStart: true }),
  M(27, 4, 'Voler le char', 'camp_yard', 1600, [
    go('camp_yard', 'Cherche le char T-72 dans la cour', { r: 14 }),
    car('tank', 'camp_yard', 'Monte dans le char', { off: [10, 8] }),
    go('camp_gate', 'Fonce vers la grille', { veh: 'tank', r: 14 }),
  ]),
  M(28, 4, 'Le char dans la ville', 'camp_gate', 1800, [
    car('tank', 'camp_gate', 'Reprends le char', { off: [-10, 8] }),
    vk('tank', 2, 'marche', 'Détruis les chars rebelles du Marché', { spread: 20 }),
    vk('suv', 4, 'gare', 'Écrase les SUV du Rouge', { spread: 22, route: ['gare', 'marche', 'treich', 'gare'], spd: 18 }),
    go('camp', 'Ramène le char au camp', { veh: 'tank', r: 16 }),
  ]),
  M(29, 4, 'Hélico de secours', 'camp', 1700, [
    talk([TRA, 'Un hélico t\'attend à l\'héliport. Prends-le, Zézé est piégé à Yop Haut.']),
    car('heli', 'helipad', 'Monte dans l\'hélicoptère', { off: [0, 0] }),
    go('yop_haut', 'Survole Yop Haut', { veh: 'heli', r: 30 }),
    kill('lions', 6, 'yop_haut', 'Pose-toi et protège Zézé', { alert: true, spread: 16, weapon: 'smg' }),
  ]),
  M(30, 4, 'Duel d\'hélicos', 'helipad', 2000, [
    car('heli', 'helipad', 'Prends l\'hélicoptère', { off: [0, 0] }),
    vk('heli_army', 2, 'aeroport', 'Détruis les hélicoptères de l\'armée', { y: 35, spread: 60, hp: 220 }),
    go('helipad', 'Reviens te poser à l\'héliport', { veh: 'heli', r: 18, stop: true }),
  ]),
  M(31, 4, 'Évasion du camp', 'camp_gate', 2000, [
    kill('army', 10, 'camp_yard', 'Le camp se soulève', { alert: true, weapon: 'smg', spread: 20, waves: 2, tough: true }),
    vk('tank', 1, 'camp', 'Le char de Traoré !', { boss: { name: 'Char du Lieutenant' }, hp: 700 }),
    lose(4, 'Fuis l\'armée'),
  ], { outro: 'c_chap5' }),

  /* ---- CHAPITRE 6 : CIEL D'ABIDJAN ---- */
  M(32, 5, 'Leçon de pilotage', 'aeroport', 1500, [
    cine('c_air'),
    car('avion', 'piste_ouest', 'Monte dans l\'avion sur la piste', { a: 1.57, off: [30, 0] }),
    go('piste_est', 'Décolle vers l\'est (Espace = accélérer, Maj = descendre)', { veh: 'plane', r: 90, alt: 14 }),
    go('piste_ouest', 'Fais demi-tour et reviens survoler le seuil', { veh: 'plane', r: 110, time: 240 }),
  ], { chStart: true }),
  M(33, 5, 'Assaut des hangars', 'aeroport', 2000, [
    kill('army', 8, 'aeroport', 'Les gardes du Directeur tiennent l\'entrée', { alert: true, weapon: 'smg', spread: 16, waves: 2 }),
    kill('lions', 8, 'piste', 'Hangars : ils ont des RPG !', { alert: true, weapon: 'shotgun', spread: 22, tough: true }),
    go('helipad', 'Prends la clé de l\'avion cargo', { r: 10 }),
  ]),
  M(34, 5, 'Cargo en fuite', 'helipad', 2500, [
    car('heli', 'helipad', 'Prends l\'hélicoptère', { off: [0, 0] }),
    vk('jet', 1, 'piste_est', 'Abats l\'avion cargo du Directeur !', { route: ['piste_est', 'lagune1', 'yop_nord', 'camp', 'piste_ouest'], spd: 32, y: 55, cruiseY: 50, boss: { name: 'Avion cargo' }, hp: 520 }),
    go('helipad', 'Pose-toi à l\'héliport', { veh: 'heli', r: 20, stop: true }),
  ]),
  M(35, 5, 'La Tour Ébène', 'tour', 2500, [
    cine('c_dir'),
    kill('army', 8, 'tour', 'Les gardes du Directeur', { alert: true, weapon: 'smg', spread: 16, waves: 2, tough: true }),
    gv('rpg'),
    talk([DIR, 'Tu as de la chance. Venez, Rouge, finissez-le !']),
  ]),
  M(36, 5, 'Le dernier duel', 'tour', 5000, [
    kill('corbeaux', 1, 'tour', 'Affronte Le Rouge', { boss: { name: 'Le Rouge', hp: 900 }, n: 6, alert: true, spread: 10, bossWeapon: 'smg', weapon: 'pistol', waves: 2 }),
    vk('heli_army', 1, 'tour', 'Le Directeur fuit en hélicoptère : abats-le !', { y: 30, boss: { name: 'Le Directeur' }, hp: 450 }),
    cine('c_end'),
  ], { }),
];
CAMP.forEach((m, i) => { m.chStart = i === 0 || CAMP[i - 1].ch !== m.ch; });

/* ========================= CONTRATS ========================= */
const SPOTS = ['marche', 'gare', 'port', 'stade', 'zone4', 'treich', 'marcory2', 'yop_nord', 'yop_sud', 'cocody2', 'villa', 'banque', 'yop_haut'];
const WATER = ['lagune1', 'lagune2', 'lagune3', 'lagune4', 'lagune5', 'dock1', 'dock2', 'dock3'];
let ctr = 0;
export function makeContract() {
  const k = ctr++ % 5, a = pick(SPOTS), b = pick(SPOTS.filter(x => x !== a)), c = pick(SPOTS.filter(x => x !== a && x !== b)), cash = irand(350, 700);
  const defs = [
    M('s1', -1, 'Livraison express', 'marcory2', cash, [car('pickup', 'marcory2', 'Prends le pick-up de livraison', { off: [8, 5] }), go(a, 'Livre le colis n°1', { veh: 'pickup', r: 10, time: 140 }), go(b, 'Livre le colis n°2', { veh: 'pickup', r: 10, time: 130 })]),
    M('s2', -1, 'Chasse aux Corbeaux', 'marcory2', cash, [go(a, 'Va au point de rendez-vous', { r: 14 }), kill('corbeaux', irand(5, 8), a, 'Élimine les Corbeaux', { alert: true, spread: 15 })]),
    M('s3', -1, 'Contre-la-montre', 'marcory2', cash, [car('sedan', 'marcory2', 'Prends la berline de course', { off: [8, 5] }), go(a, 'Point 1', { veh: 'car', r: 12, time: 100 }), go(b, 'Point 2', { veh: 'car', r: 12, time: 100 }), go(c, 'Arrivée', { veh: 'car', r: 12, time: 100 })]),
    M('s4', -1, 'Course sur la lagune', 'dock1', cash + 150, [go('dock1', 'Rejoins le quai', { r: 10 }), car('speedboat', 'dock1', 'Prends la vedette', { off: [0, -6] }), go(pick(WATER.slice(0, 5)), 'Bouée 1', { veh: 'boat', r: 15, time: 100 }), go(pick(WATER.slice(0, 5)), 'Bouée 2', { veh: 'boat', r: 15, time: 100 })]),
    M('s5', -1, 'Menace policière', 'marcory2', cash, [vk('patrol', 1, 'lagune3', 'Un bateau pirate rôde : coule-le (RPG ou vedette)', { spread: 4 })]),
  ];
  const m = defs[k]; m.chStart = false; return m;
}

/* ========================= CINÉMATIQUES ========================= */
const NAME = { me: '{h}', adjoua: 'Maman Adjoua', zeze: 'Tonton Zézé', rouge: 'Le Rouge', sylla: 'Capitaine Sylla', diomande: 'Commissaire Diomandé', kra: 'Madame Kra', directeur: 'Le Directeur', traore: 'Lt Traoré', fanta: 'Fanta', bako: 'Bako', gros: 'Gros Bras' };
/* Dialogue à deux : caméra alterne entre les deux personnages */
function dialog(id, at, A, B, lines, o = {}) {
  const shots = []; if (o.title) shots.push({ d: 3.6, p: o.p || [-9, 3.2, -10], p2: o.p2 || [6, 2.4, -8], l: [0, 1.4, 0], fov: 50, title: o.title, sub: o.sub, fade: 'in' });
  else shots.push({ d: 2.6, p: [-5, 2.4, -6], p2: [3, 1.8, -5], l: [0, 1.4, 0], fov: 48 });
  for (const [who, text] of lines) {
    const w = who === 0 ? A : B, side = who === 0 ? -1 : 1, d = Math.max(3, text.length * .05 + 1.5);
    shots.push({ d, p: [-side * 2.6, 1.7, -2.8], p2: [-side * 2.1, 1.65, -2.3], l: [side * 1.4, 1.6, 0], fov: 40, speak: who === 0 ? 'a' : 'b', who: NAME[w], line: text });
  }
  shots.push({ d: 1.8, p: [0, 1.6, -6], p2: [0, 2.6, -8], l: [0, 1.4, 0], fov: 50, fade: o.out ? 'out' : undefined });
  defineCine(id, { at, hour: o.hour, endHour: o.endHour, actors: [{ id: 'a', look: A, off: [-1.4, 0], face: 'b' }, { id: 'b', look: B, off: [1.4, 0], face: 'a' }, ...(o.extra || [])], cars: o.cars, shots });
}
dialog('c_intro', 'planque', 'me', 'zeze', [[1, 'Réveille-toi, le petit ! Abidjan ne dort jamais.'], [0, 'Je suis prêt, Tonton. Où est-ce qu\'on commence ?'], [1, 'Au maquis de Maman Adjoua. Elle a du travail pour toi.']], { title: 'ABIDJAN CITY', sub: 'Yopougon · 6h30', hour: 6.5, p: [-14, 12, -16], p2: [8, 3, -9] });
dialog('c_adjoua', 'maquis', 'adjoua', 'me', [[0, 'Ah, te voilà ! Assieds-toi, goûte mon alloco-poisson.'], [1, 'Merci Maman. On dit que les Corbeaux vous embêtent.'], [0, 'Ils veulent ma part. Le Rouge veut toute la commune.'], [1, 'Pas tant que je suis là. Dites-moi quoi faire.'], [0, 'Va voir Zézé au garage, il t\'expliquera. Et prends ça : on ne sait jamais.']]);
dialog('c_rouge', 'stade_c', 'rouge', 'me', [[0, 'Alors c\'est toi, le petit qui casse mes Corbeaux ?'], [1, 'Quitte Yopougon, Rouge. Ici, on se respecte.'], [0, 'Le respect se paie, mon ami. Gros Bras, occupe-toi de lui !']], { title: 'LE ROUGE', sub: 'Chef des Corbeaux', hour: 17.5, extra: [{ id: 'g', look: 'gros', off: [3.4, -1.2], face: 'a' }] });
dialog('c_chap1', 'maquis', 'zeze', 'adjoua', [[0, 'Yop est calme, pour l\'instant. Mais la ville est grande.'], [1, 'Une dame du Plateau a demandé après lui. Madame Kra.'], [0, 'Fais attention : au Plateau, les sourires cachent des couteaux.']], { out: true, hour: 19.5 });
dialog('c_kra', 'banque', 'kra', 'me', [[0, 'Tu es le garçon de Yopougon. On parle de toi dans les bureaux du Plateau.'], [1, 'Je cherche du travail honnête, Madame.'], [0, 'Honnête, non. Rentable, oui. Le Commissaire Diomandé me doit beaucoup.'], [1, 'Et moi, qu\'est-ce que j\'y gagne ?'], [0, 'Une vie loin des Corbeaux. Commençons par la banque.']], { title: 'CHAPITRE 2 · PLATEAU', sub: 'Les tours, les costumes, les mensonges', hour: 10 });
dialog('c_diom', 'cocody2', 'diomande', 'me', [[0, 'Je ne parle pas aux petits voyous. Mais Kra paie bien ton silence, non ?'], [1, 'Elle dit que vous cachez des dossiers.'], [0, 'Quels dossiers ? Dehors, avant que j\'appelle mes hommes !']], { hour: 14 });
dialog('c_traitre', 'tour', 'kra', 'me', [[0, 'Tu as bien travaillé. Trop bien. Le Directeur veut ta tête.'], [1, 'Vous m\'avez menti depuis le début.'], [0, 'Les affaires sont les affaires. Adieu, mon petit.']], { hour: 21, out: true });
dialog('c_chap2', 'dock1', 'bako', 'me', [[0, 'Les lagunes ont des secrets, ami. On t\'y cachera.'], [1, 'Je n\'ai plus nulle part où aller.'], [0, 'Alors apprends à naviguer. Demain, on commence.']], { title: 'CHAPITRE 3 · LA LAGUNE', sub: 'Pinasses et vedettes', hour: 4.5 });
dialog('c_bako', 'dock1', 'bako', 'me', [[0, 'Voici la pinasse de mon père. Elle a vu passer toute l\'histoire d\'Abidjan.'], [1, 'Je ne sais pas conduire un bateau.'], [0, 'Tourne doucement. L\'eau n\'aime pas la colère.']], { hour: 6 });
dialog('c_bako2', 'dock1', 'bako', 'me', [[0, 'Les hommes du Directeur arrivent. Ils veulent la cargaison du port.'], [1, 'Quelle cargaison ?'], [0, 'Des armes. Et l\'armée ferme les yeux. Va au port, ami.']], { hour: 18.5 });
dialog('c_chap3', 'port', 'bako', 'zeze', [[0, 'Le port tient la clé. Si tu coupes les armes, tu coupes le Rouge.'], [1, 'Et si l\'armée est dans le coup, il faudra des armes plus lourdes.']], { title: 'CHAPITRE 4 · LE PORT', sub: 'Grues, conteneurs, armes', hour: 5.5 });
dialog('c_port', 'port', 'me', 'bako', [[1, 'Les conteneurs 14 à 20. Ils sentent la poudre.'], [0, 'Le Rouge n\'est qu\'un pion. Le vrai patron est dans la Tour Ébène.']], { hour: 12 });
dialog('c_chap4', 'garage', 'zeze', 'me', [[0, 'Les armes sont à l\'armée : Traoré. Va au camp, parle-lui.'], [1, 'Un militaire peut-il être honnête ?'], [0, 'Il l\'était, avant le Directeur.']], { title: 'CHAPITRE 5 · LE CAMP', sub: 'Uniformes et blindés', hour: 7 });
dialog('c_traore', 'camp_gate', 'traore', 'me', [[0, 'Je sais qui tu es. Le Directeur m\'a ordonné de te tuer.'], [1, 'Et vous allez obéir ?'], [0, 'Non. J\'ai des hommes loyaux. Mais d\'autres obéiront. Entre vite !']], { hour: 8 });
dialog('c_chap5', 'camp_gate', 'traore', 'me', [[0, 'Le Directeur fuit par les airs. L\'aéroport, vite !'], [1, 'Alors je vole.']], { title: 'CHAPITRE 6 · CIEL D\'ABIDJAN', sub: 'Pistes et hélicos', hour: 12 });
dialog('c_air', 'aeroport', 'fanta', 'me', [[0, 'Je suis pilote, je t\'apprends tout. Pousse la manette, décolle doucement.'], [1, 'Comme un gbaka… mais avec des ailes ?'], [0, 'Si tu veux. Allons-y.']], { hour: 9 });
dialog('c_dir', 'tour', 'directeur', 'me', [[0, 'Tu as détruit mon réseau. Chapeau. Mais ici, c\'est ma maison.'], [1, 'Abidjan n\'est à personne. Elle est à tout le monde.'], [0, 'Rouge, montre-lui ce que ça coûte !']], { title: 'LA TOUR ÉBÈNE', sub: 'Le dernier étage', hour: 18, extra: [{ id: 'g', look: 'rouge', off: [3.6, -1], face: 'a' }] });
dialog('c_end', 'maquis', 'adjoua', 'me', [[0, 'Alors c\'est fini ? La ville respire enfin.'], [1, 'Merci de votre confiance, Maman. Yop sera toujours chez moi.'], [0, 'Viens manger. Cette fois, c\'est moi qui régale !']], { title: 'FIN', sub: 'Merci d\'avoir joué · KJ Industries', hour: 19, out: true, p: [-16, 14, -18], p2: [6, 3, -10] });
