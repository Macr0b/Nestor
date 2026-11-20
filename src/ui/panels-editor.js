/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Panneaux (taille, stock, origine), écart, marge, méthode et options. */

import { sawKerf } from "../export/export-files.js";
import { exportOptions } from "../export/export-options.js";
import { translate } from "../i18n/i18n.js";
import { validOrigin } from "../placement/origin.js";
import { schedulePreferencesSave } from "../project/preferences.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { scheduleCalculation } from "./parts-list.js";
import { drawResult, renderResult } from "./result-view.js";
import { byId, escapeHtml } from "../util/dom.js";
import { parseNumber } from "../util/numbers.js";
import { lengthFieldValue } from "../util/units.js";
import { lengthInputAttributes, readLengthField, setLengthField, showLength } from "./lengths.js";
import { loadMillingInput } from "../machining/milling-store.js";
import { onProjectMaterialChange, setProjectMaterial } from "../library/library-store.js";
import { fillMaterialSelect, libraryItem, onLibraryChange } from "./materials-tab.js";
import { applyMaterialFormat, insertOffcut, materialPanelIndex } from "../project/material-panels.js";
import { lockCount, panelRowLocked, remapLockedPanels } from "../project/locks.js";

function renderPanels() {
  var ps = state.sheet.panels,
    linked = materialPanelIndex(ps);
  byId("btnAddPanel").textContent = translate(linked >= 0 ? "panel.addOffcut" : "panel.add");
  byId("panels").innerHTML = ps
    .map(function (p, i) {
      // ligne d'un panneau figé : sa taille ne peut plus changer, elle ne peut ni monter ni partir
      var locked = panelRowLocked(i),
        fixedSize = locked ? " disabled" : "";
      return (
        '<div class="pnl" data-i="' +
        i +
        '">' +
        "<input " +
        lengthInputAttributes(p.L) +
        ' id="pl' +
        i +
        '-L" data-k="L" min="1"' +
        fixedSize +
        ' aria-label="' +
        escapeHtml(translate("panel.L")) +
        '">' +
        '<span class="x" aria-hidden="true">×</span>' +
        "<input " +
        lengthInputAttributes(p.W) +
        ' id="pl' +
        i +
        '-W" data-k="W" min="1"' +
        fixedSize +
        ' aria-label="' +
        escapeHtml(translate("panel.W")) +
        '">' +
        '<input type="number" id="pl' +
        i +
        '-q" data-k="qty" inputmode="numeric" min="0" step="1" value="' +
        escapeHtml(p.qty) +
        '" placeholder="∞" aria-label="' +
        escapeHtml(translate("panel.qty")) +
        '">' +
        '<div class="origin sm" role="radiogroup" aria-label="' +
        escapeHtml(translate("origin.title")) +
        '">' +
        ORIGIN_CHOICES.map(function (o) {
          var on = o[0] === validOrigin(p.origin);
          return (
            '<button type="button" role="radio" aria-checked="' +
            on +
            '" data-o="' +
            o[0] +
            '" aria-label="' +
            escapeHtml(translate("origin.title")) +
            " " +
            o[1] +
            '" title="' +
            escapeHtml(translate("origin.title")) +
            " " +
            o[1] +
            '"><span></span></button>'
          );
        }).join("") +
        "</div>" +
        '<button class="mini" type="button" data-act="up"' +
        (i === 0 || locked || panelRowLocked(i - 1) ? " disabled" : "") +
        ' aria-label="' +
        escapeHtml(translate("panel.up")) +
        '" title="' +
        escapeHtml(translate("panel.up")) +
        '">↑</button>' +
        '<button class="mini" type="button" data-act="del"' +
        (ps.length < 2 || locked ? " disabled" : "") +
        ' aria-label="' +
        escapeHtml(translate("panel.remove")) +
        '" title="' +
        escapeHtml(translate("panel.remove")) +
        '">×</button>' +
        (i === linked ? '<span class="pnl-tag">' + escapeHtml(materialTag()) + "</span>" : "") +
        (locked ? '<span class="pnl-tag pnl-locked">' + escapeHtml(translate("lock.rowHint")) + "</span>" : "") +
        "</div>"
      );
    })
    .join("");
}

