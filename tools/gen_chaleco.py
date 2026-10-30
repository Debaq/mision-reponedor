# Genera el chaleco del supermercado usando la silueta de la polera de Kenney.
import sys
from PIL import Image, ImageDraw

base = sys.argv[1]  # PNG de una polera (ej: redShirt1.png)
out = sys.argv[2]
shirt = Image.open(base).convert('RGBA')
w, h = shirt.size
mask = shirt.split()[3]

violeta = (85, 60, 154, 255)
oscuro = (60, 40, 110, 255)
reflectante = (215, 222, 230, 255)  # franja plateada
turquesa = (56, 178, 172, 255)

capa = Image.new('RGBA', (w, h), violeta)
d = ImageDraw.Draw(capa)
# franja reflectante
d.rectangle([0, int(h * 0.62), w, int(h * 0.70)], fill=reflectante)
d.line([(0, int(h * 0.62)), (w, int(h * 0.62))], fill=turquesa, width=3)
d.line([(0, int(h * 0.70)), (w, int(h * 0.70))], fill=turquesa, width=3)
# borde inferior
d.rectangle([0, h - 10, w, h], fill=oscuro)
# logo (bolsa de compras simple)
cx, cy = int(w * 0.70), int(h * 0.36)
d.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=(255, 255, 255, 255))
d.rectangle([cx - 9, cy - 5, cx + 9, cy + 10], fill=violeta)
d.arc([cx - 6, cy - 13, cx + 6, cy - 1], 180, 360, fill=violeta, width=3)

chaleco = Image.new('RGBA', (w, h), (0, 0, 0, 0))
chaleco.paste(capa, (0, 0), mask)
# abertura en V al centro (deja ver la polera)
v = Image.new('L', (w, h), 0)
ImageDraw.Draw(v).polygon([(w * 0.36, 0), (w * 0.64, 0), (w * 0.5, h * 0.55)], fill=255)
chaleco.putalpha(Image.composite(Image.new('L', (w, h), 0), chaleco.split()[3], v))
# cierre central
ImageDraw.Draw(chaleco).line([(w * 0.5, h * 0.55), (w * 0.5, h - 10)], fill=oscuro, width=3)
chaleco.save(out)
