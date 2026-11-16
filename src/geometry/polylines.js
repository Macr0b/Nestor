/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Outils sur les polylignes : encombrement, simplification, fermeture des contours presque fermés, longueur du contour extérieur. */

export function boundingBox(paths) {
  var box = [Infinity, Infinity, -Infinity, -Infinity];
  paths.forEach(function (p) {
    p.pts.forEach(function (q) {
      if (q[0] < box[0]) box[0] = q[0];
      if (q[1] < box[1]) box[1] = q[1];
      if (q[0] > box[2]) box[2] = q[0];
      if (q[1] > box[3]) box[3] = q[1];
    });
  });
  return box;
}

export function simplifyPolyline(pts, tol) {
  if (pts.length < 3) return pts;
  var keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  var stack = [[0, pts.length - 1]];
  while (stack.length) {
    var r = stack.pop(),
      a = pts[r[0]],
      b = pts[r[1]],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      L = Math.hypot(dx, dy),
      maxDistance = -1,
      maxIndex = -1;
    for (var k = r[0] + 1; k < r[1]; k++) {
      var p = pts[k],
        d =
          L < 1e-12
            ? Math.hypot(p[0] - a[0], p[1] - a[1])
            : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L;
      if (d > maxDistance) {
        maxDistance = d;
        maxIndex = k;
      }
    }
    if (maxDistance > tol) {
      keep[maxIndex] = 1;
      stack.push([r[0], maxIndex]);
      stack.push([maxIndex, r[1]]);
    }
  }
  return pts.filter(function (_, k) {
    return keep[k];
  });
}

export function closeIfNearlyClosed(path) {
  if (!path.closed && path.pts.length > 2) {
    var first = path.pts[0],
      last = path.pts[path.pts.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.01) {
      path.closed = true;
      path.pts.pop();
    }
  }
}

// mise à l'échelle des tracés lus (unités du fichier -> mm), avec l'axe Y retourné (Y vers le haut dans le fichier,
// vers le bas dans l'appli), puis suppression des points superflus
export function scaleAndFlipY(paths, factor) {
  paths.forEach(function (path) {
    path.pts = simplifyPolyline(
      path.pts.map(function (q) {
        return [q[0] * factor, -q[1] * factor];
      }),
      0.01
    );
  });
}

/* Longueur du contour extérieur d'une pièce (le plus grand tracé fermé), sans les trous ni les traits intérieurs.
   Pièce sans tracé fermé : le tour de son rectangle. Sert à estimer le temps de découpe. */
export function outerContourLength(part) {
  var best = null,
    bestArea = -1;
  part.paths.forEach(function (p) {
    if (!p.closed || p.pts.length < 3) return;
    var a = 0,
      P = p.pts;
    for (var i = 0; i < P.length; i++) {
      var q = P[i],
        r = P[(i + 1) % P.length];
      a += q[0] * r[1] - r[0] * q[1];
    }
    if (Math.abs(a) > bestArea) {
      bestArea = Math.abs(a);
      best = P;
    }
  });
  if (!best) return 2 * (part.w + part.h);
  var length = 0;
  for (var j = 0; j < best.length; j++) {
    var s = best[j],
      t = best[(j + 1) % best.length];
    length += Math.hypot(t[0] - s[0], t[1] - s[1]);
  }
  return length;
}
