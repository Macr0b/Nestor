/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Liste des coupes à la scie d'un panneau, dans l'ordre : sous le plan à l'écran et dans le PDF. */

import { sawKerf } from "../export/export-files.js";
import { translate } from "../i18n/i18n.js";
import { escapeHtml } from "../util/dom.js";
import { showLength } from "./lengths.js";

/* Titre de la liste : nombre de coupes et épaisseur de lame prise en compte. */
export function sawCutTitle(count) {
  return (
    translate("saw.title", { n: count }) +
    " · " +
    translate("saw.blade", { k: showLength(sawKerf(), { digits: 2 }) + " " + translate("mill.unitLength") })
  );
}

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
    escapeHtml(sawCutTitle(cuts.length)) +
    "</summary><table><thead><tr>" +
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
