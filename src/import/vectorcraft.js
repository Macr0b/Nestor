/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture des fichiers VectorCraft (ArtCraft), résultat en mm. */

import { pathToPolylines } from "../geometry/svg-path.js";
import { parseNumber } from "../util/numbers.js";

export function parseVectorCraft(text, unitOverride) {
  var d = JSON.parse(text),
    doc = d && d.document;
  if (!doc || !Array.isArray(doc.layers)) throw new Error("vectorcraft");
  var f = unitOverride && unitOverride !== "auto" ? parseNumber(unitOverride, 1) : 25.4 / 72,
    paths = [],
    warn = {};
  function pointText(p) {
    return p[0] + " " + p[1];
  }
  function hex(appr) {
    var it = (appr && appr.items) || [],
      c = null;
    it.forEach(function (x) {
      if (x.kind === "stroke" && x.paint && x.paint.type === "solid") c = x.paint.color;
    });
    if (!c)
      it.forEach(function (x) {
        if (!c && x.kind === "fill" && x.paint && x.paint.type === "solid") c = x.paint.color;
      });
    if (!c || c.r == null) return "";
    return (
      "#" +
      [c.r, c.g, c.b]
        .map(function (v) {
          return ("0" + Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16)).slice(-2);
        })
        .join("")
    );
  }
  function addPath(node, kind, layer, name, appr) {
    ((kind.path && kind.path.subpaths) || []).forEach(function (sp) {
      var A = sp.anchors || [];
      if (A.length < 2) return;
      var dd = "M" + pointText(A[0].p);
      function seg(a, b) {
        dd +=
          a.out || b.in
            ? "C" + pointText(a.out || a.p) + " " + pointText(b.in || b.p) + " " + pointText(b.p)
            : "L" + pointText(b.p);
      }
      for (var i = 1; i < A.length; i++) seg(A[i - 1], A[i]);
      if (sp.closed) {
        seg(A[A.length - 1], A[0]);
        dd += "Z";
      }
      var polylines;
      try {
        polylines = pathToPolylines(dd, f, function (q) {
          return [q[0] * f, q[1] * f];
        });
      } catch (e) {
        warn.paths = (warn.paths || 0) + 1;
        return;
      }
      polylines.forEach(function (polyline) {
        paths.push({ pts: polyline.pts, closed: polyline.closed, layer: layer, color: hex(appr), name: name });
      });
    });
  }
  function walk(n, layer, name, appr) {
    if (!n || n.visible === false) return;
    var k = n.kind || {},
      t = k.type,
      nm = n.name || name,
      ap = n.appearance || appr;
    if (t === "layer") {
      (k.children || []).forEach(function (c) {
        walk(c, n.name || layer, "", null);
      });
      return;
    }
    if (t === "group" || t === "compound") {
      (k.children || []).forEach(function (c) {
        walk(c, layer, nm, t === "compound" ? ap : null);
      });
      return;
    }
    if (t === "path") {
      addPath(n, k, layer, nm, n.appearance || appr);
      return;
    }
    if (t === "text") {
      warn.texts = (warn.texts || 0) + 1;
      return;
    }
    warn.special = (warn.special || 0) + 1;
  }
  doc.layers.forEach(function (L) {
    walk(L, "", "", null);
  });
  return { paths: paths, how: unitOverride && unitOverride !== "auto" ? "how.manual" : "how.vc", warn: warn };
}
