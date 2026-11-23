/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fenêtre Projets : enregistrer le projet en cours (pièces, panneaux, matière, réglages de fraisage, de laser
   et de coût), en ouvrir un autre, en partir d'un nouveau, l'exporter dans un fichier ou en importer un.
   Ouvrir ou repartir de zéro demande un second clic quand le projet en cours a changé depuis son
   enregistrement, pour ne rien perdre par erreur.
   Deux endroits : « Mon dossier » (fichiers .nestor dans un dossier choisi : clé USB, cloud…) et « Ce navigateur ».
   « Enregistrer » écrit dans l'endroit affiché. */

import { exportOptions } from "../export/export-options.js";
import { fileSlug, saveFile } from "../export/export-files.js";
import { languageLocale, translate } from "../i18n/i18n.js";
import { projectMaterialId, setProjectMaterial } from "../library/library-store.js";
import { loadMillingInput } from "../machining/milling-store.js";
import { createExampleProject } from "../project/example.js";
import { schedulePreferencesSave } from "../project/preferences.js";
import {
  base64ToBytes,
  exportProject,
  importProject,
  snapshotSummary,
  takeSnapshot
} from "../project/project-snapshot.js";
import { deleteProject, listProjects, newProjectId, readProject, storeProject } from "../project/projects-store.js";
import {
  folderFileName,
  folderPermission,
  folderSupported,
  forgetFolder,
  freeFileName,
  listFolder,
  pickFolder,
  readFolderFile,
  savedFolder,
  writeFolderFile
} from "../project/folder-store.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { byId, escapeHtml } from "../util/dom.js";
import { applyCostSettings, costSettings } from "./cost-tab.js";
import { restoreFileSizes, syncFileIds } from "./files-panel.js";
import { applyLaserSelection, laserSelection } from "./laser-tab.js";
import { applyMillingSettings } from "./milling-tab.js";
import { renderAll } from "./render-all.js";
import { closeModal, openModal } from "./modal.js";

// contenu du projet en cours au dernier enregistrement ou à l'ouverture (pour savoir s'il a changé)
let savedJson = null;
// bouton qui attend son second clic : { act, id }
let pending = null;
// endroit affiché : "folder" (Mon dossier) ou "browser" (Ce navigateur)
let place = null;
const PLACE_KEY = "nestor.projPlace";

function message(text) {
  byId("projMsg").textContent = text;
}

function millingForProject() {
  const input = loadMillingInput();
  // JSON ne sait pas écrire NaN : une épaisseur vide reste vide
  if (!isFinite(input.thickness)) input.thickness = null;
  return input;
}

function currentSnapshot() {
  return takeSnapshot(state, {
    exportOptions: exportOptions,
    material: projectMaterialId(),
    milling: millingForProject(),
    laser: laserSelection(),
    cost: costSettings()
  });
}

/* Le projet en cours a-t-il changé depuis son enregistrement ? (l'exemple du premier lancement ne compte pas) */
function hasChanges() {
  if (savedJson == null) return !(state.example && !state.id);
  return JSON.stringify(currentSnapshot()) !== savedJson;
}

function projectName() {
  return (state.name || "").trim() || translate("pdf.untitled");
}

/* Ouvre un projet dans l'appli : état, fichiers, options d'export, réglages des onglets, puis tout est redessiné. */
function applySnapshot(snapshot, id, folderFile) {
  // l'ancien plan parle des pièces de l'ancien projet : il ne doit plus servir (Coût, repères…)
  session.lastResult = null;
  state.id = id;
  // fichier du dossier d'où vient le projet (« Enregistrer » le remplace), ou null
  state.folderFile = folderFile || null;
  state.name = snapshot.name;
  state.example = snapshot.example;
  state.source = snapshot.source;
  state.info = snapshot.info;
  state.files = snapshot.files.map(function (f) {
    return { id: f.id, name: f.name, data: base64ToBytes(f.data).buffer, info: f.info };
  });
  state.sheet = snapshot.sheet;
  state.types = snapshot.types;
  state.locks = snapshot.locks;
  state.rotAll = snapshot.rotAll;
  state.kits = snapshot.kits;
  state.sort = snapshot.sort;
  Object.assign(exportOptions, snapshot.exportOptions);
  syncFileIds();
  if (snapshot.milling) applyMillingSettings(snapshot.milling);
  if (snapshot.laser) applyLaserSelection(snapshot.laser);
  if (snapshot.cost) applyCostSettings(snapshot.cost);
  setProjectMaterial(snapshot.material, "projects");
  schedulePreferencesSave();
  renderAll();
  restoreFileSizes();
  savedJson = JSON.stringify(currentSnapshot());
}

