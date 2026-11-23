/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture et arrondi des nombres (virgule ou point acceptés). */

export function parseNumber(value, fallback) {
  var n = parseFloat(String(value).replace(",", "."));
  return isFinite(n) ? n : fallback;
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function round1(value) {
  return Math.round(value * 10) / 10;
}
