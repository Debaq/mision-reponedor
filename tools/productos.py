"""Genera las imágenes de los productos nuevos (los que no vienen de Kenney).

Uso:  npm run productos [-- id ...]   (equivale a: uv run --with pillow python tools/productos.py)

1. Blender renderiza cada modelo de tools/gen_productos.py a 512 px.
2. Se recorta y reduce a 128 px, apoyado abajo, igual que los productos de Kenney.
"""
import pathlib, subprocess, sys, tempfile

from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
OUT = RAIZ / 'public' / 'assets' / 'productos'
TAM, ALTO_MAX, MARGEN_ABAJO = 128, 116, 6

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['blender', '-b', '-P', str(RAIZ / 'tools' / 'gen_productos.py'), '--', tmp, *sys.argv[1:]],
                   check=True, stdout=subprocess.DEVNULL)
    for f in sorted(pathlib.Path(tmp).glob('*.png')):
        im = Image.open(f).convert('RGBA')
        im = im.crop(im.getbbox())
        k = ALTO_MAX / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        lienzo = Image.new('RGBA', (TAM, TAM), (0, 0, 0, 0))
        lienzo.alpha_composite(im, ((TAM - im.width) // 2, TAM - MARGEN_ABAJO - im.height))
        lienzo.save(OUT / f.name, optimize=True)
        print('ok', f.stem)
