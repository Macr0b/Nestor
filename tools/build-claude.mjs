/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Fabrique la version Claude de Nestor : une seule page HTML autonome, à partir des fichiers de l'appli installable.
   Usage : npm run build:claude [-- chemin/de/sortie.html]   (par défaut : dist/nestor-claude.html)
   Différences avec l'appli installable :
     - polices chargées depuis Google Fonts (le lecteur Claude n'a pas les fichiers locaux) ;
     - thème clair/sombre qui suit le choix du lecteur Claude ;
     - téléchargements par Claude, pas d'installation ni de service worker, lecteur PDF chargé en ligne. */
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || join(ROOT, "dist", "nestor-claude.html");

const html = await readFile(join(ROOT, "index.html"), "utf8");

/** Extrait un morceau de la page ou des styles ; s'arrête avec un message clair s'ils ont changé de forme. */
function extract(pattern, what, text = html) {
  const m = text.match(pattern);
  if (!m) throw new Error(`index.html : ${what} introuvable, adapter tools/build-claude.mjs`);
  return m;
}

// styles : sans les polices locales, marges gérées par Claude
// feuilles de style de la page, dans l'ordre, sauf les polices locales
const sheets = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)">/g)].map((m) => m[1]);
if (!sheets.length) throw new Error("index.html : aucune feuille de style trouvée, adapter tools/build-claude.mjs");
let style = "";
for (const sheet of sheets)
  if (!sheet.endsWith("fonts.css")) style += (await readFile(join(ROOT, sheet), "utf8")) + "\n";
// le thème sombre suit l'attribut data-theme, posé par src/ui/theme-early.js (repris plus bas) ou par le lecteur Claude
extract(/:root\[data-theme="dark"\] \{/, "thème sombre", style);
style = style.replace(
  extract(
    /padding-top: ?calc\(24px \+ env\(safe-area-inset-top, ?0px\)\);\s*padding-bottom: ?calc\(40px \+ env\(safe-area-inset-bottom, ?0px\)\)/,
    "marges de la page",
    style
  )[0],
  "padding-block: 28px 40px"
);

// corps de la page, sans les scripts de l'appli installable (ils sont réunis plus bas)
const body = extract(
  /<body>([\s\S]*?)<script type="module" src="src\/main\.js"><\/script>/,
  "début du corps et scripts"
)[1];

// hôte Claude : téléchargement par Claude, pas d'installation, lecteur PDF en ligne
const host = `
window.APP_HOST = (function () {
  "use strict";
  var c = window.claude,
    hasClaude = !!(c && typeof c.use === "function");
  return {
    noInstall: true,
    pdfBase: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/legacy/build/",
    save: async function (filename, blob) {
      var downloads = hasClaude ? await c.use("downloads") : null;
      if (!downloads) throw new Error("unavailable");
      try {
        await downloads.save({ filename: filename, data: blob });
        return "saved";
      } catch (e) {
        if (e && e.code === "declined") {
          var abort = new Error("declined");
          abort.name = "AbortError";
          throw abort;
        }
        throw e;
      }
    }
  };
})();
`;

// tous les modules de l'appli réunis en un seul script
const bundle = await build({
  entryPoints: [join(ROOT, "src", "main.js")],
  bundle: true,
  format: "iife",
  write: false,
  charset: "utf8",
  target: "es2020",
  // import.meta sert seulement à trouver les fichiers de langue ; ici les langues sont déjà dans la page
  logOverride: { "empty-import-meta": "silent" }
});
const appJs = bundle.outputFiles[0].text;
// toutes les langues sont mises dans la page (la version Claude ne peut pas charger d'autres fichiers)
const { LANGUAGES } = await import("../src/i18n/languages.js");
const locales = {};
for (const language of LANGUAGES)
  locales[language.code] = JSON.parse(
    await readFile(join(ROOT, "src", "i18n", "locales", language.code + ".json"), "utf8")
  );
const localesJs = "window.NESTOR_LOCALES = " + JSON.stringify(locales) + ";";

// thème clair ou sombre posé avant le premier affichage, comme dans l'appli
const themeJs = await readFile(join(ROOT, "src", "ui", "theme-early.js"), "utf8");
const safe = (js) => js.replace(/<\/script/gi, "<\\/script");
// page complète (doctype, en-tête, corps) : l'hébergement des pages Claude n'accepte qu'un document HTML entier
const page =
  "<!DOCTYPE html>\n" +
  '<html lang="fr">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  "<title>Nestor</title>\n" +
  '<meta name="claude:viewport-fit-sides" content="cover">\n' +
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">\n' +
  "<style>" +
  style +
  "</style>\n<script>\n" +
  safe(themeJs) +
  "\n</script>\n</head>\n<body>\n" +
  body.trim() +
  "\n<script>\n" +
  safe(localesJs) +
  "\n</script>\n<script>" +
  host +
  "</script>\n<script>\n" +
  safe(appJs) +
  "\n</script>\n</body>\n</html>\n";

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, page);
console.log(`version Claude écrite : ${OUT} (${Math.round(page.length / 1024)} ko)`);
