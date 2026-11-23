/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Nettoyage SVG par liste blanche : seuls les éléments et attributs utiles à la géométrie sont recopiés.
   Les blocs <style> sont lus comme des données et jamais insérés dans la page. */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const ALLOWED_ELEMENTS = {
  svg: 1,
  g: 1,
  path: 1,
  rect: 1,
  circle: 1,
  ellipse: 1,
  line: 1,
  polyline: 1,
  polygon: 1,
  defs: 1,
  clipPath: 1,
  mask: 1,
  pattern: 1,
  marker: 1,
  symbol: 1,
  use: 1,
  text: 1,
  title: 1
};

const ALLOWED_ATTRIBUTES = {
  id: 1,
  class: 1,
  d: 1,
  x: 1,
  y: 1,
  width: 1,
  height: 1,
  cx: 1,
  cy: 1,
  r: 1,
  rx: 1,
  ry: 1,
  x1: 1,
  y1: 1,
  x2: 1,
  y2: 1,
  points: 1,
  transform: 1,
  viewBox: 1,
  preserveAspectRatio: 1,
  "data-name": 1,
  "inkscape:label": 1,
  "inkscape:groupmode": 1,
  href: 1,
  "xlink:href": 1
};

const ALLOWED_CSS_PROPERTIES = {
  fill: 1,
  stroke: 1,
  "stroke-width": 1,
  "fill-rule": 1,
  display: 1,
  visibility: 1,
  opacity: 1,
  "fill-opacity": 1,
  "stroke-opacity": 1
};

// une valeur de style sûre : pas d'adresse externe ni d'expression
function isSafeCssValue(value) {
  value = String(value).trim();
  return value.length < 200 && !/url\s*\(\s*['"]?\s*[^#'"\s]|expression|javascript:|[<>\\]/i.test(value);
}

function parseCssDeclarations(text) {
  var out = [];
  String(text || "")
    .split(";")
    .forEach(function (decl) {
      var i = decl.indexOf(":");
      if (i < 0) return;
      var k = decl.slice(0, i).trim().toLowerCase(),
        v = decl
          .slice(i + 1)
          .replace(/!important/i, "")
          .trim();
      if (ALLOWED_CSS_PROPERTIES[k] && isSafeCssValue(v)) out.push([k, v]);
    });
  return out;
}

export function sanitizeSvg(root) {
  // 1. les règles <style> du fichier deviennent des styles posés sur chaque élément visé (jamais un <style> dans la page)
  var fromSheet = new Map();
  root.querySelectorAll("style").forEach(function (st) {
    var sheet;
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(st.textContent || "");
    } catch (e) {
      return;
    }
    Array.prototype.forEach.call(sheet.cssRules, function (rule) {
      if (!rule.selectorText) return;
      var pairs = parseCssDeclarations(rule.style.cssText);
      if (!pairs.length) return;
      var targets;
      try {
        targets = root.querySelectorAll(rule.selectorText);
      } catch (e) {
        return;
      }
      targets.forEach(function (el) {
        var m = fromSheet.get(el) || {};
        pairs.forEach(function (p) {
          m[p[0]] = p[1];
        });
        fromSheet.set(el, m);
      });
    });
  });
  // 2. recopie des seuls éléments et attributs autorisés
  function copy(src) {
    var tag = src.localName;
    if (src.namespaceURI !== SVG_NAMESPACE) return null;
    if (tag === "a" || tag === "switch") tag = "g"; // lien ou variante : on garde le contenu, pas le lien
    if (!ALLOWED_ELEMENTS[tag]) return null;
    var el = document.createElementNS(SVG_NAMESPACE, tag);
    Array.prototype.forEach.call(src.attributes, function (a) {
      var nm = a.name,
        v = a.value;
      if (!ALLOWED_ATTRIBUTES[nm] && !ALLOWED_CSS_PROPERTIES[nm]) return;
      if ((nm === "href" || nm === "xlink:href") && v.charAt(0) !== "#") return; // liens internes seulement
      if (ALLOWED_CSS_PROPERTIES[nm] && !isSafeCssValue(v)) return;
      try {
        if (a.namespaceURI) el.setAttributeNS(a.namespaceURI, nm, v);
        else el.setAttribute(nm, v);
      } catch (e) {
        /* nom d'attribut invalide : ignoré */
      }
    });
    // styles : ceux des règles <style>, puis le style propre à l'élément (prioritaire), filtrés
    var css = {},
      sheetCss = fromSheet.get(src);
    if (sheetCss) for (var k in sheetCss) css[k] = sheetCss[k];
    parseCssDeclarations(src.getAttribute("style")).forEach(function (p) {
      css[p[0]] = p[1];
    });
    var txt = Object.keys(css)
      .map(function (k) {
        return k + ":" + css[k];
      })
      .join(";");
    if (txt) el.setAttribute("style", txt);
    if (tag === "text") return el; // le contenu des textes ne sert pas : on les compte seulement
    Array.prototype.forEach.call(src.children, function (c) {
      var cc = copy(c);
      if (cc) el.appendChild(cc);
    });
    return el;
  }
  return copy(root);
}
