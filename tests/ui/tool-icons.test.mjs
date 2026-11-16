// Dessins des types de fraise. Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_TYPES } from "../../src/machining/milling.js";
import { DRAWN_TOOL_TYPES, toolIcon } from "../../src/ui/tool-icons.js";

test("chaque type de fraise a son dessin, et aucun dessin ne traîne sans type", () => {
  assert.deepEqual([...DRAWN_TOOL_TYPES].sort(), [...TOOL_TYPES].sort());
  for (const type of TOOL_TYPES) {
    const svg = toolIcon(type);
    assert.match(svg, /^<svg viewBox="0 0 30 48" aria-hidden="true">.+<\/svg>$/, type);
  }
});

test("fraise droite : corps rectangulaire, pas de pointe", () => {
  assert.match(toolIcon("straight"), /<rect x="8" y="20" width="12" height="25"/);
  assert.doesNotMatch(toolIcon("straight"), /l-6 4-6-4z/);
});
