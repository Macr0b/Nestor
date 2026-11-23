// Kits : nombre de kits demandé et exemplaires à poser. Lancement : npm test
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { state } from "../../src/project/state.js";
import { addKit, cleanKitCount, kitCount, plannedQty, removeKit } from "../../src/project/kits.js";

describe("kits", () => {
  beforeEach(() => {
    state.kits = [];
    state.types = [{ qty: 2 }, { qty: 3 }, { qty: 4, on: false }, { qty: "5" }];
  });

  test("nombre de kits lu dans une saisie : 1 à 5000, sinon 1", () => {
    for (const [typed, kept] of [
      ["12", 12],
      [12.8, 12],
      ["0", 1],
      ["-4", 1],
      ["", 1],
      ["abc", 1],
      [9e9, 5000]
    ])
      assert.equal(cleanKitCount(typed), kept, String(typed));
  });

  test("exemplaires à poser : quantité × nombre de kits ; un kit qui remplit n'en pose aucun ici", () => {
    const kit = addKit("Boîte");
    state.types[0].kit = kit.id;
    state.types[1].kit = kit.id;
    assert.equal(kitCount(kit), 1, "« Un seul kit »");
    assert.equal(plannedQty(state.types[0]), 2);
    kit.count = 10;
    assert.equal(plannedQty(state.types[0]), 20);
    assert.equal(plannedQty(state.types[1]), 30);
    assert.equal(plannedQty(state.types[3]), 5, "pièce hors kit : sa quantité");
    assert.equal(plannedQty(state.types[2]), 0, "pièce masquée");
    kit.fill = { row: 0, how: "last" };
    assert.equal(kitCount(kit), 0);
    kit.fill = null;
    kit.count = "abc";
    assert.equal(kitCount(kit), 1);
    state.types[2].kit = kit.id;
    assert.equal(plannedQty(state.types[2]), 0, "pièce masquée, même dans un kit");
    removeKit(kit.id);
    assert.equal(plannedQty(state.types[1]), 3, "kit supprimé : la pièce redevient seule");
  });
});
