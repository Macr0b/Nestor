/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Point d'entrée : branche chaque partie de l'interface, puis démarre (langue, réglages mémorisés, premier
   calcul). */

import { applyLanguage, detectLanguage, fillLanguageSelect, languageSelect } from "./i18n/i18n.js";
import { bindPreferences, loadPreferences } from "./project/preferences.js";
import { startBlueprintDecor } from "./ui/blueprint-decor.js";
import { bindFilesPanel } from "./ui/files-panel.js";
import { bindManualPartsPanel } from "./ui/manual-parts-panel.js";
import { bindInstall, refreshInstallButton } from "./ui/install.js";
import { bindMillingTab, renderMilling } from "./ui/milling-tab.js";
import { bindLaserTab, renderLaser } from "./ui/laser-tab.js";
import { bindNotebookTab, renderNotebook } from "./ui/notebook-tab.js";
import { bindMaterialsTab, renderLibrary } from "./ui/materials-tab.js";
import { bindCostTab, refreshCostTab } from "./ui/cost-tab.js";
import { bindPanelsEditor } from "./ui/panels-editor.js";
import { bindPartsList } from "./ui/parts-list.js";
import { renderAll } from "./ui/render-all.js";
import { bindResultView } from "./ui/result-view.js";
import { bindSettingsDialog } from "./ui/settings-dialog.js";
import { bindProjectsDialog } from "./ui/projects-dialog.js";
import { bindShortcuts } from "./ui/shortcuts.js";
import { bindModalFocusTrap } from "./ui/modal.js";
import { bindTabs } from "./ui/tabs.js";
import { bindUpdates } from "./ui/updates.js";
import { APP_VERSION } from "./version.js";
// démarrage : chaque partie de l'interface branche ses boutons et ses champs, puis la langue est chargée avant le
// premier dessin (tous les textes en dépendent), puis viennent les réglages mémorisés et le premier calcul
async function start() {
  startBlueprintDecor();
  bindTabs();
  fillLanguageSelect();
  bindFilesPanel();
  bindManualPartsPanel();
  bindResultView();
  bindPartsList();
  bindPanelsEditor();
  bindPreferences();
  bindSettingsDialog();
  bindProjectsDialog();
  bindShortcuts();
  bindModalFocusTrap();
  bindInstall();
  bindUpdates();
  bindMaterialsTab();
  bindCostTab();
  bindMillingTab();
  bindLaserTab();
  bindNotebookTab();

  const startLanguage = detectLanguage();
  languageSelect.value = startLanguage;
  await applyLanguage(startLanguage);
  loadPreferences();
  renderAll();
  renderMilling();
  renderLaser();
  renderNotebook();
  renderLibrary();
  refreshCostTab();
  refreshInstallButton();
  const versionLabel = document.getElementById("cartVer");
  if (versionLabel) versionLabel.textContent = APP_VERSION;
}

start();
