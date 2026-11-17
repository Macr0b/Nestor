/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Point de départ laser pour une machine donnée, tiré des livrets Trotec (60, 80 et 120 W).
   Même puissance qu'un livret : valeurs publiées telles quelles. Autre puissance : on garde l'énergie déposée
   par millimètre (puissance × % / vitesse), interpolée entre les livrets voisins. Autre épaisseur : vitesse
   proportionnelle à l'épaisseur publiée la plus proche. Tout le reste est une estimation à tester. */

import { TROTEC_BOOKS } from "./trotec-books.js";

export const MACHINE_KINDS = ["co2", "diode", "fiber"];
export const LASER_OPS = ["cut", "engrave", "engraveDark"];
// vitesse maximale de référence des livrets (Speedy 360) : 100 % de vitesse = 3550 mm/s
export const TROTEC_FULL_SPEED = 3550;

// arrondi au pas donné, sans reste de virgule flottante (0,6 et non 0,6000000000000001)
function round(value, step) {
  return Number((Math.round(value / step) * step).toFixed(4));
}

// ligne d'un livret pour une matière, une opération et une épaisseur (la plus proche pour la découpe)
function bookRow(book, material, op, thickness) {
  var list = book.rows.filter(function (r) {
    return r.material === material && r.op === op;
  });
  if (!list.length) return null;
  if (op !== "cut") return list[0];
  return list.reduce(function (best, r) {
    return Math.abs(r.thickness - thickness) < Math.abs(best.thickness - thickness) ? r : best;
  });
}

// énergie relative déposée : watts × puissance % / vitesse % (même unité pour tous les livrets)
function energy(watts, row) {
  return (watts * row.power) / row.speed;
}

/* Épaisseurs publiées pour une matière en découpe (pour proposer les bonnes valeurs). */
export function publishedThicknesses(material) {
  var set = {};
  TROTEC_BOOKS.forEach(function (book) {
    book.rows.forEach(function (r) {
      if (r.material === material && r.op === "cut") set[r.thickness] = true;
    });
  });
  return Object.keys(set)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    });
}

/* machine : { kind, watts, trotec }
   Renvoie null si aucune valeur n'existe (pas CO2, matière ou opération inconnue), sinon :
   { power, speed (%), speedMm (mm/s), frequency, zOffset, passes, published, bookWatts, thicknessFrom } */
export function laserSettings(machine, material, op, thickness) {
  if (!machine || machine.kind !== "co2" || !(machine.watts > 0)) return null;
  var watts = machine.watts,
    t = op === "cut" ? Math.max(0.1, thickness || 0) : 0;
  var books = TROTEC_BOOKS.map(function (book) {
    return { book: book, row: bookRow(book, material, op, t) };
  }).filter(function (x) {
    return x.row;
  });
  if (!books.length) return null;
  // livret de la même puissance ; sinon les deux voisins (ou le plus proche hors de la plage)
  var exact = books.find(function (x) {
    return x.book.watts === watts;
  });
  var below = books.filter(function (x) {
      return x.book.watts < watts;
    }),
    above = books.filter(function (x) {
      return x.book.watts > watts;
    }),
    lower = below[below.length - 1],
    upper = above[0],
    nearest =
      exact ||
      books.reduce(function (best, x) {
        return Math.abs(x.book.watts - watts) < Math.abs(best.book.watts - watts) ? x : best;
      });
  var row = nearest.row,
    power = row.power,
    speed = row.speed;
  if (!exact) {
    var target;
    if (lower && upper) {
      var k = (watts - lower.book.watts) / (upper.book.watts - lower.book.watts);
      target = energy(lower.book.watts, lower.row) * (1 - k) + energy(upper.book.watts, upper.row) * k;
    } else target = energy(nearest.book.watts, row);
    if (op === "cut") {
      // découpe : même puissance % que le livret le plus proche, vitesse ajustée
      speed = (watts * power) / target;
    } else {
      // gravure : même vitesse, puissance ajustée (bornée à 100 %, la vitesse baisse alors)
      power = (target * speed) / watts;
      if (power > 100) {
        power = 100;
        speed = (watts * 100) / target;
      }
    }
  }
  // autre épaisseur que celle publiée : vitesse proportionnelle à l'épaisseur
  var thicknessFrom = op === "cut" && Math.abs(row.thickness - t) > 0.05 ? row.thickness : null;
  if (thicknessFrom) speed = (speed * row.thickness) / t;
  power = Math.min(100, round(power, 1));
  speed = speed >= 1 ? round(speed, 0.5) : round(speed, 0.05);
  speed = Math.max(0.05, speed);
  return {
    power: power,
    speed: speed,
    speedMm: round((speed / 100) * TROTEC_FULL_SPEED, 0.1),
    frequency: row.frequency,
    zOffset: row.zOffset,
    passes: 1,
    published: !!exact && !thicknessFrom,
    bookWatts: nearest.book.watts,
    thicknessFrom: thicknessFrom
  };
}

/* Vitesse à régler : en % sur une Trotec (comme ses livrets), en mm/s sur les autres machines. */
export function speedForMachine(machine, settings) {
  if (machine.trotec) return { value: settings.speed, unit: "percent" };
  return { value: settings.speedMm, unit: "mmps" };
}
