// Tests des traductions : toutes les langues ont les mêmes textes, et les textes utilisés existent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers.mjs";

const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, "i18n.js"), "utf8") + ";this.I18N=I18N", ctx);
const { langs, dict } = ctx.I18N;
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
  const src = ["app.js", "formats.js", "index.html"].map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
  const used = new Set();
  for (const m of src.matchAll(/\bT\(\s*"([\w.]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-[\w-]+)?="([\w.]+)"/g)) used.add(m[1]);
  assert.ok(used.size > 50, `seulement ${used.size} clés trouvées : la recherche est cassée`);
  const unknown = [...used].filter((k) => !(k in dict.fr));
  assert.deepEqual(unknown, []);
});
