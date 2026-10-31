import Phaser from 'phaser';
import { ALTO, ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { Indicador, marca, panel, producto, sacudir } from '../lib/ui.js';
import { caminar, crearPersonaje, enPiso, mirarHacia } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import { sombraRect } from '../lib/sombras.js';
import niveles from '../data/niveles.json';
import pasillos from '../data/pasillos.json';
import MAPA from '../data/mapa.json';

const color = (hex) => parseInt(hex.slice(1), 16);
const NOMBRE_BODEGA = { n: null, nombre: 'Bodega', color: '#3d4852' };

// Mapa del supermercado (render isométrico hecho en Blender: tools/gen_mapa.py).
// El jugador toca adónde ir. datos: { nivel, destino: 'bodega' | 'pasillo', guiado }
export default class Mapa extends Phaser.Scene {
  constructor() {
    super('Mapa');
  }

  init(datos) {
    this.nivel = niveles[datos.nivel || 'tutorial'];
    this.destino = datos.destino === 'pasillo' ? this.nivel.pasillo : 'bodega';
    this.guiado = !!datos.guiado;
  }

  create() {
    this.cameras.main.fadeIn(300);
    this.listo = false;
    this.add.image(0, 0, 'mapa').setOrigin(0).setDisplaySize(ANCHO, ALTO);
    // Muebles recortados del fondo (góndolas, cajas, muros...): van delante o detrás del personaje.
    this.piezas = Object.entries(MAPA.piezas).filter(([n]) => this.textures.get('mapa_piezas').has(n)).map(([n, planta]) => {
      const img = this.add.image(0, 0, 'mapa_piezas', n).setOrigin(0);
      return { img: img.setScale(ANCHO / img.frame.realWidth), planta };
    });
    this.ind = new Indicador(this);
    this.zonas = {};
    this.crearZona('bodega', NOMBRE_BODEGA);
    for (const [id, p] of Object.entries(pasillos)) this.crearZona(id, p);
    this.crearLista();

    // El personaje parte en la entrada (va a la bodega) o en la puerta de la bodega (lleva el carro).
    const inicio = this.destino === 'bodega' ? MAPA.entrada.centro : MAPA.bodega.puerta;
    this.yo = crearPersonaje(this, inicio[0], enPiso(inicio[1], ESCALA), estado.avatar, ESCALA).setDepth(6);
    this.intro();
  }

  // Zona tocable (polígono calculado en Blender), con brillo al pasar y letrero con número y nombre.
  crearZona(id, p) {
    const z = MAPA[id];
    const poli = new Phaser.Geom.Polygon(z.poligono.flat());
    const brillo = this.add.graphics().setDepth(7.5);
    const dibujar = (activo) => {
      brillo.clear();
      if (!activo) return;
      brillo.fillStyle(0xffffff, 0.22).fillPoints(poli.points, true);
      brillo.lineStyle(5, COLOR.amarillo, 1).strokePoints(poli.points, true);
    };
    const toque = this.add.zone(0, 0, ANCHO, ALTO).setOrigin(0).setInteractive(poli, Phaser.Geom.Polygon.Contains);
    toque.input.cursor = 'pointer';
    toque.on('pointerover', () => dibujar(true));
    toque.on('pointerout', () => dibujar(false));
    toque.on('pointerup', () => this.tocar(id, z));

    // Letrero: píldora con número y nombre, sobre el letrero 3D.
    const [lx, ly] = z.letrero;
    const c = this.add.container(lx, ly).setDepth(8);
    const ancho = 34 + p.nombre.length * 12 + (p.n ? 34 : 0);
    const g = this.add.graphics();
    sombraRect(g, -ancho / 2 + 1, -19 + 5, ancho, 38, 19, 0.3, 8);
    g.fillStyle(color(p.color), 1).fillRoundedRect(-ancho / 2, -19, ancho, 38, 19);
    g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(-ancho / 2, -19, ancho, 38, 19);
    c.add(g);
    let x = -ancho / 2 + 17;
    if (p.n) {
      c.add([this.add.circle(x + 6, 0, 14, 0xffffff), this.add.text(x + 6, 0, String(p.n), estiloTexto(20)).setOrigin(0.5)]);
      x += 30;
    }
    c.add(this.add.text(x, 0, p.nombre.toUpperCase(), estiloTexto(19, '#ffffff')).setOrigin(0, 0.5));
    this.zonas[id] = z;
  }

  // Al llevar el carro: recordatorio de los productos de la lista, para buscar el pasillo con esos dibujos.
  // Abajo a la izquierda, en el rincón que deja libre el local.
  crearLista() {
    this.lista = [];
    if (this.destino === 'bodega') return;
    const lista = this.nivel.lista;
    const ancho = 76 + lista.length * 78;
    const x0 = 16;
    const y = 548;
    this.lista.push(
      panel(this, x0 + ancho / 2, y, ancho, 96, COLOR.papel, 16).setDepth(20),
      this.add.image(x0 + 38, y, 'ui_shoppingCart').setDisplaySize(40, 40).setTint(COLOR.marca).setDepth(21),
      ...lista.map((it, i) => producto(this, x0 + 106 + i * 78, y, it.p, 66).setDepth(21)),
    );
  }

  async intro() {
    const linea = this.destino === 'bodega' ? 'mapa_bodega' : 'mapa_pasillo';
    if (!(await voz.decir(linea))) return;
    if (this.guiado) this.apuntar();
  }

  apuntar() {
    const [x, y] = this.zonas[this.destino].centro;
    this.ind.apuntar(x, y, this.destino === 'bodega' ? 90 : 80);
  }

  async tocar(id, z) {
    if (this.listo) return;
    sfx(this, 'click', 0.3);
    if (id !== this.destino) {
      sfx(this, 'error');
      sumarError();
      sacudir(this, this.yo);
      await voz.secuencia(['zona_' + id, 'mapa_mal']);
      if (this.guiado) this.apuntar();
      return;
    }
    this.listo = true;
    this.ind.ocultar();
    const [mx, my] = z.centro;
    marca(this, mx, my - 70, true);
    sfx(this, 'bien');
    voz.decir('zona_' + id);
    this.acercar();
    // Caminar hasta el lugar elegido por los pasillos (no en línea recta sobre las góndolas).
    await this.recorrer(ruta(this.destino === 'bodega' ? 'entrada' : 'bodega_puerta', id));
    await new Promise((r) => this.time.delayedCall(300, r));
    siguiente(this);
  }

  // Cada pieza va delante del personaje si él está detrás de ella en el piso. La cámara mira desde
  // el frente a la derecha: está delante de una pieza si pisa a su derecha (x mayor) o adelante (y menor).
  update() {
    const [a, b, c, d, e, f] = MAPA.piso;
    const px = this.yo.x;
    const py = this.yo.y - enPiso(0, ESCALA);
    const x = a * px + b * py + c;
    const y = d * px + e * py + f;
    for (const { img, planta } of this.piezas) img.setDepth(x >= planta[2] || y <= planta[1] ? 5 : 7);
  }

  // La cámara se acerca y sigue al personaje mientras camina (la lista ya no hace falta).
  acercar() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, ANCHO, ALTO);
    cam.startFollow(this.yo, false, 0.08, 0.08);
    cam.zoomTo(ZOOM, 900, 'Sine.easeInOut');
    this.tweens.add({ targets: this.lista, alpha: 0, duration: 300 });
  }

  // Camina de punto en punto a velocidad pareja, mirando hacia donde va.
  recorrer(puntos) {
    caminar(this.yo, true);
    return new Promise((fin) => {
      const paso = (i) => {
        if (i >= puntos.length) {
          caminar(this.yo, false);
          fin();
          return;
        }
        const x = puntos[i][0];
        const y = enPiso(puntos[i][1], ESCALA);
        const dx = x - this.yo.x;
        const dy = y - this.yo.y;
        mirarHacia(this.yo, dx, dy);
        const largo = Math.hypot(dx, dy);
        this.tweens.add({ targets: this.yo, x, y, duration: Math.max(80, largo / VELOCIDAD * 1000), onComplete: () => paso(i + 1) });
      };
      paso(0);
    });
  }
}

