/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Valeurs de départ publiées par Trotec (« Book of Parameters », CO2, lentille 2 pouces, air assist, table
   grille aluminium), pour trois puissances. Puissance et vitesse en % de la machine, fréquence en Hz (découpe)
   ou PPI (gravure). Recopiées telles que publiées, sans correction : ce sont des points de départ à tester.
   Sources :
   - 60 W  : https://www.troteclaser.com/laser-parameter-files/Speedy400-60W-TroLase.pdf
   - 80 W  : https://www.troteclaser.com/laser-parameter-files/Speedy360-80W-TroLase.pdf
   - 120 W : https://www.troteclaser.com/laser-parameter-files/Speedy360-120W-TroLase.pdf */

// matières des livrets ; mill : matière correspondante de l'onglet Fraisage (lien avec la bibliothèque)
export const TROTEC_MATERIALS = [
  { id: "castAcrylic", mill: "pmma" },
  { id: "alder", mill: "alder" },
  { id: "cherry", mill: "cherry" },
  { id: "maple", mill: "maple" },
  { id: "oak", mill: "oak" },
  { id: "walnut", mill: "walnut" },
  { id: "laminate", mill: "" },
  { id: "thinLaminate", mill: "" },
  { id: "texturedLaminate", mill: "" }
];

/* Une ligne : [matière, opération, épaisseur (mm, 0 pour la gravure), puissance %, vitesse %, Hz ou PPI, Z-offset mm].
   op : "cut" découpe, "engrave" gravure (gravure de détail pour le bois), "engraveDark" gravure foncée (bois). */
function rows(list) {
  return list.map(function (r) {
    return { material: r[0], op: r[1], thickness: r[2], power: r[3], speed: r[4], frequency: r[5], zOffset: r[6] };
  });
}

