"""Banco de pruebas de la luz: renders chicos de una vista de cada cosa, para comparar antes y después
sin regenerar los assets.

Uso:  npm run muestras -- <etiqueta> [cosa ...]
      cosas: sala, bodega, mapa, producto, personaje, marca (por defecto, todas)

Deja los PNG/JPG en .cache/muestras/<etiqueta>/. Para comparar dos etiquetas: npm run comparar.
"""
import os
import pathlib
import subprocess
import sys
import time

RAIZ = pathlib.Path(__file__).resolve().parent.parent
TOOLS = RAIZ / 'tools'
MH = RAIZ / '.cache' / 'mh'


def blender(script, *args):
    return ['blender', '-b', '-P', str(TOOLS / script), '--', *map(str, args)]


def comandos(dest):
    return {
        'sala': blender('gen_escenarios.py', 'sala'),
        'bodega': blender('gen_escenarios.py', 'bodega'),
        'mapa': blender('gen_mapa.py'),
        # Un producto blanco (cloro, para ver si el blanco se quema) y uno de color fuerte (shampoo).
        'producto': blender('gen_productos.py', dest, 'shampoo', 'cloro'),
        'personaje': blender('gen_personaje_mh.py', 'muestra', MH, dest / 'personaje.png'),
        'marca': blender('gen_muestra_marca.py'),
    }


if len(sys.argv) < 2:
    sys.exit(__doc__)
dest = RAIZ / '.cache' / 'muestras' / sys.argv[1]
dest.mkdir(parents=True, exist_ok=True)
todos = comandos(dest)
pedidos = sys.argv[2:] or list(todos)
for cosa in pedidos:
    t = time.time()
    r = subprocess.run(todos[cosa], env={**os.environ, 'MUESTRA': str(dest)}, capture_output=True, text=True)
    # Blender no falla el proceso por errores de Python: se buscan en la salida.
    error = r.returncode or 'Traceback' in r.stdout + r.stderr
    print(f'{cosa}: {"ERROR" if error else "ok"} ({time.time() - t:.0f} s)')
    if error:
        print((r.stdout + r.stderr)[-3000:])
print('listo:', dest)
