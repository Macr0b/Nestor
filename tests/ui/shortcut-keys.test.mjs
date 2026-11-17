// Raccourcis clavier : quelle touche fait quoi. Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { shortcutFor, isTyping, SHORTCUTS } from "../../src/ui/shortcut-keys.js";

const key = (k, extra = {}) =>
  Object.assign({ key: k, code: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, extra);

test("Ctrl et ⌘ : mêmes raccourcis, même pendant la saisie", () => {
  for (const mod of [{ ctrlKey: true }, { metaKey: true }])
    for (const typing of [false, true]) {
      assert.deepEqual(shortcutFor(key("Enter", mod), typing), { action: "calculate" });
      assert.deepEqual(shortcutFor(key("s", mod), typing), { action: "save" });
      assert.deepEqual(shortcutFor(key("S", mod), typing), { action: "save" });
      assert.deepEqual(shortcutFor(key("o", mod), typing), { action: "open" });
      assert.deepEqual(shortcutFor(key("i", mod), typing), { action: "import" });
      assert.deepEqual(shortcutFor(key("p", mod), typing), { action: "pdf" });
    }
});

test("copier, coller, annuler restent ceux du navigateur", () => {
  for (const k of ["c", "v", "x", "z", "a", "f"]) assert.equal(shortcutFor(key(k, { ctrlKey: true }), false), null);
  assert.equal(shortcutFor(key("s", { ctrlKey: true, shiftKey: true }), false), null);
});

test("Alt + chiffre : onglet, d'après la touche et non le signe écrit (Mac)", () => {
  assert.deepEqual(shortcutFor(key("¡", { altKey: true, code: "Digit1" }), false), { action: "tab", tab: 0 });
  assert.deepEqual(shortcutFor(key("6", { altKey: true, code: "Digit6" }), false), { action: "tab", tab: 5 });
  assert.equal(shortcutFor(key("1", { altKey: true, code: "Digit1" }), true), null);
  assert.equal(shortcutFor(key("1", { code: "Digit1" }), false), null);
});

test("? : aide, sauf pendant la saisie", () => {
  assert.deepEqual(shortcutFor(key("?", { shiftKey: true }), false), { action: "help" });
  assert.equal(shortcutFor(key("?", { shiftKey: true }), true), null);
});

test("saisie : champs de texte oui, cases à cocher et boutons non", () => {
  const el = (tagName, type) => ({ tagName, type });
  assert.ok(isTyping(el("INPUT", "text")));
  assert.ok(isTyping(el("INPUT", "number")));
  assert.ok(isTyping(el("INPUT", "search")));
  assert.ok(isTyping(el("TEXTAREA")));
  assert.ok(isTyping(el("SELECT")));
  assert.ok(isTyping({ tagName: "DIV", isContentEditable: true }));
  assert.ok(!isTyping(el("INPUT", "checkbox")));
  assert.ok(!isTyping(el("BUTTON")));
  assert.ok(!isTyping(null));
});

test("chaque raccourci a ses touches à afficher", () => {
  assert.equal(new Set(SHORTCUTS.map((s) => s.action)).size, SHORTCUTS.length);
  for (const s of SHORTCUTS) assert.ok(s.keys.length >= 1);
});
