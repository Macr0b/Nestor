// Règles de rangement du code, vérifiées automatiquement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";

const sources = readdirSync(join(ROOT, "src"), { recursive: true })
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({ name: "src/" + f.split("\\").join("/"), text: readFileSync(join(ROOT, "src", f), "utf8") }));

test("chaque fichier de code commence par la licence puis une description de son rôle", () => {
  for (const { name, text } of sources) {
    const lines = text.split("\n");
    assert.match(
      lines[0],
      /^\/\* Nestor — Copyright 2026 Robin Philippe \(Macr0b\) — PolyForm Perimeter/,
      `${name} : licence absente`
    );
    assert.match(lines[1], /^\/\* \S/, `${name} : description du rôle du fichier absente`);
  }
});

test("pas de nom de fonction d'une ou deux lettres au premier niveau d'un module", () => {
  for (const { name, text } of sources)
    for (const m of text.matchAll(/^(?:export )?(?:async )?function (\w+)\(/gm))
      assert.ok(m[1].length > 2, `${name} : fonction « ${m[1]} » au nom trop court`);
});

test("plus de variables globales de l'ancienne version (Geo, Formats, I18N)", () => {
  for (const { name, text } of sources) assert.doesNotMatch(text, /\b(Geo|Formats|I18N)\./, name);
});
