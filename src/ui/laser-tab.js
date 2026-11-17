/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Onglet Laser : tes machines, la matière et l'opération, les valeurs (les tiennes ou indicatives),
   la grille de test à télécharger et l'envoi vers le carnet. Tes matières et tes valeurs : laser-materials.js. */

import { buildDxfFile } from "../export/dxf.js";
import { fileSlug, saveFile } from "../export/export-files.js";
import { buildSvgFromPaths } from "../export/svg-writer.js";
import { languageLocale, translate } from "../i18n/i18n.js";
import { LASER_CUT_LIMIT, laserSettings, publishedThicknesses, speedForMachine } from "../laser/laser-settings.js";
import {
  activeMachine,
  cleanLaserInput,
  cleanMachine,
  loadLaserInput,
  newMachineId,
  saveLaserInput
} from "../laser/laser-store.js";
import { buildTestGrid } from "../laser/test-grid.js";
import { findItem, onProjectMaterialChange, projectMaterialId, setProjectMaterial } from "../library/library-store.js";
import { today, newId } from "../notebook/notebook-store.js";
import { byId, escapeHtml } from "../util/dom.js";
import { isImperial } from "../util/units.js";
import { readLengthField, setLengthField, showLength } from "./lengths.js";
import { libraryItem, libraryItems } from "./materials-tab.js";
import { keepInNotebook } from "./notebook-tab.js";
import { renderCost } from "./cost-tab.js";
import {
  bindLaserMaterials,
  fillLaserMaterialSelect,
  laserMaterialForMill,
  laserMaterialMill,
  laserMaterialName,
  loadLaserMaterials,
  openValuesForm,
  renderMaterialButtons,
  resetOwnValues,
  resolveLaserValues
} from "./laser-materials.js";
import { formatValue, valueBox } from "./value-box.js";

let input = null;
// machine en cours de modification dans le formulaire (null : nouvelle machine)
let editingId = null;
let confirmDelete = false;

function machineLabel(machine) {
  return (machine.name || translate("lz.kind." + machine.kind)) + " — " + formatValue(machine.watts, 1) + " W";
}

function store() {
  if (!saveLaserInput(input)) byId("lzMachineMsg").textContent = translate("lz.saveFailed");
}

/* Listes qui dépendent de la langue et des machines enregistrées. */
function fillLists() {
  const machines = byId("lzMachine");
  machines.innerHTML = input.machines.length
    ? input.machines
        .map(function (m) {
          return '<option value="' + escapeHtml(m.id) + '">' + escapeHtml(machineLabel(m)) + "</option>";
        })
        .join("")
    : '<option value="">' + escapeHtml(translate("lz.noMachine")) + "</option>";
  machines.value = input.activeId;
  fillLaserMaterialSelect(byId("lzMaterial"), input.material);
  input.material = byId("lzMaterial").value;
  byId("lzOp").value = input.op;
  setLengthField(byId("lzThickness"), input.thickness);
}

// valeurs affichées (les tiennes, indicatives ou estimées) et leur origine
function currentValues() {
  const machine = activeMachine(input);
  return machine ? resolveLaserValues(machine, input.material, input.op, input.thickness) : { kind: "none" };
}

function currentSettings() {
  return currentValues().settings || null;
}

function valuesTarget() {
  const machine = activeMachine(input);
  return {
    machine: machine,
    machineLabel: machineLabel(machine),
    material: input.material,
    op: input.op,
    thickness: input.thickness
  };
}

function thicknessText(mm) {
  return showLength(mm, { digits: 2 }) + " " + translate("mill.unitLength");
}

// vitesse à montrer : celle que tu as saisie (dans ton unité), sinon celle de la machine (% Trotec ou mm/s)
function shownSpeed(machine, settings) {
  return settings.savedSpeed || speedForMachine(machine, settings);
}

