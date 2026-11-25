/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Préparation des fichiers exportés (pièces, contour du panneau, traits de coupe, numéros) et enregistrement sur
   l'appareil. */

import { exportOptions } from "./export-options.js";
import { computeOffcutCuts } from "./offcuts.js";
import { computeSawCuts } from "./saw-cuts.js";
import { partEngravePaths } from "./part-numbers.js";
import { partDisplayName } from "../project/parts.js";
import { translate } from "../i18n/i18n.js";
import { sheetPartPaths } from "../placement/origin.js";
import { state } from "../project/state.js";
import { host } from "../util/host.js";
import { parseNumber } from "../util/numbers.js";

// contour du panneau (option d'export) : un rectangle aux dimensions du panneau, sur son propre calque
const PANEL_OUTLINE_COLOR = "#808080";

function panelOutlinePath(sheet) {
  return {
    pts: [
      [0, 0],
      [sheet.L, 0],
      [sheet.L, sheet.W],
      [0, sheet.W]
    ],
    closed: true,
    layer: translate("dl.boardLayer"),
    color: PANEL_OUTLINE_COLOR
  };
}

// traits de coupe des chutes (option) : calculés sur l'encombrement réel de chaque pièce placée
const OFFCUT_CUT_COLOR = "#0080ff";

export function sheetOffcutCuts(resultSheet) {
  if (!exportOptions.offcutMode || !resultSheet.parts.length) return { cuts: [], chutes: [] };
  var boxes = resultSheet.parts.map(function (p) {
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    sheetPartPaths(p, resultSheet).forEach(function (q) {
      q.pts.forEach(function (v) {
        b.x0 = Math.min(b.x0, v[0]);
        b.y0 = Math.min(b.y0, v[1]);
        b.x1 = Math.max(b.x1, v[0]);
        b.y1 = Math.max(b.y1, v[1]);
      });
    });
    return b;
  });
  return computeOffcutCuts(
    resultSheet.L,
    resultSheet.W,
    boxes,
    parseNumber(state.sheet.gap, 0),
    exportOptions.offcutMode,
    parseNumber(state.sheet.margin, 0)
  );
}

/* Épaisseur de lame pour l'ordre des coupes : celle saisie, sinon l'espace entre pièces. */
export function sawKerf() {
  return exportOptions.sawKerf > 0 ? exportOptions.sawKerf : Math.max(0, parseNumber(state.sheet.gap, 0));
}

/* Ordre des coupes à la scie (option, méthode Rectangles seulement) : coupes numérotées dans l'ordre. */
export function sheetSawCuts(resultSheet) {
  if (!exportOptions.sawOrder || state.sheet.mode !== "rect" || !resultSheet.parts.length) return [];
  return computeSawCuts(
    resultSheet.L,
    resultSheet.W,
    resultSheet.parts,
    sawKerf(),
    parseNumber(state.sheet.margin, 0),
    exportOptions.sawFirst
  );
}

export function exportPaths(sheet) {
  var polys = exportOptions.includeBoard ? [panelOutlinePath(sheet)] : [];
  sheetOffcutCuts(sheet).cuts.forEach(function (c) {
    polys.push({
      pts: [
        [c[0], c[1]],
        [c[2], c[3]]
      ],
      closed: false,
      layer: translate("cuts.layer"),
      color: OFFCUT_CUT_COLOR
    });
  });
  sheet.parts.forEach(function (p) {
    polys = polys.concat(sheetPartPaths(p, sheet));
  });
  // numéros et noms à graver : après les pièces, sur leur propre calque
  if (exportOptions.partNumbers || exportOptions.partNames)
    sheet.parts.forEach(function (p) {
      polys = polys.concat(
        partEngravePaths(p, sheet, {
          number: exportOptions.partNumbers,
          name: exportOptions.partNames ? partDisplayName(state.types[p.i], p.i) : ""
        })
      );
    });
  return polys;
}

export function saveFile(filename, blob) {
  if (host && host.save) return host.save(filename, blob);
  var mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (mobile && navigator.canShare) {
    try {
      var file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] }))
        return navigator.share({ files: [file] }).then(function () {
          return "shared";
        });
    } catch (e) {}
  }
  var url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(url);
    link.remove();
  }, 4000);
  return Promise.resolve("saved");
}

// nom de fichier sans accents ni espaces ; fallback quand rien ne reste (écriture non latine)
export function fileSlug(text, fallback) {
  return (
    (text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() ||
    fallback ||
    "plan"
  );
}
