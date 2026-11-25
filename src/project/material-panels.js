/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Panneaux et matière choisie : une ligne « format de la matière » (fromMaterial) suit la matière ; les autres lignes
   sont des chutes, utilisées avant elle, ou des panneaux achetés de la même matière (bought), payés comme elle.
   Ligne de la matière retaillée à la main (handSized) : elle garde sa taille, payée au prorata. */

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
    delete linked.handSized;
    return true;
  }
  if (linked && (linked.handSized || (linked.L === item.L && linked.W === item.W))) return false;
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

/* Chute : une ligne autre que celle de la matière, pas achetée (seulement quand une ligne est liée). */
export function isOffcutPanel(panels, panelIndex) {
  var index = materialPanelIndex(panels);
  return (
    index >= 0 &&
    panelIndex !== index &&
    panelIndex >= 0 &&
    panelIndex < panels.length &&
    panels[panelIndex].bought !== true
  );
}

/* Taille de la ligne de la matière changée à la main : elle la garde, même si la matière est choisie de nouveau. */
export function markHandSized(panel) {
  if (panel && panel.fromMaterial) panel.handSized = true;
}

/* « Remettre le format » : la ligne de la matière reprend son format. Rend true si la liste a changé. */
export function restoreMaterialFormat(panels, item) {
  var linked = panels[materialPanelIndex(panels)];
  if (!linked || !linked.handSized) return false;
  delete linked.handSized;
  applyMaterialFormat(panels, item);
  return true;
}

/* Nouveau panneau acheté de la même matière, après la ligne de la matière : même format pour commencer. Rend son indice. */
export function insertBought(panels) {
  var index = materialPanelIndex(panels),
    model = panels[index] || panels[panels.length - 1] || { L: 600, W: 400 };
  panels.push(withOrigin({ L: model.L, W: model.W, qty: "", bought: true }, model));
  return panels.length - 1;
}

/* Nouvelle chute, placée juste avant la ligne de la matière : même format pour commencer, stock 1. Rend son indice. */
export function insertOffcut(panels) {
  var index = materialPanelIndex(panels),
    model = panels[index] || panels[panels.length - 1] || { L: 600, W: 400 },
    at = index >= 0 ? index : panels.length;
  panels.splice(at, 0, withOrigin({ L: model.L, W: model.W, qty: index >= 0 ? 1 : "" }, model));
  return at;
}