function materialTag() {
  var item = libraryItem(byId("nestMaterial").value);
  return translate("panel.fromMaterial", { m: item && item.name ? item.name : "" });
}

function followMaterial(id) {
  // la ligne qui suit la matière sert à un panneau figé : sa taille ne bouge pas, elle ne suit plus la matière
  var linked = materialPanelIndex(state.sheet.panels);
  if (linked >= 0 && panelRowLocked(linked)) delete state.sheet.panels[linked].fromMaterial;
  // une seule ligne, figée : elle garde sa taille (sinon la matière la prendrait)
  if (materialPanelIndex(state.sheet.panels) < 0 && state.sheet.panels.length === 1 && panelRowLocked(0))
    return renderPanels();
  if (!applyMaterialFormat(state.sheet.panels, libraryItem(id))) return renderPanels();
  renderPanels();
  schedulePreferencesSave();
  scheduleCalculation();
}

const ORIGIN_CHOICES = [
  ["tl", "↖"],
  ["tc", "↑"],
  ["tr", "↗"],
  ["ml", "←"],
  ["mc", "·"],
  ["mr", "→"],
  ["bl", "↙"],
  ["bc", "↓"],
  ["br", "↘"]
];

// minimums d'après la fraise de l'onglet Fraisage (doc. Vectric) : entre deux pièces, la fraise passe deux fois
// (2 × Ø) ; au bord, une fois (Ø) ; plus un peu de matière qui tient dans les deux cas
const GAP_EXTRA_MM = 1;

function toolGap() {
  var diameter = loadMillingInput().diameter;
  return diameter > 0
    ? { gap: 2 * diameter + GAP_EXTRA_MM, margin: diameter + GAP_EXTRA_MM, diameter: diameter }
    : null;
}

/* Liens « Espace minimal » et « Marge minimale » d'après la fraise (refaits quand la fraise change). */
export function renderToolGap() {
  var tool = toolGap(),
    button = byId("btnGapFromTool"),
    extra = showLength(GAP_EXTRA_MM, { digits: 2 });
  button.closest("p").hidden = !tool;
  if (!tool) return;
  byId("toolIntro").textContent = translate("panel.toolIntro", { d: showLength(tool.diameter, { digits: 2 }) });
  button.textContent = translate("panel.gapMin", { g: showLength(tool.gap, { digits: 2 }) });
  byId("gapFromToolHow").textContent = translate("panel.gapMinHow", { m: extra });
  byId("btnMarginFromTool").textContent = translate("panel.marginMin", { g: showLength(tool.margin, { digits: 2 }) });
  byId("marginFromToolHow").textContent = translate("panel.marginMinHow", { m: extra });
}

/* Épaisseur de lame : champ (vide = espace entre pièces), et alerte si l'espace est plus fin que la lame. */
function renderSawBlade() {
  var rect = state.sheet.mode === "rect",
    field = byId("sawKerf"),
    gap = Math.max(0, parseNumber(state.sheet.gap, 0)),
    kerf = sawKerf();
  byId("sawOrderWrap").hidden = !rect;
  byId("sawBladeWrap").hidden = !rect || !exportOptions.sawOrder;
  if (document.activeElement !== field) setLengthField(field, exportOptions.sawKerf);
  field.placeholder = lengthFieldValue(gap);
  var tooThin = exportOptions.sawKerf > 0 && kerf > gap + 1e-6;
  byId("sawKerfWarn").hidden = !tooThin;
  if (!tooThin) return;
  byId("sawKerfWarnText").textContent = translate("saw.kerfWarn", {
    g: showLength(gap, { digits: 2 }),
    k: showLength(kerf, { digits: 2 })
  });
  byId("btnGapFromKerf").textContent = translate("saw.gapFromKerf", { k: showLength(kerf, { digits: 2 }) });
}

