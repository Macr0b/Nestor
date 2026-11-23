/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Onglet Matières : bibliothèque des panneaux achetés (ajout, modification, suppression, sauvegarde et import)
   et menus « Matière » des autres onglets. La matière du projet est partagée par src/library/library-store.js. */

import { languageLocale, translate } from "../i18n/i18n.js";
import { FAMILIES, MATERIALS, materialById } from "../machining/materials.js";
import { saveFile } from "../export/export-files.js";
import {
  cleanItem,
  exportLibrary,
  importLibrary,
  loadItems,
  newItemId,
  pricePerArea,
  projectMaterialId,
  saveItems,
  setProjectMaterial,
  sortItems
} from "../library/library-store.js";
import { today } from "../notebook/notebook-store.js";
import { byId, escapeHtml } from "../util/dom.js";
import { isImperial, MM_PER_INCH } from "../util/units.js";
import { readLengthField, setLengthField, showLength } from "./lengths.js";

let items = [];
let editing = null;
let pendingDelete = "";
const libraryListeners = [];

export function libraryItems() {
  return items;
}

export function libraryItem(id) {
  return (
    items.find(function (item) {
      return item.id === id;
    }) || null
  );
}

/* Prévient les autres onglets quand la bibliothèque change (menus à refaire). */
export function onLibraryChange(callback) {
  libraryListeners.push(callback);
}

function libraryChanged() {
  for (const callback of libraryListeners) callback();
}

function millName(id) {
  return materialById(id) ? translate("mill.mat." + id) : "";
}

/* Nom affiché : « CP peuplier 18 mm — 2500 × 1220 ». */
export function itemLabel(item) {
  let label = item.name || millName(item.millMaterial);
  if (item.thickness) label += " " + showLength(item.thickness, { digits: 2 }) + " " + translate("mill.unitLength");
  if (item.L && item.W) label += " — " + showLength(item.L) + " × " + showLength(item.W);
  return label;
}

/* Menu « Matière » : les matières de la bibliothèque, plus un choix vide (texte de noneKey). */
export function fillMaterialSelect(select, noneKey) {
  select.innerHTML =
    '<option value="">' +
    escapeHtml(translate(noneKey)) +
    "</option>" +
    items
      .map(function (item) {
        return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(itemLabel(item)) + "</option>";
      })
      .join("");
  select.value = libraryItem(projectMaterialId()) ? projectMaterialId() : "";
}

/* Monnaie choisie dans l'onglet Coût (gardée ici pour afficher les prix de la bibliothèque). */
let currency = "EUR";
export function setLibraryCurrency(code) {
  currency = code;
  renderLibrary();
}

export function formatMoney(value) {
  try {
    return new Intl.NumberFormat(languageLocale(), { style: "currency", currency: currency }).format(value);
  } catch (e) {
    return value.toFixed(2) + " " + currency;
  }
}

function areaPriceText(item) {
  const perMm2 = pricePerArea(item);
  if (perMm2 == null) return "–";
  // prix au m², ou au pied carré en pouces
  return isImperial()
    ? formatMoney(perMm2 * Math.pow(12 * MM_PER_INCH, 2)) + "/ft²"
    : formatMoney(perMm2 * 1e6) + "/m²";
}

export function renderLibrary() {
  const current = projectMaterialId();
  const head =
    "<thead><tr><th>" +
    escapeHtml(translate("lib.name")) +
    '</th><th class="n">' +
    escapeHtml(translate("lib.thicknessShort")) +
    '</th><th class="n">' +
    escapeHtml(translate("lib.panel")) +
    '</th><th class="n">' +
    escapeHtml(translate("lib.priceShort")) +
    '</th><th class="n">' +
    escapeHtml(translate("lib.areaPrice")) +
    "</th><th></th></tr></thead>";
  const rows = items
    .map(function (item) {
      const deleting = pendingDelete === item.id;
      const unit = " " + translate("mill.unitLength");
      return (
        '<tr data-id="' +
        escapeHtml(item.id) +
        '"' +
        (item.id === current ? ' class="current"' : "") +
        "><td>" +
        escapeHtml(item.name || millName(item.millMaterial)) +
        (item.name && item.millMaterial
          ? '<div class="hint">' + escapeHtml(millName(item.millMaterial)) + "</div>"
          : "") +
        (item.id === current ? '<span class="tag">' + escapeHtml(translate("lib.inProject")) + "</span>" : "") +
        '</td><td class="n">' +
        (item.thickness ? escapeHtml(showLength(item.thickness, { digits: 2 }) + unit) : "–") +
        '</td><td class="n">' +
        (item.L && item.W ? escapeHtml(showLength(item.L) + " × " + showLength(item.W)) : "–") +
        '</td><td class="n">' +
        (item.price != null ? escapeHtml(formatMoney(item.price)) : "–") +
        '</td><td class="n">' +
        escapeHtml(areaPriceText(item)) +
        '</td><td class="act">' +
        (item.id === current
          ? ""
          : '<button type="button" class="btn sm" data-act="use">' + escapeHtml(translate("lib.use")) + "</button>") +
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
        "</td></tr>"
      );
    })
    .join("");
  byId("libTable").innerHTML = items.length
    ? head + "<tbody>" + rows + "</tbody>"
    : '<tbody><tr><td class="nb-empty">' + escapeHtml(translate("lib.empty")) + "</td></tr></tbody>";
  if (editing) fillMillSelect(byId("libMill"), byId("libMill").value);
}

