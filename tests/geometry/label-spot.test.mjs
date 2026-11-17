// Numéros des pièces : police au trait et emplacement dans la matière. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { labelSpot, labelHeight } from "../../src/geometry/label-spot.js";
import { strokeText, strokeTextWidth, canWrite } from "../../src/text/stroke-font.js";
import { rect, disc } from "../helpers.mjs";

const closed = (pts) => ({ pts, closed: true });

// point dans un polygone (règle pair-impair), pour vérifier les résultats
function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

describe("police au trait", () => {
  test("chaque chiffre donne des traits, centrés sur le point demandé", () => {
    for (const d of "0123456789") {
      const lines = strokeText(d, 50, 20, 6);
      assert.ok(lines.length >= 1, d);
      const xs = lines.flat().map((v) => v[0]),
        ys = lines.flat().map((v) => v[1]);
      // hauteur des chiffres = 6, entre 17 et 23 (Y vers le bas)
      assert.ok(Math.min(...ys) >= 17 - 1e-9 && Math.max(...ys) <= 23 + 1e-9, d);
      assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 50) < 2.1, d);
    }
  });

  test("le 7 a son trait du haut en haut (repère Y vers le bas)", () => {
    const [stroke] = strokeText("7", 0, 0, 6);
    // premier point : coin haut gauche, donc y = -3
    assert.deepEqual(stroke[0], [-2, -3]);
  });

  test("largeur proportionnelle à la hauteur et au nombre de signes", () => {
    assert.equal(strokeTextWidth("", 6), 0);
    assert.equal(strokeTextWidth("1", 6), 4);
    assert.equal(strokeTextWidth("12", 6), 9.5);
    assert.equal(strokeTextWidth("12", 12), 19);
  });

  test("signes connus et inconnus", () => {
    assert.ok(canWrite("P 50% V 1,2 mm/s"));
    assert.ok(!canWrite("é"));
    // un signe inconnu est ignoré sans casser le reste
    assert.equal(strokeText("1é", 0, 0, 6).length, 2);
  });
});

describe("emplacement du numéro", () => {
  test("rectangle : au centre, rayon = demi petit côté", () => {
    const s = labelSpot([closed(rect(100, 40))]);
    assert.ok(Math.abs(s.x - 50) < 2 && Math.abs(s.y - 20) < 0.5, JSON.stringify(s));
    assert.ok(s.radius > 19.5 && s.radius <= 20);
  });

  test("pièce en L : dans la matière, jamais dans le creux", () => {
    const ell = [
      [0, 0],
      [150, 0],
      [150, 40],
      [40, 40],
      [40, 100],
      [0, 100]
    ];
    const s = labelSpot([closed(ell)]);
    assert.ok(inside(ell, s.x, s.y), JSON.stringify(s));
    assert.ok(s.radius >= 19, JSON.stringify(s));
  });

  test("disque percé : dans l'anneau, pas dans le trou", () => {
    const outer = disc(30, 64, 30, 30),
      hole = disc(6, 32, 30, 30);
    const s = labelSpot([closed(outer), closed(hole)]);
    const d = Math.hypot(s.x - 30, s.y - 30);
    assert.ok(d > 6 && d < 30, JSON.stringify(s));
    assert.ok(s.radius > 10, JSON.stringify(s));
  });

  test("le trait gravé intérieur (ouvert) est évité aussi", () => {
    const s = labelSpot([
      closed(rect(100, 40)),
      {
        pts: [
          [50, 0],
          [50, 40]
        ],
        closed: false
      }
    ]);
    assert.ok(Math.abs(s.x - 50) > 15, JSON.stringify(s));
  });

  test("sans contour fermé : pas d'emplacement", () => {
    assert.equal(
      labelSpot([
        {
          pts: [
            [0, 0],
            [10, 0]
          ],
          closed: false
        }
      ]),
      null
    );
  });

  test("taille du texte : tient dans le cercle libre, bornée, nulle si trop petite", () => {
    const h = labelHeight("12", 20, 2, 100);
    const w = strokeTextWidth("12", h);
    assert.ok(Math.hypot(w / 2, h / 2) <= 0.8 * 20 + 1e-9);
    assert.equal(labelHeight("12", 200, 2, 10), 10);
    assert.equal(labelHeight("123", 1, 2, 10), 0);
  });
});
