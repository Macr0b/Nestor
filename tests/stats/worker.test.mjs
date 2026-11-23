// Compteur des exports (stats/worker.js) : messages acceptés ou refusés, comptage, lecture réservée. Lancement : npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { handleRequest, readExportMessage, summarize, countsCsv, verifyAccessToken } from "../../stats/worker.js";

// base D1 simulée : une table counts en mémoire, avec la même requête d'ajout que la vraie
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              assert.match(sql, /ON CONFLICT \(day, kind, version\) DO UPDATE SET n = n \+ 1/);
              const key = args.join("|");
              const row = rows.get(key) || { day: args[0], kind: args[1], version: args[2], n: 0 };
              row.n++;
              rows.set(key, row);
            }
          };
        },
        async all() {
          return { results: [...rows.values()].sort((a, b) => (a.day + a.kind).localeCompare(b.day + b.kind)) };
        }
      };
    }
  };
}

const NOW = new Date("2026-11-23T10:00:00Z");
const send = (env, body, origin = "https://macr0b.github.io", extra = {}) =>
  handleRequest(
    new Request("https://stats.nestor.rophistudio.fr/e", {
      method: "POST",
      headers: Object.assign({ Origin: origin, "Content-Type": "text/plain" }, extra),
      body
    }),
    env,
    { now: NOW }
  );

