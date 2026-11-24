/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Profil Nestor, côté appareil : lire tout ce qui est gardé dans ce navigateur (réglages, projets), écrire un
   profil relu, et le sauvegarder dans un dossier choisi par l'usager (3 fichiers tournants, toutes les 5 minutes). */

import { APP_VERSION } from "../version.js";
import { folderPermission, folderSupported, readFolderFile, savedFolder, writeFolderFile } from "./folder-store.js";
import {
  BACKUP_FILES,
  buildProfile,
  PROFILE_FILE,
  PROFILE_KEYS,
  readProfile,
  settingsToWrite
} from "./profile-data.js";
import { listProjects, newProjectId, readProject, storeProject } from "./projects-store.js";
import { snapshotSummary } from "./project-snapshot.js";

// date du dernier profil écrit ou chargé ici : un profil plus récent dans le dossier vient d'ailleurs
const SEEN_KEY = "nestor.profil-vu";

function getItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function setItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

/* Réglages gardés dans ce navigateur, par nom de profil. */
export function readSettings() {
  var out = {};
  Object.keys(PROFILE_KEYS).forEach(function (name) {
    var value = getItem(PROFILE_KEYS[name]);
    if (value != null) out[name] = value;
  });
  return out;
}

/* Profil de cet appareil, en texte. current : projet en cours pas encore enregistré, ou null. */
export async function profileText(current) {
  var list = await listProjects().catch(function () {
    return [];
  });
  var projects = [];
  for (var entry of list) {
    var snapshot = await readProject(entry.id);
    if (snapshot) projects.push({ entry: entry, snapshot: snapshot });
  }
  return JSON.stringify(buildProfile(readSettings(), projects, current, APP_VERSION, Date.now()));
}

/* Écrit un profil relu dans ce navigateur. mode : « add » ou « replace » (voir settingsToWrite). Les projets du
   profil s'ajoutent à ceux déjà là (jamais effacés) ; un projet déjà là (même nom, même date) n'est pas doublé.
   Rend le nombre de projets ajoutés. L'appli doit ensuite être rechargée pour tout relire. */
export async function applyProfile(profile, mode) {
  var write = settingsToWrite(readSettings(), profile.settings, mode);
  Object.keys(write).forEach(function (name) {
    setItem(PROFILE_KEYS[name], write[name]);
  });
  var existing = await listProjects().catch(function () {
    return [];
  });
  var known = new Set(
    existing.map(function (e) {
      return e.name + "|" + e.savedAt;
    })
  );
  var incoming = profile.projects.slice();
  if (profile.current) incoming.push(Object.assign({}, profile.current, { savedAt: profile.savedAt }));
  var added = 0;
  for (var p of incoming) {
    var savedAt = p.savedAt || profile.savedAt || Date.now();
    if (known.has(p.name + "|" + savedAt)) continue;
    var entry = Object.assign({ id: newProjectId(), name: p.name, savedAt: savedAt }, snapshotSummary(p.snapshot));
    await storeProject(entry, p.snapshot);
    known.add(p.name + "|" + savedAt);
    added++;
  }
  setItem(SEEN_KEY, String(profile.savedAt || Date.now()));
  return added;
}

/* — Sauvegardes dans un dossier choisi : 3 fichiers, toutes les 5 minutes —————————————————————————— */

const AUTO_KEY = "nestor.profil-auto";
// empreinte de la dernière sauvegarde écrite : rien n'est réécrit (ni décalé) tant que rien ne change
const LAST_KEY = "nestor.profil-empreinte";
const BACKUP_EVERY = 5 * 60 * 1000;

let backupTimer = null;
let backupListener = null;
let backupRunning = null;

/* Dossier des sauvegardes du profil, ou null. */
export function backupFolder() {
  return folderSupported() ? savedFolder("profile") : Promise.resolve(null);
}

/* Sauvegarde automatique : cochée par défaut dès qu'un dossier est choisi. */
export function autoBackupOn() {
  return getItem(AUTO_KEY) !== "off";
}

export function setAutoBackup(on, getCurrent) {
  setItem(AUTO_KEY, on ? "on" : "off");
  startAutoBackup(getCurrent);
}

