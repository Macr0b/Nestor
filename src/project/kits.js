/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Kits nommés : un kit = les pièces d'un même objet (« Boîte », « Étagère »…), posées en kits entiers.
   state.kits = [{ id, name, fill: { row, how } | null }] ; une pièce appartient à un kit par type.kit = id.
   Sans remplissage, les pièces d'un kit sont posées une fois (leur quantité), comme les autres. */

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
  var kit = { id: newKitId(), name: String(name || "").slice(0, 60), fill: null };
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

/* quantités d'un kit, par indice de pièce (0 pour les pièces hors du kit) */
export function kitRecipe(kit) {
  return state.types.map(function (t) {
    if (kitOf(t) !== kit) return 0;
    var q = Math.floor(Number(t.qty));
    return q > 0 ? q : 0;
  });
}
