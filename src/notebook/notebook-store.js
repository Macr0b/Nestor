/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Carnet de réglages : les réglages éprouvés (fraisage, laser, autre), gardés sur l'appareil.
   Chaque fiche est vérifiée champ par champ à la lecture et à l'import : un fichier abîmé ou trafiqué
   ne peut ni planter l'appli ni glisser autre chose que du texte et des nombres. Longueurs en mm, avances en mm/min. */

const NOTEBOOK_KEY = "nestor.carnet.v1";
export const PROCESSES = ["mill", "laser", "other"];
export const STATUSES = ["ok", "review"];
export const LASER_OPERATIONS = ["cut", "engrave", "mark"];
// vitesse laser : en % de la machine (Trotec, Epilog…) ou en mm/s (LightBurn…)
export const SPEED_UNITS = ["percent", "mmps"];
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const TEXT_LIMITS = { machine: 120, material: 120, note: 2000, optics: 120, settings: 2000, tool: 40 };

function text(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function number(value) {
  return typeof value === "number" && isFinite(value) && value >= 0 ? value : null;
}

function oneOf(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

function isoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function newId() {
  return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function today() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* Fiche relue et vérifiée ; null si elle n'a même pas de procédé connu. */
export function cleanEntry(raw) {
  if (!raw || typeof raw !== "object" || !PROCESSES.includes(raw.process)) return null;
  const entry = {
    id: typeof raw.id === "string" && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : newId(),
    process: raw.process,
    date: isoDate(raw.date) || today(),
    status: oneOf(raw.status, STATUSES, "ok"),
    machine: text(raw.machine, TEXT_LIMITS.machine),
    material: text(raw.material, TEXT_LIMITS.material),
    thickness: number(raw.thickness),
    note: text(raw.note, TEXT_LIMITS.note)
  };
  const values = raw.values && typeof raw.values === "object" ? raw.values : {};
  if (entry.process === "mill")
    entry.values = {
      tool: text(values.tool, TEXT_LIMITS.tool),
      diameter: number(values.diameter),
      flutes: number(values.flutes),
      rpm: number(values.rpm),
      feed: number(values.feed),
      depth: number(values.depth),
      passes: number(values.passes),
      family: text(values.family, TEXT_LIMITS.tool),
      materialId: text(values.materialId, TEXT_LIMITS.tool)
    };
  else if (entry.process === "laser")
    entry.values = {
      operation: oneOf(values.operation, LASER_OPERATIONS, "cut"),
      optics: text(values.optics, TEXT_LIMITS.optics),
      speed: number(values.speed),
      speedUnit: oneOf(values.speedUnit, SPEED_UNITS, "percent"),
      power: number(values.power),
      frequency: number(values.frequency),
      passes: number(values.passes)
    };
  else entry.values = { settings: text(values.settings, TEXT_LIMITS.settings) };
  return entry;
}

/* Liste vérifiée : fiches illisibles écartées, identifiants en double renouvelés, plus récentes d'abord. */
export function cleanEntries(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const entries = [];
  for (const raw of list.slice(0, MAX_ENTRIES)) {
    const entry = cleanEntry(raw);
    if (!entry) continue;
    if (seen.has(entry.id)) entry.id = newId();
    seen.add(entry.id);
    entries.push(entry);
  }
  return sortEntries(entries);
}

export function sortEntries(entries) {
  return entries.sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
}

export function loadEntries() {
  try {
    return cleanEntries(JSON.parse(localStorage.getItem(NOTEBOOK_KEY) || "[]"));
  } catch (e) {
    return [];
  }
}

export function saveEntries(entries) {
  try {
    localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(entries));
    return true;
  } catch (e) {
    return false;
  }
}

/* Recherche sans accents ni majuscules dans la machine, la matière, la note et les réglages écrits. */
function plain(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function filterEntries(entries, query, process, labels, machine) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  return entries.filter(function (entry) {
    if (process && entry.process !== process) return false;
    // machine choisie : seulement ses fiches (les réglages d'un laser 60 W ne valent pas pour un 120 W)
    if (machine && entry.machine !== machine) return false;
    if (!words.length) return true;
    const haystack = plain(
      [entry.machine, entry.material, entry.note, entry.values.optics, entry.values.settings]
        .concat(labels ? labels(entry) : [])
        .join(" ")
    );
    return words.every(function (word) {
      return haystack.includes(word);
    });
  });
}

/* Machines nommées dans les fiches, sans doublon, dans l'ordre alphabétique. */
export function entryMachines(entries) {
  const names = {};
  entries.forEach(function (entry) {
    if (entry.machine) names[entry.machine] = true;
  });
  return Object.keys(names).sort(function (a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

/* Fichier de sauvegarde du carnet (JSON lisible). */
export function exportNotebook(entries) {
  return JSON.stringify({ app: "Nestor", kind: "carnet", version: 1, entries: entries }, null, 2);
}

/* Lecture d'un fichier de sauvegarde : fiches ajoutées à celles déjà là (une fiche de même identifiant est remplacée).
   Retour : { entries, added } ; lève une erreur si le fichier n'est pas un carnet Nestor. */
export function importNotebook(existing, fileText) {
  if (typeof fileText !== "string" || fileText.length > MAX_IMPORT_BYTES) throw new Error("trop gros");
  const data = JSON.parse(fileText);
  if (!data || data.app !== "Nestor" || data.kind !== "carnet") throw new Error("pas un carnet Nestor");
  const incoming = cleanEntries(data.entries);
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return { entries: sortEntries(Array.from(byId.values()).slice(0, MAX_ENTRIES)), added: incoming.length };
}
