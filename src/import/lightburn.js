/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture des fichiers LightBurn (.lbrn, .lbrn2). */

import { pathToPolylines } from "../geometry/svg-path.js";
import { translate } from "../i18n/i18n.js";
import { parseNumber } from "../util/numbers.js";

export function parseLightBurn(text, unitOverride) {
  var doc = new DOMParser().parseFromString(text, "application/xml"),
    root = doc.documentElement;
  if (!root || doc.getElementsByTagName("parsererror").length || !/LightBurnProject/i.test(root.nodeName))
    throw new Error(translate("err.generic"));
  var f = unitOverride && unitOverride !== "auto" ? parseNumber(unitOverride, 1) : 1,
    paths = [],
    warn = {},
    cuts = {};
  function kids(el, tag) {
    return Array.prototype.filter.call(el.children, function (c) {
      return c.nodeName === tag;
    });
  }
  function attr(el, n) {
    var v = el.getAttribute(n);
    if (v != null) return v;
    var c = kids(el, n)[0];
    return c ? c.getAttribute("Value") : null;
  }
  kids(root, "CutSetting")
    .concat(kids(root, "CutSetting_Img"))
    .forEach(function (c) {
      var i = attr(c, "index"),
        n = attr(c, "name");
      if (i != null) cuts[i] = n || "C" + ("0" + i).slice(-2);
    });
  function mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5]
    ];
  }
  function transformOf(el) {
    var x = kids(el, "XForm")[0];
    if (!x) return [1, 0, 0, 1, 0, 0];
    var v = x.textContent
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    return v.length === 6 && v.every(isFinite) ? v : [1, 0, 0, 1, 0, 0];
  }
  function emit(dd, m, layer, name) {
    var polylines;
    try {
      polylines = pathToPolylines(dd, f, function (q) {
        return [(m[0] * q[0] + m[2] * q[1] + m[4]) * f, -(m[1] * q[0] + m[3] * q[1] + m[5]) * f];
      });
    } catch (e) {
      warn.paths = (warn.paths || 0) + 1;
      return;
    }
    polylines.forEach(function (polyline) {
      paths.push({ pts: polyline.pts, closed: polyline.closed, layer: layer, color: "", name: name });
    });
  }
  function verts(el) {
    var vl = kids(el, "VertList")[0],
      V = [];
    if (vl && vl.textContent.trim()) {
      // format .lbrn2 : V<x> <y> puis, en option, c0x<v>c0y<v>c1x<v>c1y<v>
      var re = /(V|c0x|c0y|c1x|c1y)\s*(-?[\d.]+(?:e[-+]?\d+)?)(?:\s+(-?[\d.]+(?:e[-+]?\d+)?))?/gi,
        m,
        cur = null,
        tmp = {};
      while ((m = re.exec(vl.textContent))) {
        var k = m[1].toLowerCase(),
          v = parseFloat(m[2]);
        if (k === "v") {
          cur = { p: [v, parseFloat(m[3])] };
          V.push(cur);
          tmp = {};
        } else if (cur) {
          tmp[k] = v;
          if (k === "c0y" && tmp.c0x != null) cur.c0 = [tmp.c0x, v];
          if (k === "c1y" && tmp.c1x != null) cur.c1 = [tmp.c1x, v];
        }
      }
    } else {
      // format .lbrn : <V vx vy c0x c0y c1x c1y/>
      (vl ? kids(vl, "V") : kids(el, "V")).forEach(function (v) {
        var o = { p: [parseNumber(v.getAttribute("vx"), 0), parseNumber(v.getAttribute("vy"), 0)] };
        if (v.hasAttribute("c0x"))
          o.c0 = [parseNumber(v.getAttribute("c0x"), 0), parseNumber(v.getAttribute("c0y"), 0)];
        if (v.hasAttribute("c1x"))
          o.c1 = [parseNumber(v.getAttribute("c1x"), 0), parseNumber(v.getAttribute("c1y"), 0)];
        V.push(o);
      });
    }
    return V;
  }
  function prims(el, n) {
    var pl = kids(el, "PrimList")[0],
      P = [],
      txt = pl ? pl.textContent.trim() : "";
    if (pl && txt) {
      if (/^LineClosed$/i.test(txt)) {
        for (var i = 0; i < n; i++) P.push(["L", i, (i + 1) % n]);
        return P;
      }
      if (/^Line(Open)?$/i.test(txt)) {
        for (var j = 0; j + 1 < n; j++) P.push(["L", j, j + 1]);
        return P;
      }
      var re = /([LB])\s*(\d+)\s+(\d+)/g,
        m;
      while ((m = re.exec(txt))) P.push([m[1].toUpperCase(), +m[2], +m[3]]);
      return P;
    }
    (pl ? kids(pl, "P") : kids(el, "P")).forEach(function (p) {
      var t = (p.getAttribute("T") || "L").toUpperCase();
      P.push([t[0] === "B" ? "B" : "L", parseNumber(p.getAttribute("p0"), 0), parseNumber(p.getAttribute("p1"), 0)]);
    });
    if (!P.length) for (var k = 0; k + 1 < n; k++) P.push(["L", k, k + 1]);
    return P;
  }
  function pathD(V, P) {
    var d = "",
      last = -1;
    P.forEach(function (p) {
      var a = V[p[1]],
        b = V[p[2]];
      if (!a || !b) return;
      if (p[1] !== last) d += "M" + a.p[0] + " " + a.p[1];
      if (p[0] === "B") {
        var c0 = a.c0 || a.p,
          c1 = b.c1 || b.p;
        d += "C" + c0[0] + " " + c0[1] + " " + c1[0] + " " + c1[1] + " " + b.p[0] + " " + b.p[1];
      } else d += "L" + b.p[0] + " " + b.p[1];
      last = p[2];
      if (p[2] === P[0][1] && p === P[P.length - 1]) d += "Z";
    });
    return d;
  }
  function shape(el, M) {
    var t = el.getAttribute("Type") || "",
      m = mul(M, transformOf(el)),
      ci = el.getAttribute("CutIndex"),
      layer = ci != null ? cuts[ci] || "C" + ("0" + ci).slice(-2) : "",
      name = el.getAttribute("Name") || "";
    if (el.getAttribute("Hidden") === "1") return;
    if (t === "Group") {
      var ch = kids(el, "Children")[0];
      (ch ? kids(ch, "Shape") : []).forEach(function (c) {
        shape(c, m);
      });
      return;
    }
    if (t === "Rect") {
      var w = parseNumber(el.getAttribute("W"), 0),
        h = parseNumber(el.getAttribute("H"), 0),
        r = Math.min(parseNumber(el.getAttribute("Cr"), 0), w / 2, h / 2),
        x = -w / 2,
        y = -h / 2;
      if (w <= 0 || h <= 0) return;
      emit(
        r > 0
          ? "M" +
              (x + r) +
              " " +
              y +
              "H" +
              (x + w - r) +
              "A" +
              r +
              " " +
              r +
              " 0 0 1 " +
              (x + w) +
              " " +
              (y + r) +
              "V" +
              (y + h - r) +
              "A" +
              r +
              " " +
              r +
              " 0 0 1 " +
              (x + w - r) +
              " " +
              (y + h) +
              "H" +
              (x + r) +
              "A" +
              r +
              " " +
              r +
              " 0 0 1 " +
              x +
              " " +
              (y + h - r) +
              "V" +
              (y + r) +
              "A" +
              r +
              " " +
              r +
              " 0 0 1 " +
              (x + r) +
              " " +
              y +
              "Z"
          : "M" + x + " " + y + "H" + (x + w) + "V" + (y + h) + "H" + x + "Z",
        m,
        layer,
        name
      );
      return;
    }
    if (t === "Ellipse") {
      var rx = parseNumber(el.getAttribute("Rx"), 0),
        ry = parseNumber(el.getAttribute("Ry"), rx);
      if (rx <= 0 || ry <= 0) return;
      emit(
        "M" + rx + " 0A" + rx + " " + ry + " 0 1 1 " + -rx + " 0A" + rx + " " + ry + " 0 1 1 " + rx + " 0Z",
        m,
        layer,
        name
      );
      return;
    }
    if (t === "Polygon") {
      var N = Math.max(3, parseNumber(el.getAttribute("N"), 6)),
        pr = parseNumber(el.getAttribute("Rx"), parseNumber(el.getAttribute("R"), 0)),
        pd = "";
      if (pr <= 0) {
        warn.special = (warn.special || 0) + 1;
        return;
      }
      for (var i = 0; i < N; i++) {
        var a = -Math.PI / 2 + (2 * Math.PI * i) / N;
        pd += (i ? "L" : "M") + pr * Math.cos(a) + " " + pr * Math.sin(a);
      }
      emit(pd + "Z", m, layer, name);
      return;
    }
    if (t === "Path" || t === "Line") {
      var V = verts(el);
      if (V.length < 2) return;
      var d = pathD(V, prims(el, V.length));
      if (d) emit(d, m, layer, name);
      return;
    }
    if (t === "Text") {
      warn.texts = (warn.texts || 0) + 1;
      return;
    }
    warn.special = (warn.special || 0) + 1;
  }
  kids(root, "Shape").forEach(function (sh) {
    shape(sh, [1, 0, 0, 1, 0, 0]);
  });
  return { paths: paths, how: unitOverride && unitOverride !== "auto" ? "how.manual" : "how.lbrn", warn: warn };
}
