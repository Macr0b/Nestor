// Unités d'affichage des longueurs : conversions dans les deux sens. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatLength,
  formatFeed,
  inchFraction,
  lengthFieldValue,
  parseLength,
  parseFeed,
  feedFieldValue,
  MM_PER_INCH
} from "../../src/util/units.js";

const MM = { system: "mm", step: 16 };
const INCH = { system: "inch", step: 16 };
const FRAC = { system: "fraction", step: 16 };
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

describe("Unités des longueurs", () => {
  test("pouce = 25,4 mm exactement", () => {
    assert.equal(MM_PER_INCH, 25.4);
    near(parseLength("1", INCH), 25.4);
  });

  test("fractions de pouce : arrondi au pas, fraction réduite", () => {
    assert.equal(inchFraction(48.8125, 16), "48 13/16");
    assert.equal(inchFraction(0.75, 16), "3/4");
    assert.equal(inchFraction(2, 16), "2");
    assert.equal(inchFraction(0.5, 8), "1/2");
    assert.equal(inchFraction(1.03, 16), "1");
    assert.equal(inchFraction(1 + 1 / 64, 64), "1 1/64");
  });

  test("lecture des saisies en pouces : décimal, fraction, mixte, virgule", () => {
    near(parseLength("48 13/16", FRAC), 48.8125 * 25.4);
    near(parseLength("13/16", FRAC), (13 / 16) * 25.4);
    near(parseLength("1-1/2", FRAC), 1.5 * 25.4);
    near(parseLength("2,5", INCH), 2.5 * 25.4);
    near(parseLength(".5", INCH), 0.5 * 25.4);
    near(parseLength("-1/2", FRAC), -0.5 * 25.4);
  });

  test("une unité écrite l'emporte : « 12 mm » en impérial, « 2 in » ou 2\" en métrique", () => {
    near(parseLength("12 mm", INCH), 12);
    near(parseLength("2 in", MM), 50.8);
    near(parseLength('2"', MM), 50.8);
    near(parseLength("600", MM), 600);
  });

  test("saisies illisibles : NaN, jamais un nombre inventé", () => {
    for (const bad of ["", "abc", "1/0", "1.5 3/4", "3/", "/4", "1 2 3/4", "12 cm"])
      assert.ok(Number.isNaN(parseLength(bad, FRAC)), JSON.stringify(bad));
  });

  test("aller-retour champ → mm : la taille ne change pas (à l'arrondi d'affichage près)", () => {
    for (const mm of [600, 400, 2, 5, 1239.8375, 3.175, 0.5]) {
      near(parseLength(lengthFieldValue(mm, MM), MM), mm, 0.001);
      near(parseLength(lengthFieldValue(mm, INCH), INCH), mm, 0.0026);
      near(parseLength(lengthFieldValue(mm, FRAC), FRAC), mm, 25.4 / 32 + 1e-9);
    }
    // une valeur juste en pouces fractionnés reste exacte
    near(parseLength(lengthFieldValue(48.8125 * 25.4, FRAC), FRAC), 48.8125 * 25.4);
  });

  test("affichage selon la langue et les unités", () => {
    assert.equal(formatLength(600, { units: MM, locale: "fr-FR" }), "600");
    assert.equal(formatLength(1240, { units: INCH, locale: "en-US" }), "48.819");
    assert.equal(formatLength(1240, { units: FRAC, locale: "en-US" }), "48 13/16");
    assert.equal(formatLength(0.06, { units: FRAC, locale: "en-US", decimal: true, digits: 4 }), "0.0024");
    assert.equal(formatLength(NaN, { units: MM }), "");
  });

  test("vitesses d'avance : mm/min ou pouces/min", () => {
    assert.equal(formatFeed(1910, { units: MM, locale: "fr-FR" }), "1 910");
    assert.equal(formatFeed(1905, { units: INCH, locale: "en-US" }), "75");
    near(parseFeed("75", INCH), 1905);
    near(parseFeed("1910", MM), 1910);
    near(parseFeed(feedFieldValue(6000, INCH), INCH), 6000, 1.3);
  });
});
