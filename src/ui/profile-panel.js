/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* « Mon profil » dans les Réglages : enregistrer tout ce que l'usager a rangé dans Nestor en un fichier, le
   recharger (aperçu puis « Ajouter » ou « Tout remplacer »), et le tenir à jour dans le dossier choisi. */

import { saveFile } from "../export/export-files.js";
import { languageLocale, translate } from "../i18n/i18n.js";
import { folderPermission, folderSupported, savedFolder, writeFolderFile } from "../project/folder-store.js";
import { datedProfileName, PROFILE_FILE, profileSummary, readProfile } from "../project/profile-data.js";
import {
  applyProfile,
  onProfileSync,
  profileInFolder,
  profileSyncOn,
  profileText,
  setProfileSync,
  startProfileSync
} from "../project/profile-store.js";
import { byId } from "../util/dom.js";
import { keepUnsavedProject, unsavedProject } from "./projects-dialog.js";

// message à montrer après le rechargement qui suit un profil chargé
const LOADED_KEY = "nestor.profil-charge";

// profil relu en attente de « Charger » : { profile, name } ; mode « replace » armé (second clic)
let pending = null;
let replaceArmed = false;

function message(text) {
  byId("profMsg").textContent = text || "";
}

function formatDate(time) {
  return new Date(time).toLocaleString(languageLocale(), { dateStyle: "medium", timeStyle: "short" });
}

/* Enregistrer : dans le dossier choisi s'il y en a un (le même fichier que la mise à jour automatique), sinon
   un fichier téléchargé, daté. */
async function saveProfile() {
  message("");
  try {
    var text = await profileText(unsavedProject()),
      folder = folderSupported() ? await savedFolder() : null;
    if (folder && (await folderPermission(folder, true)) === "granted") {
      await writeFolderFile(folder, PROFILE_FILE, text);
      return message(translate("prof.savedFolder", { f: folder.name }));
    }
    var name = datedProfileName(Date.now());
    await saveFile(name, new Blob([text], { type: "application/json" }));
    message(translate("dl.done", { f: name }));
  } catch (err) {
    if (err && err.name === "AbortError") return;
    message(translate("prof.saveFailed"));
  }
}

function showPreview(profile, name) {
  var s = profileSummary(profile);
  pending = { profile: profile, name: name };
  replaceArmed = false;
  byId("profName").textContent = translate("prof.loadName", { f: name });
  byId("profSummary").textContent =
    translate("prof.summary", { p: s.projects, m: s.materials, n: s.notes, l: s.machines }) +
    (profile.savedAt ? " · " + translate("prof.when", { d: formatDate(profile.savedAt) }) : "");
  byId("profPreview").querySelector('[value="add"]').checked = true;
  byId("profApply").textContent = translate("prof.apply");
  byId("profApply").classList.remove("confirm");
  byId("profPreview").hidden = false;
  byId("profFound").hidden = true;
  message("");
  byId("profApply").focus();
}

function hidePreview() {
  pending = null;
  replaceArmed = false;
  byId("profPreview").hidden = true;
}

function loadFile(file) {
  return file
    .text()
    .then(function (text) {
      showPreview(readProfile(text), file.name);
    })
    .catch(function () {
      hidePreview();
      message(translate("prof.bad"));
    });
}

async function applyPending() {
  if (!pending) return;
  var mode = byId("profPreview").querySelector('[name="profMode"]:checked').value;
  // « Tout remplacer » : second clic
  if (mode === "replace" && !replaceArmed) {
    replaceArmed = true;
    byId("profApply").textContent = translate("prof.replaceConfirm");
    byId("profApply").classList.add("confirm");
    return;
  }
  try {
    await keepUnsavedProject();
    var added = await applyProfile(pending.profile, mode);
    try {
      sessionStorage.setItem(LOADED_KEY, String(added));
    } catch (e) {}
    // tout est relu au démarrage, réglage par réglage
    location.reload();
  } catch (e) {
    message(translate("prof.applyFailed"));
  }
}

/* Case « Garder mon profil à jour » : seulement avec un dossier choisi. */
async function renderSync() {
  var folder = folderSupported() ? await savedFolder() : null;
  byId("profSyncRow").hidden = !folder;
  if (!folder) {
    byId("profSyncMsg").textContent = "";
    return;
  }
  byId("profSyncLbl").textContent = translate("prof.sync", { f: folder.name });
  byId("profSync").checked = profileSyncOn();
  if (!profileSyncOn()) byId("profSyncMsg").textContent = "";
  var found = await profileInFolder();
  byId("profFound").hidden = !found || !!pending;
  if (found)
    byId("profFoundTxt").textContent = translate("prof.found", {
      f: found.folder,
      d: formatDate(found.profile.savedAt)
    });
}

function showSyncState(result) {
  if (!profileSyncOn()) return;
  var key = {
    written: "prof.syncDone",
    denied: "prof.syncDenied",
    failed: "prof.syncFailed"
  }[result.state];
  if (key) byId("profSyncMsg").textContent = translate(key, { d: result.savedAt ? formatDate(result.savedAt) : "" });
}

/* À l'ouverture des Réglages. */
export function refreshProfilePanel() {
  if (!pending) message(byId("profMsg").dataset.keep ? byId("profMsg").textContent : "");
  delete byId("profMsg").dataset.keep;
  return renderSync();
}

export function bindProfilePanel() {
  byId("profSave").addEventListener("click", saveProfile);
  byId("profLoad").addEventListener("click", function () {
    byId("profFile").click();
  });
  byId("profFile").addEventListener("change", function () {
    var file = this.files[0];
    this.value = "";
    if (file) loadFile(file);
  });
  byId("profCancel").addEventListener("click", function () {
    hidePreview();
    renderSync();
  });
  byId("profApply").addEventListener("click", applyPending);
  byId("profPreview").addEventListener("change", function () {
    replaceArmed = false;
    byId("profApply").textContent = translate("prof.apply");
    byId("profApply").classList.remove("confirm");
  });
  byId("profFoundBtn").addEventListener("click", async function () {
    var found = await profileInFolder();
    if (found) showPreview(found.profile, PROFILE_FILE);
  });
  byId("profSync").addEventListener("change", function () {
    setProfileSync(this.checked, unsavedProject);
    byId("profSyncMsg").textContent = "";
  });
  // « Voir ce profil » depuis Projets → Mon dossier : les Réglages s'ouvrent sur l'aperçu
  document.addEventListener("nestor:open-profile", async function () {
    var found = await profileInFolder();
    if (found) showPreview(found.profile, PROFILE_FILE);
  });
  onProfileSync(showSyncState);
  startProfileSync(unsavedProject);
}

/* Après un profil chargé (l'appli vient d'être rechargée) : rend le message à montrer, ou "". */
export function profileLoadedMessage() {
  var added = null;
  try {
    added = sessionStorage.getItem(LOADED_KEY);
    sessionStorage.removeItem(LOADED_KEY);
  } catch (e) {}
  if (added == null) return "";
  byId("profMsg").textContent = translate("prof.loaded", { n: Number(added) || 0 });
  byId("profMsg").dataset.keep = "1";
  return byId("profMsg").textContent;
}
