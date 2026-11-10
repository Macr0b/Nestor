// Outils communs aux tests : chargement de geo.js sans navigateur et contrôles géométriques.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const fixture = (name) => readFileSync(join(ROOT, "tests", "fixtures", name), "utf8");

/** Charge geo.js dans un contexte isolé et renvoie { Geo, nest }. */
export function loadGeo() {
  const ctx = { console, Math, JSON, Uint8Array, Int32Array, Float64Array, Infinity, NaN };
  vm.createContext(ctx);
  for (const f of ["geo.js", "nest.js"]) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  vm.runInContext("this.Geo = Geo; this.nest = nest;", ctx);
  return { Geo: ctx.Geo, nest: ctx.nest };
}

/** Rectangle en polygone (sens horaire, repère Y vers le bas). */
export const rect = (w, h, x = 0, y = 0) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h]
];

/** Disque approché par un polygone. */
export function disc(r, n = 48, cx = r, cy = r) {
  const p = [];
  for (let i = 0; i < n; i++)
    p.push([cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
  return p;
}

/** Type de pièce prêt pour Geo.pack / nest / placedPaths. */
export function type(poly, qty = 1, extra = {}) {
  const xs = poly.map((q) => q[0]),
    ys = poly.map((q) => q[1]);
  const x0 = Math.min(...xs),
    y0 = Math.min(...ys);
  const pts = poly.map((q) => [q[0] - x0, q[1] - y0]);
  const w = Math.max(...xs) - x0,
    h = Math.max(...ys) - y0;
  return {
    w,
    h,
    qty,
    on: true,
    rot: 1,
    polys: [pts],
    lines: [],
    paths: [{ pts, closed: true, layer: "", color: "" }],
    ...extra
  };
}

function bbox(P) {
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity;
  for (const [x, y] of P) {
    a = Math.min(a, x);
    b = Math.min(b, y);
    c = Math.max(c, x);
    d = Math.max(d, y);
  }
  return [a, b, c, d];
}
function segDist(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function inside(p, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i],
      b = P[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
/** Distance minimale entre deux contours fermés (0 s'ils se chevauchent). */
export function polyDistance(A, B) {
  if (A.some((p) => inside(p, B)) || B.some((p) => inside(p, A))) return 0;
  let d = Infinity;
  for (const p of A) for (let j = 0; j < B.length; j++) d = Math.min(d, segDist(p, B[j], B[(j + 1) % B.length]));
  for (const p of B) for (let j = 0; j < A.length; j++) d = Math.min(d, segDist(p, A[j], A[(j + 1) % A.length]));
  return d;
}

/**
 * Vérifie une feuille : chaque pièce dans la zone utile, et un écart minimal entre pièces.
 * Renvoie la liste des problèmes trouvés (vide si tout va bien).
 */
export function checkSheet(Geo, sheet, types, { margin, gap, tol = 0.05 }) {
  const problems = [];
  const outlines = sheet.parts.map((p) => {
    const paths = Geo.placedPaths(types[p.i], p).filter((q) => q.closed);
    return paths.reduce((best, q) => (q.pts.length && (!best || area(q.pts) > area(best)) ? q.pts : best), null);
  });
  outlines.forEach((P, k) => {
    const [x0, y0, x1, y1] = bbox(P);
    if (x0 < margin - tol || y0 < margin - tol || x1 > sheet.L - margin + tol || y1 > sheet.W - margin + tol)
      problems.push(`pièce ${k} hors zone utile : ${[x0, y0, x1, y1].map((v) => v.toFixed(2))}`);
  });
  for (let a = 0; a < outlines.length; a++)
    for (let b = a + 1; b < outlines.length; b++) {
      const A = bbox(outlines[a]),
        B = bbox(outlines[b]);
      if (A[2] + gap < B[0] || B[2] + gap < A[0] || A[3] + gap < B[1] || B[3] + gap < A[1]) continue;
      const d = polyDistance(outlines[a], outlines[b]);
      if (d < gap - tol) problems.push(`pièces ${a} et ${b} trop proches : ${d.toFixed(2)} mm (écart demandé ${gap})`);
    }
  return problems;
}
export function area(P) {
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s / 2);
}
