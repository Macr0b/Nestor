/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Ordre des coupes à la scie (méthode Rectangles) : on coupe le panneau d'un bord à l'autre entre les pièces,
   puis chaque morceau de la même façon, jusqu'à ce que chaque morceau ne porte plus qu'une pièce, qu'on détoure.
   Chaque coupe traverse tout le morceau qu'elle coupe (faisable à la scie à panneaux ou sur table).
   Les bords qui ne portent que la marge sont délignés d'abord, une fois pour tout le panneau.
   La lame enlève son épaisseur (kerf) juste après chaque coupe : les morceaux suivants en sont diminués.
   Dans le repère du plan : x vers la droite (largeur du panneau, →), y vers le bas (longueur du panneau, ↑).
   Une coupe « along » (x constant, trait vertical) va dans la longueur ; « across » (y constant) va en travers. */

// marge au-delà du trait de scie : une bande plus fine part avec le trait voisin, sans coupe à elle
const STRIP_SLACK = 0.5;

function boxesIn(region, boxes) {
  return boxes.filter(function (b) {
    return b.x0 >= region.x0 - 1e-6 && b.x1 <= region.x1 + 1e-6 && b.y0 >= region.y0 - 1e-6 && b.y1 <= region.y1 + 1e-6;
  });
}

/* Premier passage libre d'un bord à l'autre du morceau entre deux pièces, dans une direction : position du trait
   au ras des pièces du côté du départ, ou null.
   axis "x" : trait vertical (dans la longueur) ; axis "y" : trait horizontal (en travers). */
function firstGap(region, boxes, axis) {
  var a0 = axis + "0",
    a1 = axis + "1",
    sorted = boxes.slice().sort(function (p, q) {
      return p[a0] - q[a0];
    }),
    reach = -Infinity;
  for (var i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][a0] > reach + 1e-6) return reach;
    reach = Math.max(reach, sorted[i][a1]);
  }
  return null;
}

function cut(region, axis, at, list) {
  var vertical = axis === "x";
  list.push({
    x1: vertical ? at : region.x0,
    y1: vertical ? region.y0 : at,
    x2: vertical ? at : region.x1,
    y2: vertical ? region.y1 : at,
    dir: vertical ? "along" : "across",
    // cote : distance depuis le bord de départ du morceau (gauche ou haut sur le plan)
    at: at - (vertical ? region.x0 : region.y0),
    // morceau coupé, écrit comme les panneaux : longueur (↑) × largeur (→)
    piece: { l: region.y1 - region.y0, w: region.x1 - region.x0 }
  });
}

function halves(region, axis, at) {
  return axis === "x"
    ? [
        { x0: region.x0, y0: region.y0, x1: at, y1: region.y1 },
        { x0: at, y0: region.y0, x1: region.x1, y1: region.y1 }
      ]
    : [
        { x0: region.x0, y0: region.y0, x1: region.x1, y1: at },
        { x0: region.x0, y0: at, x1: region.x1, y1: region.y1 }
      ];
}

/* Une seule pièce dans le morceau : coupes au ras de ses côtés, les plus longues d'abord. */
function trim(region, box, list, minStrip) {
  var r = { x0: region.x0, y0: region.y0, x1: region.x1, y1: region.y1 };
  var sides = [
    { axis: "y", len: r.x1 - r.x0, gapStart: box.y0 - r.y0, gapEnd: r.y1 - box.y1 },
    { axis: "x", len: r.y1 - r.y0, gapStart: box.x0 - r.x0, gapEnd: r.x1 - box.x1 }
  ].sort(function (a, b) {
    return b.len - a.len;
  });
  sides.forEach(function (s) {
    var a0 = s.axis + "0",
      a1 = s.axis + "1";
    if (r[a1] - box[a1] > minStrip) {
      cut(r, s.axis, box[a1], list);
      r[a1] = box[a1];
    }
    if (box[a0] - r[a0] > minStrip) {
      cut(r, s.axis, box[a0], list);
      r[a0] = box[a0];
    }
  });
}

