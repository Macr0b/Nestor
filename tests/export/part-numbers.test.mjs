// Numéros et noms gravés sur les pièces : deux lignes quand elles tiennent, le numéro seul sinon.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { labelHeight } from "../../src/geometry/label-spot.js";
import { state } from "../../src/project/state.js";
import { engravableText, strokeText } from "../../src/text/stroke-font.js";
import { LETTERS } from "../../src/text/stroke-letters.js";
import { rect, type } from "../helpers.mjs";

// le module des numéros passe par les traductions, qui cherchent la page au chargement : une page vide suffit
globalThis.document ??= { getElementById: () => null, documentElement: {}, querySelectorAll: () => [] };
const { NAME_MIN_HEIGHT, NUMBER_MAX_HEIGHT, partEngravePaths, partNumberPaths } = await import(
  "../../src/export/part-numbers.js"
);

const sheet = { L: 1000, W: 1000 };

// hauteur (Y) de l'ensemble des traits
function span(paths) {
  const ys = paths.flatMap((p) => p.pts.map((v) => v[1]));
  return { top: Math.min(...ys), bottom: Math.max(...ys), height: Math.max(...ys) - Math.min(...ys) };
}

describe("numéro et nom gravés", () => {
  beforeEach(() => {
    state.types = [type(rect(200, 100)), type(rect(30, 12)), type(rect(2, 2))];
  });

  test("numéro seul : comme avant (même hauteur que labelHeight), sur le calque des numéros", () => {
    const placed = { i: 0, x: 0, y: 0, k: 0 };
    const paths = partNumberPaths(placed, sheet);
    assert.ok(paths.length > 0);
    assert.ok(paths.every((p) => p.layer === "dl.numLayer" || p.layer === "Numéros"));
    const expected = labelHeight("1", 50, 2, NUMBER_MAX_HEIGHT);
    assert.ok(Math.abs(span(paths).height - expected) < 1e-3, `${span(paths).height} ≠ ${expected}`);
  });

  test("numéro puis nom dessous, plus petit, centré dans la pièce", () => {
    const placed = { i: 0, x: 0, y: 0, k: 0 };
    const number = partEngravePaths(placed, sheet, { number: true });
    const both = partEngravePaths(placed, sheet, { number: true, name: "Côté gauche" });
    const name = strokeText("COTE GAUCHE", 0, 0, 1).length;
    assert.equal(both.length, number.length + name);
    const n = span(both.slice(0, number.length)),
      t = span(both.slice(number.length));
    assert.ok(t.top > n.bottom, "le nom est sous le numéro");
    assert.ok(Math.abs(t.height / n.height - 0.6) < 1e-6, "nom à 60 % du numéro");
    const all = span(both);
    assert.ok(Math.abs((all.top + all.bottom) / 2 - 50) < 1e-6, "bloc centré sur la pièce");
    assert.ok(n.height <= NUMBER_MAX_HEIGHT + 1e-9);
  });

  test("pièce trop petite pour les deux : le numéro seul ; trop petite même pour lui : rien", () => {
    const small = { i: 1, x: 0, y: 0, k: 0 };
    const both = partEngravePaths(small, sheet, { number: true, name: "Une étiquette très longue" });
    assert.deepEqual(both, partNumberPaths(small, sheet));
    assert.ok(both.length > 0);
    const tiny = { i: 2, x: 0, y: 0, k: 0 };
    assert.deepEqual(partEngravePaths(tiny, sheet, { number: true, name: "AB" }), []);
  });

  test("nom seul (sans numéro), nom illisible ignoré, rien demandé : rien", () => {
    const placed = { i: 0, x: 0, y: 0, k: 0 };
    const only = partEngravePaths(placed, sheet, { name: "Fond" });
    assert.equal(only.length, strokeText("FOND", 0, 0, 1).length);
    assert.ok(span(only).height >= NAME_MIN_HEIGHT);
    assert.deepEqual(partEngravePaths(placed, sheet, { number: true, name: "中文" }), partNumberPaths(placed, sheet));
    assert.deepEqual(partEngravePaths(placed, sheet, { name: "" }), []);
    assert.deepEqual(partEngravePaths(placed, sheet, {}), []);
  });
});

describe("lettres au trait", () => {
  test("A à Z : chaque lettre a des traits, dans la grille de 4 × 6", () => {
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const lines = strokeText(c, 2, 3, 6);
      assert.ok(lines.length > 0, c);
      for (const v of lines.flat()) assert.ok(v[0] >= 0 && v[0] <= 4 && v[1] >= 0 && v[1] <= 6, c);
    }
    assert.ok(Object.keys(LETTERS).every((c) => /^[A-Z]$/.test(c)));
  });

  test("texte gravable : capitales sans accents, ligatures dépliées, le reste devient une espace", () => {
    assert.equal(engravableText("Étagère côté"), "ETAGERE COTE");
    assert.equal(engravableText("Œuvre_2 (b)"), "OEUVRE 2 B");
    assert.equal(engravableText("Ægir øl"), "AEGIR OL");
    assert.equal(engravableText("Ø 50 % - 1,5 mm/s"), "O 50 % - 1,5 MM/S");
    assert.equal(engravableText("中文"), "");
    assert.equal(engravableText("  "), "");
  });
});
