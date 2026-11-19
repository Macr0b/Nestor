/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Pièces non placées : repère rouge sur leur ligne de la liste des pièces, avec la raison écrite. */

import { translate } from "../i18n/i18n.js";
import { panelList } from "../placement/origin.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { parseNumber } from "../util/numbers.js";
import { panelSizeLabel } from "./plan-summary.js";

/* { indice de pièce : { n: exemplaires non placés, why: "size" | "stock" } } ; « size » l'emporte. */
export function unplacedByPart(res) {
  var out = {};
  ((res && res.unplaced) || []).forEach(function (u) {
    var mark = out[u.i] || (out[u.i] = { n: 0, why: "stock" });
    mark.n++;
    if ((u.why || "size") === "size") mark.why = "size";
  });
  return out;
}

// zones utiles des panneaux (panneau moins la marge de chaque bord), sans doublon
function usableAreas() {
  var margin = parseNumber(state.sheet.margin, 0),
    seen = {};
  return panelList()
    .filter(function (p) {
      return p.L > 0 && p.W > 0;
    })
    .map(function (p) {
      return panelSizeLabel({ L: Math.max(0, p.L - 2 * margin), W: Math.max(0, p.W - 2 * margin) });
    })
    .filter(function (label) {
      return seen[label] ? false : (seen[label] = true);
    })
    .join(" ; ");
}

function reasonText(mark, part) {
  return mark.why === "size"
    ? translate("piece.tooBig", { size: usableAreas() })
    : translate("piece.noStock", { n: mark.n, q: Math.floor(parseNumber(part.qty, 0)) });
}

/* Repose les repères d'après le dernier calcul : après chaque calcul et chaque fois que la liste est redessinée. */
export function markUnplacedParts() {
  var marks = unplacedByPart(session.lastResult);
  document.querySelectorAll("#types .trow").forEach(function (row) {
    var i = +row.dataset.i,
      mark = marks[i],
      old = row.querySelector(".unfit");
    if (old) old.remove();
    row.classList.toggle("unplaced", !!mark);
    if (!mark || !state.types[i]) return;
    var line = document.createElement("p");
    line.className = "unfit";
    line.setAttribute("role", "status");
    line.textContent = reasonText(mark, state.types[i]);
    row.appendChild(line);
  });
}

/* Lien du message rouge : amène à la ligne de la pièce et la fait clignoter un instant. */
export function showPartRow(i) {
  var row = document.querySelector('#types .trow[data-i="' + i + '"]');
  if (!row) return;
  row.scrollIntoView({ block: "center", behavior: "smooth" });
  var name = row.querySelector(".nm");
  if (name) name.focus({ preventScroll: true });
  row.classList.remove("flash");
  void row.offsetWidth;
  row.classList.add("flash");
}
