/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fenêtres par-dessus la page (Projets, Réglages, Raccourcis) : le focus entre dedans, Tab y reste, et revient
   à l'élément d'où la fenêtre a été ouverte quand elle se ferme. */

import { byId } from "../util/dom.js";

const openers = {};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(overlay) {
  return Array.prototype.filter.call(overlay.querySelectorAll(FOCUSABLE), function (el) {
    return !el.hidden && el.getClientRects().length > 0;
  });
}

/* fallback : élément à qui rendre le focus si celui d'origine n'est plus visible (fenêtre ouverte depuis une autre) */
export function openModal(id, firstFocus, fallback) {
  var active = document.activeElement;
  openers[id] = { el: active && active !== document.body ? active : null, fallback: fallback || null };
  byId(id).hidden = false;
  firstFocus.focus();
}

export function closeModal(id) {
  var overlay = byId(id),
    opener = openers[id] || {};
  if (overlay.hidden) return;
  overlay.hidden = true;
  delete openers[id];
  var target = opener.el && opener.el.isConnected && opener.el.getClientRects().length ? opener.el : opener.fallback;
  if (target) target.focus();
}

/* Tab et Maj+Tab tournent dans la fenêtre ouverte */
export function bindModalFocusTrap() {
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var overlay = Array.prototype.find.call(document.querySelectorAll(".overlay"), function (o) {
      return !o.hidden;
    });
    if (!overlay) return;
    var items = focusables(overlay);
    if (!items.length) return;
    var first = items[0],
      last = items[items.length - 1],
      inside = overlay.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  });
}
