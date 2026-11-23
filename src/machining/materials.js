/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Familles de matières pour le fraisage et liste des matières précises.
   Chaque matière précise est rangée dans une famille : c'est la famille qui donne les réglages.
   Sources : id-conception.fr (copeau et passe selon le diamètre de la fraise), cncfraises.fr (vitesse de coupe),
   classes de dureté Brinell des bois (A : 10 à 20 N/mm², B : 20 à 30, C : 30 à 40, D : plus de 40). */

/* Réglages de chaque famille, du plus tendre au plus dur.
   chipDivisor : copeau par dent = diamètre / diviseur.
   depthFactor : profondeur de passe = diamètre × facteur.
   cuttingSpeed : vitesse de coupe visée (m/min), qui donne la rotation de la broche. */
export const FAMILIES = [
  { id: "verySoft", chipDivisor: 25, depthFactor: 2, cuttingSpeed: 400 },
  { id: "soft", chipDivisor: 75, depthFactor: 1, cuttingSpeed: 350 },
  { id: "medium", chipDivisor: 100, depthFactor: 0.5, cuttingSpeed: 300 },
  { id: "hard", chipDivisor: 200, depthFactor: 0.2, cuttingSpeed: 200 }
];

/* Matières précises : famille, densité moyenne (kg/m³) et classe de dureté Brinell des bois massifs quand
   elles aident à comparer. melts : plastique qui fond si le copeau est trop fin (fraise 1 dent conseillée). */
export const MATERIALS = [
  { id: "foam", family: "verySoft" },
  { id: "xps", family: "verySoft" },
  { id: "balsa", family: "verySoft", density: 150 },
  { id: "cork", family: "verySoft", density: 200 },
  { id: "modelingBoard", family: "verySoft" },
  { id: "wax", family: "verySoft" },

  { id: "mdf", family: "soft" },
  { id: "chipboard", family: "soft" },
  { id: "osb", family: "soft" },
  { id: "plyPoplar", family: "soft", density: 450 },
  { id: "plyOkoume", family: "soft", density: 500 },
  { id: "plyPine", family: "soft", density: 550 },
  { id: "spruce", family: "soft", density: 450, hardness: "A" },
  { id: "pine", family: "soft", density: 520, hardness: "A" },
  { id: "cedar", family: "soft", density: 380, hardness: "A" },
  { id: "poplar", family: "soft", density: 450, hardness: "A" },
  { id: "alder", family: "soft", density: 530, hardness: "A" },
  { id: "lime", family: "soft", density: 530, hardness: "A" },
  { id: "pmma", family: "soft", melts: true },
  { id: "pvcFoam", family: "soft", melts: true },
  { id: "hdpe", family: "soft", melts: true },
  { id: "pp", family: "soft", melts: true },
  { id: "abs", family: "soft", melts: true },
  { id: "acm", family: "soft", melts: true },

  { id: "plyBirch", family: "medium", density: 700 },
  { id: "plyFilm", family: "medium" },
  { id: "bamboo", family: "medium", density: 700 },
  { id: "douglas", family: "medium", density: 530, hardness: "B" },
  { id: "larch", family: "medium", density: 600, hardness: "B" },
  { id: "chestnut", family: "medium", density: 590, hardness: "B" },
  { id: "sipo", family: "medium", density: 640, hardness: "B" },
  { id: "teak", family: "medium", density: 650, hardness: "B" },
  { id: "walnut", family: "medium", density: 650, hardness: "B" },
  { id: "cherry", family: "medium", density: 600, hardness: "B" },
  { id: "beech", family: "medium", density: 710, hardness: "C" },
  { id: "oak", family: "medium", density: 700, hardness: "C" },
  { id: "ash", family: "medium", density: 690, hardness: "C" },
  { id: "maple", family: "medium", density: 650, hardness: "C" },
  { id: "robinia", family: "medium", density: 750, hardness: "D" },
  { id: "olive", family: "medium", density: 900, hardness: "D" },
  { id: "exotic", family: "medium", density: 950, hardness: "D" },
  { id: "hpl", family: "medium" },
  { id: "pomPc", family: "medium" },
  { id: "nylon", family: "medium" },
  { id: "solidSurface", family: "medium" },
  { id: "fiberglass", family: "medium" },

  { id: "aluminium", family: "hard" },
  { id: "brass", family: "hard" },
  { id: "copper", family: "hard" }
];

export function familyById(id) {
  return (
    FAMILIES.find(function (family) {
      return family.id === id;
    }) || null
  );
}

export function materialById(id) {
  return (
    MATERIALS.find(function (material) {
      return material.id === id;
    }) || null
  );
}
