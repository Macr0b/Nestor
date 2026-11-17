/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Onglet Fraisage : champs de la fraise, de la matière et de la machine, et affichage des réglages conseillés.
   Le calcul lui-même est dans src/machining/milling.js. */

import { translate } from "../i18n/i18n.js";
import { FAMILIES, MATERIALS, materialById } from "../machining/materials.js";
import { millingSettings, TOOL_TYPES } from "../machining/milling.js";
import { cleanMillingInput, loadMillingInput, saveMillingInput } from "../machining/milling-store.js";
import { byId, escapeHtml } from "../util/dom.js";
import { readFeedField, readLengthField, setFeedField, setLengthField, showFeed, showLength } from "./lengths.js";
import { renderToolGap } from "./panels-editor.js";
import { drawResult } from "./result-view.js";
import { session } from "../session.js";
import { toolIcon } from "./tool-icons.js";
import { formatValue, valueBox } from "./value-box.js";
import { findItem, onProjectMaterialChange, projectMaterialId, setProjectMaterial } from "../library/library-store.js";
import { libraryItem, libraryItems } from "./materials-tab.js";
import { renderCost } from "./cost-tab.js";
import { parseNumber } from "../util/numbers.js";

// réglages en cours de l'onglet (relus au démarrage)
let input = null;
let preciseOpen = false;

// champs : identifiant, réglage, sorte (longueur et vitesse suivent les unités choisies)
const NUMBER_FIELDS = [
  ["millDiameter", "diameter", "length"],
  ["millFlutes", "flutes", "plain"],
  ["millSpindleMin", "spindleMin", "plain"],
  ["millSpindleMax", "spindleMax", "plain"],
  ["millFeedMax", "feedMax", "feed"],
  ["millThickness", "thickness", "length"],
  ["millAngle", "angle", "plain"],
  ["millEngraveDepth", "engraveDepth", "length"]
];

// notes du calcul : les valeurs à mettre en forme selon leur sorte
const NOTE_KINDS = { n: "plain", d: "length", e: "length" };
const FEED_NOTES = ["mill.noteFeedMax", "mill.noteThinChip"];

function familyName(id) {
  return translate("mill.fam." + id);
}

/* Listes qui dépendent de la langue : types de fraise, familles, matières précises. */
function renderChoices() {
  byId("millTypes").innerHTML = TOOL_TYPES.map(function (type) {
    return (
      '<button type="button" data-tool="' +
      type +
      '" aria-pressed="false">' +
      toolIcon(type) +
      "<span>" +
      escapeHtml(translate("mill.type." + type)) +
      "</span></button>"
    );
  }).join("");

  byId("millFamilies").innerHTML = FAMILIES.map(function (family, index) {
    let level = "";
    for (let i = 0; i < FAMILIES.length; i++) level += '<i class="' + (i <= index ? "on" : "") + '"></i>';
    return (
      '<button type="button" data-family="' +
      family.id +
      '" aria-pressed="false"><b>' +
      escapeHtml(familyName(family.id)) +
      '</b><span class="mill-level" aria-hidden="true">' +
      level +
      "</span><small>" +
      escapeHtml(translate("mill.famEx." + family.id)) +
      "</small></button>"
    );
  }).join("");

  byId("millPrecise").innerHTML = FAMILIES.map(function (family) {
    const chips = MATERIALS.filter(function (material) {
      return material.family === family.id;
    }).map(function (material) {
      return (
        '<button type="button" data-material="' +
        material.id +
        '" aria-pressed="false">' +
        escapeHtml(translate("mill.mat." + material.id)) +
        "</button>"
      );
    });
    return '<div class="mill-chips"><span>' + escapeHtml(familyName(family.id)) + "</span>" + chips.join("") + "</div>";
  }).join("");
}

/* Tableau du rappel théorique : valeurs de chaque famille de matière (celles qu'utilise le calcul). */
function renderTheoryTable() {
  const head =
    "<thead><tr><th>" +
    escapeHtml(translate("mill.thFamily")) +
    "</th><th>Vc (m/min)</th><th>fz</th><th>ap</th></tr></thead>";
  const rows = FAMILIES.map(function (family) {
    return (
      "<tr><td>" +
      escapeHtml(familyName(family.id)) +
      "</td><td>" +
      formatValue(family.cuttingSpeed, 0) +
      "</td><td>Ø ÷ " +
      formatValue(family.chipDivisor, 0) +
      "</td><td>" +
      formatValue(family.depthFactor, 2) +
      " × Ø</td></tr>"
    );
  }).join("");
  byId("millTheoryTable").innerHTML = head + "<tbody>" + rows + "</tbody>";
}

