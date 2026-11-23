/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture des fichiers PDF et AI (Illustrator compatible PDF) avec pdf.js, chargé seulement si besoin. */

import { pathToPolylines } from "../geometry/svg-path.js";
import { translate } from "../i18n/i18n.js";
import { host } from "../util/host.js";
import { parseNumber } from "../util/numbers.js";

let pdfjsLoading = null;

// dossier de pdf.js : celui de l'appli (hors ligne), ou une adresse en ligne pour la version Claude
function pdfjsBase() {
  return (host && host.pdfBase) || new URL("../../vendor/pdfjs/", import.meta.url).href;
}

// pdf.js n'est chargé qu'au premier fichier PDF ou AI (il est gros), puis gardé pour les suivants
function loadPdfjs() {
  if (!pdfjsLoading) {
    var base = pdfjsBase();
    pdfjsLoading = import(base + "pdf.min.mjs")
      .then(function (lib) {
        lib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs";
        return lib;
      })
      .catch(function () {
        pdfjsLoading = null;
        throw new Error(translate("err.aiLoad"));
      });
  }
  return pdfjsLoading;
}

function colorToHex(rgb) {
  if (!rgb) return "";
  if (typeof rgb[0] === "string") return rgb[0];
  if (rgb.length >= 3)
    return (
      "#" +
      [rgb[0], rgb[1], rgb[2]]
        .map(function (v) {
          v = Math.round(v <= 1 && !(rgb instanceof Uint8ClampedArray) ? v * 255 : v);
          return ("0" + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
        })
        .join("")
    );
  return "";
}

function multiplyMatrices(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ];
}

// codes des opérations d'un tracé dans pdf.js 5 et plus (DrawOPS dans le code de pdf.js, non exporté)
const DRAW_MOVE_TO = 0,
  DRAW_LINE_TO = 1,
  DRAW_CURVE_TO = 2,
  DRAW_QUADRATIC_CURVE_TO = 3,
  DRAW_CLOSE_PATH = 4;

// tracé pdf.js (suite de codes et de coordonnées) -> tracé SVG (attribut d), avec la transformation en cours
function drawOpsToPathData(data, ctm) {
  function point(x, y) {
    return ctm[0] * x + ctm[2] * y + ctm[4] + " " + (ctm[1] * x + ctm[3] * y + ctm[5]);
  }
  var d = "";
  for (var i = 0; i < data.length; ) {
    var op = data[i++];
    if (op === DRAW_MOVE_TO) {
      d += "M" + point(data[i], data[i + 1]);
      i += 2;
    } else if (op === DRAW_LINE_TO) {
      d += "L" + point(data[i], data[i + 1]);
      i += 2;
    } else if (op === DRAW_CURVE_TO) {
      d +=
        "C" +
        point(data[i], data[i + 1]) +
        " " +
        point(data[i + 2], data[i + 3]) +
        " " +
        point(data[i + 4], data[i + 5]);
      i += 6;
    } else if (op === DRAW_QUADRATIC_CURVE_TO) {
      d += "Q" + point(data[i], data[i + 1]) + " " + point(data[i + 2], data[i + 3]);
      i += 4;
    } else if (op === DRAW_CLOSE_PATH) {
      d += "Z";
    } else {
      throw new Error("opération de tracé inconnue : " + op);
    }
  }
  return d;
}

