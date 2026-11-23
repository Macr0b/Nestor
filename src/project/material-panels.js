/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Panneaux et matière choisie : une ligne « format de la matière » (fromMaterial) suit la matière ; les autres lignes
   sont des chutes, utilisées avant elle. */

// une nouvelle ligne reprend le repère de placement de sa voisine (déjà vérifié), s'il y en a un
function withOrigin(panel, model) {
  if (model && model.origin) panel.origin = model.origin;
  return panel;
}

export function materialPanelIndex(panels) {
  return panels.findIndex(function (p) {
    return p.fromMaterial === true;
  });
}

/* Met le format de la matière sur sa ligne. Sans ligne liée : la seule ligne le devient, sinon une ligne est ajoutée
   en dernier (les chutes restent devant). Matière sans format ou aucune matière : la ligne n'est plus liée.
   Rend true si la liste a changé. */
export function applyMaterialFormat(panels, item) {
  var index = materialPanelIndex(panels),
    linked = panels[index];
  if (!item || !(item.L > 0) || !(item.W > 0)) {
    if (!linked) return false;
    delete linked.fromMaterial;
    return true;
  }
  if (linked && linked.L === item.L && linked.W === item.W) return false;
  if (!linked) {
    if (panels.length === 1) linked = panels[0];
    else {
      linked = withOrigin({ L: item.L, W: item.W, qty: "" }, panels[panels.length - 1]);
      panels.push(linked);
    }
  }
  linked.L = item.L;
  linked.W = item.W;
  linked.fromMaterial = true;
  return true;
}

/* Chute : n'importe quelle ligne autre que celle de la matière (seulement quand une ligne est liée). */
export function isOffcutPanel(panels, panelIndex) {
  var index = materialPanelIndex(panels);
  return index >= 0 && panelIndex !== index && panelIndex >= 0 && panelIndex < panels.length;
}

/* Nouvelle chute, placée juste avant la ligne de la matière : même format pour commencer, stock 1. Rend son indice. */
export function insertOffcut(panels) {
  var index = materialPanelIndex(panels),
    model = panels[index] || panels[panels.length - 1] || { L: 600, W: 400 },
    at = index >= 0 ? index : panels.length;
  panels.splice(at, 0, withOrigin({ L: model.L, W: model.W, qty: index >= 0 ? 1 : "" }, model));
  return at;
}
