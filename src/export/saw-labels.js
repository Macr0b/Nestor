/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Place des numéros de coupe à la scie : chaque pastille se pose sur son trait, à l'endroit qui couvre le moins les
   pièces et les autres pastilles (dans la chute ou l'espace entre pièces), et au plus près du milieu du trait.
   Les pastilles sont posées dans l'ordre des coupes ; chacune évite celles déjà posées. */

// positions essayées le long du trait (fraction de sa longueur)
const STEPS = 48;

function overlap(a, b) {
  var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
    h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/* Demi-largeur d'une pastille pour un numéro de n chiffres (hauteur 2 × radius). */
export function badgeHalfWidth(radius, digits) {
  return Math.max(radius, radius * (0.62 * digits + 0.45));
}

// tailles essayées quand la pastille ne trouve pas de place libre (fraction de la taille normale)
const SHRINK = [1, 0.8, 0.6];

/* Meilleure place d'une pastille de demi-hauteur radius sur la coupe c : { score, x, y, rect }. */
function bestSpot(c, n, radius, boxes, placed, panel) {
  var half = badgeHalfWidth(radius, String(n + 1).length),
    vertical = c.x1 === c.x2,
    length = Math.hypot(c.x2 - c.x1, c.y2 - c.y1),
    area = 4 * half * radius,
    best = null;
  // le trait est orienté du point 1 au point 2 (de haut en bas ou de gauche à droite)
  var room = vertical ? radius : half,
    ts = [];
  for (var k = 0; k <= STEPS; k++) {
    var t = 0.5 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (1 / STEPS),
      along = t * length;
    // la pastille reste sur la longueur de son trait…
    if (t >= 0 && t <= 1 && (length <= 2 * room || (along >= room && along <= length - room))) ts.push(t);
  }
  // … ou se pose juste au bout, comme une étiquette, quand le trait est trop court ou trop encombré
  if (length > 0) ts.push(-room / length, 1 + room / length, (-3 * room) / length, 1 + (3 * room) / length);
  // sur le trait, ou juste à côté quand le trait longe une pièce
  [0, 1, -1, 2, -2].forEach(function (side) {
    ts.forEach(function (t) {
      var x = c.x1 + (c.x2 - c.x1) * t,
        y = c.y1 + (c.y2 - c.y1) * t;
      if (vertical) x += side * half;
      else y += side * radius;
      var rect = { x0: x - half, y0: y - radius, x1: x + half, y1: y + radius },
        cover = 0,
        crowd = 0;
      boxes.forEach(function (b) {
        cover += overlap(rect, b);
      });
      // hors du panneau : compte comme une pastille sur une autre (elle sortirait du plan)
      if (panel) crowd += area - overlap(rect, panel);
      placed.forEach(function (p) {
        crowd += overlap(rect, p);
      });
      // une pastille sur une autre gêne bien plus qu'une pastille sur une pièce ; près du milieu et sur le trait,
      // c'est mieux ; au bout du trait, seulement si c'est nettement plus lisible
      var outside = t < 0 || t > 1,
        score =
          (cover + 20 * crowd) / area +
          Math.min(Math.abs(t - 0.5), 0.5) * 0.3 +
          Math.abs(side) * 0.05 +
          (outside ? 0.25 : 0);
      if (!best || score < best.score) best = { score: score, x: x, y: y, rect: rect, crowd: crowd, cover: cover };
    });
  });
  return best;
}

/* cuts : coupes (x1, y1, x2, y2) ; parts : [{ x, y, w, h }] ; radius : demi-hauteur normale des pastilles, dans les
   unités du plan ; size : { w, h } du panneau, pour que les pastilles restent dessus.
   Rend [{ x, y, r }] : centre et demi-hauteur de chaque pastille (plus petite quand la place manque). */
export function placeSawLabels(cuts, parts, radius, size) {
  var boxes = parts.map(function (p) {
      return { x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h };
    }),
    placed = [],
    panel = size ? { x0: 0, y0: 0, x1: size.w, y1: size.h } : null;
  return cuts.map(function (c, n) {
    var chosen = null,
      chosenRadius = radius;
    for (var i = 0; i < SHRINK.length; i++) {
      var r = radius * SHRINK[i],
        spot = bestSpot(c, n, r, boxes, placed, panel);
      chosen = spot;
      chosenRadius = r;
      // place libre trouvée (ni pièce, ni autre pastille) : on garde cette taille
      if (spot.crowd < 1e-9 && spot.cover < 1e-9) break;
    }
    placed.push(chosen.rect);
    return { x: chosen.x, y: chosen.y, r: chosenRadius };
  });
}
