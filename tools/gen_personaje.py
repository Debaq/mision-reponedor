"""Personaje 3D del juego (modelo, poses y capas), renderizado con Blender.

Uso:  npm run personaje                         (todas las capas y poses)
      npm run personaje -- preview <carpeta>    (solo vistas previas armadas, para revisar el modelo)

El cuerpo es una sola malla continua hecha con el modificador Skin de Blender (un "esqueleto" de
puntos con radios), con un armature de verdad y pesos automáticos: las poses doblan el cuerpo.
La ropa sale de la misma forma, un poco más gruesa, así calza con el cuerpo en cualquier pose.
Las capas (piel, ropa, pelo, cara) se renderizan en blanco para que el juego las coloree con tint.
"""
import math
import pathlib
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import intersect_point_line

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bl_util import escena, lineal, hexa  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

BLANCO = '#f2f2f2'
_mats = {}


def mat(color, rough=0.6):
    clave = (color, rough)
    if clave in _mats:
        return _mats[clave]
    m = bpy.data.materials.new(name=f'pm{len(_mats)}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[lineal(c) for c in hexa(color)], 1)
    b.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in b.inputs:
        b.inputs['Specular IOR Level'].default_value = 0.2
    _mats[clave] = m
    return m


# ---------------------------------------------------------------- esqueleto (metros; mira hacia -y)
P = {'pelvis': (0, 0, 0.97), 'cintura': (0, 0, 1.1), 'pecho': (0, 0, 1.27), 'cuello': (0, 0, 1.43), 'nuca': (0, 0, 1.49)}
for s, l in ((1, 'd'), (-1, 'i')):
    P.update({
        'hombro_' + l: (s * 0.165, 0.0, 1.385), 'brazo_' + l: (s * 0.195, 0.005, 1.26), 'codo_' + l: (s * 0.215, 0.012, 1.13),
        'antebrazo_' + l: (s * 0.222, 0.0, 1.0), 'muneca_' + l: (s * 0.228, -0.01, 0.885), 'mano_' + l: (s * 0.232, -0.02, 0.8),
        'cadera_' + l: (s * 0.09, 0.0, 0.93), 'muslo_' + l: (s * 0.096, 0.0, 0.72), 'rodilla_' + l: (s * 0.1, 0.0, 0.5),
        'pierna_' + l: (s * 0.1, 0.006, 0.3), 'tobillo_' + l: (s * 0.1, 0.012, 0.09),
    })
ARISTAS = [('pelvis', 'cintura'), ('cintura', 'pecho'), ('pecho', 'cuello'), ('cuello', 'nuca')]
for l in ('d', 'i'):
    ARISTAS += [('pecho', 'hombro_' + l), ('hombro_' + l, 'brazo_' + l), ('brazo_' + l, 'codo_' + l), ('codo_' + l, 'antebrazo_' + l),
                ('antebrazo_' + l, 'muneca_' + l), ('muneca_' + l, 'mano_' + l), ('pelvis', 'cadera_' + l),
                ('cadera_' + l, 'muslo_' + l), ('muslo_' + l, 'rodilla_' + l), ('rodilla_' + l, 'pierna_' + l), ('pierna_' + l, 'tobillo_' + l)]
RADIO = {'pelvis': (0.15, 0.1), 'cintura': (0.13, 0.085), 'pecho': (0.155, 0.098), 'cuello': (0.05, 0.05), 'nuca': (0.046, 0.046),
         'hombro': (0.06, 0.06), 'brazo': (0.052, 0.052), 'codo': (0.044, 0.044), 'antebrazo': (0.042, 0.042),
         'muneca': (0.031, 0.031), 'mano': (0.042, 0.042), 'cadera': (0.088, 0.088), 'muslo': (0.08, 0.08),
         'rodilla': (0.056, 0.056), 'pierna': (0.053, 0.053), 'tobillo': (0.04, 0.04)}
# Huesos: (nombre, desde, hasta, padre)
HUESOS = [('columna1', 'pelvis', 'cintura', None), ('columna2', 'cintura', 'pecho', 'columna1'),
          ('pecho', 'pecho', 'cuello', 'columna2'), ('cuello', 'cuello', 'nuca', 'pecho')]
for l in ('d', 'i'):
    HUESOS += [('clavicula_' + l, 'pecho', 'hombro_' + l, 'pecho'), ('brazo_' + l, 'hombro_' + l, 'codo_' + l, 'clavicula_' + l),
               ('antebrazo_' + l, 'codo_' + l, 'muneca_' + l, 'brazo_' + l), ('mano_' + l, 'muneca_' + l, 'mano_' + l, 'antebrazo_' + l),
               ('cadera_' + l, 'pelvis', 'cadera_' + l, 'columna1'), ('muslo_' + l, 'cadera_' + l, 'rodilla_' + l, 'cadera_' + l),
               ('pierna_' + l, 'rodilla_' + l, 'tobillo_' + l, 'muslo_' + l)]
CABEZA = Vector((0, 0, 1.6))     # centro de la cabeza (antes de agrandarla)
CABEZA_X = 1.22                  # la cabeza se agranda desde la nuca (estilo de las referencias)
ARM = None


def radio(nombre, factor=1.0):
    base = nombre.split('_')[0]
    rx, ry = RADIO[base]
    return (rx * factor, ry * factor)


def coleccion(nombre):
    c = bpy.data.collections.get(nombre) or bpy.data.collections.new(nombre)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


def mover_a(o, col):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)


