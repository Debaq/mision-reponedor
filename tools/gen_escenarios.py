"""Fondos 3D de la bodega y de la estantería (sala de ventas), renderizados con Blender.

Uso:  npm run escenarios               (todas)
      npm run escenarios -- tienda sala   (solo algunas: bodega, sala, gondola3, tienda, habitacion, fachada)

La cámara mira de frente al rack / la góndola, de modo que en ese plano 1 metro = 200 px del juego
y el piso (z = 0) queda en y = 560. Así las cajas y repisas del render calzan con las posiciones
que usan las escenas Bodega y Sala (cajas, productos, etiquetas). El carro se renderiza delante y su
posición en pantalla se guarda en src/data/escenarios.json.

Genera public/assets/escenarios/bodega.jpg y sala.jpg (1600x900; el juego los muestra a 1280x720).
"""
import json
import math
import pathlib
import random
import sys

import bpy

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bl_util import caja, cil, escena, lampara, mat, muestra, piso_ajedrez, proyectar  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
OUT = muestra() or RAIZ / 'public' / 'assets' / 'escenarios'
W, H = 1600, 900
PX = 200          # px del juego por metro, en el plano y = 0
ALTURA_CAM = 1.0  # la cámara está horizontal a 1 m: y = 360 px ↔ z = 1 m; z = 0 ↔ y = 560 px
DIST = 6.0        # distancia de la cámara al plano y = 0

CARTON, CARTON_OSC = '#c89b62', '#9c7442'
AZUL_RACK, NARANJO = '#2b6cb0', '#dd6b20'


def gx(px):
    """x del juego (px) → metros en el plano y = 0."""
    return (px - 640) / PX


def gz(py):
    """y del juego (px) → altura en metros en el plano y = 0."""
    return ALTURA_CAM + (360 - py) / PX


def camara():
    bpy.ops.object.camera_add(location=(0, -DIST, ALTURA_CAM), rotation=(math.radians(90), 0, 0))
    cam = bpy.context.object
    cam.data.sensor_fit = 'HORIZONTAL'
    cam.data.sensor_width = 36
    cam.data.lens = DIST * 36 / (1280 / PX)   # ancho visible en y = 0: 6,4 m = 1280 px
    bpy.context.scene.camera = cam
    return cam


def carro(x, y, ancho, fondo=0.9):
    """Carro plataforma (vista de frente): plataforma azul, manilla a la derecha y ruedas."""
    caja(x, y, 0.16, ancho, fondo, 0.08, '#2b6cb0', rough=0.5)
    caja(x, y - fondo / 2 + 0.02, 0.16, ancho, 0.04, 0.1, '#1e4e80')
    caja(x + ancho / 2 - 0.05, y, 0.24, 0.06, 0.06, 0.95, '#1e4e80')
    caja(x + ancho / 2 - 0.05, y, 1.17, 0.1, 0.5, 0.05, '#1e4e80')
    for rx in (-ancho / 2 + 0.25, ancho / 2 - 0.25):
        for ry in (-fondo / 2 + 0.15, fondo / 2 - 0.15):
            cil(x + rx, y + ry, 0.02, 0.07, 0.06, '#1a202c', n=12).rotation_euler = (0, math.radians(90), 0)
            caja(x + rx, y + ry, 0.08, 0.05, 0.05, 0.08, '#a0aec0')


def guardar(nombre):
    s = bpy.context.scene
    s.render.image_settings.file_format = 'JPEG'
    s.render.image_settings.quality = 88
    s.render.filepath = str(OUT / f'{nombre}.jpg')
    if muestra():
        s.render.resolution_percentage = 50
    bpy.ops.render.render(write_still=True)


def luces_techo(y0, y1, z=3.6):
    for y in range(int(y0), int(y1), 2):
        for x in (-2.0, 2.0):
            caja(x, y, z, 1.6, 0.25, 0.05, '#f7fafc', rough=0.3)
        lampara('AREA', (0, y, z - 0.1), 60, 3.5)


