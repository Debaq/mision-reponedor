"""Muestra de los colores de marca con la luz común de bl_util.escena(): un cubo y un cilindro por color,
sobre piso claro. Sirve para ver si un cambio de luz o de curva de tonos corre los colores.

Uso interno (lo llama tools/muestras.py):  MUESTRA=<carpeta> blender -b -P tools/gen_muestra_marca.py
Deja <carpeta>/marca.png.
"""
import math
import pathlib
import sys

import bpy

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bl_util import caja, cil, escena, muestra  # noqa: E402

# Violeta y turquesa de marca, amarillo de estrellas, más blanco y una piel de referencia.
COLORES = ['#553c9a', '#38b2ac', '#f6c343', '#f7fafc', '#c68642']

escena(800, 360, fondo='#dfe8ee', sol_rot=(50, 0, 15), sol=1.5, ambiente=0.55)
caja(0, 0, -0.05, 12, 6, 0.05, '#e6e9ee')
for i, color in enumerate(COLORES):
    x = (i - (len(COLORES) - 1) / 2) * 1.5
    caja(x - 0.3, 0, 0, 0.55, 0.55, 0.55, color)
    cil(x + 0.35, 0, 0, 0.28, 0.7, color, n=32)
bpy.ops.object.camera_add(location=(0, -9, 3.2), rotation=(math.radians(72), 0, 0))
cam = bpy.context.object
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 8
bpy.context.scene.camera = cam
bpy.context.scene.render.filepath = str(muestra() / 'marca.png')
bpy.ops.render.render(write_still=True)
