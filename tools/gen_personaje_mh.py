"""Personaje del juego a partir de MakeHuman (cuerpos, peinados, zapatos y expresiones), con Blender.

Uso (lo llama tools/personaje.py):
  blender -b -P tools/gen_personaje_mh.py -- preview <entrada> <salida.png>
  blender -b -P tools/gen_personaje_mh.py -- capas <entrada> <carpeta> [cuerpo ...]

<entrada> es la carpeta que exporta tools/mh_exportar.py (FBX de cuerpos, peinados y zapatos, OBJ de
expresiones). Cada cuerpo se importa con su esqueleto; los peinados y zapatos se pegan al mismo
esqueleto; las expresiones pasan a shape keys; la ropa (polera, pantalón, chaleco) se saca del propio
cuerpo según los pesos de los huesos. Las capas se renderizan en blanco (el juego las colorea).
"""
import math
import pathlib
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import intersect_point_line

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bl_util import escena, hexa, lineal  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
BLANCO = '#efefef'
CUERPOS = ['hombre', 'mujer', 'nobinario']
PELOS = {'corto': 'short02', 'rapado': 'short04', 'lado': 'short01', 'rulos': 'short03', 'afro': 'afro01',
         'melena': 'bob02', 'largo': 'long01', 'cola': 'ponytail01', 'mono': 'bob01', 'trenza': 'braid01'}
EXPRESIONES = {'sonrisa': 'smile02', 'abierta': 'vocalize01', 'triste': 'sad01', 'parpadeo': 'sleep01'}
ANCHO_PX, ALTO_PX, ALTO_M = 360, 520, 2.0
_mats = {}


def mat(color, rough=0.6, nombre=None):
    clave = (color, rough, nombre)
    if clave in _mats:
        return _mats[clave]
    m = bpy.data.materials.new(name=nombre or f'pm{len(_mats)}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[lineal(c) for c in hexa(color)], 1)
    b.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in b.inputs:
        b.inputs['Specular IOR Level'].default_value = 0.25
    _mats[clave] = m
    return m


def mat_textura(o, blanco=True, alpha=True):
    """Material de una malla de MakeHuman con textura (pelo, cejas, pestañas): conserva el detalle y la
    transparencia de la textura, pero en gris claro para que el juego le dé el color."""
    viejo = o.active_material
    img = None
    if viejo and viejo.use_nodes:
        for n in viejo.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and 'normal' not in n.image.name.lower():
                img = n.image
                break
    m = bpy.data.materials.new(name='tex_' + o.name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.7
    if img:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        if blanco:
            gris = nt.nodes.new('ShaderNodeRGBToBW')
            sube = nt.nodes.new('ShaderNodeMath')
            sube.operation = 'MULTIPLY_ADD'
            sube.inputs[1].default_value = 0.6
            sube.inputs[2].default_value = 0.45
            nt.links.new(t.outputs['Color'], gris.inputs['Color'])
            nt.links.new(gris.outputs['Val'], sube.inputs[0])
            nt.links.new(sube.outputs['Value'], b.inputs['Base Color'])
        else:
            nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
        if alpha:
            nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    o.data.materials.clear()
    o.data.materials.append(m)
    return m


# ---------------------------------------------------------------- importar de MakeHuman
def importar(f):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(f), global_scale=10.0)
    objs = [o for o in bpy.data.objects if o not in antes]
    normalizar(objs)
    return objs


def activar(o):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


def normalizar(objs):
    """El FBX de MakeHuman llega acostado (esqueleto girado 90°, mallas en Y arriba) y con una pose base
    que lo pone de pie. Se aplica esa pose como reposo: todo queda en coordenadas del mundo, z arriba,
    mirando a -y, con el esqueleto sin giro y pose identidad."""
    arm = next(o for o in objs if o.type == 'ARMATURE')
    mallas = [o for o in objs if o.type == 'MESH']
    bpy.context.view_layer.update()
    for o in mallas:
        activar(o)
        for m in list(o.modifiers):
            if m.type == 'ARMATURE':
                bpy.ops.object.modifier_apply(modifier=m.name)
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    activar(arm)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in mallas:
        o.parent = arm
        o.matrix_parent_inverse = Matrix.Identity(4)
        a = o.modifiers.new('esqueleto', 'ARMATURE')
        a.object = arm


def suavizar(o, subdividir=False):
    """Las normales personalizadas del FBX quedan mal al deformar (se ve facetado): se borran,
    sombreado suave y, para el cuerpo y la ropa, una subdivisión."""
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    if o.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bpy.ops.object.shade_smooth()
    if subdividir and not any(m.type == 'SUBSURF' for m in o.modifiers):
        m = o.modifiers.new('sub', 'SUBSURF')
        m.levels = m.render_levels = 1


def pegar(o, arm):
    """Pega una malla importada (pelo, zapatos) al esqueleto del cuerpo (mismo esqueleto de MakeHuman)."""
    mw = o.matrix_world.copy()
    o.parent = arm
    o.matrix_world = mw
    for m in o.modifiers:
        if m.type == 'ARMATURE':
            m.object = arm


def coleccion(nombre):
    c = bpy.data.collections.get(nombre) or bpy.data.collections.new(nombre)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


def mover_a(o, col):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)


