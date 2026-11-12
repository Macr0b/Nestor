/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Imbrication selon la forme (« nesting »).
   Cette fonction doit rester autonome : elle est recopiée telle quelle dans un Web Worker (via nest.toString()),
   elle ne peut donc utiliser ni Geo, ni le DOM, ni aucune variable extérieure.

   Entrée  : { panels:[{L,W,qty}], gap, margin, types:[{w,h,rot,qty,on,polys,lines}] }
             rot : 0 = sens fixe (0° ou 180°), 1 = quarts de tour, 2 = rotation libre par pas de 5°
   Sortie  : { sheets:[{pi,L,W,parts:[{i,x,y,w,h,k|a,mx,my}]}], unplaced:[{i,why:"size"|"stock"}], total, count, res }

   Principe : chaque pièce est convertie en grille de cases (« raster ») d'environ res mm ;
   on la place au plus près de l'origine (colonne la plus à gauche, puis le plus haut) sans toucher
   les cases déjà occupées, élargies de l'écart demandé. */
function nest(input) {
  "use strict";
  // origine au centre ou au milieu d'un bord : grouper autour de ce point peut gaspiller de la place (une grande pièce
  // posée au milieu bloque les côtés). On calcule aussi le groupement depuis le coin, et on le garde s'il place
  // plus de pièces ou utilise moins de panneaux ; sinon le groupement autour de l'origine l'emporte.
  if (!input._anch && input.anchor && (input.anchor.ax || input.anchor.ay)) {
    var Anc = nest(Object.assign({}, input, { _anch: 1 }));
    // tout tient sur un seul panneau : impossible de faire mieux, inutile de calculer depuis le coin
    if (Anc.count === Anc.total && Anc.sheets.length <= 1) return Anc;
    var Cor = nest(Object.assign({}, input, { _anch: 1, anchor: null }));
    if (Cor.count > Anc.count || (Cor.count === Anc.count && Cor.sheets.length < Anc.sheets.length)) return Cor;
    return Anc;
  }
  // rotation libre : on calcule aussi la version « quart de tour » et on garde la meilleure, pour ne jamais faire pire
  if (
    !input._inner &&
    (input.types || []).some(function (t) {
      return t.rot === 2 && t.on && t.qty > 0;
    })
  ) {
    var A = nest(Object.assign({}, input, { _inner: 1 }));
    var B = nest(
      Object.assign({}, input, {
        _inner: 1,
        types: input.types.map(function (t) {
          return t.rot === 2 ? Object.assign({}, t, { rot: 1 }) : t;
        })
      })
    );
    // encombrement du groupe de pièces sur le dernier panneau (le plus petit est le plus compact)
    function ext(r) {
      var s = r.sheets[r.sheets.length - 1],
        x0 = Infinity,
        y0 = Infinity,
        x1 = 0,
        y1 = 0;
      if (!s) return 0;
      s.parts.forEach(function (p) {
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x + p.w);
        y1 = Math.max(y1, p.y + p.h);
      });
      return Math.max(x1 - x0, y1 - y0);
    }
    if (A.count !== B.count) return A.count > B.count ? A : B;
    if (A.sheets.length !== B.sheets.length) return A.sheets.length < B.sheets.length ? A : B;
    return ext(A) < ext(B) - 1 ? A : B;
  }
  var gap = Math.max(0, input.gap || 0),
    margin = Math.max(0, input.margin || 0),
    types = input.types,
    // point d'accroche dans la zone utile : 0 = bord (x = 0 ou y = 0), 0.5 = milieu ; les pièces se groupent autour
    ax = input.anchor && input.anchor.ax === 0.5 ? 0.5 : 0,
    ay = input.anchor && input.anchor.ay === 0.5 ? 0.5 : 0;
  var panels = (input.panels || [])
    .map(function (p, pi) {
      return { pi: pi, L: p.L, W: p.W, left: p.qty < 0 ? Infinity : p.qty };
    })
    .filter(function (p) {
      return p.L > 0 && p.W > 0;
    });
  var maxA = 0;
  panels.forEach(function (p) {
    maxA = Math.max(maxA, p.L * p.W);
  });
  var r = Math.max(0.4, Math.sqrt(maxA / 700000));
  var R = Math.ceil(gap / r + 1.42),
    M = Math.ceil(margin / r);
  function rotPts(pts, w, h, k) {
    return pts.map(function (q) {
      var u = q[0],
        v = q[1];
      return k === 0 ? [u, v] : k === 1 ? [h - v, u] : k === 2 ? [w - u, h - v] : [v, w - u];
    });
  }
  function raster(polys, w, h, lines) {
    var wc = Math.max(1, Math.ceil(w / r - 1e-9)),
      hc = Math.max(1, Math.ceil(h / r - 1e-9)),
      g = new Uint8Array(wc * hc);
    function mark(x, y) {
      var cx = Math.floor(x / r),
        cy = Math.floor(y / r);
      if (cx < 0) cx = 0;
      if (cy < 0) cy = 0;
      if (cx >= wc) cx = wc - 1;
      if (cy >= hc) cy = hc - 1;
      g[cy * wc + cx] = 1;
    }
    function edge(a, b) {
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = Math.ceil(len / (r * 0.4)) + 1;
      for (var s = 0; s <= n; s++) {
        var t = s / n;
        mark(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      }
    }
    (lines || []).forEach(function (P) {
      for (var i = 0; i + 1 < P.length; i++) edge(P[i], P[i + 1]);
    });
    if (!polys.length && !(lines && lines.length)) {
      g.fill(1);
    } else {
      polys.forEach(function (P) {
        for (var i = 0; i < P.length; i++) edge(P[i], P[(i + 1) % P.length]);
      });
      for (var j = 0; j < hc; j++) {
        var yc = (j + 0.5) * r,
          xs = [];
        polys.forEach(function (P) {
          for (var i = 0; i < P.length; i++) {
            var a = P[i],
              b = P[(i + 1) % P.length];
            if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc))
              xs.push(a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
          }
        });
        xs.sort(function (p, q) {
          return p - q;
        });
        for (var k = 0; k + 1 < xs.length; k += 2) {
          var x0 = Math.max(0, Math.floor(xs[k] / r)),
            x1 = Math.min(wc - 1, Math.floor(xs[k + 1] / r));
          for (var x = x0; x <= x1; x++) g[j * wc + x] = 1;
        }
      }
    }
    var rowsI = [],
      cells = 0;
    for (var y = 0; y < hc; y++) {
      var iv = [],
        x = 0;
      while (x < wc) {
        if (g[y * wc + x]) {
          var a0 = x;
          while (x < wc && g[y * wc + x]) x++;
          iv.push(a0, x - 1);
          cells += x - a0;
        } else x++;
      }
      rowsI.push(iv);
    }
    var dil = {};
    for (var y2 = 0; y2 < hc; y2++) {
      var iv2 = rowsI[y2];
      for (var t = 0; t < iv2.length; t += 2)
        for (var dy = -R; dy <= R; dy++) {
          var dx = Math.floor(Math.sqrt(R * R - dy * dy)),
            ry = y2 + dy;
          (dil[ry] = dil[ry] || []).push([iv2[t] - dx, iv2[t + 1] + dx]);
        }
    }
    var dilRows = [];
    Object.keys(dil).forEach(function (k) {
      var arr = dil[k].sort(function (p, q) {
          return p[0] - q[0];
        }),
        out = [];
      arr.forEach(function (s) {
        if (out.length && s[0] <= out[out.length - 1][1] + 1)
          out[out.length - 1][1] = Math.max(out[out.length - 1][1], s[1]);
        else out.push([s[0], s[1]]);
      });
      dilRows.push({ dy: +k, iv: out });
    });
    return { wc: wc, hc: hc, rows: rowsI, dil: dilRows, cells: cells };
  }
  // une orientation ne mérite d'être calculée que si son encombrement rentre dans au moins un panneau
  function fitsSome(w, h) {
    return panels.some(function (P) {
      return w <= P.L - 2 * margin + 1e-6 && h <= P.W - 2 * margin + 1e-6;
    });
  }
  var orient = types.map(function (t) {
    if (!t.on || !(t.qty > 0)) return null;
    var seen = {},
      list = [];
    function add(o) {
      var sig =
        o.wc +
        "x" +
        o.hc +
        ":" +
        o.rows
          .map(function (x) {
            return x.join(",");
          })
          .join("|");
      if (seen[sig]) return;
      seen[sig] = 1;
      list.push(o);
    }
    if (t.rot === 2) {
      // rotation libre par pas de 5° : pièce tournée autour de l'origine puis recalée en (0,0)
      var all = t.polys.concat(t.lines || []);
      for (var a = 0; a < 360; a += 5) {
        var c = Math.cos((a * Math.PI) / 180),
          sn = Math.sin((a * Math.PI) / 180);
        function rp(P) {
          return P.map(function (q) {
            return [q[0] * c - q[1] * sn, q[0] * sn + q[1] * c];
          });
        }
        var mx = Infinity,
          my = Infinity,
          Mx = -Infinity,
          My = -Infinity;
        all.forEach(function (P) {
          rp(P).forEach(function (q) {
            if (q[0] < mx) mx = q[0];
            if (q[1] < my) my = q[1];
            if (q[0] > Mx) Mx = q[0];
            if (q[1] > My) My = q[1];
          });
        });
        if (!isFinite(mx)) {
          mx = 0;
          my = 0;
          Mx = t.w;
          My = t.h;
        }
        if (!fitsSome(Mx - mx, My - my)) continue;
        function sh(P) {
          return rp(P).map(function (q) {
            return [q[0] - mx, q[1] - my];
          });
        }
        var o = raster(t.polys.map(sh), Mx - mx, My - my, (t.lines || []).map(sh));
        o.a = a;
        o.mx = mx;
        o.my = my;
        o.w = Mx - mx;
        o.h = My - my;
        add(o);
      }
    } else {
      var ks = t.rot ? [0, 1, 2, 3] : [0, 2];
      ks.forEach(function (k) {
        var w = k % 2 ? t.h : t.w,
          h = k % 2 ? t.w : t.h;
        if (!fitsSome(w, h)) return;
        var o = raster(
          t.polys.map(function (P) {
            return rotPts(P, t.w, t.h, k);
          }),
          w,
          h,
          (t.lines || []).map(function (P) {
            return rotPts(P, t.w, t.h, k);
          })
        );
        o.k = k;
        o.w = w;
        o.h = h;
        add(o);
      });
    }
    return list;
  });
  var items = [],
    tooBig = [];
  types.forEach(function (t, i) {
    if (!orient[i]) return;
    var q = Math.floor(t.qty);
    if (!orient[i].length) {
      for (var z = 0; z < q; z++) tooBig.push({ i: i, why: "size" });
      return;
    }
    for (var j = 0; j < q; j++) items.push({ i: i, cells: orient[i][0].cells });
  });
  items.sort(function (a, b) {
    return b.cells - a.cells || a.i - b.i;
  });
  var sheets = [];
  // grille de la zone utile seulement : la case (0,0) commence au bord de la marge ; les limites sont vérifiées
  // sur les cotes réelles des pièces, pour qu'une pièce exactement à la taille utile soit acceptée
  function newSheet(P) {
    var uw = P.L - 2 * margin,
      uh = P.W - 2 * margin,
      cols = Math.max(1, Math.ceil(uw / r - 1e-9)),
      rows = Math.max(1, Math.ceil(uh / r - 1e-9)),
      occ = new Uint8Array(cols * rows),
      prev = new Int32Array(cols * rows),
      next = new Int32Array(cols * rows);
    // ex, ey : étendue actuelle du groupe de pièces depuis le point d'accroche (en cases)
    var s = { P: P, uw: uw, uh: uh, cols: cols, rows: rows, occ: occ, prev: prev, next: next, parts: [], ex: 0, ey: 0 };
    s.cx = uw / r / 2;
    s.cy = uh / r / 2;
    for (var yy = 0; yy < rows; yy++) rowPrev(s, yy);
    return s;
  }
  // prev : dernière case occupée à gauche (ou dessous) ; next : première case occupée à droite (ou dessus)
  function rowPrev(s, y) {
    var last = -1,
      b = y * s.cols;
    for (var x = 0; x < s.cols; x++) {
      if (s.occ[b + x]) last = x;
      s.prev[b + x] = last;
    }
    last = s.cols;
    for (var x2 = s.cols - 1; x2 >= 0; x2--) {
      if (s.occ[b + x2]) last = x2;
      s.next[b + x2] = last;
    }
  }
  function conflict(s, o, x, y) {
    for (var j = 0; j < o.hc; j++) {
      var iv = o.rows[j],
        base = (y + j) * s.cols + x;
      for (var t = 0; t < iv.length; t += 2) {
        var p = s.prev[base + iv[t + 1]];
        if (p >= x + iv[t]) return p - iv[t] + 1;
      }
    }
    return -1;
  }
  // conflit en allant vers la gauche : renvoie x lui-même si la place est libre, sinon la prochaine position à essayer,
  // toujours plus petite que x (elle peut être négative : la ligne est alors épuisée)
  function conflictLeft(s, o, x, y) {
    for (var j = 0; j < o.hc; j++) {
      var iv = o.rows[j],
        base = (y + j) * s.cols + x;
      for (var t = 0; t < iv.length; t += 2) {
        var n = s.next[base + iv[t]];
        if (n <= x + iv[t + 1]) return n - iv[t + 1] - 1;
      }
    }
    return x;
  }
  // étendue d'une pièce depuis le point d'accroche, sur un axe (en cases) : depuis le bord, ou deux fois l'écart au milieu
  function extent(p, size, mid, half) {
    return half ? 2 * Math.max(mid - p, p + size - mid) : p + size;
  }
  // note d'une position : on garde le groupe le plus compact autour de l'accroche (le plus petit carré qui l'englobe),
  // puis la plus petite somme largeur + hauteur, puis la pièce la plus proche de l'accroche
  // la note ne dépend que des étendues px, py de la pièce et croît avec elles : elle sert aussi de borne pour écarter
  // d'avance les lignes et les positions qui ne peuvent pas faire mieux
  function scoreOf(s, px, py) {
    var Ex = Math.max(s.ex, px),
      Ey = Math.max(s.ey, py);
    return Math.max(Ex, Ey) * 1e9 + (Ex + Ey) * 1e5 + px + py;
  }
  function scoreAt(s, o, x, y) {
    var px = extent(x, o.wc, s.cx, ax),
      py = extent(y, o.hc, s.cy, ay);
    return { v: scoreOf(s, px, py), Ex: Math.max(s.ex, px), Ey: Math.max(s.ey, py) };
  }
  function fit(s, o, bestScore) {
    if (o.wc > s.cols || o.hc > s.rows || o.w > s.uw + 1e-6 || o.h > s.uh + 1e-6) return null;
    // copies locales : ces calculs sont faits des millions de fois
    var EX = s.ex,
      EY = s.ey,
      CX = s.cx,
      CY = s.cy,
      WC = o.wc,
      HC = o.hc;
    function note(px, py) {
      var Ex = EX > px ? EX : px,
        Ey = EY > py ? EY : py;
      return (Ex > Ey ? Ex : Ey) * 1e9 + (Ex + Ey) * 1e5 + px + py;
    }
    function extX(x) {
      if (!ax) return x + WC;
      var a = CX - x,
        b = x + WC - CX;
      return 2 * (a > b ? a : b);
    }
    function extY(y) {
      if (!ay) return y + HC;
      var a = CY - y,
        b = y + HC - CY;
      return 2 * (a > b ? a : b);
    }
    var best = null,
      maxX = Math.min(s.cols - o.wc, Math.floor((s.uw - o.w) / r + 1e-6)),
      maxY = Math.min(s.rows - o.hc, Math.floor((s.uh - o.h) / r + 1e-6));
    // position de départ sur chaque ligne : contre le bord, ou centrée sur le milieu
    var x0 = ax ? Math.max(0, Math.min(maxX, Math.round(s.cx - o.wc / 2))) : 0,
      minPx = o.wc;
    function consider(x, y) {
      var v = note(extX(x), extY(y));
      if (v < bestScore) {
        bestScore = v;
        best = { x: x, y: y, score: v };
      }
    }
    // lignes parcourues en partant de l'accroche : une bonne place est trouvée tôt et écarte vite les autres
    var y0 = ay ? Math.max(0, Math.min(maxY, Math.round(s.cy - o.hc / 2))) : 0;
    for (var n = 0; n <= maxY; n++) {
      var y = ay ? (n % 2 ? y0 + (n + 1) / 2 : y0 - n / 2) : n;
      if (y < 0 || y > maxY) {
        if (ay && n > 2 * Math.max(y0, maxY - y0)) break;
        continue;
      }
      // borne basse de la ligne : si même la meilleure position possible ne fait pas mieux, on passe
      var py = extY(y);
      if (note(minPx, py) >= bestScore) continue;
      // vers la droite (seul sens utile quand l'accroche est sur le bord gauche) ; on s'arrête dès que la note
      // ne peut plus faire mieux que la meilleure place trouvée
      var x = x0;
      while (x <= maxX && note(extX(x), py) < bestScore) {
        var c = conflict(s, o, x, y);
        if (c < 0) {
          consider(x, y);
          break;
        }
        x = c;
      }
      // vers la gauche quand l'accroche est au milieu
      if (ax) {
        x = x0 - 1;
        while (x >= 0 && note(extX(x), py) < bestScore) {
          var c2 = conflictLeft(s, o, x, y);
          if (c2 === x) {
            consider(x, y);
            break;
          }
          x = c2;
        }
      }
    }
    return best;
  }
  function place(s, o, x, y) {
    o.dil.forEach(function (d) {
      var yy = y + d.dy;
      if (yy < 0 || yy >= s.rows) return;
      var b = yy * s.cols;
      d.iv.forEach(function (v) {
        var x0 = Math.max(0, x + v[0]),
          x1 = Math.min(s.cols - 1, x + v[1]);
        for (var xx = x0; xx <= x1; xx++) s.occ[b + xx] = 1;
      });
      rowPrev(s, yy);
    });
  }
  function tryOn(s, os) {
    var best = null,
      bo = null;
    os.forEach(function (o) {
      var f = fit(s, o, best ? best.score : Infinity);
      if (f) {
        best = f;
        bo = o;
      }
    });
    return best ? { f: best, o: bo } : null;
  }
  var unplaced = [],
    fitCache = {};
  items.forEach(function (it) {
    var os = orient[it.i],
      done = null,
      si;
    for (si = 0; si < sheets.length && !done; si++) {
      var t = tryOn(sheets[si], os);
      if (t) done = { s: sheets[si], t: t };
    }
    if (!done) {
      for (var q = 0; q < panels.length && !done; q++) {
        var P = panels[q];
        if (P.left <= 0) continue;
        var s = newSheet(P),
          t2 = tryOn(s, os);
        if (t2) {
          P.left--;
          sheets.push(s);
          done = { s: s, t: t2 };
        }
      }
    }
    if (done) {
      place(done.s, done.t.o, done.t.f.x, done.t.f.y);
      var sc = scoreAt(done.s, done.t.o, done.t.f.x, done.t.f.y);
      done.s.ex = sc.Ex;
      done.s.ey = sc.Ey;
      var oo = done.t.o,
        pp = { i: it.i, x: margin + done.t.f.x * r, y: margin + done.t.f.y * r, w: oo.w, h: oo.h };
      if (oo.a != null) {
        pp.a = oo.a;
        pp.mx = oo.mx;
        pp.my = oo.my;
      } else pp.k = oo.k;
      done.s.parts.push(pp);
    } else {
      var key = it.i;
      if (fitCache[key] == null)
        fitCache[key] = panels.some(function (P) {
          return !!tryOn(newSheet(P), os);
        });
      unplaced.push({ i: it.i, why: fitCache[key] ? "stock" : "size" });
    }
  });
  unplaced = unplaced.concat(tooBig);
  return {
    sheets: sheets.map(function (s) {
      return { pi: s.P.pi, L: s.P.L, W: s.P.W, parts: s.parts };
    }),
    unplaced: unplaced,
    total: items.length + tooBig.length,
    count: items.length - (unplaced.length - tooBig.length),
    res: r
  };
}
