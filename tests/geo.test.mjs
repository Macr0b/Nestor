// Tests du cœur de calcul (geo.js) : lecture des formats, regroupement des pièces,
// placement en rectangles et en imbrication, exports. Lancement : node --test tests/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadGeo, fixture, rect, disc, type, checkSheet, area } from "./helpers.mjs";

const { Geo, nest } = loadGeo();
// les objets créés dans le contexte de geo.js viennent d'un autre « royaume » JavaScript : on les recopie avant de comparer
const plain = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);

describe("Lecture DXF", () => {
  test("plaque avec trou + disque : 2 pièces, le trou reste dans la plaque", () => {
    const r = Geo.parseDXF(fixture("plaque-trou.dxf"), "auto");
    const g = Geo.groupPieces(r.paths);
    assert.equal(g.pieces.length, 2);
    const plaque = g.pieces.find((p) => Math.round(p.w) === 200);
    assert.ok(plaque, "plaque 200 mm trouvée");
    near(plaque.h, 100);
    assert.equal(plaque.paths.length, 2, "contour + trou");
    assert.equal(plaque.layer, "DECOUPE");
  });

  test("4 segments LINE séparés sont chaînés en un contour fermé", () => {
    const g = Geo.groupPieces(Geo.parseDXF(fixture("lignes.dxf"), "auto").paths);
    assert.equal(g.pieces.length, 1);
    near(g.pieces[0].w, 80);
    near(g.pieces[0].h, 40);
    assert.ok(g.pieces[0].paths[0].closed, "contour fermé");
  });

  test("unités du fichier ($INSUNITS = pouces) converties en mm", () => {
    const g = Geo.groupPieces(Geo.parseDXF(fixture("pouces.dxf"), "auto").paths);
    near(g.pieces[0].w, 50.8);
    near(g.pieces[0].h, 25.4);
  });

  test("réglage manuel des unités prioritaire", () => {
    const g = Geo.groupPieces(Geo.parseDXF(fixture("pouces.dxf"), "10").paths);
    near(g.pieces[0].w, 20);
  });

  test("les textes sont renvoyés avec leur position (servent à nommer les pièces)", () => {
    const r = Geo.parseDXF(fixture("noms.dxf"), "auto");
    assert.deepEqual(plain(r.texts.map((t) => t.s).sort()), ["Etagere", "Hors piece", "Montant"]);
  });

  test("un cadre qui contient toutes les pièces est ignoré", () => {
    const g = Geo.groupPieces(Geo.parseDXF(fixture("cadre.dxf"), "auto").paths);
    assert.ok(g.frame, "cadre détecté");
    assert.equal(g.pieces.length, 2);
  });
});

describe("Lecture HPGL et VectorCraft", () => {
  test("HPGL : 40 unités = 1 mm, un calque par stylo, cercle CI", () => {
    const r = Geo.parseHPGL(fixture("test.plt"), "auto");
    const types = Geo.toTypes(Geo.groupPieces(r.paths).pieces);
    assert.equal(types.length, 2);
    const big = types.find((t) => Math.round(t.w) === 100);
    near(big.h, 50);
    assert.equal(big.layer, "SP1");
    assert.equal(big.paths.length, 2, "rectangle + cercle intérieur");
    assert.ok(types.some((t) => t.layer === "SP2" && Math.round(t.w) === 25));
  });

  test("VectorCraft : points → mm, nom et calque gardés, objets cachés et textes ignorés", () => {
    const r = Geo.parseVectorCraft(fixture("mini.vectorcraft"), "auto");
    const types = Geo.toTypes(Geo.groupPieces(r.paths).pieces);
    assert.equal(types.length, 1);
    near(types[0].w, 100, 0.05);
    near(types[0].h, 50, 0.05);
    assert.equal(types[0].name, "Façade");
    assert.equal(types[0].layer, "Découpe");
    assert.equal(r.warn.texts, 1);
  });
});

describe("Regroupement en types de pièces", () => {
  test("pièces identiques fusionnées, noms différents gardés à part", () => {
    const p = (x, name) => ({ pts: rect(50, 30, x, 0), closed: true, layer: "", color: "", name });
    const types = Geo.toTypes(Geo.groupPieces([p(0, "A"), p(100, "A"), p(200, "B")]).pieces);
    assert.equal(types.length, 2);
    assert.equal(types.find((t) => t.name === "A").qty, 2);
    assert.equal(types.find((t) => t.name === "B").qty, 1);
  });

  test("un trou nommé ne renomme pas la pièce", () => {
    const outer = { pts: rect(100, 100), closed: true, layer: "", color: "", name: "" };
    const hole = { pts: rect(20, 20, 40, 40), closed: true, layer: "", color: "", name: "Trou" };
    const t = Geo.toTypes(Geo.groupPieces([outer, hole]).pieces);
    assert.equal(t.length, 1);
    assert.equal(t[0].name, "");
  });
});

