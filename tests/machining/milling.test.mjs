// Calcul des réglages de fraisage et liste des matières. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../helpers.mjs";
import { millingSettings, DEFAULT_MILLING, TOOL_TYPES } from "../../src/machining/milling.js";
import { FAMILIES, MATERIALS, familyById } from "../../src/machining/materials.js";

const base = (over) => Object.assign({}, DEFAULT_MILLING, over);

describe("Réglages de fraisage (millingSettings)", () => {
  test("exemple de cncfraises.fr : aluminium, fraise 1 dent de 3 mm → 21 200 tr/min", () => {
    const r = millingSettings(base({ family: "hard", diameter: 3, flutes: 1, spindleMax: 30000 }));
    assert.equal(r.rpm, 21200);
    assert.equal(r.feed, Math.round((21200 * 1 * (3 / 200)) / 10) * 10);
    assert.deepEqual(r.notes, []);
  });

  test("avance = rotation × dents × copeau (Ø / diviseur de la famille)", () => {
    for (const family of FAMILIES)
      for (const finishing of [false, true]) {
        const r = millingSettings(
          base({ family: family.id, finishing, spindleMin: 0, spindleMax: 100000, feedMax: 0 })
        );
        const stage = finishing ? 1 : 0;
        assert.equal(r.chipDivisor, family.chipDivisor[stage]);
        assert.ok(Math.abs(r.feed - r.rpm * 2 * (6 / family.chipDivisor[stage])) <= 5, family.id);
        assert.equal(r.depth, 6 * family.depthFactor[stage]);
      }
  });

  test("plus la matière est dure, plus l'avance et la passe sont faibles", () => {
    const results = FAMILIES.map((f) => millingSettings(base({ family: f.id })));
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i].feed < results[i - 1].feed, FAMILIES[i].id);
      assert.ok(results[i].depth < results[i - 1].depth, FAMILIES[i].id);
    }
  });

  test("la finition prend un copeau plus fin et une passe plus faible que l'ébauche", () => {
    for (const family of FAMILIES) {
      const rough = millingSettings(base({ family: family.id }));
      const fine = millingSettings(base({ family: family.id, finishing: true }));
      assert.ok(fine.chipLoad < rough.chipLoad && fine.depth < rough.depth, family.id);
    }
  });

  test("broche trop lente : rotation plafonnée, même copeau, avance réduite, avec un message", () => {
    const free = millingSettings(base({ family: "soft", diameter: 3, spindleMax: 100000 }));
    const capped = millingSettings(base({ family: "soft", diameter: 3, spindleMax: 18000 }));
    assert.ok(free.rpm > 18000);
    assert.equal(capped.rpm, 18000);
    assert.equal(capped.chipLoad, free.chipLoad);
    assert.ok(capped.feed < free.feed);
    assert.deepEqual(capped.notes, [{ key: "mill.noteMax", n: 18000 }]);
  });

  test("grosse fraise sous le minimum de la broche : rotation remontée, avec un message", () => {
    const r = millingSettings(base({ family: "hard", diameter: 20, spindleMin: 6000 }));
    assert.equal(r.rpm, 6000);
    assert.deepEqual(r.notes, [{ key: "mill.noteMin", n: 6000 }]);
  });

  test("machine trop lente en avance : rotation baissée pour garder le copeau, avec un message", () => {
    const free = millingSettings(base({ family: "verySoft", feedMax: 0 }));
    const r = millingSettings(base({ family: "verySoft", feedMax: 4000 }));
    assert.ok(free.feed > 4000);
    assert.ok(r.feed <= 4000 && r.feed > 3500, String(r.feed));
    assert.equal(r.chipLoad, free.chipLoad);
    assert.ok(r.rpm < free.rpm && r.rpm >= DEFAULT_MILLING.spindleMin);
    assert.deepEqual(r.notes, [{ key: "mill.noteFeedMax", n: 4000 }]);
  });

  test("même au minimum de la broche la machine est trop lente : avance plafonnée, copeau plus fin signalé", () => {
    const r = millingSettings(base({ family: "verySoft", feedMax: 1000, spindleMin: 10000 }));
    assert.equal(r.rpm, 10000);
    assert.equal(r.feed, 1000);
    assert.deepEqual(r.notes, [{ key: "mill.noteThinChip", n: 1000 }]);
  });

  test("passes égales sur l'épaisseur, jamais plus profondes que la passe conseillée", () => {
    for (const thickness of [0.5, 3, 18, 19, 40]) {
      const r = millingSettings(base({ thickness }));
      assert.ok(r.passes >= 1);
      assert.ok(r.passDepth <= r.depth + 1e-9);
      assert.ok(Math.abs(r.passDepth * r.passes - thickness) < 1e-9);
      assert.ok(r.passes === 1 || thickness / (r.passes - 1) > r.depth, `${thickness} mm : une passe de trop`);
    }
    assert.equal(millingSettings(base({ thickness: 18 })).passes, 6);
  });

  test("sans épaisseur : pas de nombre de passes", () => {
    const r = millingSettings(base({ thickness: NaN }));
    assert.equal(r.passes, 0);
    assert.ok(r.depth > 0);
  });

  test("diamètre ou dents absents ou faux : pas de résultat", () => {
    for (const bad of [{ diameter: 0 }, { diameter: -3 }, { diameter: NaN }, { flutes: 0 }, { flutes: NaN }])
      assert.equal(millingSettings(base(bad)), null, JSON.stringify(bad));
  });

  test("une matière précise impose sa famille", () => {
    const birch = millingSettings(base({ family: "soft", material: "plyBirch" }));
    const medium = millingSettings(base({ family: "medium" }));
    assert.deepEqual(birch, medium);
  });

  test("plastique qui fond : gros copeau (Ø / 50) même en finition, et conseil 1 dent", () => {
    const r = millingSettings(base({ material: "pmma", finishing: true, flutes: 2 }));
    assert.equal(r.chipDivisor, 50);
    assert.deepEqual(
      r.notes.map((n) => n.key),
      ["mill.noteMelt"]
    );
    const single = millingSettings(base({ material: "pmma", flutes: 1, toolType: "single" }));
    assert.deepEqual(single.notes, []);
  });

  test("conseils selon le type de fraise", () => {
    assert.deepEqual(
      millingSettings(base({ toolType: "downcut" })).notes.map((n) => n.key),
      ["mill.noteDowncut"]
    );
    assert.deepEqual(
      millingSettings(base({ toolType: "compression" })).notes.map((n) => n.key),
      ["mill.noteCompression"]
    );
  });

  test("famille inconnue (réglage abîmé) : la famille intermédiaire, sans planter", () => {
    assert.deepEqual(
      millingSettings(base({ family: "??", material: "??" })),
      millingSettings(base({ family: "medium" }))
    );
  });
});

