# Genera los chalecos del supermercado usando la silueta de la polera de Kenney.
# Uso:  uv run --with pillow python tools/gen_chaleco.py
# Crea public/assets/personaje/chaleco.png (básico) y chaleco_<variante>.png (desbloqueables).
import pathlib
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw

DIR = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'personaje'

violeta = (85, 60, 154, 255)
oscuro = (60, 40, 110, 255)
reflectante = (215, 222, 230, 255)  # franja plateada
turquesa = (56, 178, 172, 255)
blanco = (255, 255, 255, 255)
dorado = (246, 195, 67, 255)

# variante: (color, borde inferior, franja, líneas de la franja, insignias)
VARIANTES = {
    'basico': (violeta, oscuro, reflectante, turquesa, []),
    'estrella': (violeta, oscuro, reflectante, turquesa, ['estrella']),
    'experto': ((44, 150, 145, 255), (30, 105, 100, 255), reflectante, violeta, ['estrella', 'estrella2']),
    'plata': ((176, 186, 198, 255), (120, 130, 145, 255), violeta, turquesa, ['estrella', 'estrella2']),
    'oro': ((226, 176, 48, 255), (170, 125, 25, 255), violeta, turquesa, ['medalla']),
}


def silueta():
    """Recorta redShirt1.png del atlas de poleras."""
    sheet = Image.open(DIR / 'sheet_shirts.png').convert('RGBA')
    sub = next(s for s in ET.parse(DIR / 'sheet_shirts.xml').getroot() if s.get('name') == 'redShirt1.png')
    x, y, w, h = (int(sub.get(k)) for k in ('x', 'y', 'width', 'height'))
    return sheet.crop((x, y, x + w, y + h))


def estrella(d, cx, cy, r, color):
    import math
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=color)


def chaleco(color, borde, franja, lineas, insignias):
    shirt = silueta()
    w, h = shirt.size
    mask = shirt.split()[3]
    capa = Image.new('RGBA', (w, h), color)
    d = ImageDraw.Draw(capa)
    # franja reflectante
    d.rectangle([0, int(h * 0.62), w, int(h * 0.70)], fill=franja)
    d.line([(0, int(h * 0.62)), (w, int(h * 0.62))], fill=lineas, width=3)
    d.line([(0, int(h * 0.70)), (w, int(h * 0.70))], fill=lineas, width=3)
    # borde inferior
    d.rectangle([0, h - 10, w, h], fill=borde)
    # logo (bolsa de compras simple)
    cx, cy = int(w * 0.70), int(h * 0.36)
    d.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=blanco)
    d.rectangle([cx - 9, cy - 5, cx + 9, cy + 10], fill=violeta)
    d.arc([cx - 6, cy - 13, cx + 6, cy - 1], 180, 360, fill=violeta, width=3)
    # insignias de reconocimiento (lado izquierdo del pecho)
    ix, iy = int(w * 0.28), int(h * 0.38)
    for ins in insignias:
        if ins == 'estrella':
            estrella(d, ix, iy, 16, dorado)
        elif ins == 'estrella2':
            estrella(d, ix, iy + 32, 12, blanco)
        elif ins == 'medalla':
            d.polygon([(ix - 10, iy - 26), (ix - 2, iy - 26), (ix + 4, iy - 8), (ix - 4, iy - 8)], fill=violeta)
            d.polygon([(ix + 10, iy - 26), (ix + 2, iy - 26), (ix - 4, iy - 8), (ix + 4, iy - 8)], fill=turquesa)
            d.ellipse([ix - 15, iy - 10, ix + 15, iy + 20], fill=blanco)
            estrella(d, ix, iy + 5, 11, dorado)

    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(capa, (0, 0), mask)
    # abertura en V al centro (deja ver la polera)
    v = Image.new('L', (w, h), 0)
    ImageDraw.Draw(v).polygon([(w * 0.36, 0), (w * 0.64, 0), (w * 0.5, h * 0.55)], fill=255)
    out.putalpha(Image.composite(Image.new('L', (w, h), 0), out.split()[3], v))
    # cierre central
    ImageDraw.Draw(out).line([(w * 0.5, h * 0.55), (w * 0.5, h - 10)], fill=borde, width=3)
    return out


for nombre, params in VARIANTES.items():
    archivo = 'chaleco.png' if nombre == 'basico' else f'chaleco_{nombre}.png'
    chaleco(*params).save(DIR / archivo)
    print('ok', archivo)
