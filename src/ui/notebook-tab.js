/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Onglet Carnet : liste des réglages éprouvés (recherche, filtre), formulaire d'ajout et de modification,
   sauvegarde et import d'un fichier, lien avec l'onglet Fraisage. Les fiches sont gardées par src/notebook/notebook-store.js. */

import { languageLocale, translate } from "../i18n/i18n.js";
import { TOOL_TYPES } from "../machining/milling.js";
import { saveFile } from "../export/export-files.js";
import {
  cleanEntry,
  exportNotebook,
  entryMachines,
  filterEntries,
  importNotebook,
  loadEntries,
  newId,
  saveEntries,
  sortEntries,
  today
} from "../notebook/notebook-store.js";
import { byId, escapeHtml } from "../util/dom.js";
import { parseNumber } from "../util/numbers.js";
import { readFeedField, readLengthField, setFeedField, setLengthField, showFeed, showLength } from "./lengths.js";
import { millingSnapshot, openInMilling } from "./milling-tab.js";
import { libraryItem } from "./materials-tab.js";
import { projectMaterialId } from "../library/library-store.js";
import { selectTab } from "./tabs.js";

let entries = [];
let filterProcess = "";
// fiche en cours de modification (null : formulaire fermé) ; pendingDelete : fiche dont on confirme la suppression
let editing = null;
let pendingDelete = "";

function formatNumber(value, digits) {
  return new Intl.NumberFormat(languageLocale(), { maximumFractionDigits: digits }).format(value);
}

function showDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(languageLocale());
}

function toolName(tool) {
  return TOOL_TYPES.includes(tool) ? translate("mill.type." + tool) : "";
}

const OPERATION_KEYS = { cut: "nb.opCut", engrave: "nb.opEngrave", mark: "nb.opMark" };

/* Libellés traduits d'une fiche, pour que la recherche trouve aussi « Hélice montante » ou « Gravure ». */
function entryLabels(entry) {
  if (entry.process === "mill") return [toolName(entry.values.tool), translate("nb.mill")];
  if (entry.process === "laser") return [translate(OPERATION_KEYS[entry.values.operation]), translate("nb.laser")];
  return [translate("nb.other")];
}

function value(label, text) {
  return "<span>" + escapeHtml(label) + " <b>" + escapeHtml(text) + "</b></span>";
}

/* Valeurs d'une fiche, dans les unités choisies. */
function entryValues(entry) {
  const v = entry.values;
  const parts = [];
  if (entry.process === "mill") {
    if (v.rpm != null)
      parts.push(value(translate("mill.rpm"), formatNumber(v.rpm, 0) + " " + translate("mill.unitRpm")));
    if (v.feed != null) parts.push(value(translate("mill.feed"), showFeed(v.feed) + " " + translate("mill.unitFeed")));
    if (v.depth != null)
      parts.push(
        value(
          translate("mill.depth"),
          showLength(v.depth, { digits: 2 }) +
            " " +
            translate("mill.unitLength") +
            (v.passes ? " × " + formatNumber(v.passes, 0) : "")
        )
      );
  } else if (entry.process === "laser") {
    if (v.speed != null)
      parts.push(
        value(translate("nb.speedShort"), formatNumber(v.speed, 2) + (v.speedUnit === "mmps" ? " mm/s" : " %"))
      );
    if (v.power != null) parts.push(value(translate("nb.powerShort"), formatNumber(v.power, 2) + " %"));
    if (v.frequency != null) parts.push(value(translate("nb.frequencyShort"), formatNumber(v.frequency, 0)));
    if (v.passes != null) parts.push(value(translate("mill.passes"), formatNumber(v.passes, 0)));
  }
  return parts.join("");
}

function entryTitle(entry) {
  const parts = [entry.material || translate("nb.noMaterial")];
  if (entry.thickness != null)
    parts.push(showLength(entry.thickness, { digits: 2 }) + " " + translate("mill.unitLength"));
  if (entry.process === "laser") parts.push(translate(OPERATION_KEYS[entry.values.operation]));
  return parts.join(" · ");
}

