/* Service worker : fonctionnement hors ligne et mises à jour.
   À chaque nouvelle version, changer VERSION ci-dessous ET APP_VERSION dans src/version.js. */
const VERSION = "1.8.1";
const CACHE = "nestor-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "css/app.css",
  "css/blueprint.css",
  "css/cost.css",
  "css/laser.css",
  "css/projects.css",
  "css/shortcuts.css",
  "css/fonts.css",
  "css/milling.css",
  "css/notebook.css",
  "css/settings.css",
  "css/tabs.css",
  "css/theme.css",
  "src/export/dxf.js",
  "src/export/export-files.js",
  "src/export/export-options.js",
  "src/export/offcuts.js",
  "src/export/svg.js",
  "src/geometry/grouping.js",
  "src/geometry/placed-parts.js",
  "src/geometry/polylines.js",
  "src/geometry/svg-path.js",
  "src/i18n/i18n.js",
  "src/i18n/languages.js",
  "src/import/dxf.js",
  "src/import/hpgl.js",
  "src/import/lightburn.js",
  "src/import/pdf.js",
  "src/import/read-file.js",
  "src/import/svg-sanitize.js",
  "src/import/svg.js",
  "src/import/text-names.js",
  "src/import/vectorcraft.js",
  "src/machining/cut-time.js",
  "src/machining/materials.js",
  "src/machining/milling-store.js",
  "src/machining/milling.js",
  "src/library/library-store.js",
  "src/library/plan-cost.js",
  "src/main.js",
  "src/notebook/notebook-store.js",
  "src/placement/nest.js",
  "src/placement/origin.js",
  "src/placement/rectangles.js",
  "src/placement/run-nesting.js",
  "src/project/example.js",
  "src/project/manual-parts.js",
  "src/project/parts.js",
  "src/project/preferences.js",
  "src/project/state.js",
  "src/session.js",
  "src/ui/blueprint-decor.js",
  "src/ui/cost-tab.js",
  "src/ui/bug-report.js",
  "src/ui/files-panel.js",
  "src/ui/install.js",
  "src/ui/lengths.js",
  "src/ui/manual-parts-panel.js",
  "src/ui/materials-tab.js",
  "src/ui/milling-tab.js",
  "src/ui/laser-materials.js",
  "src/ui/laser-tab.js",
  "src/ui/value-box.js",
  "src/laser/custom-materials.js",
  "src/laser/gweike-chart.js",
  "src/laser/laser-settings.js",
  "src/laser/laser-store.js",
  "src/laser/reference-sources.js",
  "src/laser/speed-chart.js",
  "src/laser/test-grid.js",
  "src/laser/thunder-chart.js",
  "src/laser/trotec-books.js",
  "src/text/stroke-font.js",
  "src/geometry/label-spot.js",
  "src/export/part-numbers.js",
  "src/export/svg-writer.js",
  "src/export/pdf-writer.js",
  "src/ui/print-pages.js",
  "src/ui/plan-summary.js",
  "src/ui/projects-dialog.js",
  "src/ui/shortcuts.js",
  "src/ui/shortcut-keys.js",
  "src/project/project-snapshot.js",
  "src/project/projects-store.js",
  "src/ui/notebook-tab.js",
  "src/ui/panels-editor.js",
  "src/ui/parts-list.js",
  "src/ui/release-notes.js",
  "src/ui/render-all.js",
  "src/ui/result-view.js",
  "src/ui/settings-dialog.js",
  "src/ui/sheet-drawing.js",
  "src/ui/tabs.js",
  "src/ui/theme-early.js",
  "src/ui/tool-icons.js",
  "src/ui/updates.js",
  "src/util/dom.js",
  "src/util/host.js",
  "src/util/numbers.js",
  "src/util/units.js",
  "src/version.js",
  "src/i18n/locales/ar.json",
  "src/i18n/locales/be.json",
  "src/i18n/locales/bg.json",
  "src/i18n/locales/bn.json",
  "src/i18n/locales/bs.json",
  "src/i18n/locales/ca.json",
  "src/i18n/locales/cs.json",
  "src/i18n/locales/da.json",
  "src/i18n/locales/de.json",
  "src/i18n/locales/el.json",
  "src/i18n/locales/en.json",
  "src/i18n/locales/es.json",
  "src/i18n/locales/et.json",
  "src/i18n/locales/fi.json",
  "src/i18n/locales/fr.json",
  "src/i18n/locales/ga.json",
  "src/i18n/locales/hi.json",
  "src/i18n/locales/hr.json",
  "src/i18n/locales/hu.json",
  "src/i18n/locales/id.json",
  "src/i18n/locales/is.json",
  "src/i18n/locales/it.json",
  "src/i18n/locales/ja.json",
  "src/i18n/locales/ko.json",
  "src/i18n/locales/lb.json",
  "src/i18n/locales/lt.json",
  "src/i18n/locales/lv.json",
  "src/i18n/locales/mk.json",
  "src/i18n/locales/mt.json",
  "src/i18n/locales/nb.json",
  "src/i18n/locales/nl.json",
  "src/i18n/locales/pl.json",
  "src/i18n/locales/pt.json",
  "src/i18n/locales/ro.json",
  "src/i18n/locales/ru.json",
  "src/i18n/locales/sk.json",
  "src/i18n/locales/sl.json",
  "src/i18n/locales/sq.json",
  "src/i18n/locales/sr.json",
  "src/i18n/locales/sv.json",
  "src/i18n/locales/th.json",
  "src/i18n/locales/tr.json",
  "src/i18n/locales/uk.json",
  "src/i18n/locales/zh-Hant.json",
  "src/i18n/locales/zh.json",
  "manifest.webmanifest",
  "icons/icon-192-v3.png",
  "icons/icon-512-v3.png",
  "icons/maskable-512-v3.png",
  "icons/apple-touch-icon-v3.png",
  "icons/favicon-32-v3.png",
  "vendor/pdfjs/pdf.min.mjs",
  "vendor/pdfjs/pdf.worker.min.mjs",
  "fonts/barlow-latin-400-normal.woff2",
  "fonts/barlow-latin-500-normal.woff2",
  "fonts/barlow-latin-600-normal.woff2",
  "fonts/barlow-latin-ext-400-normal.woff2",
  "fonts/barlow-latin-ext-500-normal.woff2",
  "fonts/barlow-latin-ext-600-normal.woff2",
  "fonts/barlow-condensed-latin-500-normal.woff2",
  "fonts/barlow-condensed-latin-600-normal.woff2",
  "fonts/barlow-condensed-latin-700-normal.woff2",
  "fonts/barlow-condensed-latin-ext-600-normal.woff2",
  "fonts/barlow-condensed-latin-ext-700-normal.woff2",
  "fonts/ibm-plex-mono-latin-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-500-normal.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("nestor-") && k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
  if (e.data === "version" && e.source) e.source.postMessage({ type: "version", version: VERSION });
});

/* Réseau d'abord pour tout (la page ET son code) : en ligne, la page et le code chargés viennent toujours de la même
   version, même juste après une mise à jour (avant, le code venait du cache de l'ancienne version alors que la page
   était déjà la nouvelle : bug vu sur iPhone en 1.2.6). Chaque fichier reçu est recopié dans le cache.
   Hors ligne, tout vient du cache, donc d'une seule et même version. */
function networkFirst(req, cacheKey) {
  return fetch(req)
    .then((r) => {
      if (r && r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(cacheKey || req, copy));
      }
      return r;
    })
    .catch(() => caches.match(cacheKey || req, { ignoreSearch: true }));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(networkFirst(req, req.mode === "navigate" ? "index.html" : null));
});
