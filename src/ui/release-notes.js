/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Nouveautés de chaque version, affichées dans les réglages. Chaque nouvelle version ajoute une ligne en tête,
   avec sa clé de texte (traduite dans toutes les langues). */

import { translate } from "../i18n/i18n.js";
import { byId, escapeHtml } from "../util/dom.js";

/* nouveautés des dernières versions (réglages) */
const RELEASE_NOTES = [
  ["1.9.2", "2026-11-19", "news.192"],
  ["1.9.1", "2026-11-17", "news.191"],
  ["1.9.0", "2026-11-17", "news.190"],
  ["1.8.1", "2026-11-17", "news.181"],
  ["1.8.0", "2026-11-17", "news.180"],
  ["1.7.0", "2026-11-16", "news.170"],
  ["1.6.0", "2026-11-16", "news.160"],
  ["1.5.0", "2026-11-16", "news.150"],
  ["1.4.1", "2026-11-16", "news.141"],
  ["1.4.0", "2026-11-15", "news.140"],
  ["1.3.0", "2026-11-15", "news.130"],
  ["1.2.6", "2026-11-12", "news.126"],
  ["1.2.5", "2026-11-12", "news.125"],
  ["1.2.4", "2026-11-12", "news.124"],
  ["1.2.3", "2026-11-12", "news.123"],
  ["1.2.2", "2026-11-10", "news.122"],
  ["1.2.1", "2026-11-10", "news.121"],
  ["1.2.0", "2026-11-08", ["news.120", "news.113"]],
  ["1.1.2", "2026-11-04", "news.112"],
  ["1.1.1", "2026-11-04", "news.111"],
  ["1.1.0", "2026-11-04", "news.110"],
  ["1.0.9", "2026-11-02", "news.109"],
  ["1.0.8", "2026-11-02", "news.108"],
  ["1.0.7", "2026-11-02", "news.107"],
  ["1.0.6", "2026-11-02", "news.106"],
  ["1.0.5", "2026-11-02", "news.105"],
  ["1.0.4", "2026-11-02", "news.icon"],
  ["1.0.3", "2026-11-02", "news.icon"],
  ["1.0.2", "2026-11-02", "news.icon"],
  ["1.0.1", "2026-11-02", "news.101"],
  ["1.0.0", "2026-11-02", "news.100"]
];

export function renderReleaseNotes(loc) {
  var list = byId("newsList");
  if (!list) return;
  var dateFormat;
  try {
    dateFormat = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
  }
  list.innerHTML = RELEASE_NOTES.map(function (n) {
    var d = new Date(n[1] + "T12:00:00");
    return (
      '<li><span class="nv">' +
      escapeHtml(n[0]) +
      '</span><span class="nd">' +
      escapeHtml(dateFormat.format(d)) +
      "</span><p>" +
      escapeHtml(
        []
          .concat(n[2])
          .map(function (k) {
            return translate(k);
          })
          .join(" ")
      ) +
      "</p></li>"
    );
  }).join("");
}