function entrySubtitle(entry) {
  const v = entry.values;
  const parts = [];
  if (entry.machine) parts.push(entry.machine);
  if (entry.process === "mill") {
    let tool = toolName(v.tool);
    if (v.diameter != null) tool += " Ø " + showLength(v.diameter, { digits: 2 }) + " " + translate("mill.unitLength");
    if (v.flutes != null) tool += " · " + translate("nb.flutesCount", { n: formatNumber(v.flutes, 0) });
    if (tool.trim()) parts.push(tool.trim());
  }
  if (entry.process === "laser" && v.optics) parts.push(v.optics);
  return parts.join(" · ");
}

function card(entry) {
  const processKey = { mill: "nb.mill", laser: "nb.laser", other: "nb.other" }[entry.process];
  const deleting = pendingDelete === entry.id;
  return (
    '<article class="nb-card" data-id="' +
    escapeHtml(entry.id) +
    '"><span class="nb-tag ' +
    entry.process +
    '">' +
    escapeHtml(translate(processKey)) +
    '</span><div><div class="nb-title">' +
    escapeHtml(entryTitle(entry)) +
    '</div><div class="nb-sub">' +
    escapeHtml(entrySubtitle(entry)) +
    "</div>" +
    (entry.process === "other"
      ? entry.values.settings
        ? '<div class="nb-settings">' + escapeHtml(entry.values.settings) + "</div>"
        : ""
      : '<div class="nb-vals">' + entryValues(entry) + "</div>") +
    '</div><div class="nb-act"><span class="' +
    (entry.status === "ok" ? "nb-ok" : "nb-review") +
    '">' +
    escapeHtml(translate(entry.status === "ok" ? "nb.statusOk" : "nb.statusReview")) +
    "</span><span>" +
    escapeHtml(showDate(entry.date)) +
    '</span><div class="row">' +
    (entry.process === "mill"
      ? '<button type="button" class="btn sm" data-act="open">' + escapeHtml(translate("nb.openMill")) + "</button>"
      : "") +
    '<button type="button" class="btn sm" data-act="edit">' +
    escapeHtml(translate("nb.edit")) +
    "</button>" +
    (deleting
      ? '<button type="button" class="btn sm confirm" data-act="confirm">' +
        escapeHtml(translate("nb.confirmDelete")) +
        "</button>"
      : '<button type="button" class="btn sm" data-act="delete" aria-label="' +
        escapeHtml(translate("nb.delete")) +
        '" title="' +
        escapeHtml(translate("nb.delete")) +
        '">×</button>') +
    "</div></div>" +
    (entry.note ? '<div class="nb-note">' + escapeHtml(entry.note) + "</div>" : "") +
    "</article>"
  );
}

/* Menu des machines nommées dans le carnet ; le choix en cours est gardé s'il existe encore. */
function fillMachineFilter() {
  const select = byId("nbMachineFilter"),
    current = select.value,
    names = entryMachines(entries);
  select.innerHTML =
    '<option value="">' +
    escapeHtml(translate("nb.allMachines")) +
    "</option>" +
    names
      .map(function (name) {
        return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + "</option>";
      })
      .join("");
  select.value = names.includes(current) ? current : "";
}

function renderList() {
  fillMachineFilter();
  const shown = filterEntries(
    entries,
    byId("nbSearch").value,
    filterProcess,
    entryLabels,
    byId("nbMachineFilter").value
  );
  byId("nbList").innerHTML = shown.length
    ? shown.map(card).join("")
    : '<p class="nb-empty">' + escapeHtml(translate(entries.length ? "nb.noMatch" : "nb.empty")) + "</p>";
  byId("nbFilter")
    .querySelectorAll("[data-process]")
    .forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.process === filterProcess));
    });
}

function message(text) {
  byId("nbMsg").textContent = text;
}

/* ---- formulaire ---- */

const NUMBER_FIELDS = {
  mill: [
    ["nbFlutes", "flutes"],
    ["nbRpm", "rpm"],
    ["nbMillPasses", "passes"]
  ],
  laser: [
    ["nbSpeed", "speed"],
    ["nbPower", "power"],
    ["nbFrequency", "frequency"],
    ["nbLaserPasses", "passes"]
  ]
};

