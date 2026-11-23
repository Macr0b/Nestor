/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Compteur anonyme d'exports : à chaque plan téléchargé, un message { e: "export", f: format, v: version } part vers
   le compteur de Nestor. Rien d'autre : ni fichier, ni pièce, ni nom de projet, ni cookie, ni identifiant.
   Seul le site officiel envoie (une copie installée ailleurs, ou la version dans Claude, n'envoie rien) ; l'envoi
   se coupe dans les Réglages ; s'il échoue, l'export n'en sait rien. Le compteur : dossier stats/ du dépôt. */

import { APP_VERSION } from "../version.js";

export const STATS_URL = "https://stats.nestor.rophistudio.fr/e";
export const OFFICIAL_ORIGINS = ["https://macr0b.github.io", "https://nestor.rophistudio.fr"];
export const EXPORT_KINDS = ["svg", "dxf", "pdf", "pdfall", "dxfall"];

const STATS_KEY = "nestor.stats";

/* Texte du message, ou null si le format n'est pas un export du plan. */
export function exportMessage(kind, version) {
  if (!EXPORT_KINDS.includes(kind)) return null;
  return JSON.stringify({ e: "export", f: kind, v: version });
}

/* On envoie seulement depuis le site officiel, si l'usager ne l'a pas coupé, et si l'appareil est en ligne. */
export function mayCount(origin, enabled, online) {
  return OFFICIAL_ORIGINS.includes(origin) && enabled && online !== false;
}

export function statsEnabled() {
  try {
    return localStorage.getItem(STATS_KEY) !== "off";
  } catch (e) {
    return true;
  }
}

export function setStatsEnabled(on) {
  try {
    if (on) localStorage.removeItem(STATS_KEY);
    else localStorage.setItem(STATS_KEY, "off");
  } catch (e) {}
}

/* Compte un export (sans attendre de réponse, sans jamais bloquer ni signaler d'erreur). */
export function countExport(kind) {
  try {
    var message = exportMessage(kind, APP_VERSION);
    if (!message || !mayCount(location.origin, statsEnabled(), navigator.onLine)) return;
    if (navigator.sendBeacon) navigator.sendBeacon(STATS_URL, new Blob([message], { type: "text/plain" }));
  } catch (e) {}
}
