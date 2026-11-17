/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Écriture d'un fichier PDF dont chaque page est une image JPEG pleine page (dessinée avant, dans la langue et
   l'écriture de l'utilisateur). Aucune bibliothèque : structure PDF 1.4 minimale, table des positions exacte. */

const encoder = new TextEncoder();

// texte de métadonnée en UTF-16 (toutes les langues), écrit en hexadécimal
function pdfTextString(text) {
  var hex = "FEFF";
  for (var i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return "<" + hex + ">";
}

function pdfDate(date) {
  var p = function (n) {
    return String(n).padStart(2, "0");
  };
  return (
    "(D:" +
    date.getUTCFullYear() +
    p(date.getUTCMonth() + 1) +
    p(date.getUTCDate()) +
    p(date.getUTCHours()) +
    p(date.getUTCMinutes()) +
    p(date.getUTCSeconds()) +
    "Z)"
  );
}

function number(v) {
  return String(Math.round(v * 1000) / 1000);
}

/* pages : [{ jpeg: Uint8Array, pixelWidth, pixelHeight, widthPt, heightPt }] ; info : { title, date }.
   Renvoie le fichier PDF (Uint8Array). */
export function buildPdf(pages, info) {
  var chunks = [],
    size = 0,
    offsets = [];
  function write(part) {
    var bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    size += bytes.length;
  }
  function object(id, body) {
    offsets[id] = size;
    write(id + " 0 obj\n");
    body();
    write("\nendobj\n");
  }
  // 1 catalogue, 2 liste des pages, 3 informations, puis 3 objets par page (page, contenu, image)
  var count = pages.length,
    kids = [];
  for (var k = 0; k < count; k++) kids.push(4 + 3 * k + " 0 R");
  write("%PDF-1.4\n");
  // marque binaire (4 octets au-delà de 127) : les outils savent que le fichier n'est pas du texte pur
  write(new Uint8Array([37, 226, 227, 207, 211, 10]));
  object(1, function () {
    write("<< /Type /Catalog /Pages 2 0 R >>");
  });
  object(2, function () {
    write("<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + count + " >>");
  });
  object(3, function () {
    write(
      "<< /Title " +
        pdfTextString(info.title || "") +
        " /Producer " +
        pdfTextString("Nestor") +
        " /CreationDate " +
        pdfDate(info.date || new Date()) +
        " >>"
    );
  });
  pages.forEach(function (page, index) {
    var pageId = 4 + 3 * index,
      contentId = pageId + 1,
      imageId = pageId + 2,
      w = number(page.widthPt),
      h = number(page.heightPt),
      content = "q " + w + " 0 0 " + h + " 0 0 cm /Im0 Do Q";
    object(pageId, function () {
      write(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
          w +
          " " +
          h +
          "] /Resources << /XObject << /Im0 " +
          imageId +
          " 0 R >> >> /Contents " +
          contentId +
          " 0 R >>"
      );
    });
    object(contentId, function () {
      write("<< /Length " + encoder.encode(content).length + " >>\nstream\n" + content + "\nendstream");
    });
    object(imageId, function () {
      write(
        "<< /Type /XObject /Subtype /Image /Width " +
          page.pixelWidth +
          " /Height " +
          page.pixelHeight +
          " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
          page.jpeg.length +
          " >>\nstream\n"
      );
      write(page.jpeg);
      write("\nendstream");
    });
  });
  var total = 4 + 3 * count,
    xref = size;
  write("xref\n0 " + total + "\n0000000000 65535 f\r\n");
  for (var id = 1; id < total; id++) write(String(offsets[id]).padStart(10, "0") + " 00000 n\r\n");
  write("trailer\n<< /Size " + total + " /Root 1 0 R /Info 3 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
  var out = new Uint8Array(size),
    at = 0;
  chunks.forEach(function (c) {
    out.set(c, at);
    at += c.length;
  });
  return out;
}

// formats de papier en points (1 pt = 1/72 de pouce) : A4 en métrique, Letter en impérial
export const PAPER = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 }
};

export function mmToPt(mm) {
  return (mm / 25.4) * 72;
}
