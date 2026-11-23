/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Bloc « Kits » au-dessus de la liste : un kit = les pièces d'un même objet (Boîte, Étagère…).
   Pour chaque kit : son nom, ses pièces par kit, « Un seul kit » ou « Remplir au maximum » tel panneau, et le
   nombre de kits entiers posés. Les kits sont posés dans l'ordre de ce bloc. Visible dès qu'un kit existe. */

import { translate } from "../i18n/i18n.js";
import { addKit, kitOf, kitRecipe, removeKit } from "../project/kits.js";
import { schedulePreferencesSave } from "../project/preferences.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { byId, escapeHtml } from "../util/dom.js";
import { fillPickerHtml, readFillPicker, refreshFillPicker } from "./fill-picker.js";
import { renderPartsList, scheduleCalculation } from "./parts-list.js";

/* nom affiché d'un kit (n : sa place dans la liste) */
export function kitName(kit, n) {
  return kit.name || translate("kit.defaultName", { n: n + 1 });
}

function kitFor(id) {
  return state.kits.find(function (k) {
    return k.id === id;
  });
}

function perKit(kit) {
  return kitRecipe(kit).reduce(function (a, q) {
    return a + q;
  }, 0);
}

function resultText(kit) {
  var res = session.lastResult;
  if (!kit.fill || !res || !res.kits || res.kits[kit.id] == null) return "";
  var n = res.kits[kit.id];
  return n ? translate("kit.done", { n: n, p: n * perKit(kit) }) : translate("kit.noRoom");
}

function kitRowHtml(kit, n) {
  var name = kitName(kit, n),
    members = state.types.filter(function (t) {
      return kitOf(t) === kit;
    }).length;
  return (
    '<div class="kitrow" data-kit="' +
    kit.id +
    '"><div class="kit-top"><input class="kit-name" type="text" maxlength="60" value="' +
    escapeHtml(kit.name) +
    '" placeholder="' +
    escapeHtml(translate("kit.defaultName", { n: n + 1 })) +
    '" aria-label="' +
    escapeHtml(translate("kit.nameLbl", { n: n + 1 })) +
    '"><span class="kit-count">' +
    escapeHtml(translate("kit.perKit", { q: perKit(kit), n: members })) +
    '</span><button type="button" class="mini tb" data-kit-del title="' +
    escapeHtml(translate("kit.del", { k: name })) +
    '" aria-label="' +
    escapeHtml(translate("kit.del", { k: name })) +
    '">×</button></div><div class="fp" data-fp-box>' +
    fillPickerHtml("kit-" + kit.id, kit.fill, translate("kit.one"), translate("kit.fillLbl", { k: name })) +
    '</div><p class="kit-info" role="status">' +
    escapeHtml(resultText(kit)) +
    "</p></div>"
  );
}

/* Tout le bloc ; une liste déjà affichée n'est que mise à jour (pour ne pas perdre la saisie du nom). */
export function renderKitBox() {
  var box = byId("kitBox"),
    list = byId("kitList");
  box.hidden = !state.kits.length;
  var shown = Array.prototype.map.call(list.children, function (el) {
    return el.dataset.kit;
  });
  var same =
    shown.length === state.kits.length &&
    state.kits.every(function (k, n) {
      return shown[n] === k.id;
    });
  if (!same) {
    list.innerHTML = state.kits.map(kitRowHtml).join("");
    return;
  }
  state.kits.forEach(function (kit, n) {
    var el = list.children[n];
    el.querySelector(".kit-count").textContent = translate("kit.perKit", {
      q: perKit(kit),
      n: state.types.filter(function (t) {
        return kitOf(t) === kit;
      }).length
    });
    el.querySelector(".kit-info").textContent = resultText(kit);
    refreshFillPicker(el.querySelector("[data-fp-box]"), kit.fill);
  });
}

/* place le curseur dans le nom d'un kit qu'on vient de créer */
export function focusKitName(id) {
  var input = byId("kitList").querySelector('[data-kit="' + id + '"] .kit-name');
  if (input) input.focus();
}

export function bindKitBox() {
  var list = byId("kitList");
  list.addEventListener("change", function (e) {
    var kit = kitFor(e.target.closest("[data-kit]").dataset.kit);
    if (!kit || !e.target.dataset.fp) return;
    var box = e.target.closest("[data-fp-box]");
    kit.fill = readFillPicker(box);
    box.querySelector(".fp-fill").hidden = !kit.fill;
    schedulePreferencesSave();
    scheduleCalculation();
  });
  list.addEventListener("input", function (e) {
    if (!e.target.classList.contains("kit-name")) return;
    var kit = kitFor(e.target.closest("[data-kit]").dataset.kit);
    if (!kit) return;
    kit.name = e.target.value.slice(0, 60);
    // les menus « Kit » des pièces suivent le nom
    var n = state.kits.indexOf(kit);
    document.querySelectorAll('[data-k="kit"] option[value="' + kit.id + '"]').forEach(function (o) {
      o.textContent = kitName(kit, n);
    });
    schedulePreferencesSave();
  });
  list.addEventListener("click", function (e) {
    if (!e.target.closest("[data-kit-del]")) return;
    removeKit(e.target.closest("[data-kit]").dataset.kit);
    renderPartsList();
    renderKitBox();
    byId("btnNewKit").focus();
    schedulePreferencesSave();
    scheduleCalculation();
  });
  byId("btnNewKit").addEventListener("click", function () {
    var kit = addKit("");
    renderPartsList();
    renderKitBox();
    focusKitName(kit.id);
    schedulePreferencesSave();
  });
}