describe("Compteur des exports", () => {
  test("un export du site officiel : +1 pour le jour, le format et la version", async () => {
    const env = { DB: fakeDb() };
    const msg = JSON.stringify({ e: "export", f: "dxf", v: "1.9.9" });
    const r1 = await send(env, msg);
    await send(env, msg);
    await send(env, msg, "https://nestor.rophistudio.fr");
    assert.equal(r1.status, 204);
    assert.equal(r1.headers.get("Access-Control-Allow-Origin"), "https://macr0b.github.io");
    assert.deepEqual([...env.DB.rows.values()], [{ day: "2026-11-23", kind: "dxf", version: "1.9.9", n: 3 }]);
  });

  test("refusés sans rien compter : autre site, méthode, format inconnu, champ en trop, trop long", async () => {
    const env = { DB: fakeDb() };
    const ok = JSON.stringify({ e: "export", f: "svg", v: "1.9.9" });
    assert.equal((await send(env, ok, "https://exemple.com")).status, 403);
    assert.equal((await send(env, ok, null)).status, 403);
    for (const bad of [
      "pas du json",
      JSON.stringify({ e: "export", f: "exe", v: "1.9.9" }),
      JSON.stringify({ e: "export", f: "svg", v: "1.9.9<script>" }),
      JSON.stringify({ e: "visite", f: "svg", v: "1.9.9" }),
      JSON.stringify({ e: "export", f: "svg", v: "1.9.9", ip: "1.2.3.4" }),
      JSON.stringify(["export", "svg", "1.9.9"]),
      "{" + " ".repeat(400) + "}"
    ])
      assert.equal((await send(env, bad)).status, 400, bad.slice(0, 40));
    assert.equal((await send(env, ok, undefined, { "Content-Length": "5000" })).status, 413);
    const get = await handleRequest(new Request("https://stats.nestor.rophistudio.fr/e"), env, { now: NOW });
    assert.equal(get.status, 405);
    assert.equal(env.DB.rows.size, 0);
  });

  test("lecture des message : seuls les cinq exports du plan et une version x.y.z", () => {
    for (const f of ["svg", "dxf", "pdf", "pdfall", "dxfall"])
      assert.deepEqual(readExportMessage(JSON.stringify({ e: "export", f, v: "2.10.0" })), {
        kind: f,
        version: "2.10.0"
      });
    assert.equal(readExportMessage(null), null);
    assert.equal(readExportMessage(JSON.stringify({ e: "export", f: "svg", v: 199 })), null);
  });

  test("page et CSV : refusés sans jeton Access valide (et si Access n'est pas réglé)", async () => {
    const env = { DB: fakeDb(), ACCESS_TEAM: "rophi", ACCESS_AUD: "aud123" };
    for (const path of ["/", "/counts.csv"]) {
      const r = await handleRequest(new Request("https://stats.nestor.rophistudio.fr" + path), env, {
        now: NOW,
        fetchKeys: async () => []
      });
      assert.equal(r.status, 403);
    }
    const unset = await handleRequest(
      new Request("https://stats.nestor.rophistudio.fr/", { headers: { "Cf-Access-Jwt-Assertion": "a.b.c" } }),
      { DB: fakeDb() },
      { now: NOW, fetchKeys: async () => [] }
    );
    assert.equal(unset.status, 403);
  });

  test("jeton Access : bonne signature, audience, émetteur et date exigés", async () => {
    const pair = await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"]
    );
    const jwk = Object.assign(await crypto.subtle.exportKey("jwk", pair.publicKey), { kid: "k1" });
    const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");
    const sign = async (payload, kid = "k1") => {
      const head = b64({ alg: "RS256", kid });
      const body = b64(payload);
      const sig = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        pair.privateKey,
        new TextEncoder().encode(head + "." + body)
      );
      return head + "." + body + "." + Buffer.from(sig).toString("base64url");
    };
    const env = { ACCESS_TEAM: "rophi", ACCESS_AUD: "aud123" };
    const keys = async (url) => {
      assert.equal(url, "https://rophi.cloudflareaccess.com/cdn-cgi/access/certs");
      return [jwk];
    };
    const now = 1795430000;
    const good = { aud: ["aud123"], iss: "https://rophi.cloudflareaccess.com", exp: now + 600 };
    assert.equal(await verifyAccessToken(await sign(good), env, keys, now), true);
    assert.equal(await verifyAccessToken(await sign({ ...good, aud: ["autre"] }), env, keys, now), false);
    assert.equal(
      await verifyAccessToken(await sign({ ...good, iss: "https://pirate.cloudflareaccess.com" }), env, keys, now),
      false
    );
    assert.equal(await verifyAccessToken(await sign({ ...good, exp: now - 1 }), env, keys, now), false);
    assert.equal(await verifyAccessToken(await sign(good, "inconnue"), env, keys, now), false);
    const token = await sign(good);
    const forged = token.split(".").slice(0, 2).join(".") + "." + b64("fausse signature");
    assert.equal(await verifyAccessToken(forged, env, keys, now), false);
    const tampered = [token.split(".")[0], b64({ ...good, aud: "aud123", exp: now + 99999 }), token.split(".")[2]].join(
      "."
    );
    assert.equal(await verifyAccessToken(tampered, env, keys, now), false);
    // avec un jeton valide, la page s'affiche et le CSV se télécharge
    const db = fakeDb();
    await send({ DB: db }, JSON.stringify({ e: "export", f: "pdfall", v: "1.9.9" }));
    const deps = { now: new Date(now * 1000), fetchKeys: keys };
    const page = await handleRequest(
      new Request("https://stats.nestor.rophistudio.fr/", { headers: { "Cf-Access-Jwt-Assertion": token } }),
      { ...env, DB: db },
      deps
    );
    assert.equal(page.status, 200);
    assert.match(page.headers.get("Content-Security-Policy"), /default-src 'none'/);
    assert.match(await page.text(), /1 exports au total/);
    const csv = await handleRequest(
      new Request("https://stats.nestor.rophistudio.fr/counts.csv", { headers: { "Cf-Access-Jwt-Assertion": token } }),
      { ...env, DB: db },
      deps
    );
    assert.equal(await csv.text(), "jour,format,version,exports\n2026-11-23,pdfall,1.9.9,1\n");
  });

  test("résumé : totaux par format, version et jour", () => {
    const rows = [
      { day: "2026-11-22", kind: "dxf", version: "1.9.8", n: 4 },
      { day: "2026-11-23", kind: "dxf", version: "1.9.9", n: 2 },
      { day: "2026-11-23", kind: "svg", version: "1.9.9", n: 1 }
    ];
    const s = summarize(rows);
    assert.equal(s.total, 7);
    assert.deepEqual(s.byKind, { dxf: 6, svg: 1 });
    assert.deepEqual(s.byVersion, { "1.9.8": 4, "1.9.9": 3 });
    assert.deepEqual(s.days, ["2026-11-23", "2026-11-22"]);
    assert.equal(countsCsv(rows).split("\n").length, 5);
  });
});
