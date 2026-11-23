/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Onglets sous l'en-tête : un seul panneau visible à la fois, onglet retenu d'une visite à l'autre,
   flèches du clavier pour passer d'un onglet à l'autre. */

const TAB_KEY = "nestor.onglet";

/* Onglets principaux (Imbrication, Fraisage…), dans l'ordre. */
export function allTabs() {
  return Array.from(document.querySelectorAll('.tabs [role="tab"]'));
}

export function selectTab(tab, focus) {
  for (const other of allTabs()) {
    const selected = other === tab;
    other.setAttribute("aria-selected", String(selected));
    other.tabIndex = selected ? 0 : -1;
    document.getElementById(other.getAttribute("aria-controls")).hidden = !selected;
  }
  if (focus) tab.focus();
  try {
    localStorage.setItem(TAB_KEY, tab.id);
  } catch (e) {}
}

export function bindTabs() {
  const tabs = allTabs();
  for (const tab of tabs) {
    tab.addEventListener("click", function () {
      selectTab(tab, false);
    });
    tab.addEventListener("keydown", function (e) {
      const index = tabs.indexOf(tab);
      const rtl = document.documentElement.dir === "rtl";
      let next = null;
      if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = tabs[(index + 1) % tabs.length];
      else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (e.key === "Home") next = tabs[0];
      else if (e.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      selectTab(next, true);
    });
  }
  let saved = null;
  try {
    saved = localStorage.getItem(TAB_KEY);
  } catch (e) {}
  const start = tabs.find(function (tab) {
    return tab.id === saved;
  });
  if (start) selectTab(start, false);
}
