/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Compteur anonyme des exports de Nestor (Cloudflare Worker + base D1).

   Sommaire
   1. Réglages : sites autorisés, formats comptés, limites
   2. Réception d'un export (POST /e) : vérifié, puis +1 dans la base
   3. Lecture des stats (/, /counts.csv) : réservée au propriétaire (Cloudflare Access)
   4. Page de stats (HTML sans script)
   5. Aiguillage des requêtes

   Ce qui est gardé : le jour, le format et la version de Nestor, avec un nombre. Rien d'autre :
   ni adresse IP, ni cookie, ni fichier, ni nom de projet. */

// 1. Réglages ---------------------------------------------------------------------------------------------------------

export const ALLOWED_ORIGINS = ["https://macr0b.github.io", "https://nestor.rophistudio.fr"];
export const EXPORT_KINDS = ["svg", "dxf", "pdf", "pdfall", "dxfall"];
const MAX_BODY_BYTES = 256;
const VERSION_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
// jours affichés sur la page de stats
const DAYS_SHOWN = 30;

function textResponse(status, text, headers) {
  return new Response(text, {
    status: status,
    headers: Object.assign({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, headers)
  });
}

// 2. Réception d'un export --------------------------------------------------------------------------------------------

/* Message attendu : {"e":"export","f":"dxf","v":"1.9.9"}. Rend { kind, version } ou null si quelque chose cloche. */
export function readExportMessage(text) {
  if (typeof text !== "string" || text.length > MAX_BODY_BYTES) return null;
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (Object.keys(data).length !== 3 || data.e !== "export") return null;
  if (!EXPORT_KINDS.includes(data.f)) return null;
  if (typeof data.v !== "string" || !VERSION_PATTERN.test(data.v)) return null;
  return { kind: data.f, version: data.v };
}

// jour UTC « AAAA-MM-JJ »
export function dayOf(date) {
  return date.toISOString().slice(0, 10);
}

async function receiveExport(request, env, now) {
  var origin = request.headers.get("Origin");
  // seul le site officiel de Nestor compte (une copie du code installée ailleurs n'envoie rien ici)
  if (!ALLOWED_ORIGINS.includes(origin)) return textResponse(403, "origine refusée");
  var cors = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  var declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BODY_BYTES) return textResponse(413, "trop long", cors);
  var message = readExportMessage(await request.text());
  if (!message) return textResponse(400, "message refusé", cors);
  await env.DB.prepare(
    "INSERT INTO counts (day, kind, version, n) VALUES (?1, ?2, ?3, 1) " +
      "ON CONFLICT (day, kind, version) DO UPDATE SET n = n + 1"
  )
    .bind(dayOf(now), message.kind, message.version)
    .run();
  return new Response(null, { status: 204, headers: cors });
}

// 3. Lecture réservée au propriétaire ---------------------------------------------------------------------------------

function base64UrlToBytes(text) {
  var base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  var binary = atob(base64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToJson(text) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(text)));
}

/* Jeton « Cf-Access-Jwt-Assertion » posé par Cloudflare Access après connexion du propriétaire :
   signature RS256 vérifiée avec les clés publiques de l'équipe Access, audience et dates contrôlées.
   fetchKeys(url) rend la liste de clés JWK (injectable pour les tests). Rend true seulement si tout est bon. */
export async function verifyAccessToken(token, env, fetchKeys, nowSeconds) {
  if (!token || !env.ACCESS_TEAM || !env.ACCESS_AUD) return false;
  var parts = token.split(".");
  if (parts.length !== 3) return false;
  var header, payload;
  try {
    header = base64UrlToJson(parts[0]);
    payload = base64UrlToJson(parts[1]);
  } catch (e) {
    return false;
  }
  if (header.alg !== "RS256" || !header.kid) return false;
  var audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(env.ACCESS_AUD)) return false;
  if (payload.iss !== "https://" + env.ACCESS_TEAM + ".cloudflareaccess.com") return false;
  if (!(payload.exp > nowSeconds) || (payload.nbf && payload.nbf > nowSeconds + 60)) return false;
  var keys = await fetchKeys("https://" + env.ACCESS_TEAM + ".cloudflareaccess.com/cdn-cgi/access/certs");
  var jwk = (keys || []).find(function (k) {
    return k.kid === header.kid;
  });
  if (!jwk) return false;
  var key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
    "verify"
  ]);
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
}

async function fetchAccessKeys(url) {
  var response = await fetch(url);
  if (!response.ok) return [];
  var body = await response.json();
  return body.keys || [];
}

// 4. Page de stats ----------------------------------------------------------------------------------------------------

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

const KIND_LABELS = {
  svg: "SVG (un panneau)",
  dxf: "DXF (un panneau)",
  pdf: "PDF (un panneau)",
  pdfall: "PDF (tout le plan)",
  dxfall: "DXF (tout le plan)"
};

