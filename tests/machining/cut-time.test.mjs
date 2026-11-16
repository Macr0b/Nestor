// Temps de découpe estimé et longueur des contours extérieurs. Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCutTime, splitDuration } from "../../src/machining/cut-time.js";
import { outerContourLength } from "../../src/geometry/polylines.js";

const square = (x, y, s) => ({
  closed: true,
  pts: [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s]
  ]
});

test("contour extérieur seulement : le trou et les traits intérieurs ne comptent pas", () => {
  const part = {
    w: 100,
    h: 100,
    paths: [
      square(0, 0, 100),
      square(40, 40, 20),
      {
        closed: false,
        pts: [
          [10, 10],
          [90, 10]
        ]
      }
    ]
  };
  assert.equal(outerContourLength(part), 400);
});

test("pièce sans tracé fermé : le tour de son rectangle", () => {
  assert.equal(
    outerContourLength({
      w: 30,
      h: 20,
      paths: [
        {
          closed: false,
          pts: [
            [0, 0],
            [30, 20]
          ]
        }
      ]
    }),
    100
  );
});

test("temps = longueur × passes ÷ avance", () => {
  const t = estimateCutTime(19100, { feed: 1910, passes: 6 });
  assert.equal(t.minutes, 60);
  assert.equal(t.passes, 6);
  assert.equal(estimateCutTime(19100, { feed: 1910, passes: 0 }), null, "sans épaisseur, pas d'estimation");
  assert.equal(estimateCutTime(19100, null), null);
  assert.equal(estimateCutTime(0, { feed: 1910, passes: 6 }), null);
});

test("durée affichée : minutes entières, heures au-delà de 60", () => {
  assert.deepEqual(splitDuration(42.4), { hours: 0, minutes: 42 });
  assert.deepEqual(splitDuration(85), { hours: 1, minutes: 25 });
  assert.deepEqual(splitDuration(0.2), { hours: 0, minutes: 1 });
});