function renderCurrent() {
  byId("projCurrent").innerHTML =
    escapeHtml(projectName()) + (hasChanges() ? " <em>(" + escapeHtml(translate("proj.unsaved")) + ")</em>" : "");
}

function formatDate(time) {
  return new Date(time).toLocaleString(languageLocale(), { dateStyle: "medium", timeStyle: "short" });
}

function renderList() {
  return listProjects()
    .then(function (projects) {
      byId("projList").innerHTML = projects.length
        ? projects
            .map(function (p) {
              const openLabel =
                  pending && pending.act === "open" && pending.id === p.id ? "proj.openUnsaved" : "proj.open",
                deleting = pending && pending.act === "delete" && pending.id === p.id;
              return (
                '<div class="proj-row" data-id="' +
                escapeHtml(p.id) +
                '"><div class="proj-info"><b>' +
                escapeHtml(p.name) +
                (p.id === state.id ? ' <span class="tag">' + escapeHtml(translate("proj.inUse")) + "</span>" : "") +
                "</b><small>" +
                escapeHtml(translate("proj.meta", { d: formatDate(p.savedAt), p: p.parts, n: p.panels })) +
                '</small></div><button type="button" class="btn sm' +
                (openLabel === "proj.openUnsaved" ? " confirm" : "") +
                '" data-act="open">' +
                escapeHtml(translate(openLabel)) +
                '</button><button type="button" class="btn sm' +
                (deleting ? " confirm" : "") +
                '" data-act="delete">' +
                escapeHtml(translate(deleting ? "nb.confirmDelete" : "proj.delete")) +
                "</button></div>"
              );
            })
            .join("")
        : '<p class="hint">' + escapeHtml(translate("proj.empty")) + "</p>";
    })
    .catch(function () {
      byId("projList").innerHTML = '<p class="hint">' + escapeHtml(translate("proj.storeFailed")) + "</p>";
    });
}

function refresh() {
  renderCurrent();
  byId("projNew").textContent = translate(pending && pending.act === "new" ? "proj.newUnsaved" : "proj.new");
  byId("projNew").classList.toggle("confirm", !!(pending && pending.act === "new"));
  renderPlaceTabs();
  return Promise.all([renderList(), renderFolder()]);
}

/* Enregistre le projet en cours, dans l'endroit affiché (asCopy : sous un autre nom ; le projet en cours devient
   la copie). */
export function saveCurrentProject(asCopy) {
  return choosePlace().then(function (where) {
    // sans choix de dossier possible (Safari, Firefox, téléphone), tout va dans le navigateur
    return where === "folder" && folderSupported() ? saveToFolder(asCopy) : saveToBrowser(asCopy);
  });
}

function saveToBrowser(asCopy) {
  const snapshot = currentSnapshot(),
    id = (!asCopy && state.id) || newProjectId(),
    entry = Object.assign({ id: id, name: projectName(), savedAt: Date.now() }, snapshotSummary(snapshot));
  pending = null;
  return storeProject(entry, snapshot)
    .then(function () {
      state.id = id;
      state.folderFile = null;
      state.example = false;
      savedJson = JSON.stringify(currentSnapshot());
      message(translate("proj.saved"));
    })
    .catch(function () {
      message(translate("proj.storeFailed"));
    })
    .then(refresh);
}

function openProject(id) {
  if (hasChanges() && !(pending && pending.act === "open" && pending.id === id)) {
    pending = { act: "open", id: id };
    return refresh();
  }
  pending = null;
  return readProject(id)
    .then(function (snapshot) {
      if (!snapshot) throw new Error("absent");
      applySnapshot(importProject(JSON.stringify(snapshot)), id, null);
      message(translate("proj.opened", { n: projectName() }));
    })
    .catch(function () {
      message(translate("proj.importFailed"));
    })
    .then(refresh);
}

function newProject() {
  if (hasChanges() && !(pending && pending.act === "new")) {
    pending = { act: "new" };
    return refresh();
  }
  pending = null;
  // nouveau projet : l'exemple du premier lancement, en gardant les panneaux habituels
  const fresh = createExampleProject();
  fresh.sheet = state.sheet;
  Object.assign(state, fresh, { id: null, folderFile: null });
  syncFileIds();
  renderAll();
  savedJson = null;
  message(translate("proj.created"));
  return refresh();
}

function removeProject(id) {
  if (!(pending && pending.act === "delete" && pending.id === id)) {
    pending = { act: "delete", id: id };
    return refresh();
  }
  pending = null;
  return deleteProject(id)
    .then(function () {
      if (state.id === id) {
        state.id = null;
        savedJson = null;
      }
      message(translate("proj.deleted"));
    })
    .catch(function () {
      message(translate("proj.storeFailed"));
    })
    .then(refresh);
}