// kind : "PDF" ou "AI" (seulement pour le message d'erreur : un PDF abîmé n'est pas un AI sans partie PDF)
export async function parsePdf(buf, unitOverride, kind) {
  var lib = await loadPdfjs(),
    OPS = lib.OPS,
    doc;
  try {
    doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false, disableFontFace: true })
      .promise;
  } catch (e) {
    throw new Error(translate(kind === "PDF" ? "err.pdfBad" : "err.aiNoPdf"));
  }
  var manual = unitOverride && unitOverride !== "auto",
    f = manual ? parseNumber(unitOverride, 1) : 0.352778,
    how = manual ? "how.manual" : "how.pdf";
  var paths = [],
    yOff = 0,
    pages = doc.numPages,
    warn = {},
    occ = null;
  try {
    occ = await doc.getOptionalContentConfig();
  } catch (e) {
    occ = null;
  }
  function ocName(p) {
    try {
      if (p && p.type === "OCG" && occ) {
        var g = occ.getGroup(p.id);
        return (g && g.name) || "";
      }
    } catch (e) {}
    return "";
  }
  var PAINT = {};
  [
    "stroke",
    "closeStroke",
    "fill",
    "eoFill",
    "fillStroke",
    "eoFillStroke",
    "closeFillStroke",
    "closeEOFillStroke"
  ].forEach(function (k) {
    if (OPS[k] != null) PAINT[OPS[k]] = 1;
  });
  for (var pn = 1; pn <= pages; pn++) {
    var page = await doc.getPage(pn),
      view = page.view,
      ol = await page.getOperatorList();
    var ctm = [1, 0, 0, 1, 0, 0],
      stack = [],
      stroke = "",
      fill = "",
      cs = [],
      mc = [];
    function curLayer() {
      for (var z = mc.length - 1; z >= 0; z--) if (mc[z]) return mc[z];
      return "";
    }
    for (var i = 0; i < ol.fnArray.length; i++) {
      var fn = ol.fnArray[i],
        a = ol.argsArray[i];
      if (fn === OPS.save) {
        stack.push(ctm);
        cs.push([stroke, fill]);
      } else if (fn === OPS.restore) {
        if (stack.length) ctm = stack.pop();
        var sf = cs.pop();
        if (sf) {
          stroke = sf[0];
          fill = sf[1];
        }
      } else if (fn === OPS.transform) {
        ctm = multiplyMatrices(ctm, a);
      } else if (fn === OPS.paintFormXObjectBegin) {
        stack.push(ctm);
        cs.push([stroke, fill]);
        if (a && a[0]) ctm = multiplyMatrices(ctm, a[0]);
      } else if (fn === OPS.paintFormXObjectEnd) {
        if (stack.length) ctm = stack.pop();
        var sf2 = cs.pop();
        if (sf2) {
          stroke = sf2[0];
          fill = sf2[1];
        }
      } else if (fn === OPS.beginMarkedContentProps) {
        mc.push(a && a[0] === "OC" ? ocName(a[1]) : "");
      } else if (fn === OPS.beginMarkedContent) {
        mc.push("");
      } else if (fn === OPS.endMarkedContent) {
        mc.pop();
      } else if (fn === OPS.setStrokeRGBColor) {
        stroke = colorToHex(a);
      } else if (fn === OPS.setFillRGBColor) {
        fill = colorToHex(a);
      } else if (fn === OPS.constructPath) {
        // pdf.js 5 et plus : [opération de dessin (trait, remplissage, rien…), [tracé], encombrement]
        var paintOp = a[0],
          drawOps = a[1] && a[1][0];
        if (!PAINT[paintOp] || !drawOps) continue; // tracé de découpe (clip) ou vide : rien à dessiner
        var color = paintOp !== OPS.fill && paintOp !== OPS.eoFill ? stroke : fill;
        var polylines;
        try {
          polylines = pathToPolylines(drawOpsToPathData(drawOps, ctm), f, function (q) {
            return [(q[0] - view[0]) * f, (view[3] - q[1]) * f + yOff];
          });
        } catch (e) {
          warn.paths = (warn.paths || 0) + 1;
          continue;
        }
        polylines.forEach(function (polyline) {
          paths.push({ pts: polyline.pts, closed: polyline.closed, layer: curLayer(), color: color || "" });
        });
      } else if (fn === OPS.showText && !warn.texts) {
        warn.texts = 1;
      }
    }
    yOff += (view[3] - view[1]) * f + 20;
  }
  if (pages > 1) warn.pages = pages;
  return { paths: paths, how: how, warn: warn };
}