def armature():
    global ARM
    datos = bpy.data.armatures.new('esqueleto')
    ARM = bpy.data.objects.new('esqueleto', datos)
    bpy.context.scene.collection.objects.link(ARM)
    bpy.context.view_layer.objects.active = ARM
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for nombre, a, b, padre in HUESOS:
        h = datos.edit_bones.new(nombre)
        h.head, h.tail = Vector(P[a]), Vector(P[b])
        if padre:
            h.parent = eb[padre]
        eb[nombre] = h
    h = datos.edit_bones.new('cabeza')
    h.head, h.tail = Vector(P['nuca']), CABEZA + Vector((0, 0, 0.15))
    h.parent = eb['cuello']
    for l, s in (('d', 1), ('i', -1)):
        h = datos.edit_bones.new('pie_' + l)
        h.head, h.tail = Vector(P['tobillo_' + l]), Vector((s * 0.1, -0.14, 0.03))
        h.parent = eb['pierna_' + l]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ARM.pose.bones:
        pb.rotation_mode = 'XYZ'


def malla_skin(nombre, puntos, col, factor=1.0, extra=None, color=BLANCO, rough=0.65):
    """Malla continua (modificador Skin) por los puntos dados, pegada al esqueleto con pesos automáticos."""
    me = bpy.data.meshes.new(nombre)
    idx = {n: i for i, n in enumerate(puntos)}
    coords = [P[n] for n in puntos]
    me.from_pydata(coords, [(idx[a], idx[b]) for a, b in ARISTAS if a in idx and b in idx], [])
    o = bpy.data.objects.new(nombre, me)
    col.objects.link(o)
    o.modifiers.new('skin', 'SKIN')
    for n, i in idx.items():
        me.skin_vertices[0].data[i].radius = (extra or {}).get(n, radio(n, factor))
    me.skin_vertices[0].data[0].use_root = True
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 2
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='skin')
    bpy.ops.object.modifier_apply(modifier='sub')
    bpy.ops.object.shade_smooth()
    o.data.materials.clear()
    o.data.materials.append(mat(color, rough))
    pegar_al_esqueleto(o)
    return o


