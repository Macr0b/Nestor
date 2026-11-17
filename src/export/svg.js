/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fichier SVG d'un panneau : ses traits exportés, zéro à l'origine choisie. */

import { exportPaths } from "./export-files.js";
import { originPoint } from "../placement/origin.js";
import { buildSvgFromPaths } from "./svg-writer.js";

export function buildSvgFile(sheet, inches) {
  return buildSvgFromPaths(exportPaths(sheet), sheet.L, sheet.W, originPoint(sheet), inches);
}
