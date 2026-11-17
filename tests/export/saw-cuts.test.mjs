// Ordre des coupes à la scie (méthode Rectangles). Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeSawCuts } from "../../src/export/saw-cuts.js";
import { packRectangles } from "../../src/placement/rectangles.js";

const near = (a, b) => Math.abs(a - b) < 1e-6;

/* Rejoue les coupes dans l'ordre sur le panneau : chaque coupe doit traverser d'un bord à l'autre un morceau
   existant (sinon la scie ne peut pas la faire), sans entrer dans une pièce ; à la fin, chaque pièce est un
   morceau à elle seule, à ses cotes exactes. */
function replay(L, W, parts, cuts, kerf = 0) {
  let pieces = [{ x0: 0, y0: 0, x1: L, y1: W }];
  const boxes = parts.map((p) => ({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h }));
  cuts.forEach((c, n) => {
    const across = c.x1 === c.x2;
    const i = pieces.findIndex((r) =>
      across
        ? near(c.y1, r.y0) && near(c.y2, r.y1) && c.x1 > r.x0 + 1e-6 && c.x1 < r.x1 - 1e-6
        : near(c.x1, r.x0) && near(c.x2, r.x1) && c.y1 > r.y0 + 1e-6 && c.y1 < r.y1 - 1e-6
    );
    assert.ok(i >= 0, `coupe ${n + 1} ne traverse aucun morceau : ${JSON.stringify(c)}`);
    const r = pieces[i];
    assert.equal(c.dir, across ? "along" : "across"); // trait vertical = dans la longueur (↑)
    assert.ok(near(c.at, across ? c.x1 - r.x0 : c.y1 - r.y0), `cote de la coupe ${n + 1}`);
    assert.deepEqual(
      [c.piece.l, c.piece.w].map((v) => Math.round(v * 1000)),
      [r.y1 - r.y0, r.x1 - r.x0].map((v) => Math.round(v * 1000))
    );
    for (const b of boxes) {
      const inside = across
        ? c.x1 > b.x0 + 1e-6 && c.x1 < b.x1 - 1e-6 && b.y1 > r.y0 && b.y0 < r.y1
        : c.y1 > b.y0 + 1e-6 && c.y1 < b.y1 - 1e-6 && b.x1 > r.x0 && b.x0 < r.x1;
      assert.ok(!inside, `coupe ${n + 1} traverse une pièce`);
    }
    pieces.splice(
      i,
      1,
      ...(across
        ? [
            { ...r, x1: c.x1 },
            { ...r, x0: c.x1 }
          ]
        : [
            { ...r, y1: c.y1 },
            { ...r, y0: c.y1 }
          ])
    );
  });
  // à la fin, chaque pièce est seule dans son morceau, à un trait de scie près
  const close = (a, b) => a - b <= kerf + 0.5 + 1e-6 && b - a <= kerf + 0.5 + 1e-6;
  for (const b of boxes)
    assert.ok(
      pieces.some(
        (r) =>
          r.x0 <= b.x0 + 1e-6 &&
          r.x1 >= b.x1 - 1e-6 &&
          r.y0 <= b.y0 + 1e-6 &&
          r.y1 >= b.y1 - 1e-6 &&
          close(b.x0, r.x0) &&
          close(r.x1, b.x1) &&
          close(b.y0, r.y0) &&
          close(r.y1, b.y1) &&
          boxes.filter((o) => o.x0 < r.x1 && o.x1 > r.x0 && o.y0 < r.y1 && o.y1 > r.y0).length === 1
      ),
      `pièce non dégagée : ${JSON.stringify(b)}`
    );
}

