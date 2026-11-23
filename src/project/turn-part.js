/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Quart de tour de la pièce elle-même (sens fixe) : dir = 1 dans le sens des aiguilles d'une montre, -1 dans l'autre.
   Le dessin tourne pour de bon (calcul, vignette, taille, exports) ; turn garde l'angle pour l'afficher. */
export function turnPart(part, dir) {
  var w = part.w,
    h = part.h;
  part.paths = part.paths.map(function (p) {
    return Object.assign({}, p, {
      pts: p.pts.map(function (q) {
        return dir > 0 ? [h - q[1], q[0]] : [q[1], w - q[0]];
      })
    });
  });
  part.w = h;
  part.h = w;
  part.turn = ((((part.turn || 0) + dir) % 4) + 4) % 4;
  part._eff = null;
  part._effK = null;
}
