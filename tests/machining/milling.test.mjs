// Calcul des réglages de fraisage et liste des matières. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../helpers.mjs";
import { millingSettings, vBitCutWidth, DEFAULT_MILLING, TOOL_TYPES } from "../../src/machining/milling.js";
import { FAMILIES, MATERIALS, familyById } from "../../src/machining/materials.js";

const base = (over) => Object.assign({}, DEFAULT_MILLING, over);

describe("Réglages de fraisage (millingSettings)", () => {
  test("exemple de cncfraises.fr : aluminium, fraise 1 dent de 3 mm → 21 200 tr/min", () => {
    const r = millingSettings(base({ family: "hard", diameter: 3, flutes: 1, spindleMax: 30000 }));
    assert.equal(r.rpm, 21200);
    assert.equal(r.feed, Math.round((21200 * 1 * (3 / 250)) / 10) * 10);
    assert.deepEqual(r.notes, []);
  });

  test("copeau le plus fin conseillé par id-conception.fr : fraise de 8 mm, 2 dents", () => {
    const at = (family) => millingSettings(base({ family, diameter: 8, flutes: 2, spindleMax: 30000, feedMax: 0 }));
    // tendre : Ø / 100 → 0,08 mm, 13 900 tr/min → 2 220 mm/min
    assert.deepEqual([at("soft").chipLoad, at("soft").rpm, at("soft").feed], [0.08, 13900, 2220]);
    // très tendre Ø / 25, intermédiaire Ø / 150, dur Ø / 250
    assert.deepEqual(
      ["verySoft", "medium", "hard"].map((f) => at(f).chipDivisor),
      [25, 150, 250]
    );
    assert.equal(at("medium").feed, Math.round((11900 * 2 * (8 / 150)) / 10) * 10);
  });

  test("avance = rotation × dents × copeau (Ø / diviseur de la famille)", () => {
    for (const family of FAMILIES) {
      const r = millingSettings(base({ family: family.id, spindleMin: 0, spindleMax: 100000, feedMax: 0 }));
      assert.equal(r.chipDivisor, family.chipDivisor);
      assert.ok(Math.abs(r.feed - r.rpm * 2 * (6 / family.chipDivisor)) <= 5, family.id);
      assert.equal(r.depth, 6 * family.depthFactor);
    }
  });

  test("plus la matière est dure, plus l'avance et la passe sont faibles", () => {
    const results = FAMILIES.map((f) => millingSettings(base({ family: f.id })));
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i].feed < results[i - 1].feed, FAMILIES[i].id);
      assert.ok(results[i].depth < results[i - 1].depth, FAMILIES[i].id);
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

  test("plastique qui fond : gros copeau (Ø / 50), et conseil 1 dent", () => {
    const r = millingSettings(base({ material: "pmma", flutes: 2 }));
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

  test("fraise conique : largeur de coupe = 2 × profondeur × tan(angle / 2), limitée au diamètre", () => {
    assert.ok(Math.abs(vBitCutWidth(6, 90, 1).width - 2) < 1e-9, "90° à 1 mm : 2 mm");
    assert.ok(Math.abs(vBitCutWidth(6, 60, 1).width - 2 / Math.sqrt(3)) < 1e-6, "60° à 1 mm");
    assert.deepEqual(vBitCutWidth(6, 90, 5), { width: 6, capped: true });
    for (const [angle, depth] of [
      [0, 1],
      [180, 1],
      [NaN, 1],
      [90, 0],
      [90, -1],
      [90, NaN]
    ])
      assert.equal(vBitCutWidth(6, angle, depth), null, `${angle}° / ${depth} mm`);
  });

  test("fraise conique : calcul sur la largeur qui coupe, gravure en une passe, avec explication", () => {
    const v = millingSettings(base({ toolType: "vbit", angle: 90, engraveDepth: 1, spindleMax: 100000, feedMax: 0 }));
    const flat2 = millingSettings(base({ diameter: 2, spindleMax: 100000, feedMax: 0 }));
    assert.equal(v.cutWidth, 2);
    assert.equal(v.rpm, flat2.rpm, "même rotation qu'une fraise de 2 mm");
    assert.equal(v.feed, flat2.feed);
    assert.equal(v.passes, 1);
    assert.equal(v.passDepth, 1);
    assert.equal(v.depth, 1);
    assert.deepEqual(v.notes, [{ key: "mill.noteVBit", e: 1, d: 2 }]);
    // l'épaisseur à couper ne compte pas pour une gravure
    assert.deepEqual(millingSettings(base({ toolType: "vbit", thickness: 40 })).passes, 1);
  });

  test("fraise conique trop enfoncée : largeur limitée au diamètre, avec un message", () => {
    const r = millingSettings(base({ toolType: "vbit", angle: 90, engraveDepth: 10, diameter: 6 }));
    assert.equal(r.cutWidth, 6);
    assert.equal(r.notes[0].key, "mill.noteVBitDeep");
  });

  test("fraise conique sans angle ou sans profondeur : pas de résultat", () => {
    assert.equal(millingSettings(base({ toolType: "vbit", angle: NaN })), null);
    assert.equal(millingSettings(base({ toolType: "vbit", engraveDepth: 0 })), null);
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

  test("bois massifs : classe de dureté A réglée « Tendre », classes B, C et D réglées « Intermédiaire »", () => {
    const woods = MATERIALS.filter((m) => m.hardness);
    assert.ok(woods.length >= 20, "essences de bois");
    for (const m of woods) assert.equal(m.family, m.hardness === "A" ? "soft" : "medium", m.id);
  });

  test("contreplaqués : le bouleau, plus dense, est réglé plus dur que le peuplier et l'okoumé", () => {
    const order = FAMILIES.map((f) => f.id);
    const rank = (id) => order.indexOf(MATERIALS.find((m) => m.id === id).family);
    assert.ok(rank("plyBirch") > rank("plyPoplar"));
    assert.ok(rank("plyBirch") > rank("plyOkoume"));
  });
});
