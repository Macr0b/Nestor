// Valeurs laser de départ par machine (livrets Trotec 60, 80, 120 W). Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { laserSettings, publishedThicknesses, speedForMachine } from "../../src/laser/laser-settings.js";
import { TROTEC_BOOKS, LASER_MATERIALS } from "../../src/laser/trotec-books.js";

const trotec = (watts) => ({ kind: "co2", watts, trotec: true });

describe("livrets Trotec", () => {
  test("chaque livret couvre chaque matière, en gravure et en découpe", () => {
    for (const book of TROTEC_BOOKS)
      for (const m of LASER_MATERIALS) {
        assert.ok(
          book.rows.some((r) => r.material === m.id && r.op === "engrave"),
          book.watts + " " + m.id
        );
        assert.ok(
          book.rows.some((r) => r.material === m.id && r.op === "cut"),
          book.watts + " " + m.id
        );
      }
  });

  test("valeurs plausibles : puissance 1–100 %, vitesse > 0", () => {
    for (const book of TROTEC_BOOKS)
      for (const r of book.rows) {
        assert.ok(r.power > 0 && r.power <= 100, JSON.stringify(r));
        assert.ok(r.speed > 0 && r.speed <= 100, JSON.stringify(r));
      }
  });
});

describe("même puissance qu'un livret : valeurs publiées", () => {
  test("acrylique 3 mm sur 60, 80, 120 W", () => {
    const s60 = laserSettings(trotec(60), "castAcrylic", "cut", 3),
      s80 = laserSettings(trotec(80), "castAcrylic", "cut", 3),
      s120 = laserSettings(trotec(120), "castAcrylic", "cut", 3);
    assert.deepEqual([s60.power, s60.speed, s60.frequency, s60.published], [60, 0.2, 5000, true]);
    assert.deepEqual([s80.power, s80.speed], [50, 0.2]);
    assert.deepEqual([s120.power, s120.speed], [30, 0.2]);
  });

  test("chêne 3 mm : la 120 W coupe plus vite que la 60 W", () => {
    assert.equal(laserSettings(trotec(60), "oak", "cut", 3).speed, 0.2);
    assert.equal(laserSettings(trotec(120), "oak", "cut", 3).speed, 0.6);
  });
});

describe("autre puissance : estimation", () => {
  test("100 W entre 80 et 120 W, marquée non publiée", () => {
    const s = laserSettings(trotec(100), "oak", "cut", 3);
    assert.equal(s.published, false);
    // énergie interpolée : vitesse entre celle de 80 W (0,4) et de 120 W (0,6)
    assert.ok(s.speed >= 0.4 && s.speed <= 0.6, JSON.stringify(s));
  });

  test("40 W sous la plage : plus lent que la 60 W", () => {
    const s = laserSettings(trotec(40), "oak", "cut", 3);
    assert.ok(s.speed < 0.2, JSON.stringify(s));
    assert.equal(s.bookWatts, 60);
  });

  test("gravure : même vitesse, plus de puissance sur une machine plus faible", () => {
    const g40 = laserSettings(trotec(40), "walnut", "engrave", 0),
      g60 = laserSettings(trotec(60), "walnut", "engrave", 0);
    assert.ok(g40.power >= g60.power, JSON.stringify([g40, g60]));
    assert.ok(g40.power <= 100);
  });

  test("gravure bornée à 100 % : la vitesse baisse", () => {
    const g = laserSettings(trotec(20), "alder", "engraveDark", 0);
    assert.equal(g.power, 100);
    assert.ok(g.speed < 50, JSON.stringify(g));
  });
});

describe("autre épaisseur", () => {
  test("acrylique 6 mm : moitié de la vitesse publiée pour 3 mm, et signalé", () => {
    const s = laserSettings(trotec(60), "castAcrylic", "cut", 6);
    assert.equal(s.thicknessFrom, 3);
    assert.equal(s.published, false);
    assert.equal(s.speed, 0.1);
  });

  test("épaisseurs publiées par matière", () => {
    assert.deepEqual(publishedThicknesses("alder"), [3, 5]);
    assert.deepEqual(publishedThicknesses("laminate"), [0.8, 1.6, 3.2]);
  });
});

describe("machines sans valeurs", () => {
  test("diode, fibre, puissance absente, matière inconnue", () => {
    assert.equal(laserSettings({ kind: "diode", watts: 20 }, "oak", "cut", 3), null);
    assert.equal(laserSettings({ kind: "fiber", watts: 30 }, "oak", "cut", 3), null);
    assert.equal(laserSettings({ kind: "co2", watts: 0 }, "oak", "cut", 3), null);
    assert.equal(laserSettings(trotec(80), "inconnue", "cut", 3), null);
  });
});

describe("vitesse selon la machine", () => {
  test("Trotec en %, autre machine en mm/s", () => {
    const s = laserSettings(trotec(80), "oak", "cut", 3);
    assert.deepEqual(speedForMachine({ trotec: true }, s), { value: 0.4, unit: "percent" });
    assert.deepEqual(speedForMachine({ trotec: false }, s), { value: 14.2, unit: "mmps" });
  });
});
