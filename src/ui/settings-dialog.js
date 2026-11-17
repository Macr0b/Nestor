/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fenêtre des réglages : langue, thème, unités, version, nouveautés, signalement de bug. */

import { applyLanguage, currentLanguage, languageSelect } from "../i18n/i18n.js";
import { bugReportUrl } from "./bug-report.js";
import { refreshInstallButton } from "./install.js";
import { renderMilling } from "./milling-tab.js";
import { renderLaser } from "./laser-tab.js";
import { renderNotebook } from "./notebook-tab.js";
import { renderLibrary } from "./materials-tab.js";
import { refreshCostTab } from "./cost-tab.js";
import { renderAll } from "./render-all.js";
import { byId } from "../util/dom.js";
import { lengthUnits, setLengthUnits } from "../util/units.js";

function openSettings() {
  byId("settings").hidden = false;
  byId("btnCloseSet").focus();
}

function closeSettings() {
  byId("settings").hidden = true;
}

// textes et valeurs refaits dans la langue et les unités choisies
function refreshAll() {
  renderAll();
  renderMilling();
  renderLaser();
  renderNotebook();
  renderLibrary();
  refreshCostTab();
  refreshInstallButton();
}

function showUnitsChoice() {
  const units = lengthUnits();
  byId("unitsSel").value = units.system;
  byId("fractionStepSel").value = String(units.step);
  byId("fractionStepField").hidden = units.system !== "fraction";
}

/* Unités d'affichage : seules la saisie et l'affichage changent, les tailles gardées en mm ne bougent pas. */
function changeUnits() {
  setLengthUnits(byId("unitsSel").value, Number(byId("fractionStepSel").value));
  showUnitsChoice();
  applyLanguage(currentLanguage).then(refreshAll);
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
  const themeSelect = byId("themeSel");
  try {
    themeSelect.value = localStorage.getItem("nestor.theme") || "auto";
  } catch (e) {}
  themeSelect.addEventListener("change", function () {
    try {
      localStorage.setItem("nestor.theme", themeSelect.value);
    } catch (e) {}
    // src/ui/theme-early.js relit le choix et l'applique
    document.dispatchEvent(new Event("nestor-theme"));
  });
  showUnitsChoice();
  byId("unitsSel").addEventListener("change", changeUnits);
  byId("fractionStepSel").addEventListener("change", changeUnits);
  languageSelect.addEventListener("change", function () {
    try {
      localStorage.setItem("plancoupe.lang", languageSelect.value);
    } catch (e) {}
    applyLanguage(languageSelect.value).then(refreshAll);
  });
}
