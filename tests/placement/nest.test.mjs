// Imbrication selon la forme : quantités, rotations, origines, compacité, rapidité. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fixture, rect, disc, type, checkSheet } from "../helpers.mjs";
import { nest } from "../../src/placement/nest.js";
import { placedPartPaths } from "../../src/geometry/placed-parts.js";

// copie simple d'un résultat, pour comparer son contenu
const plain = (x) => JSON.parse(JSON.stringify(x));
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
    for (const s of res.sheets) assert.deepEqual(checkSheet(s, types, { margin: 5, gap: 2, tol: res.res + 0.05 }), []);
  });

  test("panneau déjà garni (cadenas) : les nouvelles pièces vont dans les trous, sans toucher les pièces fixes", () => {
    // pièces fixes : un grand rectangle et un disque, posés à des positions hors grille
    const big = type(rect(300, 200), 1),
      round = type(disc(60), 1),
      small = type(rect(60, 40), 40);
    const fixedParts = [
      { i: 0, x: 5.3, y: 5.7, w: 300, h: 200, k: 0 },
      { i: 1, x: 420.4, y: 230.9, w: 120, h: 120, k: 0 }
    ];
    const toFixed = (p, t) => ({
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      polys: placedPartPaths(t, { ...p, x: 0, y: 0 })
        .filter((q) => q.closed)
        .map((q) => q.pts),
      lines: []
    });
    const res = nest({
      panels: [{ L: 600, W: 400, qty: 0 }],
      gap: 4,
      margin: 5,
      types: [type(rect(300, 200), 0), type(disc(60), 0), small],
      fixed: [{ pi: 0, parts: [toFixed(fixedParts[0], big), toFixed(fixedParts[1], round)] }]
    });
    // un seul panneau (stock 0 : aucun nouveau), qui garde les trous remplis
    assert.equal(res.sheets.length, 1);
    const placed = res.sheets[0].parts;
    assert.ok(placed.length >= 15, `${placed.length} pièces dans les trous`);
    assert.ok(res.unplaced.every((u) => u.why === "stock"));
    // vérification avec les pièces fixes remises sur le panneau
    const all = { ...res.sheets[0], parts: fixedParts.concat(placed) };
    assert.deepEqual(checkSheet(all, [big, round, small], { margin: 5, gap: 4, tol: res.res + 0.05 }), []);
  });

  test("panneau garni vide (remplissage d'un nouveau panneau) et rectangles pleins comme obstacles", () => {
    const res = nest({
      panels: [{ L: 300, W: 200, qty: 0 }],
      gap: 2,
      margin: 5,
      types: [type(rect(50, 50), 100)],
      fixed: [{ pi: 0, parts: [{ x: 5, y: 5, w: 100, h: 190, polys: [], lines: [] }] }]
    });
    assert.equal(res.sheets.length, 1);
    // à droite du rectangle plein : 190 - 2 = 188 de large → 3 colonnes de 50 sur 3 rangées
    assert.equal(res.sheets[0].parts.length, 9);
    for (const p of res.sheets[0].parts) assert.ok(p.x >= 105 + 2 - res.res - 0.05, `x ${p.x}`);
    const empty = nest({
      panels: [{ L: 300, W: 200, qty: 0 }],
      gap: 2,
      margin: 5,
      types: [type(rect(50, 50), 100)],
      fixed: [{ pi: 0, parts: [] }]
    });
    assert.equal(empty.sheets[0].parts.length, 15);
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
      assert.deepEqual(checkSheet(s, [type(para, 6, { rot: 2 })], { margin: 5, gap: 2, tol: libre.res + 0.05 }), []);
  });

  test("rotation libre par 1° : la barre en biais passe là où le pas de 5° échoue", () => {
    // 628 × 6 dans 590 × 270 utiles : ne tient qu'entre 21° et 24° environ
    const bar = (rot) => input([type(rect(628, 6), 1, { rot })], [{ L: 600, W: 280, qty: -1 }]);
    assert.equal(nest(bar(2)).count, 0, "aucun multiple de 5° ne convient");
    const res = nest(bar(3));
    assert.equal(res.count, 1);
    const a = res.sheets[0].parts[0].a;
    assert.ok(Number.isInteger(a) && a % 5 !== 0, `angle ${a}`);
    assert.deepEqual(
      checkSheet(res.sheets[0], [type(rect(628, 6), 1, { rot: 3 })], { margin: 5, gap: 2, tol: res.res + 0.05 }),
      []
    );
  });

  test("rotation libre par 1° : jamais pire que le quart de tour ni que le pas de 5°", () => {
    const para = [
      [0, 0],
      [120, 0],
      [300, 180],
      [180, 180]
    ];
    const run = (rot) => nest(input([type(para, 6, { rot })], [{ L: 600, W: 400, qty: -1 }]));
    const quart = run(1),
      cinq = run(2),
      un = run(3);
    assert.ok(un.sheets.length <= quart.sheets.length, `${un.sheets.length} > ${quart.sheets.length}`);
    assert.ok(un.count >= cinq.count);
    for (const s of un.sheets)
      assert.deepEqual(checkSheet(s, [type(para, 6, { rot: 3 })], { margin: 5, gap: 2, tol: un.res + 0.05 }), []);
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
      assert.deepEqual(checkSheet(s, types, { margin: inp.margin, gap: inp.gap, tol: res.res + 0.05 }), []);
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
            checkSheet(s, types, { margin: 6, gap: 4, tol: res.res + 0.05 }),
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
  test("pièces à créneaux : elles restent contre le bord au lieu de glisser pour emboîter leurs créneaux (bug 1.5.0)", () => {
    // contour avec créneaux de 70 × 12 mm en haut et en bas, comme les pièces d'un caisson
    const tabbed = (w, h, topRight = w) => {
      const t = 12,
        tw = 70,
        pts = [[0, 0]];
      for (const f of [0.2, 0.75]) pts.push([f * w, 0], [f * w, -t], [f * w + tw, -t], [f * w + tw, 0]);
      pts.push([w, 0], [topRight, h]);
      for (const f of [0.75, 0.2])
        pts.push([f * topRight + tw, h], [f * topRight + tw, h + t], [f * topRight, h + t], [f * topRight, h]);
      pts.push([0, h]);
      return pts;
    };
    for (const rot of [1, 2]) {
      const types = [
        type(tabbed(898, 698), 1, { rot }),
        type(tabbed(698, 829, 670), 1, { rot }),
        type(tabbed(898, 800), 1, { rot })
      ];
      const res = nest(input(types, [{ L: 1250, W: 2500, qty: -1 }], 2, 5));
      assert.equal(res.sheets.length, 1);
      // panneau de 1250 : les pièces s'empilent le long du grand côté, toutes collées au bord de la marge
      for (const p of res.sheets[0].parts)
        assert.ok(Math.min(p.x, p.y) <= 5 + res.res, `pièce ${p.i} à ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`);
      assert.deepEqual(checkSheet(res.sheets[0], types, { margin: 5, gap: 2, tol: res.res + 0.05 }), []);
    }
  });

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
      // le groupement depuis un coin est plus compact depuis la 1.5.1 (le petit côté compte aussi) : le centre
      // reste à moins de 12 % de lui (et pas plus étalé qu'avant : voir le test suivant)
      assert.ok(
        side(centre) <= side(coin) * 1.12,
        `${name} : ${side(centre).toFixed(0)} contre ${side(coin).toFixed(0)} depuis le coin`
      );
    }
  });

  test("pièce exactement à la taille utile du panneau : placée", () => {
    const res = nest(input([type(rect(390, 590), 1)], [{ L: 400, W: 600, qty: -1 }], 2, 5));
    assert.equal(res.count, 1, "390 × 590 doit tenir dans 400 × 600 avec 5 mm de marge");
  });
});
