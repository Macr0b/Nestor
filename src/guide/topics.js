/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fiches du guide, rangées par catégorie. Les textes sont dans les fichiers de langue :
   guide.<id>.title, .intro, .s1 à .sN (étapes), .tip. show : l'onglet et l'élément que « Me montrer » désigne
   (le premier sélecteur trouvé et visible). */

export const GUIDE_CATEGORIES = [
  { id: "start", topics: ["start"] },
  { id: "nest", topics: ["import", "panels", "rotation", "lock", "kit", "saw", "export"] },
  { id: "machines", topics: ["mill", "laser", "notebook"] },
  { id: "project", topics: ["materials", "cost", "projects"] }
];

/* tab absent : la fiche désigne un élément visible depuis tous les onglets (bouton du haut) */
export const GUIDE_TOPICS = {
  start: { steps: 4, icon: "play", show: { tab: "tabNest", targets: ["#drop"] } },
  import: { steps: 4, icon: "import", show: { tab: "tabNest", targets: ["#drop"] } },
  panels: { steps: 4, icon: "grid", show: { tab: "tabNest", targets: ["#panelRows"] } },
  rotation: { steps: 4, icon: "rotate", show: { tab: "tabNest", targets: ['[data-k="rot"]', "#rotAll"] } },
  kit: { steps: 4, icon: "box", show: { tab: "tabNest", targets: ["#kitBox", '[data-k="kit"]'] } },
  lock: { steps: 4, icon: "lock", show: { tab: "tabNest", targets: ['[data-lock="0"]', "#result"] } },
  saw: { steps: 4, icon: "saw", show: { tab: "tabNest", targets: ["#sMode"] } },
  export: { steps: 4, icon: "download", show: { tab: "tabNest", targets: [".dl", "#result"] } },
  mill: { steps: 4, icon: "mill", show: { tab: "tabMill", targets: ["#millTypes"] } },
  laser: { steps: 4, icon: "laser", show: { tab: "tabLaser", targets: ["#lzMachine"] } },
  notebook: { steps: 4, icon: "book", show: { tab: "tabNotebook", targets: ["#nbSearch"] } },
  materials: { steps: 4, icon: "layers", show: { tab: "tabMaterials", targets: ["#btnLibNew"] } },
  cost: { steps: 4, icon: "coin", show: { tab: "tabCost", targets: ['section[aria-labelledby="h-cost"]'] } },
  projects: { steps: 4, icon: "folder", show: { targets: ["#btnProjects"] } }
};

/* Fiches dans l'ordre de lecture (pour « Suivant »). */
export function topicOrder() {
  return GUIDE_CATEGORIES.reduce(function (all, c) {
    return all.concat(c.topics);
  }, []);
}
