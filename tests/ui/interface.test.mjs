// Tests de l'interface dans un vrai navigateur (Chromium via Playwright).
// Ils sont sautés si Playwright n'est pas installé. Lancement : node --test tests/
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, readdir, writeFile, mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { ROOT } from "../helpers.mjs";
import { READERS, bounds } from "../export-readers.mjs";

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
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};
const FIX = (n) => join(ROOT, "tests", "fixtures", n);

let server, base, browser;

// petit serveur de fichiers statiques sur un dossier (le service worker exige http)
async function serve(dir) {
  const srv = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    try {
      const body = await readFile(join(dir, path));
      res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  return srv;
}

before(async () => {
  if (skip) return;
  server = await serve(ROOT);
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
  // la langue est chargée avant le premier dessin : on attend que le premier panneau soit dessiné
  await page.waitForSelector(".sheet", { timeout: 20000 });
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

// Hors ligne : le service worker doit mettre en cache tous les fichiers dont l'appli a besoin. Un fichier ajouté
// dans src/ (ou un fichier de langue) sans être ajouté à la liste de sw.js ferait échouer l'appli sans connexion.
test("hors ligne : chaque fichier de l'appli est dans le cache du service worker", async () => {
  const sw = await readFile(join(ROOT, "sw.js"), "utf8");
  const cached = new Set([...sw.matchAll(/^\s*"([^"]+)",?$/gm)].map((m) => m[1]));
  const filesIn = async (dir, exts) =>
    (await readdir(join(ROOT, dir), { recursive: true }))
      .filter((f) => exts.some((e) => f.endsWith(e)))
      .map((f) => dir + "/" + f.split("\\").join("/"));
  const needed = [...(await filesIn("src", [".js", ".json"])), ...(await filesIn("css", [".css"]))];
  for (const f of needed) assert.ok(cached.has(f), `${f} absent du cache hors ligne (sw.js)`);
  for (const f of cached) {
    if (f === "./") continue;
    await readFile(join(ROOT, f)).catch(() => assert.fail(`${f} est dans le cache mais n'existe pas`));
  }
});

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

  // Chaque format que l'appli déclare savoir ouvrir (manifest.webmanifest) doit avoir un fichier d'essai qui s'importe
  // sans erreur. Un format ajouté au manifeste sans fichier d'essai fait échouer ce test.
  test("tous les formats d'import déclarés : un fichier d'essai chacun, lu sans erreur", async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, "manifest.webmanifest"), "utf8"));
    const exts = manifest.file_handlers.flatMap((h) => Object.values(h.accept).flat());
    const fixtures = await readdir(join(ROOT, "tests", "fixtures"));
    for (const ext of exts) {
      const file = fixtures.find((f) => f.toLowerCase().endsWith(ext));
      assert.ok(file, `aucun fichier d'essai « *${ext} » dans tests/fixtures`);
      const page = await open();
      await load(page, file);
      const info = await page.textContent("#fileInfo");
      assert.ok((await page.locator(".trow").count()) > 0, `${file} : aucune pièce lue (${info})`);
      // en cas d'échec, l'appli rappelle la liste des formats lus (texte err.formats)
      assert.doesNotMatch(info, /Formats acceptés/, `${file} : erreur à l'import (${info})`);
      assert.deepEqual(page.errors, [], file);
      await page.context().close();
    }
  });

  test("fichier abîmé : message adapté au format (un PDF n'est pas un AI)", async () => {
    const page = await open();
    // attend que la ligne d'erreur de CE fichier soit affichée (« nom : message »), pas un message précédent
    const errorFor = async (name) => {
      await page.waitForFunction((n) => document.querySelector("#fileInfo").textContent.includes(n + " :"), name, {
        timeout: 20000
      });
      return page.textContent("#fileInfo");
    };
    await page.setInputFiles("#fileIn", {
      name: "abime.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 abîmé")
    });
    const pdfInfo = await errorFor("abime.pdf");
    assert.match(pdfInfo, /PDF est illisible/);
    assert.doesNotMatch(pdfInfo, /fichier AI/);
    await page.setInputFiles("#fileIn", {
      name: "ancien.ai",
      mimeType: "application/postscript",
      buffer: Buffer.from("%!PS-Adobe-3.0")
    });
    assert.match(await errorFor("ancien.ai"), /fichier AI/);
    await page.context().close();
  });

  // Sécurité : un nom de pièce, de calque, un texte ou un nom de fichier venant d'un fichier importé est affiché comme
  // du texte, jamais interprété comme du code, quel que soit le format.
  test("noms piégés (pièce, calque, texte, fichier) : affichés comme du texte, jamais exécutés", async () => {
    const page = await open();
    const trap = '<img src=x onerror="window.__xss=1">';
    // dans un SVG valide, le piège est écrit avec des entités XML (&lt; …) : la lecture le redonne tel quel
    const xmlTrap = trap.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
      width="100mm" height="100mm" viewBox="0 0 100 100">
      <g inkscape:groupmode="layer" inkscape:label="${xmlTrap}">
        <rect inkscape:label="${xmlTrap}" x="10" y="10" width="40" height="30"/>
      </g></svg>`;
    // DXF : un rectangle sur un calque piégé, avec un texte piégé posé dedans (il devient le nom de la pièce)
    const dxfPairs = [
      ["0", "SECTION"],
      ["2", "ENTITIES"],
      ["0", "LWPOLYLINE"],
      ["8", trap],
      ["90", "4"],
      ["70", "1"],
      ["10", "0"],
      ["20", "0"],
      ["10", "50"],
      ["20", "0"],
      ["10", "50"],
      ["20", "30"],
      ["10", "0"],
      ["20", "30"],
      ["0", "TEXT"],
      ["8", trap],
      ["10", "20"],
      ["20", "15"],
      ["40", "5"],
      ["1", trap],
      ["0", "ENDSEC"],
      ["0", "EOF"]
    ];
    const dxf = dxfPairs.flat().join("\n");
    await page.setInputFiles("#fileIn", [
      { name: `${trap}.svg`, mimeType: "image/svg+xml", buffer: Buffer.from(svg) },
      { name: `${trap}.dxf`, mimeType: "application/dxf", buffer: Buffer.from(dxf) }
    ]);
    await page.waitForFunction(() => document.querySelectorAll(".fline").length === 2, null, { timeout: 20000 });
    await idle(page);
    // les noms passent par plusieurs affichages : liste triée par calque, par fichier, par nom
    for (const sort of ["layer", "src", "name"]) {
      await page.selectOption("#sortSel", sort);
      await idle(page);
    }
    assert.equal(await page.evaluate(() => window.__xss), undefined, "code exécuté");
    assert.equal(await page.locator('img[src="x"]').count(), 0, "balise injectée dans la page");
    // le piège a bien été lu (sinon le test ne prouverait rien) et il est affiché tel quel, comme du texte
    assert.ok((await page.textContent("#fileInfo")).includes("<img"), "nom de fichier piégé affiché");
    assert.ok((await names(page)).includes(trap), "nom de pièce piégé lu");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  // Sécurité : un petit SVGZ peut se décompresser en gigaoctets (« bombe de décompression ») et bloquer le navigateur
  test("SVGZ piégé (énorme une fois décompressé) : refusé proprement, l'appli reste utilisable", async () => {
    const page = await open();
    // 200 Mo de zéros compressés : environ 200 ko
    const bomb = gzipSync(Buffer.alloc(200 * 1024 * 1024));
    const t0 = Date.now();
    await page.setInputFiles("#fileIn", { name: "bombe.svgz", mimeType: "image/svg+xml", buffer: bomb });
    await page.waitForFunction(() => document.querySelector("#fileInfo").textContent.includes("bombe.svgz :"), null, {
      timeout: 20000
    });
    assert.ok(Date.now() - t0 < 15000, "refus rapide");
    assert.match(await page.textContent("#fileInfo"), /trop (gros|lourd)/i);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  // PDF plus complet : calques (contenu optionnel), couleurs, courbes, zone de découpe (clip) à ignorer, texte,
  // forme réutilisée (Form XObject) et deuxième page. Fichier fabriqué par tools/make-test-pdf.py.
  test("PDF complet : calques, courbes, forme réutilisée, 2e page, clip ignoré, texte signalé", async () => {
    const page = await open();
    await load(page, "calques-courbes.pdf");
    const info = await page.textContent("#fileInfo");
    assert.match(info, /pièces trouvées : 4/);
    assert.match(info, /Textes non vectorisés ignorés : 1/);
    const sizes = await page.$$eval(".trow", (rows) =>
      rows.map(
        (r) =>
          Math.round(+r.querySelector("[data-k=sw]").value) + "x" + Math.round(+r.querySelector("[data-k=sh]").value)
      )
    );
    assert.deepEqual(sizes.sort(), ["20x20", "30x30", "50x50", "60x40"], "rectangle, disque, forme réutilisée, page 2");
    const layers = await page.$$eval(".laytag", (v) => v.map((x) => x.innerText).join(" "));
    assert.match(layers, /Découpe/, "nom du calque lu");
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

  test("coupes de chutes : options sous « Méthode », traits dessinés, calque « Coupes » exporté, choix mémorisé", async () => {
    const page = await open();
    // les options sont dans le même bloc que « Méthode », pas au-dessus des panneaux
    const sameBox = await page.evaluate(
      () => document.querySelector("#cutSel").closest("section") === document.querySelector("#sMode").closest("section")
    );
    assert.ok(sameBox, "options sous « Méthode »");
    assert.equal(await page.locator("#result #dlBoard").count(), 0, "plus d'option au-dessus des panneaux");
    assert.equal(await page.locator(".svg-cut").count(), 0, "aucun trait par défaut");
    await page.selectOption("#cutSel", "simple");
    assert.ok((await page.locator(".svg-cut").count()) > 0, "traits dessinés");
    assert.ok((await page.locator(".svg-chute").count()) > 0, "taille des chutes affichée");
    const [d] = await Promise.all([page.waitForEvent("download"), page.click('[data-dl=dxf][data-s="0"]')]);
    assert.match(await readFile(await d.path(), "utf8"), /\nCoupes\r?\n/);
    const [d2] = await Promise.all([page.waitForEvent("download"), page.click('[data-dl=svg][data-s="0"]')]);
    assert.match(await readFile(await d2.path(), "utf8"), /inkscape:label="Coupes"/, "traits aussi dans le SVG");
    await page.reload();
    await idle(page);
    assert.equal(await page.inputValue("#cutSel"), "simple");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  // Tous les formats d'export proposés (boutons « Télécharger … ») sont vérifiés de la même façon, pour chaque origine
  // et avec toutes les options : zéro à l'origine, contour du panneau, traits de coupe, mêmes pièces dans chaque format.
  // Un nouveau format sans lecteur dans export-readers.mjs fait échouer ce test.
  test("tous les formats d'export : mêmes pièces, zéro à l'origine, contour et coupes présents", async () => {
    const page = await open();
    await page.check("#dlBoard");
    await page.selectOption("#cutSel", "detail");
    const formats = await page.$$eval('[data-dl][data-s="0"]', (v) => v.map((b) => b.dataset.dl));
    assert.ok(formats.length >= 2, `formats trouvés : ${formats}`);
    for (const f of formats)
      assert.ok(READERS[f], `pas de lecteur de test pour le format « ${f} » : l'ajouter dans export-readers.mjs`);
    const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.05, `${msg} : ${a} au lieu de ${b}`);
    // origine → encombrement attendu du panneau dans le repère machine (panneau de l'exemple : 400 de large, 600 de haut)
    const expect = { tl: [0, -600, 400, 0], br: [-400, 0, 0, 600], mc: [-200, -300, 200, 300], bl: [0, 0, 400, 600] };
    for (const o of Object.keys(expect)) {
      await page.click(`.pnl[data-i="0"] [data-o=${o}]`);
      await idle(page);
      const cutsOnScreen = await page.locator(".sheet").first().locator(".svg-cut").count();
      const parts = {};
      for (const f of formats) {
        const [d] = await Promise.all([page.waitForEvent("download"), page.click(`[data-dl=${f}][data-s="0"]`)]);
        const layers = READERS[f](await readFile(await d.path(), "utf8"));
        const where = `${f}, origine ${o}`;
        // contour du panneau : un rectangle fermé, exactement le panneau autour du zéro choisi
        assert.equal(layers.Panneau?.length, 1, `${where} : contour du panneau`);
        bounds(layers.Panneau).forEach((v, k) => near(v, expect[o][k], `${where} : contour`));
        // traits de coupe : autant que sur l'écran, tous dans le panneau
        assert.equal(layers.Coupes?.length || 0, cutsOnScreen, `${where} : traits de coupe`);
        for (const c of layers.Coupes || []) {
          const [x0, y0, x1, y1] = bounds([c]);
          assert.ok(
            x0 >= expect[o][0] - 0.05 &&
              x1 <= expect[o][2] + 0.05 &&
              y0 >= expect[o][1] - 0.05 &&
              y1 <= expect[o][3] + 0.05,
            `${where} : trait hors du panneau`
          );
        }
        // pièces : tout le reste, dans le panneau
        const p = Object.entries(layers)
          .filter(([k]) => k !== "Panneau" && k !== "Coupes")
          .flatMap(([, v]) => v);
        assert.ok(p.length > 0, `${where} : pièces`);
        const b = bounds(p);
        assert.ok(
          b[0] >= expect[o][0] - 0.05 &&
            b[2] <= expect[o][2] + 0.05 &&
            b[1] >= expect[o][1] - 0.05 &&
            b[3] <= expect[o][3] + 0.05,
          `${where} : pièces hors du panneau ${b}`
        );
        parts[f] = { n: p.length, b };
      }
      // tous les formats contiennent exactement les mêmes pièces au même endroit
      const [ref, ...others] = formats;
      for (const f of others) {
        assert.equal(parts[f].n, parts[ref].n, `origine ${o} : nombre de tracés ${f} ≠ ${ref}`);
        parts[f].b.forEach((v, k) => near(v, parts[ref].b[k], `origine ${o} : position des pièces ${f} ≠ ${ref}`));
      }
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("hors ligne : l'appli se recharge et calcule sans connexion", async () => {
    const page = await open();
    // attend que le service worker ait tout mis en cache et contrôle la page
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await idle(page);
    await page.context().setOffline(true);
    await page.reload();
    await idle(page);
    assert.equal((await stats(page))[1], "14 / 14");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  // Politique de sécurité de la page (CSP) : elle doit être là, et l'appli ne doit jamais la heurter, même en
  // utilisant ce qui demande le plus d'autorisations (lecteur PDF et son worker, calcul en arrière-plan,
  // téléchargements, service worker).
  test("politique de sécurité : présente, et aucune violation en utilisant toute l'appli", async () => {
    const page = await open();
    await page.evaluate(() => {
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        window.__cspViolations.push(e.violatedDirective + " " + e.blockedURI)
      );
    });
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', "content");
    assert.match(csp, /script-src 'self'(;|$)/, "scripts limités à l'appli");
    assert.match(csp, /object-src 'none'/);
    await load(page, ["formes.pdf", "calques-inkscape.svgz"]);
    await page.selectOption("#rotAll", "free");
    await idle(page);
    await page.selectOption("#cutSel", "detail");
    for (const f of ["svg", "dxf"])
      await Promise.all([page.waitForEvent("download"), page.click(`[data-dl=${f}][data-s="0"]`)]);
    await page.click("#tabMill");
    await page.click("#millPreciseBtn");
    await page.click("[data-material=pmma]");
    await page.fill("#millDiameter", "4");
    await page.click("#tabNest");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // une injection de script est bien bloquée
    const injected = await page.evaluate(() => {
      const s = document.createElement("script");
      s.textContent = "window.__injected = 1";
      document.body.appendChild(s);
      return window.__injected;
    });
    assert.equal(injected, undefined, "script intégré bloqué");
    const violations = await page.evaluate(() =>
      window.__cspViolations.filter((v) => !v.startsWith("script-src-elem inline"))
    );
    assert.deepEqual(violations, []);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  // Bug vu sur iPhone (1.2.6) : au premier lancement après une mise à jour, la nouvelle page tournait avec l'ancien
  // code resté en cache (le menu des coupes de chutes ne faisait rien). Après une mise à jour, la page et son code
  // doivent toujours être de la même version.
  test("mise à jour : dès le premier lancement, la page et son code sont de la nouvelle version", async () => {
    // deux copies de l'appli dans un dossier servi à part : l'« ancienne » ne diffère que par son numéro de version
    const dir = await mkdtemp(join(tmpdir(), "nestor-maj-"));
    const copyApp = async () => {
      for (const f of ["index.html", "manifest.webmanifest", "sw.js", "src", "css", "icons", "fonts", "vendor"])
        await cp(join(ROOT, f), join(dir, f), { recursive: true });
    };
    await copyApp();
    const oldVersion = "0.0.1";
    const setVersion = async (file, from, to) =>
      writeFile(join(dir, file), (await readFile(join(dir, file), "utf8")).replace(from, to));
    await setVersion("src/version.js", /APP_VERSION = "[^"]+"/, `APP_VERSION = "${oldVersion}"`);
    await setVersion("sw.js", /const VERSION = "[^"]+"/, `const VERSION = "${oldVersion}"`);
    const server2 = await serve(dir);
    const ctx = await browser.newContext({ locale: "fr-FR" });
    try {
      const page = await ctx.newPage();
      const url = `http://127.0.0.1:${server2.address().port}/`;
      // premier lancement : l'ancienne version s'installe et le service worker prend la main sur la page
      await page.goto(url);
      await page.waitForSelector(".sheet");
      await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
      await page.waitForTimeout(500);
      await page.goto(url);
      await page.waitForSelector(".sheet");
      assert.equal(await page.textContent("#cartVer"), oldVersion);
      // mise en ligne de la nouvelle version, puis l'utilisateur relance l'appli
      await copyApp();
      await page.goto(url);
      await page.waitForSelector(".sheet");
      const newVersion = (await readFile(join(ROOT, "src", "version.js"), "utf8")).match(/APP_VERSION = "([^"]+)"/)[1];
      assert.equal(await page.textContent("#cartVer"), newVersion, "le code chargé est celui de la nouvelle version");
    } finally {
      await ctx.close();
      server2.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("première visite : l'appli ne se recharge pas toute seule une fois mise en cache", async () => {
    const ctx = await browser.newContext({ locale: "fr-FR" });
    // compte chaque chargement de la page, dès le tout premier
    await ctx.addInitScript(() => {
      sessionStorage.setItem("loads", String(Number(sessionStorage.getItem("loads") || 0) + 1));
    });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForSelector(".sheet");
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("loads")),
      "1",
      "la page s'est rechargée toute seule"
    );
    await ctx.close();
  });

  test("quantités élevées : 800 pièces toutes placées", async () => {
    const page = await open();
    for (let i = 0; i < 4; i++) await page.fill(`.trow[data-i="${i}"] [data-k=qty]`, i === 3 ? "800" : "0");
    await idle(page);
    assert.equal((await stats(page))[1], "800 / 800");
    await page.context().close();
  });

  test("onglet Fraisage : réglages calculés, matière précise, limites de la machine, tout mémorisé", async () => {
    const page = await open();
    const digits = (sel) => page.$$eval(sel, (v) => v.map((x) => x.textContent.replace(/\D/g, "")));
    await page.click("#tabMill");
    assert.equal(await page.isVisible("#pageNest"), false, "l'imbrication est cachée");
    assert.equal(await page.getAttribute("#tabMill", "aria-selected"), "true");
    // valeurs de départ : fraise Ø 6 à 2 dents, famille intermédiaire, 18 mm en ébauche
    assert.deepEqual((await digits("#millValues b")).slice(0, 3), ["15900", "1910", "3"]);
    assert.match(await page.textContent("#millValues"), /6 × 3 mm/);
    // petite fraise : la broche plafonne, l'avance suit et un message l'explique
    await page.fill("#millDiameter", "3");
    assert.equal((await digits("#millValues b"))[0], "24000");
    assert.match(await page.textContent("#millNotes"), /24\s?000 tr\/min/);
    // type de fraise en cartes : la 1 dent met le nombre de dents à 1
    assert.equal(await page.getAttribute("[data-tool=upcut]", "aria-pressed"), "true");
    assert.equal(await page.locator("#millTypes svg").count(), 7, "un dessin par type");
    // fraise conique : angle et profondeur de gravure à la place de l'épaisseur, une seule passe
    assert.equal(await page.isVisible("#millAngle"), false);
    await page.click("[data-tool=vbit]");
    assert.equal(await page.isVisible("#millThickness"), false);
    await page.fill("#millAngle", "60");
    await page.fill("#millEngraveDepth", "1.5");
    assert.match(await page.textContent("#millNotes"), /1,5 mm de profondeur.*1,73 mm de large/);
    assert.match(await page.textContent("#millValues"), /1 × 1,5 mm pour 1,5 mm/);
    await page.fill("#millAngle", "");
    assert.match(await page.textContent("#millRule"), /angle/);
    await page.fill("#millAngle", "60");
    await page.click("[data-tool=single]");
    assert.equal(await page.getAttribute("[data-tool=single]", "aria-pressed"), "true");
    assert.equal(await page.getAttribute("[data-tool=upcut]", "aria-pressed"), "false");
    assert.equal(await page.inputValue("#millFlutes"), "1");
    // matière précise : sa famille est choisie et expliquée
    await page.click("[data-family=soft]");
    await page.click("#millPreciseBtn");
    await page.click("[data-material=plyBirch]");
    assert.equal(await page.getAttribute("[data-family=medium]", "aria-pressed"), "true");
    assert.match(await page.textContent("#millMatInfo"), /700 kg\/m³.*Intermédiaire/);
    await page.fill("#millThickness", "");
    assert.match(await page.textContent("#millValues"), /indique l’épaisseur/);
    // diamètre effacé : message au lieu de chiffres
    await page.fill("#millDiameter", "");
    assert.equal(await page.locator("#millValues b").count(), 0);
    assert.match(await page.textContent("#millRule"), /diamètre/);
    await page.fill("#millDiameter", "3");
    await page.waitForTimeout(100);
    // rechargement : onglet, fraise et matière retrouvés
    await page.reload();
    await page.waitForSelector("#millValues b");
    assert.equal(await page.isVisible("#pageMill"), true, "onglet Fraisage gardé");
    assert.equal(await page.inputValue("#millDiameter"), "3");
    assert.equal(await page.inputValue("#millThickness"), "");
    assert.equal(await page.getAttribute("[data-tool=single]", "aria-pressed"), "true");
    assert.equal(await page.getAttribute("[data-material=plyBirch]", "aria-pressed"), "true");
    assert.equal(await page.isVisible("#millPrecise"), true, "liste ouverte pour montrer la matière gardée");
    // clavier : flèche vers l'onglet Imbrication, qui reprend la main avec son résultat
    await page.focus("#tabMill");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.evaluate(() => document.activeElement.id), "tabNest");
    assert.equal(await page.isVisible(".sheet"), true);
    assert.equal(await page.isVisible("#pageMill"), false);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("thème : automatique suit l'appareil, clair ou sombre forcé dans les réglages, gardé sans éclair au démarrage", async () => {
    const page = await open({ colorScheme: "dark" });
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(await theme(), "dark", "automatique : appareil en sombre");
    const darkBackground = await background();
    await page.click("#btnSettings");
    assert.equal(await page.inputValue("#themeSel"), "auto");
    await page.selectOption("#themeSel", "light");
    assert.equal(await theme(), "light");
    assert.notEqual(await background(), darkBackground, "les couleurs suivent");
    assert.equal(await page.getAttribute('meta[name="theme-color"]', "content"), "#0d4e73");
    // le choix est posé avant le premier affichage, dès la lecture de <head>
    await page.reload({ waitUntil: "commit" });
    await page.waitForSelector("body");
    assert.equal(await theme(), "light", "clair gardé au démarrage, malgré l'appareil en sombre");
    await page.waitForSelector(".sheet");
    await page.click("#btnSettings");
    assert.equal(await page.inputValue("#themeSel"), "light");
    await page.selectOption("#themeSel", "dark");
    assert.equal(await theme(), "dark");
    assert.equal(await page.getAttribute('meta[name="theme-color"]', "content"), "#0b2436");
    // retour en automatique : l'appareil passe en clair, l'appli suit
    await page.selectOption("#themeSel", "auto");
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light", null, { timeout: 3000 });
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("changer de langue dans les réglages : textes chargés et appliqués, choix gardé", async () => {
    const page = await open();
    const before = await page.getAttribute("#btnSettings", "aria-label");
    await page.click("#btnSettings");
    await page.selectOption("#langSel", "de");
    await page.waitForFunction(() => document.documentElement.lang === "de");
    await idle(page);
    assert.notEqual(await page.getAttribute("#btnSettings", "aria-label"), before, "étiquette du bouton traduite");
    assert.match(await page.textContent("#unitSel"), /Automatisch/, "textes de la page traduits");
    assert.equal((await stats(page))[1], "14 / 14", "le résultat est redessiné");
    await page.click("#btnCloseSet");
    await page.click("#tabMill");
    const millText = await page.textContent("#pageMill");
    assert.doesNotMatch(millText, /Hélice|Ébauche|Réglages conseillés|tr\/min/, "onglet Fraisage traduit");
    assert.match(await page.textContent("#millValues b >> nth=0"), /^15\.900$/, "nombres à l'allemande");
    await page.click("#tabNest");
    await page.reload();
    await page.waitForSelector(".sheet");
    assert.equal(await page.evaluate(() => document.documentElement.lang), "de", "langue gardée après rechargement");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("langues : arabe de droite à gauche, sans défilement horizontal", async () => {
    const page = await open({ locale: "ar", viewport: { width: 390, height: 800 } });
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `débordement de ${overflow}px`);
    await page.click("#tabMill");
    await page.click("#millPreciseBtn");
    const millOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(millOverflow <= 1, `onglet Fraisage : débordement de ${millOverflow}px`);
    // en arabe, la flèche gauche va vers l'onglet suivant (sens de lecture)
    await page.focus("#tabMill");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement.id), "tabNest");
    await page.context().close();
  });

  test("SVG piégé : le fichier ne peut ni exécuter de code ni modifier la page", async () => {
    const page = await open();
    await load(page, "piege.svg");
    assert.equal(await page.evaluate(() => window.__piege), undefined, "aucun script exécuté");
    // les deux rectangles sont lus (celui qui était dans un lien aussi), avec la couleur venue de la classe
    const src = await readFile(FIX("piege.svg"), "utf8");
    const r = await page.evaluate(
      async (t) => (await import("/src/import/svg.js")).parseSvg(t, "auto").paths.map((p) => p.color),
      src
    );
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
