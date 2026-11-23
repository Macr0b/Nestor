/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Petits outils pour la page : trouver un élément, neutraliser du texte avant de l'insérer en HTML. */

export const byId = function (id) {
  return document.getElementById(id);
};

export function escapeHtml(text) {
  return String(text == null ? "" : text).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
