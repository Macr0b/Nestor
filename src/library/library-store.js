/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Bibliothèque de matières : panneaux achetés (nom, matière de fraisage liée, épaisseur, taille, prix), gardée sur
   l'appareil, et la matière choisie pour le projet en cours, partagée par les onglets Imbrication, Fraisage et Coût.
   Chaque matière est vérifiée champ par champ à la lecture et à l'import. Longueurs en mm, prix dans la monnaie choisie. */

import { materialById } from "../machining/materials.js";

const LIBRARY_KEY = "nestor.matieres.v1";
const PROJECT_KEY = "nestor.matiere-projet";
export const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_ITEMS = 500;

function text(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function positive(value) {
  return typeof value === "number" && isFinite(value) && value > 0 ? value : null;
}

export function newItemId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Matière relue et vérifiée ; null si elle n'a ni nom ni matière de fraisage. */
export function cleanItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const item = {
    id: typeof raw.id === "string" && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : newItemId(),
    name: text(raw.name, 80).trim(),
    millMaterial: materialById(raw.millMaterial) ? raw.millMaterial : "",
    thickness: positive(raw.thickness),
    L: positive(raw.L),
    W: positive(raw.W),
    price: typeof raw.price === "number" && isFinite(raw.price) && raw.price >= 0 ? raw.price : null
  };
  return item.name || item.millMaterial ? item : null;
}

export function sortItems(items) {
  return items.sort(function (a, b) {
    const byName = (a.name || a.millMaterial).localeCompare(b.name || b.millMaterial);
    return byName || (a.thickness || 0) - (b.thickness || 0);
  });
}

export function cleanItems(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const items = [];
  for (const raw of list.slice(0, MAX_ITEMS)) {
    const item = cleanItem(raw);
    if (!item) continue;
    if (seen.has(item.id)) item.id = newItemId();
    seen.add(item.id);
    items.push(item);
  }
  return sortItems(items);
}

export function loadItems() {
  try {
    return cleanItems(JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]"));
  } catch (e) {
    return [];
  }
}

export function saveItems(items) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    return false;
  }
}

/* Prix au mm² (null sans prix ou sans taille). */
export function pricePerArea(item) {
  return item && item.price != null && item.L && item.W ? item.price / (item.L * item.W) : null;
}

/* Prix d'un panneau de L × W avec cette matière : prix de la bibliothèque si c'est la même taille (dans un sens
   ou dans l'autre), sinon au prorata de la surface. Retour : { price, prorata } ou null. */
export function panelPrice(item, L, W) {
  const perArea = pricePerArea(item);
  if (perArea == null || !(L > 0) || !(W > 0)) return null;
  const same = (a, b) => Math.abs(a - b) < 0.5;
  if ((same(L, item.L) && same(W, item.W)) || (same(L, item.W) && same(W, item.L)))
    return { price: item.price, prorata: false };
  return { price: perArea * L * W, prorata: true };
}

/* Matière de la bibliothèque qui correspond à une matière de fraisage et une épaisseur (à 0,05 mm près). */
export function findItem(items, millMaterial, thickness) {
  if (!millMaterial) return null;
  return (
    items.find(function (item) {
      return (
        item.millMaterial === millMaterial && item.thickness != null && Math.abs(item.thickness - thickness) < 0.05
      );
    }) || null
  );
}

export function exportLibrary(items) {
  return JSON.stringify({ app: "Nestor", kind: "matieres", version: 1, items: items }, null, 2);
}

/* Import : matières ajoutées (même identifiant : remplacée). Lève une erreur si ce n'est pas une bibliothèque Nestor. */
export function importLibrary(existing, fileText) {
  if (typeof fileText !== "string" || fileText.length > MAX_IMPORT_BYTES) throw new Error("trop gros");
  const data = JSON.parse(fileText);
  if (!data || data.app !== "Nestor" || data.kind !== "matieres") throw new Error("pas une bibliothèque Nestor");
  const incoming = cleanItems(data.items);
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return { items: sortItems(Array.from(byId.values()).slice(0, MAX_ITEMS)), added: incoming.length };
}

/* ---- matière du projet en cours, partagée entre les onglets ---- */

let projectItemId = (function () {
  try {
    return localStorage.getItem(PROJECT_KEY) || "";
  } catch (e) {
    return "";
  }
})();
const listeners = [];

export function projectMaterialId() {
  return projectItemId;
}

/* Change la matière du projet et prévient les onglets abonnés (sauf celui qui a fait le changement). */
export function setProjectMaterial(id, source) {
  if (id === projectItemId) return;
  projectItemId = id || "";
  try {
    localStorage.setItem(PROJECT_KEY, projectItemId);
  } catch (e) {}
  for (const listener of listeners) if (listener.source !== source) listener.callback(projectItemId);
}

export function onProjectMaterialChange(source, callback) {
  listeners.push({ source: source, callback: callback });
}
