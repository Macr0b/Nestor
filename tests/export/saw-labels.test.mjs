// Place des numéros de coupe : sur leur trait, sans se chevaucher, en évitant les pièces. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeSawCuts } from "../../src/export/saw-cuts.js";
import { badgeHalfWidth, placeSawLabels } from "../../src/export/saw-labels.js";
import { packRectangles } from "../../src/placement/rectangles.js";

const rectOf = (spot, n) => {
  const h = badgeHalfWidth(spot.r, String(n + 1).length);
  return { x0: spot.x - h, y0: spot.y - spot.r, x1: spot.x + h, y1: spot.y + spot.r };
};
const overlap = (a, b) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

describe("Numéros des coupes à la scie", () => {
  // dernière valeur : part des pastilles admises sur une pièce (pièces plus petites qu'une pastille lisible : la moitié
  // au plus, contre 55 sur 59 au milieu des traits)
  for (const [name, panel, types, gap, maxOnParts] of [
    [
      "panneau d'exemple",
      { L: 400, W: 600 },
      [
        [200, 120, 2],
        [150, 100, 2],
        [60, 60, 4],
        [80, 30, 6]
      ],
      4,
      0.1
    ],
    [
      "grand panneau, pièces groupées",
      { L: 1200, W: 2500 },
      [
        [200, 400, 4],
        [90, 40, 9],
        [600, 300, 2]
      ],
      20,
      0.1
    ],
    [
      "beaucoup de petites pièces",
      { L: 1220, W: 2440 },
      [
        [100, 60, 40],
        [300, 200, 6]
      ],
      4,
      0.5
    ]
  ])
    test(`${name} : pastilles sur leur trait, jamais l'une sur l'autre, rarement sur une pièce`, () => {
      const r = packRectangles(
        { gap, margin: 10, panels: [{ L: panel.L, W: panel.W, qty: "" }] },
        types.map(([w, h, qty]) => ({ w, h, qty, rot: true }))
      );
      for (const s of r.sheets) {
        const cuts = computeSawCuts(s.L, s.W, s.parts, gap, 10),
          radius = Math.max(s.L, s.W) * 0.008,
          spots = placeSawLabels(cuts, s.parts, radius, { w: s.L, h: s.W }),
          rects = spots.map((p, n) => rectOf(p, n)),
          boxes = s.parts.map((p) => ({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h }));
        assert.equal(spots.length, cuts.length);
        spots.forEach((p, n) => {
          // sur le trait, à côté, ou juste au bout : toujours tout près de lui
          const c = cuts[n],
            h = badgeHalfWidth(p.r, String(n + 1).length),
            dx = Math.max(0, Math.min(c.x1, c.x2) - p.x, p.x - Math.max(c.x1, c.x2)),
            dy = Math.max(0, Math.min(c.y1, c.y2) - p.y, p.y - Math.max(c.y1, c.y2));
          assert.ok(dx <= 3 * h + 1e-6 && dy <= 3 * h + 1e-6, `pastille ${n + 1} loin de son trait`);
          // toujours sur le panneau
          const q = rectOf(p, n);
          assert.ok(
            q.x0 >= -1e-6 && q.y0 >= -1e-6 && q.x1 <= s.L + 1e-6 && q.y1 <= s.W + 1e-6,
            `pastille ${n + 1} hors du panneau`
          );
          // jamais plus petite que 60 % de la taille normale (reste lisible)
          assert.ok(p.r >= radius * 0.6 - 1e-9 && p.r <= radius + 1e-9);
        });
        for (let a = 0; a < rects.length; a++)
          for (let b = a + 1; b < rects.length; b++)
            assert.ok(overlap(rects[a], rects[b]) < 1e-6, `pastilles ${a + 1} et ${b + 1} l'une sur l'autre`);
        const onParts = rects.filter((q) => boxes.some((b) => overlap(q, b) > 0.25 * (q.x1 - q.x0) * (q.y1 - q.y0)));
        assert.ok(
          onParts.length <= Math.ceil(rects.length * maxOnParts),
          `${onParts.length}/${rects.length} sur une pièce`
        );
      }
    });
});