describe("Ordre des coupes à la scie", () => {
  test("deux pièces côte à côte : coupe en travers entre elles, puis détourage", () => {
    const parts = [
      { x: 10, y: 10, w: 300, h: 200 },
      { x: 314, y: 10, w: 300, h: 200 }
    ];
    const cuts = computeSawCuts(1000, 500, parts);
    replay(1000, 500, parts, cuts);
    // plan de 1000 de large sur 500 de haut : d'abord la bande de 210 mm qui porte les pièces (trait horizontal,
    // donc en travers de la longueur ↑ du panneau), sur tout le panneau
    assert.deepEqual([cuts[0].dir, cuts[0].at], ["across", 210]);
    assert.deepEqual(cuts[0].piece, { l: 500, w: 1000 });
  });

  test("une seule pièce sans marge, collée dans le coin : deux coupes seulement", () => {
    const parts = [{ x: 0, y: 0, w: 300, h: 200 }];
    const cuts = computeSawCuts(1000, 500, parts);
    replay(1000, 500, parts, cuts);
    assert.equal(cuts.length, 2);
  });

  test("pièces séparées par le trait de scie : une coupe entre elles, pas deux", () => {
    const parts = [
      { x: 0, y: 0, w: 300, h: 500 },
      { x: 304, y: 0, w: 300, h: 500 }
    ];
    const cuts = computeSawCuts(604, 500, parts, 4);
    replay(604, 500, parts, cuts, 4);
    assert.equal(cuts.length, 1);
    assert.deepEqual([cuts[0].dir, cuts[0].at], ["along", 300]);
    // sans trait déclaré, la bande de 4 mm est détachée à part
    assert.equal(computeSawCuts(604, 500, parts, 0).length, 2);
  });

  test("marge : délignée une fois au début, pas recoupée pièce par pièce ; une vraie chute n'est pas délignée", () => {
    // trois pièces en colonne contre le bord gauche, marge de 10 mm en haut, à gauche et en bas
    const parts = [0, 1, 2].map((k) => ({ x: 10, y: 10 + k * 104, w: 200, h: 100 }));
    const cuts = computeSawCuts(1000, 328, parts, 4, 10);
    replay(1000, 328, parts, cuts, 4);
    // délignage : gauche (dans la longueur), puis haut et bas (en travers) ; la droite est une chute de 790
    assert.deepEqual(
      cuts.slice(0, 3).map((c) => [c.dir, c.x1 === c.x2 ? c.x1 : c.y1]),
      [
        ["along", 10],
        ["across", 10],
        ["across", 318]
      ]
    );
    // puis la chute de droite d'un seul trait, puis deux coupes entre les trois pièces : 6 en tout
    assert.deepEqual([cuts[3].dir, cuts[3].x1, cuts[3].piece.l], ["along", 210, 308]);
    assert.equal(cuts.length, 6);
  });

  test("pièce qui remplit le panneau : aucune coupe", () => {
    assert.deepEqual(computeSawCuts(500, 300, [{ x: 0, y: 0, w: 500, h: 300 }]), []);
    assert.deepEqual(computeSawCuts(500, 300, []), []);
  });

  for (const [name, origin] of [
    ["coin haut gauche", { fx: false, fy: false }],
    ["coin bas droite", { fx: true, fy: true }]
  ])
    test(`résultat réel de la méthode Rectangles (${name}) : toutes les coupes faisables, toutes les pièces dégagées`, () => {
      const types = [
        { w: 720, h: 560, qty: 2, rot: false },
        { w: 520, h: 300, qty: 3, rot: true },
        { w: 700, h: 500, qty: 1, rot: true },
        { w: 90, h: 40, qty: 9, rot: true },
        { w: 1200, h: 80, qty: 4, rot: false }
      ];
      const r = packRectangles({ gap: 4, margin: 10, panels: [{ L: 2500, W: 1220, qty: "" }] }, types);
      assert.equal(r.count, r.total);
      for (const s of r.sheets) {
        // l'origine retourne le plan : x ou y lus depuis l'autre bord
        const parts = s.parts.map((p) => ({
          x: origin.fx ? s.L - p.x - p.w : p.x,
          y: origin.fy ? s.W - p.y - p.h : p.y,
          w: p.w,
          h: p.h
        }));
        const cuts = computeSawCuts(s.L, s.W, parts, 4, 10);
        replay(s.L, s.W, parts, cuts, 4);
        // pas de coupe pour un simple trait de scie : au plus une séparation et deux bords par pièce, environ
        assert.ok(cuts.length >= parts.length && cuts.length <= 3 * parts.length, `${cuts.length} coupes`);
      }
    });
});
