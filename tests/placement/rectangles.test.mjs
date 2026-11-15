// Placement en rectangles (coupes droites). Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rect, type, checkSheet } from "../helpers.mjs";
import { packRectangles } from "../../src/placement/rectangles.js";

describe("Placement en rectangles (packRectangles)", () => {
  test("toutes les pièces placées, dans la zone utile, sans chevauchement", () => {
    const types = [type(rect(200, 120), 2), type(rect(80, 30), 10)];
    const res = packRectangles({ gap: 3, margin: 10, panels: [{ L: 600, W: 400, qty: "" }] }, types);
    assert.equal(res.unplaced.length, 0);
    for (const s of res.sheets) assert.deepEqual(checkSheet(s, types, { margin: 10, gap: 3 }), []);
  });

  test("pas de plafond caché sur les quantités (800 pièces)", () => {
    const types = [type(rect(20, 10), 800)];
    const res = packRectangles({ gap: 1, margin: 5, panels: [{ L: 1000, W: 1000, qty: "" }] }, types);
    const placed = res.sheets.reduce((n, s) => n + s.parts.length, 0);
    assert.equal(placed, 800);
  });

  test("stock limité : le surplus est signalé « stock »", () => {
    const types = [type(rect(300, 300), 3)];
    const res = packRectangles({ gap: 0, margin: 0, panels: [{ L: 400, W: 400, qty: 1 }] }, types);
    assert.equal(res.sheets.length, 1);
    assert.equal(res.unplaced.length, 2);
    assert.ok(res.unplaced.every((u) => u.why === "stock"));
  });
});
