/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Lecture des formats qui ont besoin du navigateur : SVG (rendu par le navigateur pour appliquer
   les transformations), AI / PDF (via pdf.js) et LightBurn (XML). Les formats texte simples
   (DXF, HPGL, VectorCraft) sont dans geo.js.
   Chaque lecteur renvoie { paths:[{pts,closed,layer,color,name}], how, warn } avec des coordonnées en mm. */
var Formats = (function () {
  "use strict";
  var num = Geo.num;
  var H = window.APP_HOST || null;
  function $(id) {
    return document.getElementById(id);
  }
  // traduction fournie par l'application (langue courante)
  var T = function (k) {
    return k;
  };
  function setTranslator(fn) {
    T = fn;
  }

  /* ---------- import SVG ---------- */
  function unitToMM(v) {
    var m = /^\s*([+-]?[\d.]+(?:e[+-]?\d+)?)\s*([a-z%]*)\s*$/i.exec(v || "");
    if (!m) return null;
    var x = parseFloat(m[1]),
      u = m[2].toLowerCase();
    var f = { mm: 1, cm: 10, in: 25.4, pt: 0.352778, pc: 4.23333, px: null, "": null }[u];
    return f === undefined ? null : f === null ? { px: x } : { mm: x * f };
  }
  function shapeToD(el) {
    var t = el.tagName.toLowerCase(),
      a = function (n) {
        return num(el.getAttribute(n), 0);
      };
    if (t === "path") return el.getAttribute("d") || "";
    if (t === "rect") {
      var x = a("x"),
        y = a("y"),
        w = a("width"),
        h = a("height"),
        rx = el.hasAttribute("rx") ? a("rx") : el.hasAttribute("ry") ? a("ry") : 0,
        ry = el.hasAttribute("ry") ? a("ry") : rx;
      if (w <= 0 || h <= 0) return "";
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (!rx || !ry) return "M" + x + " " + y + "H" + (x + w) + "V" + (y + h) + "H" + x + "Z";
      return (
        "M" +
        (x + rx) +
        " " +
        y +
        "H" +
        (x + w - rx) +
        "A" +
        rx +
        " " +
        ry +
        " 0 0 1 " +
        (x + w) +
        " " +
        (y + ry) +
        "V" +
        (y + h - ry) +
        "A" +
        rx +
        " " +
        ry +
        " 0 0 1 " +
        (x + w - rx) +
        " " +
        (y + h) +
        "H" +
        (x + rx) +
        "A" +
        rx +
        " " +
        ry +
        " 0 0 1 " +
        x +
        " " +
        (y + h - ry) +
        "V" +
        (y + ry) +
        "A" +
        rx +
        " " +
        ry +
        " 0 0 1 " +
        (x + rx) +
        " " +
        y +
        "Z"
      );
    }
    if (t === "circle" || t === "ellipse") {
      var cx = a("cx"),
        cy = a("cy"),
        erx = t === "circle" ? a("r") : a("rx"),
        ery = t === "circle" ? a("r") : a("ry");
      if (erx <= 0 || ery <= 0) return "";
      return (
        "M" +
        (cx + erx) +
        " " +
        cy +
        "A" +
        erx +
        " " +
        ery +
        " 0 1 1 " +
        (cx - erx) +
        " " +
        cy +
        "A" +
        erx +
        " " +
        ery +
        " 0 1 1 " +
        (cx + erx) +
        " " +
        cy +
        "Z"
      );
    }
    if (t === "line") return "M" + a("x1") + " " + a("y1") + "L" + a("x2") + " " + a("y2");
    if (t === "polyline" || t === "polygon") {
      var p = (el.getAttribute("points") || "").trim();
      if (!p) return "";
      var nums = p.split(/[\s,]+/);
      var d = "M" + nums[0] + " " + nums[1];
      for (var i = 2; i + 1 < nums.length; i += 2) d += "L" + nums[i] + " " + nums[i + 1];
      return d + (t === "polygon" ? "Z" : "");
    }
    return "";
  }
  /* ---------- nettoyage SVG par liste blanche ----------
     Un fichier SVG peut contenir du code, des liens, des images distantes ou des styles qui toucheraient la page.
     On ne recopie donc que ce qui sert à lire la géométrie : les éléments et attributs listés ci-dessous.
     Les blocs <style> (classes Illustrator, Inkscape…) ne sont jamais insérés dans la page : ils sont lus
     comme des données, et seules les propriétés de dessin autorisées sont recopiées sur les éléments visés. */
  var SVG_NS = "http://www.w3.org/2000/svg";
  var KEEP_EL = {
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
  var KEEP_ATTR = {
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
  var KEEP_CSS = {
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
  function safeCss(v) {
    v = String(v).trim();
    return v.length < 200 && !/url\s*\(\s*['"]?\s*[^#'"\s]|expression|javascript:|[<>\\]/i.test(v);
  }
  function cssPairs(text) {
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
        if (KEEP_CSS[k] && safeCss(v)) out.push([k, v]);
      });
    return out;
  }
  function cleanSVG(root) {
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
        var pairs = cssPairs(rule.style.cssText);
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
      if (src.namespaceURI !== SVG_NS) return null;
      if (tag === "a" || tag === "switch") tag = "g"; // lien ou variante : on garde le contenu, pas le lien
      if (!KEEP_EL[tag]) return null;
      var el = document.createElementNS(SVG_NS, tag);
      Array.prototype.forEach.call(src.attributes, function (a) {
        var nm = a.name,
          v = a.value;
        if (!KEEP_ATTR[nm] && !KEEP_CSS[nm]) return;
        if ((nm === "href" || nm === "xlink:href") && v.charAt(0) !== "#") return; // liens internes seulement
        if (KEEP_CSS[nm] && !safeCss(v)) return;
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
      cssPairs(src.getAttribute("style")).forEach(function (p) {
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

  function parseSVG(text, unitOverride) {
    var doc = new DOMParser().parseFromString(text, "image/svg+xml");
    var root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length)
      throw new Error(T("err.svg"));
    var host = $("svgScratch");
    host.innerHTML = "";
    var svg = cleanSVG(root);
    host.appendChild(svg);
    try {
      var vb = (svg.getAttribute("viewBox") || "")
          .trim()
          .split(/[\s,]+/)
          .map(Number),
        hasVB = vb.length === 4 && vb[2] > 0;
      var wa = unitToMM(svg.getAttribute("width")),
        ill = /Illustrator/i.test(text),
        f,
        how;
      if (unitOverride && unitOverride !== "auto") {
        f = num(unitOverride, 1);
        how = "how.manual";
      } else if (wa && wa.mm && hasVB) {
        f = wa.mm / vb[2];
        how = "how.doc";
      } else if (wa && wa.mm && !hasVB) {
        f = 1;
        how = "how.mm";
      } else {
        var unit = ill ? 0.352778 : 0.264583;
        f = unit * (wa && wa.px && hasVB ? wa.px / vb[2] : 1);
        how = ill ? "how.ai" : "how.px";
      }
      var rootM = svg.getScreenCTM(),
        inv = rootM ? rootM.inverse() : null,
        paths = [],
        warn = {};
      // noms : Inkscape (inkscape:label), Illustrator (data-name ou id encodé), sinon id lisible
      var AUTO =
        /^(path|rect|circle|ellipse|line|polyline|polygon|g|layer|svg|use|text|tspan|group|shape|clippath|mask)[-_ ]?\d+$/i;
      function nameOf(n) {
        var v =
          n.getAttribute("inkscape:label") ||
          n.getAttributeNS("http://www.inkscape.org/namespaces/inkscape", "label") ||
          n.getAttribute("data-name");
        if (v) return v.trim();
        var id = n.getAttribute("id");
        if (!id || AUTO.test(id)) return "";
        if (ill)
          id = id
            .replace(/_\d+_$/, "")
            .replace(/_x([0-9A-Fa-f]{2,4})_|_/g, function (m, h) {
              return h ? String.fromCharCode(parseInt(h, 16)) : " ";
            })
            .trim();
        return id;
      }
      function isLayer(g) {
        return (
          (g.getAttribute("inkscape:groupmode") ||
            g.getAttributeNS("http://www.inkscape.org/namespaces/inkscape", "groupmode")) === "layer"
        );
      }
      var hasInkLayers = !!Array.prototype.some.call(svg.querySelectorAll("g"), isLayer);
      svg.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon").forEach(function (el) {
        if (el.closest("defs,clipPath,mask,pattern,marker,symbol")) return;
        var cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        var d = shapeToD(el);
        if (!d) return;
        var m = inv && el.getScreenCTM() ? inv.multiply(el.getScreenCTM()) : new DOMMatrix();
        var sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
        var col = cs.stroke && cs.stroke !== "none" ? cs.stroke : cs.fill && cs.fill !== "none" ? cs.fill : "";
        var layer = "",
          nm = nameOf(el),
          g = el.parentElement,
          chainG = [];
        while (g && g !== svg) {
          if (g.tagName.toLowerCase() === "g") chainG.push(g);
          g = g.parentElement;
        }
        // calque : le plus haut calque Inkscape, sinon le groupe de premier niveau (calque Illustrator)
        var lg = null;
        if (hasInkLayers) {
          for (var ci = chainG.length - 1; ci >= 0; ci--)
            if (isLayer(chainG[ci])) {
              lg = chainG[ci];
              break;
            }
        } else lg = chainG[chainG.length - 1] || null;
        if (lg) layer = nameOf(lg);
        // nom : celui du tracé, sinon celui du groupe le plus proche sous le calque
        if (!nm)
          for (var cj = 0; cj < chainG.length && chainG[cj] !== lg; cj++) {
            if (isLayer(chainG[cj])) break;
            var gn = nameOf(chainG[cj]);
            if (gn) {
              nm = gn;
              break;
            }
          }
        var subs;
        try {
          subs = Geo.flattenPath(d, function (len) {
            return (len * sc * f) / 0.25;
          });
        } catch (e) {
          warn.paths = (warn.paths || 0) + 1;
          return;
        }
        subs.forEach(function (s) {
          var pts = s.pts.map(function (q) {
            return [(m.a * q[0] + m.c * q[1] + m.e) * f, (m.b * q[0] + m.d * q[1] + m.f) * f];
          });
          if (s.closed && pts.length > 1) {
            var A = pts[0],
              B = pts[pts.length - 1];
            if (Math.hypot(A[0] - B[0], A[1] - B[1]) < 1e-6) pts.pop();
          }
          pts = Geo.simplify(pts, 0.01);
          if (pts.length >= 2) paths.push({ pts: pts, closed: s.closed, layer: layer, color: col, name: nm });
        });
      });
      var nt = svg.querySelectorAll("text").length;
      if (nt) warn.texts = nt;
      var nu = svg.querySelectorAll("use").length;
      if (nu) warn.symbols = nu;
      return { paths: paths, how: how, warn: warn };
    } finally {
      host.innerHTML = "";
    }
  }

  /* ---------- import AI / PDF (pdf.js embarqué) ---------- */
  var pdfjsP = null;
  function loadScript(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = function () {
        ko(new Error(T("err.aiLoad")));
      };
      document.head.appendChild(s);
    });
  }
  function getPdfjs() {
    var base = (H && H.pdfBase) || "vendor/pdfjs/";
    if (!pdfjsP) {
      pdfjsP = loadScript(base + "pdf.min.js")
        .then(function () {
          return H && H.pdfBase ? loadScript(base + "pdf.worker.min.js") : null;
        })
        .then(function () {
          var lib = window.pdfjsLib;
          if (!lib) throw new Error(T("err.aiLoad"));
          lib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js";
          return lib;
        })
        .catch(function (e) {
          pdfjsP = null;
          throw e;
        });
    }
    return pdfjsP;
  }
  function hexOf(a) {
    if (!a) return "";
    if (typeof a[0] === "string") return a[0];
    if (a.length >= 3)
      return (
        "#" +
        [a[0], a[1], a[2]]
          .map(function (v) {
            v = Math.round(v <= 1 && !(a instanceof Uint8ClampedArray) ? v * 255 : v);
            return ("0" + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
          })
          .join("")
      );
    return "";
  }
  function mmul(o, m) {
    return [
      o[0] * m[0] + o[2] * m[1],
      o[1] * m[0] + o[3] * m[1],
      o[0] * m[2] + o[2] * m[3],
      o[1] * m[2] + o[3] * m[3],
      o[0] * m[4] + o[2] * m[5] + o[4],
      o[1] * m[4] + o[3] * m[5] + o[5]
    ];
  }
  async function parseAI(buf, unitOverride) {
    var lib = await getPdfjs(),
      OPS = lib.OPS,
      doc;
    try {
      doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false, disableFontFace: true })
        .promise;
    } catch (e) {
      throw new Error(T("err.aiNoPdf"));
    }
    var manual = unitOverride && unitOverride !== "auto",
      f = manual ? num(unitOverride, 1) : 0.352778,
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
        pending = [],
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
          ctm = mmul(ctm, a);
        } else if (fn === OPS.paintFormXObjectBegin) {
          stack.push(ctm);
          cs.push([stroke, fill]);
          if (a && a[0]) ctm = mmul(ctm, a[0]);
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
          stroke = hexOf(a);
        } else if (fn === OPS.setFillRGBColor) {
          fill = hexOf(a);
        } else if (fn === OPS.constructPath) {
          var ops = a[0],
            c = a[1],
            k = 0,
            d = "",
            cx = 0,
            cy = 0;
          var P = function (x, y) {
            return ctm[0] * x + ctm[2] * y + ctm[4] + " " + (ctm[1] * x + ctm[3] * y + ctm[5]);
          };
          for (var j = 0; j < ops.length; j++) {
            var op = ops[j];
            if (op === OPS.moveTo) {
              cx = c[k];
              cy = c[k + 1];
              d += "M" + P(cx, cy);
              k += 2;
            } else if (op === OPS.lineTo) {
              cx = c[k];
              cy = c[k + 1];
              d += "L" + P(cx, cy);
              k += 2;
            } else if (op === OPS.curveTo) {
              d += "C" + P(c[k], c[k + 1]) + " " + P(c[k + 2], c[k + 3]) + " " + P(c[k + 4], c[k + 5]);
              cx = c[k + 4];
              cy = c[k + 5];
              k += 6;
            } else if (op === OPS.curveTo2) {
              d += "C" + P(cx, cy) + " " + P(c[k], c[k + 1]) + " " + P(c[k + 2], c[k + 3]);
              cx = c[k + 2];
              cy = c[k + 3];
              k += 4;
            } else if (op === OPS.curveTo3) {
              d += "C" + P(c[k], c[k + 1]) + " " + P(c[k + 2], c[k + 3]) + " " + P(c[k + 2], c[k + 3]);
              cx = c[k + 2];
              cy = c[k + 3];
              k += 4;
            } else if (op === OPS.closePath) {
              d += "Z";
            } else if (op === OPS.rectangle) {
              var x = c[k],
                y = c[k + 1],
                w = c[k + 2],
                h = c[k + 3];
              d += "M" + P(x, y) + "L" + P(x + w, y) + "L" + P(x + w, y + h) + "L" + P(x, y + h) + "Z";
              cx = x;
              cy = y;
              k += 4;
            }
          }
          pending.push(d);
        } else if (PAINT[fn]) {
          var col = fn !== OPS.fill && fn !== OPS.eoFill ? stroke : fill;
          pending.forEach(function (pd) {
            var subs;
            try {
              subs = Geo.flattenPath(pd, function (len) {
                return (len * f) / 0.25;
              });
            } catch (e) {
              warn.paths = (warn.paths || 0) + 1;
              return;
            }
            subs.forEach(function (s) {
              var pts = s.pts.map(function (q) {
                return [(q[0] - view[0]) * f, (view[3] - q[1]) * f + yOff];
              });
              if (s.closed && pts.length > 1) {
                var A = pts[0],
                  B = pts[pts.length - 1];
                if (Math.hypot(A[0] - B[0], A[1] - B[1]) < 1e-6) pts.pop();
              }
              pts = Geo.simplify(pts, 0.01);
              if (pts.length >= 2) paths.push({ pts: pts, closed: s.closed, layer: curLayer(), color: col || "" });
            });
          });
          pending = [];
        } else if (fn === OPS.endPath) {
          pending = [];
        } else if (fn === OPS.showText && !warn.texts) {
          warn.texts = 1;
        }
      }
      yOff += (view[3] - view[1]) * f + 20;
    }
    if (pages > 1) warn.pages = pages;
    return { paths: paths, how: how, warn: warn };
  }

  /* ---------- import LightBurn (.lbrn / .lbrn2, XML, mm, Y vers le haut) ---------- */
  function parseLBRN(text, unitOverride) {
    var doc = new DOMParser().parseFromString(text, "application/xml"),
      root = doc.documentElement;
    if (!root || doc.getElementsByTagName("parsererror").length || !/LightBurnProject/i.test(root.nodeName))
      throw new Error(T("err.generic"));
    var f = unitOverride && unitOverride !== "auto" ? num(unitOverride, 1) : 1,
      paths = [],
      warn = {},
      cuts = {};
    function kids(el, tag) {
      return Array.prototype.filter.call(el.children, function (c) {
        return c.nodeName === tag;
      });
    }
    function attr(el, n) {
      var v = el.getAttribute(n);
      if (v != null) return v;
      var c = kids(el, n)[0];
      return c ? c.getAttribute("Value") : null;
    }
    kids(root, "CutSetting")
      .concat(kids(root, "CutSetting_Img"))
      .forEach(function (c) {
        var i = attr(c, "index"),
          n = attr(c, "name");
        if (i != null) cuts[i] = n || "C" + ("0" + i).slice(-2);
      });
    function mul(m, n) {
      return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5]
      ];
    }
    function xf(el) {
      var x = kids(el, "XForm")[0];
      if (!x) return [1, 0, 0, 1, 0, 0];
      var v = x.textContent
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      return v.length === 6 && v.every(isFinite) ? v : [1, 0, 0, 1, 0, 0];
    }
    function emit(dd, m, layer, name) {
      var subs;
      try {
        subs = Geo.flattenPath(dd, function (len) {
          return (len * f) / 0.25;
        });
      } catch (e) {
        warn.paths = (warn.paths || 0) + 1;
        return;
      }
      subs.forEach(function (sb) {
        var pts = sb.pts.map(function (q) {
          return [(m[0] * q[0] + m[2] * q[1] + m[4]) * f, -(m[1] * q[0] + m[3] * q[1] + m[5]) * f];
        });
        if (sb.closed && pts.length > 1) {
          var a = pts[0],
            b = pts[pts.length - 1];
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) pts.pop();
        }
        pts = Geo.simplify(pts, 0.01);
        if (pts.length >= 2) paths.push({ pts: pts, closed: sb.closed, layer: layer, color: "", name: name });
      });
    }
    function verts(el) {
      var vl = kids(el, "VertList")[0],
        V = [];
      if (vl && vl.textContent.trim()) {
        // format .lbrn2 : V<x> <y> puis, en option, c0x<v>c0y<v>c1x<v>c1y<v>
        var re = /(V|c0x|c0y|c1x|c1y)\s*(-?[\d.]+(?:e[-+]?\d+)?)(?:\s+(-?[\d.]+(?:e[-+]?\d+)?))?/gi,
          m,
          cur = null,
          tmp = {};
        while ((m = re.exec(vl.textContent))) {
          var k = m[1].toLowerCase(),
            v = parseFloat(m[2]);
          if (k === "v") {
            cur = { p: [v, parseFloat(m[3])] };
            V.push(cur);
            tmp = {};
          } else if (cur) {
            tmp[k] = v;
            if (k === "c0y" && tmp.c0x != null) cur.c0 = [tmp.c0x, v];
            if (k === "c1y" && tmp.c1x != null) cur.c1 = [tmp.c1x, v];
          }
        }
      } else {
        // format .lbrn : <V vx vy c0x c0y c1x c1y/>
        (vl ? kids(vl, "V") : kids(el, "V")).forEach(function (v) {
          var o = { p: [num(v.getAttribute("vx"), 0), num(v.getAttribute("vy"), 0)] };
          if (v.hasAttribute("c0x")) o.c0 = [num(v.getAttribute("c0x"), 0), num(v.getAttribute("c0y"), 0)];
          if (v.hasAttribute("c1x")) o.c1 = [num(v.getAttribute("c1x"), 0), num(v.getAttribute("c1y"), 0)];
          V.push(o);
        });
      }
      return V;
    }
    function prims(el, n) {
      var pl = kids(el, "PrimList")[0],
        P = [],
        txt = pl ? pl.textContent.trim() : "";
      if (pl && txt) {
        if (/^LineClosed$/i.test(txt)) {
          for (var i = 0; i < n; i++) P.push(["L", i, (i + 1) % n]);
          return P;
        }
        if (/^Line(Open)?$/i.test(txt)) {
          for (var j = 0; j + 1 < n; j++) P.push(["L", j, j + 1]);
          return P;
        }
        var re = /([LB])\s*(\d+)\s+(\d+)/g,
          m;
        while ((m = re.exec(txt))) P.push([m[1].toUpperCase(), +m[2], +m[3]]);
        return P;
      }
      (pl ? kids(pl, "P") : kids(el, "P")).forEach(function (p) {
        var t = (p.getAttribute("T") || "L").toUpperCase();
        P.push([t[0] === "B" ? "B" : "L", num(p.getAttribute("p0"), 0), num(p.getAttribute("p1"), 0)]);
      });
      if (!P.length) for (var k = 0; k + 1 < n; k++) P.push(["L", k, k + 1]);
      return P;
    }
    function pathD(V, P) {
      var d = "",
        last = -1;
      P.forEach(function (p) {
        var a = V[p[1]],
          b = V[p[2]];
        if (!a || !b) return;
        if (p[1] !== last) d += "M" + a.p[0] + " " + a.p[1];
        if (p[0] === "B") {
          var c0 = a.c0 || a.p,
            c1 = b.c1 || b.p;
          d += "C" + c0[0] + " " + c0[1] + " " + c1[0] + " " + c1[1] + " " + b.p[0] + " " + b.p[1];
        } else d += "L" + b.p[0] + " " + b.p[1];
        last = p[2];
        if (p[2] === P[0][1] && p === P[P.length - 1]) d += "Z";
      });
      return d;
    }
    function shape(el, M) {
      var t = el.getAttribute("Type") || "",
        m = mul(M, xf(el)),
        ci = el.getAttribute("CutIndex"),
        layer = ci != null ? cuts[ci] || "C" + ("0" + ci).slice(-2) : "",
        name = el.getAttribute("Name") || "";
      if (el.getAttribute("Hidden") === "1") return;
      if (t === "Group") {
        var ch = kids(el, "Children")[0];
        (ch ? kids(ch, "Shape") : []).forEach(function (c) {
          shape(c, m);
        });
        return;
      }
      if (t === "Rect") {
        var w = num(el.getAttribute("W"), 0),
          h = num(el.getAttribute("H"), 0),
          r = Math.min(num(el.getAttribute("Cr"), 0), w / 2, h / 2),
          x = -w / 2,
          y = -h / 2;
        if (w <= 0 || h <= 0) return;
        emit(
          r > 0
            ? "M" +
                (x + r) +
                " " +
                y +
                "H" +
                (x + w - r) +
                "A" +
                r +
                " " +
                r +
                " 0 0 1 " +
                (x + w) +
                " " +
                (y + r) +
                "V" +
                (y + h - r) +
                "A" +
                r +
                " " +
                r +
                " 0 0 1 " +
                (x + w - r) +
                " " +
                (y + h) +
                "H" +
                (x + r) +
                "A" +
                r +
                " " +
                r +
                " 0 0 1 " +
                x +
                " " +
                (y + h - r) +
                "V" +
                (y + r) +
                "A" +
                r +
                " " +
                r +
                " 0 0 1 " +
                (x + r) +
                " " +
                y +
                "Z"
            : "M" + x + " " + y + "H" + (x + w) + "V" + (y + h) + "H" + x + "Z",
          m,
          layer,
          name
        );
        return;
      }
      if (t === "Ellipse") {
        var rx = num(el.getAttribute("Rx"), 0),
          ry = num(el.getAttribute("Ry"), rx);
        if (rx <= 0 || ry <= 0) return;
        emit(
          "M" + rx + " 0A" + rx + " " + ry + " 0 1 1 " + -rx + " 0A" + rx + " " + ry + " 0 1 1 " + rx + " 0Z",
          m,
          layer,
          name
        );
        return;
      }
      if (t === "Polygon") {
        var N = Math.max(3, num(el.getAttribute("N"), 6)),
          pr = num(el.getAttribute("Rx"), num(el.getAttribute("R"), 0)),
          pd = "";
        if (pr <= 0) {
          warn.special = (warn.special || 0) + 1;
          return;
        }
        for (var i = 0; i < N; i++) {
          var a = -Math.PI / 2 + (2 * Math.PI * i) / N;
          pd += (i ? "L" : "M") + pr * Math.cos(a) + " " + pr * Math.sin(a);
        }
        emit(pd + "Z", m, layer, name);
        return;
      }
      if (t === "Path" || t === "Line") {
        var V = verts(el);
        if (V.length < 2) return;
        var d = pathD(V, prims(el, V.length));
        if (d) emit(d, m, layer, name);
        return;
      }
      if (t === "Text") {
        warn.texts = (warn.texts || 0) + 1;
        return;
      }
      warn.special = (warn.special || 0) + 1;
    }
    kids(root, "Shape").forEach(function (sh) {
      shape(sh, [1, 0, 0, 1, 0, 0]);
    });
    return { paths: paths, how: unitOverride && unitOverride !== "auto" ? "how.manual" : "how.lbrn", warn: warn };
  }

  /* ---------- textes DXF posés dans une pièce = nom de la pièce ---------- */
  function inPoly(x, y, P) {
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
      var a = P[i],
        b = P[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function polyArea(P) {
    var a = 0;
    for (var i = 0; i < P.length; i++) {
      var q = P[i],
        r = P[(i + 1) % P.length];
      a += q[0] * r[1] - r[0] * q[1];
    }
    return Math.abs(a / 2);
  }
  function nameFromTexts(pieces, texts, warn) {
    var left = 0;
    texts.forEach(function (t) {
      var best = null,
        ba = Infinity;
      pieces.forEach(function (pc) {
        var x = t.x - pc.ox,
          y = t.y - pc.oy;
        if (x < 0 || y < 0 || x > pc.w || y > pc.h) return;
        pc.paths.forEach(function (p) {
          if (!p.closed || p.pts.length < 3) return;
          var A = polyArea(p.pts);
          if (A < ba && inPoly(x, y, p.pts)) {
            ba = A;
            best = pc;
          }
        });
      });
      if (best) {
        if (!best.name) best.name = t.s;
      } else left++;
    });
    if (left) warn.texts = (warn.texts || 0) + left;
  }

  return {
    setTranslator: setTranslator,
    parseSVG: parseSVG,
    parseAI: parseAI,
    parseLBRN: parseLBRN,
    nameFromTexts: nameFromTexts
  };
})();