describe("Placement en rectangles (Geo.pack)", () => {
  test("toutes les pièces placées, dans la zone utile, sans chevauchement", () => {
    const types = [type(rect(200, 120), 2), type(rect(80, 30), 10)];
    const res = Geo.pack({ gap: 3, margin: 10, panels: [{ L: 600, W: 400, qty: "" }] }, types);
    assert.equal(res.unplaced.length, 0);
    for (const s of res.sheets) assert.deepEqual(checkSheet(Geo, s, types, { margin: 10, gap: 3 }), []);
  });

  test("pas de plafond caché sur les quantités (800 pièces)", () => {
    const types = [type(rect(20, 10), 800)];
    const res = Geo.pack({ gap: 1, margin: 5, panels: [{ L: 1000, W: 1000, qty: "" }] }, types);
    const placed = res.sheets.reduce((n, s) => n + s.parts.length, 0);
    assert.equal(placed, 800);
  });

  test("stock limité : le surplus est signalé « stock »", () => {
    const types = [type(rect(300, 300), 3)];
    const res = Geo.pack({ gap: 0, margin: 0, panels: [{ L: 400, W: 400, qty: 1 }] }, types);
    assert.equal(res.sheets.length, 1);
    assert.equal(res.unplaced.length, 2);
    assert.ok(res.unplaced.every((u) => u.why === "stock"));
  });
});