// Tamaño del personaje en el mapa, velocidad al caminar (px/s) y acercamiento de la cámara al caminar.
const ESCALA = 0.125;
const VELOCIDAD = 180;
const ZOOM = 1.8;

// Camino más corto (Dijkstra) por la red de caminos del mapa, de un nodo a otro: lista de puntos.
function ruta(desde, hasta) {
  const { nodos, aristas } = MAPA.caminos;
  const vecinos = {};
  for (const [a, b] of aristas) {
    (vecinos[a] ||= []).push(b);
    (vecinos[b] ||= []).push(a);
  }
  const dist = { [desde]: 0 };
  const previo = {};
  const pendientes = new Set(Object.keys(nodos));
  while (pendientes.size) {
    let u = null;
    for (const n of pendientes) if (dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n;
    if (u === null || u === hasta) break;
    pendientes.delete(u);
    for (const v of vecinos[u] || []) {
      const d = dist[u] + Math.hypot(nodos[u][0] - nodos[v][0], nodos[u][1] - nodos[v][1]);
      if (dist[v] === undefined || d < dist[v]) {
        dist[v] = d;
        previo[v] = u;
      }
    }
  }
  const camino = [];
  for (let n = hasta; n; n = previo[n]) camino.unshift(nodos[n]);
  return camino.slice(1);
}
