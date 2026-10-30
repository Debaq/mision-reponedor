"""Fondos 3D de la bodega y de la estantería (sala de ventas), renderizados con Blender.

Uso:  npm run escenarios   (equivale a: blender -b -P tools/gen_escenarios.py)

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
from bl_util import caja, cil, escena, mat, piso_ajedrez, proyectar  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
OUT = RAIZ / 'public' / 'assets' / 'escenarios'
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
    bpy.ops.render.render(write_still=True)


def luces_techo(y0, y1, z=3.6):
    for y in range(int(y0), int(y1), 2):
        for x in (-2.0, 2.0):
            caja(x, y, z, 1.6, 0.25, 0.05, '#f7fafc', rough=0.3)
        bpy.ops.object.light_add(type='AREA', location=(0, y, z - 0.1))
        luz = bpy.context.object
        luz.data.energy = 60
        luz.data.size = 3


# ---------------------------------------------------------------- bodega
def bodega():
    escena(W, H, fondo='#a9b7c6', sol_rot=(55, 10, 20), sol=1.9, ambiente=0.65)
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
    return {'x': round((izq[0] + der[0]) / 2), 'y': round(izq[1]), 'ancho': round(der[0] - izq[0])}


# ---------------------------------------------------------------- sala
def sala():
    escena(W, H, fondo='#dfe8ee', sol_rot=(50, 0, 15), sol=1.5, ambiente=0.55)
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
    escena(W, H, fondo='#dfe8ee', sol_rot=(50, 0, 15), sol=1.5, ambiente=0.55)
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


OUT.mkdir(parents=True, exist_ok=True)
datos = {'_info': 'Generado por tools/gen_escenarios.py (npm run escenarios). Coordenadas del juego (1280x720).'}
datos['bodega'] = bodega()
datos['sala'] = sala()
gondola3()
(RAIZ / 'src' / 'data' / 'escenarios.json').write_text(json.dumps(datos, ensure_ascii=False, indent=1))
print('escenarios listos', datos)
