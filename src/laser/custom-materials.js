/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Tes matières laser : leur nom (et la matière de fraisage qui leur correspond), puis tes valeurs éprouvées
   pour chaque machine, opération et épaisseur. Sans valeur pour la machine choisie, Nestor part de tes valeurs
   les plus proches : même machine à une autre épaisseur, sinon une autre machine CO2 (même énergie par mm). */

import { LASER_CUT_LIMIT, LASER_OPS, speedStep, TROTEC_FULL_SPEED } from "./laser-settings.js";
import { LASER_MATERIALS } from "./reference-sources.js";

const CUSTOM_KEY = "nestor.laser-matieres.v1";
const MAX_MATERIALS = 300;
const MAX_SETTINGS = 3000;
const NAME_LIMIT = 80;

function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function number(value, min, max) {
  return typeof value === "number" && isFinite(value) && value >= min && value <= max ? value : null;
}

function validId(value) {
  return typeof value === "string" && /^[\w-]{1,40}$/.test(value);
}

export function newMaterialId() {
  return newId("lm");
}

/* Matière : { id, name, mill } ; null sans nom. */
export function cleanCustomMaterial(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, NAME_LIMIT) : "";
  if (!name) return null;
  return {
    id: validId(raw.id) ? raw.id : newMaterialId(),
    name: name,
    mill: typeof raw.mill === "string" && /^[\w-]{0,40}$/.test(raw.mill) ? raw.mill : ""
  };
}

/* Valeurs pour une machine : la machine est recopiée (nom, puissance, Trotec) pour rester utilisable si elle
   est supprimée. Découpe : épaisseur obligatoire, 10 mm au plus. Null si la puissance ou la vitesse manque. */
export function cleanCustomSetting(raw) {
  if (!raw || typeof raw !== "object" || !validId(raw.materialId)) return null;
  const op = LASER_OPS.includes(raw.op) ? raw.op : "cut",
    thickness = op === "cut" ? number(raw.thickness, 0.01, LASER_CUT_LIMIT) : null,
    power = number(raw.power, 0.1, 100),
    speed = number(raw.speed, 0.001, 100000),
    watts = number(raw.machineWatts, 0.1, 20000);
  if ((op === "cut" && thickness == null) || power == null || speed == null || watts == null) return null;
  const speedUnit = raw.speedUnit === "mmps" ? "mmps" : "percent";
  if (speedUnit === "percent" && speed > 100) return null;
  return {
    id: validId(raw.id) ? raw.id : newId("ls"),
    materialId: raw.materialId,
    machineId: validId(raw.machineId) ? raw.machineId : "",
    machineName: typeof raw.machineName === "string" ? raw.machineName.trim().slice(0, 60) : "",
    machineWatts: watts,
    machineKind: raw.machineKind === "diode" || raw.machineKind === "fiber" ? raw.machineKind : "co2",
    op: op,
    thickness: thickness,
    power: power,
    speed: speed,
    speedUnit: speedUnit,
    frequency: number(raw.frequency, 1, 1000000),
    passes: Math.round(number(raw.passes, 1, 50) || 1),
    zOffset: number(raw.zOffset, -50, 50) || 0
  };
}

export function cleanCustomLibrary(saved) {
  const library = { materials: [], settings: [] },
    known = {};
  // tes valeurs peuvent aussi remplacer celles d'une matière indicative (chêne, contreplaqué bouleau…)
  LASER_MATERIALS.forEach(function (m) {
    known[m.id] = true;
  });
  if (!saved || typeof saved !== "object") return library;
  (Array.isArray(saved.materials) ? saved.materials : []).slice(0, MAX_MATERIALS).forEach(function (raw) {
    const m = cleanCustomMaterial(raw);
    if (!m || known[m.id]) return;
    if (!/^lm/.test(m.id)) m.id = newMaterialId();
    known[m.id] = true;
    library.materials.push(m);
  });
  (Array.isArray(saved.settings) ? saved.settings : []).slice(0, MAX_SETTINGS).forEach(function (raw) {
    const s = cleanCustomSetting(raw);
    if (s && known[s.materialId]) library.settings.push(s);
  });
  return library;
}

export function loadCustomLibrary() {
  try {
    return cleanCustomLibrary(JSON.parse(localStorage.getItem(CUSTOM_KEY) || "null"));
  } catch (e) {
    return cleanCustomLibrary(null);
  }
}

export function saveCustomLibrary(library) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(library));
    return true;
  } catch (e) {
    return false;
  }
}

export function customMaterial(library, id) {
  return (
    library.materials.find(function (m) {
      return m.id === id;
    }) || null
  );
}

/* Supprime une matière et toutes ses valeurs. */
export function removeCustomMaterial(library, id) {
  library.materials = library.materials.filter(function (m) {
    return m.id !== id;
  });
  library.settings = library.settings.filter(function (s) {
    return s.materialId !== id;
  });
}

