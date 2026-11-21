/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fiches du guide, rangées par catégorie. Les textes sont dans les fichiers de langue :
   guide.<id>.title, .intro, .s1 à .sN (étapes), .tip. show : l'onglet et l'élément que « Me montrer » désigne
   (le premier sélecteur trouvé et visible). */

export const GUIDE_CATEGORIES = [
  { id: "start", topics: ["start"] },
  { id: "nest", topics: ["import", "panels", "lock"] }
];

export const GUIDE_TOPICS = {
  start: { steps: 4, icon: "play", show: { tab: "tabNest", targets: ["#drop"] } },
  import: { steps: 4, icon: "import", show: { tab: "tabNest", targets: ["#drop"] } },
  panels: { steps: 4, icon: "grid", show: { tab: "tabNest", targets: ["#panelRows"] } },
  lock: { steps: 4, icon: "lock", show: { tab: "tabNest", targets: ['[data-lock="0"]', "#result"] } }
};

/* Fiches dans l'ordre de lecture (pour « Suivant »). */
export function topicOrder() {
  return GUIDE_CATEGORIES.reduce(function (all, c) {
    return all.concat(c.topics);
  }, []);
}