# ---------------------------------------------------------------- bodega
def bodega():
    escena(W, H, fondo='#a9b7c6', sol=1.9, ambiente=0.65)
    random.seed(3)
    # Piso de cemento con línea de seguridad amarilla, muro del fondo
    caja(0, -2, -0.05, 14, 14, 0.05, '#7b8794')
    piso_ajedrez(-7, -9, 7, 5, '#76838f', '#7f8c98', 1.5, 0.001)
    caja(0, -0.75, 0.002, 14, 0.12, 0.004, '#f6c343')
    caja(0, 1.2, 0, 14, 0.2, 4.0, '#8a96a3')
    for z in (0.6, 1.4, 2.2, 3.0):
        caja(0, 1.09, z, 14, 0.02, 0.03, '#7a8693')

    # Rack principal: 4 módulos de 1 m (las cajas tocables del juego) y 3 niveles.
    cols = [370, 570, 770, 970]
    filas = [150, 290, 430]
    bordes = [gx(c - 100) for c in cols] + [gx(cols[-1] + 100)]
    for x in bordes:
        for y in (-0.05, 0.75):
            caja(x, y, 0, 0.08, 0.08, gz(30), AZUL_RACK, rough=0.5)
    for fy in filas:
        zc = gz(fy)
        zb = zc - 0.26          # base de la caja (102 px de alto)
        caja((bordes[0] + bordes[-1]) / 2, -0.05, zb - 0.07, bordes[-1] - bordes[0] + 0.08, 0.08, 0.07, NARANJO, rough=0.5)
        caja((bordes[0] + bordes[-1]) / 2, 0.35, zb - 0.03, bordes[-1] - bordes[0], 0.8, 0.03, '#a0aec0')
        for c in cols:
            # Caja de cartón abierta (frente 0,8 × 0,51 m); el juego pone la etiqueta con el producto.
            caja(gx(c), 0.33, zb, 0.8, 0.62, 0.51, CARTON, rough=0.95)
            caja(gx(c), 0.33, zb + 0.49, 0.8, 0.62, 0.02, '#e0b880')
            caja(gx(c), 0.02, zb + 0.47, 0.8, 0.02, 0.04, CARTON_OSC)
    # Nivel de arriba: cajas cerradas de reserva
    ztop = gz(filas[0]) + 0.35
    caja((bordes[0] + bordes[-1]) / 2, -0.05, ztop - 0.07, bordes[-1] - bordes[0] + 0.08, 0.08, 0.07, NARANJO, rough=0.5)
    for c in cols:
        for k in range(2):
            caja(gx(c) - 0.2 + k * 0.42, 0.35, ztop, 0.38, 0.5, 0.35, random.choice((CARTON, CARTON_OSC, '#d3a86e')))

    # Racks laterales hacia la cámara (dan profundidad, como la referencia)
    for lado in (-1, 1):
        x = lado * 3.15
        for y in (-2.6, -1.3, 0.0):
            caja(x, y, 0, 0.07, 0.07, 3.0, AZUL_RACK)
            caja(x + lado * 0.9, y, 0, 0.07, 0.07, 3.0, AZUL_RACK)
        for z in (0.0, 0.8, 1.6, 2.4):
            caja(x + lado * 0.45, -1.3, z + 0.05, 0.95, 2.7, 0.06, NARANJO)
            for y in (-2.2, -1.3, -0.4):
                if random.random() < 0.85:
                    caja(x + lado * 0.45, y, z + 0.11, 0.7, 0.7, random.choice((0.45, 0.55, 0.6)),
                         random.choice((CARTON, CARTON_OSC, '#d3a86e')), rz=random.uniform(-0.05, 0.05))

    # Carro delante del rack
    carro_x, carro_y, carro_ancho = gx(700), -1.2, 3.0
    carro(carro_x, carro_y, carro_ancho)
    luces_techo(-4, 2)
    cam = camara()
    guardar('bodega')
    return {'carro': plataforma(cam, carro_x, carro_y, carro_ancho)}