/* Retire tes valeurs pour une machine, une opération et une épaisseur (retour aux valeurs indicatives). */
export function removeCustomSetting(library, materialId, machineId, op, thickness) {
  library.settings = library.settings.filter(function (s) {
    return !(
      s.materialId === materialId &&
      s.machineId === machineId &&
      s.op === op &&
      (op !== "cut" || Math.abs(s.thickness - thickness) < 0.05)
    );
  });
}

/* Valeurs enregistrées d'une matière, triées (machine, opération, épaisseur). */
export function materialSettings(library, materialId) {
  return library.settings
    .filter(function (s) {
      return s.materialId === materialId;
    })
    .sort(function (a, b) {
      return (
        a.machineName.localeCompare(b.machineName) ||
        LASER_OPS.indexOf(a.op) - LASER_OPS.indexOf(b.op) ||
        (a.thickness || 0) - (b.thickness || 0)
      );
    });
}

/* Ajoute ou remplace les valeurs d'une matière pour une machine, une opération et une épaisseur. */
export function putCustomSetting(library, raw) {
  const setting = cleanCustomSetting(raw);
  if (!setting) return null;
  library.settings = library.settings.filter(function (s) {
    return !(
      s.materialId === setting.materialId &&
      s.machineId === setting.machineId &&
      s.op === setting.op &&
      (setting.op !== "cut" || Math.abs(s.thickness - setting.thickness) < 0.05)
    );
  });
  library.settings.push(setting);
  return setting;
}

// vitesse en mm/s quelle que soit son unité (le % est ramené à la vitesse maximale de la Speedy 360)
function speedMm(setting) {
  return setting.speedUnit === "mmps" ? setting.speed : (setting.speed / 100) * TROTEC_FULL_SPEED;
}

function round(value, step) {
  return Number((Math.round(value / step) * step).toFixed(4));
}

/* Valeurs pour la machine choisie, à partir de tes valeurs :
   { power, speed (%), speedMm, frequency, zOffset, passes, own, thicknessFrom, fromMachine } ou null. */
export function customLaserSettings(library, machine, materialId, op, thickness) {
  if (!machine || !(machine.watts > 0)) return null;
  const cut = op === "cut";
  if (cut && !(thickness > 0 && thickness <= LASER_CUT_LIMIT)) return null;
  const rows = library.settings.filter(function (s) {
    return s.materialId === materialId && s.op === op;
  });
  const sameMachine = rows.filter(function (s) {
      return s.machineId === machine.id;
    }),
    // autre machine : seulement du même type de laser (le CO2 ne se compare pas au diode ou à la fibre)
    others = rows.filter(function (s) {
      return s.machineId !== machine.id && s.machineKind === machine.kind;
    });
  function nearestThickness(list) {
    if (!cut) return list[0];
    return list.reduce(function (best, s) {
      return Math.abs(s.thickness - thickness) < Math.abs(best.thickness - thickness) ? s : best;
    });
  }
  let row,
    fromMachine = null;
  if (sameMachine.length) row = nearestThickness(sameMachine);
  else if (others.length) {
    // la machine de puissance la plus proche, puis l'épaisseur la plus proche
    const closest = others.reduce(function (best, s) {
      return Math.abs(s.machineWatts - machine.watts) < Math.abs(best.machineWatts - machine.watts) ? s : best;
    });
    row = nearestThickness(
      others.filter(function (s) {
        return s.machineId === closest.machineId;
      })
    );
    fromMachine = row.machineName || row.machineWatts + " W";
  } else return null;
  let power = row.power,
    mm = speedMm(row);
  if (fromMachine) {
    // même énergie déposée par mm : en découpe la vitesse change, en gravure la puissance (bornée à 100 %)
    const energy = (row.machineWatts * row.power) / mm;
    if (cut) mm = (machine.watts * power) / energy;
    else {
      power = (energy * mm) / machine.watts;
      if (power > 100) {
        power = 100;
        mm = (machine.watts * 100) / energy;
      }
    }
  }
  const thicknessFrom = cut && Math.abs(row.thickness - thickness) > 0.05 ? row.thickness : null;
  if (thicknessFrom) mm = (mm * row.thickness) / thickness;
  const percent = (mm / TROTEC_FULL_SPEED) * 100;
  return {
    power: Math.min(100, round(power, 1)),
    speed: Math.max(0.01, round(percent, speedStep(percent))),
    speedMm: round(mm, 0.1),
    frequency: row.frequency,
    zOffset: row.zOffset,
    passes: row.passes,
    own: !fromMachine && !thicknessFrom,
    thicknessFrom: thicknessFrom,
    fromMachine: fromMachine,
    // valeurs gardées telles que tu les as saisies, dans ton unité, quand rien n'est recalculé
    savedSpeed: !fromMachine && !thicknessFrom ? { value: row.speed, unit: row.speedUnit } : null
  };
}