class Cuerpo:
    def __init__(self, entrada, nombre):
        self.nombre = nombre
        objs = importar(entrada / f'{nombre}_cuerpo.fbx')
        self.arm = next(o for o in objs if o.type == 'ARMATURE')
        self.mallas = {o.name: o for o in objs if o.type == 'MESH'}
        self.cuerpo = next(o for n, o in self.mallas.items() if n.endswith('_cuerpoMesh'))
        self.cols = {}
        piel = self.col('piel')
        mover_a(self.cuerpo, piel)
        self.cuerpo.data.materials.clear()
        self.cuerpo.data.materials.append(mat(BLANCO, 0.55))
        for n, o in self.mallas.items():
            if 'eyebrow' in n:
                mover_a(o, self.col('cejas'))
                mat_textura(o)
            elif 'eyelashes' in n or 'high-poly' in n or 'teeth' in n:
                mover_a(o, self.col('rasgos'))
                if 'eyelashes' in n:
                    mat_textura(o, blanco=False)
        # Peinados y zapatos (cada FBX trae su propio cuerpo: se toma solo la malla del accesorio)
        for o in self.mallas.values():
            suavizar(o, subdividir=(o == self.cuerpo))
        for juego, mh in PELOS.items():
            for o in importar(entrada / f'{nombre}_pelo_{mh}.fbx'):
                if o.type == 'MESH' and o.name.startswith(mh):
                    pegar(o, self.arm)
                    mover_a(o, self.col('pelo_' + juego))
                    mat_textura(o)
                    suavizar(o)
                else:
                    bpy.data.objects.remove(o, do_unlink=True)
        for o in importar(entrada / f'{nombre}_zapatos_shoes01.fbx'):
            if o.type == 'MESH' and o.name.startswith('shoes01'):
                pegar(o, self.arm)
                mover_a(o, self.col('zapatos'))
                suavizar(o)
                o.data.materials.clear()
                o.data.materials.append(mat(BLANCO, 0.5))
            else:
                bpy.data.objects.remove(o, do_unlink=True)
        # Pose base (identidad tras normalizar): se guarda para volver a ella.
        self.base = {pb.name: pb.matrix_basis.copy() for pb in self.arm.pose.bones}
        self.giro0 = self.arm.rotation_euler.copy()

    def col(self, n):
        if n not in self.cols:
            self.cols[n] = coleccion(f'{self.nombre}:{n}')
        return self.cols[n]

    # Rotación de un hueso en el espacio del mundo (eje del mundo, grados), alrededor de su cabeza.
    def rotar(self, hueso, eje, grados):
        pb = self.arm.pose.bones[hueso]
        m3 = self.arm.matrix_world.to_3x3()
        eje_arm = (m3.inverted() @ Vector(eje)).normalized()
        cabeza = pb.head.copy()
        r = Matrix.Translation(cabeza) @ Matrix.Rotation(math.radians(grados), 4, eje_arm) @ Matrix.Translation(-cabeza)
        pb.matrix = r @ pb.matrix
        bpy.context.view_layer.update()

    def posar(self, pose, giro=-22):
        for pb in self.arm.pose.bones:
            pb.matrix_basis = self.base[pb.name]
        self.arm.rotation_euler = self.giro0
        bpy.context.view_layer.update()
        for hueso, eje, grados in POSES[pose]:
            for lado, s in (('L', 1), ('R', -1)) if hueso.endswith('.X') else ((None, 1),):
                nombre = hueso[:-2] + '.' + lado if lado else hueso
                ex = (eje[0], eje[1] * s, eje[2] * s) if lado else eje
                self.rotar(nombre, ex, grados)
        # Tres cuartos: girar todo alrededor del eje vertical del mundo.
        self.arm.matrix_world = Matrix.Rotation(math.radians(giro), 4, 'Z') @ self.arm.matrix_world
        bpy.context.view_layer.update()


