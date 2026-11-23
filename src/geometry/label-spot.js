/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Emplacement d'un texte dans une pièce : le point de matière le plus éloigné de tous les traits (hors des
   trous et des creux), et la plus grande taille de texte qui y tient. */

import { strokeTextWidth } from "../text/stroke-font.js";

// recherche en grille, puis affinée autour du meilleur point
const GRID_STEPS = 14;
const REFINE_ROUNDS = 4;

function boundsOf(paths) {
  var b = [Infinity, Infinity, -Infinity, -Infinity];
  paths.forEach(function (p) {
    p.pts.forEach(function (v) {
      b[0] = Math.min(b[0], v[0]);
      b[1] = Math.min(b[1], v[1]);
      b[2] = Math.max(b[2], v[0]);
      b[3] = Math.max(b[3], v[1]);
    });
  });
  return b;
}

// dans la matière : règle pair-impair sur tous les contours fermés (un trou retire la matière)
function insideMaterial(paths, x, y) {
  var inside = false;
  paths.forEach(function (p) {
    if (!p.closed) return;
    var pts = p.pts;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i],
        b = pts[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
  });
  return inside;
}

function segmentDistance(x, y, a, b) {
  var dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = dx * dx + dy * dy,
    t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

// distance au trait le plus proche (contours, trous et traits ouverts)
function edgeDistance(paths, x, y) {
  var best = Infinity;
  paths.forEach(function (p) {
    var pts = p.pts,
      n = pts.length;
    for (var i = 0; i + 1 < n; i++) best = Math.min(best, segmentDistance(x, y, pts[i], pts[i + 1]));
    if (p.closed && n > 2) best = Math.min(best, segmentDistance(x, y, pts[n - 1], pts[0]));
  });
  return best;
}

/* Point de matière le plus éloigné des traits : { x, y, radius } ; null si la pièce n'a pas de matière. */
export function labelSpot(paths) {
  if (
    !paths.some(function (p) {
      return p.closed && p.pts.length > 2;
    })
  )
    return null;
  var b = boundsOf(paths),
    best = null;
  function tryPoint(x, y) {
    if (!insideMaterial(paths, x, y)) return;
    var d = edgeDistance(paths, x, y);
    if (!best || d > best.radius) best = { x: x, y: y, radius: d };
  }
  var stepX = (b[2] - b[0]) / GRID_STEPS,
    stepY = (b[3] - b[1]) / GRID_STEPS;
  for (var i = 0; i <= GRID_STEPS; i++)
    for (var j = 0; j <= GRID_STEPS; j++) tryPoint(b[0] + (i + 0.5) * stepX, b[1] + (j + 0.5) * stepY);
  // pièce très fine : la grille a pu tout rater, on essaie le centre
  tryPoint((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  if (!best) return null;
  for (var round = 0; round < REFINE_ROUNDS; round++) {
    stepX /= 3;
    stepY /= 3;
    var cx = best.x,
      cy = best.y;
    for (var a = -3; a <= 3; a++) for (var c = -3; c <= 3; c++) tryPoint(cx + a * stepX, cy + c * stepY);
  }
  return best;
}

/* Hauteur des chiffres pour que le texte tienne dans le cercle libre (avec une marge), bornée par maxHeight.
   Renvoie 0 si le texte serait plus petit que minHeight. */
export function labelHeight(text, radius, minHeight, maxHeight) {
  var ratio = strokeTextWidth(text, 1),
    height = (1.6 * radius) / Math.sqrt(ratio * ratio + 1);
  height = Math.min(height, maxHeight);
  return height >= minHeight ? height : 0;
}