def pegar_al_esqueleto(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    ARM.select_set(True)
    bpy.context.view_layer.objects.active = ARM
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')


def a_hueso(o, hueso):
    """Pieza rígida (cabeza, pelo, zapatos...) que sigue a un hueso."""
    mw = o.matrix_world.copy()
    o.parent = ARM
    o.parent_type = 'BONE'
    o.parent_bone = hueso
    bpy.context.view_layer.update()
    o.matrix_world = mw
    return o


def rigida(o, col, hueso, color=BLANCO, rough=0.6, niveles=2):
    for pol in o.data.polygons:
        pol.use_smooth = True
    if niveles:
        m = o.modifiers.new('sub', 'SUBSURF')
        m.levels = m.render_levels = niveles
    # (los booleanos pueden dejar una ranura de material vacía: se limpia antes de asignar)
    o.data.materials.clear()
    o.data.materials.append(mat(color, rough))
    for pol in o.data.polygons:
        pol.material_index = 0
    mover_a(o, col)
    return a_hueso(o, hueso)


def esfera(pos, r, escala=(1, 1, 1), seg=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=pos)
    o = bpy.context.object
    o.scale = escala
    bpy.ops.object.transform_apply(scale=True)
    return o


def caja_redonda(pos, tam, bisel=0.03, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=pos, rotation=rot)
    o = bpy.context.object
    o.scale = (tam[0] / 2, tam[1] / 2, tam[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new('b', 'BEVEL')
    m.width = bisel
    m.segments = 3
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='b')
    return o


def booleano(o, cortador, op='DIFFERENCE'):
    m = o.modifiers.new('bool', 'BOOLEAN')
    m.operation = op
    m.object = cortador
    m.solver = 'EXACT'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cortador)
    return o


def cubo(pos, tam):
    bpy.ops.mesh.primitive_cube_add(location=pos)
    c = bpy.context.object
    c.scale = (tam[0] / 2, tam[1] / 2, tam[2] / 2)
    return c


# ---------------------------------------------------------------- cuerpo y ropa
CUERPO = list(P.keys())
TORSO = ['pelvis', 'cintura', 'pecho', 'cuello']


CUERPO_MALLA = None


def piel(col):
    global CUERPO_MALLA
    CUERPO_MALLA = malla_skin('cuerpo', CUERPO, col)
    # Cabeza (rígida): cráneo, mandíbula, orejas y nariz
    c = CABEZA
    rigida(esfera(c, 0.118, (0.9, 0.96, 1.08), 32), col, 'cabeza')
    rigida(esfera(c + Vector((0, -0.03, -0.07)), 0.078, (0.95, 0.9, 0.8), 24), col, 'cabeza')
    for s in (1, -1):
        rigida(esfera(c + Vector((s * 0.104, 0.01, 0.0)), 0.026, (0.5, 0.9, 1.2), 16), col, 'cabeza')
    rigida(esfera(c + Vector((0, -0.112, -0.02)), 0.02, (0.85, 1.0, 1.2), 16), col, 'cabeza')


def zapatos(col):
    for l, s in (('d', 1), ('i', -1)):
        t = Vector(P['tobillo_' + l])
        rigida(caja_redonda(t + Vector((0, -0.045, -0.045)), (0.105, 0.26, 0.095), 0.045), col, 'pie_' + l)
        rigida(caja_redonda(t + Vector((0, -0.045, -0.088)), (0.11, 0.265, 0.025), 0.012), col, 'pie_' + l, '#c8c8c8')


def ropa(nombre, col, huesos, grosor, color=BLANCO, rough=0.7, quitar=None):
    """Prenda sacada del propio cuerpo: se conservan los vértices que mueven los huesos que cubre
    (según los pesos del esqueleto; con `(desde, hasta)` se toma solo ese tramo del hueso) y se infla
    `grosor` metros hacia afuera. Así calza en cualquier pose y no deja ver la piel a través.
    `quitar(co)` permite abrir huecos (por ejemplo, el frente del chaleco)."""
    me = CUERPO_MALLA.data.copy()
    o = bpy.data.objects.new(nombre, me)
    col.objects.link(o)
    grupos = {g.index: g.name for g in CUERPO_MALLA.vertex_groups}
    huesos_ext = {h: ARM.data.bones[h] for h in grupos.values() if h in ARM.data.bones}
    bm = bmesh.new()
    bm.from_mesh(me)
    capa = bm.verts.layers.deform.active
    borrar = []
    for v in bm.verts:
        pesos = v[capa]
        if not pesos:
            borrar.append(v)
            continue
        g = max(pesos.items(), key=lambda kv: kv[1])[0]
        nombre_h = grupos[g]
        base = nombre_h.rsplit('_', 1)[0] if nombre_h[-2:] in ('_d', '_i') else nombre_h
        rango = huesos.get(base)
        if rango is None:
            borrar.append(v)
            continue
        if not isinstance(rango, tuple):
            rango = (0.0, rango)
        b = huesos_ext[nombre_h]
        _, t = intersect_point_line(v.co, b.head_local, b.tail_local)
        t = min(max(t, 0.0), 1.0)   # las articulaciones quedan dentro del hueso
        if not (rango[0] <= t <= rango[1]) or (quitar and quitar(v.co)):
            borrar.append(v)
    bmesh.ops.delete(bm, geom=borrar, context='VERTS')
    # Suavizar el borde (el corte por vértices queda escalonado)
    borde = list({v for e in bm.edges if e.is_boundary for v in e.verts})
    bmesh.ops.smooth_vert(bm, verts=borde, factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * grosor
    bm.to_mesh(me)
    bm.free()
    o.vertex_groups.clear()
    me.materials.clear()
    me.materials.append(mat(color, rough))
    for pol in me.polygons:
        pol.use_smooth = True
    sol = o.modifiers.new('grosor', 'SOLIDIFY')
    sol.thickness = 0.004
    pegar_al_esqueleto(o)
    return o


TORSO_ROPA = {'columna1': 1, 'columna2': 1, 'pecho': 0.5, 'clavicula': 1, 'cadera': 0.25}


def polera(col, manga):
    huesos = dict(TORSO_ROPA)
    huesos['brazo'] = 0.45
    if manga == 'larga':
        huesos.update({'brazo': 1, 'antebrazo': 0.85})
    ropa('polera_' + manga, col, huesos, 0.009)


def pantalon(col, largo):
    huesos = {'columna1': 0.8, 'cadera': 1, 'muslo': 0.55}
    if largo == 'largo':
        huesos.update({'muslo': 1, 'pierna': 0.88})
    ropa('pantalon_' + largo, col, huesos, 0.012)


def chaleco(col, color, franja, lineas):
    """Chaleco del supermercado: sin mangas, abierto en V adelante, con franja reflectante y logo."""
    huesos = {'columna1': (0.15, 1), 'columna2': 1, 'pecho': 0.85, 'clavicula': 1}
    abertura = lambda co: co.y < 0 and co.z > 1.2 and abs(co.x) < 0.012 + (co.z - 1.2) * 0.2  # noqa: E731
    o = ropa('chaleco', col, huesos, 0.024, color, 0.75, abertura)
    # Franja reflectante y sus dos líneas: la misma forma del chaleco, un poco más afuera, cortada en bandas.
    for z, alto, c, extra in ((1.14, 0.05, franja, 0.008), (1.113, 0.006, lineas, 0.011), (1.167, 0.006, lineas, 0.011)):
        b = o.copy()
        b.data = o.data.copy()
        col.objects.link(b)
        b.parent = None
        b.matrix_world = o.matrix_world
        b.modifiers.clear()
        b.vertex_groups.clear()
        bm = bmesh.new()
        bm.from_mesh(b.data)
        bm.normal_update()
        for v in bm.verts:
            v.co += v.normal * extra
        bm.to_mesh(b.data)
        bm.free()
        sol = b.modifiers.new('grosor', 'SOLIDIFY')
        sol.thickness = 0.006
        bpy.context.view_layer.objects.active = b
        bpy.ops.object.modifier_apply(modifier='grosor')
        booleano(b, cubo((0, 0, z), (0.7, 0.7, alto)), 'INTERSECT')
        b.data.materials.clear()
        b.data.materials.append(mat(c, 0.35))
        pegar_al_esqueleto(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.026, depth=0.01, location=(-0.085, -0.13, 1.33), rotation=(math.radians(90), 0, 0))
    rigida(bpy.context.object, col, 'pecho', '#ffffff', niveles=0)


# Chalecos de reconocimiento (desbloqueables): color, franja, líneas.
CHALECOS = {
    'basico': ('#553c9a', '#d7dee6', '#38b2ac'), 'estrella': ('#553c9a', '#d7dee6', '#38b2ac'),
    'experto': ('#2c9691', '#d7dee6', '#553c9a'), 'plata': ('#b0bac6', '#553c9a', '#38b2ac'),
    'oro': ('#e2b030', '#553c9a', '#38b2ac'),
}


def insignia(col, variante):
    """Estrella (o medalla en el de oro) en el pecho, al lado opuesto del logo."""
    centro = Vector((0.085, -0.132, 1.33))
    puntos = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = 0.03 if i % 2 == 0 else 0.013
        puntos.append((centro.x + math.cos(a) * r, centro.z + math.sin(a) * r))
    me = bpy.data.meshes.new('estrella')
    verts = [(x, centro.y, z) for x, z in puntos] + [(centro.x, centro.y, centro.z)]
    caras = [(i, (i + 1) % 10, 10) for i in range(10)]
    me.from_pydata(verts, [], caras)
    o = bpy.data.objects.new('estrella', me)
    col.objects.link(o)
    sol = o.modifiers.new('g', 'SOLIDIFY')
    sol.thickness = 0.006
    rigida(o, col, 'pecho', '#f6c343' if variante != 'oro' else '#ffffff', 0.4, 0)


# ---------------------------------------------------------------- cara
def cara(col_ojos, col_iris, col_parpados, col_cejas, cols_boca):
    c = CABEZA
    for s in (1, -1):
        ojo = c + Vector((s * 0.042, -0.1, 0.012))
        rigida(esfera(ojo, 0.02, (1.0, 0.45, 1.15), 16), col_ojos, 'cabeza', '#ffffff', 0.3, 1)
        rigida(esfera(ojo + Vector((0, -0.008, -0.001)), 0.0125, (1, 0.45, 1.1), 16), col_iris, 'cabeza', BLANCO, 0.2, 1)
        rigida(esfera(ojo + Vector((0, -0.011, -0.002)), 0.0065, (1, 0.45, 1), 12), col_ojos, 'cabeza', '#1a1a1a', 0.2, 1)
        rigida(esfera(ojo + Vector((0.004 * s, -0.0135, 0.005)), 0.003, (1, 0.5, 1), 8), col_ojos, 'cabeza', '#ffffff', 0.1, 0)
        rigida(esfera(ojo + Vector((0, -0.001, 0.0)), 0.0215, (1.05, 0.5, 1.2), 16), col_parpados, 'cabeza', BLANCO, 0.6, 1)
        ceja = caja_redonda(ojo + Vector((0, -0.008, 0.038)), (0.044, 0.012, 0.011), 0.005, rot=(0, s * math.radians(-7), 0))
        rigida(ceja, col_cejas, 'cabeza', BLANCO, 0.8, 1)
    for nombre, col in cols_boca.items():
        boca(nombre, col, c + Vector((0, -0.103, -0.062)))


def boca(tipo, col, centro):
    oscuro = '#6b2020'
    if tipo in ('sonrisa', 'triste'):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.024, minor_radius=0.005, location=centro, rotation=(math.radians(90), 0, 0))
        o = bpy.context.object
        booleano(o, cubo(centro + Vector((0, 0, 0.03 if tipo == 'sonrisa' else -0.03)), (0.1, 0.1, 0.06)))
        if tipo == 'triste':
            o.location.z -= 0.014
        rigida(o, col, 'cabeza', oscuro, 0.5, 1)
    elif tipo == 'abierta':
        rigida(esfera(centro + Vector((0, 0.003, -0.004)), 0.02, (1.0, 0.4, 0.8), 16), col, 'cabeza', oscuro, 0.5, 1)
        rigida(caja_redonda(centro + Vector((0, -0.005, 0.006)), (0.026, 0.006, 0.007), 0.002), col, 'cabeza', '#ffffff', 0.3, 0)
    else:
        rigida(caja_redonda(centro, (0.032, 0.008, 0.007), 0.003), col, 'cabeza', oscuro, 0.5, 1)


# ---------------------------------------------------------------- pelo
PEINADOS = ['corto', 'rapado', 'lado', 'rulos', 'afro', 'melena', 'largo', 'cola', 'mono']


def casco(r=0.128, frente=0.0):
    """Casquete de pelo alrededor de la cabeza, sin la cara ni la nuca baja."""
    c = CABEZA
    o = esfera(c + Vector((0, 0.008, 0.012)), r, (0.94, 1.0, 1.04), 32)
    booleano(o, cubo(c + Vector((0, -0.13, -0.075 + frente)), (0.32, 0.14, 0.2)))
    booleano(o, cubo(c + Vector((0, 0.02, -0.185)), (0.4, 0.4, 0.16)))
    return o


def pelo(estilo, col):
    c = CABEZA
    p = lambda o: rigida(o, col, 'cabeza', BLANCO, 0.8, 1)  # noqa: E731
    if estilo == 'rapado':
        p(casco(0.122, 0.035))
        return
    if estilo == 'afro':
        o = esfera(c + Vector((0, 0.02, 0.05)), 0.17, (1, 0.98, 0.92), 28)
        booleano(o, cubo(c + Vector((0, -0.15, -0.06)), (0.32, 0.14, 0.2)))
        booleano(o, cubo(c + Vector((0, 0, -0.21)), (0.5, 0.5, 0.18)))
        p(o)
        return
    p(casco())
    if estilo == 'corto':
        p(esfera(c + Vector((0.015, -0.07, 0.085)), 0.065, (1.35, 0.75, 0.5), 20))
    elif estilo == 'lado':
        p(esfera(c + Vector((-0.035, -0.075, 0.075)), 0.07, (1.5, 0.75, 0.55), 20))
    elif estilo == 'rulos':
        for k in range(16):
            a = k / 16 * math.pi * 2
            p(esfera(c + Vector((math.cos(a) * 0.095, math.sin(a) * 0.085 + 0.015, 0.075 + (k % 3) * 0.015)), 0.042, (1, 1, 1), 12))
    elif estilo in ('melena', 'largo'):
        largo = 0.2 if estilo == 'melena' else 0.36
        for s in (1, -1):
            p(caja_redonda(c + Vector((s * 0.105, 0.025, -largo / 2 + 0.03)), (0.055, 0.17, largo), 0.026))
        p(caja_redonda(c + Vector((0, 0.085, -largo / 2 + 0.03)), (0.23, 0.065, largo), 0.03))
        p(esfera(c + Vector((0.02, -0.072, 0.08)), 0.066, (1.45, 0.75, 0.45), 20))
    elif estilo == 'cola':
        p(esfera(c + Vector((0, -0.072, 0.08)), 0.062, (1.5, 0.75, 0.45), 20))
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.045, radius2=0.02, depth=0.24, location=c + Vector((0, 0.15, -0.08)),
                                        rotation=(math.radians(20), 0, 0))
        p(bpy.context.object)
    elif estilo == 'mono':
        p(esfera(c + Vector((0, -0.072, 0.08)), 0.062, (1.5, 0.75, 0.45), 20))
        p(esfera(c + Vector((0, 0.065, 0.135)), 0.062, (1, 1, 1), 20))