// mode « Quality » des livrets (le bois massif n'a qu'un seul jeu de valeurs)
export const TROTEC_BOOKS = [
  {
    watts: 60,
    model: "Speedy 400",
    rows: rows([
      ["castAcrylic", "engrave", 0, 20, 20, 500, 0],
      ["castAcrylic", "cut", 3, 60, 0.2, 5000, 0],
      ["alder", "engrave", 0, 85, 50, 500, 0],
      ["alder", "engraveDark", 0, 90, 50, 500, 6],
      ["alder", "cut", 3, 100, 1, 1000, 0],
      ["alder", "cut", 5, 100, 0.8, 1000, 0],
      ["cherry", "engrave", 0, 70, 50, 500, 0],
      ["cherry", "engraveDark", 0, 85, 50, 500, 6],
      ["cherry", "cut", 3, 100, 0.8, 1000, 0],
      ["maple", "engrave", 0, 80, 50, 500, 0],
      ["maple", "engraveDark", 0, 90, 50, 500, 6],
      ["maple", "cut", 3, 100, 0.8, 1000, 0],
      ["oak", "engrave", 0, 80, 50, 500, 0],
      ["oak", "engraveDark", 0, 85, 50, 500, 6],
      ["oak", "cut", 3, 100, 0.2, 1000, 0],
      ["walnut", "engrave", 0, 80, 50, 500, 0],
      ["walnut", "engraveDark", 0, 90, 50, 500, 6],
      ["walnut", "cut", 3, 100, 0.6, 1000, 0],
      ["laminate", "engrave", 0, 75, 70, 600, 1],
      ["laminate", "cut", 0.8, 30, 1.2, 1000, 0],
      ["laminate", "cut", 1.6, 70, 1.2, 1000, 0],
      ["laminate", "cut", 3.2, 80, 0.5, 1000, -1.6],
      ["thinLaminate", "engrave", 0, 80, 80, 600, 1],
      ["thinLaminate", "cut", 0.5, 25, 1.5, 1000, 0],
      ["texturedLaminate", "engrave", 0, 100, 30, 600, 4],
      ["texturedLaminate", "cut", 1.6, 80, 0.8, 1000, 0],
      ["texturedLaminate", "cut", 3.2, 100, 0.6, 1000, 0]
    ])
  },
  {
    watts: 80,
    model: "Speedy 360",
    rows: rows([
      ["castAcrylic", "engrave", 0, 16, 20, 500, 0],
      ["castAcrylic", "cut", 3, 50, 0.2, 5000, 0],
      ["alder", "engrave", 0, 60, 50, 500, 0],
      ["alder", "engraveDark", 0, 65, 50, 500, 6],
      ["alder", "cut", 3, 100, 1.8, 1000, 0],
      ["alder", "cut", 5, 100, 1.2, 1000, 0],
      ["cherry", "engrave", 0, 50, 50, 500, 0],
      ["cherry", "engraveDark", 0, 60, 50, 500, 6],
      ["cherry", "cut", 3, 100, 1.2, 1000, 0],
      ["maple", "engrave", 0, 55, 50, 500, 0],
      ["maple", "engraveDark", 0, 65, 50, 500, 6],
      ["maple", "cut", 3, 100, 1.4, 1000, 0],
      ["oak", "engrave", 0, 55, 50, 500, 0],
      ["oak", "engraveDark", 0, 60, 50, 500, 6],
      ["oak", "cut", 3, 100, 0.4, 1000, 0],
      ["walnut", "engrave", 0, 50, 50, 500, 0],
      ["walnut", "engraveDark", 0, 60, 50, 500, 6],
      ["walnut", "cut", 3, 100, 0.8, 1000, 0],
      ["laminate", "engrave", 0, 65, 80, 600, 1],
      ["laminate", "cut", 0.8, 25, 1.2, 1000, 0],
      ["laminate", "cut", 1.6, 60, 1.2, 1000, 0],
      ["laminate", "cut", 3.2, 75, 0.8, 1000, -1.6],
      ["thinLaminate", "engrave", 0, 60, 80, 600, 1],
      ["thinLaminate", "cut", 0.5, 30, 1.5, 1000, 0],
      ["texturedLaminate", "engrave", 0, 90, 30, 600, 4],
      ["texturedLaminate", "cut", 1.6, 60, 0.8, 1000, 0],
      ["texturedLaminate", "cut", 3.2, 100, 0.8, 1000, 0]
    ])
  },
  {
    watts: 120,
    model: "Speedy 360",
    rows: rows([
      ["castAcrylic", "engrave", 0, 8, 20, 500, 0],
      ["castAcrylic", "cut", 3, 30, 0.2, 5000, 0],
      ["alder", "engrave", 0, 30, 50, 500, 0],
      ["alder", "engraveDark", 0, 35, 50, 500, 6],
      ["alder", "cut", 3, 50, 1, 1000, 0],
      ["alder", "cut", 5, 100, 1.6, 1000, 0],
      ["cherry", "engrave", 0, 25, 50, 500, 0],
      ["cherry", "engraveDark", 0, 35, 50, 500, 6],
      ["cherry", "cut", 3, 100, 1.4, 1000, 0],
      ["maple", "engrave", 0, 30, 50, 500, 0],
      ["maple", "engraveDark", 0, 35, 50, 500, 6],
      ["maple", "cut", 3, 50, 0.8, 1000, 0],
      ["oak", "engrave", 0, 35, 50, 500, 0],
      ["oak", "engraveDark", 0, 40, 50, 500, 6],
      ["oak", "cut", 3, 100, 0.6, 1000, 0],
      ["walnut", "engrave", 0, 35, 50, 500, 0],
      ["walnut", "engraveDark", 0, 45, 50, 500, 6],
      ["walnut", "cut", 3, 100, 1, 1000, 0],
      ["laminate", "engrave", 0, 40, 100, 600, 1],
      ["laminate", "cut", 0.8, 20, 1.8, 1000, 0],
      ["laminate", "cut", 1.6, 35, 1.2, 1000, 0],
      ["laminate", "cut", 3.2, 85, 1.2, 1000, -1.6],
      ["thinLaminate", "engrave", 0, 50, 100, 600, 1],
      ["thinLaminate", "cut", 0.5, 15, 2, 1000, 0],
      ["texturedLaminate", "engrave", 0, 50, 30, 600, 4],
      ["texturedLaminate", "cut", 1.6, 30, 0.8, 1000, 0],
      ["texturedLaminate", "cut", 3.2, 60, 0.8, 1000, 0]
    ])
  }
];
