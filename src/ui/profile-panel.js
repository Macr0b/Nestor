/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fenêtre « Mon profil » (bouton Profil en haut) : enregistrer tout ce que l'usager a rangé dans Nestor, dans un dossier qu'il
   choisit et que Nestor retient (3 fichiers tournants, sauvegarde automatique toutes les 5 minutes), ou en
   téléchargement là où le navigateur ne sait pas retenir un dossier ; le recharger (aperçu puis « Ajouter » ou
   « Tout remplacer »). */

import { saveFile } from "../export/export-files.js";
import { languageLocale, translate } from "../i18n/i18n.js";
import { folderSupported, pickFolder, rememberFolder, savedFolder } from "../project/folder-store.js";
import { datedProfileName, PROFILE_FILE, profileSummary, readProfile } from "../project/profile-data.js";
import {
  applyProfile,
  autoBackupOn,
  backupFolder,
  backupProfile,
  onAutoBackup,
  profileInFolder,
  profileText,
  setAutoBackup,
  startAutoBackup
} from "../project/profile-store.js";
import { byId } from "../util/dom.js";
import { closeModal, openModal } from "./modal.js";
import { keepUnsavedProject, unsavedProject } from "./projects-dialog.js";

// message à montrer après le rechargement qui suit un profil chargé
const LOADED_KEY = "nestor.profil-charge";

// profil relu en attente de « Charger » : { profile, name, handle (dossier où il a été trouvé) } ; second clic armé
let pending = null;
let replaceArmed = false;

function message(text) {
  byId("profMsg").textContent = text || "";
}

function formatDate(time) {
  return new Date(time).toLocaleString(languageLocale(), { dateStyle: "medium", timeStyle: "short" });
}

/* Dossier des sauvegardes choisi (la fenêtre s'ouvre sur celui des projets s'il y en a un) ; null si annulé. */
async function chooseBackupFolder() {
  var projects = await savedFolder("projects");
  return pickFolder("profile", projects || undefined);
}

// état d'une sauvegarde, sous la case « automatique » (ou le bouton pour redonner l'autorisation)
function showBackupState(result) {
  var allow = byId("profAllow");
  allow.hidden = result.state !== "denied";
  if (result.state === "denied") allow.textContent = translate("prof.allow", { f: result.folder });
  var key = { written: "prof.syncDone", failed: "prof.syncFailed" }[result.state];
  if (key) byId("profAutoMsg").textContent = translate(key, { d: result.savedAt ? formatDate(result.savedAt) : "" });
  else if (result.state === "denied") byId("profAutoMsg").textContent = "";
}

/* Enregistrer : dans le dossier des sauvegardes (à choisir la première fois), sinon un fichier téléchargé, daté. */
async function saveProfile() {
  message("");
  try {
    if (!folderSupported()) {
      var name = datedProfileName(Date.now());
      await saveFile(name, new Blob([await profileText(unsavedProject())], { type: "application/json" }));
      return message(translate("dl.done", { f: name }));
    }
    if (!(await backupFolder()) && !(await chooseBackupFolder())) return renderBackup();
    var result = await backupProfile(unsavedProject(), true);
    await renderBackup();
    showBackupState(result);
    if (result.state === "written") message(translate("prof.savedFolder", { f: result.folder }));
    else if (result.state === "same") message(translate("prof.same", { f: result.folder }));
    else if (result.state === "failed") message(translate("prof.saveFailed"));
  } catch (err) {
    if (err && err.name === "AbortError") return;
    message(translate("prof.saveFailed"));
  }
}

async function changeFolder() {
  try {
    if (!(await chooseBackupFolder())) return;
    await renderBackup();
    startAutoBackup(unsavedProject);
  } catch (e) {
    message(translate("prof.saveFailed"));
  }
}

