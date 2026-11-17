/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Matières de l'onglet Laser : les tiennes (ajoutées, modifiées, supprimées) et les indicatives (Trotec, Thunder
   Laser). Choix des valeurs à afficher : les tiennes pour cette machine d'abord, sinon les indicatives, sinon une
   estimation depuis tes valeurs les plus proches. « Modifier ces valeurs » les enregistre comme les tiennes. */

import { translate } from "../i18n/i18n.js";
import {
  cleanCustomMaterial,
  customLaserSettings,
  customMaterial,
  loadCustomLibrary,
  newMaterialId,
  putCustomSetting,
  removeCustomMaterial,
  removeCustomSetting,
  saveCustomLibrary
} from "../laser/custom-materials.js";
import { LASER_CUT_LIMIT, laserSettings } from "../laser/laser-settings.js";
import { LASER_MATERIALS, laserMaterial } from "../laser/reference-sources.js";
import { byId, escapeHtml } from "../util/dom.js";
import { readLengthField, setLengthField, showLength } from "./lengths.js";
import { fillMillSelect } from "./materials-tab.js";

let library = null;
let editingMaterial = null;
let confirmDelete = false;

export function loadLaserMaterials() {
  library = loadCustomLibrary();
}

function store(messageId) {
  byId(messageId).textContent = saveCustomLibrary(library) ? "" : translate("lz.matSaveFailed");
}

/* Nom affiché d'une matière (la tienne, ou une indicative). */
export function laserMaterialName(id) {
  const own = customMaterial(library, id);
  if (own) return own.name;
  const m = laserMaterial(id);
  if (!m) return "";
  return m.mill ? translate("mill.mat." + m.mill) : translate("lz.mat." + id);
}

/* Matière de fraisage liée (pour la matière du projet partagée entre onglets). */
export function laserMaterialMill(id) {
  const own = customMaterial(library, id);
  if (own) return own.mill;
  const m = laserMaterial(id);
  return m ? m.mill : "";
}

/* Matière laser qui correspond à une matière de fraisage : la tienne d'abord. */
export function laserMaterialForMill(mill) {
  const own = library.materials.find(function (m) {
    return m.mill === mill;
  });
  if (own) return own.id;
  const m = LASER_MATERIALS.find(function (x) {
    return x.mill === mill;
  });
  return m ? m.id : "";
}

export function knownLaserMaterial(id) {
  return !!(customMaterial(library, id) || laserMaterial(id));
}

