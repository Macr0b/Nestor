/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Grille de test laser : 4 puissances × 4 vitesses autour du point de départ, une couleur par case (16 au plus,
   comme la palette des logiciels laser), puissances et vitesses écrites au trait sur un calque à part. */

import { strokeText, strokeTextWidth } from "../text/stroke-font.js";

// 16 couleurs nettement différentes (celles des 16 premiers calques de LightBurn)
export const GRID_COLORS = [
  "#000000",
  "#0000ff",
  "#ff0000",
  "#00e000",
  "#d0d000",
  "#ff8000",
  "#00e0e0",
  "#ff00ff",
  "#b4b4b4",
  "#0000a0",
  "#a00000",
  "#00a000",
  "#a0a000",
  "#c08000",
  "#00a0ff",
  "#a000a0"
];
const LABEL_COLOR = "#808080";
// puissances : 2 pas en dessous, le point de départ, 1 pas au-dessus
const POWER_STEPS = [-2, -1, 0, 1];
const SPEED_FACTORS = [0.7, 0.85, 1, 1.15];
// dimensions en mm
const CELL = 10;
const GAP = 4;
const TEXT_HEIGHT = 2.5;
const MARGIN = 3;

function roundSpeed(v) {
  var step = v >= 10 ? 1 : v >= 1 ? 0.1 : 0.01;
  return Number((Math.round(v / step) * step).toFixed(4));
}

function distinct(list) {
  return list.filter(function (v, i) {
    return list.indexOf(v) === i;
  });
}

/* 4 puissances (%) espacées de 10 % du point de départ, décalées pour rester entre 1 et 100 %. */
export function gridPowers(power) {
  var step = Math.max(1, Math.round(power * 0.1)),
    list = POWER_STEPS.map(function (k) {
      return Math.round(power) + k * step;
    }),
    shift = Math.max(0, list[list.length - 1] - 100) - Math.max(0, 1 - list[0]);
  return list.map(function (v) {
    return Math.max(1, Math.min(100, v - shift));
  });
}

/* Vitesses autour du point de départ (même unité que celle donnée). */
export function gridSpeeds(speed) {
  return distinct(
    SPEED_FACTORS.map(function (f) {
      return roundSpeed(speed * f);
    })
  );
}

function formatValue(v, decimal) {
  return String(v).replace(".", decimal);
}

/* Grille : { paths, width, height, cells: [{ power, speed, color }] }, en mm, Y vers le bas.
   unitLabel : "%" ou "mm/s" ; decimal : séparateur décimal affiché ; layers : noms des calques { cell, labels }. */
export function buildTestGrid(power, speed, unitLabel, decimal, layers) {
  var powers = gridPowers(power),
    speeds = gridSpeeds(speed);
  var speedTexts = speeds.map(function (v) {
      return formatValue(v, decimal);
    }),
    powerTexts = powers.map(function (v) {
      return v + "%";
    });
  var labelWidth =
      Math.max.apply(
        null,
        powerTexts.map(function (t) {
          return strokeTextWidth(t, TEXT_HEIGHT);
        })
      ) + 3,
    columnWidth = Math.max(
      CELL,
      Math.max.apply(
        null,
        speedTexts.map(function (t) {
          return strokeTextWidth(t, TEXT_HEIGHT);
        })
      )
    ),
    headerHeight = 2 * TEXT_HEIGHT + 5,
    left = MARGIN + labelWidth,
    top = MARGIN + headerHeight;
  var paths = [],
    cells = [];
  function label(text, cx, cy) {
    strokeText(text, cx, cy, TEXT_HEIGHT).forEach(function (pts) {
      paths.push({ pts: pts, closed: false, layer: layers.labels, color: LABEL_COLOR });
    });
  }
  // en-tête : unité des vitesses, puis une vitesse par colonne
  label(unitLabel, left + strokeTextWidth(unitLabel, TEXT_HEIGHT) / 2, MARGIN + TEXT_HEIGHT / 2);
  speeds.forEach(function (v, c) {
    label(speedTexts[c], left + c * (columnWidth + GAP) + columnWidth / 2, MARGIN + TEXT_HEIGHT * 1.5 + 3);
  });
  powers.forEach(function (p, r) {
    var y = top + r * (CELL + GAP);
    label(powerTexts[r], MARGIN + (labelWidth - 3) / 2, y + CELL / 2);
    speeds.forEach(function (v, c) {
      var x = left + c * (columnWidth + GAP) + (columnWidth - CELL) / 2,
        color = GRID_COLORS[(r * speeds.length + c) % GRID_COLORS.length];
      paths.push({
        pts: [
          [x, y],
          [x + CELL, y],
          [x + CELL, y + CELL],
          [x, y + CELL]
        ],
        closed: true,
        layer: layers.cell + " " + p + "% " + formatValue(v, decimal) + " " + unitLabel,
        color: color
      });
      cells.push({ power: p, speed: v, color: color });
    });
  });
  return {
    paths: paths,
    width: left + speeds.length * (columnWidth + GAP) - GAP + MARGIN,
    height: top + powers.length * (CELL + GAP) - GAP + MARGIN,
    cells: cells
  };
}
