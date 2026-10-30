"""Mapa isométrico del supermercado "El Barrio", modelado y renderizado con Blender.

Uso:  npm run mapa   (equivale a: blender -b -P tools/gen_mapa.py)

Genera:
- public/assets/mapa/mapa.jpg: el fondo (1600x900, el juego lo muestra a 1280x720).
- src/data/mapa.json: dónde quedan en pantalla las zonas tocables (polígonos), los letreros y la entrada,
  en coordenadas del juego (1280x720).
"""
import json
import math
import pathlib
import random

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PASILLOS = json.loads((RAIZ / 'src' / 'data' / 'pasillos.json').read_text())
W, H = 1600, 900
JUEGO = (1280, 720)
random.seed(7)


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
def escena():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    s = bpy.context.scene
    motores = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in motores else 'BLENDER_EEVEE'
    s.render.resolution_x, s.render.resolution_y = W, H
    s.view_settings.view_transform = 'Standard'
    try:
        s.eevee.use_shadows = True
    except AttributeError:
        pass
    w = s.world or bpy.data.worlds.new('w')
    s.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (*[lineal(c) for c in hexa('#8fb9c9')], 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(42), math.radians(18), math.radians(-30)))
    sol = bpy.context.object
    sol.data.energy = 3.0
    sol.data.angle = math.radians(25)


VIOLETA, TURQUESA = '#553c9a', '#38b2ac'
CARTON, CARTON_OSC = '#c89b62', '#9c7442'
AZUL_RACK = '#2b6cb0'

# Planta (metros): x de -13 a 13, y de -9 a 9. La cámara mira desde el frente-derecha,
# así que las paredes altas son las del fondo (y = 9) y la izquierda (x = -13).
X0, X1, Y0, Y1 = -12, 12, -8, 8
BODEGA = (-12, 1.5, -5.2, 8)        # x0, y0, x1, y1
# Pasillos en grilla 2x2 (centro x, centro y), en el orden de pasillos.json: 1 y 2 al fondo, 3 y 4 adelante.
PASILLO_C = [(-1.2, 4.6), (6.6, 4.6), (-1.2, -1.6), (6.6, -1.6)]
PASILLO_T = (3.2, 2.5)              # medio ancho y medio largo de cada zona


def paredes():
    alto, bajo, g = 2.6, 0.45, 0.3
    caja(X0 - g / 2, 0, 0, g, Y1 - Y0 + g, alto, VIOLETA)            # izquierda
    caja(0, Y1 + g / 2, 0, X1 - X0 + g, g, alto, VIOLETA)            # fondo
    caja(X0 - g / 2, 0, alto, g + 0.02, Y1 - Y0 + g, 0.18, TURQUESA)
    caja(0, Y1 + g / 2, alto, X1 - X0 + g, g + 0.02, 0.18, TURQUESA)
    # Muros bajos del frente y la derecha (con la entrada al centro del frente)
    caja(X1 + g / 2, 0, 0, g, Y1 - Y0 + g, bajo, VIOLETA)
    caja((X0 - 2) / 2, Y0 - g / 2, 0, -2 - X0, g, bajo, VIOLETA)
    caja((X1 + 2) / 2, Y0 - g / 2, 0, X1 - 2, g, bajo, VIOLETA)


