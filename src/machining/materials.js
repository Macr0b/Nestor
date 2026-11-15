/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Familles de matières pour le fraisage et liste des matières précises.
   Chaque matière précise est rangée dans une famille : c'est la famille qui donne les réglages.
   Sources : id-conception.fr (copeau et passe selon le diamètre de la fraise), cncfraises.fr (vitesse de coupe),
   classes de dureté Brinell des bois (A : 10 à 20 N/mm², B : 20 à 30, C : 30 à 40, D : plus de 40). */

/* Réglages de chaque famille, du plus tendre au plus dur.
   chipDivisor : copeau par dent = diamètre / diviseur, [ébauche, finition].
   depthFactor : profondeur de passe = diamètre × facteur, [ébauche, finition].
   cuttingSpeed : vitesse de coupe visée (m/min), qui donne la rotation de la broche. */
export const FAMILIES = [
  { id: "verySoft", chipDivisor: [25, 40], depthFactor: [2, 1], cuttingSpeed: 400 },
  { id: "soft", chipDivisor: [75, 100], depthFactor: [1, 0.5], cuttingSpeed: 350 },
  { id: "medium", chipDivisor: [100, 150], depthFactor: [0.5, 0.25], cuttingSpeed: 300 },
  { id: "hard", chipDivisor: [200, 250], depthFactor: [0.2, 0.1], cuttingSpeed: 200 }
];

/* Matières précises : famille, densité moyenne (kg/m³) et classe de dureté Brinell des bois massifs quand
   elles aident à comparer. melts : plastique qui fond si le copeau est trop fin (fraise 1 dent conseillée). */
export const MATERIALS = [
  { id: "foam", family: "verySoft" },
  { id: "xps", family: "verySoft" },
  { id: "balsa", family: "verySoft", density: 150 },
  { id: "cork", family: "verySoft", density: 200 },

  { id: "mdf", family: "soft" },
  { id: "chipboard", family: "soft" },
  { id: "plyPoplar", family: "soft", density: 450 },
  { id: "plyOkoume", family: "soft", density: 500 },
  { id: "spruce", family: "soft", density: 450, hardness: "A" },
  { id: "pine", family: "soft", density: 520, hardness: "A" },
  { id: "pmma", family: "soft", melts: true },
  { id: "pvcFoam", family: "soft", melts: true },
  { id: "hdpe", family: "soft", melts: true },

  { id: "plyBirch", family: "medium", density: 700 },
  { id: "walnut", family: "medium", density: 650, hardness: "B" },
  { id: "cherry", family: "medium", density: 600, hardness: "B" },
  { id: "beech", family: "medium", density: 710, hardness: "C" },
  { id: "oak", family: "medium", density: 700, hardness: "C" },
  { id: "ash", family: "medium", density: 690, hardness: "C" },
  { id: "maple", family: "medium", density: 650, hardness: "C" },
  { id: "exotic", family: "medium", density: 950, hardness: "D" },
  { id: "hpl", family: "medium" },
  { id: "pomPc", family: "medium" },

  { id: "aluminium", family: "hard" },
  { id: "brass", family: "hard" }
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
