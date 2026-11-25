/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Ligne « N nestorisations, et ça continue » au-dessus du cartouche : le total des exports de tout le monde, lu une
   fois au démarrage sur le compteur (GET, rien n'est envoyé). Mêmes conditions que le comptage : site officiel, en
   ligne, comptage pas coupé dans les Réglages. Sinon, ou si le compteur ne répond pas, la ligne reste cachée. */

import { formatNumber, translate } from "../i18n/i18n.js";
import { STATS_URL, mayCount, readTotal, statsEnabled } from "../stats/export-stats.js";
import { byId } from "../util/dom.js";

// dernier total lu (null : pas de ligne)
let total = null;

/* Texte de la ligne pour n exports. */
export function totalText(n) {
  return translate(n === 1 ? "cart.total1" : "cart.total", { n: formatNumber(n) });
}

/* À chaque changement de langue, et après la lecture. */
export function renderExportTotal() {
  var line = byId("exportTotal");
  if (!line) return;
  // pas de ligne tant qu'il n'y a rien à montrer, ni si l'usager a coupé le comptage dans les Réglages
  line.hidden = total == null || total === 0 || !statsEnabled();
  line.textContent = line.hidden ? "" : totalText(total);
}

export function loadExportTotal() {
  if (!mayCount(location.origin, statsEnabled(), navigator.onLine)) return Promise.resolve();
  return fetch(STATS_URL, { method: "GET", credentials: "omit", referrerPolicy: "no-referrer" })
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (data) {
      total = readTotal(data);
      renderExportTotal();
    })
    .catch(function () {});
}
