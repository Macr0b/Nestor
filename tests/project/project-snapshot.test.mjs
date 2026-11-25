// Projets enregistrés : photo complète, relecture vérifiée, fichier à partager. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  takeSnapshot,
  cleanSnapshot,
  exportProject,
  importProject,
  snapshotSummary,
  bytesToBase64,
  base64ToBytes,
  MAX_PROJECT_BYTES
} from "../../src/project/project-snapshot.js";
import { createExampleProject } from "../../src/project/example.js";

const extras = {
  exportOptions: {
    includeBoard: true,
    offcutMode: "detail",
    partNumbers: true,
    partNames: true,
    pdfLayers: true,
    sawOrder: true,
    sawFirst: "across",
    sawKerf: 3.2
  },
  material: "p18",
  milling: { toolType: "upcut", diameter: 6, material: "plyPoplar", thickness: 18 },
  laser: { material: "oak", op: "cut", thickness: 3 },
  cost: { currency: "EUR", rate: 60, prices: { "2500x1220": 42 } }
};

function project() {
  const p = createExampleProject();
  p.name = "Étagère";
  p.example = false;
  p.files = [
    { id: 3, name: "etagere.dxf", data: new TextEncoder().encode("0\nSECTION\n").buffer, info: { units: "mm" } }
  ];
  p.sheet = { panels: [{ L: 2500, W: 1220, qty: 2, origin: "bl" }], gap: 12, margin: 10, mode: "nest" };
  p.types[0].qty = 3;
  p.types[0].scale = "50";
  p.types[1].rot = "free";
  p.types[2].on = false;
  p.types[3].rot = "free1";
  p.types[0].turn = 3;
  p.types[0].kit = "k2";
  p.types[1].kit = "k2";
  p.kits = [
    { id: "k1", name: "Boîte", fill: null, count: 12 },
    { id: "k2", name: "Étagère", fill: { row: 0, how: "new" }, count: null }
  ];
  p.rotAll = "free1";
  p.sort = "name";
  return p;
}

describe("photo du projet", () => {
  test("kits : projet de la 1.9.9 (case « Kit ») converti ; kit inconnu ou mal formé écarté", () => {
    const old = takeSnapshot(project(), extras);
    old.kits = undefined;
    old.kitFill = { row: 0, how: "last" };
    old.types[0].kit = true;
    old.types[1].kit = true;
    old.types[2].kit = "k9";
    const back = importProject(JSON.stringify(old));
    assert.deepEqual(back.kits, [{ id: "k1", name: "", fill: { row: 0, how: "last" }, count: null }]);
    assert.equal(back.types[0].kit, "k1");
    assert.equal(back.types[1].kit, "k1");
    assert.equal(back.types[2].kit, undefined, "kit absent : pièce seule");
    assert.equal(back.kitFill, undefined);
    const bad = takeSnapshot(project(), extras);
    bad.kits = [
      { id: "k1", name: "x".repeat(500), fill: { row: -3, how: "all" } },
      { id: "k1", name: "doublon" },
      { id: "<b>", name: "pirate" },
      "pas un objet"
    ];
    const clean = importProject(JSON.stringify(bad)).kits;
    assert.equal(clean.length, 1);
    assert.equal(clean[0].name.length, 60);
    assert.equal(clean[0].count, null, "pas de nombre : « Un seul kit »");
    // nombre de kits : entier de 1 à 5000, sinon « Un seul kit »
    for (const [count, kept] of [
      [7, 7],
      ["7", 7],
      [7.9, 7],
      [0, null],
      [-2, null],
      [99999, 5000],
      ["abc", null],
      [null, null]
    ]) {
      const one = takeSnapshot(project(), extras);
      one.kits = [{ id: "k1", name: "Boîte", fill: null, count }];
      assert.equal(importProject(JSON.stringify(one)).kits[0].count, kept, String(count));
    }
  });

  test("aller-retour par le fichier : rien ne se perd", () => {
    const snap = takeSnapshot(project(), extras);
    const back = importProject(exportProject(snap));
    assert.deepEqual(back, snap);
    assert.equal(back.name, "Étagère");
    assert.deepEqual(back.sheet.panels[0], { L: 2500, W: 1220, qty: 2, origin: "bl" });
    assert.equal(back.types[0].qty, 3);
    assert.equal(back.types[0].scale, "50");
    assert.equal(back.types[1].rot, "free");
    assert.equal(back.types[3].rot, "free1");
    assert.deepEqual(back.kits, project().kits);
    assert.equal(back.types[1].kit, "k2");
    assert.equal(back.types[0].turn, 3);
    assert.equal(back.rotAll, "free1");
    assert.equal(back.types[2].on, false);
    assert.equal(back.types[0].nameKey, "ex.facade");
    assert.deepEqual(back.exportOptions, extras.exportOptions);
    assert.equal(back.material, "p18");
    assert.equal(back.milling.material, "plyPoplar");
    assert.equal(back.laser.material, "oak");
    assert.equal(back.cost.prices["2500x1220"], 42);
  });

  test("fichiers importés gardés à l'octet près (base64)", () => {
    const bytes = new Uint8Array(70000).map((_, i) => (i * 7) % 256);
    assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
    const snap = takeSnapshot(project(), extras);
    assert.equal(new TextDecoder().decode(base64ToBytes(snap.files[0].data)), "0\nSECTION\n");
  });

  test("résumé : pièces actives et panneaux", () => {
    const snap = takeSnapshot(project(), extras);
    // exemple : 2 façades (3 ici), 2 équerres, 4 disques (désactivés), 6 taquets
    assert.deepEqual(snapshotSummary(snap), { parts: 3 + 2 + 6, panels: 1 });
  });
});