/* Ligne d'explication de la matière précise choisie : densité, classe de dureté, famille utilisée. */
function materialInfo(material) {
  const parts = [];
  if (material.density) parts.push(translate("mill.density", { d: formatValue(material.density, 0) }));
  if (material.hardness) parts.push(translate("mill.hardness", { c: material.hardness }));
  parts.push(translate("mill.asFamily", { f: familyName(material.family) }));
  return "<b>" + escapeHtml(translate("mill.mat." + material.id)) + "</b> · " + escapeHtml(parts.join(" · "));
}

/* Met la page à jour d'après les réglages en cours (sans toucher aux champs que l'on est en train de taper). */
function renderState() {
  byId("millTypes")
    .querySelectorAll("[data-tool]")
    .forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.tool === input.toolType));
    });
  byId("millFamilies")
    .querySelectorAll("[data-family]")
    .forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.family === input.family));
    });
  byId("millPrecise")
    .querySelectorAll("[data-material]")
    .forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.material === input.material));
    });
  byId("millPrecise").hidden = !preciseOpen;
  const preciseButton = byId("millPreciseBtn");
  preciseButton.setAttribute("aria-expanded", String(preciseOpen));
  preciseButton.textContent = translate(preciseOpen ? "mill.preciseHide" : "mill.preciseShow");
  const material = materialById(input.material);
  const info = byId("millMatInfo");
  info.hidden = !material;
  info.innerHTML = material ? materialInfo(material) : "";

  // fraise conique : angle et profondeur de gravure à la place de l'épaisseur
  const isVBit = input.toolType === "vbit";
  byId("millAngleField").hidden = byId("millEngraveField").hidden = !isVBit;
  byId("millThicknessField").hidden = isVBit;

  const result = millingSettings(input);
  const values = byId("millValues");
  if (!result) {
    values.innerHTML = "";
    byId("millRule").textContent = translate(isVBit ? "mill.invalidVBit" : "mill.invalid");
    byId("millNotes").innerHTML = "";
    return;
  }
  const passes = result.passes
    ? translate("mill.passesFor", {
        p: formatValue(result.passes, 0),
        d: showLength(result.passDepth, { digits: 2 }),
        t: showLength(isVBit ? input.engraveDepth : input.thickness, { digits: 2 })
      })
    : translate("mill.noThickness");
  values.innerHTML =
    valueBox(translate("mill.rpm"), formatValue(result.rpm, 0), translate("mill.unitRpm")) +
    valueBox(translate("mill.feed"), showFeed(result.feed), translate("mill.unitFeed")) +
    valueBox(translate("mill.depth"), showLength(result.depth, { digits: 2 }), translate("mill.unitLength")) +
    valueBox(translate("mill.passes"), result.passes ? formatValue(result.passes, 0) : "–", passes);
  byId("millRule").textContent = translate(isVBit ? "mill.ruleVBit" : "mill.rule", {
    c: showLength(result.chipLoad, { decimal: true, digits: 4 }),
    k: formatValue(result.chipDivisor, 0),
    f: formatValue(result.depthFactor, 2)
  });
  byId("millNotes").innerHTML = result.notes
    .map(function (note) {
      const values = {};
      for (const name of ["n", "d", "e"]) {
        if (!(name in note)) continue;
        const kind = name === "n" && FEED_NOTES.includes(note.key) ? "feed" : NOTE_KINDS[name];
        values[name] =
          kind === "feed"
            ? showFeed(note[name])
            : kind === "length"
              ? showLength(note[name], { digits: 2 })
              : formatValue(note[name], 0);
      }
      return "<li>" + escapeHtml(translate(note.key, values)) + "</li>";
    })
    .join("");
}

function fillFields() {
  for (const [id, key, kind] of NUMBER_FIELDS) {
    const field = byId(id);
    if (kind === "length") setLengthField(field, input[key]);
    else if (kind === "feed") setFeedField(field, input[key]);
    else field.value = isFinite(input[key]) ? String(input[key]) : "";
  }
}

/* Matière précise et épaisseur choisies ici : la matière de la bibliothèque qui correspond devient celle du projet
   (aucune si rien ne correspond), sauf si celle du projet correspond déjà. */
