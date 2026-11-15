# Nestor — outil de test. Usage : python3 tools/make-test-pdf.py tests/fixtures/calques-courbes.pdf
# Fabrique un PDF d'essai : 2 calques (Découpe rouge, Gravure bleue), courbes, un tracé de découpe (clip) à ignorer,
# un texte (à signaler), une forme dans un objet réutilisable (Form XObject), une 2e page.
import sys
objs = []
def add(s): objs.append(s); return len(objs)
mm = 72 / 25.4
def r(v): return "%.3f" % (v * mm)
page1 = f"""
/OC /L1 BDC
1 0 0 RG 0.5 w
{r(10)} {r(10)} {r(60)} {r(40)} re S
{r(100)} {r(30)} m {r(100)} {r(43.8)} {r(111.2)} {r(55)} {r(125)} {r(55)} c {r(138.8)} {r(55)} {r(150)} {r(43.8)} {r(150)} {r(30)} c {r(150)} {r(16.2)} {r(138.8)} {r(5)} {r(125)} {r(5)} c {r(111.2)} {r(5)} {r(100)} {r(16.2)} {r(100)} {r(30)} c h S
EMC
/OC /L2 BDC
0 0 1 RG
{r(20)} {r(20)} m {r(50)} {r(20)} l {r(50)} {r(35)} l h S
EMC
q {r(0)} {r(0)} {r(200)} {r(150)} re W n Q
BT /F1 12 Tf 100 100 Td (Texte) Tj ET
q 1 0 0 1 {r(160)} {r(80)} cm /Fm1 Do Q
""".strip()
page2 = f"""0 0 0 RG {r(10)} {r(10)} {r(30)} {r(30)} re S""".strip()
catalog = add(None); pages = add(None)
oc1 = add("<< /Type /OCG /Name (Découpe) >>".encode("latin-1").decode("latin-1"))
oc2 = add("<< /Type /OCG /Name (Gravure) >>")
font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
form_content = f"0 0 0 RG 0 0 m {r(20)} 0 l {r(20)} {r(20)} l 0 {r(20)} l h S"
form = add(f"<< /Type /XObject /Subtype /Form /BBox [0 0 {r(20)} {r(20)}] /Length {len(form_content)} >>\nstream\n{form_content}\nendstream")
c1 = add(f"<< /Length {len(page1)} >>\nstream\n{page1}\nendstream")
c2 = add(f"<< /Length {len(page2)} >>\nstream\n{page2}\nendstream")
p1 = add(f"<< /Type /Page /Parent {pages} 0 R /MediaBox [0 0 {r(200)} {r(150)}] /Contents {c1} 0 R /Resources << /Properties << /L1 {oc1} 0 R /L2 {oc2} 0 R >> /Font << /F1 {font} 0 R >> /XObject << /Fm1 {form} 0 R >> >> >>")
p2 = add(f"<< /Type /Page /Parent {pages} 0 R /MediaBox [0 0 {r(100)} {r(100)}] /Contents {c2} 0 R >>")
objs[catalog-1] = f"<< /Type /Catalog /Pages {pages} 0 R /OCProperties << /OCGs [{oc1} 0 R {oc2} 0 R] /D << /Order [{oc1} 0 R {oc2} 0 R] >> >> >>"
objs[pages-1] = f"<< /Type /Pages /Kids [{p1} 0 R {p2} 0 R] /Count 2 >>"
out = b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n"
offs = []
for i, o in enumerate(objs, 1):
    offs.append(len(out))
    out += f"{i} 0 obj\n".encode() + o.encode("latin-1") + b"\nendobj\n"
x = len(out)
out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode() + b"".join(b"%010d 00000 n \n" % o for o in offs)
out += f"trailer\n<< /Size {len(objs)+1} /Root {catalog} 0 R >>\nstartxref\n{x}\n%%EOF\n".encode()
open(sys.argv[1], "wb").write(out)
