/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Onglet Coût : coût de revient du dernier plan calculé (matière, chute, machine), réparti sur les pièces.
   Le calcul est dans src/library/plan-cost.js ; la matière et son prix viennent de la bibliothèque (onglet Matières). */

import { languageLocale, translate } from "../i18n/i18n.js";
import { outerContourLength } from "../geometry/polylines.js";
import { estimateCutTime, splitDuration } from "../machining/cut-time.js";
import { loadMillingInput } from "../machining/milling-store.js";
import { millingSettings } from "../machining/milling.js";
import {
  onProjectMaterialChange,
  panelPrice,
  projectMaterialId,
  setProjectMaterial
} from "../library/library-store.js";
import { costPerPart, planCost } from "../library/plan-cost.js";
import { partArea, partDisplayName, scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { byId, escapeHtml } from "../util/dom.js";
import { isImperial, MM_PER_INCH } from "../util/units.js";
import { fillMaterialSelect, formatMoney, libraryItem, onLibraryChange, setLibraryCurrency } from "./materials-tab.js";
import { showLength } from "./lengths.js";

const COST_KEY = "nestor.cout.v1";
const CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "SEK",
  "NOK",
  "DKK",
  "TRY",
  "KRW",
  "THB",
  "IDR"
];

// réglages de l'onglet, gardés sur l'appareil ; prices : prix saisis à la main, par taille de panneau
let settings = { currency: "EUR", lastSheet: "full", rate: null, prep: null, prices: {} };

// réglages relus et vérifiés (appareil ou projet ouvert) : une valeur absente ou abîmée reprend sa valeur de départ
function cleanCostSettings(saved) {
  const clean = { currency: "EUR", lastSheet: "full", rate: null, prep: null, prices: {} };
  saved = saved && typeof saved === "object" ? saved : {};
  if (CURRENCIES.includes(saved.currency)) clean.currency = saved.currency;
  if (saved.lastSheet === "used") clean.lastSheet = "used";
  if (typeof saved.rate === "number" && saved.rate >= 0) clean.rate = saved.rate;
  if (typeof saved.prep === "number" && saved.prep >= 0) clean.prep = saved.prep;
  if (saved.prices && typeof saved.prices === "object")
    for (const [key, value] of Object.entries(saved.prices))
      if (/^[\d.]+x[\d.]+$/.test(key) && typeof value === "number" && value >= 0) clean.prices[key] = value;
  return clean;
}

function loadSettings() {
  try {
    settings = cleanCostSettings(JSON.parse(localStorage.getItem(COST_KEY) || "null"));
  } catch (e) {}
}

function saveSettings() {
  try {
    localStorage.setItem(COST_KEY, JSON.stringify(settings));
  } catch (e) {}
}

function sizeKey(L, W) {
  return Math.round(L * 10) / 10 + "x" + Math.round(W * 10) / 10;
}

function readNumber(id) {
  const raw = byId(id).value.trim().replace(",", ".");
  const value = parseFloat(raw);
  return raw !== "" && isFinite(value) && value >= 0 ? value : null;
}

/* Panneaux du dernier plan : taille, surface des pièces posées et rectangle qu'elles occupent. */
function planSheets(result) {
  return result.sheets.map(function (sheet) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = 0,
      y1 = 0,
      area = 0;
    for (const p of sheet.parts) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x + p.w);
      y1 = Math.max(y1, p.y + p.h);
      area += partArea(scaledPart(state.types[p.i]));
    }
    const margin = Number(state.sheet.margin) || 0;
    const extent = sheet.parts.length
      ? { w: Math.min(sheet.L, x1 - x0 + margin), h: Math.min(sheet.W, y1 - y0 + margin) }
      : null;
    return { L: sheet.L, W: sheet.W, area: area, extent: extent };
  });
}

/* Temps de découpe estimé (contours extérieurs, réglages de l'onglet Fraisage), comme dans l'onglet Imbrication. */
function cutMinutes(result) {
  let length = 0;
  for (const sheet of result.sheets)
    for (const p of sheet.parts) length += outerContourLength(scaledPart(state.types[p.i]));
  const time = estimateCutTime(length, millingSettings(loadMillingInput()));
  return time ? time.minutes : null;
}

function priceFor(L, W) {
  const item = libraryItem(projectMaterialId());
  if (item) {
    const p = panelPrice(item, L, W);
    return p ? p.price : null;
  }
  const manual = settings.prices[sizeKey(L, W)];
  return manual >= 0 ? manual : null;
}

