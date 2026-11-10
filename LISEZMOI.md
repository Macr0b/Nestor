# Nestor — application installable

Imbrication de pièces DXF, SVG, AI, PDF, LightBurn, VectorCraft et HPGL sur des panneaux, avec export SVG et DXF.
Fonctionne hors connexion, en 45 langues, sur Mac, Windows, Linux, iPhone, iPad et Android.

Version : 1.2.1

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
   - `sw.js`, ligne `const VERSION = "1.2.0";`
   - `app.js`, ligne `var APP_VERSION = "1.2.0";`
3. Sur chaque appareil, au lancement suivant, une bannière « Nouvelle version disponible » apparaît. Un tap sur **Mettre à jour** suffit. Le bouton ⚙ › Vérifier les mises à jour force la vérification.

Tes réglages de panneaux sont conservés pendant les mises à jour.

## 4. Bon à savoir

- **Utilisation** : nom, fichier (DXF, SVG ou AI), réglages, export. Rien n'est enregistré à part tes derniers réglages de panneaux (tailles, stock, espacement, marge, méthode), mémorisés sur chaque appareil.
- **Fichiers AI** : enregistrer depuis Illustrator avec l'option « Créer un fichier compatible PDF » (activée par défaut).
- **Formats lus** : DXF, SVG et SVGZ (Illustrator, Inkscape…), AI, PDF, LightBurn (.lbrn, .lbrn2), VectorCraft (.vectorcraft), HPGL (.plt, .hpgl). Les noms des tracés deviennent les noms des pièces, les calques sont affichés et conservés à l'export.
- **Pièces** : échelle en % ou cote en mm pour chaque pièce, duplication pour tester une variante, rotation fixe, par quart de tour ou libre par 5°.
- **Langues** : 45 langues. L'application démarre dans la langue de l'appareil, changement dans ⚙ › Langue. Les textes sont dans `i18n.js`.
- **Panneaux** : la longueur est verticale et la largeur horizontale (panneau en portrait).
- **Origine** : le petit carré à 9 points choisit le zéro machine. Les pièces se regroupent à partir de ce point (coin, bord ou centre) et c'est le zéro des fichiers exportés.
- **Import** : plusieurs fichiers à la fois ; « + Ajouter des fichiers » complète le travail en cours.
- **Export** : fichiers en mm, zéro sur l'origine choisie, sans le contour du panneau.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html` | Page et mise en forme |
| `app.js` | Fonctionnement de l'application |
| `geo.js` | Lecture des fichiers, imbrication, export DXF |
| `i18n.js` | Traductions (45 langues) |
| `sw.js` | Hors connexion et mises à jour |
| `manifest.webmanifest` | Nom, icônes, installation |
| `icons/`, `fonts/` | Icônes et polices (Barlow, IBM Plex Mono — licence OFL) |
| `vendor/pdfjs/` | Lecteur PDF/AI de Mozilla (licence Apache 2.0) |

## Licence

Nestor est distribué sous la licence **PolyForm Perimeter 1.0.1** (fichier `LICENSE`).
Tout le monde peut l'utiliser gratuitement, y compris au travail, lire le code et le modifier pour son propre usage. Personne ne peut proposer à d'autres un produit qui fait concurrence à Nestor (revente, service payant, copie rebaptisée), même gratuit.
Le nom « Nestor » et les logos sont réservés (fichier `TRADEMARK.md`).
PDF.js reste sous licence Apache 2.0 et les polices sous licence OFL 1.1.
