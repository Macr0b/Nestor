/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Calcul du plan en trois temps :
   1. panneaux figés (cadenas) : leurs pièces restent, les pièces à placer vont d'abord dans leurs trous ;
   2. le reste est placé comme d'habitude, avec le stock de panneaux restant ;
   3. remplissage : chaque pièce réglée sur « Remplir » occupe tout ce qui reste sur le panneau choisi. */

import { applyOrigin, panelList, panelOrigin } from "./origin.js";
import { freeRectangles, packRectangles } from "./rectangles.js";
import { nestInPlace, nestPanelByPanel, nestWithOrigin } from "./run-nesting.js";
import { lockedCounts, lockedPanelUse, resolvedLocks } from "../project/locks.js";
import { scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { parseNumber } from "../util/numbers.js";

// au plus autant de copies par remplissage (garde-fou contre une pièce minuscule sur un grand panneau)
const MAX_FILL = 5000;

/* Réglage « Remplir » d'une pièce : { row: ligne de panneau, how: "last" | "all" | "new" }, ou null. */
export function fillTarget(type) {
  var f = type && type.on !== false && type.fill;
  return f && f.row >= 0 && ["last", "all", "new"].includes(f.how) ? f : null;
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
  var toPlace = state.types.map(function (t, i) {
    if (t.on === false || fillTarget(t)) return 0;
    return Math.max(0, Math.floor(parseNumber(t.qty, 0)) - counts[i]);
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
        filled: {}
      };
      plan.count = count(plan);
      plan.total = plan.count + plan.unplaced.length;
      return fillSheets(plan, rect).then(function () {
        plan.lockedParts = lockedParts;
        return plan;
      });
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
      var spec = panelList()[target.row];
      if (!spec || !(spec.L > 0 && spec.W > 0)) return;
      var ofRow = plan.sheets.filter(function (s) {
          return s.pi === target.row;
        }),
        sheets = target.how === "all" ? ofRow : target.how === "last" && ofRow.length ? ofRow.slice(-1) : [];
      if (!sheets.length) {
        // nouveau panneau de cette ligne, s'il en reste en stock
        if (spec.qty >= 0 && ofRow.length >= spec.qty) return;
        sheets = [{ pi: target.row, L: spec.L, W: spec.W, o: panelOrigin(target.row), parts: [], fresh: true }];
      }
      var inner = Promise.resolve();
      sheets.forEach(function (sheet) {
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
    if (!added.length) return;
    sheet.parts = sheet.parts.concat(added);
    if (sheet.fresh) {
      delete sheet.fresh;
      plan.sheets.push(sheet);
    }
    plan.filled[i] = (plan.filled[i] || 0) + added.length;
    plan.count += added.length;
    plan.total += added.length;
  });
}
