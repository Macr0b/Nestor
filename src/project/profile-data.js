/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Profil Nestor : tout ce que l'usager a rangé dans l'appli, en un seul fichier (.nestorprofil) pour passer d'un
   ordinateur à l'autre. Ici, sans lecture ni écriture : construire le profil, le relire en le vérifiant, le
   résumer, et mêler ses réglages à ceux déjà là. Chaque réglage est de nouveau vérifié champ par champ quand
   l'appli le relit au démarrage ; les projets sont vérifiés comme un projet importé. */

import { cleanSnapshot, MAX_PROJECT_BYTES } from "./project-snapshot.js";

export const PROFILE_EXT = ".nestorprofil";
// nom du fichier tenu à jour dans le dossier choisi
export const PROFILE_FILE = "Profil Nestor" + PROFILE_EXT;
// au plus : 300 projets, 400 Mo en tout (des projets gardent leurs fichiers importés)
const MAX_PROJECTS = 300;
const MAX_PROFILE_BYTES = 400 * 1024 * 1024;
const MAX_SETTING_BYTES = 8 * 1024 * 1024;

/* Réglages gardés dans le navigateur : nom dans le profil → clé du navigateur. */
export const PROFILE_KEYS = {
  preferences: "plancoupe.reglages.v1",
  language: "plancoupe.lang",
  theme: "nestor.theme",
  units: "nestor.unites",
  stats: "nestor.stats",
  folded: "nestor.folded",
  library: "nestor.matieres.v1",
  projectMaterial: "nestor.matiere-projet",
  notebook: "nestor.carnet.v1",
  laser: "nestor.laser.v1",
  laserMaterials: "nestor.laser-matieres.v1",
  milling: "nestor.fraisage.v1",
  cost: "nestor.cout.v1"
};

// réglages écrits en texte simple (les autres sont du JSON)
const PLAIN = {
  language: /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/,
  theme: /^(auto|light|dark)$/,
  stats: /^off$/,
  projectMaterial: /^[\w-]{0,40}$/
};

// données de l'usager, mêlées à celles déjà là (« Ajouter ») ; les autres réglages restent ceux de l'appareil
const MERGED = ["library", "notebook", "laser", "laserMaterials"];

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// réglage relu : texte court et sûr, ou JSON valable ; sinon écarté (undefined)
function cleanSetting(name, value) {
  if (typeof value !== "string" || value.length > MAX_SETTING_BYTES) return undefined;
  if (PLAIN[name]) return PLAIN[name].test(value) ? value : undefined;
  try {
    JSON.parse(value);
    return value;
  } catch (e) {
    return undefined;
  }
}

/* Profil à enregistrer. settings : { nom: texte } ; projects : [{ entry, snapshot }] ; current : projet en cours
   (pas encore enregistré) ou null. */
export function buildProfile(settings, projects, current, version, savedAt) {
  var kept = {};
  Object.keys(PROFILE_KEYS).forEach(function (name) {
    var value = cleanSetting(name, settings[name]);
    if (value !== undefined) kept[name] = value;
  });
  return {
    app: "Nestor",
    kind: "profil",
    version: 1,
    appVersion: String(version || ""),
    savedAt: savedAt,
    settings: kept,
    projects: projects.slice(0, MAX_PROJECTS).map(function (p) {
      return { name: p.entry.name, savedAt: p.entry.savedAt, snapshot: p.snapshot };
    }),
    current: current ? { name: current.name, savedAt: savedAt, snapshot: current } : null
  };
}

