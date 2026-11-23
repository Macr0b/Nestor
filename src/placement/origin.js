/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Origine de chaque panneau (9 positions) : repère de calcul (le problème est retourné pour que l'origine
   tombe sur le bord gauche), puis retour au repère du panneau et calage du groupe de pièces contre l'origine. */

import { placedPartPaths } from "../geometry/placed-parts.js";
import { scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { parseNumber } from "../util/numbers.js";

// portrait : la longueur saisie est verticale (Y), la largeur horizontale (X) ; en interne L = étendue en X, W = étendue en Y
// used : panneaux déjà pris par ligne (panneaux figés), retirés du stock ; -1 = stock illimité
export function panelList(used) {
  return (state.sheet.panels || []).map(function (p, pi) {
    var taken = (used && used[pi]) || 0;
    return {
      L: parseNumber(p.W, 0),
      W: parseNumber(p.L, 0),
      qty: p.qty === "" || p.qty == null ? -1 : Math.max(0, Math.floor(parseNumber(p.qty, 0)) - taken)
    };
  });
}

/* origine : 9 positions (t/m/b × l/c/r) ; les pièces se regroupent depuis ce point et c'est le zéro des exports */
// origine propre à chaque type de panneau (toutes les feuilles d'une même ligne la partagent)
export function validOrigin(origin) {
  return /^[tmb][lcr]$/.test(origin || "") ? origin : "tl";
}

export function panelOrigin(panelIndex) {
  var panel = (state.sheet.panels || [])[panelIndex];
  return validOrigin(panel && panel.origin);
}

export function originPoint(sheet) {
  var origin = sheet.o || panelOrigin(sheet.pi || 0);
  return [
    origin[1] === "l" ? 0 : origin[1] === "c" ? sheet.L / 2 : sheet.L,
    origin[0] === "t" ? 0 : origin[0] === "m" ? sheet.W / 2 : sheet.W
  ];
}

// repère de calcul : on transpose et/ou retourne le problème pour que l'origine choisie tombe sur le bord gauche
// (coin en haut à gauche, ou milieu du bord gauche, ou centre) ; l'imbrication groupe les pièces autour de ce
// point d'accroche (voir anchor dans nestInput), puis on revient au repère du panneau.
export function nestingFrame(panelWidth, panelHeight, origin) {
  var row = origin[0],
    column = origin[1],
    transpose;
  if (row === "m" && column !== "c") transpose = false;
  else if (column === "c" && row !== "m") transpose = true;
  else transpose = panelHeight > panelWidth;
  return transpose
    ? { tr: true, fx: row === "b", fy: column === "r", o: origin, geo: true }
    : { tr: false, fx: column === "r", fy: row === "b", o: origin, geo: true };
}

export function toFramePart(part, frame) {
  if (!frame.tr && !frame.fx && !frame.fy) return part;
  var key = (frame.tr ? "t" : "") + (frame.fx ? "x" : "") + (frame.fy ? "y" : "");
  part._xf = part._xf || {};
  var cached = part._xf[key];
  if (!cached || cached.src !== part.paths || cached.w !== part.w) {
    var w = frame.tr ? part.h : part.w,
      h = frame.tr ? part.w : part.h;
    cached = part._xf[key] = {
      src: part.paths,
      w: part.w,
      t: Object.assign({}, part, {
        w: w,
        h: h,
        paths: part.paths.map(function (p) {
          return {
            closed: p.closed,
            layer: p.layer,
            color: p.color,
            pts: p.pts.map(function (q) {
              var x = frame.tr ? q[1] : q[0],
                y = frame.tr ? q[0] : q[1];
              return [frame.fx ? w - x : x, frame.fy ? h - y : y];
            })
          };
        })
      })
    };
  }
  var m = cached.t;
  m.qty = part.qty;
  m.on = part.on;
  m.rot = part.rot;
  return m;
}

// ramène la mise en page au repère du panneau, puis centre le groupe si l'origine est au milieu d'un bord ou au centre
export function applyOrigin(res, fOf) {
  var edgeMargin = parseNumber(state.sheet.margin, 0);
  res.sheets.forEach(function (s) {
    var f = typeof fOf === "function" ? fOf(s) : fOf,
      o = f.o;
    s.o = o;
    var Ln = s.L,
      Wn = s.W;
    if (f.tr) {
      s.L = Wn;
      s.W = Ln;
    }
    s.parts.forEach(function (p) {
      p.raw = { x: p.x, y: p.y, w: p.w, h: p.h, Ln: Ln, Wn: Wn };
      p.f = f;
      var x = f.fx ? Ln - p.x - p.w : p.x,
        y = f.fy ? Wn - p.y - p.h : p.y;
      if (f.tr) {
        p.x = y;
        p.y = x;
        var w = p.w;
        p.w = p.h;
        p.h = w;
      } else {
        p.x = x;
        p.y = y;
      }
      p.dx = 0;
      p.dy = 0;
    });
    // le groupe de pièces est calé contre l'origine (ou centré) : utile quand le calcul est parti d'un autre coin
    if (s.parts.length) {
      var x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      s.parts.forEach(function (p) {
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x + p.w);
        y1 = Math.max(y1, p.y + p.h);
      });
      var dx =
          o[1] === "c"
            ? edgeMargin + (s.L - 2 * edgeMargin - (x1 - x0)) / 2 - x0
            : o[1] === "r"
              ? s.L - edgeMargin - x1
              : edgeMargin - x0,
        dy =
          o[0] === "m"
            ? edgeMargin + (s.W - 2 * edgeMargin - (y1 - y0)) / 2 - y0
            : o[0] === "b"
              ? s.W - edgeMargin - y1
              : edgeMargin - y0;
      s.parts.forEach(function (p) {
        p.x += dx;
        p.y += dy;
        p.dx = dx;
        p.dy = dy;
      });
    }
    if (s.free)
      s.free.forEach(function (r) {
        if (f.tr) {
          var w = r.w;
          r.w = r.h;
          r.h = w;
        }
      });
  });
  return res;
}

export function sheetPartPaths(placed, sheet) {
  var part = scaledPart(state.types[placed.i]),
    frame = placed.f || {},
    rawPlacement = placed.raw;
  if (!rawPlacement) return placedPartPaths(part, placed);
  if (frame.geo) {
    var q = Object.assign({}, placed, { x: rawPlacement.x, y: rawPlacement.y, w: rawPlacement.w, h: rawPlacement.h });
    return placedPartPaths(toFramePart(part, frame), q).map(function (r) {
      return {
        closed: r.closed,
        layer: r.layer,
        color: r.color,
        pts: r.pts.map(function (v) {
          var x = frame.fx ? rawPlacement.Ln - v[0] : v[0],
            y = frame.fy ? rawPlacement.Wn - v[1] : v[1];
          if (frame.tr) {
            var z = x;
            x = y;
            y = z;
          }
          return [x + placed.dx, y + placed.dy];
        })
      };
    });
  }
  // rectangles : seuls les encombrements sont déplacés, la pièce garde son orientation
  var q2 = Object.assign({}, placed, { x: rawPlacement.x, y: rawPlacement.y, w: rawPlacement.w, h: rawPlacement.h }),
    ox = placed.x - rawPlacement.x,
    oy = placed.y - rawPlacement.y;
  return placedPartPaths(part, q2).map(function (r) {
    return {
      closed: r.closed,
      layer: r.layer,
      color: r.color,
      pts: r.pts.map(function (v) {
        return [v[0] + ox, v[1] + oy];
      })
    };
  });
}
