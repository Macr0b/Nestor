/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Placement en rectangles (coupes droites à la scie), par bandes guillotine. */

import { parseNumber } from "../util/numbers.js";

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
  var sheets = [];
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
