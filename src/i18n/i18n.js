/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Langue de l'interface : détection, traduction d'une clé (translate), mise en forme des nombres, application
   des textes à la page. Les textes eux-mêmes sont dans les fichiers de langue. */

import { LANGUAGES } from "./languages.js";
import { renderReleaseNotes } from "../ui/release-notes.js";
import { byId, escapeHtml } from "../util/dom.js";
import { isImperial } from "../util/units.js";
import { APP_VERSION } from "../version.js";

// textes des langues déjà chargées : { code: { clé: texte } }
const dictionaries = {};

export let currentLanguage = "fr";

let numberFormat = null;

function languageInfo(code) {
  return (
    LANGUAGES.find(function (language) {
      return language.code === code;
    }) || { code: code, dir: "ltr", locale: code }
  );
}

// réglages régionaux de la langue (nombres, dates, tri alphabétique)
export function languageLocale(code) {
  return languageInfo(code || currentLanguage).locale || code;
}

function isKnownLanguage(code) {
  return LANGUAGES.some(function (language) {
    return language.code === code;
  });
}

export function detectLanguage() {
  var saved = null;
  try {
    saved = localStorage.getItem("plancoupe.lang");
  } catch (e) {}
  if (saved && isKnownLanguage(saved)) return saved;
  var navs = navigator.languages || [navigator.language || "fr"];
  for (var i = 0; i < navs.length; i++) {
    var full = String(navs[i]).toLowerCase(),
      code = full.split("-")[0];
    if (code === "zh" && /hant|-tw|-hk|-mo/.test(full)) return "zh-Hant";
    if (code === "no" || code === "nn") return "nb";
    if (isKnownLanguage(code)) return code;
  }
  return "en";
}

/* Charge les textes d'une langue (une seule fois).
   Version Claude : toutes les langues sont déjà dans la page (window.NESTOR_LOCALES).
   Appli et site : un fichier par langue, mis en cache par le service worker pour le hors ligne. */
export async function loadLanguage(code) {
  if (dictionaries[code]) return;
  var embedded = window.NESTOR_LOCALES;
  if (embedded && embedded[code]) {
    dictionaries[code] = embedded[code];
    return;
  }
  var response = await fetch(new URL("./locales/" + code + ".json", import.meta.url));
  if (!response.ok) throw new Error("langue " + code + " introuvable");
  dictionaries[code] = await response.json();
}

export function translate(key, params) {
  var text = dictionaries[currentLanguage] && dictionaries[currentLanguage][key];
  // secours : le français, langue de référence (toutes les langues ont les mêmes clés, vérifié par les tests)
  if (text == null && dictionaries.fr) text = dictionaries.fr[key];
  if (text == null) return key;
  // {u} : unité de longueur choisie dans les réglages (mm ou in), sauf si l'appel la donne
  if (params || text.indexOf("{u}") >= 0) {
    var values = Object.assign({ u: translate(isImperial() ? "len.in" : "len.mm") }, params);
    text = text.replace(/\{(\w+)\}/g, function (_, name) {
      return values[name] != null ? values[name] : "";
    });
  }
  return text;
}

export function formatNumber(value) {
  return numberFormat.format(Math.round(value * 10) / 10);
}

// change de langue : charge ses textes si besoin, puis les applique à toute la page
export async function applyLanguage(code) {
  await Promise.all([loadLanguage("fr"), loadLanguage(code)]);
  currentLanguage = code;
  var info = languageInfo(code);
  numberFormat = new Intl.NumberFormat(info.locale || code, { maximumFractionDigits: 1 });
  document.documentElement.lang = code;
  document.documentElement.dir = info.dir || "ltr";
  document.title = translate("app.title");
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = translate(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
    el.placeholder = translate(el.getAttribute("data-i18n-ph"));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
    el.setAttribute("aria-label", translate(el.getAttribute("data-i18n-aria")));
  });
  byId("verLbl").textContent = translate("set.version", { v: APP_VERSION });
  renderReleaseNotes(info.locale || code);
}

export const languageSelect = byId("langSel");

export function fillLanguageSelect() {
  languageSelect.innerHTML = LANGUAGES.slice()
    .sort(function (a, b) {
      return a.name.localeCompare(b.name, "en");
    })
    .map(function (language) {
      return '<option value="' + language.code + '">' + escapeHtml(language.name) + "</option>";
    })
    .join("");
}
