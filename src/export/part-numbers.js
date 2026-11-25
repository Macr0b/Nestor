/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Numéro de chaque pièce placée : son emplacement dans la matière (aperçu, PDF) et ses traits à graver
   (option d'export), sur un calque à part ; le nom de la pièce peut se graver dessous, plus petit. */

import { labelSpot } from "../geometry/label-spot.js";
import { translate } from "../i18n/i18n.js";
import { sheetPartPaths } from "../placement/origin.js";
import { engravableText, strokeText, strokeTextWidth } from "../text/stroke-font.js";

// hauteur des chiffres gravés, en mm : assez grands pour se lire, sans perdre de temps à graver
export const NUMBER_MIN_HEIGHT = 2;
export const NUMBER_MAX_HEIGHT = 10;
const NUMBER_COLOR = "#ff00ff";
// nom gravé : plus petit que le numéro, jamais sous 1,5 mm (illisible) ; écart entre les deux lignes
export const NAME_MIN_HEIGHT = 1.5;
const NAME_RATIO = 0.6;
const LINE_GAP = 0.35;

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
  return partEngravePaths(placed, sheet, { number: true });
}

/* Traits à graver : le numéro (options.number) et/ou le nom (options.name, en capitales sans accents), le nom sous
   le numéro et plus petit. Trop petit pour les deux : le numéro seul ; trop petit même pour une ligne : rien. */
export function partEngravePaths(placed, sheet, options) {
  var spot = partNumberSpot(placed, sheet),
    name = engravableText(options.name || ""),
    lines = [];
  if (options.number) lines.push({ text: partNumberText(placed), k: 1, min: NUMBER_MIN_HEIGHT });
  if (name) lines.push({ text: name, k: lines.length ? NAME_RATIO : 1, min: NAME_MIN_HEIGHT });
  if (!spot || !lines.length) return [];
  var block = fitLines(lines, spot.radius);
  if (!block && lines.length > 1) block = fitLines(lines.slice(0, 1), spot.radius);
  if (!block) return [];
  var top = spot.y - block.height / 2,
    paths = [];
  block.lines.forEach(function (line) {
    var h = block.scale * line.k;
    strokeText(line.text, spot.x, top + h / 2, h).forEach(function (pts) {
      paths.push({ pts: pts, closed: false, layer: translate("dl.numLayer"), color: NUMBER_COLOR });
    });
    top += h + block.scale * LINE_GAP;
  });
  return paths;
}

// lignes tenant dans le cercle libre de la pièce : { lines, scale, height } (scale = hauteur d'une ligne de
// rapport 1), ou null si une ligne serait trop petite pour se lire
function fitLines(lines, radius) {
  var width = Math.max.apply(
      null,
      lines.map(function (line) {
        return strokeTextWidth(line.text, line.k);
      })
    ),
    height =
      lines.reduce(function (sum, line) {
        return sum + line.k;
      }, 0) +
      LINE_GAP * (lines.length - 1),
    scale = Math.min((1.6 * radius) / Math.sqrt(width * width + height * height), NUMBER_MAX_HEIGHT / lines[0].k);
  var small = lines.some(function (line) {
    return scale * line.k < line.min;
  });
  return small ? null : { lines: lines, scale: scale, height: scale * height };
}
