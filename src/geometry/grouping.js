/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Regroupement : segments chaînés en contours, trous rangés dans leur pièce, pièces identiques fusionnées
   en types de pièces (avec quantité). */

import { boundingBox, closeIfNearlyClosed, pointInPolygon, simplifyPolyline } from "./polylines.js";

export function groupPieces(paths) {
  paths.forEach(function (p, i) {
    if (p._i == null) p._i = i;
  });
  paths = paths.filter(function (p) {
    return p.pts.length >= 2;
  });
  paths.forEach(closeIfNearlyClosed);
  var N = paths.length,
    par = new Int32Array(N);
  for (var i = 0; i < N; i++) par[i] = i;
  function findRoot(x) {
    while (par[x] !== x) {
      par[x] = par[par[x]];
      x = par[x];
    }
    return x;
  }
  var tol = 0.05,
    grid = {};
  function key(x, y) {
    return Math.round(x / tol) + ":" + Math.round(y / tol);
  }
  paths.forEach(function (p, idx) {
    if (p.closed) return;
    [p.pts[0], p.pts[p.pts.length - 1]].forEach(function (q) {
      var gx = Math.round(q[0] / tol),
        gy = Math.round(q[1] / tol);
      for (var ax = -1; ax <= 1; ax++)
        for (var ay = -1; ay <= 1; ay++) {
          var l = grid[gx + ax + ":" + (gy + ay)];
          if (l)
            l.forEach(function (o) {
              var po = paths[o.i].pts[o.e ? paths[o.i].pts.length - 1 : 0];
              if (Math.hypot(po[0] - q[0], po[1] - q[1]) <= tol) {
                par[findRoot(idx)] = findRoot(o.i);
              }
            });
        }
    });
    var k1 = key(p.pts[0][0], p.pts[0][1]),
      k2 = key(p.pts[p.pts.length - 1][0], p.pts[p.pts.length - 1][1]);
    (grid[k1] = grid[k1] || []).push({ i: idx, e: 0 });
    (grid[k2] = grid[k2] || []).push({ i: idx, e: 1 });
  });
  var groupsByRoot = {};
  paths.forEach(function (p, idx) {
    var r = findRoot(idx);
    (groupsByRoot[r] = groupsByRoot[r] || []).push(p);
  });
  function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  function chain(ps) {
    var closed = ps.filter(function (p) {
        return p.closed;
      }),
      rem = ps.filter(function (p) {
        return !p.closed;
      }),
      out = closed.slice();
    while (rem.length) {
      var cur = rem.shift(),
        pts = cur.pts.slice(),
        found = true;
      while (found) {
        found = false;
        for (var i = 0; i < rem.length; i++) {
          var q = rem[i].pts,
            s = q[0],
            e = q[q.length - 1],
            end = pts[pts.length - 1],
            st = pts[0];
          if (distance(end, s) <= tol) pts = pts.concat(q.slice(1));
          else if (distance(end, e) <= tol) pts = pts.concat(q.slice().reverse().slice(1));
          else if (distance(st, e) <= tol) pts = q.slice(0, -1).concat(pts);
          else if (distance(st, s) <= tol) pts = q.slice().reverse().slice(0, -1).concat(pts);
          else continue;
          rem.splice(i, 1);
          found = true;
          break;
        }
      }
      var c = pts.length > 3 && distance(pts[0], pts[pts.length - 1]) <= tol;
      if (c) pts.pop();
      out.push({ pts: pts, closed: c, layer: cur.layer, color: cur.color, name: cur.name, _i: cur._i });
    }
    return out;
  }
  var clusters = Object.keys(groupsByRoot).map(function (k) {
    var ps = chain(groupsByRoot[k]);
    return { paths: ps, b: boundingBox(ps) };
  });
  function build(cls) {
    cls.sort(function (a, b) {
      return (b.b[2] - b.b[0]) * (b.b[3] - b.b[1]) - (a.b[2] - a.b[0]) * (a.b[3] - a.b[1]);
    });
    var tops = [],
      e = 0.01;
    cls.forEach(function (c) {
      // hôte possible : la pièce dont le cadre contient le tracé, ou dont le contour en contient la plupart des points
      // (un trait qui déborde à peine du cadre, comme une semelle dessinée jusqu'au bord)
      var hosts = tops.filter(function (top) {
        var h = top.b;
        if (c.b[0] >= h[0] - e && c.b[1] >= h[1] - e && c.b[2] <= h[2] + e && c.b[3] <= h[3] + e) return true;
        if (c.b[0] > h[2] || c.b[2] < h[0] || c.b[1] > h[3] || c.b[3] < h[1]) return false;
        return insideShare(c, top) > 0.5;
      });
      // plusieurs pièces dont les cadres se chevauchent (formes imbriquées) : celle dont le contour contient
      // le plus de points du tracé, à égalité la plus proche de lui
      var host = hosts.length > 1 ? closestHost(c, hosts) : hosts[0] || null;
      if (host) {
        host.paths = host.paths.concat(c.paths);
        host.kids++;
        // le cadre de la pièce englobe aussi un trait qui déborde un peu
        host.b = [
          Math.min(host.b[0], c.b[0]),
          Math.min(host.b[1], c.b[1]),
          Math.max(host.b[2], c.b[2]),
          Math.max(host.b[3], c.b[3])
        ];
      } else tops.push({ paths: c.paths.slice(), b: c.b, kids: 0, outer: c });
    });
    return tops;
  }
  // contour fermé le plus grand d'un groupe, et part des points d'un autre groupe qui tombent dedans
  function outline(cluster) {
    var best = null,
      area = -1;
    cluster.paths.forEach(function (p) {
      if (!p.closed) return;
      var b = boundingBox([p]),
        a = (b[2] - b[0]) * (b[3] - b[1]);
      if (a > area) {
        area = a;
        best = p.pts;
      }
    });
    return best;
  }
  function samplePoints(cluster) {
    var pts = [];
    cluster.paths.forEach(function (p) {
      var step = Math.max(1, Math.floor(p.pts.length / 8));
      for (var i = 0; i < p.pts.length; i += step) pts.push(p.pts[i]);
    });
    return pts;
  }
  function hostOutline(top) {
    return top.outer.poly || (top.outer.poly = outline(top.outer));
  }
  function insideShare(cluster, top) {
    var poly = hostOutline(top),
      pts = samplePoints(cluster);
    if (!poly || !pts.length) return 0;
    return (
      pts.filter(function (pt) {
        return pointInPolygon(pt, poly);
      }).length / pts.length
    );
  }
  function closestHost(cluster, hosts) {
    var pts = samplePoints(cluster),
      best = hosts[0],
      bestInside = -1,
      bestGap = Infinity;
    hosts.forEach(function (top) {
      var poly = hostOutline(top);
      if (!poly) return;
      var inside = 0,
        gap = Infinity;
      pts.forEach(function (pt) {
        if (pointInPolygon(pt, poly)) inside++;
        poly.forEach(function (q) {
          var d = Math.hypot(q[0] - pt[0], q[1] - pt[1]);
          if (d < gap) gap = d;
        });
      });
      if (inside > bestInside || (inside === bestInside && gap < bestGap)) {
        best = top;
        bestInside = inside;
        bestGap = gap;
      }
    });
    return best;
  }
  var tops = build(clusters.slice()),
    frame = false;
  if (tops.length === 1 && tops[0].kids >= 2) {
    var o = tops[0].outer;
    if (
      o.paths.length === 1 &&
      o.paths[0].closed &&
      simplifyPolyline(o.paths[0].pts.concat([o.paths[0].pts[0]]), 0.01).length <= 5
    ) {
      frame = true;
      tops = build(
        clusters.filter(function (c) {
          return c !== o;
        })
      );
    }
  }
  var pieces = tops.map(function (t) {
    var b = t.b,
      op = t.outer.paths,
      nm = "",
      ly = "",
      ord = Infinity;
    // nom : celui du contour extérieur (un trou nommé ne renomme pas la pièce) ; calque : celui du contour extérieur, sinon d'un de ses tracés
    op.some(function (p) {
      if (p.name) {
        nm = p.name;
        return true;
      }
      return false;
    });
    op.concat(t.paths).some(function (p) {
      if (p.layer) {
        ly = p.layer;
        return true;
      }
      return false;
    });
    t.paths.forEach(function (p) {
      if (p._i != null && p._i < ord) ord = p._i;
    });
    return {
      w: b[2] - b[0],
      h: b[3] - b[1],
      ox: b[0],
      oy: b[1],
      name: nm,
      layer: ly,
      ord: ord === Infinity ? 0 : ord,
      paths: t.paths.map(function (p) {
        return {
          pts: p.pts.map(function (q) {
            return [q[0] - b[0], q[1] - b[1]];
          }),
          closed: p.closed,
          layer: p.layer || "",
          color: p.color || ""
        };
      })
    };
  });
  return { pieces: pieces, frame: frame };
}

function shapeSignature(piece) {
  var n = 0;
  piece.paths.forEach(function (p) {
    n += p.pts.length;
  });
  return (
    Math.round(piece.w * 10) +
    "x" +
    Math.round(piece.h * 10) +
    "/" +
    piece.paths.length +
    "/" +
    n +
    "/" +
    (piece.name || "") +
    "/" +
    (piece.layer || "")
  );
}

export function buildPartTypes(pieces) {
  var map = {},
    list = [];
  pieces.forEach(function (pc) {
    var s = shapeSignature(pc);
    if (map[s]) {
      map[s].qty++;
      return;
    }
    var t = {
      name: pc.name || "",
      layer: pc.layer || "",
      ord: pc.ord || 0,
      qty: 1,
      rot: true,
      w: pc.w,
      h: pc.h,
      paths: pc.paths
    };
    map[s] = t;
    list.push(t);
  });
  // numérotation dans l'ordre du fichier
  list.sort(function (a, b) {
    return a.ord - b.ord;
  });
  return list;
}
