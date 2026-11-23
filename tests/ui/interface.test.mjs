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
import { READERS, bounds, fileUnit } from "../export-readers.mjs";

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

// choix « Remplir » d'une pièce ou d'un kit (box : sélecteur du conteneur) : "" = nombre fixe, sinon "ligne:comment"
async function chooseFill(page, box, value) {
  if (!value) return page.selectOption(box + ' [data-fp="mode"]', "");
  const [row, how] = value.split(":");
  await page.selectOption(box + ' [data-fp="mode"]', "fill");
  if (await page.isVisible(box + ' [data-fp="row"]')) await page.selectOption(box + ' [data-fp="row"]', row);
  await page.selectOption(box + ' [data-fp="how"]', how);
}
async function fillValue(page, box) {
  if ((await page.inputValue(box + ' [data-fp="mode"]')) === "") return "";
  return (await page.inputValue(box + ' [data-fp="row"]')) + ":" + (await page.inputValue(box + ' [data-fp="how"]'));
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

  test("import AI : noms des tracés donnés dans Illustrator (données internes ZStandard et zlib)", async () => {
    for (const file of ["noms-zstd.ai", "noms-zlib.ai"]) {
      const page = await open();
      await load(page, file);
      const names = await page.$$eval(".trow .nm", (v) => v.map((i) => i.value).sort());
      assert.deepEqual(names, ["BGM_12", "Côté gauche", "Étagère", "Étagère"].sort(), file);
      assert.deepEqual(page.errors, []);
      await page.context().close();
    }
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

  test("cadenas et remplissage : pièces figées immobiles, nouvelles dans les trous, gardés dans le projet", async () => {
    const page = await open();
    await page.setInputFiles("#fileIn", FIX("noms.dxf"));
    await idle(page);
    for (let i = 0; i < (await page.locator(".trow").count()); i++)
      await page.fill(`.trow[data-i="${i}"] [data-k="qty"]`, "3");
    await idle(page);
    // positions des pièces du panneau 1 avant de le figer
    const shapes = () => page.$$eval(".sheet:first-of-type .svg-piece", (ps) => ps.map((p) => p.getAttribute("d")));
    const before = await shapes();
    await page.click('[data-lock="0"]');
    await idle(page);
    assert.equal(await page.getAttribute('[data-lock="0"]', "aria-pressed"), "true");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.lock), "0");
    assert.equal(await page.locator(".sheet:first-of-type .svg-piece.locked").count(), before.length);
    // espace, marge et taille du panneau figé ne changent plus
    assert.ok(await page.isDisabled("#sG"));
    assert.ok(await page.isDisabled("#sM"));
    assert.ok(await page.isDisabled("#pl0-L"));
    assert.ok(await page.isVisible("#lockHint"));
    // un nouveau fichier : ses pièces vont dans les trous, les figées n'ont pas bougé
    await page.setInputFiles("#fileAdd", FIX("plaque-trou.dxf"));
    await idle(page);
    const last = (await page.locator(".trow").count()) - 1;
    await page.fill(`.trow[data-i="${last}"] [data-k="qty"]`, "8");
    await idle(page);
    const after = await page.$$eval(".sheet:first-of-type .svg-piece.locked", (ps) =>
      ps.map((p) => p.getAttribute("d"))
    );
    assert.deepEqual(after.sort(), before.slice().sort());
    assert.ok((await page.locator(".sheet:first-of-type .svg-piece:not(.locked)").count()) > 0);
    // remplir le panneau 1 avec la dernière pièce : le nombre posé s'affiche, la quantité disparaît
    await chooseFill(page, `.trow[data-i="${last}"]`, "0:last");
    await idle(page);
    assert.match(await page.textContent(`.trow[data-i="${last}"] .fillinfo`), /^\d+ posée\(s\) en remplissage$/);
    assert.ok(await page.isHidden(`.trow[data-i="${last}"] label.qty`));
    // baisser sous le nombre figé demande de déverrouiller : refusé, rien ne change
    page.once("dialog", (d) => d.dismiss());
    await page.fill('.trow[data-i="0"] [data-k="qty"]', "1");
    assert.equal(await page.inputValue('.trow[data-i="0"] [data-k="qty"]'), "3");
    assert.equal(await page.locator('[data-lock][aria-pressed="true"]').count(), 1);
    // projet enregistré puis rouvert : cadenas et remplissage reviennent
    await page.click("#btnProjects");
    await page.click("#projSave");
    await page.waitForFunction(() => document.querySelector("#projMsg").textContent === "Projet enregistré.");
    await page.click("#btnCloseProj");
    await page.reload();
    await idle(page);
    await page.click("#btnProjects");
    await page.click('#projList [data-act="open"]');
    await page.waitForFunction(() => /ouvert/.test(document.querySelector("#projMsg").textContent));
    await page.click("#btnCloseProj");
    await idle(page);
    assert.equal(await page.getAttribute('[data-lock="0"]', "aria-pressed"), "true");
    assert.deepEqual(
      (await page.$$eval(".sheet:first-of-type .svg-piece.locked", (ps) => ps.map((p) => p.getAttribute("d")))).sort(),
      before.slice().sort()
    );
    assert.equal(await fillValue(page, `.trow[data-i="${last}"]`), "0:last");
    // revenir à un nombre fixe : la quantité d'avant est intacte (le choix « Remplir » ne l'écrase pas)
    await chooseFill(page, `.trow[data-i="${last}"]`, "");
    await idle(page);
    assert.equal(await page.inputValue(`.trow[data-i="${last}"] [data-k="qty"]`), "8");
    const kept = await page.evaluate(async (i) => (await import("/src/project/state.js")).state.types[i].qty, last);
    assert.equal(kept, 8);
    await chooseFill(page, `.trow[data-i="${last}"]`, "0:last");
    await idle(page);
    // déverrouiller : tout redevient modifiable
    await page.click('[data-lock="0"]');
    await idle(page);
    assert.equal(await page.locator('[data-lock][aria-pressed="true"]').count(), 0);
    assert.ok(!(await page.isDisabled("#sG")));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("panneaux numérotés et nommés ; « Remplir » vise une ligne de panneau, qui suit ses déplacements", async () => {
    const page = await open();
    // un seul panneau : ni numéro ni flèche
    assert.equal(await page.isVisible('.pnl[data-i="0"] .pnum'), false);
    await page.click("#btnAddPanel");
    await page.fill("#pl1-L", "300");
    await page.fill("#pl1-W", "200");
    await page.fill("#pl1-q", "2");
    await idle(page);
    assert.deepEqual(await page.$$eval("#panels .pnum", (n) => n.map((x) => x.textContent)), ["1", "2"]);
    // la flèche ouvre le champ du nom, et le curseur y va
    await page.click('.pnl[data-i="1"] [data-act="name"]');
    assert.equal(await page.getAttribute('.pnl[data-i="1"] [data-act="name"]', "aria-expanded"), "true");
    assert.equal(await page.evaluate(() => document.activeElement.id), "pl1-name");
    await page.keyboard.type("Chute CP");
    // la pièce 1 remplit tous les panneaux de la ligne 2 « Chute CP »
    await page.selectOption('.trow[data-i="0"] [data-fp="mode"]', "fill");
    const options = await page.$$eval('.trow[data-i="0"] [data-fp="row"] option', (o) => o.map((x) => x.textContent));
    assert.equal(options.length, 2);
    assert.match(options[0], /^1 · /);
    assert.equal(options[1], "2 · Chute CP");
    await chooseFill(page, '.trow[data-i="0"]', "1:all");
    await idle(page);
    assert.match(await page.textContent('.trow[data-i="0"] .fillinfo'), /posée\(s\) en remplissage/);
    assert.match(await page.textContent("#result"), /Chute CP · 300 × 200/);
    // ↑ : « Chute CP » devient la ligne 1, et la pièce la vise toujours
    await page.click('.pnl[data-i="1"] [data-act="up"]');
    await idle(page);
    assert.equal(await page.inputValue("#pl0-L"), "300");
    assert.equal(await fillValue(page, '.trow[data-i="0"]'), "0:all");
    assert.equal(
      await page.$eval('.trow[data-i="0"] [data-fp="row"]', (s) => s.selectedOptions[0].textContent),
      "1 · Chute CP"
    );
    // ligne retirée : la pièce revient à un nombre fixe
    await page.click('.pnl[data-i="0"] [data-act="del"]');
    await idle(page);
    assert.equal(await fillValue(page, '.trow[data-i="0"]'), "");
    assert.equal(await page.isVisible('.trow[data-i="0"] label.qty'), true);
    assert.equal(await page.isVisible('.pnl[data-i="0"] .pnum'), false);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("projet enregistré avant la 1.9.6 (fichier sans taille de dessin) : il s'ouvre, la taille est recalculée", async () => {
    const page = await open();
    await page.setInputFiles("#fileIn", FIX("noms.dxf"));
    await idle(page);
    const summary = await page.textContent("#fileInfo");
    await page.click("#btnProjects");
    await page.click("#projSave");
    await page.waitForFunction(() => document.querySelector("#projMsg").textContent === "Projet enregistré.");
    await page.click("#btnCloseProj");
    // comme l'enregistrait l'ancienne version : la fiche du fichier a perdu sa taille
    await page.evaluate(async () => {
      const store = await import("/src/project/projects-store.js");
      const [entry] = await store.listProjects();
      const snapshot = await store.readProject(entry.id);
      delete snapshot.files[0].info.size;
      await store.storeProject(entry, snapshot);
    });
    await page.reload();
    await idle(page);
    await page.click("#btnProjects");
    await page.click('#projList [data-act="open"]');
    await page.waitForFunction(() => /ouvert/.test(document.querySelector("#projMsg").textContent));
    await page.click("#btnCloseProj");
    await page.waitForFunction((s) => document.querySelector("#fileInfo").textContent === s, summary);
    assert.match(summary, /dessin de 190 × 90/);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("revue : fenêtres au clavier, panneau sans taille, format inconnu, matière à taille nulle", async () => {
    const page = await open();
    // fenêtres : le focus entre, Tab reste dedans, Échap le rend au bouton d'origine
    for (const [button, closeButton] of [
      ["#btnSettings", "#btnCloseSet"],
      ["#btnProjects", "#btnCloseProj"]
    ]) {
      await page.click(button);
      assert.equal(await page.evaluate(() => document.activeElement.id), closeButton.slice(1));
      for (let i = 0; i < 30; i++) await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => !!document.activeElement.closest("[role=dialog]")), button + " : Tab sort");
      await page.keyboard.press("Shift+Tab");
      assert.ok(await page.evaluate(() => !!document.activeElement.closest("[role=dialog]")));
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement.id), button.slice(1));
    }
    // Raccourcis ouverts depuis Réglages : en se fermant, le focus revient au bouton des réglages
    await page.click("#btnSettings");
    await page.click("#btnShortcuts");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "btnSettings");
    // panneau sans longueur : message clair, pas « importe un fichier », ni conseil sur la fraise
    await page.fill("#pl0-L", "");
    await idle(page);
    assert.match(await page.textContent("#result .alert"), /Indique la longueur et la largeur/);
    assert.doesNotMatch(await page.textContent("#result"), /règle la fraise/);
    await page.fill("#pl0-L", "600");
    await idle(page);
    // une image n'est pas un « SVG illisible »
    await page.setInputFiles("#fileIn", join(ROOT, "tests", "fixtures", "page.jpg"));
    await page.waitForFunction(() => /Format non reconnu/.test(document.body.textContent));
    assert.doesNotMatch(await page.textContent("body"), /SVG illisible/);
    // matière : longueur nulle refusée avec un message, rien d'enregistré
    await page.click("#tabMaterials");
    await page.click("#btnLibNew");
    await page.fill("#libName", "Essai");
    await page.fill("#libL", "0");
    await page.click('#libForm button[type="submit"]');
    assert.match(await page.textContent("#libMsg"), /Longueur du panneau.*doit être un nombre plus grand que 0/);
    assert.equal(await page.evaluate(() => document.activeElement.id), "libL");
    assert.equal(await page.locator("#libTable [data-id]").count(), 0);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("pièces qui ne rentrent pas : repère rouge dans la liste, raison écrite, lien depuis le message rouge", async () => {
    const page = await open();
    await page.click('[data-src="manual"]');
    await page.$eval("#manName", (el) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", "Tablette\t520\t300\t3\nPlateau\t3200\t900\t1\n");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await idle(page);
    await page.waitForSelector(".trow.unplaced");
    assert.deepEqual(await page.$$eval(".trow.unplaced", (rows) => rows.map((r) => r.dataset.i)), ["1"]);
    assert.match(await page.textContent(".trow.unplaced .unfit"), /Ne rentre dans aucun panneau.*zone utile \(\d/);
    assert.equal(await page.locator('.trow[data-i="0"] .unfit').count(), 0);
    // le lien du message rouge mène au nom de la pièce
    await page.click('#result .part-link[data-part="1"]');
    assert.equal(await page.evaluate(() => document.activeElement.id), "t1-n");
    // pas assez de panneaux en stock : nombre d'exemplaires non placés
    await page.click('.trow[data-i="1"] [data-act="del"]');
    await page.fill("#pl0-q", "1");
    await idle(page);
    await page.waitForSelector(".trow.unplaced .unfit");
    assert.match(
      await page.textContent(".trow.unplaced .unfit"),
      /^2 sur 3 non placée\(s\) : pas assez de panneaux en stock/
    );
    // tout rentre : plus aucun repère
    await page.fill("#pl0-q", "");
    await idle(page);
    await page.waitForFunction(() => !document.querySelector(".trow.unplaced"));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("saisie à la main : une pièce, collage d'un tableur, mélange avec un fichier, cotes, suppression, pouces", async () => {
    const page = await open();
    await page.click('[data-src="manual"]');
    assert.ok(await page.isHidden("#drop"));
    // cotes manquantes : message, rien d'ajouté
    await page.click("#manualForm [type=submit]");
    assert.match(await page.textContent("#manualMsg"), /longueur et la largeur/);
    // une pièce : l'exemple laisse la place
    await page.fill("#manName", "Côté");
    await page.fill("#manL", "720");
    await page.fill("#manW", "560");
    await page.fill("#manQty", "2");
    await page.check("#manFixed");
    await page.press("#manW", "Enter");
    await idle(page);
    assert.equal(await page.locator(".trow").count(), 1);
    assert.equal(await page.inputValue("#t0-n"), "Côté");
    assert.equal(await page.inputValue("#t0-q"), "2");
    assert.equal(await page.inputValue("#t0-r"), "fix");
    assert.deepEqual(await page.$$eval(".trow .sz", (v) => v.map((i) => i.value)), ["560", "720"]);
    assert.equal(await page.inputValue("#manName"), "");
    // collage depuis un tableur (en-tête, une ligne illisible)
    await page.$eval("#manName", (el) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", "Pièce\tLongueur\tLargeur\tQté\nTablette\t520\t300\t3\nDos\t700\t500\t1\nBof\tx\t\t\n");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await idle(page);
    assert.equal(await page.locator(".trow").count(), 3);
    assert.match(await page.textContent("#manualMsg"), /2 pièce\(s\) ajoutée\(s\).*1 ligne\(s\) ignorée\(s\)/);
    // longueur et largeur changent chacune de leur côté
    await page.fill('.trow[data-i="1"] [data-k="sw"]', "320");
    await idle(page);
    assert.deepEqual(await page.$$eval('.trow[data-i="1"] .sz', (v) => v.map((i) => i.value)), ["320", "520"]);
    assert.equal(await page.inputValue('.trow[data-i="1"] [data-k="sp"]'), "100");
    // un fichier importé ensuite ne remplace pas les pièces saisies
    await page.click('[data-src="file"]');
    await load(page, "plaque-trou.dxf");
    assert.equal(await page.locator('.trow .nm[value="Côté"]').count(), 1);
    assert.match(await page.textContent("#types"), /Saisie à la main/);
    await page.selectOption("#sortSel", "src");
    assert.equal(await page.locator("#types .lhead").last().textContent(), "Saisie à la main");
    // tout est placé, puis suppression d'une pièce saisie
    assert.doesNotMatch(await page.textContent("#result"), /non placée/);
    const before = await page.locator(".trow").count();
    await page.click('.trow:has(.nm[value="Dos"]) [data-act="del"]');
    await idle(page);
    assert.equal(await page.locator(".trow").count(), before - 1);
    // pouces en fractions : « 23 1/2 » lu comme 596,9 mm
    await page.click("#btnSettings");
    await page.selectOption("#unitsSel", "fraction");
    await page.click("#btnCloseSet");
    await page.click('[data-src="manual"]');
    assert.equal(await page.getAttribute("#manL", "type"), "text");
    await page.fill("#manL", "23 1/2");
    await page.fill("#manW", "10");
    await page.click("#manualForm [type=submit]");
    await idle(page);
    await page.click("#btnSettings");
    await page.selectOption("#unitsSel", "mm");
    await page.click("#btnCloseSet");
    await idle(page);
    assert.equal(await page.locator('.trow .sz[value="596.9"]').count(), 1);
    assert.deepEqual(page.errors, []);
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
    const vb = await page.getAttribute(".sheet .svgbox svg", "viewBox");
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
      const r = await page.$eval(".sheet .svgbox svg", (svg) => {
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
  for (const units of ["mm", "inch"])
    test(`tous les formats d'export (${units}) : mêmes pièces, zéro à l'origine, contour et coupes présents`, async () => {
      const page = await open();
      if (units !== "mm") {
        // appli en pouces : les fichiers aussi, ramenés en mm par les lecteurs pour comparer aux mêmes cotes
        await page.click("#btnSettings");
        await page.selectOption("#unitsSel", units);
        await page.click("#btnCloseSet");
        await idle(page);
      }
      await page.check("#dlBoard");
      await page.check("#dlNumbers");
      await page.selectOption("#cutSel", "detail");
      // le PDF est une page à imprimer (image), vérifié à part ; tous les autres formats sont des tracés
      const PRINT_ONLY = ["pdf"];
      const formats = (await page.$$eval('[data-dl][data-s="0"]', (v) => v.map((b) => b.dataset.dl))).filter(
        (f) => !PRINT_ONLY.includes(f)
      );
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
          const text = await readFile(await d.path(), "utf8");
          // noms de calques sans accents : le DXF n'en garde pas (« Numéros » devient « Numeros »)
          const layers = Object.fromEntries(
            Object.entries(READERS[f](text)).map(([k, v]) => [k.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), v])
          );
          const where = `${f} ${units}, origine ${o}`;
          assert.equal(fileUnit(text), units === "mm" ? "mm" : "in", `${where} : unité écrite dans le fichier`);
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
          // numéros gravés : sur leur calque, à l'intérieur du panneau, au moins un trait par pièce
          assert.ok((layers.Numeros?.length || 0) >= 14, `${where} : numéros gravés (${layers.Numeros?.length || 0})`);
          const nb = bounds(layers.Numeros);
          assert.ok(
            nb[0] >= expect[o][0] && nb[2] <= expect[o][2] && nb[1] >= expect[o][1] && nb[3] <= expect[o][3],
            `${where} : numéros hors du panneau`
          );
          // pièces : tout le reste, dans le panneau
          const p = Object.entries(layers)
            .filter(([k]) => k !== "Panneau" && k !== "Coupes" && k !== "Numeros")
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
    // passe maximale (fraise et matière), puis passes à faire : l'épaisseur en passes égales
    assert.deepEqual(await page.$$eval("#millValues small", (v) => v.slice(2).map((x) => x.textContent)), [
      "Passe maximale",
      "Passes à faire"
    ]);
    assert.match(await page.textContent("#millValues"), /selon la fraise et la matière/);
    assert.match(await page.textContent("#millValues"), /de 3 mm chacune/);
    assert.equal(
      await page.textContent("#millPassPlan"),
      "18 mm ÷ passe max 3 mm → 6 passes égales de 3 mm. Nestor répartit l’épaisseur en passes égales, chacune sans dépasser la passe maximale."
    );
    // 19 mm : 7 passes de 2,71 mm, sous la passe maximale de 3 mm
    await page.fill("#millThickness", "19");
    assert.match(await page.textContent("#millPassPlan"), /^19 mm ÷ passe max 3 mm → 7 passes égales de 2,71 mm\./);
    await page.fill("#millThickness", "18");
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
    assert.match(await page.textContent("#millValues"), /de 1,5 mm chacune/);
    assert.match(await page.textContent("#millPassPlan"), /^1,5 mm ≤ passe max .* → une seule passe\.$/);
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
    // le plan peut être en train d'être redessiné (changements faits dans Fraisage) : on attend qu'il paraisse
    await page.waitForSelector(".sheet", { state: "visible", timeout: 10000 });
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

  test("unités : pouces décimaux ou en fractions, les tailles ne changent jamais ; temps estimé, écart d'après la fraise, rappel théorique", async () => {
    const page = await open();
    const before = await stats(page);
    const panelL = () => page.inputValue("#pl0-L");
    assert.equal(await panelL(), "600");
    // minimums d'après la fraise (Ø 6 de l'onglet Fraisage) : espace 2 × 6 + 1 = 13 mm, marge 6 + 1 = 7 mm
    assert.match(await page.textContent("#toolIntro"), /fraise Ø 6 mm de l’onglet Fraisage/);
    assert.equal(await page.textContent("#btnGapFromTool"), "Espace minimal 13 mm");
    assert.equal(await page.textContent("#gapFromToolHow"), "(2 × Ø + 1 mm)");
    assert.equal(await page.textContent("#btnMarginFromTool"), "Marge minimale 7 mm");
    assert.equal(await page.textContent("#marginFromToolHow"), "(Ø + 1 mm)");
    await page.click("#btnMarginFromTool");
    await page.waitForSelector(".sheet");
    assert.equal(await page.inputValue("#sM"), "7");
    await page.click("#btnGapFromTool");
    await page.waitForSelector(".sheet");
    assert.equal(await page.inputValue("#sG"), "13");
    await page.fill("#sG", "4");
    await page.fill("#sM", "10");
    await page.waitForSelector(".sheet");
    // temps estimé : contours extérieurs, avec la mention d'estimation
    assert.match(await page.textContent("#cutTime .v"), /^≈ \d+ (min|h \d+ min)$/);
    assert.match(await page.textContent("#result"), /Estimation : seulement le contour extérieur/);
    // impérial décimal
    await page.click("#btnSettings");
    await page.selectOption("#unitsSel", "inch");
    assert.equal(await page.isVisible("#fractionStepSel"), false);
    await page.click("#btnCloseSet");
    await page.waitForSelector(".sheet");
    assert.equal(await panelL(), "23.622");
    assert.match(await page.textContent("#h-panel"), /\(in\)/);
    assert.deepEqual(await stats(page), before, "même résultat d'imbrication : rien n'a changé de taille");
    // impérial en fractions (1/16 par défaut)
    await page.click("#btnSettings");
    await page.selectOption("#unitsSel", "fraction");
    assert.equal(await page.isVisible("#fractionStepSel"), true);
    await page.click("#btnCloseSet");
    await page.waitForSelector(".sheet");
    assert.equal(await panelL(), "23 5/8");
    assert.equal(await page.getAttribute("#pl0-L", "type"), "text", "champ texte pour écrire les fractions");
    assert.deepEqual(await stats(page), before);
    // retour en métrique sans rien toucher : exactement les mêmes valeurs
    await page.click("#btnSettings");
    await page.selectOption("#unitsSel", "mm");
    await page.click("#btnCloseSet");
    await page.waitForSelector(".sheet");
    assert.equal(await panelL(), "600");
    assert.deepEqual(await stats(page), before);
    // une saisie en fractions est gardée exactement : 24 in = 609,6 mm
    await page.click("#btnSettings");
    await page.selectOption("#unitsSel", "fraction");
    await page.click("#btnCloseSet");
    await page.fill("#pl0-L", "24");
    await page.click("#btnSettings");
    await page.selectOption("#unitsSel", "mm");
    await page.click("#btnCloseSet");
    assert.equal(await panelL(), "609.6");
    // onglet Fraisage en pouces, et rappel théorique
    await page.click("#btnSettings");
    await page.selectOption("#unitsSel", "inch");
    await page.click("#btnCloseSet");
    await page.click("#tabMill");
    assert.equal(await page.inputValue("#millDiameter"), "0.2362");
    assert.match(await page.textContent("#millValues"), /in\/min/);
    assert.equal(await page.locator("#pageMill .mill-theory .formula").count(), 6);
    assert.equal(await page.locator("#millTheoryTable tbody tr").count(), 4);
    // le choix d'unités est gardé
    await page.reload();
    await page.waitForSelector("#millValues b");
    assert.equal(await page.inputValue("#millDiameter"), "0.2362");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("carnet : garder depuis Fraisage, chercher, laser, modifier, supprimer, rouvrir, exporter et importer", async () => {
    const page = await open();
    const cards = () => page.locator("#nbList .nb-card").count();
    // depuis l'onglet Fraisage : fiche pré-remplie avec les réglages conseillés
    await page.click("#tabMill");
    await page.click("#btnKeepMilling");
    assert.equal(await page.getAttribute("#tabNotebook", "aria-selected"), "true");
    assert.equal(await page.isVisible("#nbFormBox"), true);
    assert.equal(await page.inputValue("#nbMaterial"), "Intermédiaire");
    assert.equal(await page.inputValue("#nbRpm"), "15900");
    assert.equal(await page.inputValue("#nbDepth"), "3");
    assert.equal(await page.inputValue("#nbMillPasses"), "6");
    await page.fill("#nbMachine", "CNC atelier");
    await page.fill("#nbMaterial", "Contreplaqué bouleau");
    await page.fill("#nbNote", '<img src=x onerror="window.pwned=1"> Propre');
    await page.click("#nbForm [type=submit]");
    assert.equal(await cards(), 1);
    assert.equal(await page.locator("#nbList img").count(), 0, "la note reste du texte");
    assert.match(await page.textContent("#nbList"), /Contreplaqué bouleau · 18 mm/);
    assert.match(await page.textContent("#nbList"), /15\s?900 tr\/min/);
    // fiche laser à la main
    await page.click("#btnNbNew");
    await page.click('#nbProcess [data-process="laser"]');
    assert.equal(await page.isVisible("#nbSpeed"), true);
    assert.equal(await page.isVisible("#nbRpm"), false);
    await page.fill("#nbMachine", "Trotec Speedy 360");
    await page.fill("#nbMaterial", "PMMA coulé");
    await page.selectOption("#nbOperation", "engrave");
    await page.fill("#nbSpeed", "60");
    await page.fill("#nbPower", "35");
    await page.selectOption("#nbStatus", "review");
    await page.click("#nbForm [type=submit]");
    assert.equal(await cards(), 2);
    // recherche sans accents et filtre par procédé
    await page.fill("#nbSearch", "contreplaque");
    assert.equal(await cards(), 1);
    await page.fill("#nbSearch", "gravure");
    assert.equal(await cards(), 1, "libellé traduit trouvé");
    await page.fill("#nbSearch", "zzz");
    assert.equal(await cards(), 0);
    assert.match(await page.textContent("#nbList"), /Aucun réglage/);
    await page.fill("#nbSearch", "");
    await page.click('#nbFilter [data-process="laser"]');
    assert.equal(await cards(), 1);
    await page.click('#nbFilter [data-process=""]');
    // modifier la fiche laser
    const laser = page.locator(".nb-card", { hasText: "PMMA" });
    await laser.locator("[data-act=edit]").click();
    assert.equal(await page.inputValue("#nbPower"), "35");
    await page.fill("#nbPower", "25");
    await page.click("#nbForm [type=submit]");
    assert.match(await laser.textContent(), /Puissance 25 %/);
    assert.match(await laser.textContent(), /À revoir/);
    // ouvrir la fiche de fraisage dans l'onglet Fraisage, après lui avoir donné une fraise de 8
    const mill = page.locator(".nb-card", { hasText: "bouleau" });
    await mill.locator("[data-act=edit]").click();
    await page.fill("#nbDiameter", "8");
    await page.click("#nbForm [type=submit]");
    await mill.locator("[data-act=open]").click();
    assert.equal(await page.getAttribute("#tabMill", "aria-selected"), "true");
    assert.equal(await page.inputValue("#millDiameter"), "8");
    // gardé après rechargement
    await page.reload();
    await page.waitForSelector("#millValues b");
    await page.click("#tabNotebook");
    assert.equal(await cards(), 2);
    // export puis import dans un carnet vidé
    const [d] = await Promise.all([page.waitForEvent("download"), page.click("#btnNbExport")]);
    const saved = await d.path();
    const data = JSON.parse(await readFile(saved, "utf8"));
    assert.equal(data.kind, "carnet");
    assert.equal(data.entries.length, 2);
    for (let i = 0; i < 2; i++) {
      await page.locator(".nb-card [data-act=delete]").first().click();
      await page.locator(".nb-card [data-act=confirm]").first().click();
    }
    assert.equal(await cards(), 0);
    assert.match(await page.textContent("#nbList"), /carnet est vide/);
    await page.setInputFiles("#nbImport", saved);
    await page.waitForFunction(() => document.querySelectorAll("#nbList .nb-card").length === 2);
    assert.match(await page.textContent("#nbMsg"), /2 réglages importés/);
    // un fichier qui n'est pas un carnet : refusé, rien ne change
    await page.setInputFiles("#nbImport", {
      name: "x.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"a":1}')
    });
    await page.waitForFunction(() => /pas un carnet/.test(document.getElementById("nbMsg").textContent));
    assert.equal(await cards(), 2);
    assert.equal(await page.evaluate(() => window.pwned), undefined);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("matières et coût : bibliothèque, matière partagée entre Imbrication, Fraisage et Coût, coût de revient", async () => {
    const page = await open();
    const addMaterial = async (name, mill, t, L, W, price) => {
      await page.click("#btnLibNew");
      await page.fill("#libName", name);
      await page.selectOption("#libMill", mill);
      await page.fill("#libThickness", t);
      await page.fill("#libL", L);
      await page.fill("#libW", W);
      await page.fill("#libPrice", price);
      await page.click("#libForm [type=submit]");
    };
    await page.click("#tabCost");
    assert.match(await page.textContent("#costResult"), /Calcule d’abord|Panneau|Coût/);
    await page.click("#tabMaterials");
    assert.match(await page.textContent("#libTable"), /bibliothèque est vide/);
    await addMaterial("CP peuplier", "plyPoplar", "18", "2500", "1220", "42");
    await addMaterial("CP bouleau", "plyBirch", "18", "2500", "1250", "89");
    assert.equal(await page.locator("#libTable tbody tr").count(), 2);
    assert.match(await page.textContent("#libTable"), /13,77\s?€\/m²/);
    assert.equal(await page.textContent("#libMsg"), "Matière enregistrée.");
    const ids = await page.$$eval("#libTable tbody tr", (r) => r.map((x) => x.dataset.id));
    // Imbrication : la matière met son format sur le panneau, qui la suit (étiquette) ; bouton « Ajouter une chute »
    await page.click("#tabNest");
    await page.selectOption("#nestMaterial", { label: "CP peuplier 18 mm — 2 500 × 1 220" });
    assert.equal(await page.inputValue("#pl0-L"), "2500");
    assert.equal(await page.inputValue("#pl0-W"), "1220");
    assert.match(await page.textContent('.pnl[data-i="0"] .pnl-tag'), /Format de la matière : CP peuplier/);
    assert.equal(await page.textContent("#btnAddPanel"), "+ Ajouter une chute");
    await idle(page);
    // Fraisage : même matière et même épaisseur
    await page.click("#tabMill");
    assert.equal(await page.getAttribute("[data-material=plyPoplar]", "aria-pressed"), "true");
    assert.equal(await page.inputValue("#millThickness"), "18");
    // Coût : la même matière, son prix
    await page.click("#tabCost");
    assert.equal(await page.inputValue("#costMaterial"), ids[1]);
    assert.match(await page.textContent("#costPanels"), /42,00\s?€/);
    // même ordre des côtés que le résultat de l'imbrication et la bibliothèque
    assert.match(await page.textContent("#costPanels"), /2\s?500 × 1\s?220/);
    assert.match(await page.textContent("#costResult .big"), /42,00\s?€/);
    // Fraisage → bouleau : le projet suit, partout, et le panneau lié prend le format du bouleau
    await page.click("#tabMill");
    await page.click("[data-material=plyBirch]");
    await page.click("#tabCost");
    assert.equal(await page.inputValue("#costMaterial"), ids[0]);
    assert.equal(await page.inputValue("#nestMaterial"), ids[0]);
    await page.click("#tabNest");
    assert.equal(await page.inputValue("#pl0-W"), "1250");
    // taille changée à la main : le panneau ne suit plus la matière, son prix se fait au prorata
    await page.fill("#pl0-W", "1220");
    assert.equal(await page.locator(".pnl-tag").count(), 0);
    assert.equal(await page.textContent("#btnAddPanel"), "+ Ajouter un panneau");
    await idle(page);
    await page.click("#tabCost");
    assert.match(await page.textContent("#costPanelsHint"), /prorata/);
    // Fraisage → MDF, absent de la bibliothèque : plus de matière, prix à la main
    await page.click("#tabMill");
    await page.click("[data-material=mdf]");
    await page.click("#tabCost");
    assert.equal(await page.inputValue("#costMaterial"), "");
    await page.fill("#costPanels input", "20");
    assert.match(await page.textContent("#costResult .big"), /20,00\s?€/);
    assert.equal(await page.evaluate(() => document.activeElement.matches("#costPanels input")), true, "saisie gardée");
    // machine (temps de découpe) et main-d'œuvre (temps de préparation), chacun son taux
    await page.fill("#costRate", "60");
    await page.fill("#costPrep", "30");
    assert.match(await page.textContent("#costResult"), /Machine\s*\d/);
    assert.match(await page.textContent("#costResult"), /Main-d’œuvre\s*0,00\s?€\s*indique un taux horaire/);
    await page.fill("#costLaborRate", "40");
    assert.match(await page.textContent("#costResult"), /Main-d’œuvre\s*20,00\s?€\s*30 min/);
    await page.check("#costRoundLabor");
    assert.match(await page.textContent("#costResult"), /Main-d’œuvre\s*40,00\s?€\s*30 min, compté 1 h/);
    await page.uncheck("#costRoundLabor");
    const total = await page.textContent("#costResult .big b");
    assert.notEqual(total.replace(/\D/g, ""), "2000", "la machine s'ajoute");
    // dernier panneau : partie utilisée seulement, moins cher
    await page.selectOption("#costLastSheet", "used");
    const partial = await page.textContent("#costResult .big b");
    assert.ok(
      parseFloat(partial.replace(/[^\d,]/g, "").replace(",", ".")) <
        parseFloat(total.replace(/[^\d,]/g, "").replace(",", "."))
    );
    // tout est gardé, et l'onglet Coût rouvert
    await page.reload();
    await page.waitForSelector("#costResult .ct-tot");
    assert.equal(await page.getAttribute("#tabCost", "aria-selected"), "true");
    assert.equal(await page.inputValue("#costRate"), "60");
    assert.equal(await page.inputValue("#costLaborRate"), "40");
    assert.equal(await page.isChecked("#costRoundLabor"), false);
    assert.equal(await page.inputValue("#costLastSheet"), "used");
    await page.click("#tabMaterials");
    assert.equal(await page.locator("#libTable tbody tr").count(), 2);
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

describe("Interface : laser, PDF, projets, raccourcis", { skip }, () => {
  // ajoute une machine depuis l'onglet Laser
  async function addMachine(page, name, watts, trotec, kind = "co2") {
    await page.click("#lzAdd");
    await page.fill("#lzName", name);
    await page.selectOption("#lzKind", kind);
    await page.fill("#lzWatts", String(watts));
    if (trotec) await page.check("#lzTrotec");
    else await page.uncheck("#lzTrotec");
    await page.click("#lzForm [type=submit]");
  }
  const lzValues = (page) => page.$$eval("#lzValues b", (v) => v.map((b) => b.textContent));

  test("laser : deux machines (60 et 120 W), valeurs Trotec, estimation, grille de test, carnet par machine", async () => {
    const page = await open();
    await page.click("#tabLaser");
    assert.match(await page.textContent("#lzSource"), /Ajoute ta machine/);
    await addMachine(page, "Speedy 360", 60, true);
    await addMachine(page, "Speedy 400", 120, true);
    assert.equal(await page.locator("#lzMachine option").count(), 2);
    await page.selectOption("#lzMaterial", "oak");
    await page.fill("#lzThickness", "3");
    // 120 W : valeurs publiées (chêne 3 mm : 100 % et 0,6 %)
    assert.deepEqual((await lzValues(page)).slice(0, 2), ["100", "0,6"]);
    assert.match(await page.textContent("#lzSource"), /publiées par Trotec pour 120 W/);
    // 60 W : autre livret
    await page.selectOption("#lzMachine", { label: "Speedy 360 — 60 W" });
    assert.deepEqual((await lzValues(page)).slice(0, 2), ["100", "0,2"]);
    // 100 W sans livret : estimation signalée
    await addMachine(page, "Atelier", 100, true);
    assert.match(await page.textContent("#lzSource"), /Estimation à partir du livret Trotec/);
    // machine non Trotec : vitesse en mm/s
    await addMachine(page, "Chinoise", 80, false);
    assert.match(await page.textContent("#lzValues"), /mm\/s/);
    // diode : pas de livret, message clair
    await addMachine(page, "Diode", 20, false, "diode");
    assert.match(await page.textContent("#lzSource"), /Pas de valeurs publiées pour ce type de laser/);
    assert.equal(await page.textContent("#lzValues"), "");
    assert.equal(await page.textContent("#lzEditValues"), "Saisir mes valeurs");
    // suppression en deux clics
    await page.click("#lzDelete");
    assert.equal(await page.locator("#lzMachine option").count(), 5);
    await page.click("#lzDelete");
    assert.equal(await page.locator("#lzMachine option").count(), 4);
    // grille de test autour du point de départ (60 W), en SVG et en DXF
    await page.selectOption("#lzMachine", { label: "Speedy 360 — 60 W" });
    for (const kind of ["svg", "dxf"]) {
      const [d] = await Promise.all([page.waitForEvent("download"), page.click(`[data-grid=${kind}]`)]);
      const text = await readFile(await d.path(), "utf8");
      const layers = READERS[kind](text);
      const squares = Object.values(layers)
        .flat()
        .filter((p) => p.closed);
      assert.equal(squares.length, 16, `${kind} : 16 carrés`);
      assert.match(d.suggestedFilename(), new RegExp("^grille-test-chene-speedy-360-60-w\\." + kind + "$"));
    }
    // carnet : fiche pré-remplie avec la machine, puis filtre par machine
    await page.click("#tabLaser");
    await page.click("#btnKeepLaser");
    assert.equal(await page.inputValue("#nbMachine"), "Speedy 360 — 60 W");
    assert.equal(await page.inputValue("#nbSpeedUnit"), "percent");
    assert.equal(await page.inputValue("#nbSpeed"), "0.2");
    await page.click("#nbForm [type=submit]");
    await page.click("#tabLaser");
    await page.selectOption("#lzMachine", { label: "Chinoise — 80 W" });
    await page.click("#btnKeepLaser");
    assert.equal(await page.inputValue("#nbSpeedUnit"), "mmps");
    await page.click("#nbForm [type=submit]");
    assert.equal(await page.locator("#nbList article").count(), 2);
    await page.selectOption("#nbMachineFilter", "Speedy 360 — 60 W");
    assert.equal(await page.locator("#nbList article").count(), 1);
    assert.match(await page.textContent("#nbList"), /0,2 %/);
    await page.selectOption("#nbMachineFilter", "Chinoise — 80 W");
    assert.match(await page.textContent("#nbList"), /mm\/s/);
    // tout est gardé au rechargement
    await page.click("#tabLaser");
    await page.reload();
    await page.waitForSelector("#lzMachine option", { state: "attached" });
    assert.equal(await page.locator("#lzMachine option").count(), 4);
    assert.equal(await page.inputValue("#lzMaterial"), "oak");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("laser : matière du projet partagée (chêne 3 mm de la bibliothèque)", async () => {
    const page = await open();
    await page.click("#tabMaterials");
    await page.click("#btnLibNew");
    await page.fill("#libName", "Chêne massif");
    await page.selectOption("#libMill", "oak");
    await page.fill("#libThickness", "5");
    await page.fill("#libL", "1000");
    await page.fill("#libW", "500");
    await page.fill("#libPrice", "80");
    await page.click("#libForm [type=submit]");
    await page.click("#tabNest");
    await page.selectOption("#nestMaterial", { label: "Chêne massif 5 mm — 1 000 × 500" });
    await page.click("#tabLaser");
    assert.equal(await page.inputValue("#lzMaterial"), "oak");
    assert.equal(await page.inputValue("#lzThickness"), "5");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("laser : valeurs Thunder indicatives, limite de 10 mm, trop faible, tes valeurs et tes matières", async () => {
    const page = await open();
    await page.click("#tabLaser");
    await addMachine(page, "Speedy 360", 60, true);
    // contreplaqué bouleau 3,2 mm, 60 W : tableau Thunder (50 mm/s), converti en % Trotec
    await page.selectOption("#lzMaterial", "birchPly");
    await page.fill("#lzThickness", "3.2");
    const source = () => page.textContent("#lzSource");
    assert.match(await source(), /publiées par Thunder Laser pour un tube de 60 W/);
    assert.match(await source(), /ligne droite/);
    assert.match(await source(), /Valeurs indicatives/);
    assert.deepEqual((await lzValues(page)).slice(0, 3), ["100", "1,4", "–"]);
    assert.ok(await page.isHidden("#lzResetValues"));
    // 9,5 mm : 60 W trop faible (dès 80 W)
    await page.fill("#lzThickness", "9.5");
    assert.match(await source(), /Trop épais pour 60 W.*80 W/);
    assert.equal(await page.textContent("#lzValues"), "");
    // au-delà de 10 mm : gravure seulement
    await page.fill("#lzThickness", "12");
    assert.match(await source(), /Au-delà de 10 mm, le laser sert à graver/);
    assert.ok(await page.isHidden("#lzEditValues"));
    // tes valeurs à 3,2 mm : remplacent les indicatives, et on peut y revenir
    await page.fill("#lzThickness", "3.2");
    await page.click("#lzEditValues");
    assert.equal(await page.inputValue("#lzValPower"), "100");
    assert.equal(await page.inputValue("#lzValSpeedUnit"), "percent");
    assert.match(await page.textContent("#lzValFor"), /Speedy 360 — 60 W · Découpe · 3,2 mm/);
    await page.fill("#lzValPower", "90");
    await page.fill("#lzValSpeed", "1.2");
    await page.fill("#lzValFrequency", "500");
    await page.click("#lzValForm [type=submit]");
    assert.deepEqual((await lzValues(page)).slice(0, 3), ["90", "1,2", "500"]);
    assert.match(await source(), /Tes valeurs pour cette machine/);
    assert.ok(await page.isVisible("#lzResetValues"));
    // ailleurs que 3,2 mm : la référence publiée passe avant l'estimation depuis tes valeurs
    await page.fill("#lzThickness", "6.4");
    assert.match(await source(), /Thunder Laser/);
    await page.fill("#lzThickness", "3.2");
    await page.click("#lzResetValues");
    assert.deepEqual((await lzValues(page)).slice(0, 2), ["100", "1,4"]);
    // ta matière : CP peuplier lié au contreplaqué, sans valeur au départ
    await page.click("#lzMatNew");
    await page.click("#lzMatForm [type=submit]");
    assert.match(await page.textContent("#lzMatMsg"), /Donne un nom/);
    await page.fill("#lzMatName", "CP peuplier");
    await page.selectOption("#lzMatMill", "plyPoplar");
    await page.click("#lzMatForm [type=submit]");
    assert.equal(await page.$eval("#lzMaterial option:checked", (o) => o.parentElement.label), "Mes matières");
    assert.match(await source(), /Pas encore de valeur/);
    assert.equal(await page.textContent("#lzEditValues"), "Saisir mes valeurs");
    await page.click("#lzEditValues");
    await page.fill("#lzValPower", "80");
    await page.fill("#lzValSpeed", "2");
    await page.click("#lzValForm [type=submit]");
    assert.deepEqual((await lzValues(page)).slice(0, 3), ["80", "2", "–"]);
    // autre épaisseur : estimation depuis tes valeurs (vitesse × 3,2 / 6)
    await page.fill("#lzThickness", "6");
    assert.match(await source(), /Estimé depuis tes valeurs/);
    assert.deepEqual((await lzValues(page)).slice(0, 2), ["80", "1,1"]);
    // autre machine CO2 : estimation depuis ta 60 W, convertie en mm/s (2 % × 3 550 × 3,2 / 3)
    await addMachine(page, "Chinoise", 60, false);
    await page.fill("#lzThickness", "3");
    assert.match(await source(), /Estimé depuis tes valeurs sur Speedy 360 — 60 W/);
    assert.deepEqual((await lzValues(page)).slice(0, 2), ["80", "75,7"]);
    // grille de test et carnet avec le nom de ta matière
    const [d] = await Promise.all([page.waitForEvent("download"), page.click("[data-grid=svg]")]);
    assert.match(d.suggestedFilename(), /^grille-test-cp-peuplier-chinoise-60-w\.svg$/);
    await page.click("#btnKeepLaser");
    assert.equal(await page.inputValue("#nbMaterial"), "CP peuplier");
    await page.click("#tabLaser");
    // tout est gardé au rechargement, puis suppression en deux clics
    await page.reload();
    await page.waitForSelector("#lzMachine option", { state: "attached" });
    assert.equal(await page.$eval("#lzMaterial option:checked", (o) => o.textContent), "CP peuplier");
    assert.ok(await page.isVisible("#lzMatEdit"));
    await page.click("#lzMatDelete");
    assert.equal(await page.textContent("#lzMatDelete"), "Supprimer ?");
    await page.click("#lzMatDelete");
    assert.match(await page.textContent("#lzMatMsg"), /Matière supprimée/);
    assert.equal(await page.locator("#lzMaterial optgroup").count(), 3);
    // tableau GWK : MDF 5 mm sur la 60 W, 8 mm/s à 90 %, converti en % Trotec
    await page.selectOption("#lzMachine", { label: "Speedy 360 — 60 W" });
    await page.selectOption("#lzMaterial", "gwkMdf");
    await page.fill("#lzThickness", "5");
    assert.deepEqual((await lzValues(page)).slice(0, 2), ["90", "0,23"]);
    assert.match(await source(), /GWK Laser pour un tube de 60 W : 90 % de puissance/);
    assert.ok(await page.isHidden("#lzMatEdit"));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  // pages du PDF : nombre et format de papier lus dans le fichier
  const pdfPages = (bytes) => (bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
  const pdfBox = (bytes) =>
    bytes
      .toString("latin1")
      .match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)
      .slice(1)
      .map(Number);

  for (const units of ["mm", "inch"])
    test(`PDF à imprimer (${units}) : un panneau, ou le plan entier avec son résumé`, async () => {
      const page = await open();
      if (units !== "mm") {
        await page.click("#btnSettings");
        await page.selectOption("#unitsSel", units);
        await page.click("#btnCloseSet");
        await idle(page);
      }
      for (const [selector, pages, name] of [
        ['[data-dl="pdf"][data-s="0"]', 1, "plan-1.pdf"],
        ['[data-dl="pdfall"]', 2, "plan-complet.pdf"]
      ]) {
        const [d] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.click(selector)]);
        const bytes = await readFile(await d.path());
        assert.equal(d.suggestedFilename(), name);
        assert.equal(bytes.subarray(0, 8).toString("latin1"), "%PDF-1.4");
        assert.equal(pdfPages(bytes), pages, `${name} : pages`);
        // A4 en métrique, Letter en impérial (en points)
        const box = pdfBox(bytes);
        if (units === "mm") assert.ok(Math.abs(box[0] - 595.28) < 0.1 && Math.abs(box[1] - 841.89) < 0.1, `${box}`);
        else assert.ok(Math.abs(box[0] - 612) < 0.1 && Math.abs(box[1] - 792) < 0.1, `${box}`);
        assert.match(await page.textContent("#result"), new RegExp(name.replace(".", "\\.")));
      }
      assert.deepEqual(page.errors, []);
      await page.context().close();
    });

  test("chutes devant le format de la matière : stock 1, comptées 0 dans Coût sauf prix saisi ; tout le plan en DXF", async () => {
    const page = await open();
    await page.evaluate(() => {
      localStorage.setItem(
        "nestor.matieres.v1",
        JSON.stringify([{ id: "cp18", name: "CP 18", thickness: 18, L: 1000, W: 600, price: 30 }])
      );
    });
    await page.reload();
    await idle(page);
    await page.selectOption("#nestMaterial", "cp18");
    await page.click("#btnAddPanel");
    await page.fill("#pl0-L", "500");
    await page.fill("#pl0-W", "400");
    await idle(page);
    assert.equal(await page.inputValue("#pl0-q"), "1");
    assert.equal(await page.locator('.pnl[data-i="1"] .pnl-tag').count(), 1);
    // la chute est utilisée d'abord : elle est dans le coût, à 0
    await page.click("#tabCost");
    assert.match(await page.textContent("#costPanels"), /Chute 500 × 400\smm · 1 utilisée\(s\)/);
    assert.equal(await page.getAttribute('#costPanels input[data-size^="c"]', "placeholder"), "0");
    assert.match(await page.textContent("#costPanelsHint"), /chute est comptée 0/);
    const before = await page.textContent("#costResult .big b");
    await page.fill('#costPanels input[data-size^="c"]', "5");
    const after = await page.textContent("#costResult .big b");
    const money = (t) => parseFloat(t.replace(/[^\d,]/g, "").replace(",", "."));
    assert.ok(Math.abs(money(after) - money(before) - 5) < 0.01, `${before} → ${after}`);
    // un DXF par panneau, d'un coup
    await page.click("#tabNest");
    const sheets = await page.locator(".sheet").count();
    const names = [];
    page.on("download", (d) => names.push(d.suggestedFilename()));
    await page.click('[data-dl="dxfall"]');
    await page.waitForFunction(
      (n) => /fichier\(s\) prêt/.test(document.querySelector("#dlmsgall").textContent),
      sheets
    );
    assert.deepEqual(
      names,
      Array.from({ length: sheets }, (_, i) => `plan-${i + 1}.dxf`)
    );
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("ordre des coupes à la scie : méthode Rectangles seulement, numéros, liste, PDF, gardé", async () => {
    const page = await open();
    assert.ok(await page.isHidden("#sawOrderWrap"));
    await page.selectOption("#sMode", "rect");
    await idle(page);
    assert.ok(await page.isVisible("#sawOrderWrap"));
    assert.equal(await page.locator(".saw-list").count(), 0);
    await page.check("#sawOrder");
    const n = await page.locator(".svg-saw").count();
    assert.ok(n >= 8, `${n} coupes`);
    assert.equal(await page.locator(".svg-saw-n").count(), n);
    assert.equal(await page.locator(".saw-list tbody tr").count(), n);
    assert.match(await page.textContent(".saw-list summary"), new RegExp(`Ordre des coupes \\(${n}\\)`));
    const first = await page.$$eval(".saw-list tbody tr:first-child td", (v) => v.map((td) => td.textContent));
    assert.equal(first[0], "1");
    assert.match(first[1], /^(Dans la longueur|En travers)$/);
    assert.match(first[3], /^[\d\s ,.]+ × [\d\s ,.]+$/);
    // épaisseur de lame : vide, elle vaut l'espace entre pièces (2 mm sur l'exemple)
    assert.ok(await page.isVisible("#sawKerf"));
    assert.equal(await page.getAttribute("#sawKerf", "placeholder"), "2");
    assert.match(await page.textContent(".saw-list summary"), /lame de 2 mm/);
    assert.ok(await page.isHidden("#sawKerfWarn"));
    // lame de 3,2 : plus épaisse que l'espace, alerte et bouton pour corriger
    await page.fill("#sawKerf", "3.2");
    assert.match(await page.textContent(".saw-list summary"), /lame de 3,2 mm/);
    assert.ok(await page.isVisible("#sawKerfWarn"));
    assert.match(await page.textContent("#sawKerfWarn"), /plus fin que la lame \(3,2\)/);
    await page.click("#btnGapFromKerf");
    await idle(page);
    assert.equal(await page.inputValue("#sG"), "3.2");
    assert.ok(await page.isHidden("#sawKerfWarn"));
    // les traits de chutes laissent la place aux coupes numérotées
    await page.selectOption("#cutSel", "detail");
    assert.equal(await page.locator(".svg-cut").count(), 0);
    // PDF du panneau : une page de plus pour la liste des coupes
    const [d] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.click('[data-dl="pdf"][data-s="0"]')
    ]);
    const bytes = await readFile(await d.path());
    assert.equal(pdfPages(bytes), 2, `${n} coupes`);
    // gardé au rechargement ; en imbrication selon la forme, rien de tout ça
    await page.reload();
    await idle(page);
    assert.ok(await page.isChecked("#sawOrder"));
    assert.equal(await page.locator(".saw-list").count(), 1);
    assert.equal(await page.inputValue("#sawKerf"), "3.2");
    // premières coupes : en travers ou dans la longueur d'abord, gardé
    const firstDir = () => page.textContent(".saw-list tbody tr:first-child td:nth-child(2)");
    await page.selectOption("#sawFirst", "across");
    assert.equal(await firstDir(), "En travers");
    await page.selectOption("#sawFirst", "along");
    assert.equal(await firstDir(), "Dans la longueur");
    await page.reload();
    await idle(page);
    assert.equal(await page.inputValue("#sawFirst"), "along");
    await page.selectOption("#sMode", "nest");
    await idle(page);
    assert.equal(await page.locator(".saw-list").count(), 0);
    assert.ok(await page.isHidden("#sawOrderWrap"));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("projets : enregistrer, protéger les changements, rouvrir à l'identique, exporter, importer, supprimer", async () => {
    const page = await open();
    // réglages du projet dans plusieurs onglets
    await page.fill("#projName", "Étagère");
    await page.fill("#sG", "12");
    await page.check("#dlNumbers");
    await page.fill('.trow[data-i="0"] [data-k="qty"]', "3");
    await page.click("#tabMill");
    await page.fill("#millDiameter", "8");
    await page.click("#tabLaser");
    await page.selectOption("#lzMaterial", "walnut");
    await page.click("#tabCost");
    await page.fill("#costRate", "55");
    await page.click("#tabNest");
    await idle(page);
    await page.click("#btnProjects");
    await page.click("#projSave");
    await page.waitForFunction(() => document.querySelector("#projMsg").textContent === "Projet enregistré.");
    assert.match(await page.textContent("#projList"), /Étagère.*en cours/);
    await page.click("#btnCloseProj");
    // le projet change : ouvrir demande un second clic
    await page.fill("#projName", "Autre chose");
    await page.fill("#sG", "3");
    await page.uncheck("#dlNumbers");
    await page.click("#tabMill");
    await page.fill("#millDiameter", "3");
    await page.click("#btnProjects");
    assert.match(await page.textContent("#projCurrent"), /non enregistré/);
    await page.click('#projList [data-act="open"]');
    await page.waitForFunction(() =>
      /sans enregistrer/.test(document.querySelector('#projList [data-act="open"]').textContent)
    );
    await page.click('#projList [data-act="open"]');
    await page.waitForFunction(() => /ouvert/.test(document.querySelector("#projMsg").textContent));
    await page.click("#btnCloseProj");
    await page.click("#tabNest");
    await idle(page);
    assert.equal(await page.inputValue("#projName"), "Étagère");
    assert.equal(await page.inputValue("#sG"), "12");
    assert.equal(await page.isChecked("#dlNumbers"), true);
    assert.equal(await page.inputValue('.trow[data-i="0"] [data-k="qty"]'), "3");
    await page.click("#tabMill");
    assert.equal(await page.inputValue("#millDiameter"), "8");
    await page.click("#tabLaser");
    assert.equal(await page.inputValue("#lzMaterial"), "walnut");
    await page.click("#tabCost");
    assert.equal(await page.inputValue("#costRate"), "55");
    // fichier à partager, puis réimporté : deux projets dans la liste
    await page.click("#btnProjects");
    const [d] = await Promise.all([page.waitForEvent("download"), page.click("#projExport")]);
    assert.equal(d.suggestedFilename(), "etagere.nestor");
    await page.setInputFiles("#projFile", await d.path());
    await page.waitForFunction(() => /importé et ouvert/.test(document.querySelector("#projMsg").textContent));
    await page.waitForFunction(() => document.querySelectorAll(".proj-row").length === 2);
    // fichier qui n'est pas un projet : refusé sans rien casser
    const bad = join(await mkdtemp(join(tmpdir(), "nestor-")), "faux.nestor");
    await writeFile(bad, '{"app":"Autre"}');
    await page.setInputFiles("#projFile", bad);
    await page.waitForFunction(() => /pas un projet Nestor/.test(document.querySelector("#projMsg").textContent));
    // suppression en deux clics
    await page.click('.proj-row:last-child [data-act="delete"]');
    await page.waitForFunction(() =>
      document.querySelector(".proj-row:last-child [data-act=delete]").classList.contains("confirm")
    );
    await page.click('.proj-row:last-child [data-act="delete"]');
    await page.waitForFunction(() => document.querySelectorAll(".proj-row").length === 1);
    // gardé après rechargement ; nouveau projet : l'exemple, panneaux gardés
    await page.reload();
    // le dernier onglet ouvert est gardé (Coût) : le panneau est dessiné mais caché
    await page.waitForSelector(".sheet", { state: "attached" });
    await page.click("#btnProjects");
    await page.waitForFunction(() => document.querySelectorAll(".proj-row").length === 1);
    await page.click("#projNew");
    await page.waitForFunction(() => /Nouveau projet\./.test(document.querySelector("#projMsg").textContent));
    await page.click("#btnCloseProj");
    assert.equal(await page.inputValue("#projName"), "");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  // en-tête : le logo n'est jamais recouvert par les boutons, du téléphone à l'ordinateur, même en allemand
  for (const [width, locale] of [
    [320, "fr-FR"],
    [390, "de-DE"],
    [640, "fr-FR"],
    [700, "fr-FR"],
    [1280, "fr-FR"]
  ])
    test(`en-tête à ${width} px (${locale}) : logo entier, boutons à côté ou dessous sans le recouvrir`, async () => {
      const page = await open({ viewport: { width, height: 800 }, locale });
      const logo = await page.locator("header.top .wordmark").boundingBox();
      for (const button of ["#btnProjects", "#btnSettings"]) {
        const b = await page.locator(button).boundingBox();
        const apart =
          b.x >= logo.x + logo.width ||
          b.x + b.width <= logo.x ||
          b.y >= logo.y + logo.height ||
          b.y + b.height <= logo.y;
        assert.ok(apart, `${button} recouvre le logo`);
        assert.ok(b.x >= 0 && b.x + b.width <= width, `${button} sort de l'écran`);
      }
      assert.ok(logo.x >= 0 && logo.x + logo.width <= width, "logo coupé");
      await page.context().close();
    });

  test("raccourcis : onglets, aide, enregistrer, ouvrir ; rien pendant la saisie", async () => {
    const page = await open();
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("Alt+Digit3");
    assert.equal(await page.getAttribute("#tabLaser", "aria-selected"), "true");
    // ordre des onglets : Imbrication, Fraisage, Laser, Matières, Carnet, Coût ; Alt+4 = Matières, Alt+6 = Coût
    assert.deepEqual(await page.$$eval('.tabs [role="tab"]', (v) => v.map((t) => t.id)), [
      "tabNest",
      "tabMill",
      "tabLaser",
      "tabMaterials",
      "tabNotebook",
      "tabCost"
    ]);
    await page.keyboard.press("Alt+Digit4");
    assert.equal(await page.getAttribute("#tabMaterials", "aria-selected"), "true");
    await page.keyboard.press("Alt+Digit6");
    assert.equal(await page.getAttribute("#tabCost", "aria-selected"), "true");
    await page.keyboard.press("Alt+Digit1");
    assert.equal(await page.getAttribute("#tabNest", "aria-selected"), "true");
    // « ? » : aide ; Échap la ferme
    await page.keyboard.type("?");
    assert.equal(await page.isVisible("#shortcuts"), true);
    assert.equal(await page.locator("#scTable tr").count(), 8);
    await page.keyboard.press("Escape");
    assert.equal(await page.isVisible("#shortcuts"), false);
    // pendant la saisie, « ? » s'écrit dans le champ
    await page.click("#projName");
    await page.keyboard.type("?");
    assert.equal(await page.inputValue("#projName"), "?");
    assert.equal(await page.isVisible("#shortcuts"), false);
    // Ctrl+S marche même dans un champ : la fenêtre Projets s'ouvre et montre l'enregistrement
    await page.keyboard.press("Control+s");
    await page.waitForFunction(() => document.querySelector("#projMsg").textContent === "Projet enregistré.");
    // la liste se recharge juste après le message : on attend la ligne du projet
    await page.waitForSelector(".proj-row", { timeout: 10000 });
    assert.equal(await page.locator(".proj-row").count(), 1);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+o");
    assert.equal(await page.isVisible("#projects"), true);
    await page.keyboard.press("Escape");
    // depuis les Réglages aussi
    await page.click("#btnSettings");
    await page.click("#btnShortcuts");
    assert.equal(await page.isVisible("#shortcuts"), true);
    assert.equal(await page.isVisible("#settings"), false);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("rotation « Libre (1°) » en plus de « Libre (5°) », pour toutes les pièces ou une seule", async () => {
    const page = await open();
    await idle(page);
    assert.deepEqual(await page.$$eval("#rotAll option", (o) => o.map((x) => x.value)), [
      "fix",
      "quarter",
      "free",
      "free1"
    ]);
    assert.equal(await page.textContent('#rotAll option[value="free1"]'), "Libre (1°)");
    await page.selectOption("#rotAll", "free1");
    await idle(page);
    const rots = await page.$$eval('[data-k="rot"]', (s) => s.map((x) => x.value));
    assert.ok(rots.length > 0 && rots.every((v) => v === "free1"), rots.join());
    await page.selectOption('[data-k="rot"] >> nth=0', "free");
    await idle(page);
    assert.equal(await page.inputValue("#rotAll"), "mixed");
    assert.ok((await page.locator(".sheet .svgbox svg").count()) > 0);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("sens fixe : ↺ ↻ pivotent la pièce d'un quart de tour, seulement en sens fixe", async () => {
    const page = await open();
    await idle(page);
    const row = page.locator(".trow").first();
    await row.locator('[data-k="rot"]').selectOption("quarter");
    assert.equal(await row.locator(".turn").isVisible(), false);
    await row.locator('[data-k="rot"]').selectOption("fix");
    assert.equal(await row.locator(".turn").isVisible(), true);
    const size = async () => [
      await page.locator('.trow >> nth=0 >> [data-k="sw"]').inputValue(),
      await page.locator('.trow >> nth=0 >> [data-k="sh"]').inputValue()
    ];
    const [w, h] = await size();
    await row.locator('[data-act="turnR"]').click();
    await idle(page);
    assert.deepEqual(await size(), [h, w]);
    assert.equal(await page.textContent(".trow >> nth=0 >> .turn-a"), "90°");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.act), "turnR");
    await page.keyboard.press("Enter");
    await idle(page);
    assert.equal(await page.textContent(".trow >> nth=0 >> .turn-a"), "180°");
    assert.deepEqual(await size(), [w, h]);
    await page.click('.trow >> nth=0 >> [data-act="turnL"]');
    await page.click('.trow >> nth=0 >> [data-act="turnL"]');
    await idle(page);
    assert.equal(await page.locator(".trow >> nth=0 >> .turn-a").count(), 0);
    assert.match(
      await page.getAttribute('.trow >> nth=0 >> [data-act="turnL"]', "aria-label"),
      /^Pivoter « .+ » d’un quart de tour à gauche$/
    );
    assert.ok((await page.locator(".sheet .svgbox svg").count()) > 0);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("groupes nommés : chaque groupe remplit son panneau avec des groupes entiers, dans l'ordre", async () => {
    const page = await open();
    await idle(page);
    assert.equal(await page.isVisible("#kitBox"), false);
    // « + Nouveau kit » depuis une pièce : le kit est créé, la pièce y entre, le curseur va sur son nom
    await page.fill('.trow[data-i="0"] [data-k="qty"]', "1");
    await page.selectOption('.trow[data-i="0"] [data-k="kit"]', "+");
    assert.equal(await page.isVisible("#kitBox"), true);
    assert.equal(await page.evaluate(() => document.activeElement.className), "kit-name");
    await page.keyboard.type("Boîte");
    assert.deepEqual(await page.$$eval('.trow[data-i="1"] [data-k="kit"] option', (o) => o.map((x) => x.textContent)), [
      "Aucun groupe",
      "Boîte",
      "+ Nouveau groupe"
    ]);
    await page.selectOption('.trow[data-i="1"] [data-k="kit"]', "k1");
    await idle(page);
    // pièce d'un kit : « Qté / kit », pas de choix « Remplir » à elle, quantité intacte
    assert.equal(await page.textContent('.trow[data-i="1"] .qlbl'), "Qté / groupe");
    assert.equal(await page.isVisible('.trow[data-i="1"] [data-fp="mode"]'), false);
    assert.equal(await page.inputValue('.trow[data-i="1"] [data-k="qty"]'), "2");
    assert.equal(await page.textContent('[data-kit="k1"] .kit-count'), "3 pièces par groupe");
    assert.equal(await page.textContent('[data-kit="k1"] .kit-info'), "");
    // remplir au maximum le dernier panneau avec des Boîtes
    await chooseFill(page, '[data-kit="k1"]', "0:last");
    await idle(page);
    const info = await page.textContent('[data-kit="k1"] .kit-info');
    const m = info.match(/^Groupes complets : (\d+) \((\d+) pièces\)$/);
    assert.ok(m, info);
    const n = +m[1];
    assert.ok(n >= 2, info);
    assert.equal(+m[2], n * 3);
    // second kit « Étagère » (la pièce 2) sur un nouveau panneau
    await page.click("#btnNewKit");
    await page.keyboard.type("Étagère");
    await page.selectOption('.trow[data-i="2"] [data-k="kit"]', "k2");
    await chooseFill(page, '[data-kit="k2"]', "0:new");
    await idle(page);
    const counts = await page.evaluate(async () => {
      const { session } = await import("/src/session.js");
      const c = {};
      for (const s of session.lastResult.sheets) for (const p of s.parts) c[p.i] = (c[p.i] || 0) + 1;
      return { c, kits: session.lastResult.kits };
    });
    assert.equal(counts.kits.k1, n, "la Boîte garde son nombre de kits");
    assert.ok(counts.kits.k2 >= 1);
    assert.equal(counts.c[0], n);
    assert.equal(counts.c[1], 2 * n);
    assert.equal(counts.c[2], 4 * counts.kits.k2, "que des Étagères entières");
    // projet enregistré puis rouvert : les deux kits reviennent
    await page.click("#btnProjects");
    await page.click("#projSave");
    await page.waitForFunction(() => document.querySelector("#projMsg").textContent === "Projet enregistré.");
    await page.click("#btnCloseProj");
    await page.reload();
    await idle(page);
    await page.click("#btnProjects");
    await page.click('#projList [data-act="open"]');
    await page.waitForFunction(() => /ouvert/.test(document.querySelector("#projMsg").textContent));
    await page.click("#btnCloseProj");
    await idle(page);
    assert.deepEqual(await page.$$eval("#kitList .kit-name", (i) => i.map((x) => x.value)), ["Boîte", "Étagère"]);
    assert.equal(await fillValue(page, '[data-kit="k2"]'), "0:new");
    assert.equal(await page.inputValue('.trow[data-i="1"] [data-k="kit"]'), "k1");
    // supprimer la Boîte : ses pièces redeviennent seules, l'Étagère reste
    await page.click('[data-kit="k1"] [data-kit-del]');
    await idle(page);
    assert.equal(await page.inputValue('.trow[data-i="0"] [data-k="kit"]'), "");
    assert.equal(await page.textContent('.trow[data-i="0"] .qlbl'), "Qté");
    assert.deepEqual(await page.$$eval("#kitList .kit-name", (i) => i.map((x) => x.value)), ["Étagère"]);
    await page.click('[data-kit="k2"] [data-kit-del]');
    await idle(page);
    assert.equal(await page.isVisible("#kitBox"), false);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("groupes : « Nombre de groupes » pose le nombre demandé, manque de place, nombre invalide, projet", async () => {
    const page = await open();
    await idle(page);
    const placed = () =>
      page.evaluate(async () => {
        const { session } = await import("/src/session.js");
        const c = {};
        for (const s of session.lastResult.sheets) for (const p of s.parts) c[p.i] = (c[p.i] || 0) + 1;
        return { c, kits: session.lastResult.kits, unplaced: session.lastResult.unplaced.length };
      });
    // kit « Boîte » : pièce 0 (1 par kit) et pièce 1 (2 par kit)
    await page.fill('.trow[data-i="0"] [data-k="qty"]', "1");
    await page.selectOption('.trow[data-i="0"] [data-k="kit"]', "+");
    await page.keyboard.type("Boîte");
    await page.selectOption('.trow[data-i="1"] [data-k="kit"]', "k1");
    await idle(page);
    // trois choix, dans l'ordre ; la case du nombre n'apparaît qu'avec « Nombre de kits »
    assert.deepEqual(await page.$$eval('[data-kit="k1"] [data-fp="mode"] option', (o) => o.map((x) => x.textContent)), [
      "Un seul groupe",
      "Nombre de groupes",
      "Remplir au maximum"
    ]);
    assert.equal(await page.isVisible('[data-kit="k1"] [data-fp="count"]'), false);
    assert.equal((await placed()).c[1], 2, "un seul kit : la quantité par kit");
    await page.selectOption('[data-kit="k1"] [data-fp="mode"]', "n");
    assert.equal(await page.isVisible('[data-kit="k1"] [data-fp="count"]'), true);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.fp), "count");
    assert.equal(await page.inputValue('[data-kit="k1"] [data-fp="count"]'), "2", "2 kits proposés d'abord");
    assert.equal(
      await page.getAttribute('[data-kit="k1"] [data-fp="count"]', "aria-label"),
      "Nombre de groupes « Boîte »"
    );
    await page.fill('[data-kit="k1"] [data-fp="count"]', "7");
    await idle(page);
    let r = await placed();
    assert.equal(r.c[0], 7);
    assert.equal(r.c[1], 14);
    assert.equal(r.kits.k1, 7);
    assert.equal(await page.textContent('[data-kit="k1"] .kit-info'), "7 groupes · 21 pièces");
    // la quantité par kit reste celle de la pièce ; le résumé du bloc Pièces compte les exemplaires
    assert.equal(await page.inputValue('.trow[data-i="1"] [data-k="qty"]'), "2");
    // une seule plaque en stock : pas assez de place, le nombre de kits complets et les pièces en rouge
    await page.fill("#pl0-q", "1");
    await page.fill('[data-kit="k1"] [data-fp="count"]', "400");
    await idle(page);
    r = await placed();
    assert.ok(r.unplaced > 0);
    assert.ok(r.kits.k1 < 400);
    assert.equal(r.kits.k1, Math.min(r.c[0] || 0, Math.floor((r.c[1] || 0) / 2)));
    assert.equal(
      await page.textContent('[data-kit="k1"] .kit-info'),
      "Groupes complets : " + r.kits.k1 + " sur 400 (pas assez de place)"
    );
    await page.waitForSelector(".trow.unplaced .unfit");
    assert.match(
      await page.textContent('.trow[data-i="1"] .unfit'),
      / sur 800 non placée\(s\) : pas assez de panneaux/
    );
    await page.fill("#pl0-q", "");
    // nombre vide, nul ou trop grand : remis au propre en quittant la case
    for (const [typed, kept] of [
      ["0", "1"],
      ["-3", "1"],
      ["999999", "5000"],
      ["2.7", "2"]
    ]) {
      await page.fill('[data-kit="k1"] [data-fp="count"]', typed);
      await page.press('[data-kit="k1"] [data-fp="count"]', "Tab");
      assert.equal(await page.inputValue('[data-kit="k1"] [data-fp="count"]'), kept, typed);
    }
    await page.fill('[data-kit="k1"] [data-fp="count"]', "");
    await page.press('[data-kit="k1"] [data-fp="count"]', "Tab");
    assert.equal(await page.inputValue('[data-kit="k1"] [data-fp="count"]'), "1");
    await page.fill('[data-kit="k1"] [data-fp="count"]', "3");
    await page.press('[data-kit="k1"] [data-fp="count"]', "Tab");
    await idle(page);
    // projet enregistré puis rouvert : « Nombre de kits » et 3 reviennent
    await page.click("#btnProjects");
    await page.click("#projSave");
    await page.waitForFunction(() => document.querySelector("#projMsg").textContent === "Projet enregistré.");
    await page.click("#btnCloseProj");
    await page.reload();
    await idle(page);
    await page.click("#btnProjects");
    await page.click('#projList [data-act="open"]');
    await page.waitForFunction(() => /ouvert/.test(document.querySelector("#projMsg").textContent));
    await page.click("#btnCloseProj");
    await idle(page);
    assert.equal(await page.inputValue('[data-kit="k1"] [data-fp="mode"]'), "n");
    assert.equal(await page.inputValue('[data-kit="k1"] [data-fp="count"]'), "3");
    assert.equal((await placed()).c[1], 6);
    // retour à « Un seul kit » : la case disparaît, la quantité redevient celle d'un kit
    await page.selectOption('[data-kit="k1"] [data-fp="mode"]', "");
    await idle(page);
    assert.equal(await page.isVisible('[data-kit="k1"] [data-fp="count"]'), false);
    assert.equal((await placed()).c[1], 2);
    assert.equal(await page.textContent('[data-kit="k1"] .kit-info'), "");
    // retour à « Nombre de kits » : le nombre d'avant est repris
    await page.selectOption('[data-kit="k1"] [data-fp="mode"]', "n");
    assert.equal(await page.inputValue('[data-kit="k1"] [data-fp="count"]'), "3");
    await idle(page);
    assert.equal((await placed()).c[1], 6);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("blocs repliables : flèche ou titre, résumé, gardé au rechargement, Alt + clic pour tout l'onglet", async () => {
    const page = await open();
    await idle(page);
    const panelBox = 'section[aria-labelledby="h-panel"]';
    assert.equal(await page.getAttribute(panelBox + " .fold-btn", "aria-expanded"), "true");
    await page.click("#h-panel");
    assert.equal(await page.getAttribute(panelBox + " .fold-btn", "aria-expanded"), "false");
    assert.equal(await page.isVisible("#panels"), false);
    assert.match(await page.textContent(panelBox + " .fold-sum"), /^1 ligne\(s\) · .+ · espace \d+ · marge \d+$/);
    assert.equal(await page.getAttribute(panelBox + " .fold-btn", "aria-label"), "Déplier « Panneaux (mm) »");
    // le résumé suit les réglages
    await page.click(panelBox + " .fold-btn");
    await page.fill("#sG", "7");
    await page.click(panelBox + " .fold-btn");
    await idle(page);
    assert.match(await page.textContent(panelBox + " .fold-sum"), /espace 7/);
    await page.reload();
    await idle(page);
    assert.equal(await page.getAttribute(panelBox + " .fold-btn", "aria-expanded"), "false");
    // Alt + clic : tous les blocs de l'onglet, et pas ceux des autres onglets
    await page.click("#h-pieces", { modifiers: ["Alt"] });
    const nest = await page.$$eval("#pageNest section.box", (b) => b.map((x) => x.classList.contains("folded")));
    assert.ok(nest.every(Boolean), nest.join());
    assert.equal(await page.locator("#pageMill section.box.folded").count(), 0);
    await page.click("#h-pieces", { modifiers: ["Alt"] });
    assert.equal(await page.locator("#pageNest section.box.folded").count(), 0);
    // au clavier : la flèche est un bouton
    await page.focus(panelBox + " .fold-btn");
    await page.keyboard.press("Enter");
    assert.equal(await page.getAttribute(panelBox + " .fold-btn", "aria-expanded"), "false");
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  test("guide : catégories, recherche, « ? » des blocs et « Me montrer »", async () => {
    const page = await open();
    await page.click("#btnGuide");
    assert.equal(await page.isVisible("#guide"), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "guideSearch");
    assert.deepEqual(await page.$$eval(".guide-cat", (h) => h.map((x) => x.textContent)), [
      "Démarrer",
      "Imbrication",
      "Machines",
      "Projet"
    ]);
    assert.equal(await page.locator(".guide-item").count(), 16);
    assert.equal(await page.textContent("#guideTopicTitle"), "Premier plan en 2 minutes");
    assert.equal(await page.locator(".guide-steps li").count(), 4);
    // « Suivant » passe à la fiche d'après
    assert.match(await page.textContent(".guide-kicker"), /1 \/ 16/);
    assert.equal(await page.locator('[data-pager="prev"]').count(), 0);
    await page.click('[data-pager="next"]');
    assert.equal(await page.textContent("#guideTopicTitle"), "Tes données");
    assert.match(await page.textContent(".guide-kicker"), /2 \/ 16/);
    assert.equal(await page.getAttribute('[data-pager="prev"]', "aria-label"), "Précédent : Premier plan en 2 minutes");
    assert.equal(await page.getAttribute('[data-pager="next"]', "aria-label"), "Suivant : Importer des pièces");
    // flèches du clavier : fiche suivante / précédente, mais pas pendant la saisie dans la recherche
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.textContent("#guideTopicTitle"), "Importer des pièces");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.textContent("#guideTopicTitle"), "Premier plan en 2 minutes");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.textContent("#guideTopicTitle"), "Premier plan en 2 minutes");
    await page.click('[data-topic="folder"]');
    assert.equal(await page.locator('[data-pager="next"]').count(), 0);
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.textContent("#guideTopicTitle"), "Projets sur ta clé ou ton cloud");
    await page.click('[data-pager="prev"]');
    assert.equal(await page.textContent("#guideTopicTitle"), "Projets");
    await page.click('[data-pager="prev"]');
    assert.equal(await page.textContent("#guideTopicTitle"), "Coût du plan");
    await page.focus("#guideSearch");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.textContent("#guideTopicTitle"), "Coût du plan");
    await page.click('[data-topic="import"]');
    assert.equal(await page.getAttribute('[data-topic="import"]', "aria-current"), "page");
    // recherche sans accents ni majuscules, dans tout le texte des fiches
    await page.fill("#guideSearch", "FIGE");
    assert.deepEqual(await page.$$eval(".guide-item", (b) => b.map((x) => x.textContent.trim())), [
      "Cadenas et remplir",
      "Groupes : des objets entiers"
    ]);
    await page.fill("#guideSearch", "zzz");
    assert.equal(await page.locator(".guide-item").count(), 0);
    assert.match(await page.textContent("#guideNav"), /Aucune fiche ne parle de « zzz »/);
    await page.fill("#guideSearch", "");
    assert.equal(await page.locator(".guide-item").count(), 16);
    // Échap ferme et rend le focus au bouton Guide
    await page.keyboard.press("Escape");
    assert.equal(await page.isVisible("#guide"), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), "btnGuide");
    // « ? » d'un bloc : sa fiche
    await page.click('[data-guide="panels"]');
    assert.equal(await page.textContent("#guideTopicTitle"), "Panneaux et chutes");
    assert.equal(await page.getAttribute('[data-guide="panels"]', "aria-label"), "Aide : Panneaux et chutes");
    // « Me montrer dans l'appli » : ferme, revient sur Imbrication et désigne le bloc
    await page.keyboard.press("Escape");
    await page.click("#tabCost");
    await page.click("#btnGuide");
    await page.click('[data-topic="panels"]');
    await page.click('[data-show="panels"]');
    assert.equal(await page.isVisible("#guide"), false);
    assert.equal(await page.getAttribute("#tabNest", "aria-selected"), "true");
    assert.equal(await page.locator("#panelRows.guide-flash").count(), 1);
    assert.equal(await page.evaluate(() => !!document.activeElement.closest("#panelRows")), true);
    // « ? » d'un autre onglet, et une fiche qui désigne un bouton du haut sans changer d'onglet
    await page.click("#tabLaser");
    await page.click('[data-guide="laser"]');
    assert.equal(await page.textContent("#guideTopicTitle"), "Réglages laser");
    await page.click('[data-topic="projects"]');
    await page.click('[data-show="projects"]');
    assert.equal(await page.getAttribute("#tabLaser", "aria-selected"), "true");
    assert.equal(await page.evaluate(() => document.activeElement.id), "btnProjects");
    // chaque fiche a son texte dans la langue (pas de clé brute affichée)
    await page.click("#btnGuide");
    for (const id of await page.$$eval(".guide-item", (b) => b.map((x) => x.dataset.topic))) {
      await page.click(`[data-topic="${id}"]`);
      assert.doesNotMatch(await page.textContent("#guideTopic"), /guide\./);
      assert.equal(await page.locator(".guide-steps li").count(), 4);
    }
    await page.keyboard.press("Escape");
    // téléphone : la liste, puis la fiche avec un retour
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click("#btnGuide");
    assert.equal(await page.isVisible("#guideTopic"), false);
    await page.click('[data-topic="lock"]');
    assert.equal(await page.isVisible("#guideNav"), false);
    assert.equal(await page.isVisible("#guideBack"), true);
    await page.click("#guideBack");
    assert.equal(await page.isVisible("#guideNav"), true);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
});

// Dossier factice en mémoire à la place de la fenêtre « Choisir un dossier » du système (clé USB, cloud…).
// window.__folder.denied : autorisation à redonner ; window.__folder.lost : dossier introuvable (clé débranchée).
function fakeFolderPicker() {
  const files = new Map();
  let clock = Date.UTC(2026, 10, 23, 10);
  const folder = { denied: false, lost: false, files };
  const handle = {
    kind: "directory",
    name: "CLE-USB",
    queryPermission: async () => (folder.denied ? "prompt" : "granted"),
    requestPermission: async () => {
      folder.denied = false;
      return "granted";
    },
    async *values() {
      if (folder.lost) throw new DOMException("introuvable", "NotFoundError");
      for (const [name, f] of files) yield { kind: "file", name, getFile: async () => f };
      yield { kind: "file", name: "photo.jpg", getFile: async () => new File(["x"], "photo.jpg") };
      yield { kind: "directory", name: "Archives" };
    },
    async getFileHandle(name, opts) {
      if (folder.lost) throw new DOMException("introuvable", "NotFoundError");
      if (!files.has(name) && !(opts && opts.create)) throw new DOMException("absent", "NotFoundError");
      return {
        getFile: async () => files.get(name),
        createWritable: async () => {
          let text = "";
          return {
            write: async (t) => {
              text += t;
            },
            close: async () => {
              files.set(name, new File([text], name, { lastModified: (clock += 60000) }));
            }
          };
        }
      };
    }
  };
  window.__folder = folder;
  window.showDirectoryPicker = async () => handle;
}

// attend que le texte d'un élément corresponde (la fenêtre Projets se redessine après des lectures asynchrones)
async function waitText(page, selector, re) {
  await page.waitForFunction(
    ([sel, src, flags]) => new RegExp(src, flags).test(document.querySelector(sel)?.textContent || ""),
    [selector, re.source, re.flags]
  );
}

test("projets dans un dossier : choisir, enregistrer, rouvrir, copie, clé débranchée, autorisation", async () => {
  const page = await open();
  await page.addInitScript(fakeFolderPicker);
  await page.reload();
  await page.waitForSelector(".sheet");
  await idle(page);
  await page.fill("#projName", "Boîte / à vin");
  await page.click("#btnProjects");
  // aucun dossier encore : on reste sur « Ce navigateur », l'onglet « Mon dossier » invite à en choisir un
  await page.waitForSelector('#projTabBrowser[aria-selected="true"]');
  await page.click("#projTabFolder");
  await waitText(page, "#projFolderList", /Choisis le dossier/);
  await page.waitForSelector("#projForget", { state: "hidden" });
  await page.click("#projPick");
  await page.waitForFunction(() => /CLE-USB/.test(document.querySelector("#projTabFolder").textContent));
  await waitText(page, "#projFolderList", /Pas encore de projet/);
  await waitText(page, "#projPick", /^Changer de dossier$/);
  // Enregistrer écrit « Boîte à vin.nestor » (caractère interdit retiré) dans le dossier, pas dans le navigateur
  await page.click("#projSave");
  await page.waitForFunction(() => /Enregistré dans « CLE-USB »/.test(document.querySelector("#projMsg").textContent));
  await waitText(page, "#projMsg", /Boîte à vin\.nestor/);
  assert.deepEqual(await page.evaluate(() => [...window.__folder.files.keys()]), ["Boîte à vin.nestor"]);
  await waitText(page, "#projFolderList", /Boîte à vin.*en cours/);
  await page.click("#projTabBrowser");
  await waitText(page, "#projList", /Aucun projet/);
  await page.click("#projTabFolder");
  // seuls les .nestor sont listés (ni la photo, ni le sous-dossier)
  await page.waitForFunction(() => document.querySelectorAll("#projFolderList .proj-row").length === 1);
  // Enregistrer à nouveau remplace le même fichier ; une copie prend un nom libre
  await page.click("#projSave");
  await page.waitForFunction(() => /Enregistré/.test(document.querySelector("#projMsg").textContent));
  await page.click("#projSaveCopy");
  await page.waitForFunction(() => window.__folder.files.size === 2);
  assert.deepEqual(await page.evaluate(() => [...window.__folder.files.keys()].sort()), [
    "Boîte à vin (2).nestor",
    "Boîte à vin.nestor"
  ]);
  // plus récent d'abord ; la copie est le projet en cours
  await waitText(page, "#projFolderList .proj-row", /Boîte à vin \(2\).*en cours/);
  await page.click("#btnCloseProj");
  // Ctrl+S enregistre aussi dans le dossier
  await page.fill('.trow[data-i="0"] [data-k="qty"]', "7");
  await page.keyboard.press("Control+s");
  await page.waitForFunction(async () =>
    /"qty":\s*7/.test(await window.__folder.files.get("Boîte à vin (2).nestor").text())
  );
  // la fenêtre Projets s'est ouverte pour le montrer ; rouvrir l'original : rien de changé → un seul clic
  assert.equal(await page.isVisible("#projects"), true);
  const original = page.locator('#projFolderList .proj-row[data-file="Boîte à vin.nestor"] [data-act="openFile"]');
  await original.click();
  await page.waitForFunction(() => /ouvert/.test(document.querySelector("#projMsg").textContent));
  assert.notEqual(await page.inputValue('.trow[data-i="0"] [data-k="qty"]'), "7");
  await waitText(page, "#projFolderList", /Boîte à vin.*en cours/);
  // projet modifié : ouvrir demande un second clic
  await page.click("#btnCloseProj");
  await page.fill("#projName", "Changé");
  await page.click("#btnProjects");
  const copy = page.locator('#projFolderList .proj-row[data-file="Boîte à vin (2).nestor"] [data-act="openFile"]');
  await copy.click();
  await page.waitForFunction(() => /sans enregistrer/.test(document.querySelector("#projFolderList").textContent));
  await copy.click();
  await page.waitForFunction(() => document.querySelector("#projName").value === "Boîte / à vin");
  // autorisation à redonner (nouvelle visite) : un bouton la demande, puis la liste revient
  await page.evaluate(() => (window.__folder.denied = true));
  await page.click("#projTabBrowser");
  await page.click("#projTabFolder");
  await page.click('#projFolderList [data-act="allow"]');
  await page.waitForFunction(() => document.querySelectorAll("#projFolderList .proj-row").length === 2);
  // clé débranchée : message clair, Enregistrer échoue sans rien casser
  await page.evaluate(() => (window.__folder.lost = true));
  await page.click("#projTabBrowser");
  await page.click("#projTabFolder");
  await waitText(page, "#projFolderList", /introuvable \(clé débranchée/);
  await page.click("#projSave");
  await page.waitForFunction(() => /n’a pas pu être lu ou écrit/.test(document.querySelector("#projMsg").textContent));
  // l'endroit choisi est gardé : à la réouverture, « Ce navigateur » reste affiché s'il était le dernier
  await page.click("#projTabBrowser");
  await page.click("#btnCloseProj");
  await page.click("#btnProjects");
  await page.waitForSelector('#projTabBrowser[aria-selected="true"]');
  // flèches entre les onglets
  await page.focus("#projTabBrowser");
  await page.keyboard.press("ArrowLeft");
  await page.waitForSelector('#projTabFolder[aria-selected="true"]');
  // Oublier ce dossier
  await page.evaluate(() => (window.__folder.lost = false));
  await page.click("#projForget");
  await page.waitForFunction(() => /Choisis le dossier/.test(document.querySelector("#projFolderList").textContent));
  await waitText(page, "#projFolderLbl", /^Mon dossier$/);
  // Enregistrer sur « Mon dossier » sans dossier : la fenêtre de choix s'ouvre, puis le fichier est écrit
  await page.evaluate(() => window.__folder.files.clear());
  await page.click("#projSave");
  await page.waitForFunction(() => window.__folder.files.size === 1);
  await waitText(page, "#projTabFolder", /CLE-USB/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("projets dans un dossier : navigateur sans choix de dossier (Safari, Firefox) → Exporter / Importer", async () => {
  const page = await open();
  await page.addInitScript(() => delete window.showDirectoryPicker);
  await page.reload();
  await page.waitForSelector(".sheet");
  await idle(page);
  await page.click("#btnProjects");
  await page.waitForSelector('#projTabBrowser[aria-selected="true"]');
  await page.click("#projTabFolder");
  await waitText(page, "#projFolderHint", /ne permet pas de choisir un dossier/);
  await page.waitForSelector("#projPick", { state: "hidden" });
  // Enregistrer va toujours dans le navigateur
  await page.click("#projSave");
  await page.waitForFunction(() => document.querySelector("#projMsg").textContent === "Projet enregistré.");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
