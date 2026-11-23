/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Onglet Laser mémorisé sur l'appareil : tes machines (plusieurs puissances possibles), la machine active,
   la matière, l'opération et l'épaisseur. Tout est vérifié champ par champ à la lecture. */

import { LASER_OPS, MACHINE_KINDS } from "./laser-settings.js";
import { LASER_MATERIALS } from "./reference-sources.js";

const LASER_KEY = "nestor.laser.v1";
const MAX_MACHINES = 30;
const NAME_LIMIT = 60;
// puissance plausible d'un laser d'atelier, en watts
const MAX_WATTS = 20000;

export const DEFAULT_LASER = { machines: [], activeId: "", material: "castAcrylic", op: "cut", thickness: 3 };

export function newMachineId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* Machine vérifiée ; null si elle n'a pas de puissance utilisable. */
export function cleanMachine(raw) {
  if (!raw || typeof raw !== "object") return null;
  const watts = typeof raw.watts === "number" && isFinite(raw.watts) ? raw.watts : NaN;
  if (!(watts > 0 && watts <= MAX_WATTS)) return null;
  return {
    id: typeof raw.id === "string" && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : newMachineId(),
    name: typeof raw.name === "string" ? raw.name.trim().slice(0, NAME_LIMIT) : "",
    kind: MACHINE_KINDS.includes(raw.kind) ? raw.kind : "co2",
    watts: Math.round(watts * 10) / 10,
    trotec: raw.trotec === true
  };
}

export function cleanLaserInput(saved) {
  const input = Object.assign({}, DEFAULT_LASER, { machines: [] });
  if (!saved || typeof saved !== "object") return input;
  const seen = {};
  (Array.isArray(saved.machines) ? saved.machines : []).slice(0, MAX_MACHINES).forEach(function (raw) {
    const machine = cleanMachine(raw);
    if (!machine) return;
    if (seen[machine.id]) machine.id = newMachineId();
    seen[machine.id] = true;
    input.machines.push(machine);
  });
  input.activeId = seen[saved.activeId] ? saved.activeId : input.machines.length ? input.machines[0].id : "";
  // matière indicative connue, ou une de tes matières (identifiant « lm… »)
  if (
    LASER_MATERIALS.some(function (m) {
      return m.id === saved.material;
    }) ||
    (typeof saved.material === "string" && /^lm[\w-]{1,38}$/.test(saved.material))
  )
    input.material = saved.material;
  if (LASER_OPS.includes(saved.op)) input.op = saved.op;
  if (
    typeof saved.thickness === "number" &&
    isFinite(saved.thickness) &&
    saved.thickness > 0 &&
    saved.thickness <= 1000
  )
    input.thickness = saved.thickness;
  return input;
}

export function activeMachine(input) {
  return (
    input.machines.find(function (m) {
      return m.id === input.activeId;
    }) || null
  );
}

export function loadLaserInput() {
  try {
    return cleanLaserInput(JSON.parse(localStorage.getItem(LASER_KEY) || "null"));
  } catch (e) {
    return cleanLaserInput(null);
  }
}

export function saveLaserInput(input) {
  try {
    localStorage.setItem(LASER_KEY, JSON.stringify(input));
    return true;
  } catch (e) {
    return false;
  }
}