# Poses: (hueso, eje del mundo, grados), en orden de padres a hijos. '.X' = ambos lados (espejado).
# El cuerpo mira hacia -y; su izquierda es +x. En la pose base de MakeHuman el brazo ya cae ~52° bajo
# la horizontal: +20° alrededor de +y (brazo izquierdo) lo deja al costado.
BRAZOS_ABAJO = [('upperarm01.X', (0, 1, 0), 22), ('lowerarm01.X', (0, 1, 0), 5)]
POSES = {
    'quieto': BRAZOS_ABAJO,
    'habla': [('upperarm01.L', (0, 1, 0), 22), ('lowerarm01.L', (0, 1, 0), 5),
              ('upperarm01.R', (0, -1, 0), 14), ('upperarm01.R', (1, 0, 0), -30), ('lowerarm01.R', (1, 0, 0), -65)],
    'feliz': [('upperarm01.X', (0, 1, 0), -95), ('lowerarm01.X', (0, 1, 0), -12), ('neck01', (1, 0, 0), -8)],
    'triste': BRAZOS_ABAJO + [('spine01', (1, 0, 0), 6), ('neck01', (1, 0, 0), 20)],
    'camina1': BRAZOS_ABAJO + [('upperleg01.L', (1, 0, 0), -22), ('lowerleg01.L', (1, 0, 0), 15),
                               ('upperleg01.R', (1, 0, 0), 16), ('lowerleg01.R', (1, 0, 0), 30),
                               ('upperarm01.L', (1, 0, 0), 18), ('upperarm01.R', (1, 0, 0), -18)],
    'camina2': BRAZOS_ABAJO + [('upperleg01.R', (1, 0, 0), -22), ('lowerleg01.R', (1, 0, 0), 15),
                               ('upperleg01.L', (1, 0, 0), 16), ('lowerleg01.L', (1, 0, 0), 30),
                               ('upperarm01.R', (1, 0, 0), 18), ('upperarm01.L', (1, 0, 0), -18)],
}


# ---------------------------------------------------------------- expresiones (shape keys desde los OBJ)
def leer_obj(f):
    """Vértices del OBJ de MakeHuman, por grupo ('g'), en orden. Y arriba, como lo escribe MakeHuman."""
    grupos, actual, verts = [], None, []
    for linea in open(f):
        if linea.startswith('v '):
            verts.append(Vector(tuple(float(x) for x in linea.split()[1:4])))
        elif linea.startswith('g '):
            grupos.append(linea.split()[1].rsplit('.', 1)[0])
    return grupos, verts


