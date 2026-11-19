/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Signalement de bug : ouvre un ticket GitHub prérempli avec des informations techniques
   (le fichier de l'utilisateur n'est jamais envoyé). */

import { currentLanguage, translate } from "../i18n/i18n.js";
import { panelOrigin } from "../placement/origin.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { host } from "../util/host.js";
import { APP_VERSION } from "../version.js";

export function bugReportUrl() {
  var i = state.info || {},
    standalone =
      (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var info = [
    "- Nestor : " +
      APP_VERSION +
      (host && host.noInstall ? " (Claude)" : standalone ? " (installée)" : " (navigateur)"),
    "- Langue : " + currentLanguage,
    "- Appareil : " + navigator.userAgent,
    "- Écran : " + screen.width + " × " + screen.height + " (×" + (window.devicePixelRatio || 1) + ")",
    "- Fichier(s) : " +
      (state.example
        ? "exemple"
        : (state.files || []).length
          ? state.files
              .map(function (f) {
                var i = f.info;
                return (
                  i.kind + ", " + i.n + " pièce(s), " + Math.round(i.size[0]) + " × " + Math.round(i.size[1]) + " mm"
                );
              })
              .join(" ; ")
          : "aucun"),
    "- Repère de placement : " +
      (state.sheet.panels || [])
        .map(function (p, i) {
          return panelOrigin(i);
        })
        .join(", "),
    "- Méthode : " +
      (state.sheet.mode === "rect" ? "rectangles" : "imbrication") +
      ", panneaux : " +
      (state.sheet.panels || [])
        .map(function (p) {
          return p.L + "×" + p.W;
        })
        .join(", "),
    "- Dernière erreur : " + (session.lastError || "aucune")
  ].join("\n");
  var body =
    "### " +
    translate("bug.what") +
    "\n\n\n### " +
    translate("bug.expected") +
    "\n\n\n### " +
    translate("bug.steps") +
    "\n1. \n\n### " +
    translate("bug.info") +
    "\n" +
    info +
    "\n";
  return (
    "https://github.com/Macr0b/Nestor/issues/new?labels=bug&title=" +
    encodeURIComponent("[Bug] ") +
    "&body=" +
    encodeURIComponent(body)
  );
}
