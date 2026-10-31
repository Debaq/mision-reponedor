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
from mathutils.bvhtree import BVHTree
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


def alisar_pecho(o, veces=40):
    """Cuerpo con menos detalle: el busto sin punta (antes de las expresiones, que se guardan como
    shape keys sobre esta malla). La ropa sale de este mismo cuerpo, así que tampoco la marca."""
    pecho = {g.index for g in o.vertex_groups if g.name.startswith('breast')}
    bm = bmesh.new()
    bm.from_mesh(o.data)
    capa = bm.verts.layers.deform.active
    peso = {v: max((w for i, w in v[capa].items() if i in pecho), default=0.0) for v in bm.verts}
    zona = [v for v in bm.verts if peso[v] > 0.05]
    if not zona:
        bm.free()
        return
    # Se acerca el busto al plano del pecho (el borde de la zona, por delante), según el peso del hueso.
    borde = [v.co.y for v in zona if any(peso[e.other_vert(v)] <= 0.05 for e in v.link_edges) and v.co.y < 0]
    plano = sorted(borde)[len(borde) // 2] if borde else max(v.co.y for v in zona)
    for v in zona:
        if v.co.y < plano:
            v.co.y = plano + (v.co.y - plano) * (1 - 0.55 * min(1.0, peso[v] * 1.5))
    for _ in range(veces):
        bmesh.ops.smooth_vert(bm, verts=zona, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(o.data)
    bm.free()


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
        alisar_pecho(self.cuerpo)
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
    # gesticula con la mano izquierda: la derecha queda libre para el portapapeles del supervisor
    'habla': [('upperarm01.R', (0, -1, 0), 22), ('lowerarm01.R', (0, -1, 0), 5),
              ('upperarm01.L', (0, 1, 0), 14), ('upperarm01.L', (1, 0, 0), -30), ('lowerarm01.L', (1, 0, 0), -65)],
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


# La boca abierta se exagera: en el juego la cara es chica y al hablar tiene que notarse.
INTENSIDAD = {'abierta': 1.7}


def poner_expresion(c, juego):
    for o in [c.cuerpo, *c.col('cejas').objects, *c.col('rasgos').objects, *c.col('cara').objects]:
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.slider_max = 2.0
                kb.value = INTENSIDAD.get(juego, 1.0) if kb.name == juego else 0.0
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


BRAZO = ('upperarm01', 'upperarm02', 'lowerarm01', 'lowerarm02', 'wrist')


def eje_brazo(c, lado):
    """Hombro, codo y muñeca (reposo) del brazo `lado` ('L' o 'R')."""
    b = c.arm.data.bones
    return (b['upperarm01.' + lado].head_local, b['lowerarm01.' + lado].head_local, b['wrist.' + lado].head_local)


def ropa(c, nombre, col, huesos, grosor, color=BLANCO, rough=0.7, manga=None, cortes=(), suave=6):
    """Prenda sacada del propio cuerpo: se conservan los vértices que mueven los huesos que cubre, se
    alisa (sin pezones, ombligo ni músculos marcados, como una tela), se infla `grosor` metros y se
    recorta con planos para que los bordes queden rectos. Calza en cualquier pose.
    - manga: fracción del brazo que cubre (0 = sisa en el hombro, 0.5 = codo, 1 = muñeca).
    - cortes: (punto, normal, borrar) -> se corta con ese plano y se borran las caras del torso cuyo
      centro cumple borrar(centro)."""
    me = c.cuerpo.data.copy()
    o = bpy.data.objects.new(nombre, me)
    col.objects.link(o)
    o.matrix_world = c.cuerpo.matrix_world
    if me.shape_keys:
        o.shape_key_clear()
    info = hueso_dominante(c.cuerpo)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    # Lado del brazo de cada vértice (+1 izquierdo, -1 derecho, 0 torso o piernas)
    brazo = bm.verts.layers.float.new('brazo')
    pecho = []
    borrar = []
    for v in bm.verts:
        h, _ = info[v.index]
        base = h.rsplit('.', 1)[0] if h and h[-2:] in ('.L', '.R') else h
        if base not in huesos:
            borrar.append(v)
        elif base in BRAZO:
            v[brazo] = 1.0 if h.endswith('.L') else -1.0
        elif base == 'breast':
            pecho.append(v)
    bmesh.ops.delete(bm, geom=borrar, context='VERTS')
    interior = [v for v in bm.verts if not v.is_boundary]
    for _ in range(suave):
        bmesh.ops.smooth_vert(bm, verts=interior, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # La tela no marca el busto: se alisa aparte (pecho y alrededor) mucho más.
    zona = {n for v in pecho if v.is_valid for e in v.link_edges for n in e.verts} | {v for v in pecho if v.is_valid}
    for _ in range(25 if zona else 0):
        bmesh.ops.smooth_vert(bm, verts=list(zona), factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * grosor
    # Al alisar, la tela puede quedar dentro del cuerpo: se empuja afuera lo que quedó muy pegado.
    arbol = arbol_cuerpo(c)
    for v in bm.verts:
        p_, n_, _, _ = arbol.find_nearest(v.co)
        if p_ is not None and (v.co - p_).dot(n_) < grosor:
            v.co = p_ + n_ * grosor

    # Primero todos los cortes (planos) y después se borra: si no, lo borrado por un plano deja
    # dientes donde el siguiente aún no cortaba.
    planos, quitar = [], []
    lado_de = lambda f: sum(v[brazo] for v in f.verts) / len(f.verts)  # noqa: E731
    if manga is not None:
        for lado, s_ in (('L', 1), ('R', -1)):
            hombro, codo, muneca = eje_brazo(c, lado)
            if manga <= 0.5:
                p_, d = hombro.lerp(codo, manga * 2), (codo - hombro).normalized()
            else:
                p_, d = codo.lerp(muneca, manga * 2 - 1), (muneca - codo).normalized()
            planos.append((p_, d))
            quitar.append(lambda f, p_=p_, d=d, s_=s_: lado_de(f) * s_ > 0.5 and (f.calc_center_median() - p_).dot(d) > 0)
    for corte in cortes:
        punto, normal, q = corte[:3]
        todo = len(corte) > 3 and corte[3]
        planos.append((Vector(punto), Vector(normal)))
        quitar.append(lambda f, q=q, todo=todo: (todo or abs(lado_de(f)) < 0.5) and q(f.calc_center_median()))
    for punto, normal in planos:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, dist=0.0005, plane_co=punto, plane_no=normal)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(q(f) for q in quitar)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # Islas sueltas que dejaron los cortes (pedacitos): fuera.
    vistas = set()
    for f in bm.faces:
        if f in vistas:
            continue
        isla, pila = [], [f]
        vistas.add(f)
        while pila:
            g = pila.pop()
            isla.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in vistas:
                        vistas.add(h)
                        pila.append(h)
        if len(isla) < 40:
            bmesh.ops.delete(bm, geom=isla, context='FACES')
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


def arbol_cuerpo(c):
    """Superficie del cuerpo contra la que se empuja la ropa."""
    if not hasattr(c, 'arbol'):
        bm = bmesh.new()
        bm.from_mesh(c.cuerpo.data)
        c.arbol = BVHTree.FromBMesh(bm)
        bm.free()
    return c.arbol


def z_hueso(c, hueso, extremo='head'):
    return getattr(c.arm.data.bones[hueso], extremo + '_local').z


TORSO = ('spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'breast', 'clavicle', 'shoulder01', 'neck01', 'neck02',
         'pelvis', 'root')


def polera(c, manga):
    """Polera suelta, por fuera del pantalón: bastilla bajo la cintura y cuello redondo."""
    zb = z_hueso(c, 'spine05') + 0.01
    zc = z_hueso(c, 'neck01')
    cortes = [((0, 0, zb), (0, 0, -1), lambda p: p.z < zb),
              ((0, 0, zc), (0, -0.45, 1), lambda p: p.z - zc - 0.45 * p.y > 0)]
    ropa(c, 'polera_' + manga, c.col('polera_' + manga), TORSO + BRAZO, 0.016,
         manga=0.42 if manga == 'corta' else 0.97, cortes=cortes, suave=6)


def pantalon(c, largo):
    zc = z_hueso(c, 'spine04') + 0.035
    zp = 0.07 if largo == 'largo' else z_hueso(c, 'lowerleg01.L') + 0.1
    cortes = [((0, 0, zc), (0, 0, 1), lambda p: p.z > zc), ((0, 0, zp), (0, 0, -1), lambda p: p.z < zp)]
    huesos = ('root', 'pelvis', 'spine05', 'spine04', 'upperleg01', 'upperleg02', 'lowerleg01', 'lowerleg02')
    ropa(c, 'pantalon_' + largo, c.col('pantalon_' + largo), huesos, 0.01, cortes=cortes, suave=4)


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
    # Bastilla a la cadera, sisas en el hombro, cuello y escote en V con bordes rectos.
    zb = z_hueso(c, 'spine05') + 0.03
    zc = z_hueso(c, 'neck01') - 0.005
    z0, a_, k = z_hueso(c, 'spine01') - 0.04, 0.012, 0.3
    en_v = lambda p: p.y < 0 and p.z > z0 and abs(p.x) < a_ + k * (p.z - z0)  # noqa: E731
    cortes = [((0, 0, zb), (0, 0, -1), lambda p: p.z < zb),
              ((0, 0, zc), (0, -0.3, 1), lambda p: p.z - zc - 0.3 * p.y > 0),
              ((a_, 0, z0), (1, 0, -k), en_v), ((-a_, 0, z0), (1, 0, k), en_v)]
    # Sisas: planos verticales a la altura del hombro (como una pechera), brazos fuera.
    xs = c.arm.data.bones['upperarm01.L'].head_local.x - 0.012
    cortes += [((xs, 0, 0), (1, 0, 0), lambda p: p.x > xs, True), ((-xs, 0, 0), (-1, 0, 0), lambda p: p.x < -xs, True)]
    o = ropa(c, 'chaleco', col, TORSO + BRAZO, 0.034, color, 0.75, cortes=cortes, suave=6)
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
    # Logo (y estrella en los de reconocimiento) arriba, junto al cuello del chaleco (no sobre el busto)
    zl = z_hueso(c, 'neck01') - 0.085
    for x, color_, forma in ((-0.088, '#ffffff', 'disco'), (0.088, '#f6c343' if variante != 'oro' else '#ffffff', 'estrella')):
        if forma == 'estrella' and variante == 'basico':
            continue
        y = frente_y(c, zl, x) - 0.042
        pieza = disco(0.02) if forma == 'disco' else estrella(0.025)
        pieza.location = c.arm.matrix_world @ Vector((x, y, zl))
        pieza.rotation_euler = (math.radians(75), 0, 0)  # inclinada como la parte alta del pecho
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
        y = frente_y(c, z) - 0.02
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
          'polera_corta': ['piel'], 'polera_larga': ['piel'],
         **{'chaleco_' + v: ['piel', 'polera_larga'] for v in CHALECOS},
         **{p: ['piel', 'polera_larga', 'chaleco_basico'] for p in pelos}}
    if 'lentes' in c.cols:
        d.update({'corbata': ['piel', 'polera_larga', 'chaleco_basico'], 'lentes': ['piel'], 'tabla': []})
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
              'polera_larga': '#f7fafc', 'pantalon_largo': '#2c5282', 'pelo_corto': '#3b2a1a', 'pelo_cola': '#1a1a1a', 'pelo_melena': '#6b4423',
              'cejas': '#3b2a1a'}
    for nombre, pelo, chaleco_, polera_ in (('hombre', 'pelo_corto', 'chaleco_basico', 'polera_larga'), ('mujer', 'pelo_cola', 'chaleco_oro', 'polera_corta'),
                                            ('nobinario', 'pelo_melena', None, 'polera_corta')):
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
            bpy.context.scene.render.filepath = str(salida.with_name(f'{salida.stem}_{nombre}_{pose}{"" if chaleco_ else "_sin"}.png'))
            bpy.ops.render.render(write_still=True)


if ARGS and ARGS[0] == 'preview':
    preview(pathlib.Path(ARGS[1]), ARGS[2])
elif ARGS and ARGS[0] == 'capas':
    generar_capas(pathlib.Path(ARGS[1]), pathlib.Path(ARGS[2]), ARGS[3:] or CUERPOS)
print('listo')