describe("Imbrication (nest)", () => {
  const input = (types, panels, gap = 2, margin = 5) => ({ panels, gap, margin, types });

  test("formes variées : tout placé, marges et écarts respectés", () => {
    const L = [
      [0, 0],
      [150, 0],
      [150, 40],
      [40, 40],
      [40, 100],
      [0, 100]
    ];
    const types = [type(rect(200, 120), 2), type(L, 2), type(disc(30), 4), type(rect(80, 30), 6)];
    const res = nest(input(types, [{ L: 600, W: 400, qty: -1 }]));
    assert.equal(res.unplaced.length, 0);
    assert.equal(res.count, 14);
    // la précision du calcul est d'environ res mm : on tolère cet écart
    for (const s of res.sheets)
      assert.deepEqual(checkSheet(Geo, s, types, { margin: 5, gap: 2, tol: res.res + 0.05 }), []);
  });

  test("pas de plafond caché sur les quantités (800 pièces)", () => {
    const res = nest(input([type(rect(20, 10), 800)], [{ L: 1200, W: 1200, qty: -1 }], 1, 5));
    assert.equal(res.count, 800);
  });

  test("pièce géante : signalée « size » immédiatement, les autres placées", () => {
    const t0 = Date.now();
    const res = nest(input([type(disc(9000), 1), type(rect(50, 50), 3)], [{ L: 600, W: 400, qty: -1 }]));
    assert.ok(Date.now() - t0 < 2000, "réponse rapide");
    assert.equal(res.count, 3);
    assert.deepEqual(plain(res.unplaced.map((u) => u.why)), ["size"]);
  });

  test("« sens fixe » : jamais de quart de tour", () => {
    const t = type(rect(300, 50), 4, { rot: 0 });
    const res = nest(input([t], [{ L: 600, W: 400, qty: -1 }]));
    for (const s of res.sheets) for (const p of s.parts) assert.ok(p.k === 0 || p.k === 2, `orientation ${p.k}`);
  });

  test("rotation libre par 5° : jamais pire que le quart de tour", () => {
    const para = [
      [0, 0],
      [120, 0],
      [300, 180],
      [180, 180]
    ];
    const quart = nest(input([type(para, 6, { rot: 1 })], [{ L: 600, W: 400, qty: -1 }]));
    const libre = nest(input([type(para, 6, { rot: 2 })], [{ L: 600, W: 400, qty: -1 }]));
    assert.ok(libre.sheets.length <= quart.sheets.length, `${libre.sheets.length} > ${quart.sheets.length}`);
    for (const s of libre.sheets)
      assert.deepEqual(
        checkSheet(Geo, s, [type(para, 6, { rot: 2 })], { margin: 5, gap: 2, tol: libre.res + 0.05 }),
        []
      );
  });

  test("panneaux utilisés dans l'ordre, stock respecté", () => {
    const res = nest(
      input(
        [type(rect(250, 250), 3)],
        [
          { L: 300, W: 300, qty: 1 },
          { L: 600, W: 300, qty: -1 }
        ],
        0,
        0
      )
    );
    assert.equal(res.sheets[0].pi, 0);
    assert.equal(res.sheets.filter((s) => s.pi === 0).length, 1);
    assert.equal(res.count, 3);
  });

  // cas réel signalé : panneau 300 × 200, écart 20, origine au centre, rotation libre → pièces superposées (1.2.3)
  test("origine au centre, petit panneau, rotation libre : aucune pièce superposée", () => {
    const inp = JSON.parse(fixture("centre-petit-panneau.json"));
    // types repris tels quels (trous compris) ; paths sert à la vérification des écarts
    const types = inp.types.map((t) => ({
      ...t,
      paths: t.polys.map((pts) => ({ pts, closed: true })).concat(t.lines.map((pts) => ({ pts, closed: false })))
    }));
    const res = nest(inp);
    assert.equal(res.count, res.total);
    for (const s of res.sheets)
      assert.deepEqual(checkSheet(Geo, s, types, { margin: inp.margin, gap: inp.gap, tol: res.res + 0.05 }), []);
  });

  test("toutes les origines et rotations : marges et écarts respectés", () => {
    const L = [
      [0, 0],
      [150, 0],
      [150, 40],
      [40, 40],
      [40, 100],
      [0, 100]
    ];
    const anchors = [null, { ax: 0, ay: 0 }, { ax: 0, ay: 0.5 }, { ax: 0.5, ay: 0.5 }];
    for (const rot of [0, 1, 2])
      for (const anchor of anchors) {
        const types = [
          type(rect(200, 120), 2, { rot }),
          type(L, 3, { rot }),
          type(disc(60), 5, { rot }),
          type(rect(80, 30), 6, { rot })
        ];
        const res = nest({ panels: [{ L: 500, W: 350, qty: -1 }], gap: 4, margin: 6, types, anchor });
        assert.equal(res.count, res.total);
        for (const s of res.sheets)
          assert.deepEqual(
            checkSheet(Geo, s, types, { margin: 6, gap: 4, tol: res.res + 0.05 }),
            [],
            `rotation ${rot}, accroche ${JSON.stringify(anchor)}`
          );
      }
  });

  test("grouper autour de l'origine ne coûte jamais de panneau en plus", () => {
    const inp = JSON.parse(fixture("centre-petit-panneau.json"));
    const centre = nest(inp);
    const coin = nest({ ...inp, anchor: null });
    assert.ok(centre.sheets.length <= coin.sheets.length, `${centre.sheets.length} > ${coin.sheets.length}`);
  });

  test("rotation libre groupée autour du centre : calcul raisonnable (garde-fou contre un ralentissement)", () => {
    const L = [
      [0, 0],
      [300, 0],
      [300, 80],
      [80, 80],
      [80, 200],
      [0, 200]
    ];
    const para = [
      [0, 0],
      [120, 0],
      [300, 180],
      [180, 180]
    ];
    const t0 = Date.now();
    const res = nest({
      panels: [{ L: 2440, W: 1220, qty: -1 }],
      gap: 3,
      margin: 10,
      types: [type(L, 15, { rot: 2 }), type(para, 10, { rot: 2 })],
      anchor: { ax: 0.5, ay: 0.5 }
    });
    const dt = Date.now() - t0;
    assert.equal(res.count, 25);
    // environ 3 s sur une machine ordinaire ; avant l'optimisation 7,5 s
    assert.ok(dt < 6000, `${dt} ms`);
  });

  // cas signalé (1.2.5) : origine au centre, des pièces posées debout dépassaient en bas alors qu'elles tenaient à plat ;
  // le groupe était mesuré par sa distance au centre au lieu de son encombrement réel
  test("origine au centre : le groupe reste presque aussi compact que depuis un coin", () => {
    const L = [
      [0, 0],
      [300, 0],
      [300, 80],
      [80, 80],
      [80, 200],
      [0, 200]
    ];
    const para = [
      [0, 0],
      [120, 0],
      [300, 180],
      [180, 180]
    ];
    const sets = {
      "formes variées": [type(rect(200, 120), 2), type(L, 2), type(disc(90), 4), type(rect(150, 40), 6)],
      "beaucoup de pièces": [type(rect(400, 300), 4), type(L, 8), type(disc(120), 12), type(rect(150, 40), 30)],
      "rotation libre": [type(L, 15, { rot: 2 }), type(para, 10, { rot: 2 })]
    };
    const side = (res) => {
      const s = res.sheets[0];
      const x0 = Math.min(...s.parts.map((p) => p.x)),
        y0 = Math.min(...s.parts.map((p) => p.y));
      const x1 = Math.max(...s.parts.map((p) => p.x + p.w)),
        y1 = Math.max(...s.parts.map((p) => p.y + p.h));
      return Math.max(x1 - x0, y1 - y0);
    };
    for (const [name, types] of Object.entries(sets)) {
      const inp = { panels: [{ L: 2440, W: 1220, qty: -1 }], gap: 3, margin: 10, types };
      const coin = nest({ ...inp, anchor: { ax: 0, ay: 0 } }),
        centre = nest({ ...inp, anchor: { ax: 0.5, ay: 0.5 } });
      assert.equal(centre.sheets.length, 1, name);
      // avant la correction : jusqu'à 8,5 % plus grand ; maintenant moins de 5 %
      assert.ok(
        side(centre) <= side(coin) * 1.06,
        `${name} : ${side(centre).toFixed(0)} contre ${side(coin).toFixed(0)} depuis le coin`
      );
    }
  });

  test("pièce exactement à la taille utile du panneau : placée", () => {
    const res = nest(input([type(rect(390, 590), 1)], [{ L: 400, W: 600, qty: -1 }], 2, 5));
    assert.equal(res.count, 1, "390 × 590 doit tenir dans 400 × 600 avec 5 mm de marge");
  });
});

