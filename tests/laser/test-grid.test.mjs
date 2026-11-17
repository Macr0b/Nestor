// Grille de test laser. Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTestGrid, gridPowers, gridSpeeds, GRID_COLORS } from "../../src/laser/test-grid.js";
import { buildDxfFile } from "../../src/export/dxf.js";
import { buildSvgFromPaths } from "../../src/export/svg-writer.js";

const layers = { cell: "Essai", labels: "Repères" };

test("puissances autour du point de départ, bornées à 100 %", () => {
  assert.deepEqual(gridPowers(50), [40, 45, 50, 55]);
  assert.deepEqual(gridPowers(100), [70, 80, 90, 100]);
  assert.deepEqual(gridPowers(2), [1, 2, 3, 4]);
});

test("vitesses autour du point de départ, arrondies proprement", () => {
  assert.deepEqual(gridSpeeds(0.4), [0.28, 0.34, 0.4, 0.46]);
  assert.deepEqual(gridSpeeds(20), [14, 17, 20, 23]);
});

test("16 cases de 16 couleurs différentes, toutes dans la page", () => {
  const g = buildTestGrid(50, 0.4, "%", ",", layers);
  assert.equal(g.cells.length, 16);
  assert.equal(new Set(g.cells.map((c) => c.color)).size, 16);
  const squares = g.paths.filter((p) => p.closed);
  assert.equal(squares.length, 16);
  for (const p of g.paths)
    for (const [x, y] of p.pts) assert.ok(x >= 0 && y >= 0 && x <= g.width && y <= g.height, `${x},${y}`);
  // cases sans chevauchement
  const boxes = squares.map((p) => [p.pts[0][0], p.pts[0][1], p.pts[2][0], p.pts[2][1]]);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${i}/${j}`);
    }
  assert.equal(GRID_COLORS.length, 16);
});

test("chaque case porte sa puissance et sa vitesse dans son nom de calque", () => {
  const g = buildTestGrid(50, 0.4, "%", ",", layers);
  const names = g.paths.filter((p) => p.closed).map((p) => p.layer);
  assert.ok(names.includes("Essai 40% 0,28 %"), names.join(" | "));
  assert.ok(names.includes("Essai 55% 0,46 %"));
});

test("repères gravés au trait sur leur propre calque", () => {
  const g = buildTestGrid(80, 14.2, "mm/s", ".", layers);
  const marks = g.paths.filter((p) => !p.closed && p.layer === "Repères");
  assert.ok(marks.length > 20);
});

test("la grille s'exporte en SVG et en DXF, en mm et en pouces", () => {
  const g = buildTestGrid(50, 0.4, "%", ",", layers);
  for (const inches of [false, true]) {
    const svg = buildSvgFromPaths(g.paths, g.width, g.height, [0, 0], inches);
    assert.equal((svg.match(/Z"/g) || []).length, 16);
    const dxf = buildDxfFile(g.paths, 0, 0, inches);
    assert.equal((dxf.match(/\r\nPOLYLINE\r\n/g) || []).length, g.paths.length);
    assert.match(dxf, inches ? /\$INSUNITS\r\n70\r\n1\r\n/ : /\$INSUNITS\r\n70\r\n4\r\n/);
  }
});