def expresiones(c, entrada):
    """Cada expresión de MakeHuman (OBJ con la misma topología) pasa a shape key: se suma al cuerpo y a
    ojos, cejas, pestañas y dientes la diferencia respecto del OBJ neutro. El OBJ trae todo en una
    sola lista de vértices, en el orden de sus grupos ('base' = cuerpo)."""
    grupos, neutra = leer_obj(entrada / f'{c.nombre}_expr_neutra.obj')
    destinos = []
    for g in grupos:
        o = c.cuerpo if g == 'base' else next((m for n, m in c.mallas.items() if n.startswith(g)), None)
        destinos.append(o)
    desde, rangos = 0, []
    for o in destinos:
        rangos.append((o, desde))
        desde += len(o.data.vertices)
    assert desde == len(neutra), (desde, len(neutra))
    # Del OBJ (y arriba) al mundo de Blender (z arriba), en la escala del FBX importado.
    a_blender = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
    zs = [(c.cuerpo.matrix_world @ v.co).z for v in c.cuerpo.data.vertices]
    ys = [v.y for v in neutra[:len(c.cuerpo.data.vertices)]]
    escala = (max(zs) - min(zs)) / (max(ys) - min(ys))
    for o, _ in rangos:
        if not o.data.shape_keys:
            o.shape_key_add(name='Basis', from_mix=False)
    for juego, mh in EXPRESIONES.items():
        _, verts = leer_obj(entrada / f'{c.nombre}_expr_{mh}.obj')
        for o, ini in rangos:
            inv = o.matrix_world.to_3x3().inverted()
            k = o.shape_key_add(name=juego, from_mix=False)
            base = o.data.shape_keys.key_blocks['Basis'].data
            for i in range(len(o.data.vertices)):
                d = a_blender @ (verts[ini + i] - neutra[ini + i]) * escala
                k.data[i].co = base[i].co + inv @ d


def poner_expresion(c, juego):
    for o in [c.cuerpo, *c.col('cejas').objects, *c.col('rasgos').objects, *c.col('cara').objects]:
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = 1.0 if kb.name == juego else 0.0
    bpy.context.view_layer.update()


# ---------------------------------------------------------------- zonas del cuerpo según los huesos
def descendientes(arm, raiz):
    salida, pila = set(), [arm.data.bones[raiz]]
    while pila:
        b = pila.pop()
        salida.add(b.name)
        pila.extend(b.children)
    return salida


def hueso_dominante(o):
    """Para cada vértice del cuerpo: (nombre del hueso que más lo mueve, posición en reposo en el
    espacio del esqueleto)."""
    grupos = {g.index: g.name for g in o.vertex_groups}
    a_arm = o.parent.matrix_world.inverted() @ o.matrix_world
    salida = []
    for v in o.data.vertices:
        g = max(v.groups, key=lambda x: x.weight, default=None)
        salida.append((grupos.get(g.group) if g else None, a_arm @ v.co))
    return salida


def capa_cara(c):
    """Copia del cuerpo que muestra solo la cabeza (máscara por grupo de vértices): permite cambiar de
    expresión sin repetir todo el cuerpo."""
    cabeza = descendientes(c.arm, 'head')
    g = c.cuerpo.vertex_groups.new(name='zona_cara')
    for i, (h, _) in enumerate(hueso_dominante(c.cuerpo)):
        if h in cabeza:
            g.add([i], 1.0, 'REPLACE')
    cara = c.cuerpo.copy()
    c.col('cara').objects.link(cara)
    cara.modifiers.clear()
    m = cara.modifiers.new('mascara', 'MASK')
    m.vertex_group = 'zona_cara'
    a = cara.modifiers.new('esqueleto', 'ARMATURE')
    a.object = c.arm
    s_ = cara.modifiers.new('sub', 'SUBSURF')
    s_.levels = s_.render_levels = 1


