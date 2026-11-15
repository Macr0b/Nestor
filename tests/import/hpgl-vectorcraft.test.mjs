// Lecture des fichiers HPGL et VectorCraft. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers.mjs";
import { buildPartTypes, groupPieces } from "../../src/geometry/grouping.js";
import { parseHpgl } from "../../src/import/hpgl.js";
import { parseVectorCraft } from "../../src/import/vectorcraft.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
describe("Lecture HPGL et VectorCraft", () => {
  test("HPGL : 40 unités = 1 mm, un calque par stylo, cercle CI", () => {
    const r = parseHpgl(fixture("test.plt"), "auto");
    const types = buildPartTypes(groupPieces(r.paths).pieces);
    assert.equal(types.length, 2);
    const big = types.find((t) => Math.round(t.w) === 100);
    near(big.h, 50);
    assert.equal(big.layer, "SP1");
    assert.equal(big.paths.length, 2, "rectangle + cercle intérieur");
    assert.ok(types.some((t) => t.layer === "SP2" && Math.round(t.w) === 25));
  });

  test("VectorCraft : points → mm, nom et calque gardés, objets cachés et textes ignorés", () => {
    const r = parseVectorCraft(fixture("mini.vectorcraft"), "auto");
    const types = buildPartTypes(groupPieces(r.paths).pieces);
    assert.equal(types.length, 1);
    near(types[0].w, 100, 0.05);
    near(types[0].h, 50, 0.05);
    assert.equal(types[0].name, "Façade");
    assert.equal(types[0].layer, "Découpe");
    assert.equal(r.warn.texts, 1);
  });
});
