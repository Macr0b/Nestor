/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Coût de revient d'un plan : matière (panneaux utilisés), part perdue en chute, temps machine, réparti sur les pièces
   au prorata de leur surface. C'est une estimation : elle dépend des prix saisis et du temps de découpe estimé. */

/* sheets : [{ L, W, area (surface des pièces posées), extent: { w, h } (encombrement depuis l'origine), offcut }]
   priceFor(L, W, offcut) : prix d'un panneau (offcut : c'est une chute), ou null s'il manque ;
   options : { lastSheet: "full" | "used", rate (machine, par heure), laborRate (main-d'œuvre, par heure),
     cutMinutes (temps machine), prepMinutes (temps de main-d'œuvre), roundMachine, roundLabor (toute heure commencée) }
   Retour : { material, waste, machine, labor, total, missingPrice, sheets: [{ L, W, price, charged }], usedArea,
     machineTime: { minutes, billed }, laborTime: { minutes, billed } } */
export function planCost(sheets, priceFor, options) {
  const opts = options || {};
  let material = 0,
    chargedArea = 0,
    usedArea = 0,
    missingPrice = false;
  const lines = sheets.map(function (sheet, index) {
    const price = priceFor(sheet.L, sheet.W, sheet.offcut === true);
    if (price == null) missingPrice = true;
    // dernier panneau : entier, ou seulement le rectangle occupé depuis l'origine (la chute retourne en stock)
    let share = 1;
    if (opts.lastSheet === "used" && index === sheets.length - 1 && sheet.extent) {
      share = Math.min(1, (sheet.extent.w * sheet.extent.h) / (sheet.L * sheet.W));
    }
    const charged = price == null ? 0 : price * share;
    material += charged;
    chargedArea += sheet.L * sheet.W * share;
    usedArea += sheet.area;
    return { L: sheet.L, W: sheet.W, price: price, charged: charged, share: share };
  });
  const wasteShare = chargedArea > 0 ? Math.max(0, 1 - usedArea / chargedArea) : 0;
  const machineTime = billedTime(opts.cutMinutes, opts.roundMachine),
    laborTime = billedTime(opts.prepMinutes, opts.roundLabor);
  const machine = opts.rate > 0 ? (opts.rate * machineTime.billed) / 60 : 0,
    labor = opts.laborRate > 0 ? (opts.laborRate * laborTime.billed) / 60 : 0;
  return {
    material: material,
    waste: material * wasteShare,
    wasteShare: wasteShare,
    machine: machine,
    labor: labor,
    machineTime: machineTime,
    laborTime: laborTime,
    total: material + machine + labor,
    missingPrice: missingPrice,
    sheets: lines,
    usedArea: usedArea
  };
}

/* Temps compté : les minutes, ou toute heure commencée comptée entière (1 h 08 → 2 h). */
function billedTime(minutes, wholeHours) {
  const m = minutes > 0 ? minutes : 0;
  return { minutes: m, billed: wholeHours && m > 0 ? Math.ceil(m / 60 - 1e-9) * 60 : m };
}

/* Coût de chaque type de pièce : le total réparti au prorata de la surface (pièces posées seulement).
   parts : [{ key, area, count }] → [{ key, unit, total }] */
export function costPerPart(parts, total) {
  const area = parts.reduce((sum, p) => sum + p.area * p.count, 0);
  return parts.map(function (p) {
    const unit = area > 0 ? (total * p.area) / area : 0;
    return { key: p.key, unit: unit, total: unit * p.count };
  });
}