# ---------------------------------------------------------------- accesorios del supervisor
def accesorios(col_lentes, col_corbata, col_tabla):
    c = CABEZA
    for s in (1, -1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.026, minor_radius=0.003, location=c + Vector((s * 0.042, -0.116, 0.012)),
                                         rotation=(math.radians(90), 0, 0))
        rigida(bpy.context.object, col_lentes, 'cabeza', '#1a202c', 0.3, 0)
    rigida(caja_redonda(c + Vector((0, -0.118, 0.014)), (0.03, 0.005, 0.004), 0.001), col_lentes, 'cabeza', '#1a202c', 0.3, 0)
    rigida(caja_redonda((0, -0.115, 1.41), (0.035, 0.012, 0.03), 0.008), col_corbata, 'pecho', '#2a4365', 0.5, 1)
    rigida(caja_redonda((0, -0.118, 1.27), (0.048, 0.01, 0.25), 0.01), col_corbata, 'columna2', '#2a4365', 0.5, 1)
    m = Vector(P['mano_d'])
    rigida(caja_redonda(m + Vector((-0.03, -0.07, 0.02)), (0.17, 0.016, 0.23), 0.008), col_tabla, 'mano_d', '#8b5e3c', 0.6, 0)
    rigida(caja_redonda(m + Vector((-0.03, -0.08, 0.01)), (0.14, 0.004, 0.18), 0.002), col_tabla, 'mano_d', '#ffffff', 0.6, 0)


