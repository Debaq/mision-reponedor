import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { Indicador, marca, panel, producto, sacudir } from '../lib/ui.js';
import { caminar, crearPersonaje } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
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
    this.add.image(0, 0, 'mapa').setOrigin(0).setDisplaySize(ANCHO, 720);
    this.ind = new Indicador(this);
    this.zonas = {};
    this.crearZona('bodega', NOMBRE_BODEGA);
    for (const [id, p] of Object.entries(pasillos)) this.crearZona(id, p);
    this.crearLista();

    // El personaje parte en la entrada (va a la bodega) o en la puerta de la bodega (lleva el carro).
    const inicio = this.destino === 'bodega' ? MAPA.entrada.centro : MAPA.bodega.puerta;
    this.yo = crearPersonaje(this, inicio[0], inicio[1] - 30, estado.avatar, 0.11).setDepth(6);
    this.intro();
  }

  // Zona tocable (polígono calculado en Blender), con brillo al pasar y letrero con número y nombre.
  crearZona(id, p) {
    const z = MAPA[id];
    const poli = new Phaser.Geom.Polygon(z.poligono.flat());
    const brillo = this.add.graphics().setDepth(5);
    const dibujar = (activo) => {
      brillo.clear();
      if (!activo) return;
      brillo.fillStyle(0xffffff, 0.22).fillPoints(poli.points, true);
      brillo.lineStyle(5, COLOR.amarillo, 1).strokePoints(poli.points, true);
    };
    const toque = this.add.zone(0, 0, ANCHO, 720).setOrigin(0).setInteractive(poli, Phaser.Geom.Polygon.Contains);
    toque.input.cursor = 'pointer';
    toque.on('pointerover', () => dibujar(true));
    toque.on('pointerout', () => dibujar(false));
    toque.on('pointerup', () => this.tocar(id, z));

    // Letrero: píldora con número y nombre, sobre el letrero 3D.
    const [lx, ly] = z.letrero;
    const c = this.add.container(lx, ly).setDepth(8);
    const ancho = 34 + p.nombre.length * 12 + (p.n ? 34 : 0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-ancho / 2 + 2, -19 + 4, ancho, 38, 19);
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
  crearLista() {
    if (this.destino === 'bodega') return;
    const lista = this.nivel.lista;
    const alto = 60 + lista.length * 80;
    panel(this, 1205, 200 + alto / 2, 130, alto, COLOR.papel, 16).setDepth(20);
    this.add.image(1205, 228, 'ui_shoppingCart').setDisplaySize(40, 40).setTint(COLOR.marca).setDepth(21);
    lista.forEach((it, i) => producto(this, 1205, 290 + i * 80, it.p, 66).setDepth(21));
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
    // Caminar hasta el lugar elegido por los pasillos (no en línea recta sobre las góndolas).
    await this.recorrer(ruta(this.destino === 'bodega' ? 'entrada' : 'bodega_puerta', id));
    await new Promise((r) => this.time.delayedCall(300, r));
    siguiente(this);
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
        const [x, y] = puntos[i];
        const dx = x - this.yo.x;
        if (Math.abs(dx) > 2) this.yo.cuerpo.scaleX = Math.sign(dx);
        const largo = Math.hypot(dx, y - PIE - this.yo.y);
        this.tweens.add({ targets: this.yo, x, y: y - PIE, duration: Math.max(80, largo / VELOCIDAD * 1000), onComplete: () => paso(i + 1) });
      };
      paso(0);
    });
  }
}

// Distancia de los pies al centro del personaje en el mapa, y velocidad al caminar (px/s).
const PIE = 30;
const VELOCIDAD = 230;

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
