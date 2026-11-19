// Noms des tracés lus dans les données internes d'Illustrator (.ai). Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { aiDisplayName, aiNativePaths, aiNativeText, attachAiNames } from "../../src/import/ai-names.js";

const fixture = async (name) => {
  const b = await readFile(new URL("../fixtures/" + name, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
};
// tracés tels que pdf.js les rend (en mm), dans l'ordre de dessin
const pdfPath = (w, h, x = 0, y = 0) => ({
  closed: true,
  pts: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h]
  ]
});
const SHAPES = [
  [60, 40],
  [30, 30],
  [20, 50],
  [15, 15]
];

describe("Noms des tracés d'un fichier Illustrator", () => {
  test("identifiant Illustrator → nom affiché", () => {
    assert.equal(aiDisplayName("BGM_x5F_110_2_"), "BGM_110");
    assert.equal(aiDisplayName("BGM_x5F_110"), "BGM_110");
    assert.equal(aiDisplayName("Côté_gauche"), "Côté gauche");
    assert.equal(aiDisplayName("Pied_x2F_droit_3_"), "Pied/droit");
    assert.equal(aiDisplayName("_x31_2_x5F_Fond"), "12_Fond");
  });

  for (const [file, how] of [
    ["noms-zstd.ai", "ZStandard (Illustrator 2020 et plus)"],
    ["noms-zlib.ai", "zlib (Illustrator plus ancien)"]
  ])
    test(`données internes en ${how} : chaque tracé reçoit le nom qui le suit, un groupe nomme ses tracés`, async () => {
      const text = await aiNativeText(await fixture(file));
      const native = aiNativePaths(text);
      // « Découpe » est le nom du calque : il ne nomme aucun tracé
      assert.deepEqual(
        native.map((p) => p.name),
        ["Côté gauche", "BGM_12", "Étagère", "Étagère"]
      );
      // tailles en points, comme dans le fichier
      assert.ok(Math.abs(native[0].w - (60 * 72) / 25.4) < 0.01 && Math.abs(native[0].h - (40 * 72) / 25.4) < 0.01);
    });

  test("noms attachés aux tracés lus par pdf.js quand les deux listes se correspondent", async () => {
    const native = aiNativePaths(await aiNativeText(await fixture("noms-zstd.ai")));
    const paths = SHAPES.map(([w, h], i) => pdfPath(w, h, i * 100));
    assert.equal(attachAiNames(paths, native), 4);
    assert.deepEqual(
      paths.map((p) => p.name),
      ["Côté gauche", "BGM_12", "Étagère", "Étagère"]
    );
  });

  test("listes qui ne se correspondent pas : aucun nom (rien ne change par rapport à avant)", async () => {
    const native = aiNativePaths(await aiNativeText(await fixture("noms-zstd.ai")));
    // un tracé de moins
    const fewer = SHAPES.slice(0, 3).map(([w, h]) => pdfPath(w, h));
    assert.equal(attachAiNames(fewer, native), 0);
    assert.ok(fewer.every((p) => !p.name));
    // même nombre, mais d'autres tailles
    const other = SHAPES.map(([w, h]) => pdfPath(h * 3, w));
    assert.equal(attachAiNames(other, native), 0);
    // un nom déjà présent (calque du PDF, texte…) n'est jamais remplacé
    const named = SHAPES.map(([w, h]) => pdfPath(w, h));
    named[1].name = "Déjà nommé";
    attachAiNames(named, native);
    assert.equal(named[1].name, "Déjà nommé");
  });

  test("fichier PDF ou AI sans données internes : rien", async () => {
    assert.equal(await aiNativeText(await fixture("formes.pdf")), "");
    assert.deepEqual(aiNativePaths(""), []);
    assert.equal(attachAiNames([pdfPath(10, 10)], []), 0);
  });
});
