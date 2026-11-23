/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Projets dans un dossier choisi par l'usager (clé USB, iCloud Drive, Dropbox, Nextcloud…), en fichiers .nestor.
   Possible dans Chrome et Edge sur ordinateur (choix d'un dossier) ; ailleurs, Exporter / Importer un fichier.
   Le dossier choisi est retenu dans ce navigateur ; le navigateur redemande l'autorisation d'y écrire. */

const DB_NAME = "nestor-dossier";
const EXT = ".nestor";

// dossier retenu pour cette visite (aussi quand le navigateur ne sait pas le garder d'une visite à l'autre)
let remembered = null;

/* Choix d'un dossier possible ? (pas dans une page incluse dans une autre, comme la version Claude : le navigateur
   l'y refuse) */
export function folderSupported() {
  if (typeof window === "undefined" || typeof window.showDirectoryPicker !== "function") return false;
  try {
    return window.top === window.self;
  } catch (e) {
    return false;
  }
}

function openDb() {
  return new Promise(function (resolve, reject) {
    if (typeof indexedDB === "undefined") return reject(new Error("indexedDB"));
    var request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = function () {
      request.result.createObjectStore("handles");
    };
    request.onsuccess = function () {
      resolve(request.result);
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
}

function stored(mode, work) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("handles", mode),
        result = null;
      work(tx.objectStore("handles"), function (value) {
        result = value;
      });
      tx.oncomplete = function () {
        resolve(result);
      };
      tx.onerror = tx.onabort = function () {
        reject(tx.error);
      };
    });
  });
}

/* Dossier retenu, ou null. */
export function savedFolder() {
  if (remembered) return Promise.resolve(remembered);
  return stored("readonly", function (store, done) {
    var request = store.get("projects");
    request.onsuccess = function () {
      done(request.result || null);
    };
  })
    .then(function (handle) {
      remembered = handle;
      return handle;
    })
    .catch(function () {
      return null;
    });
}

function keepFolder(handle) {
  remembered = handle;
  return stored("readwrite", function (store) {
    if (handle) store.put(handle, "projects");
    else store.delete("projects");
  }).catch(function () {});
}

/* Fenêtre du système pour choisir un dossier ; rend le dossier choisi (null si l'usager annule). */
export function pickFolder() {
  return window
    .showDirectoryPicker({ id: "nestor-projets", mode: "readwrite" })
    .then(function (handle) {
      return keepFolder(handle).then(function () {
        return handle;
      });
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") return null;
      throw err;
    });
}

export function forgetFolder() {
  return keepFolder(null);
}

/* Autorisation d'écrire dans le dossier : « granted », « prompt » ou « denied ». ask : la demander (après un clic). */
export function folderPermission(handle, ask) {
  var options = { mode: "readwrite" };
  return Promise.resolve(handle.queryPermission ? handle.queryPermission(options) : "granted").then(function (state) {
    if (state === "granted" || !ask || !handle.requestPermission) return state;
    return handle.requestPermission(options);
  });
}

/* Fichiers .nestor du dossier, plus récents d'abord : [{ name, title, savedAt, size }]. */
export async function listFolder(handle) {
  var out = [];
  for await (var entry of handle.values()) {
    if (entry.kind !== "file" || !entry.name.toLowerCase().endsWith(EXT)) continue;
    var file = await entry.getFile();
    out.push({
      name: entry.name,
      title: entry.name.slice(0, -EXT.length),
      savedAt: file.lastModified,
      size: file.size
    });
  }
  return out.sort(function (a, b) {
    return b.savedAt - a.savedAt;
  });
}

export async function readFolderFile(handle, name) {
  var file = await (await handle.getFileHandle(name)).getFile();
  return file.text();
}

export async function writeFolderFile(handle, name, text) {
  var fileHandle = await handle.getFileHandle(name, { create: true });
  var writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

/* Nom de fichier lisible tiré du nom du projet : accents et espaces gardés, caractères interdits retirés. */
export function folderFileName(projectName) {
  var base = String(projectName || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80);
  return (base || "projet") + EXT;
}

/* Nom libre pour une copie : « Boîte (2).nestor », « Boîte (3).nestor »… */
export function freeFileName(name, taken) {
  if (!taken.includes(name)) return name;
  var base = name.slice(0, -EXT.length);
  for (var n = 2; ; n++) {
    var candidate = base + " (" + n + ")" + EXT;
    if (!taken.includes(candidate)) return candidate;
  }
}
