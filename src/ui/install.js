/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Bouton d'installation de l'appli (quand le navigateur le permet). */

import { translate } from "../i18n/i18n.js";
import { byId } from "../util/dom.js";
import { host } from "../util/host.js";

let installPrompt = null;

let isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export function refreshInstallButton() {
  var g = byId("installGrp"),
    b = byId("btnInstall"),
    h = byId("installHint");
  if (isStandalone || (host && host.noInstall)) {
    g.hidden = true;
    return;
  }
  g.hidden = false;
  b.hidden = !installPrompt;
  var agent = navigator.userAgent,
    ios = /iPhone|iPad|iPod/.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    safariMac = /Macintosh/.test(agent) && /Safari/.test(agent) && !/Chrome|Chromium|Edg|Firefox/.test(agent),
    firefox = /Firefox/.test(agent);
  h.textContent = installPrompt
    ? ""
    : ios
      ? translate("inst.ios")
      : safariMac
        ? translate("inst.safari")
        : firefox
          ? translate("inst.firefox")
          : translate("inst.other");
}

export function bindInstall() {
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installPrompt = e;
    refreshInstallButton();
  });
  window.addEventListener("appinstalled", function () {
    installPrompt = null;
    isStandalone = true;
    refreshInstallButton();
  });
  byId("btnInstall").addEventListener("click", function () {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.finally(function () {
      installPrompt = null;
      refreshInstallButton();
    });
  });
}
