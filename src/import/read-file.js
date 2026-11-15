/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture d'un fichier choisi par l'utilisateur : limites de taille, décompression, choix du lecteur selon
   le format. */

import { buildPartTypes, groupPieces } from "../geometry/grouping.js";
import { boundingBox } from "../geometry/polylines.js";
import { translate } from "../i18n/i18n.js";
import { parseDxf } from "./dxf.js";
import { parseHpgl } from "./hpgl.js";
import { parseLightBurn } from "./lightburn.js";
import { parsePdf } from "./pdf.js";
import { parseSvg } from "./svg.js";
import { nameFromTexts } from "./text-names.js";
import { parseVectorCraft } from "./vectorcraft.js";
import { rotationFromChoice } from "../project/parts.js";
import { state } from "../project/state.js";
import { fileErrors } from "../ui/files-panel.js";
import { byId } from "../util/dom.js";

export async function parseImportedFile(name, data) {
  var unit = byId("unitSel").value,
    res,
    kind;
  var bytes = new Uint8Array(data),
    head = String.fromCharCode.apply(null, bytes.subarray(0, 1024));
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    // SVGZ (SVG compressé, Inkscape)
    bytes = await gunzipLimited(bytes, MAX_FILE_BYTES);
    head = String.fromCharCode.apply(null, bytes.subarray(0, 1024));
  }
  if (/\.(ai|pdf)$/i.test(name) || head.indexOf("%PDF") >= 0) {
    kind = /\.pdf$/i.test(name) ? "PDF" : "AI";
    res = await parsePdf(data, unit, kind);
  } else {
    var text = new TextDecoder("utf-8").decode(bytes),
      tt = text.replace(/^﻿/, "").trimStart();
    if (/^%!PS/.test(text)) throw new Error(translate("err.aiNoPdf"));
    if (/\.dxf$/i.test(name) || /^\s*0\s*[\r\n]+\s*SECTION/.test(text)) {
      kind = "DXF";
      res = parseDxf(text, unit);
      res.how = unit !== "auto" ? "how.manual" : res.detected ? "how.dxf" : "how.dxfNone";
      res.warn = { texts: res.warn.textes, blocks: res.warn.blocs };
    } else if (/\.lbrn2?$/i.test(name) || /<LightBurnProject/i.test(tt.slice(0, 400))) {
      kind = "LightBurn";
      res = parseLightBurn(text, unit);
    } else if (
      /\.vectorcraft$/i.test(name) ||
      (/^\{/.test(tt) && /"format"\s*:\s*"vectorcraft"/.test(tt.slice(0, 400)))
    ) {
      kind = "VectorCraft";
      res = parseVectorCraft(text, unit);
    } else if (/\.(plt|hpgl|hpg|hgl)$/i.test(name) || /^(IN|DF|SP\d|PU|PA)[;\s\d,]/i.test(tt)) {
      kind = "HPGL";
      res = parseHpgl(text, unit);
    } else {
      kind = "SVG";
      res = parseSvg(text, unit);
    }
  }
  if (!res.paths.length) throw new Error(translate("err.noPaths"));
  var g = groupPieces(res.paths),
    b = boundingBox(res.paths);
  if (res.texts && res.texts.length) nameFromTexts(g.pieces, res.texts, res.warn);
  var types = buildPartTypes(g.pieces);
  types.forEach(function (t) {
    t.rot = rotationFromChoice(state.rotAll);
  });
  return {
    types: types,
    info: {
      kind: kind,
      how: res.how,
      size: [b[2] - b[0], b[3] - b[1]],
      n: g.pieces.length,
      frame: g.frame,
      warn: res.warn || {}
    }
  };
}

// taille maximale d'un fichier, une fois décompressé s'il l'était
const MAX_FILE_BYTES = 40 * 1024 * 1024;

// décompression gzip (SVGZ) bornée : un petit fichier piégé peut se décompresser en plusieurs gigaoctets et
// bloquer le navigateur ; on arrête dès que la limite est dépassée
async function gunzipLimited(bytes, limit) {
  if (typeof DecompressionStream === "undefined") throw new Error(translate("err.read"));
  var reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).getReader(),
    chunks = [],
    total = 0;
  for (;;) {
    var step = await reader.read();
    if (step.done) break;
    total += step.value.length;
    if (total > limit) {
      reader.cancel();
      throw new Error(translate("err.tooBig"));
    }
    chunks.push(step.value);
  }
  var out = new Uint8Array(total),
    at = 0;
  chunks.forEach(function (c) {
    out.set(c, at);
    at += c.length;
  });
  return out;
}

export function readFiles(files) {
  return Promise.all(
    Array.prototype.map.call(files, function (file) {
      return new Promise(function (ok) {
        if (file.size > MAX_FILE_BYTES) {
          fileErrors.push({ name: file.name, msg: translate("err.tooBig") });
          ok(null);
          return;
        }
        var rd = new FileReader();
        rd.onload = function () {
          ok({ name: file.name, data: rd.result });
        };
        rd.onerror = function () {
          fileErrors.push({ name: file.name, msg: translate("err.read") });
          ok(null);
        };
        rd.readAsArrayBuffer(file);
      });
    })
  ).then(function (a) {
    return a.filter(Boolean);
  });
}