# ---------------------------------------------------------------- poses (grados, en los ejes locales de cada hueso)
POSES = {
    'quieto': {'brazo_d': (0, 0, 8), 'brazo_i': (0, 0, -8)},
    'habla': {'brazo_d': (-25, 0, 25), 'antebrazo_d': (-55, 0, -15), 'brazo_i': (0, 0, -8)},
    'feliz': {'brazo_d': (0, 0, 125), 'antebrazo_d': (0, 0, 25), 'brazo_i': (0, 0, -125), 'antebrazo_i': (0, 0, -25)},
    'triste': {'brazo_d': (0, 0, 4), 'brazo_i': (0, 0, -4), 'cuello': (25, 0, 0), 'pecho': (10, 0, 0)},
    'camina1': {'muslo_d': (-25, 0, 0), 'pierna_d': (15, 0, 0), 'muslo_i': (20, 0, 0), 'pierna_i': (30, 0, 0),
                'brazo_d': (25, 0, 8), 'brazo_i': (-25, 0, -8)},
    'camina2': {'muslo_d': (20, 0, 0), 'pierna_d': (30, 0, 0), 'muslo_i': (-25, 0, 0), 'pierna_i': (15, 0, 0),
                'brazo_d': (-25, 0, 8), 'brazo_i': (25, 0, -8)},
}
GIRO = -22   # tres cuartos: mira un poco hacia la derecha de la pantalla


