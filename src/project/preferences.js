/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
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
        names: exportOptions.partNames,
        pdfLayers: exportOptions.pdfLayers,
        cuts: exportOptions.offcutMode,
        saw: exportOptions.sawOrder,
        sawFirst: exportOptions.sawFirst,
        kerf: exportOptions.sawKerf
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
          origin: validOrigin(x.origin || saved.origin),
          ...(x.fromMaterial === true ? { fromMaterial: true } : {}),
          ...(x.fromMaterial === true && x.handSized === true ? { handSized: true } : {}),
          ...(x.bought === true ? { bought: true } : {}),
          ...(typeof x.name === "string" && x.name ? { name: x.name.slice(0, 60) } : {})
        };
      });
    exportOptions.includeBoard = saved.board === true;
    exportOptions.partNumbers = saved.numbers === true;
    exportOptions.partNames = saved.names === true;
    exportOptions.pdfLayers = saved.pdfLayers === true;
    exportOptions.sawOrder = saved.saw === true;
    exportOptions.sawFirst = saved.sawFirst === "along" || saved.sawFirst === "across" ? saved.sawFirst : "";
    exportOptions.sawKerf = saved.kerf > 0 && saved.kerf <= 50 ? saved.kerf : "";
    exportOptions.offcutMode = saved.cuts === "simple" || saved.cuts === "detail" ? saved.cuts : "";
    if (saved.gap != null) state.sheet.gap = parseNumber(saved.gap, 2);
    if (saved.margin != null) state.sheet.margin = parseNumber(saved.margin, 5);
    state.sheet.mode = saved.mode === "rect" ? "rect" : "nest";
    if (saved.sort === "file" || saved.sort === "name" || saved.sort === "layer" || saved.sort === "src")
      state.sort = saved.sort;
    if (["fix", "quarter", "free", "free1"].includes(saved.rot)) {
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
