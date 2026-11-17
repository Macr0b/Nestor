/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Vitesses de découpe publiées par Thunder Laser pour ses lasers CO2 à tube de verre, par puissance de tube
   (40, 60, 80, 100 et 130 W), en mm/s, puissance au maximum. Ce sont des vitesses maximales en ligne droite :
   la tête ralentit dans les courbes et les angles. Une puissance absente veut dire « gravure seulement ».
   Épaisseurs converties des pouces (1/8" = 3,2 mm, 1/4" = 6,4 mm, 3/8" = 9,5 mm, 1/16" = 1,6 mm, 7 mil = 0,18 mm).
   Au-delà de 10 mm, rien n'est repris : le laser ne sert alors qu'à graver.
   Source : https://www.thunderlaserusa.com/knowledge/parameter-comparison
   Le MDF vient du tableau GWK (gweike-chart.js), qui donne plus d'épaisseurs. */

import { chartBooks } from "./speed-chart.js";

export const THUNDER_MATERIALS = [
  { id: "birchPly", mill: "plyBirch" },
  { id: "cardboard", mill: "" },
  { id: "leather", mill: "" },
  { id: "kraftPaper", mill: "" },
  { id: "bambooVeneer", mill: "" },
  { id: "cottonFabric", mill: "" }
];

// [matière, épaisseur (mm), vitesses en mm/s pour 40, 60, 80, 100, 130 W ; null = gravure seulement]
const CHART = [
  ["birchPly", 3.2, [35, 50, 60, 80, 80]],
  ["birchPly", 6.4, [11, 15, 30, 32, 40]],
  ["birchPly", 9.5, [null, null, 4, 7, 13]],
  ["cardboard", 6.4, [15, 30, 60, 90, 120]],
  ["leather", 1.6, [6, 16, 50, 60, 80]],
  ["kraftPaper", 0.18, [85, 110, 300, 300, 300]],
  ["bambooVeneer", 0.18, [null, 6, 9, 12, 13]],
  ["cottonFabric", 0.3, [300, 300, 300, 300, 300]]
];
const WATTS = [40, 60, 80, 100, 130];

export const THUNDER_BOOKS = chartBooks("Thunder Laser", WATTS, CHART, 100);
