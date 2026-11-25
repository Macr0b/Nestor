# Nestor — application installable

Imbrication de pièces DXF, SVG, AI, PDF, LightBurn, VectorCraft et HPGL sur des panneaux, avec export SVG et DXF.
Fonctionne hors connexion, en 45 langues, sur Mac, Windows, Linux, iPhone, iPad et Android.

Version : 1.10.4

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

- **Utilisation** : nom, fichier (DXF, SVG ou AI), réglages, export. Tes derniers réglages de panneaux (tailles, stock, espacement, marge, méthode) sont mémorisés sur chaque appareil ; un projet complet s'enregistre avec le bouton « Projet ».
- **Fichiers AI** : enregistrer depuis Illustrator avec l'option « Créer un fichier compatible PDF » (activée par défaut).
- **Formats lus** : DXF, SVG et SVGZ (Illustrator, Inkscape…), AI, PDF, LightBurn (.lbrn, .lbrn2), VectorCraft (.vectorcraft), HPGL (.plt, .hpgl). Les noms des tracés deviennent les noms des pièces, les calques sont affichés et conservés à l'export. Pour un fichier AI, les noms donnés aux tracés dans le panneau Calques d'Illustrator sont lus dans les données internes du fichier (la partie PDF ne les garde pas), et repris seulement si leurs tracés correspondent un à un à ceux du dessin.
- **Pièces** : échelle en % ou cote en mm pour chaque pièce, duplication pour tester une variante, rotation fixe, par quart de tour ou libre par 5°.
- **Langues** : 45 langues. L'application démarre dans la langue de l'appareil, changement dans ⚙ › Langue. Les textes sont dans `src/i18n/locales/`, un fichier par langue ; seule la langue utilisée est chargée.
- **Panneaux** : la longueur est verticale et la largeur horizontale (panneau en portrait). Dès qu'il y a plusieurs lignes, elles sont numérotées ; la petite flèche à côté du numéro ouvre un champ pour nommer la ligne (« Chute CP 18 »), repris dans le titre des panneaux du plan et dans « Remplir ». La matière choisie (dans n'importe quel onglet) met son format sur une ligne marquée « Format de la matière », qui la suit ; si sa taille est changée à la main, la ligne la garde (« taille changée à la main », prix au prorata), même quand la matière est choisie de nouveau, et « Remettre le format » la lui rend. « Ajouter une chute » place une chute devant elle (stock 1, gratuite sauf prix saisi), puisque les panneaux sont utilisés dans l'ordre de la liste ; « Ajouter un panneau acheté » ajoute après elle un panneau de la même matière, payé comme elle. Chaque ligne le dit sous elle. Une pièce qui ne rentre pas est marquée en rouge dans la liste des pièces, avec la raison (trop grande pour la zone utile, ou pas assez de panneaux en stock), et le message rouge du résultat mène à elle.
- **Origine** : le petit carré à 9 points choisit le zéro machine. Les pièces se regroupent à partir de ce point (coin, bord ou centre) et c'est le zéro des fichiers exportés.
- **Import** : plusieurs fichiers à la fois ; « + Ajouter des fichiers » complète le travail en cours. Chaque contour fermé extérieur est une pièce ; les traits qui sont dedans (gravure, trous) partent avec elle. Quand des pièces s'emboîtent (leurs cadres se chevauchent), un trait va à la pièce dont le contour le contient vraiment, même s'il déborde un peu du cadre.
- **Saisir à la main** : pièces rectangulaires (nom, longueur, largeur, quantité, sens fixe), une par une ou collées depuis un tableur (colonnes nom, longueur, largeur, quantité). Elles rejoignent la liste des pièces, restent quand on importe un fichier ensuite, et sont gardées dans les projets.
- **Cadenas** : chaque panneau du plan a un bouton « Figer ». Ses pièces ne bougent plus ; les nouvelles pièces (un fichier ajouté, une quantité en plus) vont d'abord dans ses trous (méthode Rectangles : seulement dans l'espace qu'on peut atteindre à la scie), puis sur d'autres panneaux. Les panneaux figés passent en tête du plan ; tant qu'il y en a, l'espace, la marge et la taille de leurs lignes de panneau sont grisés. Les pièces posées ensuite dans les trous d'un panneau figé ont un contour en pointillés ; « Figer les N ajouts » fige de nouveau le panneau avec elles. Changer une pièce figée (quantité en dessous du nombre figé, taille, retrait) demande d'abord de déverrouiller. Les cadenas sont gardés dans le projet.
- **Rotation** : pour chaque pièce, « Sens fixe » (demi-tour seulement), « Quart de tour », « Libre (5°) » ou « Libre (1°) » (tous les angles de 1 en 1, plus précis et plus lent). En sens fixe, ↺ et ↻ pivotent la pièce d'un quart de tour : le dessin tourne pour de bon (taille, vignette, exports) et l'angle s'affiche à côté ; il est gardé dans le projet.
- **Groupes** (appelés « kits » jusqu'à la 1.10.0) : un groupe, ce sont les pièces d'un même objet (les pans d'une boîte). Sur chaque pièce, la liste « Aucun groupe » la range dans un groupe ou en crée un (« + Nouveau groupe ») ; sa quantité devient alors la quantité par groupe. Il peut y avoir plusieurs groupes, chacun avec son nom, dans le bloc Groupes au-dessus de la liste : chacun pose un seul groupe, un nombre de groupes choisi (« Nombre de groupes », de 1 à 5000, posés avec les autres pièces sur autant de panneaux qu'il faut ; s'il manque de la place, le bloc dit combien de groupes sont complets), ou remplit (« Remplir au maximum ») le dernier panneau d'une ligne, tous ses panneaux ou un nouveau avec le plus possible de groupes entiers (jamais un groupe à moitié ; la place restante reste libre), et affiche le nombre de groupes complets. Les groupes sont posés dans l'ordre du bloc. Ordre du calcul : panneaux figés, pièces normales et groupes en nombre, groupes en « Remplir au maximum », puis pièces en « Remplir ». Dans le code et les fichiers de projet, un groupe s'appelle toujours `kit`.
- **Remplir** : à côté de la quantité d'une pièce, « Nombre fixe » ou « Remplir au maximum » ; ce second choix demande la ligne de panneau (son numéro ou son nom, seulement s'il y a plusieurs lignes) et une façon : le dernier panneau du plan, tous les panneaux, ou un nouveau panneau de cette ligne (aussi quand la ligne n'est pas encore utilisée, s'il reste du stock). Les autres pièces sont placées d'abord, puis cette pièce occupe tout ce qui reste ; le nombre posé s'affiche sous la ligne. Le réglage suit la ligne de panneau quand elle monte ; si la ligne est retirée, la pièce revient à un nombre fixe.
- **Export** : fichiers en mm, zéro sur le repère de placement choisi. « Tout le plan en DXF » télécharge un DXF par panneau d'un coup. En option (sous « Méthode ») : le contour du panneau sur un calque « Panneau », le numéro de chaque pièce à graver sur un calque « Numéros » (trait simple, placé dans la matière de la pièce), et son nom dessous, plus petit, sur le même calque (capitales sans accents, police au trait de A à Z ; s'il ne tient pas, le numéro seul ; un nom sans lettre latine n'est pas gravé). Dans le PDF, en option, le nom du calque d'origine s'écrit sous le numéro de chaque pièce.
- **PDF à imprimer** : sous chaque panneau, son plan numéroté avec ses cotes, le zéro machine et la liste de ses pièces ; « Tout le plan en PDF » ajoute une page de résumé. A4 en métrique, Letter en impérial.
- **Espace et marge minimaux d'après la fraise** : sous l'espace entre pièces et la marge au bord, deux liens reprennent la fraise de l'onglet Fraisage : espace minimal 2 × Ø + 1 mm (la fraise passe deux fois entre deux pièces), marge minimale Ø + 1 mm (une fois au bord).
- **Coupes de chutes** (option sous « Méthode ») : traits droits pour récupérer les chutes à la scie, à la même distance des pièces que l'espace entre pièces. « Simples » : d'un bord à l'autre du panneau. « Détaillées » : la découpe suit à peu près le contour du groupe de pièces. Les traits sont exportés sur un calque « Coupes ». Aucun trait parallèle au bord ne tombe dans la marge.
- **Ordre des coupes à la scie** (option de la méthode Rectangles) : coupes numérotées sur le panneau, d'un bord à l'autre du morceau coupé, avec leur liste (sens, cote depuis le bord gauche ou haut, morceau coupé) sous le panneau et dans le PDF. Les bords de marge sont délignés d'abord, les grandes chutes (avant ou après les pièces) partent d'un seul trait sans être recoupées, et l'épaisseur de lame (par défaut l'espace entre pièces) est retirée après chaque coupe. « Premières coupes » : au mieux (selon la forme de chaque morceau), dans la longueur d'abord, ou dans la largeur d'abord. Les numéros se placent là où ils ne cachent ni les pièces ni les autres numéros.
- **Onglet Fraisage** : rotation de la broche, avance, passe maximale et passes à faire (l'épaisseur répartie en passes égales, chacune sous la passe maximale, avec le calcul écrit en clair) selon la fraise (type, diamètre, nombre de dents), la matière (quatre familles, ou une matière précise : essences de bois, contreplaqués, plastiques, métaux) et les limites de la machine (vitesses mini et maxi de ta broche : préremplies à 6 000 – 24 000 tr/min, la plage la plus courante, avec une aide pour trouver les tiennes ; la vitesse conseillée reste toujours dedans). Valeurs de départ prudentes, d'après les méthodes d'id-conception.fr et de cncfraises.fr : copeau par dent le plus fin de la fourchette d'id-conception.fr (très tendre Ø/25, tendre Ø/100, intermédiaire Ø/150, dur Ø/250 ; plastique qui fond Ø/50), rotation tirée de la vitesse de coupe de la famille. Les réglages sont mémorisés.
- **Onglet Laser** : tes machines (plusieurs puissances possibles), et pour chacune un point de départ par matière et épaisseur, tiré des livrets de paramètres publiés par Trotec (60, 80 et 120 W), du tableau de Thunder Laser (contreplaqué bouleau, carton, cuir, papier, placage, tissu ; 40 à 130 W) et du tableau de GWK Laser (bois tendre et contreplaqué courant, MDF, acrylique ; 40 à 150 W) ; autre puissance ou autre épaisseur : estimation signalée. Ce sont des valeurs indicatives : « Modifier ces valeurs » enregistre les tiennes pour la machine, et « ＋ Nouvelle matière » ajoute tes propres matières. Au-delà de 10 mm, le laser ne sert qu'à graver. Vitesse en % pour une Trotec, en mm/s pour les autres. Grille de test (16 carrés puissance × vitesse) en SVG ou DXF.
- **Onglet Carnet** : tes réglages éprouvés (fraisage, laser, autre) avec machine, matière, épaisseur, valeurs utilisées, note et état (validé / à revoir). Recherche, filtre par procédé et par machine, « Garder dans le carnet » depuis Fraisage et Laser, « Ouvrir dans Fraisage », sauvegarde et import d'un fichier.
- **Onglet Coût** : prix de revient du plan d'après les panneaux utilisés : matière, chute (dernier panneau compté entier ou seulement la partie utilisée ; une chute ajoutée dans les panneaux compte 0 sauf prix saisi ; un prix saisi suit la ligne quand sa taille change), machine (taux horaire machine × temps de découpe estimé), main-d'œuvre (taux horaire main-d'œuvre × temps de préparation), avec pour chacun l'option de compter toute heure commencée, et coût par pièce, réparti selon la surface. C'est une estimation.
- **Onglet Matières** : bibliothèque de tes panneaux habituels avec leur prix (nom, matière pour le fraisage ou, pour une matière à soi, seulement sa dureté parmi les quatre familles du fraisage, épaisseur, taille, prix). « Profil » → « Mes matières » les liste aussi, pour les modifier (le formulaire s'ouvre dans l'onglet Matières) ou les supprimer (second clic). La matière choisie pour le projet est la même partout : dans Imbrication elle remplit la taille du panneau, dans Fraisage elle règle la matière et l'épaisseur, dans Coût elle donne le prix. Sauvegarde et import d'un fichier.
- **Guide** : bouton « Guide » en haut. 16 fiches courtes rangées en 4 catégories (Démarrer, Imbrication, Machines, Projet), chacune en étapes numérotées avec un « Bon à savoir », une recherche (sans accents ni majuscules), « Me montrer dans l'appli », qui ouvre le bon onglet et désigne le bloc concerné, et en bas de chaque fiche la précédente et la suivante (aussi avec les flèches ← → du clavier). La catégorie affiche la position de la fiche (« 4 / 12 »). Le « ? » à côté du titre d'un bloc ouvre sa fiche. Les fiches sont listées dans `src/guide/topics.js`, leurs textes dans les fichiers de langue (`guide.<fiche>.title`, `.intro`, `.s1`…, `.tip`).
- **Projet** : bouton « Projet » en haut, pour le projet en cours seulement (Enregistrer, copie, nouveau, exporter, importer) ; une ligne dit où « Enregistrer » écrit. La liste des projets est dans « Profil » → « Mes projets » (Ctrl+O l'ouvre). Enregistre tout le projet (fichiers importés, pièces, panneaux, options d'export, matière, réglages de fraisage, de laser et de coût) à l'un de deux endroits, au choix par deux onglets : « Mon dossier », un dossier choisi par l'usager (clé USB, iCloud Drive, Dropbox, Nextcloud…) où chaque projet est un fichier `.nestor` à son nom (« Enregistrer une copie » en fait un deuxième, « Boîte (2).nestor »), ou « Ce navigateur ». Le dossier est retenu dans le navigateur, qui redemande l'autorisation d'y écrire à chaque visite ; une clé débranchée est signalée sans rien casser, et « Oublier ce dossier » n'efface aucun fichier. Le choix d'un dossier existe dans Chrome et Edge sur ordinateur ; ailleurs, « Exporter le fichier » et « Importer un fichier » font le même travail.
- **Mon profil** : bouton « Profil » en haut, entre « Guide » et « Projet ». La fenêtre réunit « Mes projets », « Mes matières » et « Sauvegarde du profil ». Le profil met en un seul fichier `.nestorprofil` tout ce qui est rangé dans ce navigateur : projets de « Ce navigateur » et projet en cours pas encore enregistré, matières, carnet, réglages laser (machines, matières laser), fraisage, coût, unités, thème, langue, choix du compteur. Le premier « Enregistrer mon profil » fait choisir un dossier de sauvegarde (la fenêtre s'ouvre sur celui des projets s'il y en a un), que Nestor retient (« Changer » en choisit un autre). Le dossier garde 3 fichiers : `Profil Nestor.nestorprofil` (le plus récent, celui qu'on charge sur un autre ordinateur), `Profil Nestor (sauvegarde 2)` et `(sauvegarde 3)` ; à chaque sauvegarde, ils tournent et le plus ancien disparaît, mais rien n'est écrit si rien n'a changé (empreinte gardée d'une visite à l'autre). « Sauvegarde automatique toutes les 5 minutes », cochée par défaut ; à chaque visite, le navigateur redemande l'accès au dossier (bouton « Autoriser la sauvegarde »). « Charger un profil » montre d'abord ce qu'il contient, puis « Ajouter à ce que j'ai » (matières, carnet, machines et matières laser mêlés par identifiant, autres réglages gardés) ou « Tout remplacer » (second clic) ; les projets du profil s'ajoutent toujours, jamais d'effacement, pas de doublon ; l'appli se recharge pour tout relire. Un profil plus récent trouvé dans le dossier des projets ou des sauvegardes est proposé (« Profil trouvé »), avec « Continuer à sauvegarder mon profil » dans ce dossier. Le dossier de sauvegarde est affiché au-dessus du bouton, avant d'enregistrer. Safari, Firefox, téléphone : le profil est téléchargé, daté, sans sauvegarde automatique, et un avis bien visible le dit (avec le réglage de Safari pour choisir où chaque téléchargement va). Chaque réglage est vérifié comme à l'ordinaire, chaque projet comme un projet importé ; un fichier qui n'est pas un profil est refusé sans rien changer.
- **Blocs repliables** : la flèche à gauche du titre d'un bloc (ou un clic sur le titre) le replie sur une ligne de résumé (nom du projet, fichiers, lignes de panneaux, nombre de pièces) ; Alt + clic replie ou déplie tous les blocs de l'onglet. L'état est mémorisé sur l'appareil.
- **Compteur d'exports** : à chaque fichier exporté depuis le site officiel, Nestor envoie un message anonyme de trois informations (« un export », le format, le numéro de version) à `stats.nestor.rophistudio.fr`, qui ajoute 1 à un total par jour, format et version. Ni cookie, ni identifiant, ni adresse IP gardée, ni contenu du projet. Case « Compter mes exports, anonymement » dans les Réglages pour l'arrêter ; rien n'est envoyé depuis une copie de l'appli ni depuis la version Claude. Le serveur est dans `stats/` (voir `stats/LISEZMOI.md`).
- **Raccourcis clavier** : Ctrl (⌘ sur Mac) + Entrée recalcule, + S enregistre, + O ouvre un projet, + I importe des pièces, + P donne le PDF du plan ; Alt + 1 à 6 change d'onglet ; « ? » montre la liste. Les fenêtres (Projet, Profil, Réglages, Raccourcis) gardent le clavier : Tab tourne à l'intérieur, Échap ferme et rend le focus au bouton qui les a ouvertes.
- **Unités** : métrique par défaut, ou pouces décimaux ou en fractions (Réglages). Les tailles ne changent jamais ; en pouces, les fichiers exportés sont aussi en pouces.

## Contenu du dossier

| Dossier ou fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `css/` | Mise en forme : polices, couleurs (thèmes clair et sombre), décor « plan technique », interface, réglages, onglets, fraisage, laser, carnet, coût, projets, raccourcis, guide |
| `src/main.js` | Point d'entrée : branche chaque partie de l'interface puis démarre |
| `src/version.js` | Numéro de version |
| `src/i18n/` | Langue de l'interface ; `languages.js` (liste des langues) et `locales/` (un fichier de textes par langue) |
| `src/project/` | Projet en cours, exemple du premier lancement, pièces, pièces saisies à la main, kits, réglages mémorisés, projets enregistrés (photo vérifiée, base du navigateur, dossier choisi), profil Nestor |
| `src/stats/` | Compteur anonyme des exports (côté appli) |
| `src/guide/` | Liste des fiches du guide : catégories, icône, nombre d'étapes et bloc à montrer dans l'appli |
| `src/geometry/` | Géométrie : tracés SVG, polylignes, regroupement en pièces, pièces placées, emplacement du numéro dans une pièce |
| `src/text/` | Police au trait simple pour les numéros gravés et la grille de test |
| `src/import/` | Un lecteur par format (DXF, SVG + nettoyage, PDF / AI, LightBurn, HPGL, VectorCraft) et la lecture des fichiers |
| `src/placement/` | Imbrication selon la forme, rectangles, origine du panneau, calcul en arrière-plan |
| `src/notebook/` | Carnet de réglages : fiches vérifiées, recherche, sauvegarde et import |
| `src/library/` | Bibliothèque de matières (prix des panneaux, matière du projet) et calcul du prix de revient |
| `src/machining/` | Calcul des réglages de fraisage, familles et liste des matières, réglages mémorisés |
| `src/laser/` | Livrets Trotec, tableaux Thunder Laser et GWK, point de départ laser par machine, tes matières et tes valeurs, machines mémorisées, grille de test |
| `src/export/` | Fichiers exportés (SVG, DXF, PDF), contour du panneau, coupes de chutes, ordre des coupes à la scie, numéros gravés |
| `src/ui/` | Chaque partie de l'interface : onglets, fichiers, pièces, panneaux, résultat, pages du PDF, fraisage, laser, carnet, coût, matières, projets, raccourcis, guide, réglages, installation, mises à jour |
| `sw.js` | Hors connexion et mises à jour (liste de tous les fichiers à garder en cache) |
| `manifest.webmanifest` | Nom, icônes, installation, formats ouverts par l'appli |
| `icons/`, `fonts/` | Icônes et polices (Barlow, IBM Plex Mono — licence OFL) |
| `vendor/pdfjs/` | Lecteur PDF/AI de Mozilla, pdf.js 6.5.438 version « legacy » (licence Apache 2.0) |
| `vendor/fzstd/` | Décodeur ZStandard fzstd 0.1.1 (licence MIT), pour lire les noms des tracés dans les données internes des .ai |
| `tests/` | Tests automatiques, rangés comme `src/`, relancés par GitHub à chaque mise à jour |
| `tools/build-claude.mjs` | Fabrique la version Claude (une seule page) à partir de l'appli |
| `stats/` | Serveur du compteur d'exports (Cloudflare Worker et base D1), à déployer à part |

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