def bodega():
    x0, y0, x1, y1 = BODEGA
    piso_ajedrez(x0, y0, x1, y1, '#3d4852', '#4a5568', 1.0, 0.01)
    # Muros interiores con puerta
    caja(x1 + 0.15, (y0 + y1) / 2 + 1.2, 0, 0.3, y1 - y0 - 2.4, 1.1, '#6b46c1')
    caja((x0 + x1) / 2 - 1.0, y0 - 0.15, 0, x1 - x0 - 2.0, 0.3, 1.1, '#6b46c1')
    caja(x1 + 0.15, (y0 + y1) / 2 + 1.2, 1.1, 0.32, y1 - y0 - 2.4, 0.12, TURQUESA)
    caja((x0 + x1) / 2 - 1.0, y0 - 0.15, 1.1, x1 - x0 - 2.0, 0.32, 0.12, TURQUESA)
    # Racks azules con cajas contra el fondo
    for rx in (-10.6, -8.0):
        for k, z in enumerate((0, 0.75, 1.5)):
            caja(rx, y1 - 0.6, z + 0.6, 2.2, 0.9, 0.06, '#e2e8f0')
            for bx in (-0.7, 0, 0.7):
                if random.random() < 0.85:
                    caja(rx + bx, y1 - 0.6, z + 0.66, 0.6, 0.7, 0.5, random.choice((CARTON, '#b88a52', '#d3a86e')))
        for px in (-1.1, 1.1):
            for py in (-0.45, 0.45):
                caja(rx + px, y1 - 0.6 + py, 0, 0.08, 0.08, 2.3, AZUL_RACK)
    # Pilas de cajas en pallets
    for (px, py) in ((-10.8, 3.4), (-8.6, 3.0), (-6.4, 4.6), (-6.4, 6.8)):
        caja(px, py, 0, 1.4, 1.2, 0.14, '#a0794a')
        for i in range(random.randint(3, 5)):
            caja(px + random.uniform(-0.3, 0.3), py + random.uniform(-0.2, 0.2), 0.14 + i * 0.42, 0.9, 0.8, 0.42,
                 random.choice((CARTON, CARTON_OSC, '#d3a86e')), rz=random.uniform(-0.1, 0.1))
    letrero(x1 - 0.8, y0 - 0.8, '#3d4852')
    # Transpaleta
    caja(-11.2, 5.2, 0, 0.5, 1.2, 0.12, '#e53e3e')
    caja(-11.2, 4.6, 0, 0.12, 0.12, 0.9, '#2d3748')


PALETAS = {
    'alimentos': ['#e53e3e', '#dd6b20', '#ecc94b', '#c05621', '#f6e05e', '#9c4221', '#38a169'],
    'bebidas': ['#3182ce', '#63b3ed', '#2f855a', '#e53e3e', '#bee3f8', '#2c5282'],
    'limpieza': ['#319795', '#3182ce', '#f7fafc', '#81e6d9', '#2b6cb0', '#ecc94b'],
    'higiene': ['#d53f8c', '#f687b3', '#b794f4', '#f7fafc', '#fbb6ce', '#805ad5'],
}


def letrero(x, y, color, alto=2.5):
    """Letrero en poste, mirando a la cámara (el texto lo pone el juego encima)."""
    caja(x, y, 0, 0.1, 0.1, alto, '#4a5568')
    caja(x, y, alto, 2.2, 0.12, 0.95, color, rz=math.radians(45), rough=0.5)
    caja(x, y, alto - 0.03, 2.3, 0.1, 1.01, '#f7fafc', rz=math.radians(45))


def pasillos():
    zonas = {}
    mx, my = PASILLO_T
    for i, (id_, p) in enumerate(PASILLOS.items()):
        cx, cy = PASILLO_C[i]
        # Alfombra del color del pasillo (marca la zona)
        caja(cx, cy, 0, 2 * mx, 2 * my, 0.03, p['color'], rough=0.8)
        caja(cx, cy, 0.03, 2 * mx - 0.3, 2 * my - 0.3, 0.01, '#f7fafc')
        caja(cx, cy, 0.04, 2 * mx - 0.5, 2 * my - 0.5, 0.01, p['color'])
        bot = id_ in ('bebidas', 'limpieza')
        # Dos góndolas de doble cara a lo largo de x
        for k, lado in enumerate((-1, 1)):
            gondola_x(cx, cy + lado * 1.15, cx - mx + 0.5, cx + mx - 0.5, PALETAS[id_], bot if k == 0 else not bot)
        letrero(cx, cy, p['color'], alto=3.0)
        zonas[id_] = {'caja': (cx - mx, cy - my, cx + mx, cy + my), 'letrero': (cx, cy, 3.47)}
    return zonas


