/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Choix « Remplir » en clair, commun aux pièces et aux kits :
   [Nombre fixe | Remplir au maximum] puis, pour remplir, [panneau] [le dernier / tous / un nouveau].
   Le panneau n'est proposé que s'il y a plusieurs lignes de panneaux. Pour un kit, un choix de plus entre les
   deux : « Nombre de kits », avec une case pour le nombre. */

import { translate } from "../i18n/i18n.js";
import { panelList } from "../placement/origin.js";
import { MAX_KITS, cleanKitCount } from "../project/kits.js";
import { state } from "../project/state.js";
import { escapeHtml } from "../util/dom.js";
import { panelSizeLabel } from "./plan-summary.js";

const HOW = ["last", "all", "new"];

/* « 2 · Chêne 18 » ou la taille du panneau ; le numéro seulement s'il y a plusieurs lignes */
export function panelRowLabel(row, rows) {
  var p = state.sheet.panels[row],
    spec = rows[row];
  return (rows.length > 1 ? row + 1 + " · " : "") + (p && p.name ? p.name : panelSizeLabel(spec));
}

// lignes de panneau utilisables (taille connue), avec leur numéro de ligne
function usableRows() {
  var rows = panelList();
  return rows
    .map(function (spec, row) {
      return { row: row, spec: spec };
    })
    .filter(function (r) {
      return r.spec.L > 0 && r.spec.W > 0;
    })
    .map(function (r) {
      return { row: r.row, label: panelRowLabel(r.row, rows) };
    });
}

function option(value, label, selected) {
  return '<option value="' + value + '"' + (selected ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
}

/* Options du panneau à remplir (rendues aussi seules, quand les panneaux changent). */
export function panelOptions(fill) {
  var cur = fill ? fill.row : 0;
  return usableRows()
    .map(function (r) {
      return option(r.row, r.label, r.row === cur);
    })
    .join("");
}

// choix affiché : "fill" (remplir), "n" (nombre de kits) ou "" (sans remplissage)
function modeOf(fill, count) {
  return fill ? "fill" : count != null ? "n" : "";
}

/* Menus du choix. id : préfixe des identifiants ; fixedLabel : le choix sans remplissage (« Nombre fixe »…) ;
   aria : texte lu pour le premier menu ; counted : { count, aria } pour un kit (choix « Nombre de kits »). */
export function fillPickerHtml(id, fill, fixedLabel, aria, counted) {
  var many = usableRows().length > 1,
    mode = modeOf(fill, counted && counted.count);
  return (
    '<select id="' +
    id +
    '-m" data-fp="mode" aria-label="' +
    escapeHtml(aria) +
    '">' +
    option("", fixedLabel, mode === "") +
    (counted ? option("n", translate("kit.many"), mode === "n") : "") +
    option("fill", translate("fill.max"), mode === "fill") +
    "</select>" +
    (counted
      ? '<span class="fp-count"' +
        (mode === "n" ? "" : " hidden") +
        '><input type="number" id="' +
        id +
        '-n" data-fp="count" min="1" max="' +
        MAX_KITS +
        '" step="1" inputmode="numeric" value="' +
        (counted.count == null ? 2 : counted.count) +
        '" aria-label="' +
        escapeHtml(counted.aria) +
        '"></span>'
      : "") +
    '<span class="fp-fill"' +
    (fill ? "" : " hidden") +
    ">" +
    '<select id="' +
    id +
    '-p" data-fp="row" aria-label="' +
    escapeHtml(translate("fill.rowLbl")) +
    '"' +
    (many ? "" : " hidden") +
    ">" +
    panelOptions(fill) +
    "</select>" +
    '<select id="' +
    id +
    '-h" data-fp="how" aria-label="' +
    escapeHtml(translate("fill.howLbl")) +
    '">' +
    HOW.map(function (how) {
      return option(how, translate("fill." + how), fill ? fill.how === how : how === "last");
    }).join("") +
    "</select></span>"
  );
}

/* Nombre de kits lu dans un conteneur : entier de 1 à 5000 si « Nombre de kits » est choisi, sinon null. */
export function readCount(box) {
  if (box.querySelector('[data-fp="mode"]').value !== "n") return null;
  return cleanKitCount(box.querySelector('[data-fp="count"]').value);
}

/* Remplissage lu dans les menus d'un conteneur : { row, how } ou null (nombre fixe). */
export function readFillPicker(box) {
  if (box.querySelector('[data-fp="mode"]').value !== "fill") return null;
  var rowSelect = box.querySelector('[data-fp="row"]'),
    row = rowSelect.value === "" ? 0 : Math.floor(Number(rowSelect.value)),
    how = box.querySelector('[data-fp="how"]').value;
  return { row: row >= 0 ? row : 0, how: HOW.includes(how) ? how : "last" };
}

/* Après un calcul ou un changement de panneaux : menus remis d'accord avec le remplissage (une ligne de panneau
   retirée le supprime), liste des panneaux à jour, menu du panneau visible s'il y a le choix. */
export function refreshFillPicker(box, fill, count) {
  if (!box || box.contains(document.activeElement)) return;
  var mode = modeOf(fill, count),
    countBox = box.querySelector(".fp-count");
  box.querySelector('[data-fp="mode"]').value = mode;
  box.querySelector(".fp-fill").hidden = !fill;
  if (countBox) {
    countBox.hidden = mode !== "n";
    if (count != null) countBox.querySelector("input").value = count;
  }
  var rowSelect = box.querySelector('[data-fp="row"]');
  rowSelect.innerHTML = panelOptions(fill);
  rowSelect.hidden = usableRows().length <= 1;
  box.querySelector('[data-fp="how"]').value = fill ? fill.how : "last";
}