async function showPreview(profile, name, handle) {
  var s = profileSummary(profile),
    current = await backupFolder();
  pending = { profile: profile, name: name, handle: handle || null };
  replaceArmed = false;
  byId("profName").textContent = translate("prof.loadName", { f: name });
  byId("profSummary").textContent =
    translate("prof.summary", { p: s.projects, m: s.materials, n: s.notes, l: s.machines }) +
    (profile.savedAt ? " · " + translate("prof.when", { d: formatDate(profile.savedAt) }) : "");
  byId("profPreview").querySelector('[value="add"]').checked = true;
  // trouvé dans un dossier qui n'est pas encore celui des sauvegardes : proposer d'y continuer
  var adopt = !!handle && !(current && current.name === handle.name);
  byId("profAdoptRow").hidden = !adopt;
  byId("profAdopt").checked = true;
  if (adopt) byId("profAdoptLbl").textContent = translate("prof.adopt", { f: handle.name });
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
      return showPreview(readProfile(text), file.name, null);
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
    if (pending.handle && !byId("profAdoptRow").hidden && byId("profAdopt").checked)
      await rememberFolder(pending.handle, "profile");
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

/* Dossier des sauvegardes, case « automatique », profil trouvé ailleurs. */
async function renderBackup() {
  var supported = folderSupported(),
    folder = await backupFolder();
  byId("profNoFolder").hidden = supported;
  byId("profWhereRow").hidden = !supported;
  byId("profAutoRow").hidden = !folder;
  if (!folder) {
    byId("profAutoMsg").textContent = "";
    byId("profAllow").hidden = true;
  }
  if (supported) {
    byId("profWhere").textContent = folder ? translate("prof.where", { f: folder.name }) : translate("prof.whereNone");
    byId("profPick").textContent = translate(folder ? "prof.change" : "prof.pick");
  }
  byId("profAuto").checked = autoBackupOn();
  var found = await profileInFolder();
  byId("profFound").hidden = !found || !!pending;
  if (found)
    byId("profFoundTxt").textContent = translate("prof.found", {
      f: found.folder,
      d: formatDate(found.profile.savedAt)
    });
}

/* Ouvre la fenêtre « Mon profil ». */
export function openProfileDialog() {
  openModal("profile", byId("btnCloseProf"), byId("btnProfile"));
  return refreshProfilePanel();
}

function closeProfileDialog() {
  closeModal("profile");
}

/* Au démarrage, une fois la langue chargée : un profil vient d'être chargé (l'appli a été rechargée), on le dit
   là où il a été chargé. */
export function showLoadedProfile() {
  if (profileLoadedMessage()) openProfileDialog();
}

function refreshProfilePanel() {
  if (!pending) message(byId("profMsg").dataset.keep ? byId("profMsg").textContent : "");
  delete byId("profMsg").dataset.keep;
  return renderBackup();
}

async function showFound() {
  var found = await profileInFolder();
  if (found) await showPreview(found.profile, PROFILE_FILE, found.handle);
}

export function bindProfilePanel() {
  byId("btnProfile").addEventListener("click", openProfileDialog);
  byId("btnCloseProf").addEventListener("click", closeProfileDialog);
  byId("profile").addEventListener("click", function (e) {
    if (e.target === this) closeProfileDialog();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !byId("profile").hidden) closeProfileDialog();
  });
  byId("profSave").addEventListener("click", saveProfile);
  byId("profPick").addEventListener("click", changeFolder);
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
    renderBackup();
  });
  byId("profApply").addEventListener("click", applyPending);
  byId("profPreview").addEventListener("change", function (e) {
    if (e.target.name !== "profMode") return;
    replaceArmed = false;
    byId("profApply").textContent = translate("prof.apply");
    byId("profApply").classList.remove("confirm");
  });
  byId("profFoundBtn").addEventListener("click", showFound);
  // « Voir ce profil » depuis Projets → Mon dossier : la fenêtre « Mon profil » s'ouvre sur l'aperçu
  document.addEventListener("nestor:open-profile", function () {
    openProfileDialog().then(showFound);
  });
  byId("profAuto").addEventListener("change", function () {
    setAutoBackup(this.checked, unsavedProject);
    if (!this.checked) byId("profAutoMsg").textContent = "";
  });
  // autorisation à redonner (nouvelle visite) : demandée au clic, puis la sauvegarde reprend
  byId("profAllow").addEventListener("click", function () {
    backupProfile(unsavedProject(), true).then(showBackupState);
  });
  onAutoBackup(showBackupState);
  startAutoBackup(unsavedProject);
}

/* Après un profil chargé (l'appli vient d'être rechargée) : rend le message à montrer, ou "". */
function profileLoadedMessage() {
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
