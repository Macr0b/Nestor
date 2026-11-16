# Nestor — application installable

Imbrication de pièces DXF, SVG, AI, PDF, LightBurn, VectorCraft et HPGL sur des panneaux, avec export SVG et DXF.
Fonctionne hors connexion, en 45 langues, sur Mac, Windows, Linux, iPhone, iPad et Android.

Version : 1.7.0

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

- **Utilisation** : nom, fichier (DXF, SVG ou AI), réglages, export. Rien n'est enregistré à part tes derniers réglages de panneaux (tailles, stock, espacement, marge, méthode), mémorisés sur chaque appareil.
- **Fichiers AI** : enregistrer depuis Illustrator avec l'option « Créer un fichier compatible PDF » (activée par défaut).
- **Formats lus** : DXF, SVG et SVGZ (Illustrator, Inkscape…), AI, PDF, LightBurn (.lbrn, .lbrn2), VectorCraft (.vectorcraft), HPGL (.plt, .hpgl). Les noms des tracés deviennent les noms des pièces, les calques sont affichés et conservés à l'export.
- **Pièces** : échelle en % ou cote en mm pour chaque pièce, duplication pour tester une variante, rotation fixe, par quart de tour ou libre par 5°.
- **Langues** : 45 langues. L'application démarre dans la langue de l'appareil, changement dans ⚙ › Langue. Les textes sont dans `src/i18n/locales/`, un fichier par langue ; seule la langue utilisée est chargée.
- **Panneaux** : la longueur est verticale et la largeur horizontale (panneau en portrait).
- **Origine** : le petit carré à 9 points choisit le zéro machine. Les pièces se regroupent à partir de ce point (coin, bord ou centre) et c'est le zéro des fichiers exportés.
- **Import** : plusieurs fichiers à la fois ; « + Ajouter des fichiers » complète le travail en cours.
- **Export** : fichiers en mm, zéro sur l'origine choisie. En option (sous « Méthode ») : le contour du panneau sur un calque « Panneau ».
- **Coupes de chutes** (option sous « Méthode ») : traits droits pour récupérer les chutes à la scie, à la même distance des pièces que l'espace entre pièces. « Simples » : d'un bord à l'autre du panneau. « Détaillées » : la découpe suit à peu près le contour du groupe de pièces. Les traits sont exportés sur un calque « Coupes ».
- **Onglet Fraisage** : rotation de la broche, avance, profondeur et nombre de passes selon la fraise (type, diamètre, nombre de dents), la matière (quatre familles, ou une matière précise : essences de bois, contreplaqués, plastiques, métaux) et les limites de la machine. Valeurs de départ prudentes, d'après les méthodes d'id-conception.fr et de cncfraises.fr. Les réglages sont mémorisés.
- **Onglet Carnet** : tes réglages éprouvés (fraisage, laser, autre) avec machine, matière, épaisseur, valeurs utilisées, note et état (validé / à revoir). Recherche, filtre, « Garder dans le carnet » depuis l'onglet Fraisage, « Ouvrir dans Fraisage », sauvegarde et import d'un fichier.
- **Onglet Coût** : prix de revient du plan d'après les panneaux utilisés : matière, chute (dernier panneau compté entier ou seulement la partie utilisée), machine (taux horaire, temps de préparation, temps de découpe estimé) et coût par pièce, réparti selon la surface. C'est une estimation.
- **Onglet Matières** : bibliothèque de tes panneaux habituels avec leur prix (nom, matière pour le fraisage, épaisseur, taille, prix). La matière choisie pour le projet est la même partout : dans Imbrication elle remplit la taille du panneau, dans Fraisage elle règle la matière et l'épaisseur, dans Coût elle donne le prix. Sauvegarde et import d'un fichier.
- **Unités** : métrique par défaut, ou pouces décimaux ou en fractions (Réglages). Les tailles ne changent jamais ; en pouces, les fichiers exportés sont aussi en pouces.

## Contenu du dossier

| Dossier ou fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `css/` | Mise en forme : polices, couleurs (thèmes clair et sombre), décor « plan technique », interface, réglages, onglets, fraisage, carnet, coût |
| `src/main.js` | Point d'entrée : branche chaque partie de l'interface puis démarre |
| `src/version.js` | Numéro de version |
| `src/i18n/` | Langue de l'interface ; `languages.js` (liste des langues) et `locales/` (un fichier de textes par langue) |
| `src/project/` | Projet en cours, exemple du premier lancement, pièces, réglages mémorisés |
| `src/geometry/` | Géométrie : tracés SVG, polylignes, regroupement en pièces, pièces placées |
| `src/import/` | Un lecteur par format (DXF, SVG + nettoyage, PDF / AI, LightBurn, HPGL, VectorCraft) et la lecture des fichiers |
| `src/placement/` | Imbrication selon la forme, rectangles, origine du panneau, calcul en arrière-plan |
| `src/notebook/` | Carnet de réglages : fiches vérifiées, recherche, sauvegarde et import |
| `src/library/` | Bibliothèque de matières (prix des panneaux, matière du projet) et calcul du prix de revient |
| `src/machining/` | Calcul des réglages de fraisage, familles et liste des matières, réglages mémorisés |
| `src/export/` | Fichiers exportés (SVG, DXF), contour du panneau, coupes de chutes |
| `src/ui/` | Chaque partie de l'interface : onglets, fichiers, pièces, panneaux, résultat, fraisage, carnet, coût, matières, réglages, installation, mises à jour |
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
