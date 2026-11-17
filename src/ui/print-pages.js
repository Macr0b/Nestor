/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Pages du PDF à imprimer, dessinées dans la langue de l'appli : un panneau par page (plan numéroté, cotes,
   zéro machine, liste de ses pièces) et, pour le plan entier, une page de résumé avant les panneaux.
   A4 en métrique, Letter en impérial ; la liste longue continue sur les pages suivantes. */

import { partNumberSpot, partNumberText } from "../export/part-numbers.js";
import { buildPdf, mmToPt, PAPER } from "../export/pdf-writer.js";
import { labelHeight } from "../geometry/label-spot.js";
import { translate, languageLocale, formatNumber } from "../i18n/i18n.js";
import { projectMaterialId } from "../library/library-store.js";
import { originPoint, sheetPartPaths } from "../placement/origin.js";
import { partDisplayName, scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { isImperial } from "../util/units.js";
import { showLength } from "./lengths.js";
import { itemLabel, libraryItem } from "./materials-tab.js";
import { cutTimeSummary, panelSizeLabel, planSummary } from "./plan-summary.js";

// résolution des pages (points par pouce) : nette à l'impression, fichier raisonnable
const DPI = 200;
const PX_PER_MM = DPI / 25.4;
const MARGIN = 12;
const ROW = 6;
const INK = "#1a1a1a";
const SOFT = "#666666";
const LINE = "#b8b8b8";
const PART_FILL = "#ececec";

function fonts() {
  var style = getComputedStyle(document.documentElement),
    body = style.getPropertyValue("--f-body").trim() || "sans-serif",
    display = style.getPropertyValue("--f-display").trim() || body;
  return { body: body, display: display };
}

function unitLabel() {
  return translate("mill.unitLength");
}

function lengthWithUnit(mm) {
  return showLength(mm) + " " + unitLabel();
}

/* Nouvelle page blanche, en mm (Y vers le bas). landscape : page couchée. */
function newPage(landscape) {
  var paper = isImperial() ? PAPER.letter : PAPER.a4,
    w = landscape ? paper.heightMm : paper.widthMm,
    h = landscape ? paper.widthMm : paper.heightMm,
    canvas = document.createElement("canvas");
  canvas.width = Math.round(w * PX_PER_MM);
  canvas.height = Math.round(h * PX_PER_MM);
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(PX_PER_MM, PX_PER_MM);
  ctx.direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
  ctx.textBaseline = "alphabetic";
  return { canvas: canvas, ctx: ctx, width: w, height: h };
}

function setFont(ctx, sizeMm, bold, family) {
  ctx.font = (bold ? "600 " : "400 ") + sizeMm + "px " + family;
}

// texte raccourci avec « … » pour tenir dans la largeur donnée
function fitText(ctx, text, maxWidth) {
  text = String(text);
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length > 1 && ctx.measureText(text + "…").width > maxWidth) text = text.slice(0, -1);
  return text + "…";
}

function text(ctx, value, x, y, options) {
  options = options || {};
  setFont(ctx, options.size || 3.2, options.bold, options.family || fonts().body);
  ctx.fillStyle = options.color || INK;
  ctx.textAlign = options.align || "left";
  ctx.fillText(options.maxWidth ? fitText(ctx, value, options.maxWidth) : String(value), x, y);
}

