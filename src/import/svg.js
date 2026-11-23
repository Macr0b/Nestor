/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture des fichiers SVG (et SVGZ une fois décompressés) : formes, calques, noms, unités. */

import { pathToPolylines } from "../geometry/svg-path.js";
import { translate } from "../i18n/i18n.js";
import { sanitizeSvg } from "./svg-sanitize.js";
import { byId } from "../util/dom.js";
import { parseNumber } from "../util/numbers.js";

function svgUnitToMm(value) {
  var m = /^\s*([+-]?[\d.]+(?:e[+-]?\d+)?)\s*([a-z%]*)\s*$/i.exec(value || "");
  if (!m) return null;
  var x = parseFloat(m[1]),
    u = m[2].toLowerCase();
  var f = { mm: 1, cm: 10, in: 25.4, pt: 0.352778, pc: 4.23333, px: null, "": null }[u];
  return f === undefined ? null : f === null ? { px: x } : { mm: x * f };
}

function shapeToPathData(element) {
  var t = element.tagName.toLowerCase(),
    a = function (n) {
      return parseNumber(element.getAttribute(n), 0);
    };
  if (t === "path") return element.getAttribute("d") || "";
  if (t === "rect") {
    var x = a("x"),
      y = a("y"),
      w = a("width"),
      h = a("height"),
      rx = element.hasAttribute("rx") ? a("rx") : element.hasAttribute("ry") ? a("ry") : 0,
      ry = element.hasAttribute("ry") ? a("ry") : rx;
    if (w <= 0 || h <= 0) return "";
    rx = Math.min(rx, w / 2);
    ry = Math.min(ry, h / 2);
    if (!rx || !ry) return "M" + x + " " + y + "H" + (x + w) + "V" + (y + h) + "H" + x + "Z";
    return (
      "M" +
      (x + rx) +
      " " +
      y +
      "H" +
      (x + w - rx) +
      "A" +
      rx +
      " " +
      ry +
      " 0 0 1 " +
      (x + w) +
      " " +
      (y + ry) +
      "V" +
      (y + h - ry) +
      "A" +
      rx +
      " " +
      ry +
      " 0 0 1 " +
      (x + w - rx) +
      " " +
      (y + h) +
      "H" +
      (x + rx) +
      "A" +
      rx +
      " " +
      ry +
      " 0 0 1 " +
      x +
      " " +
      (y + h - ry) +
      "V" +
      (y + ry) +
      "A" +
      rx +
      " " +
      ry +
      " 0 0 1 " +
      (x + rx) +
      " " +
      y +
      "Z"
    );
  }
  if (t === "circle" || t === "ellipse") {
    var cx = a("cx"),
      cy = a("cy"),
      erx = t === "circle" ? a("r") : a("rx"),
      ery = t === "circle" ? a("r") : a("ry");
    if (erx <= 0 || ery <= 0) return "";
    return (
      "M" +
      (cx + erx) +
      " " +
      cy +
      "A" +
      erx +
      " " +
      ery +
      " 0 1 1 " +
      (cx - erx) +
      " " +
      cy +
      "A" +
      erx +
      " " +
      ery +
      " 0 1 1 " +
      (cx + erx) +
      " " +
      cy +
      "Z"
    );
  }
  if (t === "line") return "M" + a("x1") + " " + a("y1") + "L" + a("x2") + " " + a("y2");
  if (t === "polyline" || t === "polygon") {
    var p = (element.getAttribute("points") || "").trim();
    if (!p) return "";
    var nums = p.split(/[\s,]+/);
    var d = "M" + nums[0] + " " + nums[1];
    for (var i = 2; i + 1 < nums.length; i += 2) d += "L" + nums[i] + " " + nums[i + 1];
    return d + (t === "polygon" ? "Z" : "");
  }
  return "";
}

