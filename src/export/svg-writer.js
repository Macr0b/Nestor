/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Écriture d'un fichier SVG à partir de traits : calques conservés, regroupés par couleur, en mm ou en pouces. */

import { escapeHtml } from "../util/dom.js";
import { MM_PER_INCH } from "../util/units.js";

/* Fichier SVG à partir de traits en mm (Y vers le bas) : page width × height, zéro au point origin. */
export function buildSvgFromPaths(paths, width, height, originMm, inches) {
  // calques d'origine conservés (lisibles par Illustrator, Inkscape, LightBurn), puis regroupement par couleur
  // inches : fichier en pouces (cotes divisées par 25,4 et unité « in ») ; sinon en mm
  var k = inches ? 1 / MM_PER_INCH : 1,
    unit = inches ? "in" : "mm",
    precision = inches ? 100000 : 1000,
    panelWidth = width * k,
    panelHeight = height * k,
    layers = {},
    lorder = [];
  var origin = originMm.map(function (v) {
    return v * k;
  });
  paths.forEach(function (source) {
    // copie : les traits reçus ne sont pas modifiés
    var q = Object.assign({}, source, {
      pts: source.pts.map(function (v) {
        return [v[0] * k - origin[0], v[1] * k - origin[1]];
      })
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
      unit +
      '" height="' +
      panelHeight +
      unit +
      '" viewBox="' +
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
      var baseId = id,
        suffix = 2;
      while (used[id]) id = baseId + "_" + suffix++;
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
      o.push('<g fill="none" stroke="' + escapeHtml(c) + '" stroke-width="' + 0.1 * k + '">');
      groups[c].forEach(function (q) {
        o.push(
          '<path d="M' +
            q.pts
              .map(function (v) {
                return Math.round(v[0] * precision) / precision + " " + Math.round(v[1] * precision) / precision;
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
