/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Estimation du temps de découpe d'un plan : longueur des contours extérieurs × nombre de passes ÷ avance.
   C'est une estimation : ni les déplacements à vide, ni les plongées, ni les trous et traits intérieurs. */

/* Retour : { minutes, length (mm), passes, feed (mm/min) }, ou null si l'avance ou les passes manquent. */
export function estimateCutTime(contourLength, settings) {
  if (!settings || !(settings.feed > 0) || !(settings.passes >= 1) || !(contourLength > 0)) return null;
  return {
    minutes: (contourLength * settings.passes) / settings.feed,
    length: contourLength,
    passes: settings.passes,
    feed: settings.feed
  };
}

/* Durée arrondie pour l'affichage : minutes entières (au moins 1), heures au-delà de 60 min. */
export function splitDuration(minutes) {
  const total = Math.max(1, Math.round(minutes));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
