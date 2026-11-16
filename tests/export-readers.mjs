// Lecteurs des fichiers exportés, pour les tests. Chaque format exporté par l'appli DOIT avoir un lecteur ici :
// le test « tous les formats d'export » échoue sinon, pour qu'aucun format ne reste sans vérification.
// Chaque lecteur renvoie les tracés dans le même repère machine : X vers la droite, Y vers le haut, zéro à l'origine
// choisie, en mm : { calque: [ { pts: [[x, y], ...], closed }, ... ], ... }
// Un fichier écrit en pouces (DXF : $INSUNITS = 1 ; SVG : largeur en « in ») est ramené en mm.

const toMm = (layers, k) => {
  if (k !== 1)
    for (const paths of Object.values(layers)) for (const p of paths) p.pts = p.pts.map(([x, y]) => [x * k, y * k]);
  return layers;
};

/** Unité écrite dans le fichier : "in" ou "mm". */
export function fileUnit(text) {
  const dxf = text.match(/\$INSUNITS\s*\r?\n\s*70\s*\r?\n\s*(\d+)/);
  if (dxf) return dxf[1] === "1" ? "in" : "mm";
  const svg = text.match(/<svg[^>]*\swidth="[\d.]+(in|mm)"/);
  return svg ? svg[1] : "mm";
}

/** DXF (POLYLINE + VERTEX, LWPOLYLINE, LINE) : Y est déjà vers le haut. */
export function readDXF(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i], lines[i + 1]]);
  const layers = {};
  const add = (layer, path) => (layers[layer] = layers[layer] || []).push(path);
  let cur = null; // POLYLINE en cours
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] !== "0") continue;
    const type = pairs[i][1];
    const fields = [];
    for (let j = i + 1; j < pairs.length && pairs[j][0] !== "0"; j++) fields.push(pairs[j]);
    const get = (code) => fields.filter((f) => f[0] === code).map((f) => f[1]);
    const layer = get("8")[0] || "0";
    if (type === "POLYLINE") {
      cur = { layer, path: { pts: [], closed: (+get("70")[0] & 1) === 1 } };
    } else if (type === "VERTEX" && cur) {
      cur.path.pts.push([+get("10")[0], +get("20")[0]]);
    } else if (type === "SEQEND" && cur) {
      add(cur.layer, cur.path);
      cur = null;
    } else if (type === "LWPOLYLINE") {
      const xs = get("10"),
        ys = get("20");
      add(layer, { pts: xs.map((x, k) => [+x, +ys[k]]), closed: (+get("70")[0] & 1) === 1 });
    } else if (type === "LINE") {
      add(layer, {
        pts: [
          [+get("10")[0], +get("20")[0]],
          [+get("11")[0], +get("21")[0]]
        ],
        closed: false
      });
    }
  }
  return toMm(layers, fileUnit(text) === "in" ? 25.4 : 1);
}

/** SVG : calques = groupes inkscape:label ; Y du SVG vers le bas, donc retourné. */
export function readSVG(text) {
  const layers = {};
  const stack = [];
  const tag = /<(\/?)(g|path)\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = tag.exec(text))) {
    const [, close, name, attrs, selfClose] = m;
    if (name === "g") {
      if (close) stack.pop();
      else stack.push((attrs.match(/inkscape:label="([^"]*)"/) || [])[1] ?? null);
      continue;
    }
    if (close) continue;
    const d = (attrs.match(/\sd="([^"]*)"/) || [])[1];
    if (!d) continue;
    const layer = [...stack].reverse().find((l) => l != null) ?? "0";
    const nums = d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi).map(Number);
    const pts = [];
    for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], -nums[k + 1]]);
    (layers[layer] = layers[layer] || []).push({ pts, closed: /z\s*$/i.test(d) });
    if (selfClose) continue;
  }
  return toMm(layers, fileUnit(text) === "in" ? 25.4 : 1);
}

export const READERS = { dxf: readDXF, svg: readSVG };

/** Encombrement de tracés : [xmin, ymin, xmax, ymax]. */
export function bounds(paths) {
  const all = paths.flatMap((p) => p.pts);
  const xs = all.map((v) => v[0]),
    ys = all.map((v) => v[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