def posar(nombre):
    for pb in ARM.pose.bones:
        pb.rotation_euler = (0, 0, 0)
    for h, (rx, ry, rz) in POSES[nombre].items():
        ARM.pose.bones[h].rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    ARM.rotation_euler = (0, 0, math.radians(GIRO))
    bpy.context.view_layer.update()


# ---------------------------------------------------------------- cámara y armado
ANCHO_PX, ALTO_PX = 440, 640
ALTO_M = 2.0     # metros visibles de alto; el centro de la imagen está a 0,95 m


def camara():
    bpy.ops.object.camera_add(location=(0, -8, 0.95), rotation=(math.radians(90), 0, 0))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.ortho_scale = ALTO_M
    bpy.context.scene.camera = cam
    return cam


def armar_todo():
    escena(ANCHO_PX, ALTO_PX, fondo='#ffffff', sol_rot=(50, 10, 40), sol=1.7, ambiente=0.55)
    bpy.context.scene.render.film_transparent = True
    armature()
    cols = {n: coleccion(n) for n in ('piel', 'zapatos', 'ojos', 'iris', 'parpados', 'cejas', 'lentes', 'corbata', 'tabla')}
    piel(cols['piel'])
    zapatos(cols['zapatos'])
    for m in ('corta', 'larga'):
        cols['polera_' + m] = coleccion('polera_' + m)
        polera(cols['polera_' + m], m)
    for l in ('largo', 'corto'):
        cols['pantalon_' + l] = coleccion('pantalon_' + l)
        pantalon(cols['pantalon_' + l], l)
    for v, (c1, c2, c3) in CHALECOS.items():
        cols['chaleco_' + v] = coleccion('chaleco_' + v)
        chaleco(cols['chaleco_' + v], c1, c2, c3)
        if v in ('estrella', 'experto', 'plata', 'oro'):
            insignia(cols['chaleco_' + v], v)
    bocas = {b: coleccion('boca_' + b) for b in ('sonrisa', 'abierta', 'triste', 'neutra')}
    cols.update({'boca_' + b: c for b, c in bocas.items()})
    cara(cols['ojos'], cols['iris'], cols['parpados'], cols['cejas'], bocas)
    for e in PEINADOS:
        cols['pelo_' + e] = coleccion('pelo_' + e)
        pelo(e, cols['pelo_' + e])
    accesorios(cols['lentes'], cols['corbata'], cols['tabla'])
    agrandar_cabeza()
    return cols


