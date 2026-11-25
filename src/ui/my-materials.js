/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* « Mes matières » dans le Profil : les matières de la bibliothèque, à modifier (dans l'onglet Matières) ou à
   supprimer (second clic). */

import { translate } from "../i18n/i18n.js";
import { byId, escapeHtml } from "../util/dom.js";
import { closeModal } from "./modal.js";
import {
  deleteLibraryItem,
  editLibraryItem,
  itemLabel,
  libraryItems,
  onLibraryChange,
  formatMoney
} from "./materials-tab.js";
import { selectTab } from "./tabs.js";

// matière dont la suppression attend le second clic
let deleting = "";

export function renderMyMaterials() {
  const items = libraryItems();
  byId("profMaterials").innerHTML = items.length
    ? items
        .map(function (item) {
          const confirm = deleting === item.id;
          return (
            '<div class="proj-row" data-id="' +
            escapeHtml(item.id) +
            '"><div class="proj-info"><b>' +
            escapeHtml(itemLabel(item)) +
            "</b>" +
            (item.price != null ? "<small>" + escapeHtml(formatMoney(item.price)) + "</small>" : "") +
            '</div><button type="button" class="btn sm" data-act="edit">' +
            escapeHtml(translate("nb.edit")) +
            '</button><button type="button" class="btn sm' +
            (confirm ? " confirm" : "") +
            '" data-act="delete">' +
            escapeHtml(translate(confirm ? "nb.confirmDelete" : "nb.delete")) +
            "</button></div>"
          );
        })
        .join("")
    : '<p class="hint">' + escapeHtml(translate("prof.noMaterials")) + "</p>";
}

export function bindMyMaterials() {
  onLibraryChange(renderMyMaterials);
  byId("profMaterials").addEventListener("click", function (e) {
    const button = e.target.closest("[data-act]");
    if (!button) return;
    const id = button.closest("[data-id]").dataset.id;
    if (button.dataset.act === "edit") {
      deleting = "";
      // la fiche de la matière s'ouvre dans l'onglet Matières
      closeModal("profile");
      selectTab(byId("tabMaterials"));
      editLibraryItem(id);
      return;
    }
    if (deleting !== id) {
      deleting = id;
      renderMyMaterials();
      byId("profMaterials")
        .querySelector('[data-id="' + CSS.escape(id) + '"] [data-act="delete"]')
        .focus();
      return;
    }
    deleting = "";
    deleteLibraryItem(id);
    byId("profMatMsg").textContent = translate("prof.materialDeleted");
    // focus gardé dans la liste après la suppression
    (byId("profMaterials").querySelector("button") || byId("btnCloseProf")).focus();
  });
}
