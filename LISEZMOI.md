# Nestor — application installable

Imbrication de pièces DXF, SVG, AI, PDF, LightBurn, VectorCraft et HPGL sur des panneaux, avec export SVG et DXF.
Fonctionne hors connexion, en 45 langues, sur Mac, Windows, Linux, iPhone, iPad et Android.

Version : 1.9.0

## 1. Mettre l'application en ligne (une seule fois)

Hébergement gratuit avec GitHub Pages :

1. Crée un compte sur https://github.com (gratuit), puis connecte-toi.
2. En haut à droite, « + » › **New repository**.
   - Nom : `nestor`
   - Coche **Public** (obligatoire pour GitHub Pages gratuit)
   - Clique **Create repository**.
3. Sur la page du dépôt, clique **uploading an existing file**.
4. Décompresse le zip, ouvre le dossier `nestor` et glisse **tout son contenu** (fichiers et dossiers `icons`, `fonts`, `vendor`) dans la page. Clique **Commit changes**.
5. Va dans **Settings** › **Pages**. Dans « Branch », choisis `main` et `/ (root)`, puis **Save**.
6. Après une à deux minutes, l'adresse s'affiche en haut de cette page :
   `https://TON-PSEUDO.github.io/nestor/`

## 2. Installer sur chaque appareil

Ouvre l'adresse ci-dessus, puis :

| Appareil | Comment installer |
|---|---|
| Mac (Intel et Apple Silicon) | Chrome ou Edge : icône d'installation dans la barre d'adresse. Safari : menu Fichier › Ajouter au Dock |
| Windows | Chrome ou Edge : icône d'installation dans la barre d'adresse |
| Linux | Chrome ou Chromium : icône d'installation dans la barre d'adresse |
| iPhone / iPad | Safari : bouton Partager › Sur l'écran d'accueil |
| Android | Chrome : menu ⋮ › Installer l'application |

Le bouton ⚙ de l'application rappelle la marche à suivre et propose le bouton Installer quand le navigateur le permet.

Sur ordinateur avec Chrome ou Edge, l'application installée peut ouvrir directement les fichiers DXF, SVG et AI (clic droit › Ouvrir avec › Nestor).

## 3. Mettre à jour

1. Remplace les fichiers modifiés dans le dépôt GitHub (Add file › Upload files, puis Commit changes).
2. Change toujours le numéro de version **à deux endroits**, sinon les appareils ne verront pas la mise à jour :
   - `sw.js`, ligne `const VERSION = "1.3.0";`
   - `src/version.js`, ligne `export const APP_VERSION = "1.3.0";`
3. Sur chaque appareil, au lancement suivant, une bannière « Nouvelle version disponible » apparaît. Un tap sur **Mettre à jour** suffit. Le bouton ⚙ › Vérifier les mises à jour force la vérification.

Tes réglages de panneaux sont conservés pendant les mises à jour.

## 4. Bon à savoir

