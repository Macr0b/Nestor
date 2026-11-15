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
});