/* Profil relu et vérifié. Lève une erreur si ce n'est pas un profil Nestor. Les projets abîmés sont écartés. */
export function readProfile(text) {
  if (typeof text !== "string" || text.length > MAX_PROFILE_BYTES) throw new Error("trop gros");
  var raw = plainObject(JSON.parse(text));
  if (!raw || raw.app !== "Nestor" || raw.kind !== "profil" || raw.version !== 1)
    throw new Error("pas un profil Nestor");
  var settings = {},
    given = plainObject(raw.settings) || {};
  Object.keys(PROFILE_KEYS).forEach(function (name) {
    var value = cleanSetting(name, given[name]);
    if (value !== undefined) settings[name] = value;
  });
  return {
    savedAt: typeof raw.savedAt === "number" && isFinite(raw.savedAt) ? raw.savedAt : 0,
    appVersion: typeof raw.appVersion === "string" ? raw.appVersion.slice(0, 20) : "",
    settings: settings,
    projects: (Array.isArray(raw.projects) ? raw.projects : [])
      .slice(0, MAX_PROJECTS)
      .map(cleanProject)
      .filter(Boolean),
    current: cleanProject(raw.current)
  };
}

function cleanProject(raw) {
  raw = plainObject(raw);
  if (!raw) return null;
  try {
    if (JSON.stringify(raw.snapshot).length > MAX_PROJECT_BYTES) return null;
    var snapshot = cleanSnapshot(raw.snapshot);
    return {
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 200) : snapshot.name,
      savedAt: typeof raw.savedAt === "number" && isFinite(raw.savedAt) ? raw.savedAt : 0,
      snapshot: snapshot
    };
  } catch (e) {
    return null;
  }
}

function parsed(text, fallback) {
  try {
    var value = JSON.parse(text);
    return value == null ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

function count(list) {
  return Array.isArray(list) ? list.length : 0;
}

/* Ce que contient un profil relu : nombres de projets, matières, fiches du carnet, machines et matières laser. */
export function profileSummary(profile) {
  var s = profile.settings,
    laser = plainObject(parsed(s.laser, null)) || {},
    laserMaterials = plainObject(parsed(s.laserMaterials, null)) || {};
  return {
    projects: profile.projects.length + (profile.current ? 1 : 0),
    materials: count(parsed(s.library, [])),
    notes: count(parsed(s.notebook, [])),
    machines: count(laser.machines),
    laserMaterials: count(laserMaterials.materials)
  };
}

// listes mêlées par identifiant : celle du profil remplace celle de même identifiant
function mergeLists(mine, theirs) {
  var byId = new Map();
  (Array.isArray(mine) ? mine : []).concat(Array.isArray(theirs) ? theirs : []).forEach(function (item, i) {
    var key = item && typeof item.id === "string" ? item.id : "#" + i;
    byId.set(key, item);
  });
  return Array.from(byId.values());
}

/* Réglages à écrire dans le navigateur. mode « replace » : ceux du profil (les autres restent) ; mode « add » :
   matières, carnet, machines et matières laser mêlés, le reste des réglages de l'appareil gardé. */
export function settingsToWrite(mine, theirs, mode) {
  if (mode === "replace") return Object.assign({}, theirs);
  var out = {};
  MERGED.forEach(function (name) {
    if (theirs[name] === undefined) return;
    if (mine[name] == null) return (out[name] = theirs[name]);
    var a = parsed(mine[name], null),
      b = parsed(theirs[name], null);
    if (name === "library" || name === "notebook") out[name] = JSON.stringify(mergeLists(a, b));
    else if (name === "laser") {
      a = plainObject(a) || {};
      out[name] = JSON.stringify(
        Object.assign({}, a, { machines: mergeLists(a.machines, (plainObject(b) || {}).machines) })
      );
    } else {
      a = plainObject(a) || {};
      b = plainObject(b) || {};
      out[name] = JSON.stringify({
        materials: mergeLists(a.materials, b.materials),
        settings: mergeLists(a.settings, b.settings)
      });
    }
  });
  return out;
}

/* Petit nom de fichier daté pour « Enregistrer mon profil » sans dossier : « Profil Nestor 2026-11-23.nestorprofil ». */
export function datedProfileName(date) {
  var d = new Date(date),
    pad = function (n) {
      return String(n).padStart(2, "0");
    };
  return "Profil Nestor " + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + PROFILE_EXT;
}
