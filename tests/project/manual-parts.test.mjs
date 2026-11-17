// Pièces saisies à la main et lignes collées depuis un tableur. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { newManualPart, parsePastedParts, resizeManualPart } from "../../src/project/manual-parts.js";
import { cleanSnapshot, takeSnapshot } from "../../src/project/project-snapshot.js";

const MM = { system: "mm", step: 16 };
const INCH = { system: "inch", step: 16 };
const FRAC = { system: "fraction", step: 16 };

describe("pièce saisie à la main", () => {
  test("rectangle : longueur en hauteur (↑), largeur en largeur (→), sens fixe", () => {
    const p = newManualPart({ name: " Côté ", length: 720, width: 560, qty: 2, fixed: true });
    assert.equal(p.name, "Côté");
    assert.equal(p.h, 720);
    assert.equal(p.w, 560);
    assert.equal(p.qty, 2);
    assert.equal(p.rot, false);
    assert.equal(p.manual, true);
    assert.deepEqual(p.paths[0].pts, [
      [0, 0],
      [560, 0],
      [560, 720],
      [0, 720]
    ]);
    assert.equal(p.paths[0].closed, true);
    assert.equal(newManualPart({ length: 100, width: 50 }).rot, true);
    assert.equal(newManualPart({ length: 100, width: 50 }).qty, 1);
  });

  test("cotes manquantes, nulles ou illisibles : refusées", () => {
    for (const e of [
      { length: 0, width: 50 },
      { length: 100 },
      { length: NaN, width: 5 },
      { length: -1, width: 5 },
      { length: Infinity, width: 5 }
    ])
      assert.equal(newManualPart(e), null);
  });

  test("nouvelles cotes : contour refait et copie à l'échelle oubliée", () => {
    const p = newManualPart({ length: 100, width: 50 });
    p._eff = {};
    p._effK = 2;
    assert.equal(resizeManualPart(p, 80, 300), true);
    assert.deepEqual([p.w, p.h, p.paths[0].pts[2]], [80, 300, [80, 300]]);
    assert.equal(p._eff, null);
    assert.equal(resizeManualPart(p, 0, 300), false);
    assert.equal(p.w, 80);
  });

  test("gardée dans un projet enregistré", () => {
    const p = newManualPart({ name: "Tablette", length: 500, width: 300, qty: 4, fixed: true });
    const snap = takeSnapshot({ types: [p], sheet: {}, files: [] }, {});
    assert.equal(snap.types[0].manual, true);
    assert.equal(snap.types[0].rot, false);
    assert.equal(cleanSnapshot(JSON.parse(JSON.stringify(snap))).types[0].manual, true);
  });
});

describe("coller depuis un tableur", () => {
  test("Excel / LibreOffice (tabulations) avec en-tête : nom, longueur, largeur, quantité", () => {
    const r = parsePastedParts(
      "Pièce\tLongueur\tLargeur\tQté\nCôté\t720\t560\t2\nTablette\t520,5\t300\t3\r\nFond\t700\t500\n",
      MM
    );
    assert.deepEqual(r.parts, [
      { name: "Côté", length: 720, width: 560, qty: 2 },
      { name: "Tablette", length: 520.5, width: 300, qty: 3 },
      { name: "Fond", length: 700, width: 500, qty: 1 }
    ]);
    assert.equal(r.skipped, 0);
  });

  test("CSV français (point-virgule), CSV anglais (virgule), guillemets, sans nom", () => {
    assert.deepEqual(parsePastedParts('"Porte";600,5;400;2', MM).parts, [
      { name: "Porte", length: 600.5, width: 400, qty: 2 }
    ]);
    assert.deepEqual(parsePastedParts("Door,600.5,400,2", MM).parts, [
      { name: "Door", length: 600.5, width: 400, qty: 2 }
    ]);
    assert.deepEqual(parsePastedParts("600\t400", MM).parts, [{ name: "", length: 600, width: 400, qty: 1 }]);
  });

  test("séparateur de milliers et colonnes vides", () => {
    assert.deepEqual(parsePastedParts("Plateau\t1 200\t\t600\t1", MM).parts, [
      { name: "Plateau", length: 1200, width: 600, qty: 1 }
    ]);
    assert.deepEqual(parsePastedParts("Plateau\t2 440,5\t1 220\t1", MM).parts, [
      { name: "Plateau", length: 2440.5, width: 1220, qty: 1 }
    ]);
  });

  test("pouces décimaux et fractions", () => {
    const [d] = parsePastedParts("Side\t30\t20.5\t2", INCH).parts;
    assert.ok(d.name === "Side" && d.qty === 2 && Math.abs(d.length - 762) < 1e-9 && Math.abs(d.width - 520.7) < 1e-9);
    const [p] = parsePastedParts("Side\t48 13/16\t23 1/2\t1", FRAC).parts;
    assert.ok(Math.abs(p.length - 48.8125 * 25.4) < 1e-9 && Math.abs(p.width - 23.5 * 25.4) < 1e-9);
  });

  test("lignes illisibles comptées, en-tête et lignes vides ignorées", () => {
    const r = parsePastedParts("Nom\tL\tl\n\nCôté\t720\nDos\t0\t500\nX\t10\t10\t1,5\nY\t10\t10\t-2\nOK\t10\t10\n", MM);
    assert.deepEqual(
      r.parts.map((p) => p.name),
      ["OK"]
    );
    assert.equal(r.skipped, 4);
    assert.deepEqual(parsePastedParts("", MM), { parts: [], skipped: 0 });
  });
});
