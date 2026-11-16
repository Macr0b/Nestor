// Fichier DXF exporté : zéro à l'origine, calques. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rect } from "../helpers.mjs";
import { buildDxfFile } from "../../src/export/dxf.js";
import { readDXF } from "../export-readers.mjs";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
describe("Export DXF", () => {
  const polys = [{ pts: rect(100, 50, 10, 20), closed: true, layer: "Découpe", color: "" }];
  const coords = (dxf) => {
    const lines = dxf.split(/\r?\n/),
      xs = [],
      ys = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].trim() === "10") xs.push(+lines[i + 1]);
      if (lines[i].trim() === "20") ys.push(+lines[i + 1]);
    }
    return { xs, ys };
  };

  test("origine en bas à gauche : Y vers le haut, tout en positif", () => {
    const { xs, ys } = coords(buildDxfFile(polys, 0, 400));
    assert.ok(xs.every((x) => x >= 0) && ys.every((y) => y >= 0));
    near(Math.max(...ys), 380);
  });

  test("origine en haut à gauche : Y négatif vers le bas", () => {
    const { ys } = coords(buildDxfFile(polys, 0, 0));
    assert.ok(ys.every((y) => y <= 0));
    near(Math.min(...ys), -70);
  });

  test("en pouces : unité 1 dans l'en-tête et cotes divisées par 25,4", () => {
    const inch = buildDxfFile(polys, 0, 400, true);
    assert.match(inch, /\$INSUNITS\r?\n70\r?\n1\r?\n/);
    assert.match(buildDxfFile(polys, 0, 400), /\$INSUNITS\r?\n70\r?\n4\r?\n/);
    // le lecteur ramène le fichier en pouces en mm : mêmes points qu'en mm (à l'arrondi du fichier près)
    const mm = readDXF(buildDxfFile(polys, 0, 400)).Decoupe[0].pts,
      back = readDXF(inch).Decoupe[0].pts;
    back.forEach(([x, y], i) => {
      near(x, mm[i][0], 0.0001);
      near(y, mm[i][1], 0.0001);
    });
  });

  test("nom de calque lisible par les vieux logiciels (sans accent ni espace)", () => {
    const d = buildDxfFile([{ ...polys[0], layer: "Découpe bois" }], 0, 0);
    assert.match(d, /\nDecoupe_bois\r?\n/);
  });

  test("calque au nom non latin : nom lisible au lieu de « ____ »", () => {
    const d = buildDxfFile([{ ...polys[0], layer: "板材" }], 0, 0);
    assert.match(d, /\nLAYER_\d+\r?\n/);
  });
});
