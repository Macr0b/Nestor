/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lancement du calcul en arrière-plan (Web Worker), annulation, et choix du meilleur résultat. */

import { nest } from "./nest.js";
import {
  applyOrigin,
  nestingFrame,
  panelList,
  panelOrigin,
  sheetPartPaths,
  toFramePart,
  toFramePoint,
  toPanelPlacement
} from "./origin.js";
import { scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { parseNumber } from "../util/numbers.js";

let nestWorker = null;

let nestWorkerUrl = null;

// only : n'utiliser que ce type de panneau ; qtys : quantités restantes par pièce ; used : panneaux déjà pris par ligne
function buildNestInput(frame, onlyPanel, quantities, used) {
  return {
    panels: panelList(used).map(function (p, pi) {
      var q = onlyPanel == null || onlyPanel === pi ? p.qty : 0;
      return frame.tr ? { L: p.W, W: p.L, qty: q } : { L: p.L, W: p.W, qty: q };
    }),
    gap: parseNumber(state.sheet.gap, 0),
    margin: parseNumber(state.sheet.margin, 0),
    // dans le repère de calcul, l'origine choisie est toujours sur le bord gauche (x = 0) :
    // coin → accroche en (0, 0) ; milieu d'un bord → (0, milieu) ; centre → (milieu, milieu)
    anchor: { ax: frame.o === "mc" ? 0.5 : 0, ay: frame.o[0] === "m" || frame.o[1] === "c" ? 0.5 : 0 },
    types: state.types
      .map(scaledPart)
      .map(function (t) {
        return toFramePart(t, frame);
      })
      .map(function (t, ti) {
        return {
          w: t.w,
          h: t.h,
          rot: t.rot === "free1" ? 3 : t.rot === "free" ? 2 : t.rot ? 1 : 0,
          qty: quantities ? quantities[ti] : Math.floor(parseNumber(t.qty, 0)),
          on: t.on !== false,
          polys: t.paths
            .filter(function (p) {
              return p.closed && p.pts.length >= 3;
            })
            .map(function (p) {
              return p.pts;
            }),
          lines: t.paths
            .filter(function (p) {
              return !(p.closed && p.pts.length >= 3);
            })
            .map(function (p) {
              return p.pts;
            })
        };
      })
  };
}

let rejectPendingNest = null;

// arrête le calcul en arrière-plan en cours (le résultat attendu est rejeté avec l'erreur « cancel »)
export function stopNesting() {
  if (nestWorker) {
    nestWorker.terminate();
    nestWorker = null;
  }
  if (rejectPendingNest) {
    var k = rejectPendingNest;
    rejectPendingNest = null;
    k(new Error("cancel"));
  }
}

function runNesting(input) {
  return new Promise(function (ok, ko) {
    rejectPendingNest = ko;
    function inline() {
      setTimeout(function () {
        try {
          ok(nest(input));
        } catch (x) {
          ko(x);
        }
      }, 0);
    }
    try {
      if (!nestWorkerUrl)
        nestWorkerUrl = URL.createObjectURL(
          new Blob(["var nest=" + nest.toString() + ";self.onmessage=function(e){self.postMessage(nest(e.data))};"], {
            type: "text/javascript"
          })
        );
      if (nestWorker) nestWorker.terminate();
      var w = (nestWorker = new Worker(nestWorkerUrl));
      w.onmessage = function (e) {
        ok(e.data);
      };
      w.onerror = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (nestWorker === w) nestWorker = null;
        inline();
      };
      w.postMessage(input);
    } catch (e) {
      nestWorker = null;
      inline();
    }
  });
}

// imbrication pour une origine donnée. Si le résultat demande plus d'un panneau, on essaie aussi le remplissage
// classique depuis le coin haut gauche, sans retourner le panneau (retourner le problème donne des pièces vues
// en miroir, qui ne s'emboîtent pas pareil), puis le groupe est recalé contre l'origine. On garde le résultat qui
// place le plus de pièces sur le moins de panneaux ; à égalité, celui groupé autour de l'origine.
export function nestWithOrigin(panelWidth, panelHeight, origin, onlyPanel, quantities, used) {
  var frame = nestingFrame(panelWidth, panelHeight, origin);
  return runNesting(buildNestInput(frame, onlyPanel, quantities, used)).then(function (a) {
    if (a.count === a.total && a.sheets.length <= 1) return applyOrigin(a, frame);
    var g = { tr: panelHeight > panelWidth, fx: false, fy: false, o: origin, geo: true };
    if (g.tr === frame.tr && g.fx === frame.fx && g.fy === frame.fy) return applyOrigin(a, frame);
    var inB = buildNestInput(g, onlyPanel, quantities, used);
    inB.anchor = null;
    return runNesting(inB).then(function (b) {
      var useB = b.count > a.count || (b.count === a.count && b.sheets.length < a.sheets.length);
      return useB ? applyOrigin(b, g) : applyOrigin(a, frame);
    });
  });
}

