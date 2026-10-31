"""Exporta desde MakeHuman los cuerpos, peinados, zapatos y expresiones del personaje.

Uso:  python3 tools/mh_exportar.py <carpeta de salida>

Instala el plugin tools/makehuman/9_mision_reponedor.py en los plugins de usuario de MakeHuman
(inactivo si no se lo llama así), escribe la configuración y abre MakeHuman (tools/makehuman.sh),
que exporta todo y se cierra solo. Los modelos se pueden afinar a mano: si existe
tools/makehuman/modelos/<nombre>.mhm se usa ese archivo (guardado desde MakeHuman).
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MH = RAIZ / 'tools' / 'makehuman'
PLUGINS = pathlib.Path.home() / 'Documentos' / 'makehuman' / 'v1py3' / 'plugins'

PELOS = ['short02', 'short04', 'short01', 'short03', 'afro01', 'bob02', 'long01', 'ponytail01', 'bob01', 'braid01']
EXPRESIONES = ['neutra', 'sleep01', 'smile02', 'vocalize01', 'sad01']
BASE = {'macrodetails/Age': 0.5, 'macrodetails-universal/Muscle': 0.55, 'macrodetails-universal/Weight': 0.5,
        'macrodetails-height/Height': 0.5, 'macrodetails-proportions/BodyProportions': 0.6,
        'macrodetails/African': 0.34, 'macrodetails/Asian': 0.33, 'macrodetails/Caucasian': 0.33}
MODELOS = [
    {'nombre': 'hombre', 'modificadores': {**BASE, 'macrodetails/Gender': 1.0}, 'cejas': 'eyebrow001'},
    {'nombre': 'mujer', 'modificadores': {**BASE, 'macrodetails/Gender': 0.0}, 'cejas': 'eyebrow010'},
    {'nombre': 'nobinario', 'modificadores': {**BASE, 'macrodetails/Gender': 0.5}, 'cejas': 'eyebrow006'},
]

salida = pathlib.Path(sys.argv[1]).resolve()
salida.mkdir(parents=True, exist_ok=True)
for f in ('listo.txt', 'error.txt'):
    (salida / f).unlink(missing_ok=True)
PLUGINS.mkdir(parents=True, exist_ok=True)
shutil.copy(MH / '9_mision_reponedor.py', PLUGINS / '9_mision_reponedor.py')
# MakeHuman solo carga los plugins de usuario que estén en "activeUserPlugins".
ajustes = PLUGINS.parent / 'settings.ini'
if ajustes.exists():
    datos = json.loads(ajustes.read_text())
    if '9_mision_reponedor' not in datos.get('activeUserPlugins', []):
        datos.setdefault('activeUserPlugins', []).append('9_mision_reponedor')
        ajustes.write_text(json.dumps(datos, indent=4))
modelos = []
for m in MODELOS:
    mhm = MH / 'modelos' / (m['nombre'] + '.mhm')
    modelos.append({**m, 'mhm': str(mhm) if mhm.exists() else None, 'pestanas': 'eyelashes01', 'pelos': PELOS,
                    'zapatos': ['shoes01'], 'expresiones': EXPRESIONES})
config = salida / 'config.json'
config.write_text(json.dumps({'salida': str(salida), 'modelos': modelos}, indent=1))
p = subprocess.Popen([str(RAIZ / 'tools' / 'makehuman.sh')], env={**os.environ, 'MISION_EXPORT': str(config)},
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
inicio = time.time()
while p.poll() is None and time.time() - inicio < 900:
    time.sleep(2)
if (salida / 'error.txt').exists():
    print((salida / 'error.txt').read_text())
    sys.exit(1)
print('listo' if (salida / 'listo.txt').exists() else 'MakeHuman terminó sin exportar')
print(sorted(f.name for f in salida.iterdir()))
