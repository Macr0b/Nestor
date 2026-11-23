// Projets dans un dossier : noms de fichiers tirés du nom du projet, copies sans écraser. Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { folderFileName, folderSupported, freeFileName } from "../../src/project/folder-store.js";

test("nom de fichier : accents et espaces gardés, caractères interdits retirés", () => {
  assert.equal(folderFileName("Boîte à vin"), "Boîte à vin.nestor");
  assert.equal(folderFileName('Étagère 3/4 : "chêne" <v2>?'), "Étagère 3 4 chêne v2.nestor");
  assert.equal(folderFileName("a\\b|c*d"), "a b c d.nestor");
  assert.equal(folderFileName("  plusieurs    espaces  "), "plusieurs espaces.nestor");
  assert.equal(folderFileName("ligne\nretour\ttab"), "ligne retour tab.nestor");
});

test("nom de fichier : vide, points de tête, trop long", () => {
  assert.equal(folderFileName(""), "projet.nestor");
  assert.equal(folderFileName(null), "projet.nestor");
  assert.equal(folderFileName("///"), "projet.nestor");
  assert.equal(folderFileName("...caché"), "caché.nestor");
  assert.equal(folderFileName("x".repeat(200)), "x".repeat(80) + ".nestor");
});

test("copie : nom libre « (2) », « (3) »… sans écraser", () => {
  assert.equal(freeFileName("A.nestor", []), "A.nestor");
  assert.equal(freeFileName("A.nestor", ["A.nestor"]), "A (2).nestor");
  assert.equal(freeFileName("A.nestor", ["A.nestor", "A (2).nestor", "A (3).nestor"]), "A (4).nestor");
  assert.equal(freeFileName("A.nestor", ["A (2).nestor"]), "A.nestor");
});

test("choix de dossier : absent hors navigateur", () => {
  assert.equal(folderSupported(), false);
});
