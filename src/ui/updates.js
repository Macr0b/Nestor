/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Mises à jour : service worker, bandeau « nouvelle version disponible », vérification manuelle. */

import { translate } from "../i18n/i18n.js";
import { byId } from "../util/dom.js";
import { host } from "../util/host.js";

let swRegistration = null;

let reloading = false;

function showUpdateBanner() {
  byId("updBanner").hidden = false;
}

function watchRegistration(registration) {
  swRegistration = registration;
  if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner();
  registration.addEventListener("updatefound", function () {
    var nw = registration.installing;
    if (!nw) return;
    nw.addEventListener("statechange", function () {
      if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner();
    });
  });
}

export function bindUpdates() {
  if (host && host.noInstall) {
    byId("updGrp").hidden = true;
  } else if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker
      .register("sw.js")
      .then(function (r) {
        watchRegistration(r);
        r.update().catch(function () {});
      })
      .catch(function () {});
    // nouvelle version activée : on recharge pour l'utiliser. Pas à la toute première visite : le service worker
    // vient juste de s'installer, la page est déjà la bonne version (sinon elle se rechargeait en plein calcul)
    var wasControlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (reloading || !wasControlled) return;
      reloading = true;
      location.reload();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && swRegistration) swRegistration.update().catch(function () {});
    });
  }
  byId("btnUpdate").addEventListener("click", function () {
    if (swRegistration && swRegistration.waiting) swRegistration.waiting.postMessage("skipWaiting");
    else location.reload();
  });
  byId("btnCheck").addEventListener("click", function () {
    var m = byId("checkMsg");
    if (!("serviceWorker" in navigator)) {
      m.textContent = translate("upd.unavailable");
      return;
    }
    if (!navigator.onLine) {
      m.textContent = translate("upd.offline");
      return;
    }
    m.textContent = translate("upd.checking");
    (swRegistration ? Promise.resolve(swRegistration) : navigator.serviceWorker.getRegistration())
      .then(function (r) {
        if (!r) {
          m.textContent = translate("upd.unavailable");
          return;
        }
        if (!swRegistration) watchRegistration(r);
        return r.update().then(function () {
          setTimeout(function () {
            if (r.waiting || r.installing) {
              m.textContent = translate("upd.found");
              showUpdateBanner();
            } else m.textContent = translate("upd.latest");
          }, 1500);
        });
      })
      .catch(function () {
        m.textContent = translate("upd.offline");
      });
  });
}
