/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Tableaux de vitesses de découpe publiés par puissance de tube (Thunder Laser, GWK…) mis sous la même forme que les
   livrets Trotec : un « livret » par puissance, vitesse en mm/s, à la puissance indiquée par la source. */

/* model : nom de la source ; watts : puissances des colonnes ; chart : [[matière, épaisseur (mm), [vitesses]]] ;
   une vitesse null veut dire que cette puissance ne coupe pas cette épaisseur. */
export function chartBooks(model, watts, chart, power) {
  return watts.map(function (w, column) {
    return {
      watts: w,
      model: model,
      rows: chart
        .filter(function (line) {
          return line[2][column] != null;
        })
        .map(function (line) {
          return {
            material: line[0],
            op: "cut",
            thickness: line[1],
            power: power,
            speed: line[2][column],
            frequency: null,
            zOffset: 0
          };
        })
    };
  });
}