def plataforma(cam, x, y, ancho):
    """Dónde queda en pantalla la superficie del carro (para poner los productos encima)."""
    izq = proyectar(cam, (x - ancho / 2, y, 0.24))
    der = proyectar(cam, (x + ancho / 2, y, 0.24))
    mango = proyectar(cam, (x + ancho / 2 - 0.05, y, 1.2))
    return {'x': round((izq[0] + der[0]) / 2), 'y': round(izq[1]), 'ancho': round(der[0] - izq[0]),
            'mango': [round(mango[0]), round(mango[1])]}


# ---------------------------------------------------------------- sala
def sala():
    escena(W, H, fondo='#dfe8ee', sol=1.5, ambiente=0.55)
    random.seed(5)
    # Piso de baldosas y muro del fondo con franja de la marca
    caja(0, -2, -0.05, 16, 16, 0.05, '#e6d8bf')
    piso_ajedrez(-8, -9, 8, 6, '#f3e9d8', '#e6d8bf', 0.8, 0.001)
    caja(0, 2.4, 0, 16, 0.2, 4.0, '#eef3f6')
    caja(0, 2.29, 2.6, 16, 0.02, 0.3, '#553c9a')
    caja(0, 2.28, 2.55, 16, 0.02, 0.05, '#38b2ac')

    # Góndola principal: x de 250 a 1110 px, repisas en y = 190, 330, 470 px, dos secciones por repisa.
    x0, x1 = gx(250), gx(1110)
    xm = gx(680)
    bases = [gz(b) for b in (190, 330, 470)]
    ancho = x1 - x0
    xc = (x0 + x1) / 2
    caja(xc, 0.35, 0, ancho + 0.14, 0.1, gz(70), '#b8c4d0', rough=0.7)          # panel trasero
    for z in [0.2 + k * 0.1 for k in range(int((gz(70) - 0.3) / 0.1))]:          # perforaciones del panel
        caja(xc, 0.29, z, ancho, 0.01, 0.012, '#a3b1bf')
    for x in (x0 - 0.035, xm, x1 + 0.035):
        caja(x, 0.05, 0, 0.07 if x != xm else 0.05, 0.6, gz(70), '#a0aec0', rough=0.5)   # parales
    caja(xc, 0.05, gz(70), ancho + 0.14, 0.6, 0.2, '#553c9a', rough=0.6)          # remate superior
    caja(xc, -0.26, gz(70) + 0.15, ancho + 0.14, 0.02, 0.03, '#2c7a7b')
    for b in bases:
        caja(xc, 0.05, b - 0.05, ancho, 0.6, 0.05, '#e2e8f0', rough=0.4)           # repisa
        caja(xc, -0.26, b - 0.29, ancho, 0.03, 0.24, '#8795a1', rough=0.5)        # riel de etiquetas
        caja(xc, -0.28, b - 0.07, ancho, 0.01, 0.02, '#5f6b78')
    caja(xc, 0.05, 0, ancho + 0.14, 0.62, gz(470) - 0.36, '#8795a1', rough=0.6)   # zócalo
    caja(xc, -0.27, 0.0, ancho + 0.14, 0.02, 0.1, '#a0aec0')

    # Góndolas vecinas (cabeceras laterales, en perspectiva) con productos de colores
    colores = ['#e53e3e', '#3182ce', '#ecc94b', '#48bb78', '#ed8936', '#d53f8c', '#319795', '#805ad5']
    for lado in (-1, 1):
        x = lado * 3.25
        caja(x, -1.2, 0, 0.7, 3.0, 2.0, '#e2e8f0', rough=0.6)
        caja(x, -1.2, 2.0, 0.7, 3.0, 0.15, '#553c9a')
        for z in (0.35, 0.85, 1.35):
            caja(x - lado * 0.36, -1.2, z - 0.05, 0.05, 3.0, 0.05, '#f7fafc')
            y = -2.6
            color = random.choice(colores)
            while y < 0.2:
                if random.random() < 0.25:
                    color = random.choice(colores)
                caja(x - lado * 0.25, y, z, 0.25, 0.22, random.choice((0.3, 0.36, 0.4)), color)
                y += 0.26

    carro_x, carro_y, carro_ancho = gx(640), -1.3, 3.1
    carro(carro_x, carro_y, carro_ancho)
    luces_techo(-4, 2)
    cam = camara()
    guardar('sala')
    return {'carro': plataforma(cam, carro_x, carro_y, carro_ancho)}


