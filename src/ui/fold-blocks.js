/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Blocs repliables : une flèche devant le titre de chaque bloc (et un clic sur le titre) plie ou déplie le bloc.
   Plié, il ne reste que le titre et une ligne qui le résume. Ce qui est plié est gardé dans ce navigateur.
   Alt + clic plie ou déplie tous les blocs de l'onglet. */

import { translate } from "../i18n/i18n.js";
import { panelList } from "../placement/origin.js";
import { state } from "../project/state.js";
import { parseNumber } from "../util/numbers.js";
import { plannedQty } from "../project/kits.js";
import { panelSizeLabel } from "./plan-summary.js";

const FOLD_KEY = "nestor.folded";
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg>';

function savedFolds() {
  try {
    var list = JSON.parse(localStorage.getItem(FOLD_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveFolds() {
  var ids = Array.prototype.map.call(document.querySelectorAll("section.box.folded"), function (box) {
    return box.getAttribute("aria-labelledby");
  });
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify(ids));
  } catch (e) {}
}

/* Résumé d'un bloc plié (vide : rien d'autre que le titre). */
function summaryOf(titleId) {
  if (titleId === "h-proj") return state.name || "";
  if (titleId === "h-file")
    return (state.files || [])
      .map(function (f) {
        return f.name;
      })
      .join(", ");
  if (titleId === "h-panel") {
    var rows = panelList().filter(function (p) {
      return p.L > 0 && p.W > 0;
    });
    return translate("fold.panels", {
      n: rows.length,
      size: rows.length ? panelSizeLabel(rows[0]) : "–",
      gap: parseNumber(state.sheet.gap, 0),
      margin: parseNumber(state.sheet.margin, 0)
    });
  }
  if (titleId === "h-pieces") {
    var on = state.types.filter(function (t) {
      return t.on !== false;
    });
    return translate("fold.pieces", {
      n: on.length,
      q: on.reduce(function (a, t) {
        return a + plannedQty(t);
      }, 0)
    });
  }
  return "";
}

/* Résumés à jour (après un calcul, une saisie, un changement de langue). */
export function refreshFoldSummaries() {
  document.querySelectorAll("section.box.folded").forEach(function (box) {
    var sum = box.querySelector(".fold-sum");
    if (sum) sum.textContent = summaryOf(box.getAttribute("aria-labelledby"));
  });
}

/* Libellés lus des flèches (après un changement de langue). */
export function renderFoldButtons() {
  document.querySelectorAll(".fold-btn").forEach(function (btn) {
    var box = btn.closest("section.box"),
      title = document.getElementById(box.getAttribute("aria-labelledby"));
    btn.setAttribute(
      "aria-label",
      translate(box.classList.contains("folded") ? "fold.open" : "fold.close", { t: title.textContent.trim() })
    );
  });
  refreshFoldSummaries();
}

function setFolded(box, folded) {
  box.classList.toggle("folded", folded);
  box.querySelector(".fold-btn").setAttribute("aria-expanded", String(!folded));
}

function toggle(box, all) {
  var folded = !box.classList.contains("folded");
  var boxes = all ? box.closest('[role="tabpanel"]').querySelectorAll("section.box[data-fold]") : [box];
  Array.prototype.forEach.call(boxes, function (b) {
    setFolded(b, folded);
  });
  saveFolds();
  renderFoldButtons();
}

/* Pose les flèches sur chaque bloc à titre (une fois, au démarrage) et replie ce qui l'était. */
export function bindFoldBlocks() {
  var folded = savedFolds();
  document.querySelectorAll("section.box[aria-labelledby]").forEach(function (box) {
    var title = document.getElementById(box.getAttribute("aria-labelledby"));
    // les formulaires ouverts à la demande (fiche du carnet, matière) ne se replient pas
    if (!title || title.tagName !== "H2" || box.hidden) return;
    var head = title.parentElement.classList.contains("phead") ? title.parentElement : null;
    if (!head) {
      head = document.createElement("div");
      head.className = "phead";
      title.replaceWith(head);
      head.appendChild(title);
    }
    head.classList.add("fold-head");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fold-btn";
    btn.innerHTML = CHEVRON;
    head.insertBefore(btn, head.firstChild);
    var sum = document.createElement("p");
    sum.className = "fold-sum";
    head.after(sum);
    box.dataset.fold = "";
    setFolded(box, folded.includes(title.id));
    btn.addEventListener("click", function (e) {
      toggle(box, e.altKey);
    });
    title.addEventListener("click", function (e) {
      toggle(box, e.altKey);
    });
  });
  renderFoldButtons();
}
