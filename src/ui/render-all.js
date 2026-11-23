/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Redessine toute l'interface à partir de l'état du projet. */

import { renderFileInfo } from "./files-panel.js";
import { renderGuideButtons } from "./guide-dialog.js";
import { renderFoldButtons } from "./fold-blocks.js";
import { renderManualPartsPanel } from "./manual-parts-panel.js";
import { renderSheetInputs } from "./panels-editor.js";
import { renderPartsList } from "./parts-list.js";
import { renderResult } from "./result-view.js";

export function renderAll() {
  renderGuideButtons();
  renderFoldButtons();
  renderSheetInputs();
  renderFileInfo();
  renderManualPartsPanel();
  renderPartsList();
  renderResult();
}