function splitRegion(region, boxes, list, minStrip) {
  if (!boxes.length) return;
  if (boxes.length === 1) {
    trim(region, boxes[0], list, minStrip);
    return;
  }
  // une chute après la dernière pièce part d'abord, d'un seul trait (la plus grande des deux)
  var tail = ["x", "y"]
    .map(function (axis) {
      var reach = Math.max.apply(
          null,
          boxes.map(function (b) {
            return b[axis + "1"];
          })
        ),
        other = axis === "x" ? "y" : "x";
      return {
        axis: axis,
        at: reach,
        area: (region[axis + "1"] - reach) * (region[other + "1"] - region[other + "0"]),
        strip: region[axis + "1"] - reach
      };
    })
    .filter(function (t) {
      return t.strip > minStrip;
    })
    .sort(function (a, b) {
      return b.area - a.area;
    })[0];
  if (tail) {
    cut(region, tail.axis, tail.at, list);
    splitRegion(halves(region, tail.axis, tail.at)[0], boxes, list, minStrip);
    return;
  }
  // puis entre les pièces : d'abord dans le sens de la plus grande dimension du morceau, sinon l'autre
  var long = region.x1 - region.x0 >= region.y1 - region.y0 ? "y" : "x",
    axes = [long, long === "y" ? "x" : "y"];
  for (var k = 0; k < axes.length; k++) {
    var at = firstGap(region, boxes, axes[k]);
    if (at == null) continue;
    cut(region, axes[k], at, list);
    var parts = halves(region, axes[k], at),
      a0 = axes[k] + "0",
      // la lame mange son épaisseur au début du second morceau (jamais au-delà des pièces qui y sont)
      next = Math.min.apply(
        null,
        boxes
          .filter(function (b) {
            return b[a0] >= at - 1e-6;
          })
          .map(function (b) {
            return b[a0];
          })
      );
    parts[1][a0] = Math.min(at + (minStrip - STRIP_SLACK), next);
    parts.forEach(function (h) {
      splitRegion(h, boxesIn(h, boxes), list, minStrip);
    });
    return;
  }
  // pièces imbriquées sans coupe d'un bord à l'autre possible : on s'arrête là (n'arrive pas en Rectangles)
}

/* width × height : panneau sur le plan ; parts : [{ x, y, w, h }] placées ; kerf : trait de scie (l'espace entre
   pièces), retiré par la coupe posée au ras de la pièce ; margin : marge au bord, délignée d'abord.
   Rend les coupes dans l'ordre :
   [{ x1, y1, x2, y2, dir: "along" | "across", at, piece: { l, w } }]. */
export function computeSawCuts(width, height, parts, kerf, margin) {
  var list = [],
    boxes = parts.map(function (p) {
      return { x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h };
    });
  if (!boxes.length) return list;
  var minStrip = Math.max(0, kerf || 0) + STRIP_SLACK,
    region = { x0: 0, y0: 0, x1: width, y1: height },
    edge = Math.max(0, margin || 0) + minStrip,
    bounds = {
      x0: Math.min.apply(
        null,
        boxes.map((b) => b.x0)
      ),
      y0: Math.min.apply(
        null,
        boxes.map((b) => b.y0)
      ),
      x1: Math.max.apply(
        null,
        boxes.map((b) => b.x1)
      ),
      y1: Math.max.apply(
        null,
        boxes.map((b) => b.y1)
      )
    };
  // délignage : bandes de marge le long des bords (dans la longueur d'abord), pas les vraies chutes
  [
    ["x", "0"],
    ["x", "1"],
    ["y", "0"],
    ["y", "1"]
  ].forEach(function (side) {
    var a = side[0] + side[1],
      strip = side[1] === "0" ? bounds[a] - region[a] : region[a] - bounds[a];
    if (strip <= minStrip || strip > edge) return;
    cut(region, side[0], bounds[a], list);
    region[a] = bounds[a];
  });
  splitRegion(region, boxes, list, minStrip);
  return list;
}
