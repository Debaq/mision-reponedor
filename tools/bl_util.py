"""Funciones comunes para los renders de Blender (mapa y escenarios).

Se importa desde los scripts que corre Blender: tools/gen_mapa.py y tools/gen_escenarios.py.
"""
import math
import os
import pathlib

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

JUEGO = (1280, 720)


def muestra():
    """Carpeta de muestras (variable MUESTRA, la pone tools/muestras.py) o None. En modo muestra los
    scripts renderizan chico ahí, sin tocar los assets ni los JSON del juego."""
    m = os.environ.get('MUESTRA')
    return pathlib.Path(m) if m else None


def lineal(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexa(h):
    h = h.lstrip('#') if isinstance(h, str) else f'{h:06x}'
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


_mats = {}


def mat(color, rough=0.9):
    color = hexa(color) if not isinstance(color, tuple) else color
    clave = (color, rough)
    if clave in _mats:
        return _mats[clave]
    m = bpy.data.materials.new(name=f'm{len(_mats)}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[lineal(c) for c in color], 1)
    b.inputs['Roughness'].default_value = rough
    _mats[clave] = m
    return m


def caja(x, y, z, sx, sy, sz, color, rz=0, rough=0.9):
    """Caja apoyada en z (z = base)."""
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z + sz / 2), rotation=(0, 0, rz))
    o = bpy.context.object
    o.scale = (sx / 2, sy / 2, sz / 2)
    o.data.materials.append(mat(color, rough))
    return o


def cil(x, y, z, r, h, color, n=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h, location=(x, y, z + h / 2))
    o = bpy.context.object
    o.data.materials.append(mat(color))
    return o


def piso_ajedrez(x0, y0, x1, y1, c1, c2, tam=1.0, z=0.0):
    """Piso de baldosas (un plano con textura de ajedrez)."""
    bpy.ops.mesh.primitive_plane_add(location=((x0 + x1) / 2, (y0 + y1) / 2, z))
    o = bpy.context.object
    o.scale = ((x1 - x0) / 2, (y1 - y0) / 2, 1)
    m = bpy.data.materials.new(name=f'piso{x0}{y0}')
    m.use_nodes = True
    nt = m.node_tree
    chk = nt.nodes.new('ShaderNodeTexChecker')
    chk.inputs['Color1'].default_value = (*[lineal(c) for c in hexa(c1)], 1)
    chk.inputs['Color2'].default_value = (*[lineal(c) for c in hexa(c2)], 1)
    # Coordenadas en metros (Object) → una baldosa de `tam` metros.
    chk.inputs['Scale'].default_value = 1 / tam
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapeo = nt.nodes.new('ShaderNodeMapping')
    mapeo.inputs['Scale'].default_value = ((x1 - x0) / 2, (y1 - y0) / 2, 1)
    nt.links.new(coord.outputs['Object'], mapeo.inputs['Vector'])
    nt.links.new(mapeo.outputs['Vector'], chk.inputs['Vector'])
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.6
    nt.links.new(chk.outputs['Color'], b.inputs['Base Color'])
    o.data.materials.append(m)
    return o


# ---------------------------------------------------------------- escena
# Luz común de fondos, mapa, productos y personaje: sol cálido (~4300 K) con relleno frío del cielo,
# lámparas de ~3500 K y oclusión con rebote de luz (sombras en los rincones).
LUZ_SOL = (50, 5, 20)          # dirección del sol de las escenas de frente y del personaje (grados)
SOL_CALIDO = '#ffe4c4'        # ~5000 K: más naranjo pone crema el blanco
LAMPARA = '#ffc896'
RELLENO = '#b8cde0'            # se mezcla con el color de fondo de cada escena


def mezclar(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(hexa(a), hexa(b)))


def lampara(tipo, pos, energia, tam=None):
    """Luz de techo o lámpara (cálida)."""
    bpy.ops.object.light_add(type=tipo, location=pos)
    luz = bpy.context.object
    luz.data.energy = energia
    luz.data.color = [lineal(c) for c in hexa(LAMPARA)]
    if tam:
        if tipo == 'AREA':
            luz.data.size = tam
        else:
            luz.data.shadow_soft_size = tam
    return luz


def escena(W, H, fondo='#8fb9c9', sol_rot=LUZ_SOL, sol=3.0, ambiente=0.75):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    s = bpy.context.scene
    motores = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in motores else 'BLENDER_EEVEE'
    s.render.resolution_x, s.render.resolution_y = W, H
    # Standard y no AgX: AgX desatura los colores de marca y vuelve gris el blanco de los productos.
    s.view_settings.view_transform = 'Standard'
    s.view_settings.exposure = 0.3
    e = s.eevee
    e.use_shadows = True
    e.use_raytracing = True
    e.use_fast_gi = True
    e.fast_gi_distance = 1.5
    e.shadow_ray_count = 2
    e.shadow_step_count = 8
    e.shadow_resolution_scale = 1.0
    w = s.world or bpy.data.worlds.new('w')
    s.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (*[lineal(c) for c in mezclar(fondo, RELLENO, 0.4)], 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = ambiente
    bpy.ops.object.light_add(type='SUN', rotation=tuple(math.radians(a) for a in sol_rot))
    luz = bpy.context.object
    luz.data.energy = sol
    luz.data.angle = math.radians(15)
    luz.data.color = [lineal(c) for c in hexa(SOL_CALIDO)]


def proyectar(cam, p):
    v = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return [round(v.x * JUEGO[0], 1), round((1 - v.y) * JUEGO[1], 1)]