function syncProjectMaterial() {
  if (!input.material) return;
  const current = libraryItem(projectMaterialId());
  const thickness = input.toolType === "vbit" ? null : input.thickness;
  const matches =
    current &&
    current.millMaterial === input.material &&
    (thickness == null || current.thickness == null || Math.abs(current.thickness - thickness) < 0.05);
  if (matches) return;
  const found = thickness == null ? null : findItem(libraryItems(), input.material, thickness);
  setProjectMaterial(found ? found.id : "", "milling");
}

/* Matière du projet choisie dans un autre onglet : matière de fraisage et épaisseur reprises. */
function applyProjectMaterial() {
  const item = libraryItem(projectMaterialId());
  if (!item || !item.millMaterial) return;
  input.material = item.millMaterial;
  input.family = materialById(item.millMaterial).family;
  if (item.thickness) input.thickness = item.thickness;
  preciseOpen = true;
  fillFields();
  saveMillingInput(input);
  renderState();
}

function changed() {
  saveMillingInput(input);
  renderState();
  syncProjectMaterial();
  renderCost();
  // l'onglet Imbrication s'en sert : écart d'après la fraise et temps de découpe estimé
  renderToolGap();
  if (session.lastResult) drawResult(session.lastResult);
}

/* Réglages en cours et résultat, pour garder une fiche dans le carnet. */
export function millingSnapshot() {
  const material = materialById(input.material);
  return {
    input: Object.assign({}, input),
    result: millingSettings(input),
    materialName: material ? translate("mill.mat." + material.id) : familyName(input.family)
  };
}

/* Ouvre une fiche du carnet dans l'onglet Fraisage : fraise, matière et épaisseur reprises. */
export function openInMilling(entry) {
  const v = entry.values;
  if (TOOL_TYPES.includes(v.tool)) input.toolType = v.tool;
  if (v.diameter > 0) input.diameter = v.diameter;
  if (v.flutes >= 1) input.flutes = v.flutes;
  if (materialById(v.materialId)) {
    input.material = v.materialId;
    input.family = materialById(v.materialId).family;
  } else if (FAMILIES.some((f) => f.id === v.family)) {
    input.material = "";
    input.family = v.family;
  }
  if (entry.thickness > 0) {
    if (input.toolType === "vbit") input.engraveDepth = entry.thickness;
    else input.thickness = entry.thickness;
  }
  preciseOpen = !!input.material;
  fillFields();
  changed();
}

/* Réglages de fraisage d'un projet ouvert : repris tels quels (vérifiés), puis la page est refaite. */
export function applyMillingSettings(saved) {
  input = cleanMillingInput(saved);
  saveMillingInput(input);
  preciseOpen = !!input.material;
  fillFields();
  renderChoices();
  renderState();
  renderToolGap();
}

/* À appeler après un changement de langue ou d'unités : champs, listes et textes calculés sont refaits. */
export function renderMilling() {
  if (!input) return;
  fillFields();
  renderChoices();
  renderTheoryTable();
  renderState();
}

export function bindMillingTab() {
  input = loadMillingInput();
  fillFields();

  byId("millTypes").addEventListener("click", function (e) {
    const button = e.target.closest("[data-tool]");
    if (!button) return;
    input.toolType = button.dataset.tool;
    // une fraise 1 dent n'a qu'une dent : le champ suit, modifiable ensuite
    if (input.toolType === "single") {
      input.flutes = 1;
      byId("millFlutes").value = "1";
    }
    changed();
  });
  for (const [id, key, kind] of NUMBER_FIELDS)
    byId(id).addEventListener("input", function () {
      let value =
        kind === "length"
          ? readLengthField(this)
          : kind === "feed"
            ? readFeedField(this)
            : parseNumber(this.value, NaN);
      if (this.value.trim() === "") value = NaN;
      input[key] = value;
      changed();
    });
  byId("millFamilies").addEventListener("click", function (e) {
    const button = e.target.closest("[data-family]");
    if (!button) return;
    input.family = button.dataset.family;
    input.material = "";
    changed();
  });
  byId("millPrecise").addEventListener("click", function (e) {
    const button = e.target.closest("[data-material]");
    if (!button) return;
    // un deuxième clic sur la même matière la retire (on garde sa famille)
    input.material = input.material === button.dataset.material ? "" : button.dataset.material;
    if (input.material) input.family = materialById(input.material).family;
    changed();
  });
  byId("millPreciseBtn").addEventListener("click", function () {
    preciseOpen = !preciseOpen;
    renderState();
  });
  onProjectMaterialChange("milling", applyProjectMaterial);
  // une matière précise choisie lors d'une visite précédente : la liste s'ouvre pour la montrer
  preciseOpen = !!input.material;
}
