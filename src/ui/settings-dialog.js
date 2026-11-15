/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fenêtre des réglages : langue, version, nouveautés, signalement de bug. */

import { applyLanguage, languageSelect } from "../i18n/i18n.js";
import { bugReportUrl } from "./bug-report.js";
import { refreshInstallButton } from "./install.js";
import { renderMilling } from "./milling-tab.js";
import { renderAll } from "./render-all.js";
import { byId } from "../util/dom.js";

function openSettings() {
  byId("settings").hidden = false;
  byId("btnCloseSet").focus();
}

function closeSettings() {
  byId("settings").hidden = true;
}

export function bindSettingsDialog() {
  byId("btnSettings").addEventListener("click", openSettings);
  byId("btnCloseSet").addEventListener("click", closeSettings);
  byId("btnBug").addEventListener("click", function () {
    this.href = bugReportUrl();
  });
  byId("settings").addEventListener("click", function (e) {
    if (e.target === this) closeSettings();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !byId("settings").hidden) closeSettings();
  });
  languageSelect.addEventListener("change", function () {
    try {
      localStorage.setItem("plancoupe.lang", languageSelect.value);
    } catch (e) {}
    applyLanguage(languageSelect.value).then(function () {
      renderAll();
      renderMilling();
      refreshInstallButton();
    });
  });
}