/* Liste des matières de fraisage, par famille (bibliothèque et matières laser). */
export function fillMillSelect(select, selected) {
  select.innerHTML =
    '<option value="">' +
    escapeHtml(translate("lib.noMill")) +
    "</option>" +
    FAMILIES.map(function (family) {
      return (
        '<optgroup label="' +
        escapeHtml(translate("mill.fam." + family.id)) +
        '">' +
        MATERIALS.filter((m) => m.family === family.id)
          .map(function (m) {
            return '<option value="' + m.id + '">' + escapeHtml(translate("mill.mat." + m.id)) + "</option>";
          })
          .join("") +
        "</optgroup>"
      );
    }).join("");
  select.value = selected || "";
}

function openForm(item) {
  editing = item;
  byId("h-libForm").textContent = translate(libraryItem(item.id) ? "lib.editTitle" : "lib.newTitle");
  byId("libName").value = item.name || "";
  fillMillSelect(byId("libMill"), item.millMaterial);
  setLengthField(byId("libThickness"), item.thickness);
  setLengthField(byId("libL"), item.L);
  setLengthField(byId("libW"), item.W);
  byId("libPrice").value = item.price == null ? "" : String(item.price);
  byId("libPriceLabel").textContent = translate("lib.price") + " (" + currency + ")";
  byId("libFormBox").hidden = false;
  byId("pageMaterials").classList.add("editing");
  byId("libName").focus();
}

function closeForm() {
  editing = null;
  byId("libFormBox").hidden = true;
  byId("pageMaterials").classList.remove("editing");
}

function readLength(id) {
  const mm = readLengthField(byId(id));
  return mm === "" || !isFinite(mm) ? null : mm;
}

function message(text) {
  byId("libMsg").textContent = text;
}

function store() {
  if (!saveItems(items)) message(translate("nb.saveFailed"));
  libraryChanged();
}

export function bindMaterialsTab() {
  items = loadItems();
  byId("btnLibNew").addEventListener("click", function () {
    openForm({ id: newItemId() });
  });
  byId("btnLibCancel").addEventListener("click", closeForm);
  // matière de fraisage choisie et nom encore vide : le nom suit
  byId("libMill").addEventListener("change", function () {
    if (!byId("libName").value.trim()) byId("libName").placeholder = millName(this.value);
  });
  byId("libForm").addEventListener("submit", function (e) {
    e.preventDefault();
    // épaisseur ou taille tapée mais illisible, nulle ou négative : le dire plutôt que l'effacer sans prévenir
    const wrong = ["libThickness", "libL", "libW"].find(function (id) {
      const mm = readLengthField(byId(id));
      return mm !== "" && !(mm > 0);
    });
    if (wrong) {
      message(translate("lib.badSize", { f: byId(wrong).previousElementSibling.textContent }));
      byId(wrong).focus();
      return;
    }
    const price = byId("libPrice").value.trim();
    const item = cleanItem({
      id: editing.id,
      name: byId("libName").value,
      millMaterial: byId("libMill").value,
      thickness: readLength("libThickness"),
      L: readLength("libL"),
      W: readLength("libW"),
      price: price === "" ? null : Number(price.replace(",", "."))
    });
    if (!item) {
      message(translate("lib.needName"));
      return;
    }
    items = sortItems(
      items
        .filter(function (other) {
          return other.id !== item.id;
        })
        .concat([item])
    );
    store();
    closeForm();
    message(translate("lib.saved"));
    renderLibrary();
  });
  byId("libTable").addEventListener("click", function (e) {
    const button = e.target.closest("[data-act]");
    if (!button) return;
    const id = button.closest("[data-id]").dataset.id;
    const item = libraryItem(id);
    if (!item) return;
    const act = button.dataset.act;
    if (act === "use") setProjectMaterial(id, "materials");
    else if (act === "edit") openForm(Object.assign({}, item));
    else if (act === "delete") pendingDelete = id;
    else if (act === "confirm") {
      items = items.filter((other) => other.id !== id);
      pendingDelete = "";
      if (projectMaterialId() === id) setProjectMaterial("", "materials");
      if (editing && editing.id === id) closeForm();
      store();
    }
    renderLibrary();
  });
  byId("btnLibExport").addEventListener("click", function () {
    const name = "nestor-matieres-" + today() + ".json";
    saveFile(name, new Blob([exportLibrary(items)], { type: "application/json" })).then(
      function () {
        message(translate("dl.done", { f: name }));
      },
      function () {}
    );
  });
  byId("libImport").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    file.text().then(function (text) {
      try {
        const result = importLibrary(items, text);
        items = result.items;
        store();
        message(translate("lib.imported", { n: result.added }));
      } catch (err) {
        message(translate("lib.importFailed"));
      }
      renderLibrary();
    });
  });
  renderLibrary();
}
