// Carnet de réglages : vérification des fiches, recherche, sauvegarde et import. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleanEntry,
  cleanEntries,
  filterEntries,
  exportNotebook,
  importNotebook,
  MAX_IMPORT_BYTES
} from "../../src/notebook/notebook-store.js";

const mill = {
  id: "a1",
  process: "mill",
  date: "2026-11-12",
  status: "ok",
  machine: "CNC atelier",
  material: "Contreplaqué bouleau",
  thickness: 18,
  note: "Léger arrachement",
  values: { tool: "upcut", diameter: 6, flutes: 2, rpm: 18000, feed: 2200, depth: 3, passes: 6 }
};
const laser = {
  id: "b2",
  process: "laser",
  date: "2026-11-08",
  machine: "Trotec Speedy 360",
  material: "Contreplaqué peuplier",
  thickness: 3,
  values: { operation: "cut", speed: 1.2, power: 100, frequency: 1000, passes: 1, optics: 'lentille 2"' }
};

describe("Carnet de réglages", () => {
  test("une fiche correcte est gardée telle quelle", () => {
    const entry = cleanEntry(mill);
    assert.equal(entry.material, "Contreplaqué bouleau");
    assert.equal(entry.values.rpm, 18000);
    assert.equal(cleanEntry(laser).values.optics, 'lentille 2"');
  });

  test("fiche abîmée ou trafiquée : types corrigés, textes coupés, pas de champ inconnu", () => {
    const entry = cleanEntry({
      process: "laser",
      date: "<script>",
      status: "boom",
      machine: { evil: 1 },
      note: "x".repeat(10000),
      thickness: -3,
      values: { operation: "explode", speed: "fast", power: Infinity, extra: "<img onerror>" },
      __proto__: { polluted: true }
    });
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(entry.status, "ok");
    assert.equal(entry.machine, "");
    assert.equal(entry.note.length, 2000);
    assert.equal(entry.thickness, null);
    assert.equal(entry.values.operation, "cut");
    assert.equal(entry.values.speed, null);
    assert.equal(entry.values.power, null);
    assert.ok(!("extra" in entry.values));
    assert.equal(cleanEntry({ process: "teleport" }), null);
    assert.equal(cleanEntry(null), null);
  });

  test("liste : plus récentes d'abord, doublons d'identifiant renouvelés", () => {
    const list = cleanEntries([laser, mill, { ...mill }]);
    assert.deepEqual(
      list.map((e) => e.date),
      ["2026-11-12", "2026-11-12", "2026-11-08"]
    );
    assert.equal(new Set(list.map((e) => e.id)).size, 3);
    assert.deepEqual(cleanEntries("pas une liste"), []);
  });

  test("recherche sans accents ni majuscules, et filtre par procédé", () => {
    const list = cleanEntries([mill, laser]);
    assert.deepEqual(
      filterEntries(list, "contreplaque", "").map((e) => e.id),
      ["a1", "b2"]
    );
    assert.deepEqual(
      filterEntries(list, "TROTEC peuplier", "").map((e) => e.id),
      ["b2"]
    );
    assert.deepEqual(
      filterEntries(list, "", "mill").map((e) => e.id),
      ["a1"]
    );
    assert.deepEqual(filterEntries(list, "arrachement", "laser"), []);
    // libellés traduits fournis par l'interface (ex. « Hélice montante »)
    assert.deepEqual(
      filterEntries(list, "helice", "", (e) => (e.process === "mill" ? ["Hélice montante"] : [])).map((e) => e.id),
      ["a1"]
    );
  });

  test("sauvegarde puis import : on retrouve les mêmes fiches", () => {
    const list = cleanEntries([mill, laser]);
    const back = importNotebook([], exportNotebook(list));
    assert.deepEqual(back.entries, list);
    assert.equal(back.added, 2);
  });

  test("import fusionné : une fiche de même identifiant est remplacée, les autres gardées", () => {
    const existing = cleanEntries([mill]);
    const changed = { ...mill, note: "Corrigé" };
    const merged = importNotebook(existing, exportNotebook(cleanEntries([changed, laser])));
    assert.equal(merged.entries.length, 2);
    assert.equal(merged.entries.find((e) => e.id === "a1").note, "Corrigé");
  });

  test("import refusé : autre fichier JSON, fichier illisible ou trop gros", () => {
    assert.throws(() => importNotebook([], JSON.stringify({ entries: [mill] })), /pas un carnet/);
    assert.throws(() => importNotebook([], "{ pas du json"));
    assert.throws(() => importNotebook([], " ".repeat(MAX_IMPORT_BYTES + 1)), /trop gros/);
  });
});
