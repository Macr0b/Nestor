// Tests de l'interface dans un vrai navigateur (Chromium via Playwright).
// Ils sont sautés si Playwright n'est pas installé. Lancement : node --test tests/
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { ROOT } from "./helpers.mjs";

let chromium = null;
try {
  chromium = createRequire(import.meta.url)("playwright").chromium;
} catch {
  /* Playwright absent : tests sautés */
}
const skip = chromium ? false : "Playwright non installé";

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};
const FIX = (n) => join(ROOT, "tests", "fixtures", n);

let server, base, browser;

before(async () => {
  if (skip) return;
  // petit serveur de fichiers statiques sur le dossier de l'appli (le service worker exige http)
  server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

/** Ouvre l'appli dans une page neuve (réglages vierges) et attend la fin du premier calcul. */
async function open(opts = {}) {
  const ctx = await browser.newContext({
    locale: "fr-FR",
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
    ...opts
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(base);
  await idle(page);
  return page;
}
async function idle(page) {
  // le calcul démarre après un court délai de saisie : on lui laisse le temps de partir, puis on attend la fin
  await page.waitForTimeout(600);
  await page.waitForFunction(() => !document.querySelector("#result.busy"), null, { timeout: 60000 });
  await page.waitForTimeout(100);
}
const stats = (page) => page.$$eval(".stat .v", (v) => v.map((x) => x.innerText));
const names = (page) => page.$$eval(".trow .nm", (v) => v.map((i) => i.value || i.placeholder));
async function load(page, files, input = "#fileIn") {
  await page.setInputFiles(input, [].concat(files).map(FIX));
  await page.waitForFunction(
    () => document.querySelector(".fline") || /warn/.test(document.querySelector("#fileInfo").innerHTML),
    null,
    { timeout: 20000 }
  );
  await idle(page);
}

describe("Interface", { skip }, () => {
  test("démarrage : exemple calculé, version affichée, aucune erreur", async () => {
    const page = await open();
    const s = await stats(page);
    assert.equal(s[1], "14 / 14");
    assert.match(await page.textContent("#cartVer"), /^\d+\.\d+\.\d+$/);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("import SVG Inkscape : noms de pièces et calques lus", async () => {
    const page = await open();
    await load(page, "calques-inkscape.svg");
    const n = await names(page);
    for (const x of ["Fond", "Côté gauche", "Etiquette"]) assert.ok(n.includes(x), `pièce « ${x} » absente de ${n}`);
    const tags = await page.$$eval(".laytag", (v) => v.map((x) => x.innerText));
    assert.ok(tags.some((t) => t.includes("Gravure")));
    await page.context().close();
  });

  test("import SVGZ (SVG compressé)", async () => {
    const page = await open();
    await load(page, "calques-inkscape.svgz");
    assert.ok((await names(page)).includes("Fond"));
    await page.context().close();
  });

  test("import DXF : textes posés dans les pièces = noms, texte hors pièce signalé", async () => {
    const page = await open();
    await load(page, "noms.dxf");
    const n = await names(page);
    assert.ok(n.includes("Etagere") && n.includes("Montant"), String(n));
    assert.match(await page.textContent("#fileInfo"), /Textes non vectorisés ignorés : 1/);
    await page.context().close();
  });

  test("import LightBurn, HPGL et VectorCraft", async () => {
    const page = await open();
    await load(page, ["essai.lbrn2", "test.plt", "mini.vectorcraft"]);
    const info = await page.textContent("#fileInfo");
    for (const k of ["LightBurn", "HPGL", "VectorCraft"]) assert.match(info, new RegExp(k));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("import PDF et AI (compatible PDF) : rectangle 60 × 40 et disque Ø 50", async () => {
    const page = await open();
    await load(page, ["formes.pdf", "formes.ai"]);
    const info = await page.textContent("#fileInfo");
    assert.match(info, /PDF/);
    assert.match(info, /AI/);
    const dims = await page.$$eval(".trow [data-k=sw]", (v) => v.map((i) => Math.round(+i.value)));
    assert.ok(dims.includes(60) && dims.includes(50), `largeurs lues : ${dims}`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("plusieurs fichiers, « + Ajouter », retrait d'un fichier", async () => {
    const page = await open();
    await load(page, ["calques-inkscape.svg", "plaque-trou.dxf"]);
    assert.equal(await page.locator(".fline").count(), 2);
    const before = await page.locator(".trow").count();
    await load(page, "test.plt", "#fileAdd");
    assert.equal(await page.locator(".fline").count(), 3);
    assert.equal(await page.locator(".trow").count(), before + 2);
    await page.click("[data-rmfile]");
    await idle(page);
    assert.equal(await page.locator(".fline").count(), 2);
    await page.context().close();
  });

  test("échelle : 150 % et cote en mm restent liées", async () => {
    const page = await open();
    const row = '.trow[data-i="0"] ';
    await page.fill(row + "[data-k=sp]", "150");
    assert.equal(await page.inputValue(row + "[data-k=sw]"), "300");
    await page.fill(row + "[data-k=sw]", "100");
    assert.equal(await page.inputValue(row + "[data-k=sp]"), "50");
    await page.context().close();
  });

  test("dupliquer puis supprimer la copie", async () => {
    const page = await open();
    const n0 = await page.locator(".trow").count();
    await page.click('.trow[data-i="0"] [data-act=dup]');
    assert.equal(await page.locator(".trow").count(), n0 + 1);
    assert.match(await page.inputValue('.trow[data-i="1"] .nm'), /\(copie\)$/);
    await page.click('.trow[data-i="1"] [data-act=del]');
    assert.equal(await page.locator(".trow").count(), n0);
    await page.context().close();
  });

  test("panneau en portrait et origine en bas à droite (zéro du DXF)", async () => {
    const page = await open();
    const vb = await page.getAttribute(".sheet svg", "viewBox");
    const [, , w, h] = vb.split(" ").map(Number);
    assert.ok(h > w, `panneau en portrait attendu (viewBox ${vb})`);
    await page.click('.pnl[data-i="0"] [data-o=br]');
    await idle(page);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-dl=dxf][data-s="0"]')]);
    const txt = await readFile(await dl.path(), "utf8");
    const lines = txt.split(/\r?\n/),
      xs = [],
      ys = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].trim() === "10") xs.push(+lines[i + 1]);
      if (lines[i].trim() === "20") ys.push(+lines[i + 1]);
    }
    assert.ok(
      xs.every((x) => x <= 0.001),
      "tout à gauche du zéro"
    );
    assert.ok(
      ys.every((y) => y >= -0.001),
      "tout au-dessus du zéro"
    );
    await page.context().close();
  });

  test("option contour du panneau : rectangle aux dimensions du panneau, calque à part, mémorisée", async () => {
    const page = await open();
    const dl = async (kind) => {
      const [d] = await Promise.all([page.waitForEvent("download"), page.click(`[data-dl=${kind}][data-s="0"]`)]);
      return readFile(await d.path(), "utf8");
    };
    assert.doesNotMatch(await dl("dxf"), /\nPanneau\r?\n/, "sans l'option : pas de contour");
    await page.check("#dlBoard");
    await page.click('.pnl[data-i="0"] [data-o=bl]');
    await idle(page);
    assert.equal(await page.isChecked("#dlBoard"), true, "la case reste cochée après un recalcul");
    const dxf = await dl("dxf");
    const lines = dxf.split(/\r?\n/),
      xs = [],
      ys = [];
    for (let i = 0; i < lines.length - 3; i++)
      if (lines[i].trim() === "VERTEX" && lines[i + 2].trim() === "Panneau") {
        xs.push(+lines[i + 4]);
        ys.push(+lines[i + 6]);
      }
    assert.equal(xs.length, 4, "4 sommets sur le calque Panneau");
    // origine en bas à gauche : le rectangle va de 0,0 à la taille du panneau
    assert.deepEqual([Math.min(...xs), Math.min(...ys)], [0, 0]);
    assert.deepEqual(
      [Math.max(...xs), Math.max(...ys)],
      [400, 600],
      "panneau de l'exemple : 400 de large, 600 de haut"
    );
    assert.match(await dl("svg"), /inkscape:label="Panneau"/);
    // l'option reste cochée après rechargement
    await page.reload();
    await idle(page);
    assert.equal(await page.isChecked("#dlBoard"), true);
    await page.context().close();
  });

  // cas signalé : petit panneau, sens fixe, origine en bas au centre → 4 panneaux au lieu de 3 (1.2.4)
  test("petit panneau, sens fixe : aucune origine ne demande plus de panneaux que le coin haut gauche", async () => {
    const page = await open();
    await page.fill('.pnl[data-i="0"] [data-k=L]', "200");
    await page.fill('.pnl[data-i="0"] [data-k=W]', "300");
    await page.fill("#sG", "20");
    await page.fill("#sM", "9");
    await page.selectOption("#rotAll", "fix");
    const counts = {};
    for (const o of ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"]) {
      await page.click(`.pnl[data-i="0"] [data-o=${o}]`);
      await idle(page);
      counts[o] = await page.locator(".sheet").count();
      // aucune superposition : la matière utilisée par panneau ne peut pas dépasser 100 %
      const used = await page.$$eval(".sheet h3 small", (v) =>
        v.map((x) => parseFloat(x.innerText.split(":").pop().replace(",", ".")))
      );
      assert.ok(
        used.every((u) => u <= 100),
        `${o} : ${used}`
      );
    }
    for (const o in counts)
      assert.ok(counts[o] <= counts.tl, `origine ${o} : ${counts[o]} panneaux, ${counts.tl} depuis le coin`);
    await page.context().close();
  });

  test("repère d'origine entier et discret, même dans un coin", async () => {
    const page = await open();
    for (const o of ["tl", "tr", "bl", "br", "mc"]) {
      await page.click(`.pnl[data-i="0"] [data-o=${o}]`);
      await idle(page);
      const r = await page.$eval(".sheet svg", (svg) => {
        const vb = svg.viewBox.baseVal,
          b = svg.querySelector(".svg-origin").getBBox(),
          sw = parseFloat(svg.querySelector(".svg-origin").getAttribute("stroke-width")) / 2;
        return {
          inside:
            b.x - sw >= vb.x &&
            b.y - sw >= vb.y &&
            b.x + b.width + sw <= vb.x + vb.width &&
            b.y + b.height + sw <= vb.y + vb.height,
          ratio: b.width / Math.max(vb.width, vb.height)
        };
      });
      assert.ok(r.inside, `origine ${o} : repère coupé par le bord du dessin`);
      assert.ok(r.ratio < 0.04, `origine ${o} : repère trop grand (${(r.ratio * 100).toFixed(1)} % du panneau)`);
    }
    await page.context().close();
  });

  test("quantités élevées : 800 pièces toutes placées", async () => {
    const page = await open();
    for (let i = 0; i < 4; i++) await page.fill(`.trow[data-i="${i}"] [data-k=qty]`, i === 3 ? "800" : "0");
    await idle(page);
    assert.equal((await stats(page))[1], "800 / 800");
    await page.context().close();
  });

  test("langues : arabe de droite à gauche, sans défilement horizontal", async () => {
    const page = await open({ locale: "ar", viewport: { width: 390, height: 800 } });
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `débordement de ${overflow}px`);
    await page.context().close();
  });

  test("SVG piégé : le fichier ne peut ni exécuter de code ni modifier la page", async () => {
    const page = await open();
    await load(page, "piege.svg");
    assert.equal(await page.evaluate(() => window.__piege), undefined, "aucun script exécuté");
    // les deux rectangles sont lus (celui qui était dans un lien aussi), avec la couleur venue de la classe
    const src = await readFile(FIX("piege.svg"), "utf8");
    const r = await page.evaluate((t) => Formats.parseSVG(t, "auto").paths.map((p) => p.color), src);
    assert.equal(r.length, 2);
    assert.ok(r.includes("rgb(238, 0, 0)"), `couleurs lues : ${r}`);
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).display),
      "none",
      "le style du fichier ne touche pas la page"
    );
    assert.equal(await page.locator("#svgScratch image, #svgScratch a, #svgScratch style").count(), 0);
    await page.context().close();
  });
});