def fondo_sala(semilla):
    """Piso, muro con franja de la marca y góndolas vecinas en perspectiva (común a las vistas de sala)."""
    escena(W, H, fondo='#dfe8ee', sol=1.5, ambiente=0.55)
    random.seed(semilla)
    caja(0, -2, -0.05, 16, 16, 0.05, '#e6d8bf')
    piso_ajedrez(-8, -9, 8, 6, '#f3e9d8', '#e6d8bf', 0.8, 0.001)
    caja(0, 2.4, 0, 16, 0.2, 4.0, '#eef3f6')
    caja(0, 2.29, 2.6, 16, 0.02, 0.3, '#553c9a')
    caja(0, 2.28, 2.55, 16, 0.02, 0.05, '#38b2ac')


def gondola3():
    """Góndola de 3 secciones de las tareas (Precios, Faltantes): mismas medidas que src/lib/gondola.js
    con centros en 365, 650 y 935 px, repisas en y = 270 y 450 px, de y = 100 a 480 px."""
    fondo_sala(9)
    x0, x1 = gx(365 - 160), gx(935 + 160)
    ancho, xc = x1 - x0, (gx(205) + gx(1095)) / 2
    arriba, abajo = gz(100), gz(480)
    caja(xc, 0.35, abajo, ancho, 0.1, arriba - abajo, '#b8c4d0', rough=0.7)
    for z in [abajo + 0.1 + k * 0.1 for k in range(int((arriba - abajo - 0.15) / 0.1))]:
        caja(xc, 0.29, z, ancho - 0.04, 0.01, 0.012, '#a3b1bf')
    for x in (x0 - 0.035, x1 + 0.035):
        caja(x, 0.05, 0, 0.07, 0.6, arriba + 0.1, '#a0aec0', rough=0.5)
    for c in (365, 650, 935)[1:]:
        caja(gx(c - 150), 0.2, abajo, 0.03, 0.3, arriba - abajo, '#a0aec0')
    caja(xc, 0.05, arriba, ancho + 0.14, 0.6, 0.12, '#553c9a', rough=0.6)
    for b in (gz(270), gz(450)):
        caja(xc, 0.05, b - 0.07, ancho, 0.6, 0.07, '#e2e8f0', rough=0.4)
        caja(xc, -0.26, b - 0.23, ancho, 0.03, 0.16, '#8795a1', rough=0.5)
    caja(xc, 0.05, 0, ancho + 0.14, 0.62, abajo - 0.25, '#8795a1', rough=0.6)
    luces_techo(-4, 2)
    camara()
    guardar('gondola3')


def camara_libre(pos, mira, lente=28):
    from mathutils import Vector
    bpy.ops.object.camera_add(location=pos)
    cam = bpy.context.object
    cam.data.lens = lente
    cam.rotation_euler = (Vector(mira) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    return cam


def persona(x, y, polera, pelo='#2d3748', piel='#e0ac69'):
    """Persona low-poly de fondo (cajera, clientes)."""
    from bl_util import mat as _mat
    caja(x - 0.09, y, 0, 0.14, 0.16, 0.8, '#2d3748')
    caja(x + 0.09, y, 0, 0.14, 0.16, 0.8, '#2d3748')
    caja(x, y, 0.8, 0.44, 0.26, 0.6, polera)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.17, location=(x, y, 1.57))
    bpy.context.object.data.materials.append(_mat(piel, 0.7))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.18, location=(x, y + 0.03, 1.64))
    o = bpy.context.object
    o.scale = (1, 1, 0.65)
    o.data.materials.append(_mat(pelo, 0.8))


