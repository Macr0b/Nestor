// Valeurs laser de départ par machine (livrets Trotec 60, 80, 120 W). Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { laserSettings, publishedThicknesses, speedForMachine } from "../../src/laser/laser-settings.js";
import { TROTEC_BOOKS, TROTEC_MATERIALS as LASER_MATERIALS } from "../../src/laser/trotec-books.js";

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
  test("chaque valeur des livrets ressort exactement, sans arrondi", () => {
    for (const book of TROTEC_BOOKS)
      for (const r of book.rows) {
        const s = laserSettings({ kind: "co2", watts: book.watts, trotec: true }, r.material, r.op, r.thickness);
        if (r.op === "cut" && s.thicknessFrom) continue;
        assert.deepEqual(
          [s.power, s.speed],
          [r.power, r.speed],
          `${book.watts} W ${r.material} ${r.op} ${r.thickness}`
        );
      }
  });

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

describe("contreplaqué bouleau, carton, cuir… (Thunder Laser, mm/s)", () => {
  const co2 = (watts) => ({ kind: "co2", watts, trotec: false });
  test("valeur publiée telle quelle : contreplaqué bouleau 3,2 mm en 80 W = 60 mm/s", () => {
    const s = laserSettings(co2(80), "birchPly", "cut", 3.2);
    assert.equal(s.speedMm, 60);
    assert.equal(s.power, 100);
    assert.equal(s.published, true);
    assert.equal(s.maxLineSpeed, true);
    assert.equal(s.source, "thunder");
  });

  test("puissance entre deux colonnes : vitesse entre les deux", () => {
    const s = laserSettings(co2(90), "birchPly", "cut", 6.4);
    assert.ok(s.speedMm > 30 && s.speedMm < 32, JSON.stringify(s));
  });

  test("trop faible pour l'épaisseur : 9,5 mm demande au moins 80 W", () => {
    assert.deepEqual(laserSettings(co2(60), "birchPly", "cut", 9.5), { tooWeak: 80 });
    assert.ok(laserSettings(co2(100), "birchPly", "cut", 9.5).speedMm === 7);
  });

  test("au-delà de 10 mm : pas de découpe", () => {
    assert.equal(laserSettings(co2(130), "birchPly", "cut", 12), null);
  });

  test("épaisseurs publiées en mm", () => {
    assert.deepEqual(publishedThicknesses("birchPly"), [3.2, 6.4, 9.5]);
    assert.deepEqual(publishedThicknesses("leather"), [1.6]);
  });

  test("chaque matière Thunder a au moins une valeur, toutes sous 10 mm", async () => {
    const { THUNDER_BOOKS, THUNDER_MATERIALS } = await import("../../src/laser/thunder-chart.js");
    for (const m of THUNDER_MATERIALS)
      assert.ok(
        THUNDER_BOOKS.some((b) => b.rows.some((r) => r.material === m.id)),
        m.id
      );
    for (const b of THUNDER_BOOKS) for (const r of b.rows) assert.ok(r.thickness <= 10 && r.speed > 0);
  });
});

describe("bois tendre, MDF, acrylique (GWK Laser, mm/s à 90 %)", () => {
  const co2 = (watts) => ({ kind: "co2", watts, trotec: false });
  test("chaque valeur du tableau ressort telle quelle, à 90 %", async () => {
    const { GWEIKE_BOOKS } = await import("../../src/laser/gweike-chart.js");
    let n = 0;
    for (const book of GWEIKE_BOOKS)
      for (const row of book.rows) {
        const s = laserSettings(co2(book.watts), row.material, "cut", row.thickness);
        assert.equal(s.speedMm, row.speed, `${row.material} ${row.thickness} mm ${book.watts} W`);
        assert.equal(s.power, 90);
        assert.equal(s.published, true);
        assert.equal(s.source, "gweike");
        assert.equal(s.maxLineSpeed, false);
        n++;
      }
    assert.equal(n, 52); // 60 cases moins les 8 puissances qui ne coupent pas
  });

  test("MDF 5 mm en 60 W = 8 mm/s ; acrylique 10 mm demande 80 W ; bois 10 mm en 150 W = 14", () => {
    assert.equal(laserSettings(co2(60), "gwkMdf", "cut", 5).speedMm, 8);
    assert.deepEqual(laserSettings(co2(60), "gwkAcrylic", "cut", 10), { tooWeak: 80 });
    assert.equal(laserSettings(co2(150), "gwkSoftwood", "cut", 10).speedMm, 14);
    assert.deepEqual(publishedThicknesses("gwkAcrylic"), [3, 5, 8, 10]);
  });

  test("autre puissance : entre les deux colonnes ; autre épaisseur : depuis la plus proche", () => {
    const s = laserSettings(co2(120), "gwkMdf", "cut", 3);
    assert.ok(s.speedMm > 18 && s.speedMm < 20 && s.published === false, JSON.stringify(s));
    const t = laserSettings(co2(80), "gwkMdf", "cut", 6);
    assert.equal(t.thicknessFrom, 5);
    assert.equal(t.speedMm, Math.round(((10 * 5) / 6) * 10) / 10);
  });

  test("machine Trotec : vitesse convertie en % (100 % = 3 550 mm/s)", () => {
    const s = laserSettings({ kind: "co2", watts: 60, trotec: true }, "gwkAcrylic", "cut", 3);
    assert.equal(s.speed, 0.42);
  });
});