// origines différentes selon les panneaux : on remplit les types de panneaux un par un, dans l'ordre de la liste
// quantities : pièces à placer par type (toutes par défaut) ; used : panneaux déjà pris par ligne
export function nestPanelByPanel(panels, quantities, used) {
  var qtys = state.types.map(function (t, i) {
      if (quantities) return quantities[i];
      return t.on !== false ? Math.max(0, Math.floor(parseNumber(t.qty, 0))) : 0;
    }),
    total = qtys.reduce(function (a, b) {
      return a + b;
    }, 0);
  var sizeOnly = qtys.map(function () {
      return true;
    }),
    out = { sheets: [], unplaced: [], count: 0, total: total, res: 0 },
    panelIndex = 0;
  function step() {
    if (
      panelIndex >= panels.length ||
      !qtys.some(function (q) {
        return q > 0;
      })
    ) {
      qtys.forEach(function (q, i) {
        for (var k = 0; k < q; k++) out.unplaced.push({ i: i, why: sizeOnly[i] ? "size" : "stock" });
      });
      out.count = total - out.unplaced.length;
      return Promise.resolve(out);
    }
    var cur = panelIndex++,
      p = panels[cur];
    if (!(p.L > 0 && p.W > 0) || p.qty === 0) return step();
    return nestWithOrigin(p.L, p.W, panelOrigin(cur), cur, qtys.slice(), used).then(function (r) {
      r.sheets.forEach(function (s) {
        s.pi = cur;
        s.parts.forEach(function (q) {
          qtys[q.i]--;
          sizeOnly[q.i] = false;
        });
        out.sheets.push(s);
      });
      r.unplaced.forEach(function (u) {
        if (u.why !== "size") sizeOnly[u.i] = false;
      });
      out.res = Math.max(out.res, r.res || 0);
      return step();
    });
  }
  return step();
}

/* Pièces d'un panneau posé, en obstacles pour le moteur : leurs tracés dans le repère de calcul frame, relatifs au
   coin de leur encombrement. */
function obstacles(sheet, frame) {
  return sheet.parts.map(function (p) {
    var paths = sheetPartPaths(p, sheet).map(function (q) {
        return {
          closed: q.closed,
          pts: q.pts.map(function (v) {
            return toFramePoint(v, frame, sheet.L, sheet.W);
          })
        };
      }),
      x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    paths.forEach(function (q) {
      q.pts.forEach(function (v) {
        x0 = Math.min(x0, v[0]);
        y0 = Math.min(y0, v[1]);
        x1 = Math.max(x1, v[0]);
        y1 = Math.max(y1, v[1]);
      });
    });
    if (!isFinite(x0)) return { x: p.x, y: p.y, w: p.w, h: p.h, polys: [], lines: [] };
    function local(q) {
      return q.pts.map(function (v) {
        return [v[0] - x0, v[1] - y0];
      });
    }
    return {
      x: x0,
      y: y0,
      w: x1 - x0,
      h: y1 - y0,
      polys: paths
        .filter(function (q) {
          return q.closed && q.pts.length >= 3;
        })
        .map(local),
      lines: paths
        .filter(function (q) {
          return !(q.closed && q.pts.length >= 3);
        })
        .map(local)
    };
  });
}

/* Place des pièces sur des panneaux déjà garnis (panneaux figés, remplissage) sans bouger ce qui y est : les
   nouvelles pièces vont dans les trous, au plus près du repère actuel de leur ligne de panneaux (même un panneau
   figé avant un changement de repère). sheets : [{pi, L, W, parts}] ; quantities : pièces à placer par type.
   Rend { sheets, res } : ses panneaux dans l'ordre de sheets. */
export function nestInPlace(sheets, quantities) {
  var left = quantities.slice(),
    out = sheets.map(function (s) {
      return { pi: s.pi, L: s.L, W: s.W, parts: [] };
    }),
    res = 0,
    rows = [];
  sheets.forEach(function (s) {
    if (rows.indexOf(s.pi) < 0) rows.push(s.pi);
  });
  // une ligne de panneaux après l'autre : chacune a son repère
  function step(r) {
    if (r >= rows.length) return Promise.resolve({ sheets: out, res: res });
    var pi = rows[r],
      mine = sheets
        .map(function (s, k) {
          return k;
        })
        .filter(function (k) {
          return sheets[k].pi === pi;
        }),
      first = sheets[mine[0]],
      frame = nestingFrame(first.L, first.W, panelOrigin(pi)),
      input = buildNestInput(frame, null, left);
    input.panels.forEach(function (p) {
      p.qty = 0;
    });
    input.fixed = mine.map(function (k) {
      return { pi: pi, parts: obstacles(sheets[k], frame) };
    });
    return runNesting(input).then(function (got) {
      got.sheets.forEach(function (gs, j) {
        var k = mine[j];
        if (k == null) return;
        gs.parts.forEach(function (p) {
          toPanelPlacement(p, frame, gs.L, gs.W);
          left[p.i]--;
          out[k].parts.push(p);
        });
      });
      res = Math.max(res, got.res || 0);
      return step(r + 1);
    });
  }
  return step(0);
}