/* Valeurs affichées, d'où elles viennent, et les boutons pour les modifier. */
function renderValues() {
  const machine = activeMachine(input),
    cut = input.op === "cut",
    values = byId("lzValues"),
    source = byId("lzSource");
  byId("lzThicknessField").hidden = !cut;
  renderMaterialButtons(input.material);
  const thicknesses = publishedThicknesses(input.material);
  byId("lzThicknessHint").textContent =
    cut && thicknesses.length
      ? translate("lz.publishedAny", {
          t:
            thicknesses
              .map(function (t) {
                return showLength(t, { digits: 2 });
              })
              .join(" · ") +
            " " +
            translate("mill.unitLength")
        })
      : "";
  byId("lzEdit").hidden = byId("lzDelete").hidden = !machine;
  byId("lzEditValues").hidden = byId("lzResetValues").hidden = true;
  values.innerHTML = "";
  if (!machine) {
    source.textContent = translate("lz.addFirst");
    return;
  }
  const result = currentValues();
  if (result.kind === "tooThick") {
    source.textContent = translate("lz.tooThick", { t: thicknessText(LASER_CUT_LIMIT) });
    return;
  }
  // tes valeurs se saisissent pour toute matière et toute machine (même diode ou fibre)
  byId("lzEditValues").hidden = false;
  byId("lzEditValues").textContent = translate(result.settings ? "lz.editValues" : "lz.enterValues");
  if (result.kind === "tooWeak") {
    source.textContent = translate("lz.tooWeak", { w: formatValue(machine.watts, 0), m: result.minWatts });
    return;
  }
  if (result.kind === "none") {
    source.textContent = translate(machine.kind === "co2" ? "lz.noValueOwn" : "lz.notCo2Own");
    return;
  }
  const settings = result.settings,
    speed = shownSpeed(machine, settings);
  values.innerHTML =
    valueBox(translate("nb.powerShort"), formatValue(settings.power, 1), "%") +
    valueBox(
      translate("nb.speedShort"),
      formatValue(speed.value, speed.unit === "percent" ? 2 : 1),
      speed.unit === "percent" ? "%" : "mm/s"
    ) +
    valueBox(
      translate("nb.frequencyShort"),
      settings.frequency ? formatValue(settings.frequency, 0) : "–",
      translate(cut ? "lz.unitHz" : "lz.unitPpi")
    ) +
    valueBox(
      translate("lz.zOffset"),
      (settings.zOffset > 0 ? "+" : "") + showLength(settings.zOffset, { digits: 2 }),
      translate("mill.unitLength")
    );
  const lines = [];
  if (result.kind === "own") {
    lines.push(translate("lz.ownValues"));
    // retour possible aux valeurs indicatives quand il y en a sous les tiennes
    const reference = laserSettings(machine, input.material, input.op, input.thickness);
    byId("lzResetValues").hidden = !(reference && !reference.tooWeak);
  } else if (result.kind === "estimate") {
    lines.push(
      settings.fromMachine
        ? translate("lz.estimatedOwnMachine", { m: settings.fromMachine })
        : translate("lz.estimatedOwn")
    );
  } else {
    // texte de la source : valeur publiée ou estimée, pour Trotec, Thunder Laser ou GWK
    const key = {
      trotec: ["lz.fromBook", "lz.estimated"],
      thunder: ["lz.fromThunder", "lz.estimatedThunder"],
      gweike: ["lz.fromGweike", "lz.estimatedGweike"]
    }[settings.source];
    lines.push(translate(key[settings.published ? 0 : 1], { w: formatValue(settings.bookWatts, 0) }));
    if (settings.maxLineSpeed) lines.push(translate("lz.maxLineSpeed"));
  }
  if (settings.thicknessFrom) lines.push(translate("lz.thicknessFrom", { t: thicknessText(settings.thicknessFrom) }));
  if (result.kind === "reference") lines.push(translate("lz.passes"));
  if (result.kind !== "own") lines.push(translate("lz.indicative"));
  source.textContent = lines.join(" ");
}

function changed() {
  store();
  renderValues();
  syncProjectMaterial();
}

