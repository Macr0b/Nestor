/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Avant de changer une pièce qui est sur un panneau figé : demander, puis déverrouiller ce panneau. */

import { translate } from "../i18n/i18n.js";
import { locksWithTypes, unlockSheets } from "../project/locks.js";
import { renderLockedFields } from "./panels-editor.js";

/* typeIndexes : pièces touchées par le changement. Rend true si le changement peut se faire. */
export function allowChangeOf(typeIndexes) {
  var hit = locksWithTypes(typeIndexes);
  if (!hit.length) return true;
  if (!window.confirm(translate("lock.ask", { n: hit.length }))) return false;
  unlockSheets(hit);
  renderLockedFields();
  return true;
}