- **Utilisation** : nom, fichier (DXF, SVG ou AI), réglages, export. Tes derniers réglages de panneaux (tailles, stock, espacement, marge, méthode) sont mémorisés sur chaque appareil ; un projet complet s'enregistre avec le bouton « Projets ».
- **Fichiers AI** : enregistrer depuis Illustrator avec l'option « Créer un fichier compatible PDF » (activée par défaut).
- **Formats lus** : DXF, SVG et SVGZ (Illustrator, Inkscape…), AI, PDF, LightBurn (.lbrn, .lbrn2), VectorCraft (.vectorcraft), HPGL (.plt, .hpgl). Les noms des tracés deviennent les noms des pièces, les calques sont affichés et conservés à l'export.
- **Pièces** : échelle en % ou cote en mm pour chaque pièce, duplication pour tester une variante, rotation fixe, par quart de tour ou libre par 5°.
- **Langues** : 45 langues. L'application démarre dans la langue de l'appareil, changement dans ⚙ › Langue. Les textes sont dans `src/i18n/locales/`, un fichier par langue ; seule la langue utilisée est chargée.
- **Panneaux** : la longueur est verticale et la largeur horizontale (panneau en portrait).
- **Origine** : le petit carré à 9 points choisit le zéro machine. Les pièces se regroupent à partir de ce point (coin, bord ou centre) et c'est le zéro des fichiers exportés.
- **Import** : plusieurs fichiers à la fois ; « + Ajouter des fichiers » complète le travail en cours.
- **Saisir à la main** : pièces rectangulaires (nom, longueur, largeur, quantité, sens fixe), une par une ou collées depuis un tableur (colonnes nom, longueur, largeur, quantité). Elles rejoignent la liste des pièces, restent quand on importe un fichier ensuite, et sont gardées dans les projets.
- **Export** : fichiers en mm, zéro sur l'origine choisie. En option (sous « Méthode ») : le contour du panneau sur un calque « Panneau », et le numéro de chaque pièce à graver sur un calque « Numéros » (trait simple, placé dans la matière de la pièce).
- **PDF à imprimer** : sous chaque panneau, son plan numéroté avec ses cotes, le zéro machine et la liste de ses pièces ; « Tout le plan en PDF » ajoute une page de résumé. A4 en métrique, Letter en impérial.
- **Coupes de chutes** (option sous « Méthode ») : traits droits pour récupérer les chutes à la scie, à la même distance des pièces que l'espace entre pièces. « Simples » : d'un bord à l'autre du panneau. « Détaillées » : la découpe suit à peu près le contour du groupe de pièces. Les traits sont exportés sur un calque « Coupes ». Aucun trait parallèle au bord ne tombe dans la marge.
- **Ordre des coupes à la scie** (option de la méthode Rectangles) : coupes numérotées sur le panneau, d'un bord à l'autre du morceau coupé, avec leur liste (sens, cote depuis le bord gauche ou haut, morceau coupé) sous le panneau et dans le PDF. Les bords de marge sont délignés d'abord, les grandes chutes partent d'un seul trait, et l'espace entre pièces compte comme trait de scie.
- **Onglet Fraisage** : rotation de la broche, avance, profondeur et nombre de passes selon la fraise (type, diamètre, nombre de dents), la matière (quatre familles, ou une matière précise : essences de bois, contreplaqués, plastiques, métaux) et les limites de la machine. Valeurs de départ prudentes, d'après les méthodes d'id-conception.fr et de cncfraises.fr. Les réglages sont mémorisés.
- **Onglet Laser** : tes machines (plusieurs puissances possibles), et pour chacune un point de départ par matière et épaisseur, tiré des livrets de paramètres publiés par Trotec (60, 80 et 120 W), du tableau de Thunder Laser (contreplaqué bouleau, carton, cuir, papier, placage, tissu ; 40 à 130 W) et du tableau de GWK Laser (bois tendre et contreplaqué courant, MDF, acrylique ; 40 à 150 W) ; autre puissance ou autre épaisseur : estimation signalée. Ce sont des valeurs indicatives : « Modifier ces valeurs » enregistre les tiennes pour la machine, et « ＋ Nouvelle matière » ajoute tes propres matières. Au-delà de 10 mm, le laser ne sert qu'à graver. Vitesse en % pour une Trotec, en mm/s pour les autres. Grille de test (16 carrés puissance × vitesse) en SVG ou DXF.
- **Onglet Carnet** : tes réglages éprouvés (fraisage, laser, autre) avec machine, matière, épaisseur, valeurs utilisées, note et état (validé / à revoir). Recherche, filtre par procédé et par machine, « Garder dans le carnet » depuis Fraisage et Laser, « Ouvrir dans Fraisage », sauvegarde et import d'un fichier.
- **Onglet Coût** : prix de revient du plan d'après les panneaux utilisés : matière, chute (dernier panneau compté entier ou seulement la partie utilisée), machine (taux horaire, temps de préparation, temps de découpe estimé) et coût par pièce, réparti selon la surface. C'est une estimation.
- **Onglet Matières** : bibliothèque de tes panneaux habituels avec leur prix (nom, matière pour le fraisage, épaisseur, taille, prix). La matière choisie pour le projet est la même partout : dans Imbrication elle remplit la taille du panneau, dans Fraisage elle règle la matière et l'épaisseur, dans Coût elle donne le prix. Sauvegarde et import d'un fichier.
- **Projets** : bouton « Projets » en haut. Enregistre tout le projet (fichiers importés, pièces, panneaux, options d'export, matière, réglages de fraisage, de laser et de coût) dans ce navigateur ; « Exporter le fichier » donne un fichier `.nestor` à rouvrir sur un autre ordinateur.
- **Raccourcis clavier** : Ctrl (⌘ sur Mac) + Entrée recalcule, + S enregistre, + O ouvre un projet, + I importe des pièces, + P donne le PDF du plan ; Alt + 1 à 6 change d'onglet ; « ? » montre la liste.
- **Unités** : métrique par défaut, ou pouces décimaux ou en fractions (Réglages). Les tailles ne changent jamais ; en pouces, les fichiers exportés sont aussi en pouces.

## Contenu du dossier

| Dossier ou fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `css/` | Mise en forme : polices, couleurs (thèmes clair et sombre), décor « plan technique », interface, réglages, onglets, fraisage, laser, carnet, coût, projets, raccourcis |
| `src/main.js` | Point d'entrée : branche chaque partie de l'interface puis démarre |
| `src/version.js` | Numéro de version |
| `src/i18n/` | Langue de l'interface ; `languages.js` (liste des langues) et `locales/` (un fichier de textes par langue) |
| `src/project/` | Projet en cours, exemple du premier lancement, pièces, pièces saisies à la main, réglages mémorisés, projets enregistrés (photo vérifiée, base du navigateur) |
| `src/geometry/` | Géométrie : tracés SVG, polylignes, regroupement en pièces, pièces placées, emplacement du numéro dans une pièce |
| `src/text/` | Police au trait simple pour les numéros gravés et la grille de test |
| `src/import/` | Un lecteur par format (DXF, SVG + nettoyage, PDF / AI, LightBurn, HPGL, VectorCraft) et la lecture des fichiers |
| `src/placement/` | Imbrication selon la forme, rectangles, origine du panneau, calcul en arrière-plan |
| `src/notebook/` | Carnet de réglages : fiches vérifiées, recherche, sauvegarde et import |
| `src/library/` | Bibliothèque de matières (prix des panneaux, matière du projet) et calcul du prix de revient |
| `src/machining/` | Calcul des réglages de fraisage, familles et liste des matières, réglages mémorisés |
| `src/laser/` | Livrets Trotec, tableaux Thunder Laser et GWK, point de départ laser par machine, tes matières et tes valeurs, machines mémorisées, grille de test |
| `src/export/` | Fichiers exportés (SVG, DXF, PDF), contour du panneau, coupes de chutes, ordre des coupes à la scie, numéros gravés |
| `src/ui/` | Chaque partie de l'interface : onglets, fichiers, pièces, panneaux, résultat, pages du PDF, fraisage, laser, carnet, coût, matières, projets, raccourcis, réglages, installation, mises à jour |
| `sw.js` | Hors connexion et mises à jour (liste de tous les fichiers à garder en cache) |
| `manifest.webmanifest` | Nom, icônes, installation, formats ouverts par l'appli |
| `icons/`, `fonts/` | Icônes et polices (Barlow, IBM Plex Mono — licence OFL) |
| `vendor/pdfjs/` | Lecteur PDF/AI de Mozilla, pdf.js 6.5.438 version « legacy » (licence Apache 2.0) |
| `tests/` | Tests automatiques, rangés comme `src/`, relancés par GitHub à chaque mise à jour |
| `tools/build-claude.mjs` | Fabrique la version Claude (une seule page) à partir de l'appli |

Chaque fichier de code commence par une ligne qui décrit son rôle. Le code est écrit en modules JavaScript standard
(`import` / `export`), sans étape de fabrication : le dossier est publié tel quel.

## Pour les développeurs

Il faut Node 22 ou plus.

```
npm install                 # outils : prettier (mise en forme), esbuild (version Claude)
npm test                    # tous les tests
npm run format              # remet le code en forme
npm run build:claude        # écrit dist/nestor-claude.html
```

Les tests d'interface utilisent un vrai navigateur. Ils demandent Playwright
(`npm install --no-save playwright && npx playwright install chromium`), sinon ils sont sautés.
Avant chaque mise à jour : `npm run format:check` et `npm test` doivent passer (GitHub les relance à chaque envoi).