/* rows : [{ day, kind, version, n }] → totaux par format, par version et par jour (les DAYS_SHOWN derniers). */
export function summarize(rows) {
  var byKind = {},
    byVersion = {},
    byDay = {},
    total = 0;
  rows.forEach(function (r) {
    byKind[r.kind] = (byKind[r.kind] || 0) + r.n;
    byVersion[r.version] = (byVersion[r.version] || 0) + r.n;
    var day = byDay[r.day] || (byDay[r.day] = {});
    day[r.kind] = (day[r.kind] || 0) + r.n;
    total += r.n;
  });
  var days = Object.keys(byDay).sort().reverse().slice(0, DAYS_SHOWN);
  return { total: total, byKind: byKind, byVersion: byVersion, byDay: byDay, days: days };
}

function table(head, lines) {
  return (
    "<table><thead><tr>" +
    head
      .map(function (h) {
        return "<th>" + escapeHtml(h) + "</th>";
      })
      .join("") +
    "</tr></thead><tbody>" +
    lines
      .map(function (cells) {
        return (
          "<tr>" +
          cells
            .map(function (c) {
              return "<td>" + escapeHtml(c) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("") +
    "</tbody></table>"
  );
}

export function statsPage(summary) {
  var kindLines = EXPORT_KINDS.map(function (k) {
    return [KIND_LABELS[k], summary.byKind[k] || 0];
  });
  var versionLines = Object.keys(summary.byVersion)
    .sort(function (a, b) {
      return b.localeCompare(a, "en", { numeric: true });
    })
    .map(function (v) {
      return [v, summary.byVersion[v]];
    });
  var dayLines = summary.days.map(function (d) {
    return [d].concat(
      EXPORT_KINDS.map(function (k) {
        return summary.byDay[d][k] || 0;
      })
    );
  });
  return (
    '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    "<title>Nestor · stats d'export</title><style>" +
    "body{font:15px/1.5 system-ui,sans-serif;margin:24px auto;max-width:860px;padding:0 16px;color:#1d2b33;background:#eef3f6}" +
    "h1{font-size:22px}h2{font-size:16px;margin-top:28px}table{border-collapse:collapse;width:100%;background:#fff}" +
    "th,td{padding:6px 10px;border-bottom:1px solid #d5e0e6;text-align:end}th:first-child,td:first-child{text-align:start}" +
    "p.big{font-size:28px;margin:4px 0}a{color:#0b4f71}" +
    '</style></head><body><h1>Nestor · exports</h1><p class="big">' +
    escapeHtml(summary.total) +
    ' exports au total</p><p><a href="/counts.csv">Télécharger les chiffres (CSV)</a></p>' +
    "<h2>Par format</h2>" +
    table(["Format", "Exports"], kindLines) +
    "<h2>Par jour (" +
    DAYS_SHOWN +
    " derniers jours actifs)</h2>" +
    table(
      ["Jour"].concat(
        EXPORT_KINDS.map(function (k) {
          return KIND_LABELS[k];
        })
      ),
      dayLines
    ) +
    "<h2>Par version de Nestor</h2>" +
    table(["Version", "Exports"], versionLines) +
    "</body></html>"
  );
}

export function countsCsv(rows) {
  return (
    "jour,format,version,exports\n" +
    rows
      .map(function (r) {
        return [r.day, r.kind, r.version, r.n].join(",");
      })
      .join("\n") +
    "\n"
  );
}

const PAGE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};

async function readStats(request, env, fetchKeys, nowSeconds) {
  var allowed = await verifyAccessToken(request.headers.get("Cf-Access-Jwt-Assertion"), env, fetchKeys, nowSeconds);
  if (!allowed) return textResponse(403, "accès réservé", PAGE_HEADERS);
  var result = await env.DB.prepare("SELECT day, kind, version, n FROM counts ORDER BY day, kind, version").all();
  var rows = result.results || [];
  var path = new URL(request.url).pathname;
  if (path === "/counts.csv")
    return new Response(countsCsv(rows), {
      headers: Object.assign({}, PAGE_HEADERS, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="nestor-exports.csv"'
      })
    });
  return new Response(statsPage(summarize(rows)), {
    headers: Object.assign({}, PAGE_HEADERS, { "Content-Type": "text/html; charset=utf-8" })
  });
}

// 5. Aiguillage -------------------------------------------------------------------------------------------------------

/* Point d'entrée commun (Cloudflare et tests) ; deps : { now, fetchKeys } remplaçables dans les tests. */
export async function handleRequest(request, env, deps) {
  var now = (deps && deps.now) || new Date();
  var fetchKeys = (deps && deps.fetchKeys) || fetchAccessKeys;
  var path = new URL(request.url).pathname;
  if (path === "/e") {
    if (request.method === "POST") return receiveExport(request, env, now);
    return textResponse(405, "méthode refusée", { Allow: "POST" });
  }
  if ((path === "/" || path === "/counts.csv") && request.method === "GET")
    return readStats(request, env, fetchKeys, Math.floor(now.getTime() / 1000));
  return textResponse(404, "introuvable");
}

export default {
  fetch: function (request, env) {
    return handleRequest(request, env);
  }
};
