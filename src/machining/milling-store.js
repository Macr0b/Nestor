/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Derniers réglages de l'onglet Fraisage, mémorisés sur l'appareil (fraise, matière, machine). */

import { familyById, materialById } from "./materials.js";
import { DEFAULT_MILLING, TOOL_TYPES } from "./milling.js";

const MILLING_KEY = "nestor.fraisage.v1";

function numberOr(value, fallback) {
  return typeof value === "number" && isFinite(value) && value >= 0 ? value : fallback;
}

/* Réglages relus et vérifiés champ par champ : une valeur absente ou abîmée reprend sa valeur de départ. */
export function cleanMillingInput(saved) {
  const input = Object.assign({}, DEFAULT_MILLING);
  if (!saved || typeof saved !== "object") return input;
  if (TOOL_TYPES.includes(saved.toolType)) input.toolType = saved.toolType;
  if (familyById(saved.family)) input.family = saved.family;
  input.material = materialById(saved.material) ? saved.material : "";
  if (input.material) input.family = materialById(input.material).family;
  for (const key of ["diameter", "flutes", "spindleMin", "spindleMax", "feedMax"])
    input[key] = numberOr(saved[key], DEFAULT_MILLING[key]);
  // l'épaisseur peut rester vide (pas de nombre de passes)
  input.thickness = saved.thickness === null ? NaN : numberOr(saved.thickness, DEFAULT_MILLING.thickness);
  input.finishing = saved.finishing === true;
  return input;
}

export function loadMillingInput() {
  try {
    return cleanMillingInput(JSON.parse(localStorage.getItem(MILLING_KEY) || "null"));
  } catch (e) {
    return cleanMillingInput(null);
  }
}

export function saveMillingInput(input) {
  try {
    const saved = Object.assign({}, input);
    // JSON ne sait pas écrire NaN : une épaisseur vide est gardée comme null
    if (!isFinite(saved.thickness)) saved.thickness = null;
    localStorage.setItem(MILLING_KEY, JSON.stringify(saved));
  } catch (e) {}
}