def ropa(c, nombre, col, huesos, grosor, color=BLANCO, rough=0.7, quitar=None):
    """Prenda sacada del propio cuerpo: se conservan los vértices que mueven los huesos que cubre
    (con `(desde, hasta)` solo ese tramo del hueso) y se infla `grosor` metros. Calza en cualquier pose."""
    me = c.cuerpo.data.copy()
    o = bpy.data.objects.new(nombre, me)
    col.objects.link(o)
    o.matrix_world = c.cuerpo.matrix_world
    if me.shape_keys:
        o.shape_key_clear()
    info = hueso_dominante(c.cuerpo)
    huesos_arm = c.arm.data.bones
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    borrar = []
    for v in bm.verts:
        h, co = info[v.index]
        base = h.rsplit('.', 1)[0] if h and h[-2:] in ('.L', '.R') else h
        rango = huesos.get(base)
        if rango is None:
            borrar.append(v)
            continue
        if not isinstance(rango, tuple):
            rango = (0.0, rango)
        b = huesos_arm[h]
        _, t = intersect_point_line(co, b.head_local, b.tail_local)
        t = min(max(t, 0.0), 1.0)
        if not (rango[0] <= t <= rango[1]) or (quitar and quitar(co)):
            borrar.append(v)
    bmesh.ops.delete(bm, geom=borrar, context='VERTS')
    borde = list({v for e in bm.edges if e.is_boundary for v in e.verts})
    for _ in range(3):
        bmesh.ops.smooth_vert(bm, verts=borde, factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * grosor
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    me.materials.append(mat(color, rough))
    for pol in me.polygons:
        pol.use_smooth = True
    o.parent = c.arm
    o.matrix_world = c.cuerpo.matrix_world
    sol = o.modifiers.new('grosor', 'SOLIDIFY')
    sol.thickness = 0.003
    a = o.modifiers.new('esqueleto', 'ARMATURE')
    a.object = c.arm
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    return o


TORSO = {'spine04': 1, 'spine03': 1, 'spine02': 1, 'spine01': 1, 'breast': 1,
         'clavicle': 1, 'shoulder01': 1, 'neck01': 0.25}


def polera(c, manga):
    huesos = dict(TORSO)
    huesos.update({'upperarm01': 1, 'upperarm02': 0.25})
    if manga == 'larga':
        huesos.update({'upperarm02': 1, 'lowerarm01': 1, 'lowerarm02': 0.9})
    ropa(c, 'polera_' + manga, c.col('polera_' + manga), huesos, 0.006)


def pantalon(c, largo):
    huesos = {'root': 1, 'pelvis': 1, 'spine05': 1, 'spine04': 0.35, 'upperleg01': 1, 'upperleg02': 0.4}
    if largo == 'largo':
        huesos.update({'upperleg02': 1, 'lowerleg01': 1, 'lowerleg02': 0.85})
    ropa(c, 'pantalon_' + largo, c.col('pantalon_' + largo), huesos, 0.008)


CHALECOS = {
    'basico': ('#553c9a', '#d7dee6', '#38b2ac'), 'estrella': ('#553c9a', '#d7dee6', '#38b2ac'),
    'experto': ('#2c9691', '#d7dee6', '#553c9a'), 'plata': ('#b0bac6', '#553c9a', '#38b2ac'),
    'oro': ('#e2b030', '#553c9a', '#38b2ac'),
}


def frente_y(c, z, x=0.0):
    """y (espacio del esqueleto) del frente del cuerpo a la altura z, cerca de x."""
    ys = [co.y for _, co in hueso_dominante(c.cuerpo) if abs(co.z - z) < 0.02 and abs(co.x - x) < 0.04]
    return min(ys) if ys else -0.12


def chaleco(c, variante):
    color, franja, lineas = CHALECOS[variante]
    col = c.col('chaleco_' + variante)
    huesos = {'spine05': (0.5, 1), 'spine04': 1, 'spine03': 1, 'spine02': 1, 'spine01': 1, 'breast': 1,
              'clavicle': 1, 'shoulder01': 0.5, 'upperarm01': 0.0, 'neck01': 0.1}
    z0 = c.arm.data.bones['spine01'].head_local.z - 0.03
    abertura = lambda co: co.y < 0 and co.z > z0 and abs(co.x) < 0.008 + (co.z - z0) * 0.25  # noqa: E731
    o = ropa(c, 'chaleco', col, huesos, 0.016, color, 0.75, abertura)
    zf = c.arm.data.bones['spine03'].head_local.z + 0.01
    for z, alto, cl, extra in ((zf, 0.05, franja, 0.006), (zf - 0.027, 0.006, lineas, 0.009), (zf + 0.027, 0.006, lineas, 0.009)):
        b = o.copy()
        b.data = o.data.copy()
        col.objects.link(b)
        b.modifiers.clear()
        bm = bmesh.new()
        bm.from_mesh(b.data)
        bm.normal_update()
        for v in bm.verts:
            v.co += v.normal * extra
        bm.to_mesh(b.data)
        bm.free()
        sol = b.modifiers.new('grosor', 'SOLIDIFY')
        sol.thickness = 0.005
        bpy.context.view_layer.objects.active = b
        bpy.ops.object.modifier_apply(modifier='grosor')
        a_arm = c.arm.matrix_world
        cubo_ = cubo_mundo(a_arm @ Vector((0, 0, z)), (2, 2, alto), a_arm)
        bool_ = b.modifiers.new('bool', 'BOOLEAN')
        bool_.operation = 'INTERSECT'
        bool_.object = cubo_
        bool_.solver = 'EXACT'
        activar(b)  # al crear el cubo quedó activo él
        bpy.ops.object.modifier_apply(modifier='bool')
        bpy.data.objects.remove(cubo_)
        b.data.materials.clear()
        b.data.materials.append(mat(cl, 0.35))
        a = b.modifiers.new('esqueleto', 'ARMATURE')
        a.object = c.arm
    # Logo (y estrella en los de reconocimiento) en el pecho
    zl = c.arm.data.bones['spine01'].head_local.z - 0.02
    for x, color_, forma in ((-0.085, '#ffffff', 'disco'), (0.085, '#f6c343' if variante != 'oro' else '#ffffff', 'estrella')):
        if forma == 'estrella' and variante == 'basico':
            continue
        y = frente_y(c, zl, x) - 0.02
        pieza = disco(0.024) if forma == 'disco' else estrella(0.028)
        pieza.location = c.arm.matrix_world @ Vector((x, y, zl))
        pieza.rotation_euler = (math.radians(90), 0, 0)
        pieza.data.materials.append(mat(color_, 0.4))
        mover_a(pieza, col)
        a_hueso(pieza, c.arm, 'spine01')


def cubo_mundo(pos, tam, a_arm):
    bpy.ops.mesh.primitive_cube_add(location=pos)
    o = bpy.context.object
    o.rotation_euler = a_arm.to_euler()
    o.scale = (tam[0] / 2, tam[1] / 2, tam[2] / 2)
    bpy.context.view_layer.update()
    return o


def disco(r):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=0.006)
    return bpy.context.object


