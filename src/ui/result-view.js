/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Bloc résultat : chiffres, dessin de chaque panneau, boutons de téléchargement. */

import { buildDxfFile } from "../export/dxf.js";
import { exportPaths, fileSlug, saveFile, sheetSawCuts } from "../export/export-files.js";
import { buildSvgFile } from "../export/svg.js";
import { formatNumber, translate } from "../i18n/i18n.js";
import { showLength } from "./lengths.js";
import { cutTimeSummary, panelSizeLabel, planSummary } from "./plan-summary.js";
import { isImperial } from "../util/units.js";
import { renderCost } from "./cost-tab.js";
import { applyOrigin, nestingFrame, originPoint, panelList, panelOrigin } from "../placement/origin.js";
import { packRectangles } from "../placement/rectangles.js";
import { sawCutTableHtml } from "./saw-cut-list.js";
import { buildNestInput, nestPanelByPanel, nestWithOrigin, stopNesting } from "../placement/run-nesting.js";
import { partDisplayName, scaledPart } from "../project/parts.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { renderSheetSvg } from "./sheet-drawing.js";
import { buildPlanPdf } from "./print-pages.js";
import { markUnplacedParts, showPartRow, unplacedByPart } from "./unplaced-marks.js";
import { byId, escapeHtml } from "../util/dom.js";

let currentJob = 0;

// annulation d'un calcul long demandée par l'utilisateur
function cancelNesting() {
  stopNesting();
  currentJob++;
  byId("result").classList.remove("busy");
  byId("calcMsg").textContent = translate("calc.cancelled");
}

