// Envoi du compteur d'exports depuis Nestor : message et conditions d'envoi. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { exportMessage, mayCount, readTotal, EXPORT_KINDS } from "../../src/stats/export-stats.js";
import { readExportMessage, ALLOWED_ORIGINS, EXPORT_KINDS as COUNTED } from "../../stats/worker.js";

describe("Envoi du compteur d'exports", () => {
  test("le message ne contient que le format et la version, et le compteur l'accepte", () => {
    for (const kind of EXPORT_KINDS) {
      const text = exportMessage(kind, "1.9.9");
      assert.deepEqual(Object.keys(JSON.parse(text)), ["e", "f", "v"]);
      assert.deepEqual(readExportMessage(text), { kind, version: "1.9.9" });
    }
    assert.equal(exportMessage("nestor", "1.9.9"), null);
  });

  test("Nestor et le compteur sont d'accord sur les formats et les sites officiels", () => {
    assert.deepEqual(EXPORT_KINDS, COUNTED);
    for (const origin of ALLOWED_ORIGINS) assert.equal(mayCount(origin, true, true), true);
  });

  test("total lu : seulement un entier positif", () => {
    assert.equal(readTotal({ n: 56 }), 56);
    assert.equal(readTotal({ n: 0 }), 0);
    for (const bad of [null, {}, { n: -1 }, { n: 1.5 }, { n: "56" }, { n: null }, []])
      assert.equal(readTotal(bad), null);
  });

  test("rien n'est envoyé ailleurs que sur le site officiel, ni si l'usager l'a coupé, ni hors ligne", () => {
    assert.equal(mayCount("https://macr0b.github.io", false, true), false);
    assert.equal(mayCount("https://macr0b.github.io", true, false), false);
    for (const origin of ["http://localhost:8080", "null", "https://claude.ai", "https://exemple.github.io"])
      assert.equal(mayCount(origin, true, true), false, origin);
  });
});
