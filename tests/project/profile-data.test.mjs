// Profil Nestor : construit, relu et vérifié, résumé, mêlé aux réglages déjà là. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildProfile,
  datedProfileName,
  PROFILE_KEYS,
  profileSummary,
  readProfile,
  settingsToWrite
} from "../../src/project/profile-data.js";
import { takeSnapshot } from "../../src/project/project-snapshot.js";
import { createExampleProject } from "../../src/project/example.js";

// projet d'exemple renommé, photographié comme à l'enregistrement
const snap = (name) => {
  const p = createExampleProject();
  p.name = name;
  p.example = false;
  p.types[0].qty = 3;
  return takeSnapshot(p, { exportOptions: {}, material: "", milling: {}, laser: {}, cost: {} });
};

const settings = {
  preferences: JSON.stringify({ gap: 3 }),
  language: "de",
  theme: "dark",
  units: JSON.stringify({ system: "mm" }),
  stats: "off",
  library: JSON.stringify([
    { id: "a", name: "CP 18" },
    { id: "b", name: "MDF 10" }
  ]),
  projectMaterial: "a",
  notebook: JSON.stringify([{ id: "n1" }]),
  laser: JSON.stringify({ machines: [{ id: "m1", watts: 60 }], activeId: "m1" }),
  laserMaterials: JSON.stringify({ materials: [{ id: "lm1", name: "Liège" }], settings: [] }),
  milling: JSON.stringify({ tool: 6 }),
  cost: JSON.stringify({ rate: 50 })
};

describe("profil Nestor", () => {
  test("aller-retour : réglages, projets et projet en cours relus à l'identique", () => {
    const profile = buildProfile(
      settings,
      [{ entry: { name: "Boîte", savedAt: 5 }, snapshot: snap("Boîte") }],
      snap("En cours"),
      "1.10.1",
      1000
    );
    const back = readProfile(JSON.stringify(profile));
    assert.deepEqual(back.settings, settings);
    assert.equal(back.savedAt, 1000);
    assert.equal(back.appVersion, "1.10.1");
    assert.equal(back.projects.length, 1);
    assert.equal(back.projects[0].name, "Boîte");
    assert.equal(back.projects[0].savedAt, 5);
    assert.equal(back.projects[0].snapshot.types[0].qty, 3);
    assert.equal(back.current.name, "En cours");
    assert.deepEqual(profileSummary(back), { projects: 2, materials: 2, notes: 1, machines: 1, laserMaterials: 1 });
  });

  test("tout réglage connu a sa clé dans le navigateur", () => {
    assert.equal(Object.keys(PROFILE_KEYS).length, 13);
    for (const key of Object.values(PROFILE_KEYS)) assert.match(key, /^(nestor|plancoupe)\./);
  });

  test("fichier qui n'est pas un profil : refusé", () => {
    for (const text of [
      "",
      "{",
      "[]",
      "null",
      '{"app":"Nestor","kind":"projet","version":1}',
      '{"app":"Autre","kind":"profil","version":1}',
      '{"app":"Nestor","kind":"profil","version":2}',
      42
    ])
      assert.throws(() => readProfile(text), String(text));
  });

  test("réglages abîmés ou dangereux écartés, réglages inconnus ignorés", () => {
    const raw = buildProfile({}, [], null, "1", 1);
    raw.settings = {
      language: "<script>",
      theme: "rose",
      stats: "on",
      projectMaterial: "../../x",
      library: "{pas du json",
      notebook: 12,
      milling: JSON.stringify({ ok: 1 }),
      inconnu: "x",
      __proto__: { polluted: true }
    };
    const back = readProfile(JSON.stringify(raw));
    assert.deepEqual(back.settings, { milling: '{"ok":1}' });
    assert.equal({}.polluted, undefined);
  });

  test("projets abîmés écartés, les bons gardés ; profil vide accepté", () => {
    const raw = buildProfile({}, [{ entry: { name: "Bon", savedAt: 1 }, snapshot: snap("Bon") }], null, "1", 1);
    raw.projects.push({ name: "Faux", snapshot: { app: "Autre" } }, null, "texte", { name: "Sans contenu" });
    raw.current = { snapshot: { app: "Nestor", kind: "rien" } };
    const back = readProfile(JSON.stringify(raw));
    assert.deepEqual(
      back.projects.map((p) => p.name),
      ["Bon"]
    );
    assert.equal(back.current, null);
    const empty = readProfile(JSON.stringify({ app: "Nestor", kind: "profil", version: 1 }));
    assert.deepEqual(empty.settings, {});
    assert.deepEqual(empty.projects, []);
    assert.deepEqual(profileSummary(empty), { projects: 0, materials: 0, notes: 0, machines: 0, laserMaterials: 0 });
  });

  test("« Ajouter » : matières, carnet, machines et matières laser mêlés ; autres réglages gardés", () => {
    const mine = {
      theme: "light",
      library: JSON.stringify([
        { id: "a", name: "ancien" },
        { id: "z", name: "à moi" }
      ]),
      laser: JSON.stringify({ machines: [{ id: "m0", watts: 40 }], activeId: "m0", op: "cut" })
    };
    const out = settingsToWrite(mine, settings, "add");
    assert.deepEqual(Object.keys(out).sort(), ["laser", "laserMaterials", "library", "notebook"]);
    assert.deepEqual(
      JSON.parse(out.library).map((x) => x.id + ":" + x.name),
      ["a:CP 18", "z:à moi", "b:MDF 10"]
    );
    const laser = JSON.parse(out.laser);
    assert.deepEqual(
      laser.machines.map((m) => m.id),
      ["m0", "m1"]
    );
    assert.equal(laser.activeId, "m0", "la machine active de l'appareil reste");
    assert.equal(out.notebook, settings.notebook, "rien ici : celui du profil");
    assert.deepEqual(JSON.parse(out.laserMaterials).materials.length, 1);
  });

  test("« Tout remplacer » : les réglages du profil, tels quels", () => {
    assert.deepEqual(settingsToWrite({ theme: "light", cost: "{}" }, settings, "replace"), settings);
  });

  test("nom daté du fichier", () => {
    assert.equal(datedProfileName(new Date(2026, 10, 3, 12)), "Profil Nestor 2026-11-03.nestorprofil");
  });
});