export function renderResult() {
  var jobId = ++currentJob,
    mode = state.sheet.mode === "rect" ? "rect" : "nest",
    msg = byId("calcMsg");
  if (mode === "rect") {
    drawResult(
      applyOrigin(
        packRectangles(
          { gap: state.sheet.gap, margin: state.sheet.margin, panels: panelList() },
          state.types.map(scaledPart)
        ),
        function (s) {
          var o = panelOrigin(s.pi);
          return { tr: false, fx: o[1] === "r", fy: o[0] === "b", o: o, geo: false };
        }
      )
    );
    msg.textContent = "";
    return;
  }
  var panelSpecs = panelList(),
    f0 = nestingFrame(panelSpecs[0] ? panelSpecs[0].L : 1, panelSpecs[0] ? panelSpecs[0].W : 1, panelOrigin(0)),
    input = buildNestInput(f0);
  if (
    !input.types.some(function (t) {
      return t.on && t.qty > 0;
    }) ||
    !input.panels.some(function (p) {
      return p.L > 0 && p.W > 0;
    })
  ) {
    // des pièces mais aucun panneau utilisable : le dire, plutôt que « importe un fichier »
    var parts = input.types.reduce(function (a, t) {
      return a + (t.on && t.qty > 0 ? t.qty : 0);
    }, 0);
    drawResult({ sheets: [], unplaced: [], count: 0, total: parts, noPanel: parts > 0 });
    msg.textContent = "";
    return;
  }
  byId("result").classList.add("busy");
  var t0 = Date.now(),
    nTot = input.types.reduce(function (a, t) {
      return a + (t.on ? Math.max(0, t.qty) : 0);
    }, 0);
  msg.textContent = translate("calc.running") + (nTot > 2000 ? " " + translate("calc.many", { n: nTot }) : "");
  // bouton Annuler si le calcul dure
  setTimeout(function () {
    if (jobId !== currentJob || !byId("result").classList.contains("busy")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn sm cancelbtn";
    b.textContent = translate("calc.cancel");
    b.addEventListener("click", cancelNesting);
    msg.appendChild(document.createTextNode(" "));
    msg.appendChild(b);
  }, 700);
  var same = panelSpecs.every(function (p, pi) {
    return panelOrigin(pi) === panelOrigin(0);
  });
  (same ? nestWithOrigin(panelSpecs[0].L, panelSpecs[0].W, panelOrigin(0)) : nestPanelByPanel(panelSpecs))
    .then(function (res) {
      if (jobId !== currentJob) return;
      msg.textContent = translate("calc.done", {
        s: formatNumber((Date.now() - t0) / 1000),
        p: showLength(res.res, { decimal: true, digits: 2 })
      });
      drawResult(res);
    })
    .catch(function (x) {
      if (jobId !== currentJob) return;
      byId("result").classList.remove("busy");
      msg.textContent = translate("calc.fail");
      session.lastError = translate("calc.fail") + (x && x.message ? " (" + x.message + ")" : "");
    });
}

/* Case « Découpe estimée » : contours extérieurs des pièces placées, avec l'avance et les passes de l'onglet Fraisage. */
function cutTimeStat(contourLength) {
  var time = cutTimeSummary(contourLength);
  return (
    '<div class="stat" id="cutTime"><div class="v">' +
    escapeHtml(time.value) +
    '</div><div class="k">' +
    escapeHtml(translate("res.timeLabel")) +
    '</div><div class="bd">' +
    escapeHtml(time.detail) +
    "</div></div>"
  );
}

export function drawResult(res) {
  session.lastResult = res;
  byId("result").classList.remove("busy");
  var summary = planSummary(res),
    n = summary.panels,
    pct = summary.wastePercent,
    breakdown = summary.breakdown,
    contourLength = summary.contourLength,
    h = [];
  h.push(
    '<div class="summary">' +
      '<div class="stat"><div class="v">' +
      n +
      '</div><div class="k">' +
      escapeHtml(translate("res.panels")) +
      "</div>" +
      (n ? '<div class="bd">' + escapeHtml(breakdown) + "</div>" : "") +
      "</div>" +
      '<div class="stat"><div class="v">' +
      res.count +
      '<span style="font-size:18px;color:var(--muted)"> / ' +
      res.total +
      '</span></div><div class="k">' +
      escapeHtml(translate("res.placed")) +
      "</div></div>" +
      '<div class="stat"><div class="v">' +
      (n ? formatNumber(pct) : "–") +
      ' %</div><div class="k">' +
      escapeHtml(translate("res.waste")) +
      "</div></div>" +
      cutTimeStat(contourLength) +
      "</div>" +
      '<p class="hint">' +
      escapeHtml(translate("res.timeNote")) +
      "</p>"
  );
  // pièces citées dans le message rouge : chacune est un lien vers sa ligne dans la liste des pièces
  function partLinks(why) {
    var marks = unplacedByPart(res);
    return Object.keys(marks)
      .filter(function (i) {
        return marks[i].why === why;
      })
      .map(function (i) {
        var t = state.types[i],
          te = scaledPart(t);
        return (
          '<button type="button" class="part-link" data-part="' +
          i +
          '">' +
          escapeHtml(
            +i + 1 + " · " + partDisplayName(t, +i) + " (" + showLength(te.w) + " × " + showLength(te.h) + ")"
          ) +
          "</button>"
        );
      });
  }
  function alertWithLinks(key, links) {
    if (!links.length) return;
    var parts = translate(key, { list: "\u0000" }).split("\u0000");
    h.push('<div class="alert">' + parts.map(escapeHtml).join(links.join(", ")) + "</div>");
  }
  alertWithLinks("res.tooBig", partLinks("size"));
  alertWithLinks("res.noStock", partLinks("stock"));
  res.sheets.forEach(function (s, si) {
    var fr = s.free && s.free[0];
    var meta =
      panelSizeLabel(s) +
      " · " +
      translate("sheet.meta", { n: s.parts.length, u: formatNumber(Math.round((1000 * s.area) / (s.L * s.W)) / 10) }) +
      (fr && fr.w >= 50 && fr.h >= 50
        ? " · " + translate("sheet.free", { w: showLength(Math.floor(fr.w)), h: showLength(Math.floor(fr.h)) })
        : "");
    h.push(
      '<article class="sheet"><h3>' +
        escapeHtml(translate("sheet.title", { i: si + 1, n: n })) +
        " <small>" +
        escapeHtml(meta) +
        "</small></h3>" +
        '<div class="svgbox">' +
        renderSheetSvg(s) +
        "</div>" +
        sawCutTableHtml(sheetSawCuts(s)) +
        '<div class="dl"><button class="btn sm" type="button" data-dl="svg" data-s="' +
        si +
        '">' +
        escapeHtml(translate("dl.svg")) +
        '</button><button class="btn sm" type="button" data-dl="dxf" data-s="' +
        si +
        '">' +
        escapeHtml(translate("dl.dxf")) +
        '</button><button type="button" class="btn sm" data-dl="pdf" data-s="' +
        si +
        '">' +
        escapeHtml(translate("dl.pdf")) +
        '</button><span class="hint" id="dlmsg' +
        si +
        '"></span></div></article>'
    );
  });
  // le plan entier : un seul PDF (résumé puis un panneau par page), ou un DXF par panneau d'un coup
  if (n)
    h.push(
      '<div class="dl dl-all"><button type="button" class="btn" data-dl="pdfall" data-s="all">' +
        escapeHtml(translate("dl.pdfAll")) +
        '</button><button type="button" class="btn" data-dl="dxfall" data-s="all">' +
        escapeHtml(translate("dl.dxfAll")) +
        '</button><span class="hint" id="dlmsgall"></span></div>'
    );
  if (!n && !res.unplaced.length)
    h.push(
      res.noPanel
        ? '<div class="alert">' + escapeHtml(translate("res.noPanel")) + "</div>"
        : '<p class="hint">' + escapeHtml(translate("res.empty")) + "</p>"
    );
  // les fichiers suivent les unités choisies : en pouces si l'appli est en pouces
  if (n) h.push('<p class="hint">' + escapeHtml(translate(isImperial() ? "res.noteInch" : "res.note")) + "</p>");
  byId("result").innerHTML = h.join("");
  markUnplacedParts();
  // l'onglet Coût suit le dernier plan calculé
  renderCost();
}

/* PDF à imprimer : d'un panneau (index) ou du plan entier ("all"). Le dessin des pages prend un instant. */
function downloadPdf(which, projectSlug) {
  var all = which === "all",
    index = all ? null : +which,
    msg = byId("dlmsg" + which),
    name = projectSlug + "-" + (all ? fileSlug(translate("pdf.fileAll"), "all") : index + 1) + ".pdf";
  msg.textContent = translate("pdf.preparing");
  buildPlanPdf(session.lastResult, index)
    .then(function (bytes) {
      return saveFile(name, new Blob([bytes], { type: "application/pdf" }));
    })
    .then(function () {
      msg.textContent = translate("dl.done", { f: name });
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") return;
      msg.textContent = translate("dl.fail");
    });
}

/* Fichier SVG ou DXF d'un panneau du dernier plan : { name, blob }. */
function sheetFile(si, kind, projectSlug) {
  var s = session.lastResult.sheets[si],
    name = projectSlug + "-" + (si + 1) + "." + kind;
  if (kind === "svg") return { name: name, blob: new Blob([buildSvgFile(s, isImperial())], { type: "image/svg+xml" }) };
  var op = originPoint(s);
  return {
    name: name,
    blob: new Blob([buildDxfFile(exportPaths(s), op[0], op[1], isImperial())], { type: "application/dxf" })
  };
}

/* Un DXF par panneau, l'un après l'autre (un court délai laisse le navigateur accepter chaque téléchargement). */
function downloadAllDxf(projectSlug) {
  var msg = byId("dlmsgall"),
    count = session.lastResult.sheets.length,
    names = [],
    chain = Promise.resolve();
  for (let si = 0; si < count; si++)
    chain = chain.then(function () {
      var file = sheetFile(si, "dxf", projectSlug);
      names.push(file.name);
      return saveFile(file.name, file.blob).then(function () {
        return new Promise(function (resolve) {
          setTimeout(resolve, 350);
        });
      });
    });
  chain
    .then(function () {
      msg.textContent = translate("dl.doneAll", {
        n: names.length,
        f: names[0] + (names.length > 1 ? " … " + names[names.length - 1] : "")
      });
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") return;
      msg.textContent = translate("dl.fail");
    });
}

export function bindResultView() {
  byId("result").addEventListener("click", function (e) {
    var link = e.target.closest("[data-part]");
    if (link) return showPartRow(+link.dataset.part);
    var b = e.target.closest("[data-dl]");
    if (!b || !session.lastResult) return;
    var kind = b.dataset.dl,
      projectSlug = fileSlug(state.name || state.source.replace(/\.\w+$/, ""));
    if (kind === "pdf" || kind === "pdfall") return downloadPdf(b.dataset.s, projectSlug);
    if (kind === "dxfall") return downloadAllDxf(projectSlug);
    var si = +b.dataset.s,
      msg = byId("dlmsg" + si),
      file = sheetFile(si, kind, projectSlug);
    saveFile(file.name, file.blob)
      .then(function () {
        msg.textContent = translate("dl.done", { f: file.name });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        msg.textContent = translate("dl.fail");
      });
  });
}