/* Matière et épaisseur choisies ici : la matière de la bibliothèque qui correspond devient celle du projet. */
function syncProjectMaterial() {
  const mill = laserMaterialMill(input.material);
  if (!mill || input.op !== "cut") return;
  const current = libraryItem(projectMaterialId());
  if (
    current &&
    current.millMaterial === mill &&
    (current.thickness == null || Math.abs(current.thickness - input.thickness) < 0.05)
  )
    return;
  const found = findItem(libraryItems(), mill, input.thickness);
  setProjectMaterial(found ? found.id : "", "laser");
  renderCost();
}

/* Matière du projet choisie dans un autre onglet : matière et épaisseur reprises quand le laser la connaît
   (une de tes matières liée à la même matière de fraisage d'abord). */
function applyProjectMaterial() {
  const item = libraryItem(projectMaterialId());
  if (!item || !item.millMaterial) return;
  const id = laserMaterialForMill(item.millMaterial);
  if (!id) return;
  input.material = id;
  if (item.thickness) input.thickness = item.thickness;
  store();
  fillLists();
  renderValues();
}

/* ---- machines ---- */

function openMachineForm(machine) {
  editingId = machine ? machine.id : null;
  byId("lzName").value = machine ? machine.name : "";
  byId("lzKind").value = machine ? machine.kind : "co2";
  byId("lzWatts").value = machine ? String(machine.watts) : "";
  byId("lzTrotec").checked = machine ? machine.trotec : false;
  byId("lzForm").hidden = false;
  byId("lzName").focus();
}

function closeMachineForm() {
  byId("lzForm").hidden = true;
  editingId = null;
}

function saveMachine(e) {
  e.preventDefault();
  const machine = cleanMachine({
    id: editingId || newMachineId(),
    name: byId("lzName").value,
    kind: byId("lzKind").value,
    watts: Number(String(byId("lzWatts").value).replace(",", ".")),
    trotec: byId("lzTrotec").checked
  });
  if (!machine) {
    byId("lzMachineMsg").textContent = translate("lz.needWatts");
    byId("lzWatts").focus();
    return;
  }
  const index = input.machines.findIndex(function (m) {
    return m.id === machine.id;
  });
  if (index >= 0) input.machines[index] = machine;
  else input.machines.push(machine);
  input.activeId = machine.id;
  closeMachineForm();
  byId("lzMachineMsg").textContent = translate("lz.saved");
  fillLists();
  changed();
}

function deleteMachine() {
  const machine = activeMachine(input);
  if (!machine) return;
  // suppression en deux clics, comme dans la bibliothèque
  if (!confirmDelete) {
    confirmDelete = true;
    byId("lzDelete").textContent = translate("nb.confirmDelete");
    return;
  }
  confirmDelete = false;
  byId("lzDelete").textContent = translate("lz.delete");
  input.machines = input.machines.filter(function (m) {
    return m.id !== machine.id;
  });
  input.activeId = input.machines.length ? input.machines[0].id : "";
  byId("lzMachineMsg").textContent = translate("lz.deleted");
  fillLists();
  changed();
}

/* ---- carnet et grille ---- */

function keepLaser() {
  const machine = activeMachine(input),
    settings = currentSettings();
  const speed = machine && settings ? shownSpeed(machine, settings) : null;
  keepInNotebook({
    id: newId(),
    date: today(),
    process: "laser",
    status: "ok",
    machine: machine ? machineLabel(machine) : "",
    material: laserMaterialName(input.material),
    thickness: input.op === "cut" ? input.thickness : null,
    note: "",
    values: {
      operation: input.op === "cut" ? "cut" : "engrave",
      optics: "",
      speed: speed ? speed.value : null,
      speedUnit: speed ? speed.unit : "percent",
      power: settings ? settings.power : null,
      frequency: settings ? settings.frequency : null,
      passes: settings ? settings.passes : null
    }
  });
}