function areaText(mm2) {
  return isImperial()
    ? new Intl.NumberFormat(languageLocale(), { maximumFractionDigits: 2 }).format(
        mm2 / Math.pow(12 * MM_PER_INCH, 2)
      ) + " ft²"
    : new Intl.NumberFormat(languageLocale(), { maximumFractionDigits: 3 }).format(mm2 / 1e6) + " m²";
}

/* Lignes « panneaux utilisés » : prix de la bibliothèque, ou champ à remplir sans matière choisie. */
function renderPanels(sheets) {
  const item = libraryItem(projectMaterialId());
  const sizes = [];
  for (const s of sheets) {
    const key = sizeKey(s.L, s.W);
    const found = sizes.find((x) => x.key === key);
    if (found) found.count++;
    else sizes.push({ key: key, L: s.L, W: s.W, count: 1 });
  }
  let prorata = false;
  byId("costPanels").innerHTML = sizes
    .map(function (size) {
      const label =
        escapeHtml(
          translate("cost.panelLine", {
            // même ordre que le résultat de l'imbrication
            w: showLength(size.W),
            h: showLength(size.L),
            n: size.count
          })
        ) + "";
      if (item) {
        const p = panelPrice(item, size.L, size.W);
        if (p && p.prorata) prorata = true;
        return "<div><span>" + label + "</span><b>" + (p ? escapeHtml(formatMoney(p.price)) : "–") + "</b></div>";
      }
      const value = settings.prices[size.key];
      return (
        "<div><span>" +
        label +
        '</span><input type="number" min="0" step="any" inputmode="decimal" data-size="' +
        size.key +
        '" aria-label="' +
        escapeHtml(translate("cost.panelPrice")) +
        '" value="' +
        (value >= 0 ? value : "") +
        '"></div>'
      );
    })
    .join("");
  byId("costPanelsHint").textContent = item
    ? prorata
      ? translate("cost.prorata")
      : ""
    : translate(sizes.length ? "cost.manualHint" : "");
}

function stat(label, value, detail, big) {
  return (
    "<div" +
    (big ? ' class="big"' : "") +
    "><small>" +
    escapeHtml(label) +
    "</small><b>" +
    escapeHtml(value) +
    "</b><em>" +
    escapeHtml(detail) +
    "</em></div>"
  );
}

/* onlyResult : ne refait que le résultat (pendant la saisie d'un prix, pour garder le champ en cours). */
export function renderCost(onlyResult) {
  if (!byId("costResult")) return;
  if (onlyResult !== true) fillMaterialSelect(byId("costMaterial"), "cost.manual");
  byId("costRateLabel").textContent = translate("cost.rate", { c: settings.currency });
  const result = session.lastResult;
  if (!result || !result.sheets.length) {
    byId("costPanels").innerHTML = "";
    byId("costPanelsHint").textContent = "";
    byId("costTimeHint").textContent = "";
    byId("costResult").innerHTML = '<p class="hint">' + escapeHtml(translate("cost.noPlan")) + "</p>";
    return;
  }
  const sheets = planSheets(result);
  if (onlyResult !== true) renderPanels(sheets);
  const minutes = cutMinutes(result);
  byId("costTimeHint").textContent =
    minutes == null ? translate("cost.noTime") : translate("cost.timeHint", { t: durationText(minutes) });
  const cost = planCost(sheets, priceFor, {
    lastSheet: settings.lastSheet,
    rate: settings.rate,
    prepMinutes: settings.prep,
    cutMinutes: minutes
  });
  const item = libraryItem(projectMaterialId());
  // pièces posées : surface et nombre par type
  const counts = {};
  for (const sheet of result.sheets) for (const p of sheet.parts) counts[p.i] = (counts[p.i] || 0) + 1;
  const parts = Object.keys(counts).map(function (i) {
    return { key: i, area: partArea(scaledPart(state.types[i])), count: counts[i] };
  });
  const perPart = costPerPart(parts, cost.total);
  const rows = perPart
    .map(function (p, k) {
      const type = state.types[p.key];
      return (
        "<tr><td>" +
        escapeHtml(+p.key + 1 + " · " + partDisplayName(type, +p.key)) +
        '</td><td class="n">' +
        parts[k].count +
        '</td><td class="n">' +
        escapeHtml(areaText(parts[k].area)) +
        '</td><td class="n">' +
        escapeHtml(formatMoney(p.unit)) +
        '</td><td class="n">' +
        escapeHtml(formatMoney(p.total)) +
        "</td></tr>"
      );
    })
    .join("");
  byId("costResult").innerHTML =
    (cost.missingPrice ? '<p class="ct-warn">' + escapeHtml(translate("cost.missingPrice")) + "</p>" : "") +
    '<div class="ct-tot">' +
    stat(
      translate("cost.materialCost"),
      formatMoney(cost.material),
      translate("cost.sheets", { n: sheets.length }) + (item ? " · " + (item.name || "") : "")
    ) +
    stat(
      translate("cost.waste"),
      formatMoney(cost.waste),
      translate("cost.wasteShare", {
        p: new Intl.NumberFormat(languageLocale(), { maximumFractionDigits: 1 }).format(cost.wasteShare * 100)
      })
    ) +
    stat(
      translate("cost.machineCost"),
      formatMoney(cost.machine),
      cost.minutes ? durationText(cost.minutes) : translate("cost.noRate")
    ) +
    stat(translate("cost.total"), formatMoney(cost.total), translate("cost.totalHint"), true) +
    "</div>" +
    '<table class="ct-table"><thead><tr><th>' +
    escapeHtml(translate("cost.part")) +
    '</th><th class="n">' +
    escapeHtml(translate("cost.qty")) +
    '</th><th class="n">' +
    escapeHtml(translate("cost.area")) +
    '</th><th class="n">' +
    escapeHtml(translate("cost.unit")) +
    '</th><th class="n">' +
    escapeHtml(translate("cost.partTotal")) +
    "</th></tr></thead><tbody>" +
    rows +
    '</tbody></table><p class="hint">' +
    escapeHtml(translate("cost.estimate")) +
    "</p>";
}

