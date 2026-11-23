/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Thème clair ou sombre, appliqué avant le premier affichage (script classique chargé dans <head>, sans module),
   pour éviter un éclair de la mauvaise couleur au démarrage.
   Choix gardé sur l'appareil : "auto" (suit l'appareil), "light" ou "dark".
   Les réglages changent le choix puis envoient l'évènement « nestor-theme » sur document. */

(function () {
  var THEME_KEY = "nestor.theme";
  var BAR_COLORS = { light: "#0d4e73", dark: "#0b2436" };
  var systemDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function savedChoice() {
    try {
      var choice = localStorage.getItem(THEME_KEY);
      return choice === "light" || choice === "dark" ? choice : "auto";
    } catch (e) {
      return "auto";
    }
  }

  function applyTheme() {
    var choice = savedChoice();
    var theme = choice === "auto" ? (systemDark && systemDark.matches ? "dark" : "light") : choice;
    document.documentElement.setAttribute("data-theme", theme);
    // barre du navigateur et de l'appli installée : même couleur que le thème choisi
    var bars = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < bars.length; i++) bars[i].setAttribute("content", BAR_COLORS[theme]);
  }

  applyTheme();
  // les balises de couleur de barre sont plus bas dans <head> : on les met à jour une fois la page lue
  document.addEventListener("DOMContentLoaded", applyTheme);
  document.addEventListener("nestor-theme", applyTheme);
  if (systemDark && systemDark.addEventListener) systemDark.addEventListener("change", applyTheme);
})();
