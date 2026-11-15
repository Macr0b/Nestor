// Tests des traductions : toutes les langues ont les mêmes textes, et les textes utilisés existent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../helpers.mjs";
import { LANGUAGES } from "../../src/i18n/languages.js";

// un fichier de textes par langue : src/i18n/locales/<code>.json
const langs = LANGUAGES;
const dict = Object.fromEntries(
  langs.map((l) => [l.code, JSON.parse(readFileSync(join(ROOT, "src", "i18n", "locales", l.code + ".json"), "utf8"))])
);

test("chaque fichier de langue correspond à une langue de la liste, et inversement", () => {
  const files = readdirSync(join(ROOT, "src", "i18n", "locales")).map((f) => f.replace(/\.json$/, ""));
  assert.deepEqual(files.sort(), langs.map((l) => l.code).sort());
});
const ref = Object.keys(dict.fr).sort();

test("chaque langue a exactement les mêmes clés que le français", () => {
  for (const l of langs) {
    const keys = Object.keys(dict[l.code] || {}).sort();
    const missing = ref.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !ref.includes(k));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, l.code);
  }
});

test("les marqueurs {n}, {w}… sont conservés dans chaque traduction", () => {
  for (const l of langs)
    for (const k of ref) {
      const want = (dict.fr[k].match(/\{\w+\}/g) || []).sort().join();
      const got = (dict[l.code][k].match(/\{\w+\}/g) || []).sort().join();
      assert.equal(got, want, `${l.code} / ${k}`);
    }
});

test("les clés appelées dans le code et la page existent", () => {
  // tout le code de l'appli (src/) et la page
  const files = readdirSync(join(ROOT, "src"), { recursive: true }).filter((f) => f.endsWith(".js"));
  const src = files
    .map((f) => readFileSync(join(ROOT, "src", f), "utf8"))
    .concat(readFileSync(join(ROOT, "index.html"), "utf8"))
    .join("\n");
  const used = new Set();
  for (const m of src.matchAll(/\btranslate\(\s*"([\w.]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-[\w-]+)?="([\w.]+)"/g)) used.add(m[1]);
  assert.ok(used.size > 50, `seulement ${used.size} clés trouvées : la recherche est cassée`);
  const unknown = [...used].filter((k) => !(k in dict.fr));
  assert.deepEqual(unknown, []);
});