function durationText(minutes) {
  const d = splitDuration(minutes);
  return translate(d.hours ? "res.timeHours" : "res.timeMinutes", { h: d.hours, m: d.minutes });
}

function fillCurrencySelect() {
  let names = null;
  try {
    names = new Intl.DisplayNames([languageLocale()], { type: "currency" });
  } catch (e) {}
  byId("costCurrency").innerHTML = CURRENCIES.map(function (code) {
    return '<option value="' + code + '">' + escapeHtml(code + (names ? " · " + names.of(code) : "")) + "</option>";
  }).join("");
  byId("costCurrency").value = settings.currency;
}

/* À appeler après un changement de langue ou d'unités. */
export function refreshCostTab() {
  fillCurrencySelect();
  renderCost();
}

function fillSettingFields() {
  setLibraryCurrency(settings.currency);
  fillCurrencySelect();
  byId("costLastSheet").value = settings.lastSheet;
  byId("costRate").value = settings.rate == null ? "" : String(settings.rate);
  byId("costPrep").value = settings.prep == null ? "" : String(settings.prep);
}

/* Réglages du coût gardés dans un projet. */
export function costSettings() {
  return JSON.parse(JSON.stringify(settings));
}

export function applyCostSettings(saved) {
  settings = cleanCostSettings(saved);
  saveSettings();
  fillSettingFields();
  renderCost();
}

export function bindCostTab() {
  loadSettings();
  fillSettingFields();
  byId("costMaterial").addEventListener("change", function () {
    setProjectMaterial(this.value, "cost");
    renderCost();
  });
  byId("costCurrency").addEventListener("change", function () {
    settings.currency = this.value;
    setLibraryCurrency(settings.currency);
    saveSettings();
    renderCost();
  });
  byId("costLastSheet").addEventListener("change", function () {
    settings.lastSheet = this.value === "used" ? "used" : "full";
    saveSettings();
    renderCost();
  });
  for (const [id, key] of [
    ["costRate", "rate"],
    ["costPrep", "prep"]
  ])
    byId(id).addEventListener("input", function () {
      settings[key] = readNumber(id);
      saveSettings();
      renderCost();
    });
  byId("costPanels").addEventListener("input", function (e) {
    const key = e.target.dataset.size;
    if (!key) return;
    const value = parseFloat(e.target.value.replace(",", "."));
    if (e.target.value.trim() === "" || !(value >= 0)) delete settings.prices[key];
    else settings.prices[key] = value;
    saveSettings();
    renderCost(true);
  });
  onProjectMaterialChange("cost", function () {
    renderCost();
  });
  onLibraryChange(function () {
    renderCost();
  });
}
