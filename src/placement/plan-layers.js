/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Calcul du plan en quatre temps :
   1. panneaux figés (cadenas) : leurs pièces restent, les pièces à placer vont d'abord dans leurs trous ;
   2. le reste est placé comme d'habitude, avec le stock de panneaux restant ;
   3. kits : pour chaque kit qui remplit un panneau, dans l'ordre, le plus possible de kits entiers (les kits
      « Un seul kit » et « Nombre de kits » sont posés à l'étape 2, comme des pièces seules) ;
   4. remplissage : chaque pièce réglée sur « Remplir » occupe tout ce qui reste sur le panneau choisi. */

import { applyOrigin, panelList, panelOrigin } from "./origin.js";
import { freeRectangles, packRectangles } from "./rectangles.js";
import { nestInPlace, nestPanelByPanel, nestWithOrigin } from "./run-nesting.js";
import { lockedCounts, lockedPanelUse, resolvedLocks } from "../project/locks.js";
import { scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { kitCount, kitOf, kitRecipe, plannedQty } from "../project/kits.js";
import { parseNumber } from "../util/numbers.js";

// au plus autant de copies par remplissage (garde-fou contre une pièce minuscule sur un grand panneau)
const MAX_FILL = 5000;

/* Réglage « Remplir » d'une pièce : { row: ligne de panneau, how: "last" | "all" | "new" }, ou null. */
export function fillTarget(type) {
  var f = type && type.on !== false && !kitOf(type) && type.fill;
  return validFill(f);
}

function validFill(f) {
  return f && f.row >= 0 && ["last", "all", "new"].includes(f.how) ? f : null;
}

/* Kits qui remplissent un panneau (ceux sans remplissage sont posés une fois, comme des pièces seules). */
function fillingKits() {
  return state.kits.filter(function (kit) {
    return (
      validFill(kit.fill) &&
      state.types.some(function (t) {
        return kitOf(t) === kit;
      })
    );
  });
}

// pièce dont le kit remplit un panneau : elle n'est posée que par kits entiers
function placedByKit(type) {
  var kit = kitOf(type);
  return !!(kit && validFill(kit.fill));
}

function count(res) {
  return res.sheets.reduce(function (a, s) {
    return a + s.parts.length;
  }, 0);
}

// méthode Rectangles, sur les quantités et le stock restants
function rectanglePlan(quantities, used) {
  var types = state.types.map(scaledPart).map(function (t, i) {
    return Object.assign({}, t, { qty: quantities[i] });
  });
  return applyOrigin(
    packRectangles({ gap: state.sheet.gap, margin: state.sheet.margin, panels: panelList(used) }, types),
    function (s) {
      var o = panelOrigin(s.pi);
      return { tr: false, fx: o[1] === "r", fy: o[0] === "b", o: o, geo: false };
    }
  );
}

/* Pièces ajoutées sur des panneaux déjà garnis, sans bouger ce qui y est. Méthode Rectangles : dans l'espace libre
   qu'on peut atteindre à la scie ; sinon selon la forme, dans tous les trous. */
function inPlace(sheets, quantities, rect) {
  if (!rect) return nestInPlace(sheets, quantities);
  var gap = parseNumber(state.sheet.gap, 0),
    margin = parseNumber(state.sheet.margin, 0),
    types = state.types.map(scaledPart).map(function (t, i) {
      return Object.assign({}, t, { qty: quantities[i] });
    });
  var res = packRectangles(
    {
      gap: gap,
      margin: margin,
      panels: panelList().map(function (p) {
        return Object.assign({}, p, { qty: 0 });
      }),
      fixed: sheets.map(function (s) {
        return { pi: s.pi, L: s.L, W: s.W, free: freeRectangles(s.L, s.W, s.parts, gap, margin) };
      })
    },
    types
  );
  // repère « sur place » : les pièces restent où elles sont posées
  res.sheets.forEach(function (s) {
    s.parts.forEach(function (p) {
      p.raw = { x: p.x, y: p.y, w: p.w, h: p.h, Ln: s.L, Wn: s.W };
      p.f = { tr: false, fx: false, fy: false, o: "tl", geo: false };
      p.dx = 0;
      p.dy = 0;
    });
  });
  return Promise.resolve(res);
}

/* Calcule le plan. Rend { sheets, unplaced, count, total, res, filled: {indice de type: copies} } ;
   les panneaux figés viennent en premier (sheet.locked). */
export function computePlan() {
  var rect = state.sheet.mode === "rect",
    locks = resolvedLocks(),
    counts = lockedCounts(),
    used = lockedPanelUse();
  // pièces encore à placer : quantité moins celles déjà figées ; celles qui remplissent passent à la fin
  var kits = fillingKits();
  var toPlace = state.types.map(function (t, i) {
    if (t.on === false || fillTarget(t) || placedByKit(t)) return 0;
    return Math.max(0, plannedQty(t) - counts[i]);
  });
  var lockedParts = counts.reduce(function (a, b) {
    return a + b;
  }, 0);
  var lockedSheets = locks.map(function (l) {
    return { pi: l.pi, L: l.L, W: l.W, o: l.o, locked: true, parts: l.parts };
  });
  var holes = locks.length ? inPlace(lockedSheets, toPlace, rect) : Promise.resolve(null);
  return holes
    .then(function (h) {
      if (h)
        h.sheets.forEach(function (s, k) {
          s.parts.forEach(function (p) {
            toPlace[p.i]--;
          });
          lockedSheets[k].parts = lockedSheets[k].parts.concat(s.parts);
        });
      var rest = toPlace.some(function (q) {
        return q > 0;
      });
      if (!rest) return { sheets: [], unplaced: [], res: h ? h.res : 0 };
      if (rect) return rectanglePlan(toPlace, used);
      var specs = panelList(used),
        same = specs.every(function (p, pi) {
          return panelOrigin(pi) === panelOrigin(0);
        });
      return same
        ? nestWithOrigin(specs[0].L, specs[0].W, panelOrigin(0), null, toPlace, used)
        : nestPanelByPanel(specs, toPlace, used);
    })
    .then(function (main) {
      var plan = {
        sheets: lockedSheets.concat(main.sheets),
        unplaced: main.unplaced,
        res: main.res,
        filled: {},
        // kits entiers posés, par identifiant de kit
        kits: {}
      };
      plan.count = count(plan);
      plan.total = plan.count + plan.unplaced.length;
      countedKits(plan);
      return kitSheets(plan, kits, rect)
        .then(function () {
          return fillSheets(plan, rect);
        })
        .then(function () {
          plan.lockedParts = lockedParts;
          return plan;
        });
    });
}

/* Kits posés en nombre (« Un seul kit », « Nombre de kits ») : combien sont complets après l'étape 2. */
function countedKits(plan) {
  var placed = state.types.map(function () {
    return 0;
  });
  plan.sheets.forEach(function (s) {
    s.parts.forEach(function (p) {
      placed[p.i]++;
    });
  });
  state.kits.forEach(function (kit) {
    if (!kitCount(kit)) return;
    var recipe = kitRecipe(kit),
      complete = Infinity;
    recipe.forEach(function (q, i) {
      if (q > 0) complete = Math.min(complete, Math.floor(placed[i] / q));
    });
    if (complete !== Infinity) plan.kits[kit.id] = Math.min(complete, kitCount(kit));
  });
}

// panneaux visés par un remplissage { row, how } : le dernier de la ligne, tous, ou un nouveau (s'il en reste en stock)
function targetSheets(plan, target) {
  var spec = panelList()[target.row];
  if (!spec || !(spec.L > 0 && spec.W > 0)) return [];
  var ofRow = plan.sheets.filter(function (s) {
      return s.pi === target.row;
    }),
    sheets = target.how === "all" ? ofRow : target.how === "last" && ofRow.length ? ofRow.slice(-1) : [];
  if (sheets.length) return sheets;
  if (spec.qty >= 0 && ofRow.length >= spec.qty) return [];
  return [{ pi: target.row, L: spec.L, W: spec.W, o: panelOrigin(target.row), parts: [], fresh: true }];
}

// pose des pièces ajoutées sur un panneau ; un panneau neuf n'entre dans le plan que s'il a reçu quelque chose
function addToSheet(plan, sheet, added) {
  if (!added.length) return;
  sheet.parts = sheet.parts.concat(added);
  if (sheet.fresh) {
    delete sheet.fresh;
    plan.sheets.push(sheet);
  }
  plan.count += added.length;
  plan.total += added.length;
}

/* Kits : sur chaque panneau visé, le plus grand nombre de kits entiers. Un essai demande n kits ; on ne garde que
   les kits complets posés (les pièces en trop sont retirées), puis on redemande un kit de plus tant que ça passe. */
function kitSheets(plan, kits, rect) {
  var chain = Promise.resolve();
  kits.forEach(function (kit) {
    var recipe = kitRecipe(kit);
    plan.kits[kit.id] = 0;
    if (
      !recipe.some(function (q) {
        return q > 0;
      })
    )
      return;
    chain = chain.then(function () {
      var inner = Promise.resolve();
      targetSheets(plan, validFill(kit.fill)).forEach(function (sheet) {
        inner = inner.then(function () {
          return bestKits(sheet, recipe, rect).then(function (best) {
            addToSheet(plan, sheet, best.parts);
            plan.kits[kit.id] += best.n;
          });
        });
      });
      return inner;
    });
  });
  return chain;
}

// kits entiers dans un essai : on garde, pour chaque pièce, recette × n exemplaires (les premiers posés)
function completeKits(parts, recipe) {
  var placed = recipe.map(function () {
    return 0;
  });
  parts.forEach(function (p) {
    placed[p.i]++;
  });
  var n = Infinity;
  recipe.forEach(function (q, i) {
    if (q > 0) n = Math.min(n, Math.floor(placed[i] / q));
  });
  if (!isFinite(n)) n = 0;
  var left = recipe.map(function (q) {
    return q * n;
  });
  return {
    n: n,
    parts: parts.filter(function (p) {
      return left[p.i]-- > 0;
    })
  };
}

function bestKits(sheet, recipe, rect) {
  var margin = parseNumber(state.sheet.margin, 0),
    room = Math.max(0, sheet.L - 2 * margin) * Math.max(0, sheet.W - 2 * margin),
    kitArea = recipe.reduce(function (a, q, i) {
      var part = scaledPart(state.types[i]);
      return a + q * part.w * part.h;
    }, 0),
    upper = Math.min(MAX_FILL, Math.ceil(room / Math.max(1, kitArea)) + 1),
    best = { n: 0, parts: [] };
  function attempt(n) {
    var qty = recipe.map(function (q) {
      return q * n;
    });
    return inPlace([sheet], qty, rect).then(function (r) {
      return completeKits(r.sheets[0] ? r.sheets[0].parts : [], recipe);
    });
  }
  // 1er essai : autant de kits que la surface le permet ; puis un de plus que le meilleur, tant que ça progresse
  function grow(n, tries) {
    if (n > upper || tries > 40) return Promise.resolve(best);
    return attempt(n).then(function (got) {
      if (got.n > best.n) best = got;
      return got.n >= n ? grow(n + 1, tries + 1) : best.n + 1 === n ? best : grow(best.n + 1, tries + 1);
    });
  }
  return attempt(upper).then(function (got) {
    if (got.n > best.n) best = got;
    return best.n >= upper ? best : grow(best.n + 1, 0);
  });
}

/* Remplissage, pièce par pièce dans l'ordre de la liste, sur la ligne de panneau choisie : son dernier panneau du
   plan, tous ses panneaux, ou un nouveau panneau de cette ligne (aussi quand la ligne n'est pas encore utilisée). */
function fillSheets(plan, rect) {
  var chain = Promise.resolve();
  state.types.forEach(function (t, i) {
    var target = fillTarget(t);
    if (!target) return;
    chain = chain.then(function () {
      var inner = Promise.resolve();
      targetSheets(plan, target).forEach(function (sheet) {
        inner = inner.then(function () {
          return fillOne(plan, sheet, t, i, rect);
        });
      });
      return inner;
    });
  });
  return chain;
}

// remplit un panneau avec les copies d'une pièce ; un panneau neuf n'entre dans le plan que s'il a reçu quelque chose
function fillOne(plan, sheet, t, i, rect) {
  // copies à essayer : de quoi couvrir la zone utile (le moteur s'arrête dès qu'une copie ne trouve plus de place)
  var part = scaledPart(t),
    margin = parseNumber(state.sheet.margin, 0),
    room = Math.max(0, sheet.L - 2 * margin) * Math.max(0, sheet.W - 2 * margin),
    copies = Math.min(MAX_FILL, Math.ceil(room / Math.max(1, part.w * part.h)) + 1),
    only = state.types.map(function (u, j) {
      return j === i ? copies : 0;
    });
  return inPlace([sheet], only, rect).then(function (r) {
    var added = r.sheets[0] ? r.sheets[0].parts : [];
    if (added.length) plan.filled[i] = (plan.filled[i] || 0) + added.length;
    addToSheet(plan, sheet, added);
  });
}
