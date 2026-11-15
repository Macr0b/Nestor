/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Écriture du fichier SVG exporté : calques conservés, zéro à l'origine choisie, en mm. */

import { exportPaths } from "./export-files.js";
import { originPoint } from "../placement/origin.js";
import { escapeHtml } from "../util/dom.js";

export function buildSvgFile(sheet) {
  // calques d'origine conservés (lisibles par Illustrator, Inkscape, LightBurn), puis regroupement par couleur
  var panelWidth = sheet.L,
    panelHeight = sheet.W,
    layers = {},
    lorder = [];
  var origin = originPoint(sheet);
  exportPaths(sheet).forEach(function (q) {
    q.pts = q.pts.map(function (v) {
      return [v[0] - origin[0], v[1] - origin[1]];
    });
    var ly = q.layer || "",
      key = q.color || "#000000";
    if (!layers[ly]) {
      layers[ly] = {};
      lorder.push(ly);
    }
    (layers[ly][key] = layers[ly][key] || []).push(q);
  });
  var o = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="' +
      panelWidth +
      'mm" height="' +
      panelHeight +
      'mm" viewBox="' +
      -origin[0] +
      " " +
      -origin[1] +
      " " +
      panelWidth +
      " " +
      panelHeight +
      '">'
  ];
  var used = {};
  lorder.forEach(function (ly) {
    var groups = layers[ly];
    if (ly) {
      var id =
        ly
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^A-Za-z0-9_-]/g, "_") || "calque";
      if (/^[0-9-]/.test(id)) id = "_" + id;
      var b0 = id,
        k = 2;
      while (used[id]) id = b0 + "_" + k++;
      used[id] = 1;
      o.push(
        '<g id="' +
          escapeHtml(id) +
          '" data-name="' +
          escapeHtml(ly) +
          '" inkscape:label="' +
          escapeHtml(ly) +
          '" inkscape:groupmode="layer">'
      );
    }
    Object.keys(groups).forEach(function (c) {
      o.push('<g fill="none" stroke="' + escapeHtml(c) + '" stroke-width="0.1">');
      groups[c].forEach(function (q) {
        o.push(
          '<path d="M' +
            q.pts
              .map(function (v) {
                return Math.round(v[0] * 1000) / 1000 + " " + Math.round(v[1] * 1000) / 1000;
              })
              .join("L") +
            (q.closed ? "Z" : "") +
            '"/>'
        );
      });
      o.push("</g>");
    });
    if (ly) o.push("</g>");
  });
  o.push("</svg>");
  return o.join("\n");
}
