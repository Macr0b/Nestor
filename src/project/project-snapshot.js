/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Projet enregistré : tout ce qu'il faut pour le rouvrir à l'identique (fichiers importés, pièces et réglages
   de chaque pièce, panneaux, options d'export, matière, réglages de fraisage, de laser et de coût).
   Écrit en JSON (les fichiers en base64) ; relu champ par champ : un fichier abîmé ou trafiqué ne peut ni
   planter l'appli ni glisser autre chose que du texte et des nombres. */

import { cleanKits, migrateSingleKit } from "./kit-records.js";

const PROJECT_FORMAT = { app: "Nestor", kind: "projet", version: 1 };
export const MAX_PROJECT_BYTES = 80 * 1024 * 1024;
const MAX_FILES = 50;
const MAX_TYPES = 5000;
const MAX_PATHS = 50000;
const MAX_POINTS = 4000000;
const MAX_PANELS = 50;
const TEXT = 200;
const EXAMPLE_KEYS = ["ex.facade", "ex.angle", "ex.disc", "ex.tab"];
const ORIGINS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

/* ---- base64 (fichiers importés) ---- */

export function bytesToBase64(bytes) {
  var parts = [];
  for (var i = 0; i < bytes.length; i += 0x8000)
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
  return btoa(parts.join(""));
}

export function base64ToBytes(text) {
  var binary = atob(text),
    out = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/* ---- petites vérifications ---- */

function str(value, limit) {
  return typeof value === "string" ? value.slice(0, limit || TEXT) : "";
}

function num(value, fallback, min, max) {
  return typeof value === "number" &&
    isFinite(value) &&
    value >= (min == null ? -Infinity : min) &&
    value <= (max == null ? Infinity : max)
    ? value
    : fallback;
}

function list(value, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// objet de réglages d'un autre onglet : seulement des textes, nombres, booléens et un niveau d'objets simples,
// vérifié ensuite par le module de l'onglet
function settingsObject(value, depth) {
  var source = plainObject(value);
  if (!source) return null;
  var out = {};
  Object.keys(source)
    .slice(0, 100)
    .forEach(function (key) {
      if (!/^[\w.-]{1,40}$/.test(key)) return;
      var v = source[key];
      if (typeof v === "string") out[key] = v.slice(0, TEXT);
      else if (typeof v === "boolean" || v === null) out[key] = v;
      else if (typeof v === "number" && isFinite(v)) out[key] = v;
      else if (!depth && plainObject(v)) out[key] = settingsObject(v, 1);
      // petite liste de nombres ou de textes (taille du dessin d'un fichier importé, par exemple)
      else if (
        Array.isArray(v) &&
        v.length <= 100 &&
        v.every(function (x) {
          return (typeof x === "number" && isFinite(x)) || typeof x === "string";
        })
      )
        out[key] = v.map(function (x) {
          return typeof x === "string" ? x.slice(0, TEXT) : x;
        });
    });
  return out;
}

/* ---- pièces ---- */

function cleanPoint(p) {
  return Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number" && isFinite(p[0]) && isFinite(p[1])
    ? [p[0], p[1]]
    : null;
}

// « Remplir » : ligne de panneau visée et façon (le dernier panneau de la ligne, tous, ou un nouveau) ;
// les projets de la 1.9.6 gardaient un numéro de panneau du plan ou "new" : la première ligne, le dernier ou un nouveau
function cleanFill(fill) {
  if (fill === "new") return { row: 0, how: "new" };
  if (Number.isInteger(fill) && fill >= 1) return { row: 0, how: "last" };
  var f = plainObject(fill);
  if (!f || !Number.isInteger(f.row) || f.row < 0 || f.row > 999 || !["last", "all", "new"].includes(f.how))
    return null;
  return { row: f.row, how: f.how };
}

function cleanType(raw, budget) {
  var t = plainObject(raw);
  if (!t) return null;
  var paths = [];
  list(t.paths, MAX_PATHS).forEach(function (p) {
    if (!plainObject(p) || budget.points <= 0) return;
    var pts = list(p.pts, budget.points).map(cleanPoint).filter(Boolean);
    budget.points -= pts.length;
    if (pts.length < 2) return;
    paths.push({
      pts: pts,
      closed: p.closed === true,
      layer: str(p.layer),
      color: /^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : ""
    });
  });
  if (!paths.length) return null;
  var type = {
    name: str(t.name),
    layer: str(t.layer),
    ord: num(t.ord, 0, 0),
    qty: Math.floor(num(t.qty, 1, 0, 100000)),
    rot: t.rot === "free" || t.rot === "free1" ? t.rot : t.rot === true,
    w: num(t.w, 0, 0),
    h: num(t.h, 0, 0),
    paths: paths
  };
  if (typeof t.fid === "number" && isFinite(t.fid)) type.fid = Math.floor(t.fid);
  if (Number.isInteger(t.uid) && t.uid > 0) type.uid = t.uid;
  var fill = cleanFill(t.fill);
  if (fill) type.fill = fill;
  if (t.copy === true) type.copy = true;
  if (t.manual === true) type.manual = true;
  if (t.on === false) type.on = false;
  if ([1, 2, 3].includes(t.turn)) type.turn = t.turn;
  // kit : identifiant « k1 »… (true : projet de la 1.9.9, converti par cleanSnapshot)
  if (t.kit === true || (typeof t.kit === "string" && /^k\d{1,4}$/.test(t.kit))) type.kit = t.kit;
  if (typeof t.scale === "number" || (typeof t.scale === "string" && t.scale.length <= 20)) type.scale = t.scale;
  if (EXAMPLE_KEYS.includes(t.nameKey)) type.nameKey = t.nameKey;
  return type;
}

// sens des premières coupes à la scie (vide : au mieux)
const SAW_FIRST = ["along", "across"];

const ORIGIN = /^[tmb][lcr]$/;

// pièce d'un panneau figé : position et orientation telles que posées ; null si quelque chose cloche
function cleanLockedPart(raw) {
  var p = plainObject(raw);
  if (!p || !(Number.isInteger(p.uid) && p.uid > 0)) return null;
  var out = { uid: p.uid };
  for (var key of ["x", "y", "w", "h", "dx", "dy"]) {
    out[key] = num(p[key], NaN);
    if (Number.isNaN(out[key])) return null;
  }
  if (p.a != null) {
    out.a = num(p.a, NaN, 0, 360);
    out.mx = num(p.mx, NaN);
    out.my = num(p.my, NaN);
    if ([out.a, out.mx, out.my].some(Number.isNaN)) return null;
  } else if (p.k != null) {
    if (![0, 1, 2, 3].includes(p.k)) return null;
    out.k = p.k;
  }
  if (p.turned === true) out.turned = true;
  var raw2 = plainObject(p.raw);
  if (raw2) {
    out.raw = {};
    for (var rk of ["x", "y", "w", "h", "Ln", "Wn"]) {
      out.raw[rk] = num(raw2[rk], NaN);
      if (Number.isNaN(out.raw[rk])) return null;
    }
  }
  var f = plainObject(p.f);
  if (f) {
    if (!ORIGIN.test(f.o)) return null;
    out.f = { tr: f.tr === true, fx: f.fx === true, fy: f.fy === true, o: f.o, geo: f.geo === true };
  }
  return out;
}

// panneau figé (cadenas) ; null s'il est abîmé, pour ne jamais garder une partie seulement de ses pièces
function cleanLock(raw, panelCount) {
  var l = plainObject(raw);
  if (!l || !Number.isInteger(l.pi) || l.pi < 0 || l.pi >= panelCount || !ORIGIN.test(l.o)) return null;
  var parts = list(l.parts, MAX_TYPES).map(cleanLockedPart);
  if (!parts.length || parts.includes(null)) return null;
  var L = num(l.L, 0, 0),
    W = num(l.W, 0, 0);
  if (!(L > 0 && W > 0)) return null;
  return { pi: l.pi, L: L, W: W, o: l.o, parts: parts };
}

function cleanPanel(raw) {
  var p = plainObject(raw);
  if (!p) return null;
  var panel = {
    L: num(p.L, 600, 0),
    W: num(p.W, 400, 0),
    qty: p.qty === "" || p.qty == null ? "" : Math.floor(num(p.qty, 0, 0, 100000))
  };
  if (ORIGINS.includes(p.origin)) panel.origin = p.origin;
  if (p.fromMaterial === true) panel.fromMaterial = true;
  if (typeof p.name === "string" && p.name) panel.name = str(p.name, 60);
  return panel;
}

/* Projet relu et vérifié. Lève une erreur si ce n'est pas un projet Nestor. */
export function cleanSnapshot(raw) {
  var s = plainObject(raw);
  if (!s || s.app !== PROJECT_FORMAT.app || s.kind !== PROJECT_FORMAT.kind) throw new Error("pas un projet Nestor");
  var budget = { points: MAX_POINTS },
    sheet = plainObject(s.sheet) || {},
    exportOptions = plainObject(s.exportOptions) || {};
  var panels = list(sheet.panels, MAX_PANELS).map(cleanPanel).filter(Boolean);
  var files = list(s.files, MAX_FILES)
    .map(function (f) {
      f = plainObject(f);
      if (!f || typeof f.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.data)) return null;
      return { id: Math.floor(num(f.id, 0, 0)), name: str(f.name), data: f.data, info: settingsObject(f.info) };
    })
    .filter(Boolean);
  return withKits(
    {
      app: PROJECT_FORMAT.app,
      kind: PROJECT_FORMAT.kind,
      version: PROJECT_FORMAT.version,
      name: str(s.name),
      example: s.example === true,
      source: str(s.source, 2000),
      info: settingsObject(s.info),
      files: files,
      sheet: {
        panels: panels.length ? panels : [{ L: 600, W: 400, qty: "" }],
        gap: num(sheet.gap, 2, 0, 1000),
        margin: num(sheet.margin, 5, 0, 1000),
        mode: sheet.mode === "rect" ? "rect" : "nest"
      },
      types: list(s.types, MAX_TYPES)
        .map(function (t) {
          return cleanType(t, budget);
        })
        .filter(Boolean),
      locks: list(s.locks, MAX_PANELS * 20)
        .map(function (l) {
          return cleanLock(l, panels.length || 1);
        })
        .filter(Boolean),
      rotAll: ["fix", "quarter", "free", "free1"].includes(s.rotAll) ? s.rotAll : "quarter",
      kits: cleanKits(s.kits, cleanFill),
      sort: ["file", "name", "layer", "src"].includes(s.sort) ? s.sort : "file",
      exportOptions: {
        includeBoard: exportOptions.includeBoard === true,
        offcutMode:
          exportOptions.offcutMode === "simple" || exportOptions.offcutMode === "detail"
            ? exportOptions.offcutMode
            : "",
        partNumbers: exportOptions.partNumbers === true,
        sawOrder: exportOptions.sawOrder === true,
        sawFirst: SAW_FIRST.includes(exportOptions.sawFirst) ? exportOptions.sawFirst : "",
        sawKerf: exportOptions.sawKerf > 0 && exportOptions.sawKerf <= 50 ? exportOptions.sawKerf : ""
      },
      material: typeof s.material === "string" && /^[\w-]{0,40}$/.test(s.material) ? s.material : "",
      milling: settingsObject(s.milling),
      laser: settingsObject(s.laser),
      cost: settingsObject(s.cost)
    },
    cleanFill(s.kitFill)
  );
}

/* Kits d'un projet relu : un projet de la 1.9.9 (case « Kit » et kitFill) devient un kit « k1 » ;
   une pièce qui renvoie à un kit absent redevient une pièce seule. */
function withKits(project, legacyFill) {
  project.kitFill = legacyFill;
  migrateSingleKit(project, "");
  delete project.kitFill;
  var ids = project.kits.map(function (k) {
    return k.id;
  });
  project.types.forEach(function (t) {
    if (t.kit && !ids.includes(t.kit)) delete t.kit;
  });
  return project;
}

/* Photo du projet en cours. project : l'état (pièces, panneaux…) ; extras : réglages des autres onglets. */
export function takeSnapshot(project, extras) {
  return cleanSnapshot({
    app: PROJECT_FORMAT.app,
    kind: PROJECT_FORMAT.kind,
    version: PROJECT_FORMAT.version,
    name: project.name,
    example: project.example,
    source: project.source,
    info: project.info,
    files: (project.files || []).map(function (f) {
      return {
        id: f.id,
        name: f.name,
        data: bytesToBase64(new Uint8Array(f.data)),
        info: f.info
      };
    }),
    sheet: project.sheet,
    types: project.types,
    locks: project.locks,
    rotAll: project.rotAll,
    kits: project.kits,
    sort: project.sort,
    exportOptions: extras.exportOptions,
    material: extras.material,
    milling: extras.milling,
    laser: extras.laser,
    cost: extras.cost
  });
}

/* Résumé affiché dans la liste des projets. */
export function snapshotSummary(snapshot) {
  return {
    parts: snapshot.types.reduce(function (a, t) {
      return a + (t.on === false ? 0 : t.qty);
    }, 0),
    panels: snapshot.sheet.panels.length
  };
}

/* Fichier de projet à partager (JSON). */
export function exportProject(snapshot) {
  return JSON.stringify(snapshot);
}

export function importProject(fileText) {
  if (typeof fileText !== "string" || fileText.length > MAX_PROJECT_BYTES) throw new Error("trop gros");
  return cleanSnapshot(JSON.parse(fileText));
}
