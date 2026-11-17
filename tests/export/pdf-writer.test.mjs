// Écriture du PDF à imprimer (pages en image). Lancement : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPdf, mmToPt, PAPER } from "../../src/export/pdf-writer.js";
import { ROOT } from "../helpers.mjs";

const jpeg = new Uint8Array(readFileSync(join(ROOT, "tests", "fixtures", "page.jpg")));
const a4 = { jpeg, pixelWidth: 120, pixelHeight: 170, widthPt: mmToPt(210), heightPt: mmToPt(297) };
const latin1 = (bytes) => Buffer.from(bytes).toString("latin1");

// outil du système disponible ? (les tests de lecture externe sont sautés sinon)
function tool(name) {
  try {
    execFileSync(name, ["--version"], { stdio: "ignore" });
    return true;
  } catch (e) {
    return e.code !== "ENOENT";
  }
}

test("table des positions exacte : chaque objet est là où le PDF le dit", () => {
  const pdf = latin1(buildPdf([a4, a4], { title: "Essai", date: new Date(Date.UTC(2026, 10, 17, 8, 5, 9)) }));
  assert.ok(pdf.startsWith("%PDF-1.4\n"));
  const xref = Number(pdf.match(/startxref\n(\d+)\n%%EOF\n$/)[1]);
  assert.equal(pdf.slice(xref, xref + 5), "xref\n");
  const entries = pdf
    .slice(xref)
    .match(/(\d{10}) 00000 n\r\n/g)
    .map((e) => Number(e.slice(0, 10)));
  assert.equal(entries.length, 3 + 2 * 3);
  entries.forEach((offset, i) => assert.equal(pdf.slice(offset, offset + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  assert.match(pdf, /\/Count 2/);
  assert.match(pdf, /\/CreationDate \(D:20261117080509Z\)/);
});

test("titre en UTF-16 : toutes les langues passent", () => {
  const pdf = latin1(buildPdf([a4], { title: "Étagère 書架" }));
  assert.ok(pdf.includes("<FEFF00C9007400610067"), "titre encodé");
});

test("format de page : A4 en points", () => {
  assert.ok(Math.abs(mmToPt(PAPER.a4.widthMm) - 595.28) < 0.01);
  assert.ok(Math.abs(mmToPt(PAPER.letter.heightMm) - 792) < 0.01);
  const pdf = latin1(buildPdf([a4], {}));
  assert.match(pdf, /\/MediaBox \[0 0 595\.276 841\.89\]/);
});

test("lu sans erreur par qpdf et pdfinfo (si présents)", { skip: !tool("qpdf") }, () => {
  const dir = mkdtempSync(join(tmpdir(), "nestor-pdf-"));
  const file = join(dir, "plan.pdf");
  writeFileSync(file, buildPdf([a4, a4, a4], { title: "Plan de coupe" }));
  execFileSync("qpdf", ["--check", file], { stdio: "pipe" });
  if (tool("pdfinfo")) {
    const info = execFileSync("pdfinfo", [file]).toString();
    assert.match(info, /Pages:\s+3/);
    assert.match(info, /Title:\s+Plan de coupe/);
    assert.match(info, /Page size:\s+595\.\d+ x 841\.\d+ pts \(A4\)/);
  }
});
