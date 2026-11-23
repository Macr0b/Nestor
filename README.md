# Nestor

Imbrication de pièces DXF, SVG et AI sur panneaux, pour la découpe laser, la CNC et la scie.
Export SVG et DXF, onglet Fraisage (vitesse de broche, avance, profondeur de passe), fonctionne hors connexion, en 45 langues.

Nesting of DXF, SVG and AI parts on sheets for laser, CNC and saw cutting.
SVG and DXF export, Milling tab (spindle speed, feed rate, depth of cut), works offline, 45 languages.

**Application : https://macr0b.github.io/Nestor/**

Installation, mise en ligne et mises à jour : voir [LISEZMOI.md](LISEZMOI.md).

## Code

Modules JavaScript standard, sans étape de fabrication : `src/` (un dossier par domaine : `import/`, `placement/`,
`machining/`, `export/`, `geometry/`, `ui/`, `i18n/`…), styles dans `css/`, tests rangés de la même façon dans `tests/`.
`npm test` lance tous les tests, `npm run format` met le code en forme. Détails : [LISEZMOI.md](LISEZMOI.md).

Plain JavaScript modules, no build step: `src/` (one folder per area: `import/`, `placement/`, `export/`,
`geometry/`, `ui/`, `i18n/`…), styles in `css/`, tests mirrored in `tests/`. `npm test` runs all tests,
`npm run format` formats the code.

## Licence / License

Copyright 2026 Robin Philippe (Macr0b)

Nestor est distribué sous la licence **PolyForm Perimeter 1.0.1**, voir [LICENSE](LICENSE).
Tout le monde peut l'utiliser gratuitement, y compris pour un travail professionnel, lire le code et le modifier pour son propre usage. Il est interdit de proposer à d'autres un produit qui fait concurrence à Nestor (revente, service payant, copie rebaptisée…), même gratuit.
Les versions 1.0.0 à 1.1.2 ont été publiées sous AGPL-3.0-or-later et le restent.
Le nom « Nestor » et ses logos ne sont pas couverts par la licence : voir [TRADEMARK.md](TRADEMARK.md).
**Licence commerciale** : pour faire ce que la licence ne permet pas (une version à vos couleurs ou à votre nom, Nestor livré avec une machine, intégré à un autre logiciel…), une licence payante peut être accordée au cas par cas. Pour en parler : [ouvrir une demande sur GitHub](https://github.com/Macr0b/Nestor/issues/new?title=Licence%20commerciale) (une adresse e-mail viendra).

Nestor is distributed under the **PolyForm Perimeter License 1.0.1**, see [LICENSE](LICENSE).
Anyone may use it for free, including for professional work, read the code and modify it for their own use. Providing to others any product that competes with Nestor (resale, paid service, renamed copy…) is not allowed, even free of charge.
Versions 1.0.0 to 1.1.2 were released under AGPL-3.0-or-later and remain so.
The "Nestor" name and logos are not covered by the license: see [TRADEMARK.md](TRADEMARK.md).
**Commercial license**: to do what the license does not allow (a version in your colors or under your name, Nestor shipped with a machine, built into another product…), a paid license can be granted case by case. To discuss it: [open a request on GitHub](https://github.com/Macr0b/Nestor/issues/new?title=Commercial%20license) (an e-mail address will follow).

Composants tiers / Third-party components:
- `vendor/pdfjs/` — PDF.js 6.5.438 (legacy build), Mozilla, Apache License 2.0 (`vendor/pdfjs/LICENSE`)
- `fonts/` — Barlow, Barlow Condensed, IBM Plex Mono, SIL Open Font License 1.1 (`fonts/OFL-*.txt`)
