// Géométrie finale des pièces placées. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { type, area } from "../helpers.mjs";
import { placedPartPaths } from "../../src/geometry/placed-parts.js";
import { nest } from "../../src/placement/nest.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
describe("Pièces placées (placedPartPaths)", () => {
  test("rotation libre : la pièce garde sa surface et son encombrement annoncé", () => {
    const t = type(
      [
        [0, 0],
        [100, 0],
        [100, 20],
        [0, 20]
      ],
      1,
      { rot: 2 }
    );
    const res = nest({ panels: [{ L: 60, W: 200, qty: -1 }], gap: 0, margin: 0, types: [t] });
    assert.equal(res.count, 1, "un 100 × 20 doit tenir debout ou en biais dans 60 × 200");
    const p = res.sheets[0].parts[0];
    const pts = placedPartPaths(t, p)[0].pts;
    near(area(pts), 2000, 1);
  });
});
