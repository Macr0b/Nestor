/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Case de résultat (libellé, grande valeur, unité) partagée par les onglets Fraisage et Laser. */

import { languageLocale } from "../i18n/i18n.js";
import { escapeHtml } from "../util/dom.js";

export function formatValue(value, digits) {
  return new Intl.NumberFormat(languageLocale(), { maximumFractionDigits: digits }).format(value);
}

export function valueBox(label, value, unit) {
  return (
    "<div><small>" +
    escapeHtml(label) +
    "</small><b>" +
    escapeHtml(value) +
    "</b><em>" +
    escapeHtml(unit) +
    "</em></div>"
  );
}
