/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Raccourcis clavier : quelle touche fait quoi. Les combinaisons avec Ctrl (⌘ sur Mac) marchent partout ;
   « ? » et Alt + chiffre ne font rien pendant la saisie dans un champ. */

// liste affichée dans l'aide, dans cet ordre ; keys : touches à montrer (Mod = Ctrl ou ⌘)
export const SHORTCUTS = [
  { action: "calculate", keys: ["Mod", "Enter"] },
  { action: "tab", keys: ["Alt", "1…6"] },
  { action: "save", keys: ["Mod", "S"] },
  { action: "open", keys: ["Mod", "O"] },
  { action: "import", keys: ["Mod", "I"] },
  { action: "pdf", keys: ["Mod", "P"] },
  { action: "help", keys: ["?"] },
  { action: "close", keys: ["Esc"] }
];

/* Action d'une touche : { action, tab? } ou null. typing : la touche part d'un champ de saisie. */
export function shortcutFor(event, typing) {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && !event.altKey && !event.shiftKey) {
    if (event.key === "Enter") return { action: "calculate" };
    const letter = (event.key || "").toLowerCase();
    if (letter === "s") return { action: "save" };
    if (letter === "o") return { action: "open" };
    if (letter === "i") return { action: "import" };
    if (letter === "p") return { action: "pdf" };
    return null;
  }
  if (typing || mod) return null;
  // Alt + chiffre : code de la touche (sur Mac, Alt + 1 écrit un autre signe)
  const digit = /^Digit([1-9])$/.exec(event.code || "");
  if (event.altKey && digit) return { action: "tab", tab: Number(digit[1]) - 1 };
  if (!event.altKey && event.key === "?") return { action: "help" };
  return null;
}

/* Saisie en cours : champ de texte, liste, zone de texte ou contenu modifiable. */
export function isTyping(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select" || target.isContentEditable) return true;
  if (tag !== "input") return false;
  return !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"].includes(
    (target.type || "text").toLowerCase()
  );
}
