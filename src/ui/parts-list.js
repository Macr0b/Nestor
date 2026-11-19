/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Liste des pièces : tri, rotation, échelle, quantités, copies, sélection. */

import { languageLocale, translate } from "../i18n/i18n.js";
import { resizeManualPart } from "../project/manual-parts.js";
import { partDisplayName, partScale, rotationChoice, rotationFromChoice } from "../project/parts.js";
import { schedulePreferencesSave } from "../project/preferences.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { renderResult } from "./result-view.js";
import { partThumbnail } from "./sheet-drawing.js";
import { markUnplacedParts } from "./unplaced-marks.js";
import { byId, escapeHtml } from "../util/dom.js";
import { parseNumber, round1, round2 } from "../util/numbers.js";
import { lengthFieldValue } from "../util/units.js";
import { lengthInputAttributes, readLengthField } from "./lengths.js";

function isNamedLayer(layer) {
  return !!layer && layer !== "0";
}

function hasLayers() {
  return state.types.some(function (t) {
    return isNamedLayer(t.layer);
  });
}

function hasManualParts() {
  return state.types.some(function (t) {
    return t.manual;
  });
}

// plusieurs origines : plusieurs fichiers, ou un fichier et des pièces saisies à la main
function hasSeveralFiles() {
  return (state.files || []).length + (hasManualParts() ? 1 : 0) > 1;
}

function sourceNameOf(part) {
  return part.manual ? translate("manual.source") : fileNameOf(part.fid);
}

function fileNameOf(fid) {
  var f = (state.files || []).filter(function (x) {
    return x.id === fid;
  })[0];
  return f ? f.name : "";
}

function sortedPartIndexes() {
  var idx = state.types.map(function (_, i) {
      return i;
    }),
    mode =
      (state.sort === "layer" && !hasLayers()) || (state.sort === "src" && !hasSeveralFiles()) ? "file" : state.sort,
    loc = languageLocale().replace(/-u-.*$/, "");
  function nm(i) {
    return partDisplayName(state.types[i], i);
  }
  if (mode === "name")
    idx.sort(function (a, b) {
      return nm(a).localeCompare(nm(b), loc, { numeric: true, sensitivity: "base" }) || a - b;
    });
  else if (mode === "layer")
    idx.sort(function (a, b) {
      var la = isNamedLayer(state.types[a].layer) ? state.types[a].layer : "",
        lb = isNamedLayer(state.types[b].layer) ? state.types[b].layer : "";
      if (!la !== !lb) return la ? -1 : 1;
      return la.localeCompare(lb, loc, { numeric: true, sensitivity: "base" }) || a - b;
    });
  else if (mode === "src") {
    var ord = {};
    (state.files || []).forEach(function (f, k) {
      ord[f.id] = k;
    });
    // pièces saisies à la main après les fichiers
    var rank = function (t) {
      return t.manual ? Infinity : ord[t.fid] || 0;
    };
    idx.sort(function (a, b) {
      return rank(state.types[a]) - rank(state.types[b]) || a - b;
    });
  }
  return { idx: idx, mode: mode };
}

function renderSortMenu() {
  var sel = byId("sortSel");
  if (!sel) return;
  var lay = hasLayers();
  sel.innerHTML = [
    ["file", "sort.file"],
    ["name", "sort.name"]
  ]
    .concat(lay ? [["layer", "sort.layer"]] : [])
    .concat(hasSeveralFiles() ? [["src", "sort.byFile"]] : [])
    .map(function (o) {
      return '<option value="' + o[0] + '">' + escapeHtml(translate(o[1])) + "</option>";
    })
    .join("");
  sel.value =
    (state.sort === "layer" && !lay) || (state.sort === "src" && !hasSeveralFiles()) ? "file" : state.sort || "file";
}

