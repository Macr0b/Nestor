/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Bloc « Kit » au-dessus de la liste : les pièces cochées « Kit » forment un objet (une boîte…) ; on remplit un
   panneau avec le plus possible de kits entiers. Visible dès qu'une pièce est dans le kit. */

import { translate } from "../i18n/i18n.js";
import { inKit } from "../placement/plan-layers.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { byId } from "../util/dom.js";
import { parseNumber } from "../util/numbers.js";
import { schedulePreferencesSave } from "../project/preferences.js";
import { fillChoices, scheduleCalculation } from "./parts-list.js";

/* Titre, choix du panneau et résultat du dernier calcul. */
export function renderKitBox() {
  var members = state.types.filter(inKit),
    box = byId("kitBox");
  box.hidden = !members.length;
  if (!members.length) return;
  var perKit = members.reduce(function (a, t) {
    return a + Math.max(0, Math.floor(parseNumber(t.qty, 0)));
  }, 0);
  byId("kitHead").textContent = translate("kit.head", { n: members.length, q: perKit });
  var select = byId("kitFill");
  if (document.activeElement !== select) select.innerHTML = fillChoices(state.kitFill, translate("kit.one"));
  var res = session.lastResult,
    info = byId("kitInfo");
  info.textContent =
    res && res.kits != null
      ? res.kits
        ? translate("kit.done", { n: res.kits, p: res.kits * perKit })
        : translate("kit.noRoom")
      : "";
  info.classList.toggle("none", !!(res && res.kits === 0));
}

export function bindKitBox() {
  byId("kitFill").addEventListener("change", function (e) {
    var v = e.target.value.split(":");
    state.kitFill = v.length === 2 ? { row: Math.floor(parseNumber(v[0], 0)), how: v[1] } : null;
    schedulePreferencesSave();
    scheduleCalculation();
  });
}
