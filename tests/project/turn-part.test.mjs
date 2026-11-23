// Quart de tour d'une pièce en sens fixe. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { turnPart } from "../../src/project/turn-part.js";

// pièce 200 × 120 avec un repère près du coin haut gauche (y vers le bas)
const piece = () => ({
  w: 200,
  h: 120,
  scale: "50",
  paths: [
    {
      closed: true,
      pts: [
        [0, 0],
        [200, 0],
        [200, 120],
        [0, 120]
      ]
    },
    { closed: false, pts: [[10, 20]] }
  ]
});

describe("Pièces", () => {
  test("quart de tour à droite : taille inversée, dessin tourné dans le sens des aiguilles d'une montre", () => {
    const p = piece();
    turnPart(p, 1);
    assert.equal(p.w, 120);
    assert.equal(p.h, 200);
    assert.equal(p.turn, 1);
    // le repère près du coin haut gauche passe près du coin haut droit
    assert.deepEqual(p.paths[1].pts[0], [100, 10]);
    for (const q of p.paths[0].pts) assert.ok(q[0] >= 0 && q[0] <= 120 && q[1] >= 0 && q[1] <= 200);
  });

  test("à gauche puis à droite : retour exact ; quatre quarts de tour : retour exact", () => {
    const p = piece();
    turnPart(p, -1);
    assert.equal(p.turn, 3);
    assert.deepEqual(p.paths[1].pts[0], [20, 190]);
    turnPart(p, 1);
    assert.deepEqual(p.paths, piece().paths);
    assert.equal(p.turn, 0);
    for (let k = 0; k < 4; k++) turnPart(p, 1);
    assert.deepEqual(p.paths, piece().paths);
    assert.equal(p.w, 200);
  });
});
