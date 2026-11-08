/* Service worker : fonctionnement hors ligne et mises à jour.
   À chaque nouvelle version, changer VERSION ci-dessous ET dans app.js. */
const VERSION = "1.2.0";
const CACHE = "nestor-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "app.js",
  "geo.js",
  "i18n.js",
  "manifest.webmanifest",
  "icons/icon-192-v3.png",
  "icons/icon-512-v3.png",
  "icons/maskable-512-v3.png",
  "icons/apple-touch-icon-v3.png",
  "icons/favicon-32-v3.png",
  "vendor/pdfjs/pdf.min.js",
  "vendor/pdfjs/pdf.worker.min.js",
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
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("nestor-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
  if (e.data === "version" && e.source) e.source.postMessage({ type: "version", version: VERSION });
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // réseau d'abord : la page (et ses liens d'icônes) est toujours à jour en ligne ; cache hors ligne
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); }
          return r;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
