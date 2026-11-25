// Ligne de panneau qui suit la matière choisie, et chutes devant elle. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyMaterialFormat,
  insertBought,
  insertOffcut,
  isOffcutPanel,
  markHandSized,
  materialPanelIndex,
  restoreMaterialFormat
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

  test("taille changée à la main : gardée même si la matière est choisie de nouveau ; « Remettre le format »", () => {
    const panels = [{ L: 2000, W: 1000, qty: "", fromMaterial: true }];
    panels[0].L = 1500;
    markHandSized(panels[0]);
    assert.equal(applyMaterialFormat(panels, CP), false);
    assert.equal(applyMaterialFormat(panels, MDF), false);
    assert.deepEqual(panels, [{ L: 1500, W: 1000, qty: "", fromMaterial: true, handSized: true }]);
    assert.equal(isOffcutPanel(panels, 0), false, "toujours la ligne de la matière, pas une chute");
    // le format revient, la ligne suit de nouveau la matière
    assert.equal(restoreMaterialFormat(panels, MDF), true);
    assert.deepEqual(panels, [{ L: 2800, W: 2070, qty: "", fromMaterial: true }]);
    assert.equal(restoreMaterialFormat(panels, MDF), false);
    // une ligne qui ne suit pas la matière n'est pas marquée
    const loose = { L: 600, W: 400, qty: "" };
    markHandSized(loose);
    assert.equal(loose.handSized, undefined);
    // plus de matière : plus de lien ni de marque
    markHandSized(panels[0]);
    applyMaterialFormat(panels, null);
    assert.deepEqual(panels, [{ L: 2800, W: 2070, qty: "" }]);
  });

  test("panneau acheté : après la ligne de la matière, même format, stock illimité, pas une chute", () => {
    const panels = [
      { L: 500, W: 400, qty: 1 },
      { L: 2000, W: 1000, qty: "", origin: "bl", fromMaterial: true }
    ];
    assert.equal(insertBought(panels), 2);
    assert.deepEqual(panels[2], { L: 2000, W: 1000, qty: "", origin: "bl", bought: true });
    assert.deepEqual(
      [0, 1, 2].map((i) => isOffcutPanel(panels, i)),
      [true, false, false]
    );
    // une chute ajoutée ensuite passe toujours devant la ligne de la matière
    assert.equal(insertOffcut(panels), 1);
    assert.equal(materialPanelIndex(panels), 2);
    assert.equal(panels[3].bought, true);
  });

  test("le lien est gardé dans un projet, et seulement s'il vaut true", () => {
    const snap = cleanSnapshot({
      app: "Nestor",
      kind: "projet",
      sheet: {
        panels: [
          { L: 800, W: 600, qty: 1, fromMaterial: "oui", handSized: true, bought: "oui" },
          { L: 2000, W: 1000, qty: "", fromMaterial: true, handSized: true },
          { L: 2000, W: 1000, qty: "", bought: true }
        ]
      },
      types: []
    });
    assert.deepEqual(
      snap.sheet.panels.map((p) => [p.fromMaterial, p.handSized, p.bought]),
      [
        [undefined, undefined, undefined],
        [true, true, undefined],
        [undefined, undefined, true]
      ]
    );
  });
});
