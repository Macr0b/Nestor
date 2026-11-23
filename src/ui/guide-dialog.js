/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Guide : catégories à gauche, fiche à droite (à quoi ça sert, étapes, bon à savoir), recherche, « Me montrer
   dans l'appli » et boutons « ? » des blocs qui ouvrent la fiche qui en parle. */

import { translate } from "../i18n/i18n.js";
import { GUIDE_CATEGORIES, GUIDE_TOPICS, topicOrder } from "../guide/topics.js";
import { byId, escapeHtml } from "../util/dom.js";
import { closeModal, openModal } from "./modal.js";
import { selectTab } from "./tabs.js";

// icônes des fiches (traits simples, couleur du texte)
const ICONS = {
  play: '<path d="M8 5v14l11-7z"/>',
  import: '<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
  saw: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v3M20 12h-3M12 20v-3M4 12h3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  mill: '<path d="M10 3h4v6h-4zM11 9v8l1 3 1-3V9"/>',
  laser: '<path d="M12 3v9M8 3h8M12 15v2M9 20l3-3 3 3M6 14l2-1M18 14l-2-1"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M15 9.5a3 3 0 1 0 0 5M8 11h5M8 13h5"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  usb: '<path d="M7 10h10v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM9 10V3h6v7M11 6h0M13 6h0"/>'
};

let current = "start";
let query = "";

function icon(name) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
}

function topicTitle(id) {
  return translate("guide." + id + ".title");
}

// tout le texte d'une fiche, pour la recherche
function topicText(id) {
  var t = GUIDE_TOPICS[id],
    parts = [topicTitle(id), translate("guide." + id + ".intro"), translate("guide." + id + ".tip")];
  for (var k = 1; k <= t.steps; k++) parts.push(translate("guide." + id + ".s" + k));
  return parts.join(" ");
}

