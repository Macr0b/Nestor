/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Numéro de chaque pièce placée : son emplacement dans la matière (aperçu, PDF) et ses traits à graver
   (option d'export), sur un calque à part. */

import { labelHeight, labelSpot } from "../geometry/label-spot.js";
import { translate } from "../i18n/i18n.js";
import { sheetPartPaths } from "../placement/origin.js";
import { strokeText } from "../text/stroke-font.js";

// hauteur des chiffres gravés, en mm : assez grands pour se lire, sans perdre de temps à graver
export const NUMBER_MIN_HEIGHT = 2;
export const NUMBER_MAX_HEIGHT = 10;
const NUMBER_COLOR = "#ff00ff";

// le résultat d'un calcul ne change plus : on garde l'emplacement trouvé pour chaque pièce placée
const spots = new WeakMap();

export function partNumberText(placed) {
  return String(placed.i + 1);
}

/* Emplacement du numéro : { x, y, radius } dans la matière de la pièce, ou null. */
export function partNumberSpot(placed, sheet) {
  if (!spots.has(placed)) spots.set(placed, labelSpot(sheetPartPaths(placed, sheet)));
  return spots.get(placed);
}

/* Traits à graver pour le numéro d'une pièce (vide si la pièce est trop petite pour un numéro lisible). */
export function partNumberPaths(placed, sheet) {
  var spot = partNumberSpot(placed, sheet),
    text = partNumberText(placed);
  if (!spot) return [];
  var height = labelHeight(text, spot.radius, NUMBER_MIN_HEIGHT, NUMBER_MAX_HEIGHT);
  if (!height) return [];
  return strokeText(text, spot.x, spot.y, height).map(function (pts) {
    return { pts: pts, closed: false, layer: translate("dl.numLayer"), color: NUMBER_COLOR };
  });
}
