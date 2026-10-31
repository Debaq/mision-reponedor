"""Lámina antes/después de las muestras de luz (tools/muestras.py): una fila por cosa, lado a lado.

Uso:  npm run comparar -- <antes> <despues>
Deja .cache/muestras/<antes>_vs_<despues>.png.
"""
import pathlib
import sys

from PIL import Image, ImageDraw

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MUESTRAS = RAIZ / '.cache' / 'muestras'
ANCHO = 640       # ancho de cada imagen en la lámina
FONDO = (120, 128, 140)   # gris medio: deja ver la sombra y el borde de las imágenes transparentes
TITULO = 28
ALTO_MAX = 360    # personaje y productos no crecen más que esto

if len(sys.argv) != 3:
    sys.exit(__doc__)
antes, despues = (MUESTRAS / e for e in sys.argv[1:])
nombres = sorted({f.name for f in antes.iterdir()} & {f.name for f in despues.iterdir()})
if not nombres:
    sys.exit('Las dos etiquetas no tienen muestras en común.')


def cargar(f):
    im = Image.open(f).convert('RGBA')
    k = min(ANCHO / im.width, ALTO_MAX / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    fondo = Image.new('RGBA', im.size, FONDO + (255,))
    return Image.alpha_composite(fondo, im)


filas = [(n, cargar(antes / n), cargar(despues / n)) for n in nombres]
alto = sum(TITULO + max(a.height, d.height) for _, a, d in filas) + TITULO
lamina = Image.new('RGB', (ANCHO * 2 + 30, alto), (32, 38, 48))
dibujo = ImageDraw.Draw(lamina)
dibujo.text((10, 8), sys.argv[1], fill='white')
dibujo.text((ANCHO + 20, 8), sys.argv[2], fill='white')
y = TITULO
for n, a, d in filas:
    dibujo.text((10, y + 8), n, fill=(200, 200, 200))
    y += TITULO
    lamina.paste(a, (10, y))
    lamina.paste(d, (ANCHO + 20, y))
    y += max(a.height, d.height)
salida = MUESTRAS / f'{sys.argv[1]}_vs_{sys.argv[2]}.png'
lamina.save(salida)
print(salida)