function showProcess(process) {
  byId("nbProcess")
    .querySelectorAll("[data-process]")
    .forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.process === process));
    });
  byId("nbForm")
    .querySelectorAll("[data-for]")
    .forEach(function (block) {
      block.hidden = block.dataset.for !== process;
    });
}

function fillToolSelect() {
  byId("nbTool").innerHTML =
    '<option value=""></option>' +
    TOOL_TYPES.map(function (type) {
      return '<option value="' + type + '">' + escapeHtml(translate("mill.type." + type)) + "</option>";
    }).join("");
}

function numberField(id, number) {
  byId(id).value = number == null ? "" : String(number);
}

/* Ouvre le formulaire sur une fiche (nouvelle ou existante). */
function openForm(entry) {
  editing = entry;
  const v = entry.values || {};
  byId("h-nbForm").textContent = translate(entries.some((e) => e.id === entry.id) ? "nb.editTitle" : "nb.newTitle");
  byId("nbMachine").value = entry.machine || "";
  byId("nbMaterial").value = entry.material || "";
  setLengthField(byId("nbThickness"), entry.thickness);
  byId("nbStatus").value = entry.status || "ok";
  byId("nbNote").value = entry.note || "";
  fillToolSelect();
  byId("nbTool").value = TOOL_TYPES.includes(v.tool) ? v.tool : "";
  setLengthField(byId("nbDiameter"), v.diameter);
  setFeedField(byId("nbFeed"), v.feed);
  setLengthField(byId("nbDepth"), v.depth);
  byId("nbOperation").value = v.operation || "cut";
  byId("nbSpeedUnit").value = v.speedUnit === "mmps" ? "mmps" : "percent";
  byId("nbOptics").value = v.optics || "";
  byId("nbSettings").value = v.settings || "";
  for (const process of ["mill", "laser"])
    for (const [id, key] of NUMBER_FIELDS[process]) numberField(id, entry.process === process ? v[key] : null);
  showProcess(entry.process);
  byId("nbFormBox").hidden = false;
  byId("pageNotebook").classList.add("editing");
  byId("nbMaterial").focus();
}

function closeForm() {
  editing = null;
  byId("nbFormBox").hidden = true;
  byId("pageNotebook").classList.remove("editing");
}

function readNumber(id) {
  const raw = byId(id).value.trim();
  return raw === "" ? null : parseNumber(raw, null);
}

function readLength(id) {
  const mm = readLengthField(byId(id));
  return mm === "" || !isFinite(mm) ? null : mm;
}

/* Fiche lue dans le formulaire (vérifiée par cleanEntry, comme à l'import). */
function formEntry() {
  const process = byId("nbProcess").querySelector('[aria-pressed="true"]').dataset.process;
  const values = {};
  if (process === "mill") {
    values.tool = byId("nbTool").value;
    values.diameter = readLength("nbDiameter");
    values.depth = readLength("nbDepth");
    const feed = readFeedField(byId("nbFeed"));
    values.feed = feed === "" || !isFinite(feed) ? null : feed;
    // fraise et matière d'origine (ouverture dans Fraisage) gardées si la fiche en vient
    if (editing.process === "mill") {
      values.family = editing.values.family;
      values.materialId = editing.values.materialId;
    }
  } else if (process === "laser") {
    values.operation = byId("nbOperation").value;
    values.speedUnit = byId("nbSpeedUnit").value;
    values.optics = byId("nbOptics").value;
  } else values.settings = byId("nbSettings").value;
  for (const [id, key] of NUMBER_FIELDS[process] || []) values[key] = readNumber(id);
  return cleanEntry({
    id: editing.id,
    date: editing.date,
    process: process,
    status: byId("nbStatus").value,
    machine: byId("nbMachine").value.trim(),
    material: byId("nbMaterial").value.trim(),
    thickness: readLength("nbThickness"),
    note: byId("nbNote").value.trim(),
    values: values
  });
}

function store() {
  if (!saveEntries(entries)) message(translate("nb.saveFailed"));
}

