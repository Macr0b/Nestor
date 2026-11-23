/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Pièces saisies à la main : rectangles de longueur × largeur, et lignes collées depuis un tableur.
   La longueur suit la flèche ↑ des panneaux (hauteur de la pièce), la largeur la flèche → (sa largeur). */

import { parseLength } from "../util/units.js";

const MAX_MANUAL_QTY = 100000;

function rectanglePaths(width, length) {
  return [
    {
      closed: true,
      layer: "",
      color: "",
      pts: [
        [0, 0],
        [width, 0],
        [width, length],
        [0, length]
      ]
    }
  ];
}

/* Nouvelle pièce : { name, length, width, qty, fixed } en mm. Rend null si une cote manque ou est nulle. */
export function newManualPart(entry) {
  const length = Number(entry.length),
    width = Number(entry.width);
  if (!(length > 0) || !(width > 0) || !isFinite(length) || !isFinite(width)) return null;
  const qty = Math.floor(Number(entry.qty));
  return {
    name: String(entry.name || "")
      .trim()
      .slice(0, 200),
    layer: "",
    ord: 0,
    qty: qty >= 0 && qty <= MAX_MANUAL_QTY ? qty : 1,
    rot: !entry.fixed,
    manual: true,
    w: width,
    h: length,
    paths: rectanglePaths(width, length)
  };
}

/* Nouvelles cotes d'une pièce saisie (avant l'échelle de la pièce). */
export function resizeManualPart(part, width, length) {
  if (!(width > 0) || !(length > 0) || !isFinite(width) || !isFinite(length)) return false;
  part.w = width;
  part.h = length;
  part.paths = rectanglePaths(width, length);
  // la copie mise à l'échelle est à refaire
  part._eff = null;
  part._effK = null;
  return true;
}

// cellule d'un tableur : nombre avec séparateur de milliers (« 1 200 », « 1 200,5 ») accepté
function cellLength(text, units) {
  const s = String(text).trim();
  if (s === "") return NaN;
  const grouped = s.match(/^(\d{1,3}(?:[\s  ]\d{3})+)([.,]\d+)?$/);
  return parseLength(grouped ? grouped[1].replace(/\D/g, "") + (grouped[2] || "") : s, units);
}

function splitCells(line) {
  if (line.indexOf("\t") >= 0) return line.split("\t");
  if (line.indexOf(";") >= 0) return line.split(";");
  return line.split(",");
}

/* Lignes collées depuis un tableur (colonnes séparées par tabulation, point-virgule ou virgule) :
   nom (facultatif), longueur, largeur, quantité (facultative, 1 par défaut).
   Rend { parts: [{ name, length, width, qty }], skipped } ; une ligne d'en-tête sans nombre n'est pas comptée. */
export function parsePastedParts(text, units) {
  const parts = [];
  let skipped = 0;
  String(text)
    .split(/\r\n|\r|\n/)
    .forEach(function (line, index) {
      if (!line.trim()) return;
      const cells = splitCells(line).map(function (c) {
        return c.trim().replace(/^"(.*)"$/, "$1");
      });
      let name = "";
      const numbers = [];
      cells.forEach(function (cell) {
        if (cell === "") return;
        const value = cellLength(cell, units);
        if (isFinite(value)) numbers.push({ value: value, text: cell });
        else if (!numbers.length && !name) name = cell;
      });
      if (numbers.length < 2) {
        // première ligne sans cotes : en-tête de colonnes
        if (!(index === 0 && !numbers.length)) skipped++;
        return;
      }
      const qtyText = numbers[2] ? numbers[2].text.replace(/[\s  ]/g, "") : "1";
      const qty = /^\d+$/.test(qtyText) ? parseInt(qtyText, 10) : NaN;
      if (!(numbers[0].value > 0) || !(numbers[1].value > 0) || !(qty >= 1) || qty > MAX_MANUAL_QTY) {
        skipped++;
        return;
      }
      parts.push({ name: name.slice(0, 200), length: numbers[0].value, width: numbers[1].value, qty: qty });
    });
  return { parts: parts, skipped: skipped };
}
