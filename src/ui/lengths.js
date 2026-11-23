/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Longueurs à l'écran, dans les unités choisies (mm ou pouces) et la langue en cours : affichage et champs de saisie.
   Les valeurs gardées par l'appli restent en mm (voir src/util/units.js). */

import { languageLocale } from "../i18n/i18n.js";
import { escapeHtml } from "../util/dom.js";
import {
  feedFieldValue,
  formatFeed,
  formatLength,
  lengthFieldValue,
  lengthUnits,
  parseFeed,
  parseLength
} from "../util/units.js";

export function showLength(mm, options) {
  return formatLength(mm, Object.assign({ locale: languageLocale() }, options));
}

/* Grande longueur (total des découpes) : mètres, ou pieds en impérial. */
export function showDistance(mm) {
  const imperial = lengthUnits().system !== "mm";
  const value = imperial ? mm / (12 * 25.4) : mm / 1000;
  return (
    new Intl.NumberFormat(languageLocale(), { maximumFractionDigits: 1 }).format(value) + (imperial ? " ft" : " m")
  );
}

export function showFeed(mmPerMinute) {
  return formatFeed(mmPerMinute, { locale: languageLocale() });
}

// les fractions (« 48 13/16 ») ont besoin d'un champ texte ; sinon un champ nombre
function fractionMode() {
  return lengthUnits().system === "fraction";
}

/* Attributs d'un champ de longueur écrit en HTML : type et valeur selon les unités. */
export function lengthInputAttributes(mm) {
  return (
    (fractionMode() ? 'type="text" inputmode="text"' : 'type="number" inputmode="decimal" step="any"') +
    ' value="' +
    escapeHtml(lengthFieldValue(mm)) +
    '"'
  );
}

/* Remplit un champ de longueur déjà dans la page. */
export function setLengthField(field, mm) {
  field.type = fractionMode() ? "text" : "number";
  field.inputMode = fractionMode() ? "text" : "decimal";
  if (!fractionMode()) field.step = "any";
  field.value = lengthFieldValue(mm);
}

/* Longueur saisie, en mm : "" si le champ est vide, NaN si la saisie est illisible (en cours de frappe). */
export function readLengthField(field) {
  return field.value.trim() === "" ? "" : parseLength(field.value);
}

export function setFeedField(field, mmPerMinute) {
  field.value = feedFieldValue(mmPerMinute);
}

export function readFeedField(field) {
  return field.value.trim() === "" ? "" : parseFeed(field.value);
}
