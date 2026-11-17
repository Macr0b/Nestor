/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Dessin des panneaux et des pièces à l'écran (SVG), et vignettes des pièces. */

import { sheetOffcutCuts, sheetSawCuts } from "../export/export-files.js";
import { badgeHalfWidth, placeSawLabels } from "../export/saw-labels.js";
import { partNumberSpot, partNumberText } from "../export/part-numbers.js";
import { labelHeight } from "../geometry/label-spot.js";
import { translate } from "../i18n/i18n.js";
import { showLength } from "./lengths.js";
import { originPoint, sheetPartPaths } from "../placement/origin.js";
import { partDisplayName, scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { escapeHtml } from "../util/dom.js";
import { parseNumber, round2 } from "../util/numbers.js";

function pathData(paths, closedOnly) {
  return paths
    .filter(function (p) {
      return p.closed === closedOnly;
    })
    .map(function (p) {
      return (
        "M" +
        p.pts
          .map(function (q) {
            return round2(q[0]) + " " + round2(q[1]);
          })
          .join("L") +
        (p.closed ? "Z" : "")
      );
    })
    .join("");
}

export function partThumbnail(part) {
  var pad = Math.max(part.w, part.h) * 0.06;
  return (
    '<svg viewBox="' +
    -pad +
    " " +
    -pad +
    " " +
    (part.w + 2 * pad) +
    " " +
    (part.h + 2 * pad) +
    '" aria-hidden="true"><path class="svg-piece" d="' +
    pathData(part.paths, true) +
    '"/><path class="svg-open" d="' +
    pathData(part.paths, false) +
    '"/></svg>'
  );
}

/* Coupes à la scie numérotées : trait plein, numéro dans une pastille posée là où elle gêne le moins. */
function drawSawCuts(svg, cuts, strokeWidth, sheet) {
  var r = Math.max(sheet.L, sheet.W) * 0.008,
    spots = placeSawLabels(cuts, sheet.parts, r, { w: sheet.L, h: sheet.W });
  cuts.forEach(function (c) {
    svg.push(
      '<line class="svg-saw" x1="' +
        c.x1 +
        '" y1="' +
        c.y1 +
        '" x2="' +
        c.x2 +
        '" y2="' +
        c.y2 +
        '" stroke-width="' +
        strokeWidth * 1.4 +
        '"/>'
    );
  });
  // pastilles après tous les traits, pour qu'aucun trait ne passe dessus
  spots.forEach(function (spot, n) {
    var label = String(n + 1),
      rr = spot.r,
      half = badgeHalfWidth(rr, label.length);
    svg.push(
      '<g class="svg-saw-n"><rect x="' +
        (spot.x - half) +
        '" y="' +
        (spot.y - rr) +
        '" width="' +
        half * 2 +
        '" height="' +
        rr * 2 +
        '" rx="' +
        rr +
        '"/><text x="' +
        spot.x +
        '" y="' +
        (spot.y + rr * 0.42) +
        '" text-anchor="middle" font-size="' +
        rr * 1.25 +
        '">' +
        label +
        "</text></g>"
    );
  });
}

export function renderSheetSvg(resultSheet) {
  var panelWidth = resultSheet.L,
    panelHeight = resultSheet.W,
    edgeMargin = parseNumber(state.sheet.margin, 0),
    strokeWidth = Math.max(panelWidth, panelHeight) / 600,
    // repère d'origine : rayon du cercle et longueur des branches de la croix
    markerRadius = Math.max(panelWidth, panelHeight) * 0.009,
    arm = markerRadius * 1.7,
    // marge autour du panneau : assez grande pour que le repère reste entier quand il est dans un coin
    pad = Math.max(Math.max(panelWidth, panelHeight) * 0.015, arm + strokeWidth * 1.4);
  var id = "h" + Math.random().toString(36).slice(2, 8),
    hs = Math.max(panelWidth, panelHeight) / 70;
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      -pad +
      " " +
      -pad +
      " " +
      (panelWidth + 2 * pad) +
      " " +
      (panelHeight + 2 * pad) +
      '" role="img" aria-label="' +
      escapeHtml(translate("res.panelAria", { w: showLength(panelHeight), h: showLength(panelWidth) })) +
      '">'
  ];
  svg.push(
    '<defs><pattern id="' +
      id +
      '" width="' +
      hs +
      '" height="' +
      hs +
      '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="' +
      hs +
      '" stroke-width="' +
      strokeWidth * 0.8 +
      '" style="stroke:var(--hatch)"/></pattern></defs>'
  );
  svg.push(
    '<rect class="svg-panel" x="0" y="0" width="' +
      panelWidth +
      '" height="' +
      panelHeight +
      '" stroke-width="' +
      strokeWidth +
      '"/><rect x="0" y="0" width="' +
      panelWidth +
      '" height="' +
      panelHeight +
      '" fill="url(#' +
      id +
      ')"/>'
  );
  if (edgeMargin > 0)
    svg.push(
      '<rect class="svg-margin" x="' +
        edgeMargin +
        '" y="' +
        edgeMargin +
        '" width="' +
        (panelWidth - 2 * edgeMargin) +
        '" height="' +
        (panelHeight - 2 * edgeMargin) +
        '" stroke-width="' +
        strokeWidth * 0.7 +
        '" stroke-dasharray="' +
        strokeWidth * 6 +
        " " +
        strokeWidth * 4 +
        '"/>'
    );
  resultSheet.parts.forEach(function (p) {
    var t = state.types[p.i],
      te = scaledPart(t),
      pp = sheetPartPaths(p, resultSheet);
    svg.push(
      '<path class="svg-piece' +
        (p.i % 2 ? " alt" : "") +
        '" stroke-width="' +
        strokeWidth +
        '" d="' +
        pathData(pp, true) +
        '"><title>' +
        escapeHtml(partDisplayName(t, p.i)) +
        " — " +
        showLength(te.w) +
        " × " +
        showLength(te.h) +
        "</title></path>"
    );
    var od = pathData(pp, false);
    if (od) svg.push('<path class="svg-open" stroke-width="' + strokeWidth + '" d="' + od + '"/>');
    // numéro au même endroit que le numéro gravé : dans la matière, loin des traits (hors des trous et des creux)
    var spot = partNumberSpot(p, resultSheet),
      maxSize = Math.max(panelWidth, panelHeight) * 0.03,
      fs = spot
        ? Math.min(labelHeight(partNumberText(p), spot.radius, 0, Infinity) * 1.3, maxSize)
        : Math.min(Math.min(p.w, p.h) * 0.4, maxSize),
      nx = spot ? spot.x : p.x + p.w / 2,
      ny = spot ? spot.y : p.y + p.h / 2;
    svg.push(
      '<text class="svg-num" x="' +
        nx +
        '" y="' +
        (ny + fs * 0.35) +
        '" text-anchor="middle" font-size="' +
        fs +
        '" stroke-width="' +
        fs * 0.15 +
        '">' +
        partNumberText(p) +
        "</text>"
    );
  });
  // ordre des coupes à la scie : il remplace les traits de chutes (il dégage déjà tout)
  var sawCuts = sheetSawCuts(resultSheet);
  drawSawCuts(svg, sawCuts, strokeWidth, resultSheet);
  // traits de coupe des chutes, avec la taille de chaque chute
  var offcuts = sawCuts.length ? { cuts: [], chutes: [] } : sheetOffcutCuts(resultSheet);
  offcuts.chutes.forEach(function (c) {
    // texte écrit dans le sens de la plus grande longueur de la chute, et réduit pour tenir dedans
    var label = translate("cuts.chute", { w: showLength(c.w), h: showLength(c.h) }),
      vertical = c.h > c.w,
      long = vertical ? c.h : c.w,
      short = vertical ? c.w : c.h,
      fsz = Math.min(short * 0.45, (long * 0.85) / (label.length * 0.62), Math.max(panelWidth, panelHeight) * 0.022);
    if (fsz < Math.max(panelWidth, panelHeight) * 0.008) return; // trop petit pour être lisible : on ne l'écrit pas
    var cx = c.x + c.w / 2,
      cy = c.y + c.h / 2;
    svg.push(
      '<text class="svg-chute" x="' +
        cx +
        '" y="' +
        (cy + fsz * 0.35) +
        '" text-anchor="middle" font-size="' +
        fsz +
        '"' +
        (vertical ? ' transform="rotate(-90 ' + cx + " " + cy + ')"' : "") +
        ">" +
        escapeHtml(label) +
        "</text>"
    );
  });
  offcuts.cuts.forEach(function (c) {
    svg.push(
      '<line class="svg-cut" x1="' +
        c[0] +
        '" y1="' +
        c[1] +
        '" x2="' +
        c[2] +
        '" y2="' +
        c[3] +
        '" stroke-width="' +
        strokeWidth * 1.6 +
        '" stroke-dasharray="' +
        strokeWidth * 8 +
        " " +
        strokeWidth * 5 +
        '"/>'
    );
  });
  // repère d'origine (zéro machine)
  var origin = originPoint(resultSheet);
  svg.push(
    '<g class="svg-origin" stroke-width="' +
      strokeWidth * 1.4 +
      '"><circle cx="' +
      origin[0] +
      '" cy="' +
      origin[1] +
      '" r="' +
      markerRadius +
      '"/><path d="M' +
      (origin[0] - arm) +
      " " +
      origin[1] +
      "H" +
      (origin[0] + arm) +
      "M" +
      origin[0] +
      " " +
      (origin[1] - arm) +
      "V" +
      (origin[1] + arm) +
      '"/></g>'
  );
  svg.push("</svg>");
  return svg.join("");
}
