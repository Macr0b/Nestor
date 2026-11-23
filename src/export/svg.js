/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fichier SVG d'un panneau : ses traits exportés, zéro à l'origine choisie. */

import { exportPaths } from "./export-files.js";
import { originPoint } from "../placement/origin.js";
import { buildSvgFromPaths } from "./svg-writer.js";

export function buildSvgFile(sheet, inches) {
  return buildSvgFromPaths(exportPaths(sheet), sheet.L, sheet.W, originPoint(sheet), inches);
}