// recherche sans tenir compte des accents ni des majuscules
function fold(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matches(id) {
  if (!query) return true;
  var hay = fold(topicText(id));
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every(function (word) {
      return hay.includes(word);
    });
}

function renderNav() {
  var html = [],
    found = 0;
  GUIDE_CATEGORIES.forEach(function (c) {
    var topics = c.topics.filter(matches);
    if (!topics.length) return;
    found += topics.length;
    html.push('<p class="guide-cat">' + escapeHtml(translate("guide.cat." + c.id)) + "</p>");
    topics.forEach(function (id) {
      html.push(
        '<button type="button" class="guide-item" data-topic="' +
          id +
          '"' +
          (id === current ? ' aria-current="page"' : "") +
          ">" +
          icon(GUIDE_TOPICS[id].icon) +
          "<span>" +
          escapeHtml(topicTitle(id)) +
          "</span></button>"
      );
    });
  });
  if (!found) html.push('<p class="hint">' + escapeHtml(translate("guide.none", { q: query })) + "</p>");
  byId("guideNav").innerHTML = html.join("");
}

function renderTopic() {
  var t = GUIDE_TOPICS[current],
    cat = GUIDE_CATEGORIES.find(function (c) {
      return c.topics.includes(current);
    }),
    order = topicOrder(),
    pos = order.indexOf(current),
    steps = [];
  for (var k = 1; k <= t.steps; k++)
    steps.push("<li>" + escapeHtml(translate("guide." + current + ".s" + k)) + "</li>");
  byId("guideTopic").innerHTML =
    '<p class="guide-kicker">' +
    escapeHtml(translate("guide.cat." + cat.id)) +
    " · " +
    (pos + 1) +
    " / " +
    order.length +
    '</p><h3 id="guideTopicTitle" tabindex="-1">' +
    escapeHtml(topicTitle(current)) +
    '</h3><p class="guide-intro">' +
    escapeHtml(translate("guide." + current + ".intro")) +
    '</p><ol class="guide-steps">' +
    steps.join("") +
    '</ol><p class="guide-tip"><b>' +
    escapeHtml(translate("guide.tip")) +
    "</b> " +
    escapeHtml(translate("guide." + current + ".tip")) +
    '</p><p><button type="button" class="btn primary" data-show="' +
    current +
    '">' +
    escapeHtml(translate("guide.show")) +
    '</button></p><nav class="guide-pager">' +
    pagerButton(order[pos - 1], "prev") +
    pagerButton(order[pos + 1], "next") +
    "</nav>";
}

/* Bouton « fiche précédente / suivante » : le titre de la fiche, avec une flèche du bon côté. */
function pagerButton(id, dir) {
  if (!id) return "<span></span>";
  var arrow =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
      (dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6") +
      '"/></svg>',
    title = escapeHtml(topicTitle(id));
  return (
    '<button type="button" class="btn guide-' +
    dir +
    '" data-topic="' +
    id +
    '" data-pager="' +
    dir +
    '" aria-label="' +
    escapeHtml(translate("guide." + dir, { t: topicTitle(id) })) +
    '">' +
    (dir === "prev" ? arrow + "<span>" + title + "</span>" : "<span>" + title + "</span>" + arrow) +
    "</button>"
  );
}

/* Flèches du clavier : fiche voisine (sens inversé en écriture de droite à gauche). */
function stepTopic(e) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (e.target.closest("input, select, textarea")) return;
  var back = (e.key === "ArrowLeft") !== (document.documentElement.dir === "rtl"),
    order = topicOrder(),
    id = order[order.indexOf(current) + (back ? -1 : 1)];
  if (!id) return;
  e.preventDefault();
  showTopic(id);
}

function render() {
  renderNav();
  renderTopic();
}

/* Ouvre le guide, sur une fiche donnée (sinon la dernière lue). */
export function openGuide(topic) {
  if (topic && GUIDE_TOPICS[topic]) current = topic;
  query = "";
  byId("guideSearch").value = "";
  byId("guide").classList.toggle("reading", !!topic);
  render();
  openModal("guide", topic ? byId("guideTopicTitle") : byId("guideSearch"), byId("btnGuide"));
}

function closeGuide() {
  closeModal("guide");
}

function showTopic(id) {
  current = id;
  byId("guide").classList.add("reading");
  render();
  byId("guideTopicTitle").focus();
}

/* « Me montrer dans l'appli » : ferme le guide, ouvre l'onglet, et fait clignoter l'élément concerné. */
function showInApp(id) {
  var show = GUIDE_TOPICS[id].show;
  closeGuide();
  if (show.tab) selectTab(byId(show.tab));
  var target = show.targets
    .map(function (sel) {
      return document.querySelector(sel);
    })
    .find(function (el) {
      return el && el.getClientRects().length;
    });
  if (!target) return;
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.classList.remove("guide-flash");
  void target.offsetWidth;
  target.classList.add("guide-flash");
  var focusable = target.matches("button, input, select, label")
    ? target
    : target.querySelector("button, input, select");
  if (focusable) focusable.focus({ preventScroll: true });
}

export function bindGuide() {
  byId("btnGuide").addEventListener("click", function () {
    openGuide();
  });
  byId("btnCloseGuide").addEventListener("click", closeGuide);
  byId("guide").addEventListener("click", function (e) {
    if (e.target === byId("guide")) return closeGuide();
    var topic = e.target.closest("[data-topic]");
    if (topic) return showTopic(topic.dataset.topic);
    var show = e.target.closest("[data-show]");
    if (show) return showInApp(show.dataset.show);
    if (e.target.closest("#guideBack")) byId("guide").classList.remove("reading");
  });
  byId("guideSearch").addEventListener("input", function (e) {
    query = e.target.value.trim();
    byId("guide").classList.remove("reading");
    renderNav();
  });
  document.addEventListener("keydown", function (e) {
    if (byId("guide").hidden) return;
    if (e.key === "Escape") return closeGuide();
    stepTopic(e);
  });
  // « ? » des blocs : la fiche qui en parle
  document.addEventListener("click", function (e) {
    var help = e.target.closest("[data-guide]");
    if (help) openGuide(help.dataset.guide);
  });
}

/* Libellés des boutons « ? » (dans la langue choisie). */
export function renderGuideButtons() {
  document.querySelectorAll("[data-guide]").forEach(function (b) {
    var label = translate("guide.help", { t: topicTitle(b.dataset.guide) });
    b.setAttribute("aria-label", label);
    b.title = label;
  });
}
