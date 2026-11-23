/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Géométrie finale d'une pièce placée (position et rotation appliquées). */

export function placedPartPaths(type, part) {
  if (part.a != null) {
    var c = Math.cos((part.a * Math.PI) / 180),
      sn = Math.sin((part.a * Math.PI) / 180);
    return type.paths.map(function (p) {
      return {
        closed: p.closed,
        layer: p.layer,
        color: p.color,
        pts: p.pts.map(function (q) {
          return [part.x + q[0] * c - q[1] * sn - part.mx, part.y + q[0] * sn + q[1] * c - part.my];
        })
      };
    });
  }
  return type.paths.map(function (p) {
    return {
      closed: p.closed,
      layer: p.layer,
      color: p.color,
      pts: p.pts.map(function (q) {
        var u = q[0],
          v = q[1],
          k = part.k != null ? part.k : part.turned ? 3 : 0,
          w = type.w,
          h = type.h;
        var a = k === 0 ? [u, v] : k === 1 ? [h - v, u] : k === 2 ? [w - u, h - v] : [v, w - u];
        return [part.x + a[0], part.y + a[1]];
      })
    };
  });
}
