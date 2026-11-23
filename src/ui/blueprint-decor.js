/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Décor « plan technique » : règles graduées, repères, axes et cotes dessinés autour de la page.
   Purement décoratif ; redessiné quand la taille de la page change. */

export function startBlueprintDecor() {
  var NS = "http://www.w3.org/2000/svg";
  function el(t, a, p) {
    var e = document.createElementNS(NS, t);
    for (var k in a) e.setAttribute(k, a[k]);
    (p || null) && p.appendChild(e);
    return e;
  }
  function clear(s) {
    while (s.firstChild) s.removeChild(s.firstChild);
  }
  function draw() {
    var top = document.getElementById("bpTop"),
      left = document.getElementById("bpLeft"),
      lay = document.getElementById("bpLayer");
    if (!top || !left || !lay) return;
    // le décor suit toute la hauteur de la page, comme une feuille
    var boxL = left.parentNode,
      boxY = lay.parentNode;
    boxL.style.height = boxY.style.height = "0px";
    var de = document.documentElement,
      W = de.clientWidth || innerWidth,
      H = Math.max(de.scrollHeight, innerHeight),
      narrow = W < 560;
    boxL.style.height = boxY.style.height = H + "px";
    if (W === lastW && H === lastH && top.firstChild) return;
    lastW = W;
    lastH = H;
    [top, left, lay].forEach(clear);
    var g;
    // règle de gauche : 1 trait / 5 px, moyen / 25, long + chiffre / 100
    g = el("g", { stroke: "currentColor", "stroke-width": 1 }, left);
    for (var y = 0; y <= H; y += 5) {
      var L = narrow ? (y % 100 === 0 ? 11 : y % 25 === 0 ? 7 : 4) : y % 100 === 0 ? 14 : y % 25 === 0 ? 9 : 5;
      el("line", { x1: 0, y1: y + 0.5, x2: L, y2: y + 0.5 }, g);
      if (!narrow && y % 100 === 0 && y > 0) {
        var t = el(
          "text",
          { x: 16, y: y + 3, class: "bp-num", transform: "rotate(-90 16 " + y + ")", "text-anchor": "middle" },
          left
        );
        t.textContent = y / 10;
      }
    }
    el(
      "line",
      {
        x1: narrow ? 12.5 : 22.5,
        y1: 0,
        x2: narrow ? 12.5 : 22.5,
        y2: H,
        stroke: "currentColor",
        "stroke-opacity": 0.5
      },
      left
    );
    // règle du haut
    g = el("g", { stroke: "currentColor", "stroke-width": 1 }, top);
    for (var x = 0; x <= W; x += 5) {
      var L2 = x % 100 === 0 ? 12 : x % 25 === 0 ? 8 : 4;
      el("line", { x1: x + 0.5, y1: 0, x2: x + 0.5, y2: L2 }, g);
      if (x % 100 === 0 && x > 0) {
        var t2 = el("text", { x: x + 3, y: 12, class: "bp-num" }, top);
        t2.textContent = x / 10;
      }
    }
    el("line", { x1: 0, y1: 14.5, x2: W, y2: 14.5, stroke: "currentColor", "stroke-opacity": 0.5 }, top);
    // calque : repères de coin, axes, cotes, cercle de construction
    g = el("g", { fill: "none", stroke: "currentColor", "stroke-width": 1 }, lay);
    var m = 34,
      c = 18;
    [
      [m, m, 1, 1],
      [W - m, m, -1, 1],
      [m, H - m, 1, -1],
      [W - m, H - m, -1, -1]
    ].forEach(function (p) {
      el("path", { d: "M" + p[0] + " " + (p[1] + c * p[3]) + "V" + p[1] + "H" + (p[0] + c * p[2]) }, g);
      el("circle", { cx: p[0] + 8 * p[2], cy: p[1] + 8 * p[3], r: 2.5 }, g);
    });
    // axes en trait mixte
    el(
      "path",
      { d: "M0 " + Math.round(H * 0.62) + "H" + W, "stroke-dasharray": "18 5 2 5", "stroke-opacity": 0.55 },
      g
    );
    el(
      "path",
      { d: "M" + Math.round(W * 0.78) + " 0V" + H, "stroke-dasharray": "18 5 2 5", "stroke-opacity": 0.55 },
      g
    );
    // cercle de construction centré sur l'intersection des axes
    var cx = Math.round(W * 0.78),
      cy = Math.round(H * 0.62),
      R = Math.min(W, H) * 0.22;
    el("circle", { cx: cx, cy: cy, r: R, "stroke-opacity": 0.7 }, g);
    el("circle", { cx: cx, cy: cy, r: R * 0.45, "stroke-dasharray": "6 4", "stroke-opacity": 0.6 }, g);
    el("path", { d: "M" + (cx - 10) + " " + cy + "H" + (cx + 10) + "M" + cx + " " + (cy - 10) + "V" + (cy + 10) }, g);
    // cote de diamètre
    var a = -Math.PI / 4,
      x1 = cx - R * Math.cos(a),
      y1 = cy - R * Math.sin(a),
      x2 = cx + R * Math.cos(a),
      y2 = cy + R * Math.sin(a);
    el("path", { d: "M" + x1 + " " + y1 + "L" + x2 + " " + y2 }, g);
    var td = el("text", { x: x2 + 6, y: y2 + 4, class: "bp-txt" }, lay);
    td.textContent = "Ø " + Math.round((R * 2) / 10) * 10;
    // cote horizontale sous la règle du haut
    function hdim(xa, xb, yy, label) {
      el(
        "path",
        {
          d:
            "M" +
            xa +
            " " +
            (yy - 6) +
            "V" +
            (yy + 6) +
            "M" +
            xb +
            " " +
            (yy - 6) +
            "V" +
            (yy + 6) +
            "M" +
            xa +
            " " +
            yy +
            "H" +
            xb
        },
        g
      );
      el(
        "path",
        { d: "M" + xa + " " + yy + "l9 -3v6zM" + xb + " " + yy + "l-9 -3v6z", fill: "currentColor", stroke: "none" },
        g
      );
      var tt = el("text", { x: (xa + xb) / 2, y: yy - 5, class: "bp-txt", "text-anchor": "middle" }, lay);
      tt.textContent = label;
    }
    hdim(Math.round(W * 0.08), Math.round(W * 0.42), Math.round(H * 0.93), Math.round(W * 0.34) + "");
    // cote verticale côté droit
    var vx = W - 16,
      ya = Math.round(H * 0.2),
      yb = Math.round(H * 0.45);
    el(
      "path",
      {
        d:
          "M" +
          (vx - 6) +
          " " +
          ya +
          "H" +
          (vx + 6) +
          "M" +
          (vx - 6) +
          " " +
          yb +
          "H" +
          (vx + 6) +
          "M" +
          vx +
          " " +
          ya +
          "V" +
          yb
      },
      g
    );
    el(
      "path",
      { d: "M" + vx + " " + ya + "l-3 9h6zM" + vx + " " + yb + "l-3 -9h6z", fill: "currentColor", stroke: "none" },
      g
    );
    var tv = el(
      "text",
      {
        x: vx - 6,
        y: (ya + yb) / 2,
        class: "bp-txt",
        "text-anchor": "middle",
        transform: "rotate(-90 " + (vx - 6) + " " + (ya + yb) / 2 + ")"
      },
      lay
    );
    tv.textContent = yb - ya + "";
    // rapporteur d'angle en haut à gauche
    var ox = Math.round(W * 0.06),
      oy = Math.round(H * 0.32),
      r = Math.min(90, W * 0.12);
    el(
      "path",
      {
        d:
          "M" +
          ox +
          " " +
          oy +
          "H" +
          (ox + r * 1.4) +
          "M" +
          ox +
          " " +
          oy +
          "L" +
          (ox + r * 1.4 * Math.cos(-0.66)) +
          " " +
          (oy + r * 1.4 * Math.sin(-0.66))
      },
      g
    );
    el(
      "path",
      {
        d:
          "M" +
          (ox + r) +
          " " +
          oy +
          "A" +
          r +
          " " +
          r +
          " 0 0 0 " +
          (ox + r * Math.cos(-0.66)) +
          " " +
          (oy + r * Math.sin(-0.66)),
        "stroke-dasharray": "3 3"
      },
      g
    );
    var ta = el("text", { x: ox + r + 6, y: oy - 12, class: "bp-txt" }, lay);
    ta.textContent = "38°";
  }
  var raf = 0,
    lastW = 0,
    lastH = 0;
  function later() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }
  addEventListener("resize", later);
  addEventListener("load", later);
  if (window.ResizeObserver) new ResizeObserver(later).observe(document.body);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw);
  else draw();
}
