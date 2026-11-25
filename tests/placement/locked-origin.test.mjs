// Panneau figé puis repère déplacé : les pièces figées restent, les ajouts vont dans les trous près du nouveau repère.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { state } from "../../src/project/state.js";
import { lockSheet } from "../../src/project/locks.js";
import { rect, type } from "../helpers.mjs";

// le plan passe par les traductions, qui cherchent la page au chargement : une page vide suffit
globalThis.document ??= { getElementById: () => null, documentElement: {}, querySelectorAll: () => [] };
const { computePlan } = await import("../../src/placement/plan-layers.js");

// boîte englobante des pièces d'un panneau, non figées (ajouts) ou figées
function box(parts) {
  return {
    x0: Math.min(...parts.map((p) => p.x)),
    y0: Math.min(...parts.map((p) => p.y)),
    x1: Math.max(...parts.map((p) => p.x + p.w)),
    y1: Math.max(...parts.map((p) => p.y + p.h))
  };
}

for (const mode of ["nest", "rect"]) {
  describe(`figé puis repère changé (${mode === "rect" ? "Rectangles" : "selon la forme"})`, () => {
    beforeEach(() => {
      state.locks = [];
      state.kits = [];
      state.types = [Object.assign(type(rect(80, 40)), { qty: 3 })];
      state.sheet = { panels: [{ L: 400, W: 600, qty: "", origin: "tl" }], gap: 2, margin: 5, mode };
    });

    for (const origin of ["br", "tr", "bl", "mc"]) {
      test(`repère ${origin} : figées immobiles, ajouts calés vers lui, zéro des exports suivi`, async () => {
        const first = await computePlan();
        assert.equal(first.sheets.length, 1);
        lockSheet(first.sheets[0]);
        const frozen = box(first.sheets[0].parts);
        assert.ok(frozen.x0 < 20 && frozen.y0 < 20, "parti du coin haut gauche");
        // nouveau repère, trois pièces de plus
        state.sheet.panels[0].origin = origin;
        state.types[0].qty = 6;
        const plan = await computePlan();
        const sheet = plan.sheets[0];
        assert.equal(sheet.locked, true);
        assert.equal(sheet.o, origin, "le repère affiché et le zéro suivent la ligne");
        const kept = sheet.parts.filter((p) => p.locked),
          added = sheet.parts.filter((p) => !p.locked);
        assert.deepEqual(box(kept), frozen, "les pièces figées n'ont pas bougé");
        assert.equal(added.length, 3);
        const a = box(added),
          L = sheet.L,
          W = sheet.W;
        const right = a.x1 > L - 20,
          left = a.x0 < 20,
          bottom = a.y1 > W - 20,
          top = a.y0 < 20;
        if (mode === "nest") {
          if (origin[1] === "r") assert.ok(right, `contre le bord droit : ${a.x1} / ${L}`);
          if (origin[1] === "l") assert.ok(left, `contre le bord gauche : ${a.x0}`);
          if (origin[0] === "b") assert.ok(bottom, `contre le bas : ${a.y1} / ${W}`);
        } else if (origin[0] === "b") {
          // Rectangles : la zone de scie qui va le mieux, vue depuis le repère ; repère en bas → ajouts en bas
          // (avant, ils partaient toujours d'en haut à gauche)
          assert.ok(bottom && !top, `en bas : ${JSON.stringify(a)}`);
        }
        if (origin === "mc" && mode === "nest") {
          // autour du centre : le groupe ajouté touche la moitié du panneau
          assert.ok(a.x0 < L / 2 + 60 && a.x1 > L / 2 - 60, `près du centre en X : ${a.x0}–${a.x1}`);
        }
        // aucune pièce ajoutée ne chevauche une figée
        for (const p of added)
          for (const q of kept)
            assert.ok(
              p.x >= q.x + q.w || q.x >= p.x + p.w || p.y >= q.y + q.h || q.y >= p.y + p.h,
              "pas de chevauchement"
            );
      });
    }
  });
}
