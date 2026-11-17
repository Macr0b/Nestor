/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Point de départ laser pour une machine donnée, tiré des livrets Trotec (60, 80 et 120 W).
   Même puissance qu'un livret : valeurs publiées telles quelles. Autre puissance : on garde l'énergie déposée
   par millimètre (puissance × % / vitesse), interpolée entre les livrets voisins. Autre épaisseur : vitesse
   proportionnelle à l'épaisseur publiée la plus proche. Tout le reste est une estimation à tester. */

import { laserMaterial, SOURCES } from "./reference-sources.js";

export const MACHINE_KINDS = ["co2", "diode", "fiber"];
export const LASER_OPS = ["cut", "engrave", "engraveDark"];
// vitesse maximale de référence des livrets (Speedy 360) : 100 % de vitesse = 3550 mm/s
export const TROTEC_FULL_SPEED = 3550;
// au-delà de cette épaisseur (mm), le laser ne sert qu'à graver : la découpe passe par la fraiseuse
export const LASER_CUT_LIMIT = 10;

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

// pas d'arrondi de la vitesse (%) : assez fin pour garder les valeurs publiées (0,05 ; 1,2 ; 1,8…)
export function speedStep(speed) {
  return speed >= 10 ? 0.5 : speed >= 1 ? 0.1 : 0.01;
}

function sourceOf(material) {
  var m = laserMaterial(material);
  return m ? SOURCES[m.source] : null;
}

/* Épaisseurs publiées pour une matière en découpe (pour proposer les bonnes valeurs). */
export function publishedThicknesses(material) {
  var set = {},
    source = sourceOf(material);
  if (!source) return [];
  source.books.forEach(function (book) {
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
  if (op === "cut" && thickness > LASER_CUT_LIMIT) return null;
  var source = sourceOf(material);
  if (!source) return null;
  var watts = machine.watts,
    t = op === "cut" ? Math.max(0.1, thickness || 0) : 0;
  // découpe : on part de l'épaisseur publiée la plus proche, et seulement des puissances qui la coupent
  var thicknessRef = null;
  if (op === "cut") {
    var published = publishedThicknesses(material);
    if (!published.length) return null;
    thicknessRef = published.reduce(function (best, v) {
      return Math.abs(v - t) < Math.abs(best - t) ? v : best;
    });
  }
  var books = source.books
    .map(function (book) {
      return { book: book, row: bookRow(book, material, op, thicknessRef == null ? t : thicknessRef) };
    })
    .filter(function (x) {
      return x.row && (thicknessRef == null || x.row.thickness === thicknessRef);
    });
  if (!books.length) return null;
  // trop faible : la source ne coupe cette épaisseur qu'à partir d'une certaine puissance
  var minWatts = Math.min.apply(
    null,
    books.map(function (x) {
      return x.book.watts;
    })
  );
  if (source.maxLineSpeed && watts < minWatts) return { tooWeak: minWatts };
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
  // vitesse dans l'unité de la source, puis dans l'autre (100 % = vitesse maximale de la Speedy 360)
  var percent = source.unit === "mmps" ? (speed / TROTEC_FULL_SPEED) * 100 : speed,
    mm = source.unit === "mmps" ? speed : (speed / 100) * TROTEC_FULL_SPEED;
  percent = Math.max(0.01, round(percent, speedStep(percent)));
  return {
    power: power,
    speed: percent,
    speedMm: round(mm, 0.1),
    maxLineSpeed: !!source.maxLineSpeed,
    source: laserMaterial(material).source,
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