describe("Export DXF", () => {
  const polys = [{ pts: rect(100, 50, 10, 20), closed: true, layer: "Découpe", color: "" }];
  const coords = (dxf) => {
    const lines = dxf.split(/\r?\n/),
      xs = [],
      ys = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].trim() === "10") xs.push(+lines[i + 1]);
      if (lines[i].trim() === "20") ys.push(+lines[i + 1]);
    }
    return { xs, ys };
  };

  test("origine en bas à gauche : Y vers le haut, tout en positif", () => {
    const { xs, ys } = coords(Geo.exportDXF(polys, 0, 400));
    assert.ok(xs.every((x) => x >= 0) && ys.every((y) => y >= 0));
    near(Math.max(...ys), 380);
  });

  test("origine en haut à gauche : Y négatif vers le bas", () => {
    const { ys } = coords(Geo.exportDXF(polys, 0, 0));
    assert.ok(ys.every((y) => y <= 0));
    near(Math.min(...ys), -70);
  });

  test("nom de calque lisible par les vieux logiciels (sans accent ni espace)", () => {
    const d = Geo.exportDXF([{ ...polys[0], layer: "Découpe bois" }], 0, 0);
    assert.match(d, /\nDecoupe_bois\r?\n/);
  });

  test("calque au nom non latin : nom lisible au lieu de « ____ »", () => {
    const d = Geo.exportDXF([{ ...polys[0], layer: "板材" }], 0, 0);
    assert.match(d, /\nLAYER_\d+\r?\n/);
  });
});