function exportFile() {
  const name = fileSlug(projectName()) + ".nestor";
  saveFile(name, new Blob([exportProject(currentSnapshot())], { type: "application/json" }))
    .then(function () {
      message(translate("dl.done", { f: name }));
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") return;
      message(translate("dl.fail"));
    });
}

function importFile(file) {
  file
    .text()
    .then(function (text) {
      const snapshot = importProject(text),
        id = newProjectId(),
        entry = Object.assign(
          { id: id, name: snapshot.name || translate("pdf.untitled"), savedAt: Date.now() },
          snapshotSummary(snapshot)
        );
      return storeProject(entry, snapshot).then(function () {
        // projet en cours modifié : on n'écrase rien, le projet importé attend dans la liste
        if (hasChanges()) return message(translate("proj.importedOnly", { n: entry.name }));
        applySnapshot(snapshot, id, null);
        message(translate("proj.imported", { n: entry.name }));
      });
    })
    .catch(function () {
      message(translate("proj.importFailed"));
    })
    .then(refresh);
}

/* — Mon dossier ———————————————————————————————————————————————————————————————————————————— */

// endroit par défaut : celui de la dernière fois, sinon le dossier s'il y en a un, sinon le navigateur
function choosePlace() {
  if (place) return Promise.resolve(place);
  var last = null;
  try {
    last = localStorage.getItem(PLACE_KEY);
  } catch (e) {}
  return savedFolder().then(function (folder) {
    place = last === "browser" || last === "folder" ? last : folder && folderSupported() ? "folder" : "browser";
    if (place === "folder" && !folderSupported()) place = "browser";
    return place;
  });
}

function setPlace(where) {
  place = where;
  try {
    localStorage.setItem(PLACE_KEY, where);
  } catch (e) {}
  refresh();
}

function renderPlaceTabs() {
  var folderTab = byId("projTabFolder"),
    browserTab = byId("projTabBrowser"),
    onFolder = place === "folder";
  folderTab.setAttribute("aria-selected", String(onFolder));
  browserTab.setAttribute("aria-selected", String(!onFolder));
  folderTab.tabIndex = onFolder ? 0 : -1;
  browserTab.tabIndex = onFolder ? -1 : 0;
  byId("projFolderPane").hidden = !onFolder;
  byId("projBrowserPane").hidden = onFolder;
}

function folderRow(file) {
  var openLabel = pending && pending.act === "openFile" && pending.id === file.name ? "proj.openUnsaved" : "proj.open";
  return (
    '<div class="proj-row" data-file="' +
    escapeHtml(file.name) +
    '"><div class="proj-info"><b>' +
    escapeHtml(file.title) +
    (file.name === state.folderFile ? ' <span class="tag">' + escapeHtml(translate("proj.inUse")) + "</span>" : "") +
    "</b><small>" +
    escapeHtml(formatDate(file.savedAt)) +
    '</small></div><button type="button" class="btn sm' +
    (openLabel === "proj.openUnsaved" ? " confirm" : "") +
    '" data-act="openFile">' +
    escapeHtml(translate(openLabel)) +
    "</button></div>"
  );
}

/* Contenu de « Mon dossier » selon la situation : pas possible ici, pas de dossier, autorisation à redonner,
   dossier introuvable, ou la liste de ses projets. */
function renderFolder() {
  var list = byId("projFolderList"),
    hint = byId("projFolderHint"),
    label = byId("projFolderLbl");
  if (!folderSupported()) {
    list.innerHTML = "";
    byId("projPick").hidden = byId("projForget").hidden = true;
    hint.textContent = translate("proj.folderUnsupported");
    label.textContent = translate("proj.folder");
    return Promise.resolve();
  }
  return savedFolder().then(function (folder) {
    byId("projPick").hidden = false;
    byId("projForget").hidden = !folder;
    byId("projPick").textContent = translate(folder ? "proj.pickOther" : "proj.pick");
    label.textContent = folder ? translate("proj.folderNamed", { f: folder.name }) : translate("proj.folder");
    hint.textContent = translate("proj.folderHint");
    if (!folder) {
      list.innerHTML = '<p class="hint">' + escapeHtml(translate("proj.folderNone")) + "</p>";
      return;
    }
    return folderPermission(folder, false)
      .then(function (permission) {
        if (permission !== "granted") {
          list.innerHTML =
            '<button type="button" class="btn primary" data-act="allow">' +
            escapeHtml(translate("proj.allow", { f: folder.name })) +
            "</button>";
          return;
        }
        return listFolder(folder).then(function (files) {
          list.innerHTML = files.length
            ? files.map(folderRow).join("")
            : '<p class="hint">' + escapeHtml(translate("proj.folderEmpty")) + "</p>";
        });
      })
      .catch(function () {
        list.innerHTML = '<p class="hint">' + escapeHtml(translate("proj.folderLost", { f: folder.name })) + "</p>";
      });
  });
}

