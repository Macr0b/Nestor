/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Outils sur les types de pièces : échelle, rotation autorisée, nom affiché, surface. */

import { translate } from "../i18n/i18n.js";
import { parseNumber } from "../util/numbers.js";

/* échelle par pièce : la géométrie mise à l'échelle sert au calcul, au dessin et aux exports */
export function partScale(part) {
  var percent = parseNumber(part.scale, 100);
  return percent > 0 ? percent : 100;
}

export function scaledPart(part) {
  var k = partScale(part) / 100;
  if (k === 1) return part;
  if (!part._eff || part._effK !== k) {
    part._effK = k;
    part._eff = Object.assign({}, part, {
      w: part.w * k,
      h: part.h * k,
      paths: part.paths.map(function (p) {
        return {
          closed: p.closed,
          layer: p.layer,
          color: p.color,
          pts: p.pts.map(function (q) {
            return [q[0] * k, q[1] * k];
          })
        };
      })
    });
  }
  var scaled = part._eff;
  scaled.qty = part.qty;
  scaled.on = part.on;
  scaled.rot = part.rot;
  scaled.name = part.name;
  return scaled;
}

export function rotationFromChoice(choice) {
  return choice === "free" ? "free" : choice !== "fix";
}

export function rotationChoice(part) {
  return part.rot === "free" ? "free" : part.rot ? "quarter" : "fix";
}

export function partDisplayName(part, index) {
  return part.name || (part.nameKey ? translate(part.nameKey) : translate("piece.default", { n: index + 1 }));
}

export function partArea(part) {
  var area = part.paths
    .filter(function (p) {
      return p.closed && p.pts.length > 2;
    })
    .map(function (p) {
      var a = 0,
        P = p.pts;
      for (var i = 0; i < P.length; i++) {
        var q = P[i],
          r = P[(i + 1) % P.length];
        a += q[0] * r[1] - r[0] * q[1];
      }
      return Math.abs(a / 2);
    })
    .sort(function (a, b) {
      return b - a;
    });
  if (!area.length) return part.w * part.h;
  var s = area[0];
  for (var i = 1; i < area.length; i++) s -= area[i];
  return Math.max(s, 0);
}
