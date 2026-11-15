// Lecture des fichiers DXF. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers.mjs";
import { groupPieces } from "../../src/geometry/grouping.js";
import { parseDxf } from "../../src/import/dxf.js";

// copie simple d'un résultat, pour comparer son contenu
const plain = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
describe("Lecture DXF", () => {
  test("plaque avec trou + disque : 2 pièces, le trou reste dans la plaque", () => {
    const r = parseDxf(fixture("plaque-trou.dxf"), "auto");
    const g = groupPieces(r.paths);
    assert.equal(g.pieces.length, 2);
    const plaque = g.pieces.find((p) => Math.round(p.w) === 200);
    assert.ok(plaque, "plaque 200 mm trouvée");
    near(plaque.h, 100);
    assert.equal(plaque.paths.length, 2, "contour + trou");
    assert.equal(plaque.layer, "DECOUPE");
  });

  test("4 segments LINE séparés sont chaînés en un contour fermé", () => {
    const g = groupPieces(parseDxf(fixture("lignes.dxf"), "auto").paths);
    assert.equal(g.pieces.length, 1);
    near(g.pieces[0].w, 80);
    near(g.pieces[0].h, 40);
    assert.ok(g.pieces[0].paths[0].closed, "contour fermé");
  });

  test("unités du fichier ($INSUNITS = pouces) converties en mm", () => {
    const g = groupPieces(parseDxf(fixture("pouces.dxf"), "auto").paths);
    near(g.pieces[0].w, 50.8);
    near(g.pieces[0].h, 25.4);
  });

  test("réglage manuel des unités prioritaire", () => {
    const g = groupPieces(parseDxf(fixture("pouces.dxf"), "10").paths);
    near(g.pieces[0].w, 20);
  });

  test("les textes sont renvoyés avec leur position (servent à nommer les pièces)", () => {
    const r = parseDxf(fixture("noms.dxf"), "auto");
    assert.deepEqual(plain(r.texts.map((t) => t.s).sort()), ["Etagere", "Hors piece", "Montant"]);
  });

  test("un cadre qui contient toutes les pièces est ignoré", () => {
    const g = groupPieces(parseDxf(fixture("cadre.dxf"), "auto").paths);
    assert.ok(g.frame, "cadre détecté");
    assert.equal(g.pieces.length, 2);
  });
});
