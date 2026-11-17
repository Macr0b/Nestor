// Machines laser et réglages mémorisés. Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanLaserInput, cleanMachine, activeMachine, DEFAULT_LASER } from "../../src/laser/laser-store.js";

test("machine vérifiée : puissance obligatoire, type et nom nettoyés", () => {
  assert.equal(cleanMachine({ name: "Sans puissance" }), null);
  assert.equal(cleanMachine({ watts: -5 }), null);
  assert.equal(cleanMachine({ watts: 1e9 }), null);
  const m = cleanMachine({ id: "a", name: "  Speedy 360  ", kind: "plasma", watts: 60.04, trotec: "oui" });
  assert.deepEqual(m, { id: "a", name: "Speedy 360", kind: "co2", watts: 60, trotec: false });
});

test("plusieurs machines (60 W et 120 W), machine active gardée", () => {
  const input = cleanLaserInput({
    machines: [
      { id: "s60", name: "Speedy 60", kind: "co2", watts: 60, trotec: true },
      { id: "s120", name: "Speedy 120", kind: "co2", watts: 120, trotec: true }
    ],
    activeId: "s120",
    material: "oak",
    op: "engrave",
    thickness: 5
  });
  assert.equal(input.machines.length, 2);
  assert.equal(activeMachine(input).watts, 120);
  assert.deepEqual([input.material, input.op, input.thickness], ["oak", "engrave", 5]);
});

test("machine active disparue : la première prend sa place", () => {
  const input = cleanLaserInput({ machines: [{ id: "x", watts: 40 }], activeId: "supprimee" });
  assert.equal(input.activeId, "x");
});

test("identifiants en double renouvelés, valeurs inconnues remises par défaut", () => {
  const input = cleanLaserInput({
    machines: [
      { id: "d", watts: 30 },
      { id: "d", watts: 50 }
    ],
    material: "<script>",
    op: "souder",
    thickness: "3"
  });
  assert.notEqual(input.machines[0].id, input.machines[1].id);
  assert.equal(input.material, DEFAULT_LASER.material);
  assert.equal(input.op, "cut");
  assert.equal(input.thickness, DEFAULT_LASER.thickness);
});

test("rien d'enregistré : aucune machine, aucune machine active", () => {
  const input = cleanLaserInput(null);
  assert.deepEqual(input.machines, []);
  assert.equal(activeMachine(input), null);
});
