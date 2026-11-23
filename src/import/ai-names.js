/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Noms des tracés d'un fichier Illustrator (.ai). La partie PDF du fichier, lue par pdf.js, ne garde pas les noms
   donnés dans le panneau Calques ; Illustrator les garde dans ses données internes (flux AIPrivateData),
   compressées (ZStandard depuis Illustrator 2020, zlib avant). On y relève les tracés dans l'ordre, avec leur nom,
   puis on les attache aux tracés lus par pdf.js, dans le même ordre, seulement si les deux listes se
   correspondent (même nombre de tracés, mêmes tailles). Sinon, rien ne change. */

// écart de taille admis entre un tracé des données internes et le même tracé lu par pdf.js
const SIZE_TOLERANCE = 0.1;
// part des tracés qui doivent avoir la même taille des deux côtés
const MATCH_SHARE = 0.9;

function latin1(bytes) {
  var out = "";
  for (var i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return out;
}

function joinBytes(a, b) {
  var out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function inflate(bytes) {
  var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* Octets d'un flux « n 0 obj << … >> stream … » du fichier, décompressés s'il est en FlateDecode. */
async function streamBytes(bytes, text, number) {
  var at = text.search(new RegExp("(^|[\\r\\n\\s])" + number + " 0 obj\\s*<<"));
  if (at < 0) return null;
  var dictStart = text.indexOf("<<", at),
    streamAt = text.indexOf("stream", dictStart);
  if (streamAt < 0) return null;
  var dict = text.slice(dictStart, streamAt),
    lengthRef = dict.match(/\/Length (\d+) (\d+) R/),
    length = lengthRef ? null : dict.match(/\/Length (\d+)/);
  if (lengthRef) {
    var value = text.match(new RegExp("(^|[\\r\\n\\s])" + lengthRef[1] + " 0 obj\\s*(\\d+)"));
    length = value ? [0, value[2]] : null;
  }
  if (!length) return null;
  var start = streamAt + 6;
  if (text[start] === "\r") start++;
  if (text[start] === "\n") start++;
  var raw = bytes.subarray(start, start + Number(length[1]));
  return /\/FlateDecode/.test(dict) ? inflate(raw) : raw;
}

/* Texte des données internes d'Illustrator, ou "" (fichier sans données internes, ou illisibles). */
export async function aiNativeText(data) {
  var bytes = new Uint8Array(data),
    text = latin1(bytes),
    refs = [],
    re = /\/AIPrivateData(\d+) (\d+) 0 R/g,
    m;
  while ((m = re.exec(text))) refs.push([Number(m[1]), Number(m[2])]);
  if (!refs.length) return "";
  refs.sort(function (a, b) {
    return a[0] - b[0];
  });
  var parts = [];
  for (var i = 0; i < refs.length; i++) {
    var part = await streamBytes(bytes, text, refs[i][1]);
    if (!part) return "";
    parts.push(part);
  }
  var all = parts.reduce(joinBytes, new Uint8Array(0));
  // un en-tête en clair, puis souvent une partie compressée, signalée par un marqueur
  var head = latin1(all.subarray(0, Math.min(all.length, 1 << 16))),
    zstd = head.indexOf("%AI24_ZStandard_Data"),
    zlib = head.indexOf("%AI12_CompressedData");
  if (zstd >= 0) {
    const { decompress } = await import("../../vendor/fzstd/fzstd.mjs");
    all = joinBytes(all.subarray(0, zstd), decompress(all.subarray(zstd + "%AI24_ZStandard_Data".length)));
  } else if (zlib >= 0) {
    all = joinBytes(all.subarray(0, zlib), await inflate(all.subarray(zlib + "%AI12_CompressedData".length)));
  }
  return new TextDecoder("utf-8").decode(all);
}

/* Identifiant Illustrator → nom affiché : « BGM_x5F_110_2_ » → « BGM_110 ». Dans ces identifiants, une espace
   devient « _ », un caractère spécial « _xHH_ » (le tiret bas : « _x5F_ »), et un nom déjà pris reçoit « _2_ ». */
export function aiDisplayName(uid) {
  return uid
    .replace(/_\d+_$/, "")
    .split(/(_x[0-9A-Fa-f]{2,4}_)/)
    .map(function (piece, i) {
      return i % 2 ? String.fromCharCode(parseInt(piece.slice(2, -1), 16)) : piece.replace(/_/g, " ");
    })
    .join("")
    .trim();
}

const PAINT = /^[sSfFbBnN]$/;
// segment de tracé : des nombres puis l'opérateur ; les deux derniers nombres sont le point d'ancrage
const SEGMENT = /^((?:-?[\d.]+(?:e-?\d+)? ){2,6})([mlLcCvVyY])$/;

/* Tracés des données internes, dans l'ordre de dessin : [{ name, w, h }] (un par sous-tracé, comme pdf.js).
   Le nom d'un objet vient juste après lui (bloc « %_/XMLUID ») ; celui d'un groupe ou d'un tracé composé
   s'applique à ses tracés sans nom. */
export function aiNativePaths(text) {
  var lines = text.split(/\r\n|\r|\n/),
    paths = [],
    inLayer = false,
    current = null,
    // objets terminés en attente de leur nom (le dernier tracé, ou tous ceux d'un groupe qui vient de se fermer)
    last = [],
    groups = [],
    compound = null;
  function addPoint(x, y) {
    if (!current) return;
    current.x0 = Math.min(current.x0, x);
    current.x1 = Math.max(current.x1, x);
    current.y0 = Math.min(current.y0, y);
    current.y1 = Math.max(current.y1, y);
  }
  function finishSubpath() {
    if (!current) return;
    var path = { name: "", w: current.x1 - current.x0, h: current.y1 - current.y0 };
    paths.push(path);
    if (compound) compound.push(path);
    groups.forEach(function (g) {
      g.push(path);
    });
    current = null;
    return path;
  }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf("%AI5_BeginLayer") === 0) {
      inLayer = true;
      last = [];
      continue;
    }
    if (line.indexOf("%AI5_EndLayer") === 0) {
      finishSubpath();
      inLayer = false;
      last = [];
      continue;
    }
    if (!inLayer) continue;
    var uid = line.match(/^%_\/XMLUID : \((.*)\) ; \(AI10_ArtUID\) ,$/);
    if (uid) {
      var name = aiDisplayName(uid[1]);
      last.forEach(function (p) {
        if (!p.name) p.name = name;
      });
      last = [];
      continue;
    }
    // nom d'un calque : son bloc suit, il ne nomme aucun tracé
    if (/\) Ln$/.test(line)) {
      last = [];
      continue;
    }
    if (line === "u") groups.push([]);
    else if (line === "U") last = groups.pop() || [];
    else if (line === "*u") compound = [];
    else if (line === "*U") {
      last = compound || [];
      compound = null;
    } else if (PAINT.test(line)) {
      var done = finishSubpath();
      if (!compound) last = done ? [done] : [];
    } else {
      var segment = line.match(SEGMENT);
      if (!segment) continue;
      var numbers = segment[1].trim().split(" ").map(Number),
        x = numbers[numbers.length - 2],
        y = numbers[numbers.length - 1];
      if (segment[2] === "m") {
        finishSubpath();
        current = { x0: x, x1: x, y0: y, y1: y };
      } else addPoint(x, y);
    }
  }
  return paths;
}

