// Regroupement des contours en pièces et en types de pièces. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rect } from "../helpers.mjs";
import { buildPartTypes, groupPieces } from "../../src/geometry/grouping.js";

describe("Regroupement en types de pièces", () => {
  test("pièces identiques fusionnées, noms différents gardés à part", () => {
    const p = (x, name) => ({ pts: rect(50, 30, x, 0), closed: true, layer: "", color: "", name });
    const types = buildPartTypes(groupPieces([p(0, "A"), p(100, "A"), p(200, "B")]).pieces);
    assert.equal(types.length, 2);
    assert.equal(types.find((t) => t.name === "A").qty, 2);
    assert.equal(types.find((t) => t.name === "B").qty, 1);
  });

  test("un trou nommé ne renomme pas la pièce", () => {
    const outer = { pts: rect(100, 100), closed: true, layer: "", color: "", name: "" };
    const hole = { pts: rect(20, 20, 40, 40), closed: true, layer: "", color: "", name: "Trou" };
    const t = buildPartTypes(groupPieces([outer, hole]).pieces);
    assert.equal(t.length, 1);
    assert.equal(t[0].name, "");
  });

  test("formes imbriquées (cadres qui se chevauchent) : chaque trait va dans la pièce qui le contient", () => {
    // deux « L » emboîtés : le cadre de A (0–100) couvre le pied de B
    const shape = (pts, name) => ({ pts, closed: true, layer: "", color: "", name });
    const line = (pts) => ({ pts, closed: false, layer: "", color: "#000" });
    const A = shape(
      [
        [0, 0],
        [100, 0],
        [100, 20],
        [20, 20],
        [20, 100],
        [0, 100]
      ],
      "A"
    );
    const B = shape(
      [
        [30, 30],
        [140, 30],
        [140, 120],
        [30, 120]
      ],
      "B"
    );
    // trait dans B mais dans le cadre de A ; trait de A ; trait de B qui déborde à peine du cadre de B
    const inB = line([
      [60, 60],
      [90, 90]
    ]);
    const inA = line([
      [5, 5],
      [15, 80]
    ]);
    const overB = line([
      [100, 100],
      [138, 110],
      [139, 118],
      [141, 119]
    ]);
    const pieces = groupPieces([A, B, inB, inA, overB]).pieces;
    const byName = (n) => pieces.find((p) => p.name === n);
    assert.equal(pieces.length, 2);
    assert.equal(byName("A").paths.length, 2);
    assert.equal(byName("B").paths.length, 3);
    // le cadre de B englobe le trait qui déborde
    assert.equal(byName("B").w, 111);
  });
});