/* Panneaux figés : l'espace et la marge ne peuvent plus changer (les pièces figées les respectent déjà). */
export function renderLockedFields() {
  var locked = lockCount() > 0;
  ["sG", "sM", "btnGapFromTool", "btnMarginFromTool"].forEach(function (id) {
    byId(id).disabled = locked;
  });
  byId("lockHint").hidden = !locked;
  renderPanels();
}

export function renderSheetInputs() {
  fillMaterialSelect(byId("nestMaterial"), "lib.none");
  renderToolGap();
  setLengthField(byId("sG"), state.sheet.gap);
  setLengthField(byId("sM"), state.sheet.margin);
  renderLockedFields();
  byId("projName").value = state.name || "";
  byId("sMode").value = state.sheet.mode === "rect" ? "rect" : "nest";
  byId("dlBoard").checked = exportOptions.includeBoard;
  byId("dlNumbers").checked = exportOptions.partNumbers;
  byId("cutSel").value = exportOptions.offcutMode;
  byId("sawOrder").checked = exportOptions.sawOrder;
  byId("sawFirst").value = exportOptions.sawFirst || "";
  renderSawBlade();
}

export function bindPanelsEditor() {
  byId("panels").addEventListener("input", function (e) {
    var row = e.target.closest(".pnl");
    if (!row) return;
    var p = state.sheet.panels[+row.dataset.i],
      k = e.target.dataset.k;
    if (!p || !k) return;
    if (k === "qty") p[k] = e.target.value === "" ? "" : Math.max(0, Math.floor(parseNumber(e.target.value, 0)));
    else {
      // longueur dans les unités choisies, gardée en mm ; saisie en cours illisible (« 48 1/ ») : on attend
      var length = readLengthField(e.target);
      if (Number.isNaN(length)) return;
      p[k] = length;
      // taille changée à la main : la ligne ne suit plus la matière
      if (p.fromMaterial) {
        delete p.fromMaterial;
        var tag = row.querySelector(".pnl-tag");
        if (tag) tag.remove();
        byId("btnAddPanel").textContent = translate("panel.add");
      }
    }
    schedulePreferencesSave();
    scheduleCalculation();
  });
  byId("panels").addEventListener("click", function (e) {
    var ob = e.target.closest("[data-o]");
    if (ob) {
      var p = state.sheet.panels[+ob.closest(".pnl").dataset.i];
      if (p) {
        p.origin = ob.dataset.o;
        renderPanels();
        schedulePreferencesSave();
        renderResult();
      }
      return;
    }
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var i = +b.closest(".pnl").dataset.i,
      ps = state.sheet.panels;
    if (b.dataset.act === "up" && i > 0) {
      var x = ps[i];
      ps[i] = ps[i - 1];
      ps[i - 1] = x;
      remapLockedPanels(function (pi) {
        return pi === i ? i - 1 : pi === i - 1 ? i : pi;
      });
    } else if (b.dataset.act === "del" && ps.length > 1) {
      ps.splice(i, 1);
      remapLockedPanels(function (pi) {
        return pi > i ? pi - 1 : pi;
      });
    }
    renderPanels();
    schedulePreferencesSave();
    scheduleCalculation();
  });
  // « Ajouter une chute » quand une ligne suit la matière : la chute passe devant elle
  byId("btnAddPanel").addEventListener("click", function () {
    var at = insertOffcut(state.sheet.panels);
    remapLockedPanels(function (pi) {
      return pi >= at ? pi + 1 : pi;
    });
    renderPanels();
    schedulePreferencesSave();
    scheduleCalculation();
    var el = byId("pl" + at + "-L");
    if (el) el.focus();
  });
  [
    ["sG", "gap"],
    ["sM", "margin"]
  ].forEach(function (a) {
    byId(a[0]).addEventListener("input", function (e) {
      var length = readLengthField(e.target);
      if (Number.isNaN(length)) return;
      state.sheet[a[1]] = length;
      renderSawBlade();
      schedulePreferencesSave();
      scheduleCalculation();
    });
  });
  byId("sawKerf").addEventListener("input", function (e) {
    var length = readLengthField(e.target);
    if (Number.isNaN(length)) return;
    exportOptions.sawKerf = length > 0 && length <= 50 ? length : "";
    renderSawBlade();
    schedulePreferencesSave();
    if (session.lastResult) drawResult(session.lastResult);
  });
  // espace entre pièces mis à l'épaisseur de la lame : les pièces gardent leurs cotes
  byId("btnGapFromKerf").addEventListener("click", function () {
    state.sheet.gap = sawKerf();
    setLengthField(byId("sG"), state.sheet.gap);
    renderSawBlade();
    schedulePreferencesSave();
    scheduleCalculation();
  });
  // matière de la bibliothèque, choisie ici ou dans un autre onglet : son format va sur la ligne qui la suit
  byId("nestMaterial").addEventListener("change", function () {
    setProjectMaterial(this.value, "nest");
    followMaterial(this.value);
  });
  // un projet ouvert garde ses panneaux tels qu'enregistrés
  onProjectMaterialChange("nest", function (id, source) {
    fillMaterialSelect(byId("nestMaterial"), "lib.none");
    if (source === "projects") renderPanels();
    else followMaterial(id);
  });
  onLibraryChange(function () {
    fillMaterialSelect(byId("nestMaterial"), "lib.none");
    followMaterial(byId("nestMaterial").value);
  });
  byId("btnMarginFromTool").addEventListener("click", function () {
    var tool = toolGap();
    if (!tool) return;
    state.sheet.margin = Math.round(tool.margin * 1000) / 1000;
    setLengthField(byId("sM"), state.sheet.margin);
    schedulePreferencesSave();
    scheduleCalculation();
  });
  byId("btnGapFromTool").addEventListener("click", function () {
    var tool = toolGap();
    if (!tool) return;
    state.sheet.gap = Math.round(tool.gap * 1000) / 1000;
    setLengthField(byId("sG"), state.sheet.gap);
    renderSawBlade();
    schedulePreferencesSave();
    scheduleCalculation();
  });
  byId("projName").addEventListener("input", function (e) {
    state.name = e.target.value;
    schedulePreferencesSave();
  });
  byId("sMode").addEventListener("change", function (e) {
    state.sheet.mode = e.target.value;
    renderSawBlade();
    schedulePreferencesSave();
    renderResult();
  });
  // options d'export et de coupe (sous « Méthode ») : elles ne changent pas le calcul, seulement le dessin
  byId("dlBoard").addEventListener("change", function (e) {
    exportOptions.includeBoard = e.target.checked;
    schedulePreferencesSave();
  });
  byId("dlNumbers").addEventListener("change", function (e) {
    exportOptions.partNumbers = e.target.checked;
    schedulePreferencesSave();
  });
  byId("sawOrder").addEventListener("change", function (e) {
    exportOptions.sawOrder = e.target.checked;
    renderSawBlade();
    schedulePreferencesSave();
    if (session.lastResult) drawResult(session.lastResult);
  });
  byId("sawFirst").addEventListener("change", function (e) {
    exportOptions.sawFirst = e.target.value;
    schedulePreferencesSave();
    if (session.lastResult) drawResult(session.lastResult);
  });
  byId("cutSel").addEventListener("change", function (e) {
    exportOptions.offcutMode = e.target.value;
    schedulePreferencesSave();
    if (session.lastResult) drawResult(session.lastResult);
  });
}