function size(path) {
  var x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  path.pts.forEach(function (q) {
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  });
  return { w: x1 - x0, h: y1 - y0 };
}

function median(values) {
  var v = values.slice().sort(function (a, b) {
    return a - b;
  });
  return v.length ? v[Math.floor(v.length / 2)] : NaN;
}

/* Attache les noms aux tracés lus par pdf.js (même ordre), si les deux listes se correspondent.
   Rend le nombre de tracés nommés. */
export function attachAiNames(pdfPaths, nativePaths) {
  if (!nativePaths.length || nativePaths.length !== pdfPaths.length) return 0;
  if (
    !nativePaths.some(function (p) {
      return p.name;
    })
  )
    return 0;
  var sizes = pdfPaths.map(size),
    // échelle entre les deux (unités du fichier ↔ unités de Nestor), d'après les plus grands côtés
    scale = median(
      sizes
        .map(function (s, i) {
          var n = nativePaths[i],
            big = Math.max(n.w, n.h);
          return big > 0 ? Math.max(s.w, s.h) / big : NaN;
        })
        .filter(isFinite)
    );
  if (!(scale > 0)) return 0;
  var same = 0;
  sizes.forEach(function (s, i) {
    var n = nativePaths[i],
      tol = function (a, b) {
        return Math.abs(a - b) <= SIZE_TOLERANCE * Math.max(a, b) + 0.5;
      };
    if (tol(s.w, n.w * scale) && tol(s.h, n.h * scale)) same++;
  });
  if (same < MATCH_SHARE * pdfPaths.length) return 0;
  var named = 0;
  pdfPaths.forEach(function (p, i) {
    if (!p.name && nativePaths[i].name) {
      p.name = nativePaths[i].name;
      named++;
    }
  });
  return named;
}