describe("Coupes de chutes (offcuts)", () => {
  const box = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
  // distance d'un segment de coupe (horizontal ou vertical) à une boîte ; 0 s'il la traverse
  const segBoxDist = ([x1, y1, x2, y2], b) => {
    const sx0 = Math.min(x1, x2),
      sx1 = Math.max(x1, x2),
      sy0 = Math.min(y1, y2),
      sy1 = Math.max(y1, y2);
    const dx = Math.max(0, b.x0 - sx1, sx0 - b.x1),
      dy = Math.max(0, b.y0 - sy1, sy0 - b.y1);
    return Math.hypot(dx, dy);
  };
  const overlaps = (c, b) =>
    c.x < b.x1 - 1e-6 && c.x + c.w > b.x0 + 1e-6 && c.y < b.y1 - 1e-6 && c.y + c.h > b.y0 + 1e-6;
  // vérifications communes : aucune coupe ne passe à moins de gap d'une pièce, aucune chute ne contient de pièce
  const check = (r, boxes, gap) => {
    for (const c of r.cuts)
      for (const b of boxes) assert.ok(segBoxDist(c, b) >= gap - 1e-6, `coupe ${c} trop près de ${JSON.stringify(b)}`);
    for (const c of r.chutes)
      for (const b of boxes) assert.ok(!overlaps(c, b), `chute ${JSON.stringify(c)} sur une pièce`);
  };

  test("simple, groupe au centre d'un panneau en hauteur : deux traits horizontaux d'un bord à l'autre", () => {
    const boxes = [box(20, 150, 380, 450)];
    const r = Geo.offcuts(400, 600, boxes, 5, "simple");
    assert.deepEqual(plain(r.cuts), [
      [0, 145, 400, 145],
      [0, 455, 400, 455]
    ]);
    assert.deepEqual(plain(r.chutes.map((c) => [c.w, c.h])), [
      [400, 145],
      [400, 145]
    ]);
    check(r, boxes, 5);
  });

  test("simple : le sens des traits est celui qui libère le plus de matière", () => {
    const r = Geo.offcuts(1000, 400, [box(10, 10, 300, 390)], 5, "simple");
    assert.equal(r.cuts.length, 1);
    const [x1, y1, x2, y2] = r.cuts[0];
    assert.ok(x1 === x2 && y1 === 0 && y2 === 400, "trait vertical d'un bord à l'autre");
    near(x1, 305);
  });

  test("bande trop fine (moins de 30 mm) : pas de trait", () => {
    const r = Geo.offcuts(400, 600, [box(10, 10, 390, 580)], 3, "simple");
    assert.deepEqual(plain(r.cuts), []);
  });

  test("détaillé : en plus, des traits perpendiculaires dans la bande restante", () => {
    const boxes = [box(100, 150, 300, 450)];
    const simple = Geo.offcuts(400, 600, boxes, 5, "simple");
    const detail = Geo.offcuts(400, 600, boxes, 5, "detail");
    assert.equal(simple.cuts.length, 2);
    assert.equal(detail.cuts.length, 4);
    check(detail, boxes, 5);
  });

  test("détaillé : un groupe en escalier est contourné (trait qui sépare deux groupes de pièces)", () => {
    // un grand bloc en bas à gauche, un petit en haut à gauche : la zone en haut à droite doit être récupérée
    const boxes = [box(10, 10, 100, 300), box(10, 310, 390, 590)];
    const r = Geo.offcuts(400, 600, boxes, 5, "detail");
    check(r, boxes, 5);
    const big = r.chutes.find((c) => c.w >= 250 && c.h >= 250);
    assert.ok(big, `chute en haut à droite attendue : ${JSON.stringify(plain(r.chutes))}`);
  });

  test("aucune pièce ou mode inconnu : rien", () => {
    assert.deepEqual(plain(Geo.offcuts(400, 600, [], 5, "detail")), { cuts: [], chutes: [] });
    assert.deepEqual(plain(Geo.offcuts(400, 600, [box(0, 0, 10, 10)], 5, "")), { cuts: [], chutes: [] });
  });

  test("résultat réel d'imbrication : traits jamais à moins de l'espace entre pièces", () => {
    const L = [
      [0, 0],
      [150, 0],
      [150, 40],
      [40, 40],
      [40, 100],
      [0, 100]
    ];
    const types = [type(rect(200, 120), 2), type(L, 2), type(disc(60), 4), type(rect(80, 30), 6)];
    const res = nest({ panels: [{ L: 800, W: 600, qty: -1 }], gap: 4, margin: 6, types, anchor: { ax: 0.5, ay: 0.5 } });
    for (const s of res.sheets) {
      const boxes = s.parts.map((p) => {
        const pts = Geo.placedPaths(types[p.i], p).flatMap((q) => q.pts);
        const xs = pts.map((v) => v[0]),
          ys = pts.map((v) => v[1]);
        return box(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      });
      for (const mode of ["simple", "detail"]) {
        const r = Geo.offcuts(s.L, s.W, boxes, 4, mode);
        assert.ok(r.cuts.length > 0, `aucun trait en mode ${mode}`);
        check(r, boxes, 4);
      }
    }
  });
});

describe("Pièces placées (placedPaths)", () => {
  test("rotation libre : la pièce garde sa surface et son encombrement annoncé", () => {
    const t = type(
      [
        [0, 0],
        [100, 0],
        [100, 20],
        [0, 20]
      ],
      1,
      { rot: 2 }
    );
    const res = nest({ panels: [{ L: 60, W: 200, qty: -1 }], gap: 0, margin: 0, types: [t] });
    assert.equal(res.count, 1, "un 100 × 20 doit tenir debout ou en biais dans 60 × 200");
    const p = res.sheets[0].parts[0];
    const pts = Geo.placedPaths(t, p)[0].pts;
    near(area(pts), 2000, 1);
  });
});
