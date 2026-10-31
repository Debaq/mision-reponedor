"""Renderiza productos low-poly (estilo Kenney Food Kit) con Blender.

No se usa directo: lo llama tools/productos.py (npm run productos), que además
recorta y reduce los renders a 128 px como los productos de Kenney.
Uso interno:  blender -b -P tools/gen_productos.py -- <carpeta> [id ...]
"""
import math, pathlib, sys
import bpy
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bl_util  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = args[0] if args else '/tmp'
SOLO = set(args[1:])


def limpiar():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def lineal(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(color):
    m = bpy.data.materials.new(name=f'm{len(bpy.data.materials)}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[lineal(c) for c in color], 1)
    b.inputs['Roughness'].default_value = 1.0
    if 'Specular IOR Level' in b.inputs:
        b.inputs['Specular IOR Level'].default_value = 0.0
    return m


def poner(obj, color):
    obj.data.materials.append(mat(color))
    for p in obj.data.polygons:
        p.use_smooth = False
    return obj


def caja(x, y, z, sx, sy, sz, color, rz=0):
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z), rotation=(0, 0, rz))
    o = bpy.context.object
    bl_util.escalar_malla(o, sx / 2, sy / 2, sz / 2)
    poner(o, color)
    # Cantos apenas redondeados: siguen facetados como los productos de Kenney, pero atrapan la luz.
    if min(sx, sy, sz) >= 0.05:
        bl_util.biselar(o, min(sx, sy, sz) * 0.06)
    return o


def cil(x, y, z, r, h, color, n=10, sx=1, sy=1, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h, location=(x, y, z))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r2, depth=h, location=(x, y, z))
    o = bpy.context.object
    o.scale = (sx, sy, 1)
    return poner(o, color)


BLANCO = (238, 240, 244)
GRIS = (170, 178, 188)

# Cada modelo apoya en z=0 y mira hacia -Y (frente).
def detergente():
    caja(0, 0, 0.65, 1.0, 0.6, 1.3, (52, 120, 210))
    caja(0, -0.305, 0.6, 0.7, 0.02, 0.6, BLANCO)
    caja(0, -0.32, 0.6, 0.5, 0.02, 0.18, (246, 173, 85))
    cil(0.25, 0, 1.38, 0.16, 0.18, (246, 173, 85), n=10)
    caja(-0.25, 0, 1.42, 0.12, 0.4, 0.22, (40, 95, 170))  # asa


def cloro():
    cil(0, 0, 0.6, 0.48, 1.2, BLANCO, n=8, sy=0.75)
    cil(0, 0, 1.28, 0.32, 0.18, BLANCO, n=8, r2=0.18)
    cil(0, 0, 1.45, 0.16, 0.18, (52, 120, 210), n=10)
    caja(0, -0.34, 0.55, 0.6, 0.04, 0.45, (52, 120, 210))
    caja(0, -0.37, 0.55, 0.4, 0.02, 0.12, BLANCO)


def lavaloza():
    cil(0, 0, 0.7, 0.34, 1.4, (72, 187, 120), n=10, sy=0.6)
    cil(0, 0, 1.5, 0.12, 0.2, BLANCO, n=8)
    cil(0, 0, 1.66, 0.07, 0.14, (40, 120, 80), n=8)
    caja(0, -0.21, 0.65, 0.45, 0.02, 0.5, BLANCO)
    cil(0, -0.23, 0.68, 0.12, 0.02, (246, 224, 94), n=10).rotation_euler = (math.pi / 2, 0, 0)


def papel():
    for x in (-0.3, 0.3):
        for y in (-0.3, 0.3):
            for z in (0.33, 0.99):
                cil(x, y, z, 0.29, 0.62, BLANCO, n=12)
                cil(x, y, z + 0.311, 0.09, 0.01, (200, 170, 130), n=10)
    caja(0, -0.6, 0.66, 1.0, 0.02, 0.3, (99, 179, 237))


def shampoo():
    cil(0, 0, 0.75, 0.38, 1.5, (237, 100, 166), n=10, sy=0.55, r2=0.3)
    cil(0, 0, 1.58, 0.24, 0.16, (151, 38, 109), n=10, sy=0.7)
    caja(0, -0.2, 0.7, 0.42, 0.02, 0.6, BLANCO)
    caja(0, -0.22, 0.85, 0.3, 0.02, 0.08, (151, 38, 109))


def jabon():
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0.3))
    o = bpy.context.object
    o.scale = (0.75, 0.45, 0.3)
    bev = o.modifiers.new('b', 'BEVEL')
    bev.width = 0.12
    bev.segments = 2
    poner(o, (183, 148, 244))
    cil(0, 0, 0.61, 0.32, 0.03, (214, 188, 250), n=12, sy=0.5)


def pasta():
    caja(0, 0, 0.4, 1.5, 0.45, 0.8, BLANCO, rz=0)
    caja(0, -0.23, 0.4, 1.5, 0.02, 0.22, (229, 62, 62))
    caja(-0.45, -0.24, 0.62, 0.4, 0.02, 0.14, (49, 130, 206))


def agua():
    cil(0, 0, 0.65, 0.34, 1.3, (190, 227, 248), n=12)
    cil(0, 0, 1.42, 0.34, 0.25, (190, 227, 248), n=12, r2=0.14)
    cil(0, 0, 1.6, 0.15, 0.14, (49, 130, 206), n=10)
    cil(0, 0, 0.7, 0.35, 0.38, (49, 130, 206), n=12)
    cil(0, 0, 0.7, 0.355, 0.12, BLANCO, n=12)


MODELOS = {'detergente': detergente, 'cloro': cloro, 'lavaloza': lavaloza, 'papel': papel,
           'shampoo': shampoo, 'jabon': jabon, 'pasta': pasta, 'agua': agua}


def escena():
    # Luz común del juego (bl_util), con el sol desde arriba a la izquierda: cara superior clara,
    # frente medio, costado derecho más oscuro.
    bl_util.escena(512, 512, fondo='#ffffff', sol_rot=(40, -25, -35), sol=3.4, ambiente=0.45)
    bpy.context.scene.render.film_transparent = True


def camara(objs):
    # Encajar: centro y tamaño del conjunto.
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    centro = (lo + hi) / 2
    tam = max(hi - lo)
    az, el = math.radians(-28), math.radians(22)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * 10
    bpy.ops.object.camera_add(location=centro + d)
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = tam * 1.25
    cam.rotation_euler = (centro - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam


for nombre, f in MODELOS.items():
    if SOLO and nombre not in SOLO:
        continue
    limpiar()
    escena()
    f()
    bpy.context.view_layer.update()
    camara([o for o in bpy.data.objects if o.type == 'MESH'])
    bpy.context.scene.render.filepath = f'{OUT}/{nombre}.png'
    bpy.ops.render.render(write_still=True)
    print('render', nombre)
