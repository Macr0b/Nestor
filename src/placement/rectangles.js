/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Placement en rectangles (coupes droites à la scie), par bandes guillotine. */

import { parseNumber } from "../util/numbers.js";

/* Espace libre d'un panneau déjà garni, en rectangles qu'on peut atteindre à la scie (coupes d'un bord à l'autre) :
   on sépare les pièces par des traits droits, puis on détoure chaque pièce seule. boxes : [{x, y, w, h}] ;
   gap : écart gardé autour des pièces ; margin : marge au bord. Une zone où aucun trait droit ne sépare les
   pièces est laissée de côté (rien n'y sera ajouté). */
export function freeRectangles(width, height, boxes, gap, margin) {
  var out = [];
  function keep(x0, y0, x1, y1) {
    if (x1 - x0 > 0.5 && y1 - y0 > 0.5) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  // trait droit libre entre les pièces de la zone, sur un axe : position du premier trouvé, ou null
  function separation(list, axis) {
    var lo = axis === "x" ? "x" : "y",
      size = axis === "x" ? "w" : "h",
      sorted = list.slice().sort(function (a, b) {
        return a[lo] - b[lo];
      }),
      reach = -Infinity;
    for (var k = 0; k < sorted.length - 1; k++) {
      reach = Math.max(reach, sorted[k][lo] + sorted[k][size]);
      if (sorted[k + 1][lo] - reach >= gap) return reach;
    }
    return null;
  }
  function split(x0, y0, x1, y1, list) {
    if (x1 - x0 <= 0.5 || y1 - y0 <= 0.5) return;
    if (!list.length) return keep(x0, y0, x1, y1);
    if (list.length === 1) {
      // une pièce : bandes gauche et droite sur toute la hauteur, puis dessus et dessous entre les deux
      var b = list[0],
        left = b.x - gap,
        right = b.x + b.w + gap,
        top = b.y - gap,
        bottom = b.y + b.h + gap;
      keep(x0, y0, Math.min(left, x1), y1);
      keep(Math.max(right, x0), y0, x1, y1);
      keep(Math.max(x0, left + gap), y0, Math.min(x1, right - gap), Math.min(top, y1));
      keep(Math.max(x0, left + gap), Math.max(bottom, y0), Math.min(x1, right - gap), y1);
      return;
    }
    ["x", "y"].some(function (axis) {
      var at = separation(list, axis);
      if (at == null) return false;
      var first = list.filter(function (q) {
          return (axis === "x" ? q.x + q.w : q.y + q.h) <= at + 1e-6;
        }),
        second = list.filter(function (q) {
          return first.indexOf(q) < 0;
        });
      if (axis === "x") {
        split(x0, y0, at, y1, first);
        split(at + gap, y0, x1, y1, second);
      } else {
        split(x0, y0, x1, at, first);
        split(x0, at + gap, x1, y1, second);
      }
      return true;
    });
  }
  split(margin, margin, width - margin, height - margin, boxes);
  return out;
}

/* sheet.fixed : panneaux déjà garnis [{pi, L, W, free: [rectangles libres]}], remplis en premier sans y ajouter de
   panneau (voir freeRectangles). */
export function packRectangles(sheet, types) {
  var k = Math.max(0, parseNumber(sheet.gap, 0)),
    t = Math.max(0, parseNumber(sheet.margin, 0)),
    items = [],
    unplaced = [];
  var panels = (sheet.panels || [])
    .map(function (p, pi) {
      var q =
        p.qty === "" || p.qty == null || parseNumber(p.qty, -1) < 0 ? Infinity : Math.floor(parseNumber(p.qty, 0));
      return { pi: pi, L: parseNumber(p.L, 0), W: parseNumber(p.W, 0), left: q };
    })
    .filter(function (p) {
      return p.L > 0 && p.W > 0;
    });
  types.forEach(function (p, i) {
    if (p.on === false) return;
    var q = Math.max(0, Math.floor(parseNumber(p.qty, 0)));
    if (p.w <= 0 && p.h <= 0) return;
    for (var j = 0; j < q; j++) items.push({ i: i, L: Math.max(p.w, 0.01), W: Math.max(p.h, 0.01), rot: !!p.rot });
  });
  items.sort(function (a, b) {
    return Math.max(b.L, b.W) - Math.max(a.L, a.W) || b.L * b.W - a.L * a.W;
  });
  var sheets = (sheet.fixed || []).map(function (f) {
    return { pi: f.pi, L: f.L, W: f.W, parts: [], free: f.free.slice() };
  });
  function fits(it, r) {
    var o = [];
    if (it.L <= r.w + 1e-9 && it.W <= r.h + 1e-9) o.push({ w: it.L, h: it.W, turned: false });
    if (it.rot && it.W <= r.w + 1e-9 && it.L <= r.h + 1e-9) o.push({ w: it.W, h: it.L, turned: true });
    return o;
  }
  function full(p) {
    return { x: t, y: t, w: p.L - 2 * t, h: p.W - 2 * t };
  }
  function place(s, ri, it, o) {
    var r = s.free.splice(ri, 1)[0];
    s.parts.push({ x: r.x, y: r.y, w: o.w, h: o.h, i: it.i, turned: o.turned });
    var rw = r.w - o.w - k,
      rh = r.h - o.h - k,
      aA = Math.max(rw * r.h, o.w * rh),
      aB = Math.max(rw * o.h, r.w * rh),
      add = [];
    if (aA >= aB) {
      add.push({ x: r.x + o.w + k, y: r.y, w: rw, h: r.h });
      add.push({ x: r.x, y: r.y + o.h + k, w: o.w, h: rh });
    } else {
      add.push({ x: r.x + o.w + k, y: r.y, w: rw, h: o.h });
      add.push({ x: r.x, y: r.y + o.h + k, w: r.w, h: rh });
    }
    add.forEach(function (a) {
      if (a.w > 0.5 && a.h > 0.5) s.free.push(a);
    });
  }
  items.forEach(function (it) {
    var best = null;
    sheets.forEach(function (s, si) {
      s.free.forEach(function (r, ri) {
        fits(it, r).forEach(function (o) {
          var sc = r.w * r.h - o.w * o.h,
            sc2 = Math.min(r.w - o.w, r.h - o.h);
          if (!best || sc < best.sc || (sc === best.sc && sc2 < best.sc2))
            best = { si: si, ri: ri, o: o, sc: sc, sc2: sc2 };
        });
      });
    });
    if (!best) {
      for (var q = 0; q < panels.length && !best; q++) {
        var P = panels[q];
        if (P.left <= 0) continue;
        var fr = full(P);
        if (fr.w <= 0 || fr.h <= 0) continue;
        var o = fits(it, fr);
        if (o.length) {
          P.left--;
          sheets.push({ pi: P.pi, L: P.L, W: P.W, parts: [], free: [fr] });
          best = { si: sheets.length - 1, ri: 0, o: o[0] };
        }
      }
      if (!best) {
        var anyFit = panels.some(function (P) {
          var fr = full(P);
          return fr.w > 0 && fr.h > 0 && fits(it, fr).length;
        });
        unplaced.push({ i: it.i, why: anyFit ? "stock" : "size" });
        return;
      }
    }
    place(sheets[best.si], best.ri, it, best.o);
  });
  var used = 0,
    count = 0;
  sheets.forEach(function (s) {
    s.used = 0;
    s.parts.forEach(function (p) {
      s.used += p.w * p.h;
    });
    used += s.used;
    count += s.parts.length;
    s.free.sort(function (a, b) {
      return b.w * b.h - a.w * a.h;
    });
  });
  return { sheets: sheets, unplaced: unplaced, used: used, count: count, total: items.length };
}
