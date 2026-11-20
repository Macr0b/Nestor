/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Bloc « Fichier des pièces » : choix ou glisser-déposer de fichiers, ajout, retrait, résumé de ce qui a été
   lu et erreurs. */

import { translate } from "../i18n/i18n.js";
import { showLength } from "./lengths.js";
import { parseImportedFile, readFiles } from "../import/read-file.js";
import { schedulePreferencesSave } from "../project/preferences.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { renderAll } from "./render-all.js";
import { byId, escapeHtml } from "../util/dom.js";
import { allowChangeOf } from "./lock-guard.js";

let nextFileId = 0;

/* Projet ouvert : les prochains fichiers importés prennent un numéro libre. */
export function syncFileIds() {
  nextFileId = (state.files || []).reduce(function (max, f) {
    return Math.max(max, f.id || 0);
  }, 0);
}

export let fileErrors = [];

function sourceFileNames() {
  return (state.files || [])
    .map(function (f) {
      return f.name;
    })
    .join(", ");
}

// list : [{name,data}] ; append : ajoute au travail en cours au lieu de le remplacer
async function importFiles(list, append) {
  if (!append || state.example) {
    state.files = [];
    // les pièces saisies à la main restent (sauf celles de l'exemple, qui n'en a pas)
    state.types = state.example
      ? []
      : state.types.filter(function (t) {
          return t.manual;
        });
    state.example = false;
    state.name = append ? state.name : "";
  }
  fileErrors = [];
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    try {
      var r = await parseImportedFile(f.name, f.data),
        id = ++nextFileId;
      r.types.forEach(function (t) {
        t.fid = id;
      });
      state.files.push({ id: id, name: f.name, data: f.data, info: r.info });
      state.types = state.types.concat(r.types);
      if (!state.name) state.name = f.name.replace(/\.(dxf|svgz?|ai|pdf|lbrn2?|vectorcraft|plt|hpgl?|hgl)$/i, "");
    } catch (e) {
      fileErrors.push({ name: f.name, msg: (e && e.message) || translate("err.generic") });
    }
  }
  state.source = sourceFileNames();
  var fi = state.files[0];
  state.info = fi ? fi.info : null;
  if (fileErrors.length)
    session.lastError = fileErrors
      .map(function (x) {
        return x.name + " : " + x.msg;
      })
      .join(" | ");
}

let importInProgress = false;

async function runImport(list, append) {
  if (importInProgress || !list.length) return;
  importInProgress = true;
  byId("fileInfo").innerHTML =
    '<span class="hint">' +
    escapeHtml(
      translate("file.reading", {
        n: list
          .map(function (f) {
            return f.name;
          })
          .join(", ")
      })
    ) +
    "</span>";
  try {
    await importFiles(list, append);
    session.lastResult = null;
    schedulePreferencesSave();
    renderAll();
  } catch (e) {
    showFileError((e && e.message) || translate("err.generic"));
  }
  importInProgress = false;
}

function handleFiles(files, append) {
  if (!files || !files.length) {
    showFileError(translate("err.none"));
    return;
  }
  readFiles(files).then(function (list) {
    if (list.length) runImport(list, append);
    else renderFileInfo();
  });
}

function showFileError(message) {
  session.lastError = message;
  byId("fileInfo").innerHTML =
    '<span class="warn">' +
    escapeHtml(message) +
    '</span><span class="hint">' +
    escapeHtml(translate("err.formats")) +
    "</span>";
}

const dropZone = byId("drop");