export function renderPartsList() {
  var sortedIndexes = sortedPartIndexes(),
    lastL = null;
  renderSortMenu();
  byId("types").innerHTML = state.types.length
    ? sortedIndexes.idx
        .map(function (i) {
          var t = state.types[i],
            head = "";
          if (sortedIndexes.mode === "layer") {
            var L = isNamedLayer(t.layer) ? t.layer : "";
            if (L !== lastL) {
              lastL = L;
              head = '<div class="lhead">' + escapeHtml(L || translate("layer.none")) + "</div>";
            }
          }
          if (sortedIndexes.mode === "src") {
            var F = sourceNameOf(t);
            if (F !== lastL) {
              lastL = F;
              head = '<div class="lhead">' + escapeHtml(F) + "</div>";
            }
          }
          return (
            head +
            '<div class="trow' +
            (t.on === false ? " off" : "") +
            '" data-i="' +
            i +
            '"><label class="pick"><input type="checkbox" id="t' +
            i +
            '-on" data-k="on"' +
            (t.on !== false ? " checked" : "") +
            ' aria-label="' +
            escapeHtml(translate("piece.include", { n: i + 1 })) +
            '"></label><div class="thumb"><span class="n">' +
            (i + 1) +
            "</span>" +
            partThumbnail(t) +
            "</div>" +
            '<div class="tline"><input class="nm" type="text" id="t' +
            i +
            '-n" data-k="name" value="' +
            escapeHtml(t.name) +
            '" placeholder="' +
            escapeHtml(partDisplayName({ nameKey: t.nameKey }, i)) +
            '" aria-label="' +
            escapeHtml(translate("piece.nameLbl", { n: i + 1 })) +
            '">' +
            '<button class="mini tb" type="button" data-act="dup" title="' +
            escapeHtml(translate("piece.dup")) +
            '" aria-label="' +
            escapeHtml(translate("piece.dup")) +
            '">⧉</button>' +
            (t.copy || t.manual
              ? '<button class="mini tb" type="button" data-act="del" title="' +
                escapeHtml(translate("piece.del")) +
                '" aria-label="' +
                escapeHtml(translate("piece.del")) +
                '">×</button>'
              : "") +
            "</div>" +
            '<div class="tline"><label class="qty">' +
            escapeHtml(translate("piece.qty")) +
            '<input type="number" id="t' +
            i +
            '-q" data-k="qty" inputmode="numeric" min="0" step="1" value="' +
            escapeHtml(t.qty) +
            '"></label>' +
            '<label class="rot" title="' +
            escapeHtml(translate("pieces.keepHint")) +
            '"><select id="t' +
            i +
            '-r" data-k="rot" aria-label="' +
            escapeHtml(translate("piece.rotLbl", { n: i + 1 })) +
            '">' +
            ROTATION_CHOICES.map(function (o) {
              var cur = rotationChoice(t);
              return (
                '<option value="' +
                o[0] +
                '"' +
                (o[0] === cur ? " selected" : "") +
                ">" +
                escapeHtml(translate(o[1])) +
                "</option>"
              );
            }).join("") +
            "</select></label></div>" +
            '<div class="tline size"><span class="grp"><span class="slbl">' +
            escapeHtml(translate("piece.size")) +
            "</span>" +
            "<input " +
            lengthInputAttributes(round1((t.w * partScale(t)) / 100)) +
            ' class="sz" data-k="sw" min="0" aria-label="' +
            escapeHtml(translate("panel.W")) +
            '"><span class="x">×</span>' +
            "<input " +
            lengthInputAttributes(round1((t.h * partScale(t)) / 100)) +
            ' class="sz" data-k="sh" min="0" aria-label="' +
            escapeHtml(translate("panel.L")) +
            '"><span class="u">' +
            escapeHtml(translate("mill.unitLength")) +
            "</span></span>" +
            '<span class="grp"><span class="slbl">' +
            escapeHtml(translate("piece.scale")) +
            '</span><input type="number" class="pc" data-k="sp" inputmode="decimal" min="1" step="any" value="' +
            round2(partScale(t)) +
            '" aria-label="' +
            escapeHtml(translate("piece.scale")) +
            '"></span></div>' +
            ((sortedIndexes.mode !== "layer" && isNamedLayer(t.layer)) ||
            (sortedIndexes.mode !== "src" && hasSeveralFiles())
              ? '<div class="tline lay">' +
                (sortedIndexes.mode !== "layer" && isNamedLayer(t.layer)
                  ? '<span class="laytag">' + escapeHtml(translate("piece.layer", { l: t.layer })) + "</span>"
                  : "") +
                (sortedIndexes.mode !== "src" && hasSeveralFiles()
                  ? '<span class="laytag">' + escapeHtml(translate("piece.file", { f: sourceNameOf(t) })) + "</span>"
                  : "") +
                "</div>"
              : "") +
            "</div>"
          );
        })
        .join("")
    : '<p class="hint">' + escapeHtml(translate("pieces.empty")) + "</p>";
  updateSelectionCount();
  markUnplacedParts();
}

