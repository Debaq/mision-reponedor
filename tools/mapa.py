"""Genera el mapa del supermercado: fondo y piezas que pueden tapar al personaje.

Uso:  npm run mapa   (equivale a: uv run --with pillow python tools/mapa.py)

1. Blender modela y renderiza el mapa y una máscara por pieza (tools/gen_mapa.py), en .cache/mapa.
2. El fondo se guarda como public/assets/mapa/mapa.jpg.
3. Cada pieza se recorta del fondo con su máscara y se empaqueta en public/assets/mapa/piezas.png, con
   su JSON para Phaser (formato "hash" con recorte: dibujada en 0, 0 queda en su lugar sobre el fondo).
"""
import json
import pathlib
import subprocess

from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CACHE = RAIZ / '.cache' / 'mapa'
OUT = RAIZ / 'public' / 'assets' / 'mapa'
ANCHO_MAX = 2048
MARGEN = 2

subprocess.run(['blender', '-b', '-P', str(RAIZ / 'tools' / 'gen_mapa.py')], check=True, stdout=subprocess.DEVNULL)
OUT.mkdir(parents=True, exist_ok=True)
fondo = Image.open(CACHE / 'mapa.png').convert('RGB')
fondo.save(OUT / 'mapa.jpg', quality=88)

piezas = []
for f in sorted((CACHE / 'piezas').glob('*.png')):
    alfa = Image.open(f).getchannel('A')
    caja = alfa.getbbox()
    if not caja:
        continue
    im = fondo.crop(caja).convert('RGBA')
    im.putalpha(alfa.crop(caja))
    piezas.append((f.stem, im, caja))

# Empaquetado por estantes, de la más alta a la más baja.
piezas.sort(key=lambda p: -p[1].height)
x = y = alto_estante = 0
ubicacion = {}
for nombre, im, _ in piezas:
    if x + im.width > ANCHO_MAX:
        x, y, alto_estante = 0, y + alto_estante + MARGEN, 0
    ubicacion[nombre] = (x, y)
    x += im.width + MARGEN
    alto_estante = max(alto_estante, im.height)
atlas = Image.new('RGBA', (ANCHO_MAX, y + alto_estante), (0, 0, 0, 0))
frames = {}
for nombre, im, caja in piezas:
    ax, ay = ubicacion[nombre]
    atlas.paste(im, (ax, ay))
    frames[nombre] = {
        'frame': {'x': ax, 'y': ay, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': True,
        'spriteSourceSize': {'x': caja[0], 'y': caja[1], 'w': im.width, 'h': im.height},
        'sourceSize': {'w': fondo.width, 'h': fondo.height},
    }
atlas.save(OUT / 'piezas.png', optimize=True)
(OUT / 'piezas.json').write_text(json.dumps({'frames': frames, 'meta': {'image': 'piezas.png', 'size': {'w': atlas.width, 'h': atlas.height}}}))
print(f'mapa: {len(frames)} piezas, atlas {atlas.width}x{atlas.height}, {(OUT / "piezas.png").stat().st_size // 1024} KB')