def tienda():
    """Interior del supermercado a la altura de los ojos (fondo de conversaciones y tareas)."""
    escena(W, H, fondo='#e8eef2', sol=1.4, ambiente=0.6)
    random.seed(11)
    piso_ajedrez(-12, -6, 12, 30, '#f3e9d8', '#e6d8bf', 1.0)
    caja(0, 30, 0, 24, 0.3, 6, '#eef3f6')                       # muro del fondo
    caja(0, 29.8, 3.2, 24, 0.05, 0.5, '#553c9a')
    caja(0, 29.78, 3.1, 24, 0.05, 0.1, '#38b2ac')
    caja(0, 12, 5.0, 24, 40, 0.1, '#f7fafc')                     # cielo
    colores = ['#e53e3e', '#3182ce', '#ecc94b', '#48bb78', '#ed8936', '#d53f8c', '#319795', '#805ad5', '#f7fafc']
    # Pasillos: góndolas a lo largo de y, a ambos lados y al fondo
    for gx_ in (-7.5, -4.2, 4.2, 7.5):
        for tramo in (6, 16):
            caja(gx_, tramo + 4, 0, 1.0, 8, 0.25, '#a0aec0')
            caja(gx_, tramo + 4, 0, 0.08, 8, 1.9, '#cbd5e0')
            caja(gx_, tramo + 4, 1.9, 1.0, 8, 0.2, '#553c9a')
            for z in (0.25, 0.75, 1.25):
                caja(gx_, tramo + 4, z, 1.0, 8, 0.04, '#f7fafc')
                for lado in (-1, 1):
                    y = tramo + 0.2
                    color = random.choice(colores)
                    while y < tramo + 7.8:
                        if random.random() < 0.3:
                            color = random.choice(colores)
                        caja(gx_ + lado * 0.28, y, z + 0.04, 0.3, 0.26, random.choice((0.3, 0.38, 0.42)), color)
                        y += 0.3
    # Letreros colgantes de los pasillos, con los colores del juego
    for gx_, color in ((-5.85, '#dd6b20'), (5.85, '#3182ce'), (-5.85 - 3.3, '#319795'), (5.85 + 3.3, '#d53f8c')):
        caja(gx_, 9, 3.4, 1.6, 0.08, 0.6, color, rough=0.5)
        for dx in (-0.6, 0.6):
            caja(gx_ + dx, 9, 4.0, 0.02, 0.02, 1.0, '#4a5568')
    # Caja registradora con cajera (a la izquierda, al fondo del espacio central)
    caja(-1.6, 14, 0, 2.6, 0.9, 0.95, '#f7fafc')
    caja(-1.6, 14, 0.95, 2.2, 0.6, 0.04, '#2d3748')
    caja(-0.6, 14.3, 0.95, 0.4, 0.3, 0.4, '#4a5568')
    caja(-0.6, 14.2, 1.35, 0.42, 0.05, 0.3, '#90cdf4')
    persona(-1.4, 14.8, '#553c9a', '#1a202c', '#c68642')
    persona(1.8, 18.5, '#e53e3e', '#744210', '#f1c27d')
    persona(2.6, 21.0, '#48bb78', '#2d3748', '#8d5524')
    # Exhibidor de fruta en el centro, al fondo
    caja(1.2, 23, 0, 3.0, 1.6, 0.8, '#8b5e3c')
    for k in range(18):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.2,
                                             location=(0.0 + (k % 6) * 0.48, 22.5 + (k // 6) * 0.45, 0.95))
        bpy.context.object.data.materials.append(mat(random.choice(('#e53e3e', '#ed8936', '#48bb78', '#ecc94b')), 0.7))
    # Lámparas colgantes
    for ly in (6, 11, 16, 21):
        for lx in (-2.5, 2.5):
            caja(lx, ly, 3.9, 0.02, 0.02, 1.1, '#4a5568')
            bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.45, radius2=0.12, depth=0.4, location=(lx, ly, 3.75))
            bpy.context.object.data.materials.append(mat('#553c9a', 0.6))
            lampara('POINT', (lx, ly, 3.5), 150, 0.3)
    # Cámara a 1,09 m y horizontal: una persona de 1,72 m a ~4,2 m mide ~380 px con los pies en y ≈ 600,
    # la misma escala que en la bodega y las estanterías (ver ESCALA en src/lib/personaje.js).
    camara_libre((0, -3.5, 1.09), (0, 12, 1.09), lente=26)
    guardar('tienda')


def habitacion():
    """Pieza del personaje (crear personaje y aviso de contratación), como la referencia del documento."""
    escena(W, H, fondo='#f6e7d0', sol_rot=(60, -20, -40), sol=1.6, ambiente=0.6)
    random.seed(13)
    piso_ajedrez(-6, -4, 6, 6, '#c8925a', '#bd8650', 0.5)
    for k in range(24):                                          # tablas del piso
        caja(-6 + k * 0.5, 1, 0.002, 0.02, 10, 0.002, '#a87543')
    caja(0.6, 4.6, 0, 11, 0.2, 3.4, '#5cc6c0')                   # muro del fondo turquesa
    caja(-4.6, 0, 0, 0.2, 10, 3.4, '#4fb5af')                    # muro izquierdo
    caja(5.6, 0, 0, 0.2, 10, 3.4, '#4fb5af')                     # muro derecho
    caja(0.5, 0, 3.4, 10.6, 10, 0.1, '#f7fafc')                  # techo
    lampara('AREA', (0.5, 1.0, 3.2), 250, 4.5)
    caja(0.6, 4.48, 0, 11, 0.05, 0.15, '#f7fafc')                # guardapolvo
    # Ventana con cortinas
    caja(-1.2, 4.47, 1.2, 1.6, 0.04, 1.3, '#bfe7f7', rough=0.2)
    caja(-1.2, 4.45, 1.2, 1.7, 0.06, 0.08, '#f7fafc')
    caja(-1.2, 4.45, 2.42, 1.7, 0.06, 0.08, '#f7fafc')
    caja(-1.2, 4.45, 1.2, 0.06, 0.06, 1.3, '#f7fafc')
    for cx in (-2.2, -0.2):
        caja(cx, 4.4, 0.9, 0.45, 0.08, 1.8, '#f6ad55')
    # Clóset de madera
    caja(1.6, 4.1, 0, 1.6, 0.7, 2.4, '#9c6b3f')
    caja(1.6, 3.74, 0.1, 0.03, 0.02, 2.2, '#7a5230')
    for dx in (-0.12, 0.12):
        caja(1.6 + dx, 3.73, 1.1, 0.04, 0.04, 0.25, '#e2e8f0')
    # Cama a la derecha
    caja(3.6, 2.6, 0, 2.0, 3.2, 0.45, '#8b5e3c')
    caja(3.6, 2.6, 0.45, 1.9, 3.1, 0.22, '#f7fafc')
    caja(3.6, 2.2, 0.67, 1.9, 2.2, 0.06, '#553c9a')
    caja(3.6, 3.85, 0.67, 1.2, 0.5, 0.18, '#f7fafc')
    caja(3.6, 4.3, 0, 2.0, 0.12, 1.1, '#7a5230')
    # Velador con lámpara
    caja(2.2, 4.1, 0, 0.6, 0.5, 0.6, '#9c6b3f')
    cil(2.2, 4.1, 0.6, 0.08, 0.35, '#e2e8f0')
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.25, radius2=0.15, depth=0.3, location=(2.2, 4.1, 1.08))
    bpy.context.object.data.materials.append(mat('#f6e05e', 0.5))
    lampara('POINT', (2.2, 4.0, 1.0), 60, 0.15)
    # Alfombra, póster y planta
    caja(0.6, 1.0, 0.004, 3.0, 2.0, 0.01, '#805ad5')
    caja(0.6, 1.0, 0.012, 2.6, 1.6, 0.006, '#b794f4')
    caja(-4.48, 2.2, 1.4, 0.03, 0.9, 1.1, '#ed8936')
    caja(-4.47, 2.2, 1.55, 0.03, 0.6, 0.6, '#f7fafc')
    cil(-3.8, 3.8, 0, 0.25, 0.45, '#c05621')
    for k in range(6):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.28,
                                             location=(-3.8 + random.uniform(-0.2, 0.2), 3.8 + random.uniform(-0.2, 0.2), 0.7 + k * 0.12))
        bpy.context.object.data.materials.append(mat('#38a169', 0.8))
    camara_libre((0.4, -5.2, 1.09), (0.4, 3.0, 1.09), lente=24)   # misma altura que la tienda
    guardar('habitacion')


