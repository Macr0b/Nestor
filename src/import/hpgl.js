/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture des fichiers HPGL / PLT (traceurs et découpeuses), résultat en mm. */

import { scaleAndFlipY } from "../geometry/polylines.js";
import { parseNumber } from "../util/numbers.js";

export function parseHpgl(text, unitOverride) {
  var f = unitOverride && unitOverride !== "auto" ? parseNumber(unitOverride, 1) : 0.025,
    step = function (len) {
      return (len * f) / 0.25;
    };
  var src = String(text).replace(/LB[^\x03]*\x03/gi, "");
  var re = /([A-Za-z]{2})([^A-Za-z;]*)/g,
    m,
    abs = true,
    down = false,
    x = 0,
    y = 0,
    pen = 1,
    cur = null,
    paths = [],
    warn = {};
  function flush() {
    if (cur && cur.pts.length >= 2) paths.push(cur);
    cur = null;
  }
  function drawTo(nx, ny) {
    if (down) {
      if (!cur) cur = { pts: [[x, y]], closed: false, layer: "SP" + pen, color: "" };
      cur.pts.push([nx, ny]);
    } else flush();
    x = nx;
    y = ny;
  }
  function parseNumbers(a) {
    return a
      .split(/[\s,]+/)
      .filter(function (v) {
        return v !== "";
      })
      .map(Number)
      .filter(function (v) {
        return isFinite(v);
      });
  }
  function arc(cx0, cy0, sweep, chord) {
    var r = Math.hypot(x - cx0, y - cy0),
      a0 = Math.atan2(y - cy0, x - cx0),
      sw = (sweep * Math.PI) / 180;
    var k = Math.max(4, Math.min(720, Math.ceil(chord ? Math.abs(sweep) / chord : step(Math.abs(sw) * r))));
    for (var q = 1; q <= k; q++) {
      var t = a0 + (sw * q) / k;
      drawTo(cx0 + r * Math.cos(t), cy0 + r * Math.sin(t));
    }
  }
  while ((m = re.exec(src))) {
    var c = m[1].toUpperCase(),
      a = parseNumbers(m[2]),
      i;
    if (c === "IN" || c === "DF") {
      flush();
      abs = true;
      down = false;
    } else if (c === "SP") {
      flush();
      pen = a.length ? a[0] : 0;
    } else if (c === "PU" || c === "PD" || c === "PA" || c === "PR") {
      if (c === "PU") {
        down = false;
        flush();
      } else if (c === "PD") down = true;
      else abs = c === "PA";
      for (i = 0; i + 1 < a.length; i += 2) drawTo(abs ? a[i] : x + a[i], abs ? a[i + 1] : y + a[i + 1]);
    } else if (c === "CI" && a.length) {
      flush();
      var r = a[0],
        cx = x,
        cy = y,
        k = Math.max(24, Math.min(720, Math.ceil(a[1] ? 360 / a[1] : step(2 * Math.PI * r)))),
        pts = [];
      for (i = 0; i < k; i++) {
        var t = (2 * Math.PI * i) / k;
        pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
      }
      paths.push({ pts: pts, closed: true, layer: "SP" + pen, color: "" });
    } else if ((c === "AA" || c === "AR") && a.length >= 3) {
      var wasDown = down;
      arc(c === "AA" ? a[0] : x + a[0], c === "AA" ? a[1] : y + a[1], a[2], a[3]);
      down = wasDown;
    } else if ((c === "EA" || c === "ER" || c === "RA" || c === "RR") && a.length >= 2) {
      flush();
      var x2 = c[1] === "A" ? a[0] : x + a[0],
        y2 = c[1] === "A" ? a[1] : y + a[1];
      paths.push({
        pts: [
          [x, y],
          [x2, y],
          [x2, y2],
          [x, y2]
        ],
        closed: true,
        layer: "SP" + pen,
        color: ""
      });
    } else if (c === "PE") {
      warn.paths = (warn.paths || 0) + 1;
    }
  }
  flush();
  scaleAndFlipY(paths, f);
  return { paths: paths, how: unitOverride && unitOverride !== "auto" ? "how.manual" : "how.hpgl", warn: warn };
}
