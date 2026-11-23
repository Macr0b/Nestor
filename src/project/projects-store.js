/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Projets enregistrés sur l'appareil, dans la base du navigateur (IndexedDB : assez de place pour les fichiers
   importés). Deux tiroirs : la liste (nom, date, résumé) et le contenu, lu seulement à l'ouverture. */

const DB_NAME = "nestor-projets";
const DB_VERSION = 1;

let opening = null;

function openDb() {
  if (opening) return opening;
  opening = new Promise(function (resolve, reject) {
    if (typeof indexedDB === "undefined") return reject(new Error("indexedDB"));
    var request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains("list")) db.createObjectStore("list", { keyPath: "id" });
      if (!db.objectStoreNames.contains("content")) db.createObjectStore("content", { keyPath: "id" });
    };
    request.onsuccess = function () {
      resolve(request.result);
    };
    request.onerror = function () {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

function run(stores, mode, work) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(stores, mode),
        result;
      work(tx, function (value) {
        result = value;
      });
      tx.oncomplete = function () {
        resolve(result);
      };
      tx.onerror = tx.onabort = function () {
        reject(tx.error || new Error("transaction"));
      };
    });
  });
}

export function newProjectId() {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Liste des projets, plus récents d'abord : [{ id, name, savedAt, parts, panels }]. */
export function listProjects() {
  return run(["list"], "readonly", function (tx, done) {
    var request = tx.objectStore("list").getAll();
    request.onsuccess = function () {
      done(
        request.result.sort(function (a, b) {
          return b.savedAt - a.savedAt;
        })
      );
    };
  });
}

/* Enregistre (ou remplace) un projet. entry : { id, name, savedAt, parts, panels } ; snapshot : son contenu. */
export function storeProject(entry, snapshot) {
  return run(["list", "content"], "readwrite", function (tx) {
    tx.objectStore("list").put(entry);
    tx.objectStore("content").put({ id: entry.id, snapshot: snapshot });
  });
}

export function readProject(id) {
  return run(["content"], "readonly", function (tx, done) {
    var request = tx.objectStore("content").get(id);
    request.onsuccess = function () {
      done(request.result ? request.result.snapshot : null);
    };
  });
}

export function deleteProject(id) {
  return run(["list", "content"], "readwrite", function (tx) {
    tx.objectStore("list").delete(id);
    tx.objectStore("content").delete(id);
  });
}
