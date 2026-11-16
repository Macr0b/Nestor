/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Dessins des types de fraise, vus de côté : queue en haut, partie coupante en bas.
   La flèche (classe « arrow ») montre le sens où partent les copeaux. Cadre de 30 × 48. */

const SHANK = '<rect x="9" y="2" width="10" height="16" rx="1.5"/>';
const POINTED_BODY = '<path d="M8 20h12v22l-6 4-6-4z"/>';
const ARROW_UP = '<path class="arrow" d="M25 34v-10m-2.5 3 2.5-3 2.5 3"/>';
const ARROW_DOWN = '<path class="arrow" d="M25 24v10m-2.5-3 2.5 3 2.5-3"/>';

const TOOL_DRAWINGS = {
  upcut: SHANK + POINTED_BODY + '<path d="M8 27l12-5M8 33l12-5M8 39l12-5"/>' + ARROW_UP,
  downcut: SHANK + POINTED_BODY + '<path d="M8 22l12 5M8 28l12 5M8 34l12 5"/>' + ARROW_DOWN,
  compression:
    SHANK +
    POINTED_BODY +
    '<path d="M8 22l12 4M8 27l12 4M8 37l12-4M8 42l12-4"/>' +
    '<path class="arrow" d="M25 22v6m-2.5-3 2.5 3 2.5-3M25 44v-6m-2.5 3 2.5-3 2.5 3"/>',
  // fraise droite : corps rectangulaire, coupe franche en bout
  straight: SHANK + '<rect x="8" y="20" width="12" height="25" rx="0.5"/><path d="M12 20v25M16 20v25"/>',
  single: SHANK + '<path d="M8 20h12v14l-12 10z"/><path d="M8 20l12 14"/>' + ARROW_UP,
  roughing:
    SHANK +
    POINTED_BODY +
    '<path d="M8 25l3-1.5 3 1.5 3-1.5 3 1.5M8 31l3-1.5 3 1.5 3-1.5 3 1.5M8 37l3-1.5 3 1.5 3-1.5 3 1.5"/>' +
    '<path class="faint" d="M8 27l12-5M8 33l12-5M8 39l12-5"/>',
  // fraise conique : pointe en V, angle marqué
  vbit:
    SHANK + '<path d="M8 20h12v6l-6 18-6-18z"/><path d="M14 44V30"/><path class="arrow" d="M10.5 32a4 4 0 0 0 7 0"/>'
};

/* Dessin SVG d'un type de fraise (décoratif : le nom est écrit à côté). */
export function toolIcon(type) {
  return '<svg viewBox="0 0 30 48" aria-hidden="true">' + (TOOL_DRAWINGS[type] || "") + "</svg>";
}

export const DRAWN_TOOL_TYPES = Object.keys(TOOL_DRAWINGS);