function downloadGrid(kind) {
  const machine = activeMachine(input),
    settings = currentSettings(),
    msg = byId("lzGridMsg");
  if (!machine || !settings) {
    msg.textContent = translate(machine ? "lz.gridNoValue" : "lz.addFirst");
    return;
  }
  // séparateur décimal de la langue (virgule ou point) ; les autres écritures n'existent pas dans la police au trait
  const speed = shownSpeed(machine, settings),
    decimal = (1.5).toLocaleString(languageLocale()).charAt(1) === "," ? "," : ".";
  const grid = buildTestGrid(settings.power, speed.value, speed.unit === "percent" ? "%" : "mm/s", decimal, {
    cell: translate("lz.gridCell"),
    labels: translate("lz.gridLabels")
  });
  const inches = isImperial(),
    data =
      kind === "svg"
        ? buildSvgFromPaths(grid.paths, grid.width, grid.height, [0, 0], inches)
        : buildDxfFile(grid.paths, 0, grid.height, inches),
    name =
      fileSlug(translate("lz.gridFile"), "laser-test") +
      "-" +
      fileSlug(laserMaterialName(input.material) + "-" + machineLabel(machine), "laser") +
      "." +
      kind;
  saveFile(name, new Blob([data], { type: kind === "svg" ? "image/svg+xml" : "application/dxf" }))
    .then(function () {
      msg.textContent = translate("dl.done", { f: name });
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") return;
      msg.textContent = translate("dl.fail");
    });
}

/* Choix de l'onglet gardés dans un projet (les machines restent celles de l'appareil). */
export function laserSelection() {
  return { material: input.material, op: input.op, thickness: input.thickness };
}

export function applyLaserSelection(saved) {
  input = cleanLaserInput(
    Object.assign({}, input, saved || {}, { machines: input.machines, activeId: input.activeId })
  );
  store();
  fillLists();
  renderValues();
}

/* À appeler après un changement de langue ou d'unités. */
export function renderLaser() {
  if (!input) return;
  fillLists();
  renderValues();
}

export function bindLaserTab() {
  loadLaserMaterials();
  input = loadLaserInput();
  bindLaserMaterials({
    material: function () {
      return input.material;
    },
    selectMaterial: function (id) {
      input.material = id;
      fillLists();
      changed();
    },
    changed: renderValues
  });
  byId("lzEditValues").addEventListener("click", function () {
    const result = currentValues(),
      machine = activeMachine(input);
    openValuesForm(valuesTarget(), result.settings, result.settings ? shownSpeed(machine, result.settings) : null);
  });
  byId("lzResetValues").addEventListener("click", function () {
    resetOwnValues(valuesTarget());
    renderValues();
  });
  byId("lzMachine").addEventListener("change", function () {
    input.activeId = this.value;
    confirmDelete = false;
    byId("lzDelete").textContent = translate("lz.delete");
    changed();
  });
  byId("lzAdd").addEventListener("click", function () {
    openMachineForm(null);
  });
  byId("lzEdit").addEventListener("click", function () {
    openMachineForm(activeMachine(input));
  });
  byId("lzDelete").addEventListener("click", deleteMachine);
  byId("lzCancel").addEventListener("click", closeMachineForm);
  byId("lzForm").addEventListener("submit", saveMachine);
  byId("lzMaterial").addEventListener("change", function () {
    input.material = this.value;
    changed();
  });
  byId("lzOp").addEventListener("change", function () {
    input.op = this.value;
    changed();
  });
  byId("lzThickness").addEventListener("input", function () {
    const value = readLengthField(this);
    if (value > 0) {
      input.thickness = value;
      changed();
    }
  });
  byId("btnKeepLaser").addEventListener("click", keepLaser);
  byId("pageLaser").addEventListener("click", function (e) {
    const button = e.target.closest("[data-grid]");
    if (button) downloadGrid(button.dataset.grid);
  });
  onProjectMaterialChange("laser", applyProjectMaterial);
}
