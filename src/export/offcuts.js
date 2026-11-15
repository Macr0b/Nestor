/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Coupes de chutes : traits droits qui séparent les pièces placées du reste du panneau, pour récupérer des
   chutes rectangulaires. Chaque trait va d'un bord à l'autre de la zone qu'il coupe (faisable à la scie) et passe
   à « gap » mm des pièces les plus proches.
     mode "simple" : une seule série de traits parallèles, d'un bord à l'autre du panneau ;
     mode "detail" : on recoupe ensuite les zones restantes pour suivre à peu près le contour du groupe. */

export const MIN_OFFCUT_SIZE = 30;

const MAX_CUT_DEPTH = 4;

function boxesInside(region, boxes) {
  return boxes.filter(function (b) {
    return b.x0 >= region.x0 - 1e-6 && b.x1 <= region.x1 + 1e-6 && b.y0 >= region.y0 - 1e-6 && b.y1 <= region.y1 + 1e-6;
  });
}

function boundsOfBoxes(boxes) {
  var bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  boxes.forEach(function (b) {
    bounds.x0 = Math.min(bounds.x0, b.x0);
    bounds.y0 = Math.min(bounds.y0, b.y0);
    bounds.x1 = Math.max(bounds.x1, b.x1);
    bounds.y1 = Math.max(bounds.y1, b.y1);
  });
  return bounds;
}

// chutes possibles sur les 4 côtés de la zone R : épaisseur de chaque bande libre (0 si trop fine)
function freeStrips(region, boxes, gap) {
  var bounds = boundsOfBoxes(boxes);
  function ok(v) {
    return v >= MIN_OFFCUT_SIZE ? v : 0;
  }
  return {
    top: ok(bounds.y0 - gap - region.y0),
    bottom: ok(region.y1 - (bounds.y1 + gap)),
    left: ok(bounds.x0 - gap - region.x0),
    right: ok(region.x1 - (bounds.x1 + gap))
  };
}

// coupe les bandes libres d'une orientation ("h" : traits horizontaux, "v" : verticaux) ; renvoie la zone restante
function cutFreeStrips(region, strips, direction, out) {
  var rest = { x0: region.x0, y0: region.y0, x1: region.x1, y1: region.y1 };
  if (rest.x1 - rest.x0 < MIN_OFFCUT_SIZE || rest.y1 - rest.y0 < MIN_OFFCUT_SIZE) return rest;
  if (direction === "h") {
    if (strips.top) {
      var yt = rest.y0 + strips.top;
      out.cuts.push([rest.x0, yt, rest.x1, yt]);
      out.chutes.push({ x: rest.x0, y: rest.y0, w: rest.x1 - rest.x0, h: strips.top });
      rest.y0 = yt;
    }
    if (strips.bottom) {
      var yb = rest.y1 - strips.bottom;
      out.cuts.push([rest.x0, yb, rest.x1, yb]);
      out.chutes.push({ x: rest.x0, y: yb, w: rest.x1 - rest.x0, h: strips.bottom });
      rest.y1 = yb;
    }
  } else {
    if (strips.left) {
      var xl = rest.x0 + strips.left;
      out.cuts.push([xl, rest.y0, xl, rest.y1]);
      out.chutes.push({ x: rest.x0, y: rest.y0, w: strips.left, h: rest.y1 - rest.y0 });
      rest.x0 = xl;
    }
    if (strips.right) {
      var xr = rest.x1 - strips.right;
      out.cuts.push([xr, rest.y0, xr, rest.y1]);
      out.chutes.push({ x: xr, y: rest.y0, w: strips.right, h: rest.y1 - rest.y0 });
      rest.x1 = xr;
    }
  }
  return rest;
}

// aire libérée par les bandes d'une orientation
function freeStripArea(region, strips, direction) {
  return direction === "h"
    ? (strips.top + strips.bottom) * (region.x1 - region.x0)
    : (strips.left + strips.right) * (region.y1 - region.y0);
}

