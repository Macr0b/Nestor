/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Écriture du fichier DXF exporté : calques conservés, zéro à l'origine choisie, en mm (ou en pouces si demandé). */

import { MM_PER_INCH } from "../util/units.js";

export function dxfLayerName(layer) {
  var n =
    String(layer || "0")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_\-$]/g, "_")
      .slice(0, 31) || "0";
  // nom écrit dans un alphabet non latin : il ne resterait que des « _ », on garde un nom lisible
  return /[A-Za-z0-9]/.test(n) ? n : "LAYER_" + (Math.abs(hashString(String(layer))) % 1000);
}

function hashString(text) {
  var hash = 0;
  for (var i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return hash;
}

// ox, oy : origine choisie (coordonnées de la page, Y vers le bas) ; le DXF a son Y vers le haut
// inches : fichier en pouces (cotes divisées par 25,4, $INSUNITS = 1) ; sinon en mm ($INSUNITS = 4)
export function buildDxfFile(paths, originX, originY, inches) {
  var k = inches ? 1 / MM_PER_INCH : 1;
  var lines = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1009",
    "9",
    "$INSUNITS",
    "70",
    inches ? "1" : "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES"
  ];
  function r(v) {
    var precision = inches ? 1000000 : 10000;
    return (Math.round(v * k * precision) / precision).toString();
  }
  paths.forEach(function (p) {
    var lay = dxfLayerName(p.layer);
    lines.push("0", "POLYLINE", "8", lay, "66", "1", "70", p.closed ? "1" : "0", "10", "0", "20", "0", "30", "0");
    p.pts.forEach(function (q) {
      lines.push("0", "VERTEX", "8", lay, "10", r(q[0] - originX), "20", r(originY - q[1]), "30", "0");
    });
    lines.push("0", "SEQEND", "8", lay);
  });
  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\r\n") + "\r\n";
}
