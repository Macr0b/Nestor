// Bibliothèque de matières et coût d'un plan. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleanItem,
  cleanItems,
  panelPrice,
  pricePerArea,
  findItem,
  exportLibrary,
  importLibrary,
  setProjectMaterial,
  onProjectMaterialChange,
  projectMaterialId
} from "../../src/library/library-store.js";
import { planCost, costPerPart } from "../../src/library/plan-cost.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const poplar = {
  id: "p18",
  name: "CP peuplier",
  millMaterial: "plyPoplar",
  thickness: 18,
  L: 2500,
  W: 1220,
  price: 42
};
const birch = { id: "b18", name: "CP bouleau", millMaterial: "plyBirch", thickness: 18, L: 2500, W: 1250, price: 89 };

describe("Bibliothèque de matières", () => {
  test("matière vérifiée : types corrigés, matière de fraisage inconnue retirée", () => {
    const item = cleanItem({
      name: "x".repeat(200),
      millMaterial: "kryptonite",
      thickness: "18",
      L: -5,
      W: 1220,
      price: Infinity
    });
    assert.equal(item.name.length, 80);
    assert.equal(item.millMaterial, "");
    assert.equal(item.thickness, null);
    assert.equal(item.L, null);
    assert.equal(item.price, null);
    assert.equal(cleanItem({ name: "  " }), null, "ni nom ni matière : refusée");
    assert.equal(cleanItem({ millMaterial: "mdf" }).millMaterial, "mdf");
  });

  test("prix d'un panneau : celui de la bibliothèque à la même taille (dans les deux sens), sinon au m²", () => {
    assert.deepEqual(panelPrice(poplar, 2500, 1220), { price: 42, prorata: false });
    assert.deepEqual(panelPrice(poplar, 1220, 2500), { price: 42, prorata: false });
    const part = panelPrice(poplar, 1250, 1220);
    near(part.price, 21);
    assert.equal(part.prorata, true);
    near(pricePerArea(poplar) * 1e6, 42 / 3.05);
    assert.equal(panelPrice({ ...poplar, price: null }, 2500, 1220), null);
  });

  test("lien avec le fraisage : matière et épaisseur retrouvent la bonne matière de la bibliothèque", () => {
    const items = cleanItems([poplar, birch]);
    assert.equal(findItem(items, "plyBirch", 18).id, "b18");
    assert.equal(findItem(items, "plyPoplar", 18.02).id, "p18");
    assert.equal(findItem(items, "plyPoplar", 15), null);
    assert.equal(findItem(items, "", 18), null);
  });

  test("sauvegarde puis import, et refus d'un fichier étranger", () => {
    const items = cleanItems([poplar, birch]);
    assert.deepEqual(importLibrary([], exportLibrary(items)).items, items);
    assert.throws(
      () => importLibrary([], JSON.stringify({ app: "Nestor", kind: "carnet", entries: [] })),
      /pas une bibliothèque/
    );
    assert.throws(() => importLibrary([], "{"));
  });

  test("matière du projet : les autres onglets sont prévenus, pas celui qui l'a changée", () => {
    const seen = [];
    onProjectMaterialChange("cost", (id) => seen.push("cost:" + id));
    onProjectMaterialChange("milling", (id) => seen.push("milling:" + id));
    setProjectMaterial("p18", "milling");
    assert.equal(projectMaterialId(), "p18");
    assert.deepEqual(seen, ["cost:p18"]);
    setProjectMaterial("p18", "cost");
    assert.equal(seen.length, 1, "même matière : personne n'est prévenu");
  });
});

describe("Coût d'un plan", () => {
  const sheets = [
    { L: 2500, W: 1220, area: 2500000, extent: { w: 2500, h: 1220 } },
    { L: 2500, W: 1220, area: 610000, extent: { w: 1000, h: 1220 } }
  ];
  const price = (L, W) => panelPrice(poplar, L, W)?.price ?? null;

  test("matière, chute, machine (temps de découpe) et main-d'œuvre (temps de préparation)", () => {
    const c = planCost(sheets, price, { lastSheet: "full", rate: 45, laborRate: 36, prepMinutes: 15, cutMinutes: 45 });
    near(c.material, 84);
    near(c.wasteShare, 1 - 3110000 / 6100000);
    near(c.waste, 84 * c.wasteShare);
    near(c.machine, 33.75);
    near(c.labor, 9);
    near(c.total, 84 + 33.75 + 9);
    assert.deepEqual(c.machineTime, { minutes: 45, billed: 45 });
    assert.equal(c.missingPrice, false);
  });

  test("toute heure commencée : chacun sa case, une heure pile reste une heure", () => {
    const c = planCost(sheets, price, {
      rate: 45,
      laborRate: 36,
      cutMinutes: 68,
      prepMinutes: 15,
      roundMachine: true
    });
    assert.deepEqual(c.machineTime, { minutes: 68, billed: 120 });
    near(c.machine, 90);
    assert.deepEqual(c.laborTime, { minutes: 15, billed: 15 });
    near(c.labor, 9);
    const d = planCost(sheets, price, { rate: 45, laborRate: 36, cutMinutes: 60, prepMinutes: 15, roundLabor: true });
    assert.deepEqual(d.machineTime, { minutes: 60, billed: 60 });
    assert.deepEqual(d.laborTime, { minutes: 15, billed: 60 });
    near(d.labor, 36);
    // pas de temps : rien à arrondir
    const e = planCost(sheets, price, { rate: 45, roundMachine: true, roundLabor: true });
    assert.equal(e.machine, 0);
    assert.equal(e.labor, 0);
  });

  test("dernier panneau compté seulement pour la partie utilisée", () => {
    const c = planCost(sheets, price, { lastSheet: "used" });
    near(c.material, 42 + 42 * (1000 / 2500));
    near(c.wasteShare, 1 - 3110000 / (3050000 + 1000 * 1220));
  });

  test("prix manquant signalé, et sans temps ni taux : pas de coût machine", () => {
    const c = planCost(sheets, () => null, {});
    assert.equal(c.missingPrice, true);
    assert.equal(c.material, 0);
    assert.equal(c.machine, 0);
    assert.equal(c.labor, 0);
  });

  test("réparti sur les pièces au prorata de leur surface", () => {
    const parts = costPerPart(
      [
        { key: "a", area: 300, count: 2 },
        { key: "b", area: 400, count: 1 }
      ],
      100
    );
    near(parts[0].unit, 30);
    near(parts[0].total, 60);
    near(parts[1].total, 40);
  });
});