def gondola_x(x_c, y, x0, x1, paleta, botellas=False):
    """Góndola de doble cara a lo largo de x, con productos hacia ambos lados."""
    largo = x1 - x0
    caja(x_c, y, 0, largo, 0.9, 0.25, '#cbd5e0')
    caja(x_c, y, 0, largo, 0.08, 1.75, '#e2e8f0')
    for z in (0.25, 0.7, 1.15):
        caja(x_c, y, z, largo, 0.9, 0.05, '#f7fafc')
        for lado in (-1, 1):
            x = x0 + 0.2
            color = random.choice(paleta)
            while x < x1 - 0.15:
                if random.random() < 0.2:
                    color = random.choice(paleta)
                if botellas:
                    cil(x, y + lado * 0.22, z + 0.05, 0.09, 0.36, color, n=8)
                    x += 0.22
                else:
                    caja(x, y + lado * 0.22, z + 0.05, 0.26, 0.3, random.choice((0.3, 0.36, 0.4)), color)
                    x += 0.3
            for ex in range(int(largo // 1.2)):
                caja(x0 + 0.6 + ex * 1.2, y + lado * 0.46, z - 0.01, 0.22, 0.02, 0.08, '#f6c343')


def frente():
    # Cajas registradoras
    for cx in (5.0, 7.6, 10.2):
        caja(cx, -6.2, 0, 0.9, 2.0, 0.9, '#f7fafc')
        caja(cx, -6.2, 0.9, 0.5, 1.6, 0.04, '#2d3748')
        caja(cx + 0.25, -6.9, 0.9, 0.35, 0.3, 0.35, '#4a5568')
        caja(cx + 0.25, -6.9, 1.25, 0.32, 0.05, 0.25, '#90cdf4')
        caja(cx, -5.0, 0, 0.06, 0.06, 1.6, '#4a5568')
        caja(cx, -5.0, 1.6, 0.5, 0.06, 0.3, '#48bb78')
    # Carros de supermercado junto a la entrada
    for k in range(5):
        cx, cy = -3.6 + k * 0.28, -6.8
        caja(cx, cy, 0.3, 0.55, 0.8, 0.45, '#a0aec0')
        caja(cx, cy, 0.0, 0.5, 0.75, 0.05, '#4a5568')
    # Entrada: marco violeta, puertas de vidrio abiertas y alfombra
    for px in (-2.0, 2.0):
        caja(px, Y0, 0, 0.3, 0.3, 2.4, VIOLETA)
    caja(0, Y0, 2.4, 4.3, 0.32, 0.35, VIOLETA)
    caja(0, Y0, 2.75, 4.3, 0.34, 0.08, TURQUESA)
    for px in (-1.55, 1.55):
        caja(px, Y0, 0, 0.6, 0.06, 2.3, '#bee3f8', rough=0.2)
    caja(0, Y0 + 1.0, 0, 3.0, 1.6, 0.03, VIOLETA)
    caja(0, Y0 + 1.0, 0.03, 2.6, 1.2, 0.01, TURQUESA)
    # Fruta y verdura (decoración, lado izquierdo del frente)
    for i, (fx, fy) in enumerate(((-10.2, -1.2), (-10.2, -4.2), (-7.4, -2.7))):
        caja(fx, fy, 0, 2.2, 1.4, 0.7, '#8b5e3c')
        colores = ['#e53e3e', '#ed8936', '#48bb78', '#ecc94b']
        for gx in range(5):
            for gy in range(3):
                bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.17,
                                                     location=(fx - 0.85 + gx * 0.42, fy - 0.42 + gy * 0.42, 0.85))
                o = bpy.context.object
                o.data.materials.append(mat(colores[(i + gx // 2) % 4], 0.7))
    # Refrigeradores contra la pared izquierda
    for fy in (-6.8, -5.3):
        caja(-11.4, fy, 0, 0.9, 1.4, 1.9, '#e2e8f0')
        caja(-10.94, fy, 0.2, 0.04, 1.2, 1.5, '#bee3f8', rough=0.2)


def persona(x, y, polera, pelo='#2d3748', piel='#e0ac69', rz=0):
    """Persona low-poly (decoración, estilo maqueta)."""
    caja(x - 0.09, y, 0, 0.14, 0.16, 0.75, '#2d3748')
    caja(x + 0.09, y, 0, 0.14, 0.16, 0.75, '#2d3748')
    caja(x, y, 0.75, 0.42, 0.24, 0.55, polera, rz=rz)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.16, location=(x, y, 1.48))
    bpy.context.object.data.materials.append(mat(piel, 0.7))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.17, location=(x, y + 0.03, 1.55))
    o = bpy.context.object
    o.scale = (1, 1, 0.6)
    o.data.materials.append(mat(pelo, 0.8))


def gente():
    persona(0.4, 4.6, '#e53e3e', '#4a3728', '#c68642')
    persona(7.8, -1.6, '#3182ce', '#1a202c', '#f1c27d')
    persona(2.6, 1.5, '#ecc94b', '#744210', '#8d5524')
    persona(1.0, -5.0, '#48bb78', '#2d3748', '#e0ac69')
    persona(8.4, -7.0, '#f7fafc', '#1a202c', '#c68642')   # en la caja
    persona(-8.6, -2.6, '#ed8936', '#9b2c2c', '#f1c27d')


def camara():
    bpy.ops.object.camera_add(location=(26, -26, 19))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 34
    centro = Vector((1.0, 1.2, 0))
    cam.rotation_euler = (centro - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    return cam


def proyectar(cam, p):
    v = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return [round(v.x * JUEGO[0], 1), round((1 - v.y) * JUEGO[1], 1)]


def envolvente(puntos):
    """Envolvente convexa (Andrew) de puntos 2D."""
    pts = sorted(set(map(tuple, puntos)))
    if len(pts) < 3:
        return [list(p) for p in pts]

    def cruz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    abajo, arriba = [], []
    for p in pts:
        while len(abajo) >= 2 and cruz(abajo[-2], abajo[-1], p) <= 0:
            abajo.pop()
        abajo.append(p)
    for p in reversed(pts):
        while len(arriba) >= 2 and cruz(arriba[-2], arriba[-1], p) <= 0:
            arriba.pop()
        arriba.append(p)
    return [list(p) for p in abajo[:-1] + arriba[:-1]]


def zona_pantalla(cam, x0, y0, x1, y1, alto):
    esquinas = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (0, alto)]
    return envolvente([proyectar(cam, p) for p in esquinas])


escena()
piso_ajedrez(X0, Y0, X1, Y1, '#f3e9d8', '#e6d8bf', 1.0)
bpy.ops.mesh.primitive_plane_add(location=(0, 0, -0.02))
suelo = bpy.context.object
suelo.scale = (60, 60, 1)
suelo.data.materials.append(mat('#8fb9c9'))
paredes()
bodega()
zonas_pas = pasillos()
frente()
gente()
cam = camara()

out_img = RAIZ / 'public' / 'assets' / 'mapa'
out_img.mkdir(parents=True, exist_ok=True)
s = bpy.context.scene
s.render.image_settings.file_format = 'JPEG'
s.render.image_settings.quality = 88
s.render.filepath = str(out_img / 'mapa.jpg')
bpy.ops.render.render(write_still=True)

datos = {'_info': 'Generado por tools/gen_mapa.py (npm run mapa). Coordenadas del juego (1280x720).'}
bx0, by0, bx1, by1 = BODEGA
datos['bodega'] = {'poligono': zona_pantalla(cam, bx0, by0, bx1, by1, 2.6),
                   'centro': proyectar(cam, ((bx0 + bx1) / 2, (by0 + by1) / 2, 0)),
                   'letrero': proyectar(cam, (bx1 - 0.8, by0 - 0.8, 2.97)),
                   'puerta': proyectar(cam, (bx1 + 0.8, by0 - 0.6, 0))}
for id_, z in zonas_pas.items():
    x0, y0, x1, y1 = z['caja']
    datos[id_] = {'poligono': zona_pantalla(cam, x0, y0, x1, y1, 1.8),
                  'centro': proyectar(cam, ((x0 + x1) / 2, (y0 + y1) / 2, 0)),
                  'letrero': proyectar(cam, z['letrero'])}
datos['entrada'] = {'centro': proyectar(cam, (0, Y0 + 1.0, 0))}
(RAIZ / 'src' / 'data' / 'mapa.json').write_text(json.dumps(datos, ensure_ascii=False, indent=1))
print('mapa listo')
