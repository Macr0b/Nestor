/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Coût de revient d'un plan : matière (panneaux utilisés), part perdue en chute, temps machine, réparti sur les pièces
   au prorata de leur surface. C'est une estimation : elle dépend des prix saisis et du temps de découpe estimé. */

/* sheets : [{ L, W, area (surface des pièces posées), extent: { w, h } (encombrement depuis l'origine) }]
   priceFor(L, W) : prix d'un panneau, ou null s'il manque ;
   options : { lastSheet: "full" | "used", rate (par heure), prepMinutes, cutMinutes }
   Retour : { material, waste, machine, total, missingPrice, sheets: [{ L, W, price, charged }], usedArea } */
export function planCost(sheets, priceFor, options) {
  const opts = options || {};
  let material = 0,
    chargedArea = 0,
    usedArea = 0,
    missingPrice = false;
  const lines = sheets.map(function (sheet, index) {
    const price = priceFor(sheet.L, sheet.W);
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
  const minutes = (opts.prepMinutes > 0 ? opts.prepMinutes : 0) + (opts.cutMinutes > 0 ? opts.cutMinutes : 0);
  const machine = opts.rate > 0 ? (opts.rate * minutes) / 60 : 0;
  return {
    material: material,
    waste: material * wasteShare,
    wasteShare: wasteShare,
    machine: machine,
    minutes: minutes,
    total: material + machine,
    missingPrice: missingPrice,
    sheets: lines,
    usedArea: usedArea
  };
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
