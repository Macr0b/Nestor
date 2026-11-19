// Ligne de panneau qui suit la matière choisie, et chutes devant elle. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyMaterialFormat,
  insertOffcut,
  isOffcutPanel,
  materialPanelIndex
} from "../../src/project/material-panels.js";
import { cleanSnapshot } from "../../src/project/project-snapshot.js";

const CP = { L: 2000, W: 1000 };
const MDF = { L: 2800, W: 2070 };

describe("format de la matière sur les panneaux", () => {
  test("une seule ligne : elle prend le format et suit la matière, stock et repère gardés", () => {
    const panels = [{ L: 2500, W: 1200, qty: 3, origin: "bl" }];
    assert.equal(applyMaterialFormat(panels, CP), true);
    assert.deepEqual(panels, [{ L: 2000, W: 1000, qty: 3, origin: "bl", fromMaterial: true }]);
    // même format : rien ne change
    assert.equal(applyMaterialFormat(panels, CP), false);
    // autre matière : seule la ligne liée change
    applyMaterialFormat(panels, MDF);
    assert.deepEqual([panels[0].L, panels[0].W, panels[0].qty], [2800, 2070, 3]);
  });

  test("plusieurs lignes sans lien : une ligne est ajoutée en dernier, les chutes ne bougent pas", () => {
    const panels = [
      { L: 800, W: 600, qty: 1, origin: "tl" },
      { L: 2500, W: 1200, qty: "", origin: "br" }
    ];
    applyMaterialFormat(panels, CP);
    assert.equal(panels.length, 3);
    assert.deepEqual(panels[2], { L: 2000, W: 1000, qty: "", origin: "br", fromMaterial: true });
    assert.deepEqual(
      [0, 1, 2].map((i) => isOffcutPanel(panels, i)),
      [true, true, false]
    );
  });

  test("aucune matière ou matière sans format : la ligne n'est plus liée, sa taille reste", () => {
    const panels = [{ L: 2000, W: 1000, qty: "", fromMaterial: true }];
    assert.equal(applyMaterialFormat(panels, null), true);
    assert.deepEqual(panels, [{ L: 2000, W: 1000, qty: "" }]);
    assert.equal(applyMaterialFormat(panels, { L: null, W: 1000 }), false);
    assert.equal(materialPanelIndex(panels), -1);
    // sans ligne liée, rien n'est une chute
    assert.equal(isOffcutPanel(panels, 0), false);
  });

  test("ajouter une chute : devant la ligne de la matière, stock 1 ; sans matière, en dernier, stock illimité", () => {
    const panels = [{ L: 2000, W: 1000, qty: "", origin: "bl", fromMaterial: true }];
    assert.equal(insertOffcut(panels), 0);
    assert.deepEqual(panels[0], { L: 2000, W: 1000, qty: 1, origin: "bl" });
    assert.equal(materialPanelIndex(panels), 1);
    assert.equal(insertOffcut(panels), 1);
    assert.equal(materialPanelIndex(panels), 2);
    const free = [{ L: 600, W: 400, qty: "" }];
    assert.equal(insertOffcut(free), 1);
    assert.deepEqual(free[1], { L: 600, W: 400, qty: "" });
    assert.equal(isOffcutPanel(panels, 9), false);
  });

  test("le lien est gardé dans un projet, et seulement s'il vaut true", () => {
    const snap = cleanSnapshot({
      app: "Nestor",
      kind: "projet",
      sheet: {
        panels: [
          { L: 800, W: 600, qty: 1, fromMaterial: "oui" },
          { L: 2000, W: 1000, qty: "", fromMaterial: true }
        ]
      },
      types: []
    });
    assert.deepEqual(
      snap.sheet.panels.map((p) => p.fromMaterial),
      [undefined, true]
    );
  });
});
