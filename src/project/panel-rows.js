/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Les lignes de panneau bougent (ajout, retrait, ↑) : ce qui les vise suit la ligne, pas son numéro. */

import { remapLockedPanels } from "./locks.js";
import { state } from "./state.js";

/* map(ancien indice) → nouvel indice, ou -1 si la ligne a été retirée. */
export function remapPanelRows(map) {
  remapLockedPanels(map);
  state.types.forEach(function (t) {
    if (!t.fill) return;
    var row = map(t.fill.row);
    // ligne retirée : la pièce revient à un nombre fixe
    if (row < 0) delete t.fill;
    else t.fill.row = row;
  });
  // remplissage par kits : même règle
  if (state.kitFill) {
    var kitRow = map(state.kitFill.row);
    if (kitRow < 0) state.kitFill = null;
    else state.kitFill.row = kitRow;
  }
}