def fachada():
    """Fachada del supermercado (inicio, fin del turno, elegir turno). Cámara frontal: el letrero
    queda en y = 90..170 px y las puertas al centro, igual que el fondo plano anterior."""
    escena(W, H, fondo='#9fd3ef', sol_rot=(50, -15, -25), sol=2.0, ambiente=0.8)
    random.seed(17)
    # Cielo con degradado: plano lejano celeste
    caja(0, 30, -5, 80, 0.2, 40, '#9fd3ef')
    # Calle, vereda y solera
    caja(0, -6, -0.06, 40, 12, 0.05, '#5a6470')
    caja(0, -0.9, -0.02, 40, 3.2, 0.06, '#c9c4ba')
    caja(0, -2.45, -0.02, 40, 0.15, 0.1, '#e2e8f0')
    piso_ajedrez(-20, -2.4, 20, 0.6, '#c9c4ba', '#b9b4aa', 0.6, 0.045)
    # Interior que se ve por las vitrinas y la puerta
    caja(0, 1.6, 0, gx(1200) - gx(80), 0.1, gz(120), '#dfe8ee')
    for (x0p, x1p) in ((130, 410), (870, 1150)):
        xc = gx((x0p + x1p) / 2)
        for z in (gz(420), gz(360), gz(300)):
            caja(xc, 0.8, z, gx(x1p) - gx(x0p) - 0.1, 0.5, 0.03, '#a0aec0')
            x = gx(x0p) + 0.12
            while x < gx(x1p) - 0.12:
                caja(x, 0.75, z + 0.03, 0.12, 0.14, random.choice((0.16, 0.2, 0.24)),
                     random.choice(('#e53e3e', '#3182ce', '#ecc94b', '#48bb78', '#ed8936', '#d53f8c')))
                x += 0.15
    # Fachada por tramos (deja abiertas las vitrinas y la puerta)
    fx0, fx1 = gx(80), gx(1200)
    pared = '#f2efe8'
    def tramo(px0, px1, py0, py1):
        caja(gx((px0 + px1) / 2), 0.1, gz(py1), gx(px1) - gx(px0), 0.2, gz(py0) - gz(py1), pared)
    tramo(80, 1200, 120, 240)                     # franja superior bajo el letrero
    for (a_, b_) in ((80, 130), (410, 470), (810, 870), (1150, 1200)):
        tramo(a_, b_, 240, 560)                   # pilares
    tramo(130, 410, 440, 560)                     # bajo las vitrinas
    tramo(870, 1150, 440, 560)
    caja(0, -0.02, gz(170), fx1 - fx0 + 0.4, 0.2, gz(90) - gz(170), '#553c9a', rough=0.5)   # letrero
    caja(0, -0.14, gz(178), fx1 - fx0 + 0.4, 0.06, 0.08, '#38b2ac')
    caja(0, 0.8, gz(120), fx1 - fx0 + 0.3, 1.7, 0.15, '#4a3a7a')                          # cornisa
    # Marcos de las vitrinas
    for (x0p, x1p) in ((130, 410), (870, 1150)):
        xc = gx((x0p + x1p) / 2)
        caja(xc, 0.0, gz(440) - 0.05, gx(x1p) - gx(x0p) + 0.1, 0.12, 0.06, '#7f8c97')
        caja(xc, 0.0, gz(240), gx(x1p) - gx(x0p) + 0.1, 0.12, 0.06, '#7f8c97')
        caja(xc, 0.0, gz(440), 0.05, 0.1, gz(240) - gz(440), '#7f8c97')
    # Puertas de vidrio
    caja(gx(555), 0.15, 0, gx(630) - gx(480), 0.05, gz(240), '#bfe3f5', rough=0.15)
    caja(gx(725), 0.15, 0, gx(800) - gx(650), 0.05, gz(240), '#bfe3f5', rough=0.15)
    for xp in (470, 640, 810):
        caja(gx(xp), 0.1, 0, 0.07, 0.12, gz(240), '#7f8c97')
    caja(gx(640), 0.1, gz(240) - 0.06, gx(810) - gx(470), 0.12, 0.08, '#7f8c97')
    # Toldos sobre las vitrinas (rayas violeta y blanco)
    for (x0p, x1p) in ((130, 410), (870, 1150)):
        n = 8
        paso = (gx(x1p) - gx(x0p)) / n
        for k in range(n):
            o = caja(gx(x0p) + paso * (k + 0.5), -0.35, gz(235), paso, 0.7, 0.06, '#553c9a' if k % 2 == 0 else '#f7fafc')
            o.rotation_euler = (math.radians(-25), 0, 0)
    # Árboles en maceteros y maceteros con flores junto a la puerta
    for tx in (gx(60), gx(1220)):
        cil(tx, -1.6, 0, 0.32, 0.45, '#a0aec0')
        cil(tx, -1.6, 0.45, 0.06, 0.9, '#7a5230')
        for k in range(5):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.38,
                                                 location=(tx + random.uniform(-0.25, 0.25), -1.6 + random.uniform(-0.2, 0.2), 1.45 + random.uniform(0, 0.45)))
            bpy.context.object.data.materials.append(mat(random.choice(('#38a169', '#48bb78', '#2f855a')), 0.8))
    for fx_ in (gx(440), gx(840)):
        caja(fx_, -0.5, 0, 0.5, 0.4, 0.35, '#553c9a')
        for k in range(4):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.1,
                                                 location=(fx_ - 0.15 + k * 0.1, -0.5, 0.42))
            bpy.context.object.data.materials.append(mat(random.choice(('#f687b3', '#f6e05e', '#fc8181')), 0.7))
    camara()
    guardar('fachada')


OUT.mkdir(parents=True, exist_ok=True)
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ESCENAS = {'bodega': bodega, 'sala': sala, 'gondola3': gondola3, 'tienda': tienda, 'habitacion': habitacion, 'fachada': fachada}
archivo = RAIZ / 'src' / 'data' / 'escenarios.json'
datos = json.loads(archivo.read_text()) if archivo.exists() else {}
datos['_info'] = 'Generado por tools/gen_escenarios.py (npm run escenarios). Coordenadas del juego (1280x720).'
for nombre, f in ESCENAS.items():
    if args and nombre not in args:
        continue
    r = f()
    if r:
        datos[nombre] = r
if not muestra():
    archivo.write_text(json.dumps(datos, ensure_ascii=False, indent=1))
print('escenarios listos', datos)