/* Nouvelle fiche pré-remplie avec les réglages de l'onglet Fraisage. */
function keepMilling() {
  const snap = millingSnapshot();
  const r = snap.result;
  // nom de la matière du projet (bibliothèque) quand elle correspond à celle du fraisage
  const item = libraryItem(projectMaterialId());
  const materialName = item && item.name && item.millMaterial === snap.input.material ? item.name : snap.materialName;
  openNotebookForm({
    id: newId(),
    date: today(),
    process: "mill",
    status: "ok",
    machine: "",
    material: materialName,
    thickness: snap.input.toolType === "vbit" ? snap.input.engraveDepth : snap.input.thickness,
    note: "",
    values: {
      tool: snap.input.toolType,
      diameter: snap.input.diameter,
      flutes: snap.input.flutes,
      rpm: r ? r.rpm : null,
      feed: r ? Math.round(r.feed) : null,
      // profondeur réelle de chaque passe (passes égales sur l'épaisseur), ou passe conseillée sans épaisseur
      depth: r ? (r.passes ? r.passDepth : r.depth) : null,
      passes: r ? r.passes : null,
      family: snap.input.family,
      materialId: snap.input.material
    }
  });
}

function openNotebookForm(entry) {
  selectTab(byId("tabNotebook"), false);
  openForm(entry);
}

/* Nouvelle fiche pré-remplie depuis un autre onglet (Laser), à vérifier avant d'enregistrer. */
export function keepInNotebook(entry) {
  openNotebookForm(entry);
}

/* À appeler après un changement de langue ou d'unités. */
export function renderNotebook() {
  renderList();
  if (editing) {
    // les champs de longueur suivent les unités choisies
    fillToolSelect();
    const entry = formEntry() || editing;
    openForm(entry);
  }
}

export function bindNotebookTab() {
  entries = loadEntries();
  byId("nbSearch").addEventListener("input", renderList);
  byId("nbMachineFilter").addEventListener("change", renderList);
  byId("nbFilter").addEventListener("click", function (e) {
    const button = e.target.closest("[data-process]");
    if (!button) return;
    filterProcess = button.dataset.process;
    renderList();
  });
  byId("btnNbNew").addEventListener("click", function () {
    const process = filterProcess || "mill";
    openForm({ id: newId(), date: today(), process: process, status: "ok", values: {} });
  });
  byId("nbProcess").addEventListener("click", function (e) {
    const button = e.target.closest("[data-process]");
    if (button) showProcess(button.dataset.process);
  });
  byId("btnNbCancel").addEventListener("click", closeForm);
  byId("nbForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const entry = formEntry();
    if (!entry) return;
    entries = sortEntries(
      entries
        .filter(function (other) {
          return other.id !== entry.id;
        })
        .concat([entry])
    );
    store();
    closeForm();
    message(translate("nb.saved"));
    renderList();
  });
  byId("nbList").addEventListener("click", function (e) {
    const button = e.target.closest("[data-act]");
    if (!button) return;
    const id = button.closest("[data-id]").dataset.id;
    const entry = entries.find(function (other) {
      return other.id === id;
    });
    if (!entry) return;
    const act = button.dataset.act;
    if (act === "edit") openForm(JSON.parse(JSON.stringify(entry)));
    else if (act === "open") {
      openInMilling(entry);
      selectTab(byId("tabMill"), false);
    } else if (act === "delete") {
      // deux clics : × puis « Supprimer ? », pour ne rien perdre par erreur
      pendingDelete = id;
      renderList();
    } else if (act === "confirm") {
      entries = entries.filter(function (other) {
        return other.id !== id;
      });
      pendingDelete = "";
      if (editing && editing.id === id) closeForm();
      store();
      renderList();
    }
  });
  byId("btnNbExport").addEventListener("click", function () {
    const blob = new Blob([exportNotebook(entries)], { type: "application/json" });
    const name = "nestor-carnet-" + today() + ".json";
    saveFile(name, blob).then(
      function () {
        message(translate("dl.done", { f: name }));
      },
      function () {}
    );
  });
  byId("nbImport").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    file.text().then(function (text) {
      try {
        const result = importNotebook(entries, text);
        entries = result.entries;
        store();
        message(translate("nb.imported", { n: result.added }));
      } catch (err) {
        message(translate("nb.importFailed"));
      }
      renderList();
    });
  });
  byId("btnKeepMilling").addEventListener("click", keepMilling);
  renderList();
}