def agrandar_cabeza():
    """Escala todo lo que cuelga del hueso de la cabeza desde la nuca (cabeza, cara, pelo, lentes)."""
    nuca = Vector(P['nuca'])
    m = Matrix.Translation(nuca) @ Matrix.Scale(CABEZA_X, 4) @ Matrix.Translation(-nuca)
    for o in bpy.data.objects:
        if o.parent == ARM and o.parent_type == 'BONE' and o.parent_bone == 'cabeza':
            o.matrix_world = m @ o.matrix_world


def preview(cols, salida):
    """Vistas previas armadas (con colores de prueba) para revisar el modelo."""
    tintes = {'piel': '#e0ac69', 'zapatos': '#2d3748', 'polera_corta': '#e53e3e', 'pantalon_largo': '#2c5282',
              'cejas': '#3b2a1a', 'iris': '#5a3b1e', 'pelo_corto': '#3b2a1a', 'pelo_largo': '#3b2a1a'}
    # Las piezas blancas (las que el juego colorea) toman el color de prueba de su capa.
    for n, c in cols.items():
        for o in c.objects:
            for i, m in enumerate(o.data.materials):
                base = m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[0] if m else 0
                if n in tintes and abs(base - lineal(0xf2)) < 0.01:
                    o.data.materials[i] = mat(tintes[n])
    salida.mkdir(parents=True, exist_ok=True)
    combos = [('a', ['piel', 'zapatos', 'polera_corta', 'pantalon_largo', 'chaleco_basico', 'ojos', 'iris', 'cejas', 'boca_sonrisa', 'pelo_corto']),
              ('b', ['piel', 'zapatos', 'polera_corta', 'pantalon_largo', 'ojos', 'iris', 'cejas', 'boca_abierta', 'pelo_largo'])]
    for nombre, visibles in combos:
        for n, c in cols.items():
            c.hide_render = n not in visibles
        for pose in ('quieto', 'habla', 'feliz', 'camina1'):
            posar(pose)
            bpy.context.scene.render.filepath = str(salida / f'{nombre}_{pose}.png')
            bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- capas para el juego
