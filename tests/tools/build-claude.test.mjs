// Version Claude (une seule page) : document HTML complet, avec toute l'appli. Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../helpers.mjs";

test("la version Claude est un document HTML complet qui contient les deux onglets et toutes les langues", () => {
  const dir = mkdtempSync(join(tmpdir(), "nestor-claude-"));
  try {
    const out = join(dir, "page.html");
    execFileSync(process.execPath, [join(ROOT, "tools", "build-claude.mjs"), out], { stdio: "pipe" });
    const page = readFileSync(out, "utf8");
    // l'hébergement des pages Claude refuse un morceau de page : doctype, en-tête et corps obligatoires
    assert.match(page, /^<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">/);
    assert.match(page, /<meta name="viewport"/);
    assert.match(page, /<\/head>\n<body>\n/);
    assert.match(page, /<\/body>\n<\/html>\n$/);
    assert.ok(page.includes('id="pageNest"') && page.includes('id="pageMill"'), "les deux onglets");
    assert.ok(page.includes(".mill-families"), "styles du fraisage");
    assert.doesNotMatch(page, /<script type="module"/, "pas de module à charger à part");
    assert.ok(page.includes('"zh-Hant":{'), "toutes les langues dans la page");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
