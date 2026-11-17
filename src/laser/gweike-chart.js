/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Vitesses de découpe publiées par GWK Laser (Gweike) pour ses lasers CO2 de 40 à 150 W, en mm/s, à 90 % de
   puissance, issues de leurs essais de production. Vitesse « Best » (bord propre), et non « High » (la plus
   rapide qui traverse, bord plus brut). Là où la page se contredit (bois 10 mm : « Best » plus rapide que « High »),
   la plus lente des deux est gardée. Une puissance sans valeur veut dire qu'elle ne coupe pas cette épaisseur.
   Au-delà de 10 mm, rien n'est repris : le laser ne sert alors qu'à graver.
   Conditions de la source : lentille 63,5 mm (100 mm pour l'acrylique épais), air assist, aspiration par-dessous.
   Source : https://www.gwklaser.com/co2-laser-cutting-parameters-guide.html */

import { chartBooks } from "./speed-chart.js";

export const GWEIKE_MATERIALS = [
  { id: "gwkSoftwood", mill: "plyPoplar" },
  { id: "gwkMdf", mill: "mdf" },
  { id: "gwkAcrylic", mill: "pmma" }
];

// [matière, épaisseur (mm), vitesses en mm/s pour 40, 60, 80, 100, 130, 150 W ; null = ne coupe pas]
const CHART = [
  ["gwkSoftwood", 3, [4, 12, 18, 22, 28, 33]],
  ["gwkSoftwood", 5, [null, 8, 10, 18, 22, 28]],
  ["gwkSoftwood", 10, [null, null, 6, 8, 11, 14]],
  ["gwkMdf", 3, [7, 12, 15, 18, 20, 25]],
  ["gwkMdf", 5, [3.5, 8, 10, 13, 15, 18]],
  ["gwkMdf", 10, [null, null, 3.5, 5, 6.5, 9]],
  ["gwkAcrylic", 3, [10, 15, 20, 25, 30, 35]],
  ["gwkAcrylic", 5, [5, 7, 8, 10, 12, 15]],
  ["gwkAcrylic", 8, [null, 1, 5, 6, 8, 10]],
  ["gwkAcrylic", 10, [null, null, 3, 4, 5, 7]]
];

export const GWEIKE_BOOKS = chartBooks("GWK Laser", [40, 60, 80, 100, 130, 150], CHART, 90);
