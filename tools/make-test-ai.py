# Nestor — outil de test. Usage : python3 tools/make-test-ai.py tests/fixtures/
# Fabrique deux petits fichiers Illustrator d'essai (noms-zstd.ai, noms-zlib.ai) : une partie PDF avec 4 tracés fermés,
# et les données internes d'Illustrator (AIPrivateData : un en-tête en clair puis une partie compressée, en ZStandard
# comme Illustrator 2020 et plus, ou en zlib comme avant), dans un calque « Découpe ». Le nom d'un objet suit l'objet :
# « Côté gauche » (espace et accent), « BGM_12 » (tiret bas, avec le suffixe « _2_ » d'un nom déjà pris), et un
# groupe « Étagère » de deux tracés sans nom. Il faut le paquet Python zstandard (pip install zstandard) pour la version ZStandard.
import os
import sys
import zlib

import zstandard

mm = 72 / 25.4


def r(v):
    return "%.3f" % (v * mm)


# (largeur, hauteur, x, y) en mm des 4 tracés, dans l'ordre de dessin
SHAPES = [(60, 40, 10, 10), (30, 30, 80, 10), (20, 50, 120, 10), (15, 15, 150, 10)]

page = "0 0 0 RG 0.5 w\n" + "\n".join(f"{r(x)} {r(y)} {r(w)} {r(h)} re S" for w, h, x, y in SHAPES)


def native_path(w, h, x, y):
    # même tracé dans le format interne d'Illustrator (points, y vers le haut), fermé et filé (« s »)
    x0, y0, x1, y1 = x * mm, y * mm, (x + w) * mm, (y + h) * mm
    return "\n".join(
        [f"{x0:.4f} {y0:.4f} m", f"{x1:.4f} {y0:.4f} L", f"{x1:.4f} {y1:.4f} L", f"{x0:.4f} {y1:.4f} L", "s"]
    )


def uid(name):
    return f"%_/ArtDictionary :\n%_/XMLUID : ({name}) ; (AI10_ArtUID) ,\n%_;\n%_"


native = "\n".join(
    [
        "%AI5_BeginLayer",
        "1 1 1 1 0 0 1 0 79 128 255 0 50 0 Lb",
        "(Découpe) Ln",
        "1 AE",
        uid("Découpe"),
        native_path(*SHAPES[0]),
        uid("Côté_gauche"),
        native_path(*SHAPES[1]),
        uid("BGM_x5F_12_2_"),
        "u",
        native_path(*SHAPES[2]),
        native_path(*SHAPES[3]),
        "U",
        uid("Étagère"),
        "LB",
        "%AI5_EndLayer--",
    ]
)
header = "%%BoundingBox: 0 0 600 400\r\n%AI5_FileFormat 14.0\r\n"


def make(path, compress, marker):
    data = header.encode("latin-1") + marker + compress(native.replace("\n", "\r").encode("utf-8"))
    half = len(data) // 2
    chunks = [data[:half], data[half:]]
    objs = []

    def add(s):
        objs.append(s)
        return len(objs)

    catalog = add(None)
    pages = add(None)
    content = add(f"<< /Length {len(page)} >>\nstream\n{page}\nendstream".encode("latin-1"))
    private = []
    for chunk in chunks:
        packed = zlib.compress(chunk)
        private.append(add(f"<< /Length {len(packed)} /Filter /FlateDecode >>\nstream\n".encode() + packed + b"\nendstream"))
    refs = " ".join(f"/AIPrivateData{i + 1} {n} 0 R" for i, n in enumerate(private))
    page_obj = add(
        f"<< /Type /Page /Parent {pages} 0 R /MediaBox [0 0 {r(200)} {r(100)}] /Contents {content} 0 R "
        f"/PieceInfo << /Illustrator << /Private << {refs} /NumBlock {len(private)} >> >> >> >>".encode("latin-1")
    )
    objs[catalog - 1] = f"<< /Type /Catalog /Pages {pages} 0 R >>".encode()
    objs[pages - 1] = f"<< /Type /Pages /Kids [{page_obj} 0 R] /Count 1 >>".encode()
    out = b"%PDF-1.6\n%\xe2\xe3\xcf\xd3\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root {catalog} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    with open(path, "wb") as f:
        f.write(out)


folder = sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures"
make(os.path.join(folder, "noms-zstd.ai"), zstandard.ZstdCompressor().compress, b"%AI24_ZStandard_Data")
make(os.path.join(folder, "noms-zlib.ai"), zlib.compress, b"%AI12_CompressedData")
