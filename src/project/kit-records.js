/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Kits nommés dans un projet enregistré : relecture prudente et conversion des projets de la 1.9.9. */

/* Kits d'un projet relu : noms courts, identifiants uniques, nombre de kits entier (1 à 5000) ou null ;
   fillCleaner nettoie { row, how }. */
export function cleanKits(list, fillCleaner) {
  var seen = {};
  return (Array.isArray(list) ? list : [])
    .filter(function (k) {
      var ok = k && typeof k.id === "string" && /^k\d{1,4}$/.test(k.id) && !seen[k.id];
      if (ok) seen[k.id] = true;
      return ok;
    })
    .slice(0, 50)
    .map(function (k) {
      var n = Math.floor(Number(k.count));
      return {
        id: k.id,
        name: typeof k.name === "string" ? k.name.slice(0, 60) : "",
        fill: fillCleaner(k.fill),
        count: k.count != null && n >= 1 ? Math.min(n, 5000) : null
      };
    });
}

/* Projets de la 1.9.9 : une seule case « Kit » (type.kit === true) et state.kitFill → un kit « k1 ». */
export function migrateSingleKit(project, defaultName) {
  var legacy = project.types.some(function (t) {
    return t.kit === true;
  });
  if (!legacy) return;
  var kit = { id: "k1", name: defaultName, fill: project.kitFill || null, count: null };
  project.kits = [kit].concat(
    (project.kits || []).filter(function (k) {
      return k.id !== "k1";
    })
  );
  project.types.forEach(function (t) {
    if (t.kit === true) t.kit = "k1";
  });
}
