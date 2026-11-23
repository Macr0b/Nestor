/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Kits nommés : un kit = les pièces d'un même objet (« Boîte », « Étagère »…), posées en kits entiers.
   state.kits = [{ id, name, fill: { row, how } | null, count: nombre de kits | null }] ; une pièce appartient à
   un kit par type.kit = id. Sans remplissage, les pièces d'un kit sont posées comme les autres : une fois leur
   quantité (« Un seul kit »), ou leur quantité × count (« Nombre de kits »). */

// au plus autant de kits demandés
export const MAX_KITS = 5000;

import { state } from "./state.js";

/* kit d'une pièce active, ou null */
export function kitOf(type) {
  if (!type || type.on === false || !type.kit) return null;
  return (
    state.kits.find(function (k) {
      return k.id === type.kit;
    }) || null
  );
}

/* nouvel identifiant, jamais réutilisé dans ce projet */
function newKitId() {
  var used = state.kits.map(function (k) {
    return k.id;
  });
  for (var n = 1; ; n++) if (!used.includes("k" + n)) return "k" + n;
}

export function addKit(name) {
  var kit = { id: newKitId(), name: String(name || "").slice(0, 60), fill: null, count: null };
  state.kits.push(kit);
  return kit;
}

/* supprimer un kit : ses pièces redeviennent des pièces seules */
export function removeKit(id) {
  state.kits = state.kits.filter(function (k) {
    return k.id !== id;
  });
  state.types.forEach(function (t) {
    if (t.kit === id) delete t.kit;
  });
}

/* Nombre de kits demandé, lu dans une saisie : entier de 1 à MAX_KITS ; vide ou invalide → 1. */
export function cleanKitCount(value) {
  var n = Math.floor(Number(value));
  return n >= 1 ? Math.min(n, MAX_KITS) : 1;
}

/* Kits posés comme des pièces seules : 1 (« Un seul kit ») ou le nombre demandé ; un kit qui remplit : 0. */
export function kitCount(kit) {
  if (kit.fill) return 0;
  return kit.count == null ? 1 : cleanKitCount(kit.count);
}

/* Exemplaires d'une pièce à poser avant les remplissages : sa quantité, × le nombre de kits pour une pièce de
   kit (pas de kits pour les pièces d'un kit qui remplit, pas de quantité pour une pièce en « Remplir »). */
export function plannedQty(type) {
  if (!type || type.on === false) return 0;
  var q = Math.floor(Number(type.qty));
  if (!(q > 0)) return 0;
  var kit = kitOf(type);
  return kit ? q * kitCount(kit) : q;
}

/* quantités d'un kit, par indice de pièce (0 pour les pièces hors du kit) */
export function kitRecipe(kit) {
  return state.types.map(function (t) {
    if (kitOf(t) !== kit) return 0;
    var q = Math.floor(Number(t.qty));
    return q > 0 ? q : 0;
  });
}
