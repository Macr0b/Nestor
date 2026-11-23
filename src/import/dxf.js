/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture des fichiers DXF (lignes, polylignes, arcs, cercles, ellipses, splines, textes), résultat en mm. */

import { scaleAndFlipY } from "../geometry/polylines.js";
import { parseNumber } from "../util/numbers.js";

export function parseDxf(text, unitOverride) {
  var lines = text.split(/\r\n|\r|\n/),
    pairs = [];
  for (var i = 0; i + 1 < lines.length; i += 2) {
    var c = parseInt(lines[i].trim(), 10);
    if (isNaN(c)) continue;
    pairs.push([c, lines[i + 1].trim()]);
  }
  var ins = 0,
    warn = {},
    section = null,
    ents = [],
    curE = null,
    polyl = null;
  for (var j = 0; j < pairs.length; j++) {
    var c = pairs[j][0],
      v = pairs[j][1];
    if (c === 0 && v === "SECTION") {
      var nx = pairs[j + 1];
      section = nx && nx[0] === 2 ? nx[1] : null;
      continue;
    }
    if (c === 0 && v === "ENDSEC") {
      section = null;
      continue;
    }
    if (section === "HEADER" && c === 9 && v === "$INSUNITS") {
      var nn = pairs[j + 1];
      if (nn) ins = parseInt(nn[1], 10) || 0;
    }
    if (section !== "ENTITIES") continue;
    if (c === 0) {
      curE = { type: v, g: [] };
      ents.push(curE);
      continue;
    }
    if (curE) curE.g.push([c, v]);
  }
  var umap = { 0: 1, 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 8: 0.0000254, 9: 0.0254, 10: 914.4 };
  var f = unitOverride && unitOverride !== "auto" ? parseNumber(unitOverride, 1) : umap[ins] || 1;
  var paths = [],
    step = function (len) {
      return (len * f) / 0.25;
    };
  function groupNumber(e, code) {
    for (var k = 0; k < e.g.length; k++) if (e.g[k][0] === code) return parseFloat(e.g[k][1]);
    return undefined;
  }
  function groupText(e, code) {
    for (var k = 0; k < e.g.length; k++) if (e.g[k][0] === code) return e.g[k][1];
    return "";
  }
  function bulgeSeg(out, p1, p2, b) {
    if (!b || Math.abs(b) < 1e-9) {
      out.push(p2);
      return;
    }
    var th = 4 * Math.atan(b),
      c = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (c < 1e-12) {
      out.push(p2);
      return;
    }
    var r = c / (2 * Math.sin(Math.abs(th) / 2)),
      a0 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    var off = Math.sign(th) * (Math.PI / 2 - Math.abs(th) / 2),
      cx = p1[0] + r * Math.cos(a0 + off),
      cy = p1[1] + r * Math.sin(a0 + off);
    var s0 = Math.atan2(p1[1] - cy, p1[0] - cx),
      k = Math.max(4, Math.min(360, Math.ceil(step(Math.abs(th) * r))));
    for (var q = 1; q < k; q++) {
      var t = s0 + (th * q) / k;
      out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    out.push(p2);
  }
  function polyFrom(verts, closed) {
    var out = [verts[0].p];
    for (var q = 1; q < verts.length; q++) bulgeSeg(out, verts[q - 1].p, verts[q].p, verts[q - 1].b);
    if (closed && verts.length > 1) {
      bulgeSeg(out, verts[verts.length - 1].p, verts[0].p, verts[verts.length - 1].b);
      out.pop();
    }
    return out;
  }
  function add(pts, closed, e) {
    if (pts.length >= 2) paths.push({ pts: pts, closed: closed, layer: groupText(e, 8) });
  }
  var texts = [];
  for (var ei = 0; ei < ents.length; ei++) {
    var e = ents[ei],
      T = e.type;
    if (T === "LINE")
      add(
        [
          [groupNumber(e, 10), groupNumber(e, 20)],
          [groupNumber(e, 11), groupNumber(e, 21)]
        ],
        false,
        e
      );
    else if (T === "LWPOLYLINE") {
      var vs = [],
        flag = groupNumber(e, 70) || 0;
      e.g.forEach(function (g) {
        if (g[0] === 10) vs.push({ p: [parseFloat(g[1]), 0], b: 0 });
        else if (g[0] === 20 && vs.length) vs[vs.length - 1].p[1] = parseFloat(g[1]);
        else if (g[0] === 42 && vs.length) vs[vs.length - 1].b = parseFloat(g[1]);
      });
      if (vs.length) add(polyFrom(vs, !!(flag & 1)), !!(flag & 1), e);
    } else if (T === "POLYLINE") {
      polyl = { e: e, flag: groupNumber(e, 70) || 0, vs: [] };
    } else if (T === "VERTEX" && polyl) {
      var vf = groupNumber(e, 70) || 0;
      if (!(vf & 16)) polyl.vs.push({ p: [groupNumber(e, 10), groupNumber(e, 20)], b: groupNumber(e, 42) || 0 });
    } else if (T === "SEQEND" && polyl) {
      if (polyl.vs.length && !(polyl.flag & (16 | 64)))
        add(polyFrom(polyl.vs, !!(polyl.flag & 1)), !!(polyl.flag & 1), polyl.e);
      polyl = null;
    } else if (T === "CIRCLE" || T === "ARC") {
      var cx = groupNumber(e, 10),
        cy = groupNumber(e, 20),
        r = groupNumber(e, 40),
        a1 = 0,
        a2 = 2 * Math.PI,
        full = T === "CIRCLE";
      if (!full) {
        a1 = ((groupNumber(e, 50) || 0) * Math.PI) / 180;
        a2 = ((groupNumber(e, 51) || 0) * Math.PI) / 180;
        while (a2 <= a1) a2 += 2 * Math.PI;
      }
      var k = Math.max(full ? 24 : 4, Math.min(720, Math.ceil(step((a2 - a1) * r)))),
        pts = [];
      for (var q = 0; q < (full ? k : k + 1); q++) {
        var t = a1 + ((a2 - a1) * q) / k;
        pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
      }
      add(pts, full, e);
    } else if (T === "ELLIPSE") {
      var ecx = groupNumber(e, 10),
        ecy = groupNumber(e, 20),
        mx = groupNumber(e, 11),
        my = groupNumber(e, 21),
        ra = groupNumber(e, 40) || 1,
        p1 = groupNumber(e, 41) || 0,
        p2 = groupNumber(e, 42);
      if (p2 === undefined) p2 = 2 * Math.PI;
      while (p2 <= p1) p2 += 2 * Math.PI;
      var R = Math.hypot(mx, my),
        ang = Math.atan2(my, mx),
        efull = Math.abs(p2 - p1 - 2 * Math.PI) < 1e-6,
        ek = Math.max(24, Math.min(720, Math.ceil(step((p2 - p1) * R)))),
        ep = [];
      for (var q2 = 0; q2 < (efull ? ek : ek + 1); q2++) {
        var tt = p1 + ((p2 - p1) * q2) / ek,
          x = R * Math.cos(tt),
          y = R * ra * Math.sin(tt);
        ep.push([ecx + x * Math.cos(ang) - y * Math.sin(ang), ecy + x * Math.sin(ang) + y * Math.cos(ang)]);
      }
      add(ep, efull, e);
    } else if (T === "SPLINE") {
      var deg = groupNumber(e, 71) || 3,
        sflag = groupNumber(e, 70) || 0,
        knots = [],
        ctrl = [],
        wts = [],
        fit = [];
      e.g.forEach(function (g) {
        var v = parseFloat(g[1]);
        if (g[0] === 40) knots.push(v);
        else if (g[0] === 10) ctrl.push([v, 0]);
        else if (g[0] === 20 && ctrl.length) ctrl[ctrl.length - 1][1] = v;
        else if (g[0] === 41) wts.push(v);
        else if (g[0] === 11) fit.push([v, 0]);
        else if (g[0] === 21 && fit.length) fit[fit.length - 1][1] = v;
      });
      var sp = null;
      if (ctrl.length > deg && knots.length === ctrl.length + deg + 1) {
        var u0 = knots[deg],
          u1 = knots[ctrl.length],
          ln = 0;
        for (var q3 = 1; q3 < ctrl.length; q3++)
          ln += Math.hypot(ctrl[q3][0] - ctrl[q3 - 1][0], ctrl[q3][1] - ctrl[q3 - 1][1]);
        var sk = Math.max(ctrl.length * 8, Math.min(4000, Math.ceil(step(ln))));
        sp = [];
        for (var q4 = 0; q4 <= sk; q4++) {
          var u = u0 + ((u1 - u0) * q4) / sk;
          if (q4 === sk) u = u1 - 1e-12 * (u1 - u0);
          var kk = deg;
          while (kk < ctrl.length - 1 && knots[kk + 1] <= u) kk++;
          var dpts = [];
          for (var z = 0; z <= deg; z++) {
            var cp = ctrl[kk - deg + z],
              w = wts.length === ctrl.length ? wts[kk - deg + z] : 1;
            dpts.push([cp[0] * w, cp[1] * w, w]);
          }
          for (var rr = 1; rr <= deg; rr++)
            for (var jj = deg; jj >= rr; jj--) {
              var ii = kk - deg + jj,
                den = knots[ii + deg - rr + 1] - knots[ii],
                al = den === 0 ? 0 : (u - knots[ii]) / den;
              dpts[jj] = [
                (1 - al) * dpts[jj - 1][0] + al * dpts[jj][0],
                (1 - al) * dpts[jj - 1][1] + al * dpts[jj][1],
                (1 - al) * dpts[jj - 1][2] + al * dpts[jj][2]
              ];
            }
          var D = dpts[deg];
          sp.push([D[0] / D[2], D[1] / D[2]]);
        }
      } else if (fit.length >= 2) sp = fit;
      else if (ctrl.length >= 2) sp = ctrl;
      if (sp) add(sp, !!(sflag & 1), e);
    } else if (T === "INSERT") warn.blocs = (warn.blocs || 0) + 1;
    else if (T === "TEXT" || T === "MTEXT") {
      var raw = e.g
        .filter(function (g) {
          return g[0] === 1 || g[0] === 3;
        })
        .map(function (g) {
          return g[1];
        })
        .join("");
      var txt = raw
        .replace(/\\P/g, " ")
        .replace(/\{\\[^;{}]*;/g, "")
        .replace(/\\[A-Za-z][^;\\]*;/g, "")
        .replace(/[{}]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (txt) texts.push({ x: groupNumber(e, 10) || 0, y: groupNumber(e, 20) || 0, s: txt, layer: groupText(e, 8) });
      else warn.textes = (warn.textes || 0) + 1;
    }
  }
  scaleAndFlipY(paths, f);
  texts.forEach(function (t) {
    t.x *= f;
    t.y *= -f;
  });
  return { paths: paths, factor: f, detected: umap[ins] ? ins : 0, warn: warn, texts: texts };
}
