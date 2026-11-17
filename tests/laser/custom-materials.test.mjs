// Tes matières laser et tes valeurs par machine. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleanCustomLibrary,
  cleanCustomSetting,
  customLaserSettings,
  materialSettings,
  putCustomSetting
} from "../../src/laser/custom-materials.js";
import { laserSettings, LASER_CUT_LIMIT } from "../../src/laser/laser-settings.js";

const m60 = { id: "s60", name: "Speedy 360", kind: "co2", watts: 60, trotec: true };
const m120 = { id: "s120", name: "Speedy 400", kind: "co2", watts: 120, trotec: true };
const diode = { id: "d", name: "Diode", kind: "diode", watts: 20, trotec: false };
const value = (machine, extra) =>
  Object.assign(
    {
      materialId: "lmcp",
      machineId: machine.id,
      machineName: machine.name,
      machineWatts: machine.watts,
      machineKind: machine.kind,
      op: "cut",
      thickness: 5,
      power: 100,
      speed: 0.6,
      speedUnit: "percent",
      frequency: 1000,
      passes: 1,
      zOffset: 0
    },
    extra
  );
function library() {
  const lib = cleanCustomLibrary({ materials: [{ id: "lmcp", name: "CP peuplier", mill: "plyPoplar" }] });
  putCustomSetting(lib, value(m60));
  return lib;
}

describe("matières et valeurs vérifiées", () => {
  test("matière sans nom refusée, valeurs incomplètes refusées", () => {
    const lib = cleanCustomLibrary({
      materials: [
        { id: "a", name: "  " },
        { id: "b", name: "MDF", mill: "../x" }
      ],
      settings: [value(m60, { materialId: "b", power: null }), value(m60, { materialId: "zz" })]
    });
    assert.equal(lib.materials.length, 1);
    assert.deepEqual([lib.materials[0].name, lib.materials[0].mill], ["MDF", ""]);
    // identifiant d'une matière personnelle : toujours « lm… » (ne peut pas se faire passer pour une matière indicative)
    assert.match(lib.materials[0].id, /^lm/);
    assert.equal(lib.settings.length, 0);
  });

  test(`découpe : épaisseur obligatoire, ${LASER_CUT_LIMIT} mm au plus ; gravure : pas d'épaisseur`, () => {
    assert.equal(cleanCustomSetting(value(m60, { thickness: null })), null);
    assert.equal(cleanCustomSetting(value(m60, { thickness: 12 })), null);
    assert.equal(cleanCustomSetting(value(m60, { op: "engrave", thickness: 12 })).thickness, null);
  });

  test("vitesse en % au plus 100, en mm/s plus haut accepté", () => {
    assert.equal(cleanCustomSetting(value(m60, { speed: 150 })), null);
    assert.equal(cleanCustomSetting(value(m60, { speed: 150, speedUnit: "mmps" })).speed, 150);
  });

  test("une même machine, opération et épaisseur : la nouvelle valeur remplace l'ancienne", () => {
    const lib = library();
    putCustomSetting(lib, value(m60, { speed: 0.5 }));
    putCustomSetting(lib, value(m60, { thickness: 3, speed: 1 }));
    assert.deepEqual(
      materialSettings(lib, "lmcp").map((s) => [s.thickness, s.speed]),
      [
        [3, 1],
        [5, 0.5]
      ]
    );
  });
});

describe("valeurs pour la machine choisie", () => {
  test("tes valeurs telles quelles pour la même machine et la même épaisseur", () => {
    const s = customLaserSettings(library(), m60, "lmcp", "cut", 5);
    assert.equal(s.own, true);
    assert.deepEqual(s.savedSpeed, { value: 0.6, unit: "percent" });
    assert.equal(s.power, 100);
  });

  test("autre épaisseur : vitesse proportionnelle, signalée", () => {
    const s = customLaserSettings(library(), m60, "lmcp", "cut", 10);
    assert.equal(s.thicknessFrom, 5);
    assert.equal(s.speed, 0.3);
    assert.equal(s.own, false);
  });

  test("autre machine CO2 : même énergie par mm (120 W coupe deux fois plus vite)", () => {
    const s = customLaserSettings(library(), m120, "lmcp", "cut", 5);
    assert.equal(s.fromMachine, "Speedy 360");
    assert.equal(s.speed, 1.2);
  });

  test("valeurs en mm/s d'une machine non Trotec reprises en mm/s", () => {
    const lib = library();
    const other = { id: "o", name: "Atelier", kind: "co2", watts: 80, trotec: false };
    putCustomSetting(lib, value(other, { speed: 12, speedUnit: "mmps", thickness: 3 }));
    const s = customLaserSettings(lib, other, "lmcp", "cut", 3);
    assert.deepEqual(s.savedSpeed, { value: 12, unit: "mmps" });
    assert.equal(s.speedMm, 12);
  });

  test("pas de comparaison entre un CO2 et une diode", () => {
    assert.equal(customLaserSettings(library(), diode, "lmcp", "cut", 5), null);
  });

  test(`au-delà de ${LASER_CUT_LIMIT} mm : pas de découpe laser, ni pour tes matières ni pour Trotec`, () => {
    assert.equal(customLaserSettings(library(), m60, "lmcp", "cut", 12), null);
    assert.equal(laserSettings(m60, "oak", "cut", 12), null);
    assert.ok(laserSettings(m60, "oak", "cut", 10));
    // la gravure reste possible
    assert.ok(laserSettings(m60, "oak", "engrave", 12));
  });

  test("rien pour cette opération : null", () => {
    assert.equal(customLaserSettings(library(), m60, "lmcp", "engrave", 0), null);
  });
});

test("tes valeurs peuvent remplacer celles d'une matière indicative (chêne)", () => {
  const lib = cleanCustomLibrary({ settings: [value(m60, { materialId: "oak", thickness: 3, speed: 0.25 })] });
  assert.equal(customLaserSettings(lib, m60, "oak", "cut", 3).speed, 0.25);
});
