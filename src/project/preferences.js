/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Derniers réglages mémorisés sur l'appareil (panneaux, écart, marge, options…), rechargés au lancement.
   La clé de stockage ne change pas d'une version à l'autre, pour garder les réglages existants. */

import { exportOptions } from "../export/export-options.js";
import { validOrigin } from "../placement/origin.js";
import { rotationFromChoice } from "./parts.js";
import { state } from "./state.js";
import { parseNumber } from "../util/numbers.js";

const PREFERENCES_KEY = "plancoupe.reglages.v1";

let preferencesTimer = null;

export function schedulePreferencesSave() {
  clearTimeout(preferencesTimer);
  preferencesTimer = setTimeout(savePreferences, 400);
}

function savePreferences() {
  preferencesTimer = null;
  try {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        panels: state.sheet.panels,
        gap: state.sheet.gap,
        margin: state.sheet.margin,
        mode: state.sheet.mode,
        rot: state.rotAll,
        sort: state.sort,
        board: exportOptions.includeBoard,
        numbers: exportOptions.partNumbers,
        cuts: exportOptions.offcutMode,
        saw: exportOptions.sawOrder
      })
    );
  } catch (e) {}
}

export function loadPreferences() {
  try {
    var saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "null");
    if (!saved) return;
    if (Array.isArray(saved.panels) && saved.panels.length)
      state.sheet.panels = saved.panels.map(function (x) {
        return {
          L: parseNumber(x.L, 600),
          W: parseNumber(x.W, 400),
          qty: x.qty === "" || x.qty == null ? "" : Math.max(0, Math.floor(parseNumber(x.qty, 0))),
          origin: validOrigin(x.origin || saved.origin)
        };
      });
    exportOptions.includeBoard = saved.board === true;
    exportOptions.partNumbers = saved.numbers === true;
    exportOptions.sawOrder = saved.saw === true;
    exportOptions.offcutMode = saved.cuts === "simple" || saved.cuts === "detail" ? saved.cuts : "";
    if (saved.gap != null) state.sheet.gap = parseNumber(saved.gap, 2);
    if (saved.margin != null) state.sheet.margin = parseNumber(saved.margin, 5);
    state.sheet.mode = saved.mode === "rect" ? "rect" : "nest";
    if (saved.sort === "file" || saved.sort === "name" || saved.sort === "layer" || saved.sort === "src")
      state.sort = saved.sort;
    if (saved.rot === "fix" || saved.rot === "quarter" || saved.rot === "free") {
      state.rotAll = saved.rot;
      if (state.example)
        state.types.forEach(function (t) {
          t.rot = rotationFromChoice(saved.rot);
        });
    }
  } catch (e) {}
}

export function bindPreferences() {
  // page fermée ou rechargée juste après un changement : on enregistre tout de suite ce qui était en attente
  window.addEventListener("pagehide", function () {
    if (!preferencesTimer) return;
    clearTimeout(preferencesTimer);
    savePreferences();
  });
}