def estrella(r):
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((math.cos(a) * rr, math.sin(a) * rr, 0))
    me = bpy.data.meshes.new('estrella')
    me.from_pydata(pts + [(0, 0, 0)], [], [(i, (i + 1) % 10, 10) for i in range(10)])
    o = bpy.data.objects.new('estrella', me)
    bpy.context.scene.collection.objects.link(o)
    o.modifiers.new('g', 'SOLIDIFY').thickness = 0.005
    return o


def a_hueso(o, arm, hueso):
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = arm
    o.parent_type = 'BONE'
    o.parent_bone = hueso
    bpy.context.view_layer.update()
    o.matrix_world = mw


def accesorios(c):
    """Lentes, corbata y portapapeles del supervisor."""
    aw = c.arm.matrix_world
    ojos = [aw @ c.arm.data.bones['eye.' + l].head_local for l in ('L', 'R')]
    for p in ojos:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.021, minor_radius=0.0025, location=p + Vector((0, -0.022, 0)),
                                         rotation=(math.radians(90), 0, 0))
        t = bpy.context.object
        t.data.materials.append(mat('#1a202c', 0.3))
        mover_a(t, c.col('lentes'))
        a_hueso(t, c.arm, 'head')
    centro = (ojos[0] + ojos[1]) / 2 + Vector((0, -0.024, 0.002))
    bpy.ops.mesh.primitive_cube_add(location=centro)
    p = bpy.context.object
    p.scale = ((ojos[0] - ojos[1]).length / 2 - 0.021, 0.002, 0.002)
    p.data.materials.append(mat('#1a202c', 0.3))
    mover_a(p, c.col('lentes'))
    a_hueso(p, c.arm, 'head')
    # Corbata: nudo bajo el cuello y hoja por el pecho, al frente
    zc = c.arm.data.bones['neck01'].head_local.z - 0.02
    for z, alto, ancho in ((zc, 0.03, 0.034), (zc - 0.15, 0.26, 0.045)):
        y = frente_y(c, z) - 0.012
        bpy.ops.mesh.primitive_cube_add(location=aw @ Vector((0, y, z)))
        t = bpy.context.object
        t.scale = (ancho / 2, 0.006, alto / 2)
        t.data.materials.append(mat('#2a4365', 0.5))
        b = t.modifiers.new('b', 'BEVEL')
        b.width = 0.005
        mover_a(t, c.col('corbata'))
        a_hueso(t, c.arm, 'spine01' if z == zc else 'spine02')
    # Portapapeles en la mano derecha
    m = aw @ c.arm.data.bones['wrist.R'].head_local
    for tam, color_, dy in (((0.17, 0.014, 0.23), '#8b5e3c', 0), ((0.14, 0.004, 0.18), '#ffffff', -0.009)):
        bpy.ops.mesh.primitive_cube_add(location=m + Vector((0.02, -0.07 + dy, -0.06)))
        t = bpy.context.object
        t.scale = (tam[0] / 2, tam[1] / 2, tam[2] / 2)
        t.data.materials.append(mat(color_, 0.6))
        mover_a(t, c.col('tabla'))
        a_hueso(t, c.arm, 'wrist.R')