export function parseSvg(text, unitOverride) {
  var doc = new DOMParser().parseFromString(text, "image/svg+xml");
  var root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length)
    throw new Error(translate("err.svg"));
  var host = byId("svgScratch");
  host.innerHTML = "";
  var svg = sanitizeSvg(root);
  host.appendChild(svg);
  try {
    var vb = (svg.getAttribute("viewBox") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number),
      hasVB = vb.length === 4 && vb[2] > 0;
    var wa = svgUnitToMm(svg.getAttribute("width")),
      ill = /Illustrator/i.test(text),
      f,
      how;
    if (unitOverride && unitOverride !== "auto") {
      f = parseNumber(unitOverride, 1);
      how = "how.manual";
    } else if (wa && wa.mm && hasVB) {
      f = wa.mm / vb[2];
      how = "how.doc";
    } else if (wa && wa.mm && !hasVB) {
      f = 1;
      how = "how.mm";
    } else {
      var unit = ill ? 0.352778 : 0.264583;
      f = unit * (wa && wa.px && hasVB ? wa.px / vb[2] : 1);
      how = ill ? "how.ai" : "how.px";
    }
    var rootM = svg.getScreenCTM(),
      inv = rootM ? rootM.inverse() : null,
      paths = [],
      warn = {};
    // noms : Inkscape (inkscape:label), Illustrator (data-name ou id encodé), sinon id lisible
    var AUTO =
      /^(path|rect|circle|ellipse|line|polyline|polygon|g|layer|svg|use|text|tspan|group|shape|clippath|mask)[-_ ]?\d+$/i;
    function nameOf(n) {
      var v =
        n.getAttribute("inkscape:label") ||
        n.getAttributeNS("http://www.inkscape.org/namespaces/inkscape", "label") ||
        n.getAttribute("data-name");
      if (v) return v.trim();
      var id = n.getAttribute("id");
      if (!id || AUTO.test(id)) return "";
      if (ill)
        id = id
          .replace(/_\d+_$/, "")
          .replace(/_x([0-9A-Fa-f]{2,4})_|_/g, function (m, h) {
            return h ? String.fromCharCode(parseInt(h, 16)) : " ";
          })
          .trim();
      return id;
    }
    function isLayer(g) {
      return (
        (g.getAttribute("inkscape:groupmode") ||
          g.getAttributeNS("http://www.inkscape.org/namespaces/inkscape", "groupmode")) === "layer"
      );
    }
    var hasInkLayers = !!Array.prototype.some.call(svg.querySelectorAll("g"), isLayer);
    svg.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon").forEach(function (el) {
      if (el.closest("defs,clipPath,mask,pattern,marker,symbol")) return;
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      var d = shapeToPathData(el);
      if (!d) return;
      var m = inv && el.getScreenCTM() ? inv.multiply(el.getScreenCTM()) : new DOMMatrix();
      var sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
      var col = cs.stroke && cs.stroke !== "none" ? cs.stroke : cs.fill && cs.fill !== "none" ? cs.fill : "";
      var layer = "",
        nm = nameOf(el),
        g = el.parentElement,
        chainG = [];
      while (g && g !== svg) {
        if (g.tagName.toLowerCase() === "g") chainG.push(g);
        g = g.parentElement;
      }
      // calque : le plus haut calque Inkscape, sinon le groupe de premier niveau (calque Illustrator)
      var lg = null;
      if (hasInkLayers) {
        for (var ci = chainG.length - 1; ci >= 0; ci--)
          if (isLayer(chainG[ci])) {
            lg = chainG[ci];
            break;
          }
      } else lg = chainG[chainG.length - 1] || null;
      if (lg) layer = nameOf(lg);
      // nom : celui du tracé, sinon celui du groupe le plus proche sous le calque
      if (!nm)
        for (var cj = 0; cj < chainG.length && chainG[cj] !== lg; cj++) {
          if (isLayer(chainG[cj])) break;
          var gn = nameOf(chainG[cj]);
          if (gn) {
            nm = gn;
            break;
          }
        }
      var polylines;
      try {
        polylines = pathToPolylines(d, sc * f, function (q) {
          return [(m.a * q[0] + m.c * q[1] + m.e) * f, (m.b * q[0] + m.d * q[1] + m.f) * f];
        });
      } catch (e) {
        warn.paths = (warn.paths || 0) + 1;
        return;
      }
      polylines.forEach(function (polyline) {
        paths.push({ pts: polyline.pts, closed: polyline.closed, layer: layer, color: col, name: nm });
      });
    });
    var nt = svg.querySelectorAll("text").length;
    if (nt) warn.texts = nt;
    var nu = svg.querySelectorAll("use").length;
    if (nu) warn.symbols = nu;
    return { paths: paths, how: how, warn: warn };
  } finally {
    host.innerHTML = "";
  }
}