// détoure une zone : d'abord l'orientation qui libère le plus, puis (si both) la perpendiculaire
function trimRegion(region, boxes, gap, bothDirections, out) {
  var strips = freeStrips(region, boxes, gap),
    first = freeStripArea(region, strips, "h") >= freeStripArea(region, strips, "v") ? "h" : "v";
  var rest = cutFreeStrips(region, strips, first, out);
  if (bothDirections) rest = cutFreeStrips(rest, freeStrips(rest, boxes, gap), first === "h" ? "v" : "h", out);
  return rest;
}

// traits qui séparent les pièces de la zone en deux groupes, à au moins gap de chaque pièce
function splitCandidates(region, boxes, gap) {
  var found = [];
  ["v", "h"].forEach(function (dir) {
    var a0 = dir === "v" ? "x0" : "y0",
      a1 = dir === "v" ? "x1" : "y1";
    var sorted = boxes.slice().sort(function (p, q) {
      return p[a0] - q[a0];
    });
    var reach = -Infinity;
    for (var i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i][a0] - reach >= 2 * gap && sorted[i][a0] - reach > 0) {
        found.push({ dir: dir, at: (reach + sorted[i][a0]) / 2 });
      }
      reach = Math.max(reach, sorted[i][a1]);
    }
  });
  return found;
}

function splitHalves(region, split) {
  if (split.dir === "v")
    return [
      { x0: region.x0, y0: region.y0, x1: split.at, y1: region.y1 },
      { x0: split.at, y0: region.y0, x1: region.x1, y1: region.y1 }
    ];
  return [
    { x0: region.x0, y0: region.y0, x1: region.x1, y1: split.at },
    { x0: region.x0, y0: split.at, x1: region.x1, y1: region.y1 }
  ];
}

// aire que libérerait un détourage d'une zone (sans rien enregistrer)
function trimmedArea(region, boxes, gap) {
  var tmp = { cuts: [], chutes: [] };
  trimRegion(region, boxes, gap, true, tmp);
  return tmp.chutes.reduce(function (a, c) {
    return a + c.w * c.h;
  }, 0);
}

// mode détaillé : on cherche le trait qui, en séparant deux groupes de pièces, libère le plus de chutes
function splitRegion(region, boxes, gap, depth, out) {
  if (depth >= MAX_CUT_DEPTH || boxes.length < 2) return;
  var best = null;
  splitCandidates(region, boxes, gap).forEach(function (c) {
    var hs = splitHalves(region, c),
      gain = 0;
    hs.forEach(function (h) {
      var inside = boxesInside(h, boxes);
      if (inside.length) gain += trimmedArea(h, inside, gap);
    });
    if (gain > 0 && (!best || gain > best.gain)) best = { c: c, gain: gain };
  });
  if (!best) return;
  var split = best.c;
  out.cuts.push(
    split.dir === "v" ? [split.at, region.y0, split.at, region.y1] : [region.x0, split.at, region.x1, split.at]
  );
  splitHalves(region, split).forEach(function (h) {
    var inside = boxesInside(h, boxes);
    if (!inside.length) return;
    var r = trimRegion(h, inside, gap, true, out);
    splitRegion(r, inside, gap, depth + 1, out);
  });
}

export function computeOffcutCuts(panelWidth, panelHeight, boxes, gap, mode) {
  var out = { cuts: [], chutes: [] };
  if (!boxes.length || (mode !== "simple" && mode !== "detail")) return out;
  gap = Math.max(0, gap || 0);
  var panel = { x0: 0, y0: 0, x1: panelWidth, y1: panelHeight };
  if (mode === "simple") {
    trimRegion(panel, boxes, gap, false, out);
    return out;
  }
  var rest = trimRegion(panel, boxes, gap, true, out);
  splitRegion(rest, boxes, gap, 0, out);
  return out;
}