function hline(ctx, x0, x1, y, color) {
  ctx.strokeStyle = color || LINE;
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

function projectTitle() {
  return state.name || translate("pdf.untitled");
}

function materialLabel() {
  var item = libraryItem(projectMaterialId());
  return item ? itemLabel(item) : "";
}

/* En-tête commun : nom du projet, date, et une ligne de détail. Renvoie la hauteur occupée (mm). */
function header(page, detail) {
  var ctx = page.ctx,
    f = fonts();
  text(ctx, projectTitle(), MARGIN, MARGIN + 6, {
    size: 6,
    bold: true,
    family: f.display,
    maxWidth: page.width - 2 * MARGIN - 40
  });
  text(ctx, new Date().toLocaleDateString(languageLocale()), page.width - MARGIN, MARGIN + 6, {
    size: 3,
    color: SOFT,
    align: "right"
  });
  if (detail) text(ctx, detail, MARGIN, MARGIN + 12, { size: 3.2, color: SOFT, maxWidth: page.width - 2 * MARGIN });
  hline(ctx, MARGIN, page.width - MARGIN, MARGIN + 15, INK);
  return MARGIN + 20;
}

function footer(page, index, count) {
  text(page.ctx, "Nestor · " + translate("pdf.page", { i: index, n: count }), page.width / 2, page.height - 6, {
    size: 2.6,
    color: SOFT,
    align: "center"
  });
}

/* Tableau : colonnes [{ title, width (mm) ou 0 pour le reste, align }] ; dessine les lignes à partir de first,
   jusqu'au bas de la zone, et renvoie l'indice de la première ligne qui n'a pas tenu. */
function table(page, columns, rows, first, top, bottom) {
  var ctx = page.ctx,
    left = MARGIN,
    full = page.width - 2 * MARGIN,
    fixed = columns.reduce(function (a, c) {
      return a + c.width;
    }, 0),
    widths = columns.map(function (c) {
      return c.width || full - fixed;
    });
  function rowAt(cells, y, bold, color) {
    var x = left;
    cells.forEach(function (cell, c) {
      var align = columns[c].align || "left",
        tx = align === "right" ? x + widths[c] - 1.5 : x + 1.5;
      text(ctx, cell, tx, y, { size: 3, bold: bold, color: color, align: align, maxWidth: widths[c] - 3 });
      x += widths[c];
    });
  }
  rowAt(
    columns.map(function (c) {
      return c.title;
    }),
    top + 4,
    true,
    SOFT
  );
  hline(ctx, left, left + full, top + ROW, INK);
  var y = top + ROW,
    i = first;
  while (i < rows.length && y + ROW <= bottom) {
    rowAt(rows[i], y + 4.2, false, INK);
    y += ROW;
    hline(ctx, left, left + full, y);
    i++;
  }
  return i;
}

/* Plan d'un panneau dans le rectangle donné (mm de papier) : pièces, numéros, cotes, zéro machine. */
function drawSheet(page, sheet, box) {
  var ctx = page.ctx,
    f = fonts(),
    dimSpace = 7,
    scale = Math.min((box.w - dimSpace) / sheet.L, (box.h - dimSpace) / sheet.W),
    w = sheet.L * scale,
    h = sheet.W * scale,
    x0 = box.x + dimSpace + (box.w - dimSpace - w) / 2,
    y0 = box.y + dimSpace;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.35;
  ctx.strokeRect(x0, y0, w, h);
  sheet.parts.forEach(function (placed) {
    var paths = sheetPartPaths(placed, sheet);
    ctx.beginPath();
    paths.forEach(function (p) {
      p.pts.forEach(function (v, k) {
        var px = x0 + v[0] * scale,
          py = y0 + v[1] * scale;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      if (p.closed) ctx.closePath();
    });
    ctx.fillStyle = PART_FILL;
    ctx.fill("evenodd");
    ctx.lineWidth = 0.25;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });
  // numéros au même endroit que sur l'écran et que les numéros gravés
  sheet.parts.forEach(function (placed) {
    var spot = partNumberSpot(placed, sheet),
      label = partNumberText(placed);
    if (!spot) return;
    var size = Math.min(labelHeight(label, spot.radius, 0, Infinity) * 1.3 * scale, 4.5);
    if (size < 1.2) return;
    text(ctx, label, x0 + spot.x * scale, y0 + spot.y * scale + size * 0.35, {
      size: size,
      bold: true,
      family: f.display,
      align: "center"
    });
  });
  // zéro machine
  var origin = originPoint(sheet),
    ox = x0 + origin[0] * scale,
    oy = y0 + origin[1] * scale;
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.arc(ox, oy, 1.6, 0, 2 * Math.PI);
  ctx.moveTo(ox - 2.6, oy);
  ctx.lineTo(ox + 2.6, oy);
  ctx.moveTo(ox, oy - 2.6);
  ctx.lineTo(ox, oy + 2.6);
  ctx.stroke();
  ctx.restore();
  // cotes du panneau : largeur au-dessus, hauteur à gauche
  text(ctx, lengthWithUnit(sheet.L), x0 + w / 2, y0 - 2, { size: 3, color: SOFT, align: "center" });
  ctx.save();
  ctx.translate(x0 - 2, y0 + h / 2);
  ctx.rotate(-Math.PI / 2);
  text(ctx, lengthWithUnit(sheet.W), 0, 0, { size: 3, color: SOFT, align: "center" });
  ctx.restore();
  return y0 + h;
}

function partColumns() {
  return [
    { title: translate("pdf.colNumber"), width: 12 },
    { title: translate("pdf.colPart"), width: 0 },
    { title: translate("pdf.colSize"), width: 44, align: "right" },
    { title: translate("pdf.colQty"), width: 16, align: "right" }
  ];
}

function partSize(i) {
  var part = scaledPart(state.types[i]);
  return showLength(part.w) + " × " + showLength(part.h) + " " + unitLabel();
}

// pièces d'un panneau : une ligne par type de pièce, avec la quantité posée sur ce panneau
function sheetRows(sheet) {
  var counts = {},
    order = [];
  sheet.parts.forEach(function (p) {
    if (!counts[p.i]) {
      counts[p.i] = 0;
      order.push(p.i);
    }
    counts[p.i]++;
  });
  order.sort(function (a, b) {
    return a - b;
  });
  return order.map(function (i) {
    return [String(i + 1), partDisplayName(state.types[i], i), partSize(i), String(counts[i])];
  });
}

/* Pages d'un panneau : plan et liste ; la liste trop longue continue sur d'autres pages. */
function sheetPages(sheet, index, count) {
  var pages = [],
    rows = sheetRows(sheet),
    detail =
      translate("sheet.title", { i: index + 1, n: count }) +
      " · " +
      panelSizeLabel(sheet) +
      " " +
      unitLabel() +
      (materialLabel() ? " · " + materialLabel() : "") +
      " · " +
      translate("sheet.meta", {
        n: sheet.parts.length,
        u: formatNumber(Math.round((1000 * sheet.area) / (sheet.L * sheet.W)) / 10)
      });
  // page couchée quand le panneau est plus large que haut
  var page = newPage(sheet.L > sheet.W),
    top = header(page, detail),
    bottom = page.height - 14,
    tableHeight = Math.min((rows.length + 1) * ROW + 2, (bottom - top) * 0.4),
    planBottom = drawSheet(page, sheet, {
      x: MARGIN,
      y: top,
      w: page.width - 2 * MARGIN,
      h: bottom - top - tableHeight - 6
    });
  var next = table(page, partColumns(), rows, 0, planBottom + 6, bottom);
  pages.push(page);
  while (next < rows.length) {
    page = newPage(false);
    top = header(page, detail);
    next = table(page, partColumns(), rows, next, top, page.height - 14);
    pages.push(page);
  }
  return pages;
}

/* Pages de résumé du plan entier : chiffres, puis toutes les pièces avec leurs panneaux. */
function summaryPages(res) {
  var summary = planSummary(res),
    time = cutTimeSummary(summary.contourLength),
    pages = [],
    page = newPage(false),
    top = header(page, translate("pdf.summary")),
    ctx = page.ctx;
  var facts = [
    [translate("mill.material"), materialLabel() || "–"],
    [
      translate("res.panels"),
      summary.panels + (summary.breakdown ? " · " + summary.breakdown + " " + unitLabel() : "")
    ],
    [translate("res.placed"), summary.placed + " / " + summary.total],
    [translate("res.waste"), summary.wastePercent == null ? "–" : formatNumber(summary.wastePercent) + " %"],
    [translate("res.timeLabel"), time.value + (time.value !== "–" ? " · " + time.detail : "")]
  ];
  var y = top + 2;
  facts.forEach(function (f) {
    text(ctx, f[0], MARGIN, y + 4, { size: 3, color: SOFT, maxWidth: 50 });
    text(ctx, f[1], MARGIN + 52, y + 4, { size: 3.4, maxWidth: page.width - 2 * MARGIN - 52 });
    y += 7;
  });
  if (res.unplaced.length) {
    text(ctx, translate("pdf.unplaced", { n: res.unplaced.length }), MARGIN, y + 4, { size: 3.2, color: "#c0392b" });
    y += 7;
  }
  // toutes les pièces : quantité posée et panneaux où elles se trouvent
  var placedOn = {},
    order = [];
  res.sheets.forEach(function (s, si) {
    s.parts.forEach(function (p) {
      if (!placedOn[p.i]) {
        placedOn[p.i] = { count: 0, sheets: [] };
        order.push(p.i);
      }
      placedOn[p.i].count++;
      if (placedOn[p.i].sheets.indexOf(si + 1) < 0) placedOn[p.i].sheets.push(si + 1);
    });
  });
  order.sort(function (a, b) {
    return a - b;
  });
  var rows = order.map(function (i) {
    return [
      String(i + 1),
      partDisplayName(state.types[i], i),
      partSize(i),
      String(placedOn[i].count),
      placedOn[i].sheets.join(", ")
    ];
  });
  var columns = partColumns().concat([{ title: translate("pdf.colPanels"), width: 24, align: "right" }]);
  var next = table(page, columns, rows, 0, y + 6, page.height - 14);
  pages.push(page);
  while (next < rows.length) {
    page = newPage(false);
    next = table(page, columns, rows, next, header(page, translate("pdf.summary")), page.height - 14);
    pages.push(page);
  }
  return pages;
}

function toJpeg(page) {
  return new Promise(function (resolve, reject) {
    page.canvas.toBlob(
      function (blob) {
        if (!blob) return reject(new Error("canvas"));
        blob.arrayBuffer().then(function (buffer) {
          resolve({
            jpeg: new Uint8Array(buffer),
            pixelWidth: page.canvas.width,
            pixelHeight: page.canvas.height,
            widthPt: mmToPt(page.width),
            heightPt: mmToPt(page.height)
          });
        }, reject);
      },
      "image/jpeg",
      0.9
    );
  });
}

/* PDF d'un panneau (sheetIndex) ou du plan entier (sheetIndex null : résumé puis tous les panneaux). */
export async function buildPlanPdf(res, sheetIndex) {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  planSummary(res); // calcule la surface de chaque panneau (taux de matière utilisée)
  var pages = sheetIndex == null ? summaryPages(res) : [];
  res.sheets.forEach(function (sheet, si) {
    if (sheetIndex == null || sheetIndex === si) pages = pages.concat(sheetPages(sheet, si, res.sheets.length));
  });
  pages.forEach(function (page, i) {
    footer(page, i + 1, pages.length);
  });
  var images = [];
  for (var i = 0; i < pages.length; i++) images.push(await toJpeg(pages[i]));
  return buildPdf(images, { title: projectTitle(), date: new Date() });
}
