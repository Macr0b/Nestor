// Coupes de chutes : traits bord à bord et détaillés. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rect, disc, type } from "../helpers.mjs";
import { computeOffcutCuts } from "../../src/export/offcuts.js";
import { placedPartPaths } from "../../src/geometry/placed-parts.js";
import { nest } from "../../src/placement/nest.js";

// copie simple d'un résultat, pour comparer son contenu
const plain = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
describe("Coupes de chutes (computeOffcutCuts)", () => {
  const box = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
  // distance d'un segment de coupe (horizontal ou vertical) à une boîte ; 0 s'il la traverse
  const segBoxDist = ([x1, y1, x2, y2], b) => {
    const sx0 = Math.min(x1, x2),
      sx1 = Math.max(x1, x2),
      sy0 = Math.min(y1, y2),
      sy1 = Math.max(y1, y2);
    const dx = Math.max(0, b.x0 - sx1, sx0 - b.x1),
      dy = Math.max(0, b.y0 - sy1, sy0 - b.y1);
    return Math.hypot(dx, dy);
  };
  const overlaps = (c, b) =>
    c.x < b.x1 - 1e-6 && c.x + c.w > b.x0 + 1e-6 && c.y < b.y1 - 1e-6 && c.y + c.h > b.y0 + 1e-6;
  // vérifications communes : aucune coupe ne passe à moins de gap d'une pièce, aucune chute ne contient de pièce
  const check = (r, boxes, gap) => {
    for (const c of r.cuts)
      for (const b of boxes) assert.ok(segBoxDist(c, b) >= gap - 1e-6, `coupe ${c} trop près de ${JSON.stringify(b)}`);
    for (const c of r.chutes)
      for (const b of boxes) assert.ok(!overlaps(c, b), `chute ${JSON.stringify(c)} sur une pièce`);
  };

  test("simple, groupe au centre d'un panneau en hauteur : deux traits horizontaux d'un bord à l'autre", () => {
    const boxes = [box(20, 150, 380, 450)];
    const r = computeOffcutCuts(400, 600, boxes, 5, "simple");
    assert.deepEqual(plain(r.cuts), [
      [0, 145, 400, 145],
      [0, 455, 400, 455]
    ]);
    assert.deepEqual(plain(r.chutes.map((c) => [c.w, c.h])), [
      [400, 145],
      [400, 145]
    ]);
    check(r, boxes, 5);
  });

  test("simple : le sens des traits est celui qui libère le plus de matière", () => {
    const r = computeOffcutCuts(1000, 400, [box(10, 10, 300, 390)], 5, "simple");
    assert.equal(r.cuts.length, 1);
    const [x1, y1, x2, y2] = r.cuts[0];
    assert.ok(x1 === x2 && y1 === 0 && y2 === 400, "trait vertical d'un bord à l'autre");
    near(x1, 305);
  });

  test("bande trop fine (moins de 30 mm) : pas de trait", () => {
    const r = computeOffcutCuts(400, 600, [box(10, 10, 390, 580)], 3, "simple");
    assert.deepEqual(plain(r.cuts), []);
  });

  test("détaillé : en plus, des traits perpendiculaires dans la bande restante", () => {
    const boxes = [box(100, 150, 300, 450)];
    const simple = computeOffcutCuts(400, 600, boxes, 5, "simple");
    const detail = computeOffcutCuts(400, 600, boxes, 5, "detail");
    assert.equal(simple.cuts.length, 2);
    assert.equal(detail.cuts.length, 4);
    check(detail, boxes, 5);
  });

  test("détaillé : un groupe en escalier est contourné (trait qui sépare deux groupes de pièces)", () => {
    // un grand bloc en bas à gauche, un petit en haut à gauche : la zone en haut à droite doit être récupérée
    const boxes = [box(10, 10, 100, 300), box(10, 310, 390, 590)];
    const r = computeOffcutCuts(400, 600, boxes, 5, "detail");
    check(r, boxes, 5);
    const big = r.chutes.find((c) => c.w >= 250 && c.h >= 250);
    assert.ok(big, `chute en haut à droite attendue : ${JSON.stringify(plain(r.chutes))}`);
  });

  test("aucune pièce ou mode inconnu : rien", () => {
    assert.deepEqual(plain(computeOffcutCuts(400, 600, [], 5, "detail")), { cuts: [], chutes: [] });
    assert.deepEqual(plain(computeOffcutCuts(400, 600, [box(0, 0, 10, 10)], 5, "")), { cuts: [], chutes: [] });
  });

  test("résultat réel d'imbrication : traits jamais à moins de l'espace entre pièces", () => {
    const L = [
      [0, 0],
      [150, 0],
      [150, 40],
      [40, 40],
      [40, 100],
      [0, 100]
    ];
    const types = [type(rect(200, 120), 2), type(L, 2), type(disc(60), 4), type(rect(80, 30), 6)];
    const res = nest({ panels: [{ L: 800, W: 600, qty: -1 }], gap: 4, margin: 6, types, anchor: { ax: 0.5, ay: 0.5 } });
    for (const s of res.sheets) {
      const boxes = s.parts.map((p) => {
        const pts = placedPartPaths(types[p.i], p).flatMap((q) => q.pts);
        const xs = pts.map((v) => v[0]),
          ys = pts.map((v) => v[1]);
        return box(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      });
      for (const mode of ["simple", "detail"]) {
        const r = computeOffcutCuts(s.L, s.W, boxes, 4, mode);
        assert.ok(r.cuts.length > 0, `aucun trait en mode ${mode}`);
        check(r, boxes, 4);
      }
    }
  });
});