// dossier prêt à écrire (l'autorisation est redemandée si besoin ; pas encore de dossier : on le fait choisir)
function writableFolder() {
  return savedFolder()
    .then(function (saved) {
      return saved || pickFolder();
    })
    .then(function (folder) {
      if (!folder) throw new Error("pas de dossier");
      return folderPermission(folder, true).then(function (permission) {
        if (permission !== "granted") throw new Error("refusé");
        return folder;
      });
    });
}

function saveToFolder(asCopy) {
  pending = null;
  var folder;
  return writableFolder()
    .then(function (f) {
      folder = f;
      return listFolder(folder);
    })
    .then(function (files) {
      var taken = files.map(function (f) {
          return f.name;
        }),
        name = !asCopy && state.folderFile ? state.folderFile : freeFileName(folderFileName(projectName()), taken);
      return writeFolderFile(folder, name, exportProject(currentSnapshot())).then(function () {
        state.folderFile = name;
        state.id = null;
        state.example = false;
        savedJson = JSON.stringify(currentSnapshot());
        message(translate("proj.savedFolder", { f: name, d: folder.name }));
      });
    })
    .catch(function () {
      message(translate("proj.folderFailed"));
    })
    .then(refresh);
}

function openFolderFile(name) {
  if (hasChanges() && !(pending && pending.act === "openFile" && pending.id === name)) {
    pending = { act: "openFile", id: name };
    return refresh();
  }
  pending = null;
  return writableFolder()
    .then(function (folder) {
      return readFolderFile(folder, name);
    })
    .then(function (text) {
      applySnapshot(importProject(text), null, name);
      message(translate("proj.opened", { n: projectName() }));
    })
    .catch(function () {
      message(translate("proj.importFailed"));
    })
    .then(refresh);
}

function chooseFolder() {
  return pickFolder()
    .then(function (folder) {
      if (folder) {
        state.folderFile = null;
        place = "folder";
      }
    })
    .catch(function () {
      message(translate("proj.folderFailed"));
    })
    .then(refresh);
}

export function openProjectsDialog() {
  pending = null;
  message("");
  openModal("projects", byId("btnCloseProj"), byId("btnProjects"));
  return choosePlace().then(refresh);
}

function closeProjectsDialog() {
  closeModal("projects");
  pending = null;
}

export function bindProjectsDialog() {
  byId("btnProjects").addEventListener("click", openProjectsDialog);
  byId("btnCloseProj").addEventListener("click", closeProjectsDialog);
  byId("projects").addEventListener("click", function (e) {
    if (e.target === this) closeProjectsDialog();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !byId("projects").hidden) closeProjectsDialog();
  });
  byId("projSave").addEventListener("click", function () {
    saveCurrentProject(false);
  });
  byId("projSaveCopy").addEventListener("click", function () {
    saveCurrentProject(true);
  });
  byId("projNew").addEventListener("click", newProject);
  byId("projExport").addEventListener("click", exportFile);
  byId("projImport").addEventListener("click", function () {
    byId("projFile").click();
  });
  byId("projFile").addEventListener("change", function () {
    if (this.files && this.files[0]) importFile(this.files[0]);
    this.value = "";
  });
  byId("projTabFolder").addEventListener("click", function () {
    setPlace("folder");
  });
  byId("projTabBrowser").addEventListener("click", function () {
    setPlace("browser");
  });
  // flèches gauche / droite entre les deux onglets
  byId("projects")
    .querySelector(".proj-tabs")
    .addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setPlace(place === "folder" ? "browser" : "folder");
      byId(place === "folder" ? "projTabFolder" : "projTabBrowser").focus();
    });
  byId("projPick").addEventListener("click", chooseFolder);
  byId("projForget").addEventListener("click", function () {
    forgetFolder().then(function () {
      state.folderFile = null;
      refresh();
    });
  });
  byId("projFolderList").addEventListener("click", function (e) {
    var button = e.target.closest("[data-act]");
    if (!button) return;
    if (button.dataset.act === "allow")
      savedFolder()
        .then(function (folder) {
          return folder && folderPermission(folder, true);
        })
        .then(refresh);
    else if (button.dataset.act === "openFile") openFolderFile(button.closest(".proj-row").dataset.file);
  });
  byId("projList").addEventListener("click", function (e) {
    const button = e.target.closest("[data-act]");
    if (!button) return;
    const id = button.closest(".proj-row").dataset.id;
    if (button.dataset.act === "open") openProject(id);
    else if (button.dataset.act === "delete") removeProject(id);
  });
}