def camara():
    bpy.ops.object.camera_add(location=(0, -8, 0.95), rotation=(math.radians(90), 0, 0))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.ortho_scale = ALTO_M
    bpy.context.scene.camera = cam
    return cam


def preparar():
    escena(ANCHO_PX, ALTO_PX, fondo='#ffffff', sol_rot=(50, 10, 40), sol=2.0, ambiente=0.5)
    s = bpy.context.scene
    s.render.film_transparent = True
    s.eevee.taa_render_samples = 16
    camara()


def armar(entrada, nombre):
    c = Cuerpo(entrada, nombre)
    expresiones(c, entrada)
    capa_cara(c)
    for m in ('corta', 'larga'):
        polera(c, m)
    for l in ('largo', 'corto'):
        pantalon(c, l)
    for v in CHALECOS:
        chaleco(c, v)
    if nombre == 'hombre':
        accesorios(c)
    return c


# ---------------------------------------------------------------- capas para el juego
# Lo que tapa a cada capa (se renderiza con eso como "holdout"; así las capas se pueden superponer).
def capas(c):
    pelos = [n for n in c.cols if n.startswith('pelo_')]
    d = {'piel': [], 'zapatos': [], 'pantalon_largo': ['piel'], 'pantalon_corto': ['piel'],
         # el pantalón va encima de la polera en la cintura (polera adentro)
         'polera_corta': ['piel', 'pantalon_largo'], 'polera_larga': ['piel', 'pantalon_largo'],
         **{'chaleco_' + v: ['piel', 'polera_larga'] for v in CHALECOS},
         **{p: ['piel', 'polera_larga', 'chaleco_basico'] for p in pelos}}
    if 'lentes' in c.cols:
        d.update({'corbata': ['piel', 'polera_larga'], 'lentes': ['piel'], 'tabla': []})
    return d


POSES_JUEGO = ['quieto', 'habla', 'feliz', 'triste', 'camina1', 'camina2']
CARAS = ['sonrisa', 'abierta', 'triste', 'parpadeo']


