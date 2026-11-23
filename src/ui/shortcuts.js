/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Raccourcis clavier branchés sur l'appli, et leur fenêtre d'aide (touche « ? » ou bouton des Réglages). */

import { translate } from "../i18n/i18n.js";
import { session } from "../session.js";
import { byId, escapeHtml } from "../util/dom.js";
import { openProjectsDialog, saveCurrentProject } from "./projects-dialog.js";
import { renderResult } from "./result-view.js";
import { isTyping, shortcutFor, SHORTCUTS } from "./shortcut-keys.js";
import { allTabs, selectTab } from "./tabs.js";
import { closeModal, openModal } from "./modal.js";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

function keyLabel(key) {
  if (key === "Mod") return isMac ? "⌘" : "Ctrl";
  if (key === "Alt") return isMac ? "⌥" : "Alt";
  if (key === "Enter") return translate("sc.keyEnter");
  if (key === "Esc") return translate("sc.keyEsc");
  return key;
}

function renderHelp() {
  byId("scTable").innerHTML = SHORTCUTS.map(function (s) {
    return (
      "<tr><td>" +
      s.keys
        .map(function (k) {
          return "<kbd>" + escapeHtml(keyLabel(k)) + "</kbd>";
        })
        .join("") +
      "</td><td>" +
      escapeHtml(translate("sc." + s.action)) +
      "</td></tr>"
    );
  }).join("");
}

function openShortcutsHelp() {
  renderHelp();
  // ouverte depuis Réglages : Réglages se ferme (le focus repasse sur son bouton, où il reviendra ensuite)
  closeModal("settings");
  openModal("shortcuts", byId("btnCloseSc"));
}

function closeShortcutsHelp() {
  closeModal("shortcuts");
}

function anyDialogOpen() {
  return Array.prototype.some.call(document.querySelectorAll(".overlay"), function (overlay) {
    return !overlay.hidden;
  });
}

function run(shortcut) {
  switch (shortcut.action) {
    case "calculate":
      selectTab(byId("tabNest"), false);
      renderResult();
      return;
    case "tab":
      if (allTabs()[shortcut.tab]) selectTab(allTabs()[shortcut.tab], true);
      return;
    case "save":
      // la fenêtre Projets s'ouvre pour montrer que c'est enregistré (et sous quel nom)
      openProjectsDialog().then(function () {
        return saveCurrentProject(false);
      });
      return;
    case "open":
      openProjectsDialog();
      return;
    case "import":
      selectTab(byId("tabNest"), false);
      byId("fileIn").click();
      return;
    case "pdf": {
      selectTab(byId("tabNest"), false);
      const button = document.querySelector('[data-dl="pdfall"]');
      if (button && session.lastResult) button.click();
      return;
    }
    case "help":
      openShortcutsHelp();
      return;
  }
}

export function bindShortcuts() {
  byId("btnShortcuts").addEventListener("click", openShortcutsHelp);
  byId("btnCloseSc").addEventListener("click", closeShortcutsHelp);
  byId("shortcuts").addEventListener("click", function (e) {
    if (e.target === this) closeShortcutsHelp();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !byId("shortcuts").hidden) return closeShortcutsHelp();
    const shortcut = shortcutFor(e, isTyping(e.target));
    if (!shortcut) return;
    // fenêtre ouverte : seuls Enregistrer et Ouvrir restent actifs (ils ouvrent la fenêtre Projets)
    if (anyDialogOpen() && shortcut.action !== "save" && shortcut.action !== "open") return;
    e.preventDefault();
    run(shortcut);
  });
}
