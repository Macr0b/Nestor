/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Calcul des réglages de fraisage : rotation de la broche, avance, profondeur et nombre de passes.
   Méthode :
     rotation = 1000 × vitesse de coupe / (π × diamètre), ramenée dans les limites de la broche ;
     avance = rotation × nombre de dents × copeau par dent (copeau = diamètre / diviseur de la famille) ;
     profondeur = diamètre × facteur de la famille, puis passes égales sur l'épaisseur à couper.
   Le copeau par dent est toujours gardé en priorité (trop fin, la fraise frotte et chauffe) :
     - si la broche limite la rotation, l'avance suit la rotation ;
     - si la machine n'avance pas assez vite, la rotation baisse (jusqu'au minimum de la broche). */

import { familyById, materialById } from "./materials.js";

export const TOOL_TYPES = ["upcut", "downcut", "compression", "straight", "single", "roughing", "vbit"];

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
  thickness: 18,
  // fraise conique (gravure en V) : angle de la pointe et profondeur de gravure
  angle: 90,
  engraveDepth: 1
};

/* Fraise conique : largeur de coupe à une profondeur donnée, limitée au diamètre de la fraise.
   largeur = 2 × profondeur × tan(angle / 2). Retour : { width, capped } ou null si l'angle ou la profondeur manquent. */
export function vBitCutWidth(diameter, angle, depth) {
  if (!positive(angle) || angle >= 180 || !positive(depth)) return null;
  // arrondi au millionième de mm : tan(45°) donne 0,999… en calcul flottant
  const width = Math.round(2 * depth * Math.tan((angle * Math.PI) / 360) * 1e6) / 1e6;
  return width > diameter ? { width: diameter, capped: true } : { width, capped: false };
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

function positive(value) {
  return typeof value === "number" && isFinite(value) && value > 0;
}

/* Réglages conseillés, ou null si le diamètre ou le nombre de dents manquent.
   Retour : { rpm, feed (mm/min), chipLoad, chipDivisor, depthFactor, depth, passes, passDepth, notes }
   Fraise conique : le calcul se fait sur la largeur qui coupe à la profondeur de gravure (cutWidth), en une passe.
   notes : liste de { key, n, d, e } à traduire (limite de la broche, plastique qui fond, type de fraise). */
export function millingSettings(input) {
  const flutes = Math.round(input.flutes);
  if (!positive(input.diameter) || !(flutes >= 1)) return null;
  const material = materialById(input.material);
  const family = familyById(material ? material.family : input.family) || familyById("medium");
  const notes = [];
  const isVBit = input.toolType === "vbit";
  let diameter = input.diameter;
  let cutWidth = 0;
  if (isVBit) {
    const cut = vBitCutWidth(input.diameter, input.angle, input.engraveDepth);
    if (!cut) return null;
    cutWidth = diameter = cut.width;
    notes.push(
      cut.capped
        ? { key: "mill.noteVBitDeep", d: cut.width }
        : { key: "mill.noteVBit", e: input.engraveDepth, d: cut.width }
    );
  }

  // un plastique qui fond garde un gros copeau (id-conception : diamètre / 50)
  const chipDivisor = material && material.melts ? 50 : family.chipDivisor;
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

  const depthFactor = family.depthFactor;
  let depth = diameter * depthFactor;
  let passes = 0,
    passDepth = 0;
  if (isVBit) {
    // gravure : une seule passe, à la profondeur demandée
    depth = passDepth = input.engraveDepth;
    passes = 1;
  } else if (positive(input.thickness)) {
    passes = Math.max(1, Math.ceil(input.thickness / depth - 1e-9));
    passDepth = input.thickness / passes;
  }

  if (material && material.melts && flutes > 1) notes.push({ key: "mill.noteMelt" });
  if (input.toolType === "downcut") notes.push({ key: "mill.noteDowncut" });
  if (input.toolType === "compression") notes.push({ key: "mill.noteCompression" });

  return { rpm, feed, chipLoad, chipDivisor, depthFactor, depth, passes, passDepth, cutWidth, notes };
}