# Orden en que el juego las dibuja y qué las tapa (se renderizan con eso como "holdout": así un brazo
# delante de la polera deja un hueco en la polera y al superponer las capas todo calza).
CAPAS = {
    'piel': [], 'zapatos': [], 'pantalon_largo': ['piel'], 'pantalon_corto': ['piel'],
    'polera_corta': ['piel'], 'polera_larga': ['piel'],
    **{'chaleco_' + v: ['piel', 'polera_larga'] for v in CHALECOS},
    'corbata': ['piel', 'polera_larga'], 'ojos': [], 'iris': [], 'parpados': [], 'cejas': [],
    'boca_sonrisa': [], 'boca_abierta': [], 'boca_triste': [], 'boca_neutra': [],
    **{'pelo_' + e: ['piel', 'polera_larga', 'chaleco_basico'] for e in PEINADOS},
    'lentes': [], 'tabla': [],
}
POSES_JUEGO = ['quieto', 'habla', 'feliz', 'triste', 'camina1', 'camina2']


def renderizar_capas(salida):
    s = bpy.context.scene
    capas_vista = bpy.context.view_layer.layer_collection.children
    for c in bpy.data.collections:
        c.hide_render = False
    for pose in POSES_JUEGO:
        posar(pose)
        for capa, tapan in CAPAS.items():
            for lc in capas_vista:
                lc.exclude = lc.name not in (capa, *tapan)
                lc.holdout = lc.name in tapan
            s.render.filepath = str(salida / f'{pose}__{capa}.png')
            bpy.ops.render.render(write_still=True)
    for lc in capas_vista:
        lc.exclude = False
        lc.holdout = False


cols = armar_todo()
camara()
if ARGS and ARGS[0] == 'preview':
    preview(cols, pathlib.Path(ARGS[1]) if len(ARGS) > 1 else RAIZ / 'tools' / '_preview')
elif ARGS and ARGS[0] == 'capas':
    renderizar_capas(pathlib.Path(ARGS[1]))
print('personaje listo')
