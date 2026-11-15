/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Calcul des réglages de fraisage : rotation de la broche, avance, profondeur et nombre de passes.
   Méthode :
     rotation = 1000 × vitesse de coupe / (π × diamètre), ramenée dans les limites de la broche ;
     avance = rotation × nombre de dents × copeau par dent (copeau = diamètre / diviseur de la famille) ;
     profondeur = diamètre × facteur de la famille, puis passes égales sur l'épaisseur à couper.
   Le copeau par dent est toujours gardé en priorité (trop fin, la fraise frotte et chauffe) :
     - si la broche limite la rotation, l'avance suit la rotation ;
     - si la machine n'avance pas assez vite, la rotation baisse (jusqu'au minimum de la broche). */

import { familyById, materialById } from "./materials.js";

export const TOOL_TYPES = ["upcut", "downcut", "compression", "straight", "single", "roughing"];

/* Valeurs de départ (fraise de 6 mm à 2 dents, broche de défonceuse courante). */
export const DEFAULT_MILLING = {
  toolType: "upcut",
  diameter: 6,
  flutes: 2,
  family: "medium",
  material: "",
  spindleMin: 6000,
  spindleMax: 24000,
  feedMax: 6000,
  finishing: false,
  thickness: 18
};

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

function positive(value) {
  return typeof value === "number" && isFinite(value) && value > 0;
}

/* Réglages conseillés, ou null si le diamètre ou le nombre de dents manquent.
   Retour : { rpm, feed (mm/min), chipLoad, chipDivisor, depthFactor, depth, passes, passDepth, notes }
   notes : liste de { key, n } à traduire (limite de la broche, plastique qui fond, type de fraise). */
export function millingSettings(input) {
  const diameter = input.diameter;
  const flutes = Math.round(input.flutes);
  if (!positive(diameter) || !(flutes >= 1)) return null;
  const material = materialById(input.material);
  const family = familyById(material ? material.family : input.family) || familyById("medium");
  const stage = input.finishing ? 1 : 0;
  const notes = [];

  // un plastique qui fond garde un gros copeau, même en finition (id-conception : diamètre / 50)
  const chipDivisor = material && material.melts ? 50 : family.chipDivisor[stage];
  const chipLoad = diameter / chipDivisor;

  let rpm = roundTo((1000 * family.cuttingSpeed) / (Math.PI * diameter), 100);
  if (positive(input.spindleMax) && rpm > input.spindleMax) {
    rpm = input.spindleMax;
    notes.push({ key: "mill.noteMax", n: input.spindleMax });
  } else if (positive(input.spindleMin) && rpm < input.spindleMin) {
    rpm = input.spindleMin;
    notes.push({ key: "mill.noteMin", n: input.spindleMin });
  }
  let feed = rpm * flutes * chipLoad;
  if (positive(input.feedMax) && feed > input.feedMax) {
    // la machine n'avance pas assez vite : on tourne moins vite pour garder le même copeau
    const slower = Math.floor(input.feedMax / (flutes * chipLoad) / 100) * 100;
    const floor = positive(input.spindleMin) ? input.spindleMin : 0;
    if (slower >= floor && slower > 0) {
      rpm = slower;
      feed = rpm * flutes * chipLoad;
      notes.push({ key: "mill.noteFeedMax", n: input.feedMax });
    } else {
      rpm = floor > 0 ? floor : rpm;
      feed = input.feedMax;
      notes.push({ key: "mill.noteThinChip", n: input.feedMax });
    }
  }
  feed = Math.max(10, Math.min(roundTo(feed, 10), positive(input.feedMax) ? input.feedMax : Infinity));

  const depthFactor = family.depthFactor[stage];
  const depth = diameter * depthFactor;
  let passes = 0,
    passDepth = 0;
  if (positive(input.thickness)) {
    passes = Math.max(1, Math.ceil(input.thickness / depth - 1e-9));
    passDepth = input.thickness / passes;
  }

  if (material && material.melts && flutes > 1) notes.push({ key: "mill.noteMelt" });
  if (input.toolType === "downcut") notes.push({ key: "mill.noteDowncut" });
  if (input.toolType === "compression") notes.push({ key: "mill.noteCompression" });

  return { rpm, feed, chipLoad, chipDivisor, depthFactor, depth, passes, passDepth, notes };
}
