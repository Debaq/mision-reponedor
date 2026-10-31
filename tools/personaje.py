"""Genera el atlas del personaje 3D (todas las capas en todas las poses).

Uso:  npm run personaje   (equivale a: uv run --with pillow python tools/personaje.py)

1. Blender renderiza cada capa en cada pose (tools/gen_personaje.py -- capas <carpeta>).
2. Cada imagen se recorta a su contenido y se empaqueta en public/assets/personaje3d/personaje.png,
   con su JSON para Phaser (formato "hash" con recorte, así las capas siguen alineadas).
"""
import json
import pathlib
import subprocess
import tempfile

from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
OUT = RAIZ / 'public' / 'assets' / 'personaje3d'
ANCHO_MAX = 2048
MARGEN = 2

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['blender', '-b', '-P', str(RAIZ / 'tools' / 'gen_personaje.py'), '--', 'capas', tmp],
                   check=True, stdout=subprocess.DEVNULL)
    piezas = []
    for f in sorted(pathlib.Path(tmp).glob('*.png')):
        im = Image.open(f).convert('RGBA')
        caja = im.getbbox() or (0, 0, 1, 1)
        piezas.append((f.stem.replace('__', '/'), im.crop(caja), caja, im.size))

# Empaquetado por estantes, de la más alta a la más baja.
piezas.sort(key=lambda p: -p[1].height)
x = y = alto_estante = 0
ubicacion = {}
for nombre, im, _, _ in piezas:
    if x + im.width > ANCHO_MAX:
        x, y, alto_estante = 0, y + alto_estante + MARGEN, 0
    ubicacion[nombre] = (x, y)
    x += im.width + MARGEN
    alto_estante = max(alto_estante, im.height)
atlas = Image.new('RGBA', (ANCHO_MAX, y + alto_estante), (0, 0, 0, 0))
frames = {}
for nombre, im, caja, tam in piezas:
    ax, ay = ubicacion[nombre]
    atlas.paste(im, (ax, ay))
    frames[nombre] = {
        'frame': {'x': ax, 'y': ay, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': True,
        'spriteSourceSize': {'x': caja[0], 'y': caja[1], 'w': im.width, 'h': im.height},
        'sourceSize': {'w': tam[0], 'h': tam[1]},
    }
OUT.mkdir(parents=True, exist_ok=True)
atlas.save(OUT / 'personaje.png', optimize=True)
(OUT / 'personaje.json').write_text(json.dumps({'frames': frames, 'meta': {'image': 'personaje.png', 'size': {'w': atlas.width, 'h': atlas.height}}}))
print(f'{len(frames)} capas, atlas {atlas.width}x{atlas.height}, {(OUT / "personaje.png").stat().st_size // 1024} KB')
