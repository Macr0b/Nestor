/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Chiffres d'un plan calculé (panneaux, pièces placées, chute, temps de découpe estimé), partagés par
   l'écran du résultat et le PDF à imprimer. */

import { translate } from "../i18n/i18n.js";
import { outerContourLength } from "../geometry/polylines.js";
import { estimateCutTime, splitDuration } from "../machining/cut-time.js";
import { loadMillingInput } from "../machining/milling-store.js";
import { millingSettings } from "../machining/milling.js";
import { partArea, scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { showDistance, showFeed, showLength } from "./lengths.js";

export function panelSizeLabel(sheet) {
  return showLength(sheet.W) + " × " + showLength(sheet.L);
}

/* Résumé : { panels, breakdown, placed, total, wastePercent, contourLength } ; remplit aussi sheet.area. */
export function planSummary(res) {
  var used = 0,
    total = 0,
    contourLength = 0,
    groups = {},
    order = [];
  res.sheets.forEach(function (s) {
    s.area = 0;
    s.parts.forEach(function (p) {
      var part = scaledPart(state.types[p.i]);
      s.area += partArea(part);
      contourLength += outerContourLength(part);
    });
    used += s.area;
    total += s.L * s.W;
    var key = panelSizeLabel(s);
    if (!groups[key]) {
      groups[key] = 0;
      order.push(key);
    }
    groups[key]++;
  });
  return {
    panels: res.sheets.length,
    breakdown: order
      .map(function (k) {
        return groups[k] + " × " + k;
      })
      .join(" · "),
    placed: res.count,
    total: res.total,
    wastePercent: res.sheets.length ? Math.round(1000 * (1 - used / total)) / 10 : null,
    contourLength: contourLength
  };
}

/* Temps de découpe estimé : { value, detail } (contours extérieurs, avance et passes de l'onglet Fraisage). */
export function cutTimeSummary(contourLength) {
  // rien de placé : rien à couper, pas de conseil sur la fraise
  if (!(contourLength > 0)) return { value: "–", detail: "" };
  var settings = millingSettings(loadMillingInput()),
    time = estimateCutTime(contourLength, settings);
  if (!time)
    return {
      value: "–",
      detail: translate(settings && !settings.passes ? "res.timeNoThickness" : "res.timeNone")
    };
  var d = splitDuration(time.minutes);
  return {
    value: "≈ " + translate(d.hours ? "res.timeHours" : "res.timeMinutes", { h: d.hours, m: d.minutes }),
    detail: translate("res.timeDetail", { l: showDistance(time.length), f: showFeed(time.feed), p: time.passes })
  };
}