describe("Matières", () => {
  const fr = JSON.parse(readFileSync(join(ROOT, "src", "i18n", "locales", "fr.json"), "utf8"));

  test("chaque matière a une famille connue, un identifiant unique et un nom traduit", () => {
    const ids = new Set();
    for (const m of MATERIALS) {
      assert.ok(familyById(m.family), m.id);
      assert.ok(!ids.has(m.id), "doublon " + m.id);
      ids.add(m.id);
      assert.ok("mill.mat." + m.id in fr, "nom absent : mill.mat." + m.id);
    }
  });

  test("chaque famille et chaque type de fraise ont leurs textes", () => {
    for (const f of FAMILIES) {
      assert.ok("mill.fam." + f.id in fr, f.id);
      assert.ok("mill.famEx." + f.id in fr, f.id);
    }
    for (const t of TOOL_TYPES) assert.ok("mill.type." + t in fr, t);
  });

  test("contreplaqués : le bouleau, plus dense, est réglé plus dur que le peuplier et l'okoumé", () => {
    const order = FAMILIES.map((f) => f.id);
    const rank = (id) => order.indexOf(MATERIALS.find((m) => m.id === id).family);
    assert.ok(rank("plyBirch") > rank("plyPoplar"));
    assert.ok(rank("plyBirch") > rank("plyOkoume"));
  });
});
