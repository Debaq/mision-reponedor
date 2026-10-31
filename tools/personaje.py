"""Genera los atlas del personaje (un atlas por cuerpo, con todas las capas en todas las poses).

Uso:  npm run personaje [-- cuerpo ...]   (equivale a: uv run --with pillow python tools/personaje.py)

1. MakeHuman exporta cuerpos, peinados, zapatos y expresiones (tools/mh_exportar.py) a .cache/mh.
   Solo la primera vez o si se borra esa carpeta (o se cambia un modelo en tools/makehuman/modelos).
2. Blender arma y viste cada cuerpo y renderiza cada capa en cada pose (tools/gen_personaje_mh.py).
3. Cada imagen se recorta a su contenido y se empaqueta en public/assets/personaje3d/<cuerpo>.png,
   con su JSON para Phaser (formato "hash" con recorte, así las capas siguen alineadas).
"""
import json
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
OUT = RAIZ / 'public' / 'assets' / 'personaje3d'
MH = RAIZ / '.cache' / 'mh'
CUERPOS = sys.argv[1:] or ['hombre', 'mujer', 'nobinario']
ANCHO_MAX = 2048
MARGEN = 2


def empaquetar(carpeta, nombre):
    piezas = []
    for f in sorted(carpeta.glob('*.png')):
        im = Image.open(f).convert('RGBA')
        caja = im.getbbox() or (0, 0, 1, 1)
        piezas.append((f.stem.replace('__', '/'), im.crop(caja), caja, im.size))
    # Empaquetado por estantes, de la más alta a la más baja.
    piezas.sort(key=lambda p: -p[1].height)
    x = y = alto_estante = 0
    ubicacion = {}
    for clave, im, _, _ in piezas:
        if x + im.width > ANCHO_MAX:
            x, y, alto_estante = 0, y + alto_estante + MARGEN, 0
        ubicacion[clave] = (x, y)
        x += im.width + MARGEN
        alto_estante = max(alto_estante, im.height)
    atlas = Image.new('RGBA', (ANCHO_MAX, y + alto_estante), (0, 0, 0, 0))
    frames = {}
    for clave, im, caja, tam in piezas:
        ax, ay = ubicacion[clave]
        atlas.paste(im, (ax, ay))
        frames[clave] = {
            'frame': {'x': ax, 'y': ay, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': True,
            'spriteSourceSize': {'x': caja[0], 'y': caja[1], 'w': im.width, 'h': im.height},
            'sourceSize': {'w': tam[0], 'h': tam[1]},
        }
    atlas.save(OUT / f'{nombre}.png', optimize=True)
    (OUT / f'{nombre}.json').write_text(json.dumps({'frames': frames, 'meta': {'image': f'{nombre}.png', 'size': {'w': atlas.width, 'h': atlas.height}}}))
    print(f'{nombre}: {len(frames)} capas, atlas {atlas.width}x{atlas.height}, {(OUT / f"{nombre}.png").stat().st_size // 1024} KB')


if not (MH / 'listo.txt').exists():
    subprocess.run([sys.executable, str(RAIZ / 'tools' / 'mh_exportar.py'), str(MH)], check=True)
OUT.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['blender', '-b', '-P', str(RAIZ / 'tools' / 'gen_personaje_mh.py'), '--', 'capas', str(MH), tmp, *CUERPOS],
                   check=True, stdout=subprocess.DEVNULL)
    for cuerpo in CUERPOS:
        empaquetar(pathlib.Path(tmp) / cuerpo, cuerpo)
