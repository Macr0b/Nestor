/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Sources des valeurs laser indicatives : livrets Trotec (puissance et vitesse en %), tableau Thunder Laser
   (vitesse maximale en mm/s, puissance au maximum) et tableau GWK (vitesse pour un bord propre en mm/s, à 90 %).
   Chaque matière vient d'une seule source. « chart » : tableau par puissance de tube, où une puissance absente veut
   dire trop faible pour couper cette épaisseur. */

import { GWEIKE_BOOKS, GWEIKE_MATERIALS } from "./gweike-chart.js";
import { THUNDER_BOOKS, THUNDER_MATERIALS } from "./thunder-chart.js";
import { TROTEC_BOOKS, TROTEC_MATERIALS } from "./trotec-books.js";

export const SOURCES = {
  trotec: {
    books: TROTEC_BOOKS,
    unit: "percent",
    url: "https://www.troteclaser.com/laser-parameter-files/Speedy360-80W-TroLase.pdf"
  },
  thunder: {
    books: THUNDER_BOOKS,
    unit: "mmps",
    chart: true,
    // vitesses maximales en ligne droite
    maxLineSpeed: true,
    url: "https://www.thunderlaserusa.com/knowledge/parameter-comparison"
  },
  gweike: {
    books: GWEIKE_BOOKS,
    unit: "mmps",
    chart: true,
    url: "https://www.gwklaser.com/co2-laser-cutting-parameters-guide.html"
  }
};

// toutes les matières à valeurs indicatives, avec leur source
export const LASER_MATERIALS = TROTEC_MATERIALS.map(function (m) {
  return Object.assign({ source: "trotec" }, m);
}).concat(
  THUNDER_MATERIALS.map(function (m) {
    return Object.assign({ source: "thunder" }, m);
  }),
  GWEIKE_MATERIALS.map(function (m) {
    return Object.assign({ source: "gweike" }, m);
  })
);

export function laserMaterial(id) {
  return (
    LASER_MATERIALS.find(function (m) {
      return m.id === id;
    }) || null
  );
}
