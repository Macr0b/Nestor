/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Textes posés dans une pièce : ils deviennent le nom de la pièce. */

function isPointInPolygon(x, y, polygon) {
  var c = false;
  for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    var a = polygon[i],
      b = polygon[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

function polygonArea(polygon) {
  var a = 0;
  for (var i = 0; i < polygon.length; i++) {
    var q = polygon[i],
      r = polygon[(i + 1) % polygon.length];
    a += q[0] * r[1] - r[0] * q[1];
  }
  return Math.abs(a / 2);
}

export function nameFromTexts(pieces, texts, warn) {
  var left = 0;
  texts.forEach(function (t) {
    var best = null,
      ba = Infinity;
    pieces.forEach(function (pc) {
      var x = t.x - pc.ox,
        y = t.y - pc.oy;
      if (x < 0 || y < 0 || x > pc.w || y > pc.h) return;
      pc.paths.forEach(function (p) {
        if (!p.closed || p.pts.length < 3) return;
        var A = polygonArea(p.pts);
        if (A < ba && isPointInPolygon(x, y, p.pts)) {
          ba = A;
          best = pc;
        }
      });
    });
    if (best) {
      if (!best.name) best.name = t.s;
    } else left++;
  });
  if (left) warn.texts = (warn.texts || 0) + left;
}