/* Menu des matières : les tiennes, puis les indicatives par source. */
export function fillLaserMaterialSelect(select, selected) {
  function options(list) {
    return list
      .map(function (m) {
        return '<option value="' + escapeHtml(m.id) + '">' + escapeHtml(laserMaterialName(m.id)) + "</option>";
      })
      .join("");
  }
  function group(labelKey, list) {
    return list.length
      ? '<optgroup label="' + escapeHtml(translate(labelKey)) + '">' + options(list) + "</optgroup>"
      : "";
  }
  const own = library.materials.slice().sort(function (a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
  select.innerHTML =
    group("lz.groupOwn", own) +
    group(
      "lz.groupTrotec",
      LASER_MATERIALS.filter((m) => m.source === "trotec")
    ) +
    group(
      "lz.groupThunder",
      LASER_MATERIALS.filter((m) => m.source === "thunder")
    ) +
    group(
      "lz.groupGweike",
      LASER_MATERIALS.filter((m) => m.source === "gweike")
    );
  select.value = knownLaserMaterial(selected) ? selected : LASER_MATERIALS[0].id;
}

/* Valeurs à afficher pour la machine et le choix en cours :
   { kind: "own" | "reference" | "estimate" | "tooThick" | "tooWeak" | "none", settings, minWatts } */
export function resolveLaserValues(machine, material, op, thickness) {
  if (op === "cut" && thickness > LASER_CUT_LIMIT) return { kind: "tooThick" };
  const own = customLaserSettings(library, machine, material, op, thickness);
  if (own && own.own) return { kind: "own", settings: own };
  const reference = laserSettings(machine, material, op, thickness);
  if (reference && reference.tooWeak)
    return own ? { kind: "estimate", settings: own } : { kind: "tooWeak", minWatts: reference.tooWeak };
  if (reference) return { kind: "reference", settings: reference };
  if (own) return { kind: "estimate", settings: own };
  return { kind: "none" };
}

/* ---- tes matières ---- */

function openMaterialForm(material) {
  editingMaterial = material;
  byId("lzMatName").value = material ? material.name : "";
  fillMillSelect(byId("lzMatMill"), material ? material.mill : "");
  byId("lzMatForm").hidden = false;
  byId("lzMatName").focus();
}

function closeMaterialForm() {
  byId("lzMatForm").hidden = true;
  editingMaterial = null;
}

/* ---- tes valeurs ---- */

let valuesTarget = null;

/* Formulaire de tes valeurs, pré-rempli avec celles affichées. target : { machine, material, op, thickness } */
export function openValuesForm(target, settings, speed) {
  valuesTarget = target;
  byId("lzValPower").value = settings ? String(settings.power) : "";
  byId("lzValSpeed").value = speed ? String(speed.value) : "";
  byId("lzValSpeedUnit").value = speed ? speed.unit : target.machine.trotec ? "percent" : "mmps";
  byId("lzValFrequency").value = settings && settings.frequency ? String(settings.frequency) : "";
  byId("lzValFrequency").placeholder = translate(target.op === "cut" ? "lz.unitHz" : "lz.unitPpi");
  byId("lzValPasses").value = settings ? String(settings.passes || 1) : "1";
  setLengthField(byId("lzValZ"), settings ? settings.zOffset : 0);
  byId("lzValFor").textContent = translate("lz.valuesFor", {
    m: target.machineLabel,
    o: translate(target.op === "cut" ? "nb.opCut" : target.op === "engrave" ? "nb.opEngrave" : "lz.opDark"),
    t:
      target.op === "cut"
        ? " · " + showLength(target.thickness, { digits: 2 }) + " " + translate("mill.unitLength")
        : ""
  });
  byId("lzValForm").hidden = false;
  byId("lzValPower").focus();
}

function closeValuesForm() {
  byId("lzValForm").hidden = true;
  valuesTarget = null;
}

function readNumber(id) {
  const v = Number(String(byId(id).value).replace(",", "."));
  return byId(id).value.trim() === "" || !isFinite(v) ? null : v;
}

/* Retour aux valeurs indicatives : tes valeurs pour cette machine, opération et épaisseur sont retirées. */
export function resetOwnValues(target) {
  removeCustomSetting(library, target.material, target.machine.id, target.op, target.thickness);
  store("lzMatMsg");
}

export function bindLaserMaterials(hooks) {
  byId("lzMatNew").addEventListener("click", function () {
    openMaterialForm(null);
  });
  byId("lzMatEdit").addEventListener("click", function () {
    openMaterialForm(customMaterial(library, hooks.material()));
  });
  byId("lzMatCancel").addEventListener("click", closeMaterialForm);
  byId("lzMatForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const material = cleanCustomMaterial({
      id: editingMaterial ? editingMaterial.id : newMaterialId(),
      name: byId("lzMatName").value,
      mill: byId("lzMatMill").value
    });
    if (!material) {
      byId("lzMatMsg").textContent = translate("lz.matNeedName");
      byId("lzMatName").focus();
      return;
    }
    const index = library.materials.findIndex(function (m) {
      return m.id === material.id;
    });
    if (index >= 0) library.materials[index] = material;
    else library.materials.push(material);
    store("lzMatMsg");
    closeMaterialForm();
    byId("lzMatMsg").textContent = translate("lz.matSaved");
    hooks.selectMaterial(material.id);
  });
  byId("lzMatDelete").addEventListener("click", function () {
    const id = hooks.material();
    if (!customMaterial(library, id)) return;
    // suppression en deux clics : la matière part avec toutes ses valeurs
    if (!confirmDelete) {
      confirmDelete = true;
      this.textContent = translate("nb.confirmDelete");
      return;
    }
    confirmDelete = false;
    this.textContent = translate("lz.matDelete");
    removeCustomMaterial(library, id);
    store("lzMatMsg");
    byId("lzMatMsg").textContent = translate("lz.matDeleted");
    hooks.selectMaterial(LASER_MATERIALS[0].id);
  });
  byId("lzValCancel").addEventListener("click", closeValuesForm);
  byId("lzValForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!valuesTarget) return;
    const t = valuesTarget,
      saved = putCustomSetting(library, {
        materialId: t.material,
        machineId: t.machine.id,
        machineName: t.machineLabel,
        machineWatts: t.machine.watts,
        machineKind: t.machine.kind,
        op: t.op,
        thickness: t.op === "cut" ? t.thickness : null,
        power: readNumber("lzValPower"),
        speed: readNumber("lzValSpeed"),
        speedUnit: byId("lzValSpeedUnit").value,
        frequency: readNumber("lzValFrequency"),
        passes: readNumber("lzValPasses"),
        zOffset: readLengthField(byId("lzValZ"))
      });
    if (!saved) {
      byId("lzValFor").textContent = translate("lz.valuesInvalid");
      return;
    }
    store("lzMatMsg");
    closeValuesForm();
    byId("lzMatMsg").textContent = translate("lz.valuesSaved");
    hooks.changed();
  });
}

/* Boutons qui dépendent de la matière choisie (Modifier et Supprimer : seulement pour tes matières). */
export function renderMaterialButtons(materialId) {
  const own = !!customMaterial(library, materialId);
  byId("lzMatEdit").hidden = byId("lzMatDelete").hidden = !own;
  if (!own) {
    confirmDelete = false;
    byId("lzMatDelete").textContent = translate("lz.matDelete");
  }
}
