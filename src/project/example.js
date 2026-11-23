/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Projet d'exemple affiché au premier lancement : quelques pièces typiques sur un panneau. */

import { buildPartTypes, groupPieces } from "../geometry/grouping.js";
import { simplifyPolyline } from "../geometry/polylines.js";
import { flattenPath } from "../geometry/svg-path.js";

function createExampleParts() {
  // formes de l'exemple : courbes découpées et simplifiées (même ordre d'étapes depuis la première version,
  // pour que l'exemple reste identique)
  function fromD(d) {
    var ps = flattenPath(d, function (l) {
      return l / 0.25;
    }).map(function (s) {
      return { pts: simplifyPolyline(s.pts, 0.01), closed: s.closed };
    });
    ps.forEach(function (p) {
      if (p.closed && p.pts.length > 1) {
        var a = p.pts[0],
          b = p.pts[p.pts.length - 1];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) p.pts.pop();
      }
    });
    return ps;
  }
  function off(p, x, y) {
    return {
      closed: p.closed,
      pts: p.pts.map(function (q) {
        return [q[0] + x, q[1] + y];
      })
    };
  }
  var plate = fromD(
    "M6 0H194A6 6 0 0 1 200 6V114A6 6 0 0 1 194 120H6A6 6 0 0 1 0 114V6A6 6 0 0 1 6 0Z M120 60A20 20 0 1 0 80 60A20 20 0 1 0 120 60Z"
  );
  var disc = fromD("M60 30A30 30 0 1 0 0 30A30 30 0 1 0 60 30Z M36 30A6 6 0 1 0 24 30A6 6 0 1 0 36 30Z");
  var ell = fromD("M0 0H150V40H40V100H0Z"),
    tab = fromD("M0 0H80V30H0Z"),
    all = [];
  [
    [plate, 0, 0],
    [plate, 0, 200],
    [disc, 300, 0],
    [disc, 380, 0],
    [disc, 460, 0],
    [disc, 540, 0],
    [ell, 300, 100],
    [ell, 300, 260],
    [tab, 500, 100],
    [tab, 500, 150],
    [tab, 500, 200],
    [tab, 600, 100],
    [tab, 600, 150],
    [tab, 600, 200]
  ].forEach(function (a) {
    all = all.concat(
      a[0].map(function (p) {
        return off(p, a[1], a[2]);
      })
    );
  });
  var t = buildPartTypes(groupPieces(all).pieces);
  t.sort(function (a, b) {
    return b.w * b.h - a.w * a.h;
  });
  t.forEach(function (x, i) {
    x.name = "";
    x.ord = i;
  });
  ["ex.facade", "ex.angle", "ex.disc", "ex.tab"].forEach(function (k, i) {
    if (t[i]) t[i].nameKey = k;
  });
  return t;
}

export function createExampleProject() {
  return {
    id: null,
    name: "",
    example: true,
    source: "",
    files: [],
    // panneaux figés (cadenas), voir project/locks.js
    locks: [],
    sheet: { panels: [{ L: 600, W: 400, qty: "" }], gap: 2, margin: 5, mode: "nest" },
    types: createExampleParts()
  };
}