const ROTATION_CHOICES = [
  ["fix", "piece.rotFix"],
  ["quarter", "piece.rotQuarter"],
  ["free", "piece.rotFree"]
];

function renderRotationMenu() {
  var sel = byId("rotAll");
  if (!sel) return;
  var keys = {};
  state.types.forEach(function (t) {
    keys[rotationChoice(t)] = 1;
  });
  var ks = Object.keys(keys),
    mixed = ks.length > 1;
  var cur = mixed ? "mixed" : ks[0] || state.rotAll;
  sel.innerHTML =
    ROTATION_CHOICES.map(function (o) {
      return '<option value="' + o[0] + '">' + escapeHtml(translate(o[1])) + "</option>";
    }).join("") +
    (mixed ? '<option value="mixed" disabled>' + escapeHtml(translate("pieces.rotMixed")) + "</option>" : "");
  sel.value = cur;
  byId("rotAllWrap").hidden = !state.types.length;
  byId("sortWrap").hidden = !state.types.length;
}

function updateSelectionCount() {
  var n = state.types.length,
    on = state.types.filter(function (t) {
      return t.on !== false;
    }).length;
  byId("pcount").textContent = n ? "(" + on + "/" + n + ")" : "";
  var b = byId("btnAll");
  b.hidden = !n;
  b.textContent = on === n ? translate("pieces.none") : translate("pieces.all");
  renderRotationMenu();
  renderScaleMenu();
}

let calculationTimer = null;

export function scheduleCalculation() {
  clearTimeout(calculationTimer);
  calculationTimer = setTimeout(renderResult, 250);
}

function setPartScale(part, row, newValue, source) {
  if (!(newValue > 0) || !isFinite(newValue)) return;
  part.scale = newValue;
  var q = function (k) {
    return row.querySelector('[data-k="' + k + '"]');
  };
  if (source !== "sw") q("sw").value = lengthFieldValue(round1((part.w * newValue) / 100));
  if (source !== "sh") q("sh").value = lengthFieldValue(round1((part.h * newValue) / 100));
  if (source !== "sp") q("sp").value = round2(newValue);
  renderScaleMenu();
  scheduleCalculation();
}

// échelle de toutes les pièces
function renderScaleMenu() {
  var inp = byId("scaleAll");
  if (!inp) return;
  var vals = {};
  state.types.forEach(function (t) {
    vals[round2(partScale(t))] = 1;
  });
  var ks = Object.keys(vals);
  if (document.activeElement !== inp) {
    if (ks.length === 1) {
      inp.value = ks[0];
      inp.placeholder = "";
    } else {
      inp.value = "";
      inp.placeholder = translate("pieces.rotMixed");
    }
  }
  byId("scaleAllWrap").hidden = !state.types.length;
}