describe("relecture vérifiée", () => {
  test("pas un projet Nestor : refusé", () => {
    assert.throws(() => cleanSnapshot({ app: "Autre" }));
    assert.throws(() => importProject("[]"));
    assert.throws(() => importProject("x".repeat(MAX_PROJECT_BYTES + 1)));
  });

  test("valeurs trafiquées remises en ordre", () => {
    const snap = cleanSnapshot({
      app: "Nestor",
      kind: "projet",
      name: { toString: "piège" },
      files: [{ id: 1, name: "a.svg", data: "<script>" }],
      sheet: { panels: [{ L: "2500", W: -3, qty: "beaucoup", origin: "zz" }], gap: "12", mode: "autre" },
      types: [
        {
          name: "ok",
          qty: 2.7,
          rot: "oui",
          paths: [
            {
              pts: [
                [0, 0],
                [10, 0],
                [10, NaN],
                ["a", 1],
                [0, 10]
              ],
              closed: true,
              color: "red"
            }
          ]
        },
        { name: "sans tracé", paths: [] },
        {
          name: "nameKey inconnu",
          nameKey: "<b>",
          paths: [
            {
              pts: [
                [0, 0],
                [1, 1]
              ]
            }
          ]
        }
      ],
      material: "../../etc",
      milling: { "a b": 1, ok: 2, deep: { deeper: { x: 1 } } },
      rotAll: "n'importe"
    });
    assert.equal(snap.name, "");
    assert.equal(snap.files.length, 0);
    assert.deepEqual(snap.sheet.panels[0], { L: 600, W: 400, qty: 0 });
    assert.equal(snap.sheet.gap, 2);
    assert.equal(snap.sheet.mode, "nest");
    assert.equal(snap.types.length, 2);
    assert.equal(snap.types[0].qty, 2);
    assert.equal(snap.types[0].rot, false);
    assert.deepEqual(snap.types[0].paths[0].pts, [
      [0, 0],
      [10, 0],
      [0, 10]
    ]);
    assert.equal(snap.types[0].paths[0].color, "");
    assert.equal(snap.types[1].nameKey, undefined);
    assert.equal(snap.material, "");
    assert.deepEqual(snap.milling, { ok: 2, deep: {} });
    assert.equal(snap.rotAll, "quarter");
  });

  test("fichier importé : sa fiche garde la taille du dessin (sinon le projet ne se rouvrait pas)", () => {
    const snap = cleanSnapshot({
      app: "Nestor",
      kind: "projet",
      files: [
        { id: 1, name: "a.dxf", data: "", info: { kind: "DXF", size: [190, 90.5], n: 2, how: "how.dxf", bad: [{}] } }
      ],
      types: []
    });
    assert.deepEqual(snap.files[0].info, { kind: "DXF", size: [190, 90.5], n: 2, how: "how.dxf" });
  });
});
