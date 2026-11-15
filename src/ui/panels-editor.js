/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Panneaux (taille, stock, origine), écart, marge, méthode et options. */

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

function renderPanels() {
  var ps = state.sheet.panels;
  byId("panels").innerHTML = ps
    .map(function (p, i) {
      return (
        '<div class="pnl" data-i="' +
        i +
        '">' +
        '<input type="number" id="pl' +
        i +
        '-L" data-k="L" inputmode="decimal" min="1" value="' +
        escapeHtml(p.L) +
        '" aria-label="' +
        escapeHtml(translate("panel.L")) +
        '">' +
        '<span class="x" aria-hidden="true">×</span>' +
        '<input type="number" id="pl' +
        i +
        '-W" data-k="W" inputmode="decimal" min="1" value="' +
        escapeHtml(p.W) +
        '" aria-label="' +
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
        (i === 0 ? " disabled" : "") +
        ' aria-label="' +
        escapeHtml(translate("panel.up")) +
        '" title="' +
        escapeHtml(translate("panel.up")) +
        '">↑</button>' +
        '<button class="mini" type="button" data-act="del"' +
        (ps.length < 2 ? " disabled" : "") +
        ' aria-label="' +
        escapeHtml(translate("panel.remove")) +
        '" title="' +
        escapeHtml(translate("panel.remove")) +
        '">×</button></div>'
      );
    })
    .join("");
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

export function renderSheetInputs() {
  renderPanels();
  byId("sG").value = state.sheet.gap;
  byId("sM").value = state.sheet.margin;
  byId("projName").value = state.name || "";
  byId("sMode").value = state.sheet.mode === "rect" ? "rect" : "nest";
  byId("dlBoard").checked = exportOptions.includeBoard;
  byId("cutSel").value = exportOptions.offcutMode;
}

export function bindPanelsEditor() {
  byId("panels").addEventListener("input", function (e) {
    var row = e.target.closest(".pnl");
    if (!row) return;
    var p = state.sheet.panels[+row.dataset.i],
      k = e.target.dataset.k;
    if (!p || !k) return;
    p[k] =
      e.target.value === ""
        ? ""
        : k === "qty"
          ? Math.max(0, Math.floor(parseNumber(e.target.value, 0)))
          : parseNumber(e.target.value, 0);
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
    } else if (b.dataset.act === "del" && ps.length > 1) ps.splice(i, 1);
    renderPanels();
    schedulePreferencesSave();
    scheduleCalculation();
  });
  byId("btnAddPanel").addEventListener("click", function () {
    var ps = state.sheet.panels,
      l = ps[ps.length - 1] || { L: 600, W: 400 };
    ps.push({ L: l.L, W: l.W, qty: "", origin: validOrigin(l.origin) });
    renderPanels();
    schedulePreferencesSave();
    scheduleCalculation();
    var el = byId("pl" + (ps.length - 1) + "-L");
    if (el) el.focus();
  });
  [
    ["sG", "gap"],
    ["sM", "margin"]
  ].forEach(function (a) {
    byId(a[0]).addEventListener("input", function (e) {
      state.sheet[a[1]] = e.target.value === "" ? "" : parseNumber(e.target.value, 0);
      schedulePreferencesSave();
      scheduleCalculation();
    });
  });
  byId("projName").addEventListener("input", function (e) {
    state.name = e.target.value;
    schedulePreferencesSave();
  });
  byId("sMode").addEventListener("change", function (e) {
    state.sheet.mode = e.target.value;
    schedulePreferencesSave();
    renderResult();
  });
  // options d'export et de coupe (sous « Méthode ») : elles ne changent pas le calcul, seulement le dessin
  byId("dlBoard").addEventListener("change", function (e) {
    exportOptions.includeBoard = e.target.checked;
    schedulePreferencesSave();
  });
  byId("cutSel").addEventListener("change", function (e) {
    exportOptions.offcutMode = e.target.value;
    schedulePreferencesSave();
    if (session.lastResult) drawResult(session.lastResult);
  });
}
