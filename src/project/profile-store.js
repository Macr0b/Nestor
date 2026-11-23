/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Profil Nestor, côté appareil : lire tout ce qui est gardé dans ce navigateur (réglages, projets), écrire un
   profil relu, et le tenir à jour dans le dossier choisi (Mon dossier) si l'usager le veut. */

import { APP_VERSION } from "../version.js";
import { folderPermission, folderSupported, readFolderFile, savedFolder, writeFolderFile } from "./folder-store.js";
import { buildProfile, PROFILE_FILE, PROFILE_KEYS, readProfile, settingsToWrite } from "./profile-data.js";
import { listProjects, newProjectId, readProject, storeProject } from "./projects-store.js";
import { snapshotSummary } from "./project-snapshot.js";

const SYNC_KEY = "nestor.profil-sync";
// date du dernier profil écrit ou chargé ici : un profil plus récent dans le dossier vient d'ailleurs
const SEEN_KEY = "nestor.profil-vu";
const SYNC_EVERY = 10000;

let syncTimer = null;
let lastSignature = "";
let syncListener = null;

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

/* — Tenu à jour dans le dossier choisi —————————————————————————————————————————————————————————— */

export function profileSyncOn() {
  return getItem(SYNC_KEY) === "on";
}

export function setProfileSync(on, getCurrent) {
  setItem(SYNC_KEY, on ? "on" : "off");
  lastSignature = "";
  if (on) startProfileSync(getCurrent);
  else stopProfileSync();
}

// empreinte courte de ce qui serait écrit : on n'écrit que si quelque chose a changé
function signature(text) {
  var h = 5381;
  for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return text.length + ":" + h;
}

/* Écrit le profil dans le dossier choisi s'il a changé. Rend { state } : « written », « same », « nofolder »,
   « denied » (autorisation à redonner) ou « failed ». */
export async function syncProfile(current) {
  if (!folderSupported()) return { state: "nofolder" };
  var folder = await savedFolder();
  if (!folder) return { state: "nofolder" };
  try {
    if ((await folderPermission(folder, false)) !== "granted") return { state: "denied" };
    // empreinte légère (réglages, liste des projets, projet en cours) : les projets ne sont relus que si besoin
    var list = await listProjects().catch(function () {
      return [];
    });
    var sig = signature(
      JSON.stringify(readSettings()) +
        JSON.stringify(
          list.map(function (e) {
            return [e.id, e.savedAt];
          })
        ) +
        (current ? JSON.stringify(current) : "")
    );
    if (sig === lastSignature) return { state: "same" };
    var text = await profileText(current);
    await writeFolderFile(folder, PROFILE_FILE, text);
    lastSignature = sig;
    var savedAt = JSON.parse(text).savedAt;
    setItem(SEEN_KEY, String(savedAt));
    return { state: "written", savedAt: savedAt, folder: folder.name };
  } catch (e) {
    return { state: "failed" };
  }
}

export function startProfileSync(getCurrent) {
  stopProfileSync();
  if (!profileSyncOn()) return;
  // un passage à la fois : un passage lent ne doit pas réécrire un profil plus ancien par-dessus un plus récent
  var running = false;
  function tick() {
    if (running) return;
    running = true;
    syncProfile(getCurrent())
      .then(function (result) {
        if (syncListener) syncListener(result);
      })
      .finally(function () {
        running = false;
      });
  }
  tick();
  syncTimer = setInterval(tick, SYNC_EVERY);
}

export function stopProfileSync() {
  clearInterval(syncTimer);
  syncTimer = null;
}

/* Appelé après chaque passage de la mise à jour automatique (pour afficher son état). */
export function onProfileSync(listener) {
  syncListener = listener;
}

/* Profil trouvé dans le dossier choisi, plus récent que le dernier écrit ou chargé ici : { profile, folder }
   ou null. */
export async function profileInFolder() {
  if (!folderSupported()) return null;
  var folder = await savedFolder();
  if (!folder) return null;
  try {
    if ((await folderPermission(folder, false)) !== "granted") return null;
    var profile = readProfile(await readFolderFile(folder, PROFILE_FILE));
    var seen = Number(getItem(SEEN_KEY)) || 0;
    return profile.savedAt > seen ? { profile: profile, folder: folder.name } : null;
  } catch (e) {
    return null;
  }
}
