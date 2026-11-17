/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Liste des coupes à la scie d'un panneau, dans l'ordre : sous le plan à l'écran et dans le PDF. */

import { translate } from "../i18n/i18n.js";
import { escapeHtml } from "../util/dom.js";
import { showLength } from "./lengths.js";

export function sawCutColumns() {
  return [translate("saw.colNumber"), translate("saw.colCut"), translate("saw.colAt"), translate("saw.colPiece")];
}

/* Une ligne par coupe : numéro, sens, cote, morceau coupé (longueur × largeur). */
export function sawCutRows(cuts) {
  return cuts.map(function (c, n) {
    return [
      String(n + 1),
      translate(c.dir === "along" ? "saw.along" : "saw.across"),
      showLength(c.at),
      showLength(c.piece.l) + " × " + showLength(c.piece.w)
    ];
  });
}

export function sawCutTableHtml(cuts) {
  if (!cuts.length) return "";
  return (
    '<details class="saw-list" open><summary>' +
    escapeHtml(translate("saw.title", { n: cuts.length })) +
    " <small>(" +
    escapeHtml(translate("mill.unitLength")) +
    ")</small></summary><table><thead><tr>" +
    sawCutColumns()
      .map(function (t) {
        return "<th>" + escapeHtml(t) + "</th>";
      })
      .join("") +
    "</tr></thead><tbody>" +
    sawCutRows(cuts)
      .map(function (row) {
        return (
          "<tr>" +
          row
            .map(function (cell) {
              return "<td>" + escapeHtml(cell) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("") +
    "</tbody></table></details>"
  );
}
