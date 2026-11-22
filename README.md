# Abidjan City 3D — KJ Industries
Ouvrir `index.html` (double-clic) : le jeu tourne sans serveur.
- Histoire : 36 missions / 6 chapitres, cinématiques (Entrée = passer). Contrats répétables au point vert « Contrats » (Marcory) dès la mission 5.
- Véhicules : voitures, moto, gbaka, camion, pinasse, vedette, ferry, patrouilleur, hélicoptère, avion, char.
- Multijoueur : `cd server && npm install && npm start` puis Menu > Multijoueur > ws://IP:8080 (même salle = même partie). Pour Internet : héberger server/ (Railway, Render…) et utiliser wss://.
- Recompiler : `npm i three esbuild` puis `npx esbuild src/main.js --bundle --minify --format=iife --outfile=jeu.js`

## v3 — modèles GLB, collisions, codes
- Modèles réels (assets.js, intégrés en base64) : taxi, voiture de police, muscle car, avion léger (hélice animée), avion de ligne, soldat animé (marche/course). Soldat = Sgt Winter jouable + armée + SWAT.
- Collisions : boîtes orientées (voiture/char contre bâtiments et entre véhicules, impulsion, glissement le long des murs, dégâts selon l'impact, toupie). Les voitures sont solides pour les piétons.
- Codes : touche F2 (ou ` ) ou Pause > « Codes & boosts ». Tape `aide`. Ex : `conduire jet`, `spawn char`, `pnj soldats 6`, `tout`, `tp tour`, `heure nuit`, `recherche 0`, `finir` (termine la mission), `etape`, `objectif`, `mission 12`.

## v4
- Personnages : avatar homme réaliste (GLB) découpé en tête/torse/bras/jambes articulés pour Koffi, Yao, Le Rouge, gangs, flics, civils et PNJ masculins ; soldat animé pour l'armée / Sgt Winter. Awa et les PNJ féminins gardent le modèle simple.
- Déplacement : à pied ~6,3 m/s (course ~11 m/s) avec inertie ; voitures/motos +18 %, bateaux +12 %.
- Visée : la caméra donne la direction du tir, clic droit = viser (épaule, zoom, précision), dispersion/recul par arme, viseur qui grossit et devient rouge sur un ennemi. Tactile : visée assistée.
- Tir en véhicule (voiture, moto, bateau) : même arme que celle en main, clic/FEU ; souris = viser autour du véhicule.
- Nuit : lumière de lune, lampadaires, fenêtres, phares, petite lumière autour du joueur.

## v5 — collisions, carte, joystick, boutiques, IA
- **Collisions refaites** : bâtiments/murs/conteneurs (rectangles) + palmiers, arbres, lampadaires (cercles) ; véhicules vs décor (boîte orientée), sous-pas pour les véhicules rapides (plus de traversée de murs fins), avions/hélicos contre les arbres, personnages entre eux et contre le joueur.
- **Carte** : clique sur la minimap (ou touche M) → grande carte. Glisse pour te déplacer, molette/pincement pour zoomer, touche un lieu ou un point pour voir l'info et poser un **GPS** (repère bleu, distance affichée, rayon bleu dans le monde). Bâtiments visibles en zoomant.
- **Déplacement joystick** : sur mobile, le joystick apparaît là où on pose le pouce (moitié gauche) ; vitesse analogique (marche → course → sprint auto en poussant à fond) ; la caméra suit la direction quand on ne regarde pas ailleurs.
- **13 boutiques à entrer** (cercle coloré devant la porte, touche E) : 2 armureries, mode, barbier, pharmacie, maquis, supermarché, concession (véhicules livrés), banque (dépôt/retrait), 2 commissariats (caution, casier, gilet), garage (réparation/peinture/blindage), studio (dormir, sauvegarder, mes véhicules). Gilet pare-balles (barre bleue). Achats/tenues/véhicules sauvegardés.
- **IA** : gangs avec couverts, apparitions, flanc, retraite à faible PV, renforts, précision progressive ; policiers qui poursuivent la dernière position connue, fouillent, et posent des barrages routiers (3★+) ; civils qui fuient une arme brandie, esquivent les voitures, lèvent les mains.
- Codes : `boutique <id>`, `armure`.