// empreinte courte de ce qui serait écrit
function signature(text) {
  var h = 5381;
  for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return text.length + ":" + h;
}

// empreinte légère (réglages, liste des projets, projet en cours) : les projets ne sont relus que si besoin
async function cheapSignature(current) {
  var list = await listProjects().catch(function () {
    return [];
  });
  return signature(
    JSON.stringify(readSettings()) +
      JSON.stringify(
        list.map(function (e) {
          return [e.id, e.savedAt];
        })
      ) +
      (current ? JSON.stringify(current) : "")
  );
}

async function readOrNull(folder, name) {
  try {
    return await readFolderFile(folder, name);
  } catch (e) {
    return null;
  }
}

/* Écrit le profil en tête des 3 fichiers du dossier : l'ancien 2 devient le 3, l'ancien plus récent le 2. */
async function rotateAndWrite(folder, text) {
  var newest = await readOrNull(folder, BACKUP_FILES[0]),
    second = await readOrNull(folder, BACKUP_FILES[1]);
  if (second != null) await writeFolderFile(folder, BACKUP_FILES[2], second);
  if (newest != null) await writeFolderFile(folder, BACKUP_FILES[1], newest);
  await writeFolderFile(folder, BACKUP_FILES[0], text);
}

/* Sauvegarde du profil dans son dossier, si quelque chose a changé. Rend { state } : « written », « same »,
   « nofolder », « denied » (autorisation à redonner ; ask : la demander) ou « failed ». */
export function backupProfile(current, ask) {
  // une sauvegarde à la fois : une lente ne doit pas décaler les fichiers en même temps qu'une autre
  var run = (backupRunning || Promise.resolve()).then(function () {
    return backupNow(current, ask);
  });
  backupRunning = run.catch(function () {});
  return run;
}

async function backupNow(current, ask) {
  var folder = await backupFolder();
  if (!folder) return { state: "nofolder" };
  try {
    if ((await folderPermission(folder, ask)) !== "granted") return { state: "denied", folder: folder.name };
    var sig = await cheapSignature(current);
    if (sig === getItem(LAST_KEY) && (await readOrNull(folder, BACKUP_FILES[0])) != null)
      return { state: "same", folder: folder.name };
    var text = await profileText(current);
    await rotateAndWrite(folder, text);
    setItem(LAST_KEY, sig);
    var savedAt = JSON.parse(text).savedAt;
    setItem(SEEN_KEY, String(savedAt));
    return { state: "written", savedAt: savedAt, folder: folder.name };
  } catch (e) {
    return { state: "failed", folder: folder.name };
  }
}

/* Sauvegarde automatique (toutes les 5 minutes, et une fois tout de suite) si elle est cochée et qu'un dossier
   est choisi. L'autorisation n'est jamais demandée ici : sans elle, l'état « denied » est signalé. */
export function startAutoBackup(getCurrent) {
  stopAutoBackup();
  if (!autoBackupOn() || !folderSupported()) return;
  function tick() {
    backupProfile(getCurrent(), false).then(function (result) {
      if (backupListener && result.state !== "nofolder") backupListener(result);
    });
  }
  tick();
  backupTimer = setInterval(tick, BACKUP_EVERY);
}

function stopAutoBackup() {
  clearInterval(backupTimer);
  backupTimer = null;
}

/* Appelé après chaque sauvegarde automatique (pour afficher son état). */
export function onAutoBackup(listener) {
  backupListener = listener;
}

/* Profil plus récent que le dernier écrit ou chargé ici, trouvé dans le dossier des projets ou celui des
   sauvegardes : { profile, folder, handle } ou null. */
export async function profileInFolder() {
  if (!folderSupported()) return null;
  var seen = Number(getItem(SEEN_KEY)) || 0,
    best = null;
  for (var slot of ["profile", "projects"]) {
    var folder = await savedFolder(slot);
    if (!folder) continue;
    try {
      if ((await folderPermission(folder, false)) !== "granted") continue;
      var profile = readProfile(await readFolderFile(folder, PROFILE_FILE));
      if (profile.savedAt > seen && (!best || profile.savedAt > best.profile.savedAt))
        best = { profile: profile, folder: folder.name, handle: folder };
    } catch (e) {}
  }
  return best;
}
