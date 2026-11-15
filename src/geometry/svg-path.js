/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Chemin SVG (attribut d) -> polylignes : courbes et arcs découpés en petits segments. */

import { simplifyPolyline } from "./polylines.js";

const PATH_ARGUMENT_COUNTS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

export function flattenPath(pathData, segmentsFor) {
  var subs = [],
    cur = null,
    i = 0,
    s = String(pathData),
    n = s.length,
    cmd = null;
  var cx = 0,
    cy = 0,
    sx = 0,
    sy = 0,
    pcx = 0,
    pcy = 0,
    prev = "";
  function skipSeparators() {
    while (i < n && /[\s,]/.test(s[i])) i++;
  }
  function nextIsNumber() {
    skipSeparators();
    return i < n && /[0-9.+\-]/.test(s[i]);
  }
  function readNumber() {
    skipSeparators();
    var m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i, i + 40));
    if (!m) throw new Error("num");
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function readFlag() {
    skipSeparators();
    var c = s[i];
    if (c !== "0" && c !== "1") throw new Error("flag");
    i++;
    return c === "1" ? 1 : 0;
  }
  function addPoint(x, y) {
    cur.pts.push([x, y]);
  }
  function startSubpath(x, y) {
    cur = { pts: [[x, y]], closed: false };
    subs.push(cur);
  }
  function cubic(x1, y1, x2, y2, x3, y3) {
    var len = Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    var k = Math.max(2, Math.min(200, Math.ceil(segmentsFor(len))));
    for (var j = 1; j <= k; j++) {
      var t = j / k,
        u = 1 - t;
      addPoint(
        u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
      );
    }
  }
  function quad(x1, y1, x2, y2) {
    var len = Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1);
    var k = Math.max(2, Math.min(200, Math.ceil(segmentsFor(len))));
    for (var j = 1; j <= k; j++) {
      var t = j / k,
        u = 1 - t;
      addPoint(u * u * cx + 2 * u * t * x1 + t * t * x2, u * u * cy + 2 * u * t * y1 + t * t * y2);
    }
  }
  function arc(rx, ry, rot, fa, fs, x2, y2) {
    var x1 = cx,
      y1 = cy;
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (rx < 1e-9 || ry < 1e-9 || (x1 === x2 && y1 === y2)) {
      addPoint(x2, y2);
      return;
    }
    var phi = (rot * Math.PI) / 180,
      co = Math.cos(phi),
      si = Math.sin(phi);
    var dx = (x1 - x2) / 2,
      dy = (y1 - y2) / 2,
      x1p = co * dx + si * dy,
      y1p = -si * dx + co * dy;
    var lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) {
      var r = Math.sqrt(lam);
      rx *= r;
      ry *= r;
    }
    var num_ = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p,
      den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    var c = Math.sqrt(Math.max(0, num_ / den)) * (fa === fs ? -1 : 1);
    var cxp = (c * rx * y1p) / ry,
      cyp = (-c * ry * x1p) / rx;
    var ccx = co * cxp - si * cyp + (x1 + x2) / 2,
      ccy = si * cxp + co * cyp + (y1 + y2) / 2;
    function ang(ux, uy, vx, vy) {
      return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    }
    var t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry),
      dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI;
    if (fs && dt < 0) dt += 2 * Math.PI;
    var k = Math.max(4, Math.min(360, Math.ceil(segmentsFor(Math.abs(dt) * Math.max(rx, ry)))));
    for (var j = 1; j <= k; j++) {
      var t = t1 + (dt * j) / k;
      if (j === k) {
        addPoint(x2, y2);
        break;
      }
      addPoint(
        ccx + rx * Math.cos(t) * co - ry * Math.sin(t) * si,
        ccy + rx * Math.cos(t) * si + ry * Math.sin(t) * co
      );
    }
  }
  while (true) {
    skipSeparators();
    if (i >= n) break;
    var ch = s[i];
    if (/[a-zA-Z]/.test(ch)) {
      cmd = ch;
      i++;
      if (cmd === "z" || cmd === "Z") {
        if (cur) {
          cur.closed = true;
          cx = sx;
          cy = sy;
          cur = null;
        }
        prev = "Z";
        continue;
      }
      if (!PATH_ARGUMENT_COUNTS.hasOwnProperty(cmd.toUpperCase())) return subs;
    } else if (!cmd) break;
    if (cmd === "z" || cmd === "Z") break;
    var U = cmd.toUpperCase(),
      rel = cmd !== U,
      first = true;
    do {
      var a = [];
      if (U === "A") {
        a = [readNumber(), readNumber(), readNumber(), readFlag(), readFlag(), readNumber(), readNumber()];
      } else for (var q = 0; q < PATH_ARGUMENT_COUNTS[U]; q++) a.push(readNumber());
      var ox = rel ? cx : 0,
        oy = rel ? cy : 0;
      if (U === "M") {
        if (first) {
          cx = a[0] + ox;
          cy = a[1] + oy;
          sx = cx;
          sy = cy;
          startSubpath(cx, cy);
          prev = "M";
        } else {
          if (!cur) startSubpath(cx, cy);
          cx = a[0] + ox;
          cy = a[1] + oy;
          addPoint(cx, cy);
          prev = "L";
        }
      } else {
        if (!cur) {
          startSubpath(cx, cy);
          sx = cx;
          sy = cy;
        }
        if (U === "L") {
          cx = a[0] + ox;
          cy = a[1] + oy;
          addPoint(cx, cy);
        } else if (U === "H") {
          cx = a[0] + ox;
          addPoint(cx, cy);
        } else if (U === "V") {
          cy = a[0] + oy;
          addPoint(cx, cy);
        } else if (U === "C") {
          var c1 = [a[0] + ox, a[1] + oy],
            c2 = [a[2] + ox, a[3] + oy],
            e = [a[4] + ox, a[5] + oy];
          cubic(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
          pcx = c2[0];
          pcy = c2[1];
          cx = e[0];
          cy = e[1];
        } else if (U === "S") {
          var r1 = prev === "C" || prev === "S" ? [2 * cx - pcx, 2 * cy - pcy] : [cx, cy];
          var c2b = [a[0] + ox, a[1] + oy],
            eb = [a[2] + ox, a[3] + oy];
          cubic(r1[0], r1[1], c2b[0], c2b[1], eb[0], eb[1]);
          pcx = c2b[0];
          pcy = c2b[1];
          cx = eb[0];
          cy = eb[1];
        } else if (U === "Q") {
          var qc = [a[0] + ox, a[1] + oy],
            qe = [a[2] + ox, a[3] + oy];
          quad(qc[0], qc[1], qe[0], qe[1]);
          pcx = qc[0];
          pcy = qc[1];
          cx = qe[0];
          cy = qe[1];
        } else if (U === "T") {
          var tc = prev === "Q" || prev === "T" ? [2 * cx - pcx, 2 * cy - pcy] : [cx, cy],
            te = [a[0] + ox, a[1] + oy];
          quad(tc[0], tc[1], te[0], te[1]);
          pcx = tc[0];
          pcy = tc[1];
          cx = te[0];
          cy = te[1];
        } else if (U === "A") {
          var ax = a[5] + ox,
            ay = a[6] + oy;
          arc(a[0], a[1], a[2], a[3], a[4], ax, ay);
          cx = ax;
          cy = ay;
        }
        prev = U;
      }
      first = false;
    } while (nextIsNumber());
  }
  return subs;
}

/**
 * Tracé SVG (attribut d) -> polylignes prêtes à l'emploi : courbes découpées (environ un segment par 0,25 mm),
 * points transformés (repère, échelle), point de fermeture en double retiré, points superflus supprimés.
 * stepScale : nombre de mm par unité du tracé, pour régler la finesse du découpage des courbes.
 * Lève une erreur si le tracé est illisible : l'appelant la compte dans ses avertissements.
 */
export function pathToPolylines(pathData, stepScale, transformPoint) {
  return flattenPath(pathData, function (length) {
    return (length * stepScale) / 0.25;
  })
    .map(function (subpath) {
      var pts = subpath.pts.map(transformPoint);
      if (subpath.closed && pts.length > 1) {
        var first = pts[0],
          last = pts[pts.length - 1];
        if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) pts.pop();
      }
      return { pts: simplifyPolyline(pts, 0.01), closed: subpath.closed };
    })
    .filter(function (polyline) {
      return polyline.pts.length >= 2;
    });
}
