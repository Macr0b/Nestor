// Écriture SVG à partir de traits (panneaux, grille de test laser). Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSvgFromPaths } from "../../src/export/svg-writer.js";

const square = {
  pts: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10]
  ],
  closed: true,
  layer: "Carrés",
  color: "#ff0000"
};
const loose = {
  pts: [
    [0, 0],
    [5, 5]
  ],
  closed: false,
  layer: "",
  color: ""
};

test("traits de 0,1 mm, avec ou sans calque (mm et pouces)", () => {
  const mm = buildSvgFromPaths([square, loose], 100, 50, [0, 0], false);
  const strokes = [...mm.matchAll(/stroke-width="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(strokes, ["0.1", "0.1"]);
  const inch = buildSvgFromPaths([square], 100, 50, [0, 0], true);
  const inchStroke = Number(inch.match(/stroke-width="([^"]+)"/)[1]);
  assert.ok(Math.abs(inchStroke - 0.1 / 25.4) < 1e-12, String(inchStroke));
  assert.match(inch, /width="3\.937\d*in"/);
});

test("zéro à l'origine demandée, traits d'entrée inchangés", () => {
  const svg = buildSvgFromPaths([square], 100, 50, [10, 20], false);
  assert.match(svg, /d="M-10 -20L0 -20L0 -10L-10 -10Z"/);
  assert.deepEqual(square.pts[1], [10, 0]);
});

test("deux calques au nom identique une fois nettoyé gardent des identifiants distincts", () => {
  const svg = buildSvgFromPaths([square, Object.assign({}, square, { layer: "Carrés!" })], 100, 50, [0, 0], false);
  const ids = [...svg.matchAll(/<g id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 2, ids.join(","));
});