export function bindPartsList() {
  byId("types").addEventListener("input", function (e) {
    var row = e.target.closest(".trow");
    if (!row) return;
    var t = state.types[+row.dataset.i],
      k = e.target.dataset.k;
    if (!t || !k || k === "on" || k === "rot") return;
    if (k === "sw" || k === "sh" || k === "sp") {
      // taille dans les unités choisies (gardée en mm) ou échelle en %
      var v = k === "sp" ? parseNumber(e.target.value, NaN) : readLengthField(e.target);
      // pièce saisie à la main : longueur et largeur changent chacune de leur côté
      if (t.manual && k !== "sp") {
        var k100 = partScale(t) / 100;
        if (resizeManualPart(t, k === "sw" ? v / k100 : t.w, k === "sh" ? v / k100 : t.h)) {
          row.querySelector(".thumb").innerHTML =
            '<span class="n">' + (+row.dataset.i + 1) + "</span>" + partThumbnail(t);
          schedulePreferencesSave();
          scheduleCalculation();
        }
        return;
      }
      if (k === "sw") v = (v / t.w) * 100;
      else if (k === "sh") v = (v / t.h) * 100;
      setPartScale(t, row, v, k);
      return;
    }
    if (k === "name") t.name = e.target.value;
    else t.qty = e.target.value === "" ? 0 : Math.max(0, Math.floor(parseNumber(e.target.value, 0)));
    schedulePreferencesSave();
    if (k !== "name") scheduleCalculation();
  });
  byId("types").addEventListener("change", function (e) {
    var k = e.target.dataset.k,
      row = e.target.closest(".trow");
    if (!row) return;
    var t = state.types[+row.dataset.i];
    if (k === "rot") {
      t.rot = rotationFromChoice(e.target.value);
      renderRotationMenu();
      schedulePreferencesSave();
      scheduleCalculation();
    } else if (k === "on") {
      t.on = e.target.checked;
      row.classList.toggle("off", !t.on);
      updateSelectionCount();
      schedulePreferencesSave();
      scheduleCalculation();
    }
  });
  byId("types").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var row = b.closest(".trow"),
      i = +row.dataset.i,
      t = state.types[i];
    if (!t) return;
    if (b.dataset.act === "dup") {
      var c = Object.assign({}, t, {
        copy: true,
        qty: 1,
        name: translate("piece.copyName", { n: partDisplayName(t, i) }),
        _eff: null,
        _effK: null
      });
      state.types.splice(i + 1, 0, c);
    } else if (b.dataset.act === "del" && (t.copy || t.manual)) {
      state.types.splice(i, 1);
    } else return;
    session.lastResult = null;
    renderPartsList();
    schedulePreferencesSave();
    scheduleCalculation();
  });
  byId("scaleAll").addEventListener("input", function (e) {
    var v = parseNumber(e.target.value, NaN);
    if (!(v > 0)) return;
    state.types.forEach(function (t) {
      t.scale = v;
    });
    document.querySelectorAll("#types .trow").forEach(function (row) {
      var t = state.types[+row.dataset.i];
      if (t) {
        row.querySelector('[data-k="sw"]').value = lengthFieldValue(round1((t.w * v) / 100));
        row.querySelector('[data-k="sh"]').value = lengthFieldValue(round1((t.h * v) / 100));
        row.querySelector('[data-k="sp"]').value = round2(v);
      }
    });
    scheduleCalculation();
  });
  byId("scaleAll").addEventListener("blur", renderScaleMenu);
  byId("sortSel").addEventListener("change", function (e) {
    state.sort = e.target.value;
    renderPartsList();
    schedulePreferencesSave();
  });
  byId("rotAll").addEventListener("change", function (e) {
    var v = e.target.value;
    if (v === "mixed") return;
    state.rotAll = v;
    state.types.forEach(function (t) {
      t.rot = rotationFromChoice(v);
    });
    renderPartsList();
    schedulePreferencesSave();
    scheduleCalculation();
  });
  byId("btnAll").addEventListener("click", function () {
    var all = state.types.every(function (t) {
      return t.on !== false;
    });
    state.types.forEach(function (t) {
      t.on = !all;
    });
    renderPartsList();
    schedulePreferencesSave();
    scheduleCalculation();
  });
}