export function renderFileInfo() {
  var box = byId("fileInfo");
  byId("addWrap").hidden = !!state.example || !(state.files && state.files.length);
  if (state.example) {
    box.innerHTML =
      '<span class="hint"><span class="tag">' +
      escapeHtml(translate("file.exampleTag")) +
      "</span> " +
      escapeHtml(translate("file.exampleHint")) +
      "</span>";
    return;
  }
  var html = [];
  (state.files || []).forEach(function (f) {
    var i = f.info;
    html.push(
      '<div class="fline"><div class="ftop"><span class="fn">' +
        escapeHtml(f.name) +
        '</span><button class="mini rmf" type="button" data-rmfile="' +
        f.id +
        '" title="' +
        escapeHtml(translate("file.remove")) +
        '" aria-label="' +
        escapeHtml(translate("file.remove")) +
        " " +
        escapeHtml(f.name) +
        '">×</button></div>'
    );
    html.push(
      "<span>" +
        escapeHtml(
          translate("file.summary", {
            kind: i.kind,
            w: showLength(i.size[0]),
            h: showLength(i.size[1]),
            n: i.n,
            how: translate(i.how)
          })
        ) +
        "</span>"
    );
    if (i.frame) html.push('<span class="hint">' + escapeHtml(translate("file.frame")) + "</span>");
    var w = i.warn || {},
      ws = [];
    if (w.texts) ws.push(translate("warn.texts", { n: w.texts }));
    if (w.blocks) ws.push(translate("warn.blocks", { n: w.blocks }));
    if (w.symbols) ws.push(translate("warn.symbols", { n: w.symbols }));
    if (w.pages) ws.push(translate("warn.pages", { n: w.pages }));
    if (w.paths) ws.push(translate("warn.paths", { n: w.paths }));
    if (w.special) ws.push(translate("warn.special", { n: w.special }));
    ws.forEach(function (x) {
      html.push('<span class="warn">' + escapeHtml(x) + "</span>");
    });
    html.push("</div>");
  });
  fileErrors.forEach(function (x) {
    html.push('<span class="warn">' + escapeHtml(x.name + " : " + x.msg) + "</span>");
  });
  if (fileErrors.length) html.push('<span class="hint">' + escapeHtml(translate("err.formats")) + "</span>");
  if (!html.length) html.push('<span class="hint">' + escapeHtml(translate("file.none")) + "</span>");
  box.innerHTML = html.join("");
}

export function bindFilesPanel() {
  byId("fileIn").addEventListener("change", function (e) {
    handleFiles(e.target.files, false);
    e.target.value = "";
  });
  byId("fileAdd").addEventListener("change", function (e) {
    handleFiles(e.target.files, true);
    e.target.value = "";
  });
  ["dragenter", "dragover"].forEach(function (ev) {
    dropZone.addEventListener(ev, function (e) {
      e.preventDefault();
      dropZone.classList.add("over");
    });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dropZone.addEventListener(ev, function (e) {
      e.preventDefault();
      dropZone.classList.remove("over");
    });
  });
  dropZone.addEventListener("drop", function (e) {
    handleFiles(e.dataTransfer && e.dataTransfer.files, false);
  });
  byId("unitSel").addEventListener("change", function () {
    var fs = (state.files || []).map(function (f) {
      return { name: f.name, data: f.data };
    });
    if (fs.length) runImport(fs, false);
    else renderFileInfo();
  });
  if ("launchQueue" in window) {
    window.launchQueue.setConsumer(function (p) {
      if (p && p.files && p.files.length)
        Promise.all(
          p.files.map(function (h) {
            return h.getFile();
          })
        ).then(function (fs) {
          handleFiles(fs, false);
        });
    });
  }
  byId("fileInfo").addEventListener("click", function (e) {
    var b = e.target.closest("[data-rmfile]");
    if (!b) return;
    var id = +b.dataset.rmfile;
    // pièces de ce fichier sur un panneau figé : demander, puis déverrouiller
    var touched = [];
    state.types.forEach(function (t, i) {
      if (t.fid === id) touched.push(i);
    });
    if (!allowChangeOf(touched)) return;
    state.files = state.files.filter(function (f) {
      return f.id !== id;
    });
    state.types = state.types.filter(function (t) {
      return t.fid !== id;
    });
    state.source = sourceFileNames();
    state.info = state.files[0] ? state.files[0].info : null;
    session.lastResult = null;
    schedulePreferencesSave();
    renderAll();
  });
}