def renderizar(c, salida):
    s = bpy.context.scene
    vistas = {lc.name: lc for lc in bpy.context.view_layer.layer_collection.children}

    def mostrar(capa, tapan):
        for n, lc in vistas.items():
            nombre = n.split(':', 1)[1] if ':' in n else n
            lc.exclude = nombre not in (capa, *tapan)
            lc.holdout = nombre in tapan

    def foto(nombre):
        s.render.filepath = str(salida / f'{nombre}.png')
        bpy.ops.render.render(write_still=True)

    for pose in POSES_JUEGO:
        c.posar(pose)
        poner_expresion(c, None)
        for capa, tapan in capas(c).items():
            mostrar(capa, tapan)
            foto(f'{pose}__{capa}')
        for cara in CARAS:
            poner_expresion(c, cara)
            mostrar('cara', [])
            foto(f'{pose}__cara_{cara}')
            mostrar('rasgos', ['cara'])
            foto(f'{pose}__rasgos_{cara}')
            mostrar('cejas', [])
            foto(f'{pose}__cejas_{cara}')
    for lc in vistas.values():
        lc.exclude = False
        lc.holdout = False


def generar_capas(entrada, salida, cuerpos):
    for nombre in cuerpos:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        _mats.clear()
        preparar()
        c = armar(entrada, nombre)
        carpeta = salida / nombre
        carpeta.mkdir(parents=True, exist_ok=True)
        renderizar(c, carpeta)


def preview(entrada, salida):
    """Vista previa vestida: hombre y mujer en varias poses y expresiones, con colores de prueba."""
    salida = pathlib.Path(salida)
    tintes = {'piel': '#c68642', 'cara': '#c68642', 'zapatos': '#2d3748', 'polera_corta': '#e53e3e',
              'polera_larga': '#f7fafc', 'pantalon_largo': '#2c5282', 'pelo_corto': '#3b2a1a', 'pelo_cola': '#1a1a1a',
              'cejas': '#3b2a1a'}
    for nombre, pelo, chaleco_, polera_ in (('hombre', 'pelo_corto', 'chaleco_basico', 'polera_larga'), ('mujer', 'pelo_cola', 'chaleco_oro', 'polera_corta')):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        _mats.clear()
        preparar()
        c = armar(entrada, nombre)
        visibles = {'piel', 'cara', 'zapatos', polera_, 'pantalon_largo', chaleco_, 'rasgos', 'cejas', pelo, 'lentes', 'corbata', 'tabla'}
        for n, col in c.cols.items():
            col.hide_render = n not in visibles
            if n in tintes:
                for o in col.objects:
                    for i, m in enumerate(o.data.materials):
                        if m and m.name.startswith('pm'):
                            o.data.materials[i] = mat(tintes[n])
                        elif m and m.name.startswith('tex_') and m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].links:
                            b = m.node_tree.nodes['Principled BSDF']
                            mix = m.node_tree.nodes.new('ShaderNodeMix')
                            mix.data_type = 'RGBA'
                            mix.blend_type = 'MULTIPLY'
                            mix.inputs['Factor'].default_value = 1
                            enlace = b.inputs['Base Color'].links[0]
                            m.node_tree.links.new(enlace.from_socket, mix.inputs['A'])
                            mix.inputs['B'].default_value = (*[lineal(x) for x in hexa(tintes[n])], 1)
                            m.node_tree.links.new(mix.outputs['Result'], b.inputs['Base Color'])
        for pose, cara in (('quieto', 'sonrisa'), ('habla', 'abierta'), ('feliz', 'abierta'), ('triste', 'triste')):
            c.posar(pose)
            poner_expresion(c, cara)
            bpy.context.scene.render.filepath = str(salida.with_name(f'{salida.stem}_{nombre}_{pose}.png'))
            bpy.ops.render.render(write_still=True)


if ARGS and ARGS[0] == 'preview':
    preview(pathlib.Path(ARGS[1]), ARGS[2])
elif ARGS and ARGS[0] == 'capas':
    generar_capas(pathlib.Path(ARGS[1]), pathlib.Path(ARGS[2]), ARGS[3:] or CUERPOS)
print('listo')
