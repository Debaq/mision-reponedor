import Phaser from 'phaser';
import { ALTO, ANCHO, ANCHO_MAX, COLOR, X_IZQ, estiloTexto } from '../lib/estilo.js';
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
// El jugador toca adónde ir. datos: { nivel, destino, guiado, desde, linea, volver }
// - destino: 'bodega', 'pasillo' (el del nivel, llevando el carro con la lista) o un pasillo (tareas).
// - desde: nodo de MAPA.caminos donde parte; si no, la entrada (a la bodega), la puerta de la bodega
//   (con el carro) o donde quedó la última vez (estado.lugar).
// - linea: voz que dice adónde ir. volver: escena dormida que se despierta al llegar (en vez de seguir
//   el flujo), para tareas que pasan por el mapa a la mitad.
// - acompanante: apariencia de alguien que camina detrás del jugador (ej. la clienta que se acompaña).
export default class Mapa extends Phaser.Scene {
  constructor() {
    super('Mapa');
  }

  init(datos) {
    this.nivel = niveles[datos.nivel || 'tutorial'];
    this.conCarro = datos.destino === 'pasillo';
    this.destino = this.conCarro ? this.nivel.pasillo : datos.destino || 'bodega';
    this.guiado = !!datos.guiado;
    this.volver = datos.volver;
    this.acompanante = datos.acompanante;
    const porDefecto = { bodega: 'entrada', pasillo: 'bodega_puerta' }[datos.destino];
    this.desde = datos.desde || (!datos.linea && porDefecto) || estado.lugar || 'entrada';
    // Voz de inicio y la que se repite al equivocarse.
    if (this.conCarro) [this.linea, this.ayuda] = ['mapa_pasillo', 'mapa_mal'];
    else if (this.destino === 'bodega' && !datos.linea) [this.linea, this.ayuda] = ['mapa_bodega', 'mapa_mal'];
    else this.linea = this.ayuda = datos.linea || 'mapa_ir_' + this.destino;
  }

  create() {
    this.cameras.main.fadeIn(300);
    this.listo = false;
    this.errores = 0;
    // Fondo y piezas a alto completo y centrados (el render es más ancho que 16:9).
    const k = ALTO / this.textures.get('mapa').getSourceImage().height;
    this.add.image(ANCHO / 2, 0, 'mapa').setOrigin(0.5, 0).setScale(k);
    // Muebles recortados del fondo (góndolas, cajas, muros...): van delante o detrás del personaje.
    this.piezas = Object.entries(MAPA.piezas).filter(([n]) => this.textures.get('mapa_piezas').has(n)).map(([n, planta]) => {
      const img = this.add.image(0, 0, 'mapa_piezas', n).setOrigin(0).setScale(k);
      img.x = ANCHO / 2 - (img.frame.realWidth * k) / 2;
      return { img, planta };
    });
    this.ind = new Indicador(this);
    this.zonas = {};
    this.crearZona('bodega', NOMBRE_BODEGA);
    for (const [id, p] of Object.entries(pasillos)) this.crearZona(id, p);
    this.crearLista();

    const inicio = MAPA.caminos.nodos[this.desde];
    this.yo = crearPersonaje(this, inicio[0], enPiso(inicio[1], ESCALA), estado.avatar, ESCALA).setDepth(6);
    // Quien acompaña sigue los pasos del jugador, un poco atrás (repite su recorrido con retraso).
    this.otro = null;
    if (this.acompanante) {
      this.otro = crearPersonaje(this, inicio[0] - 14, enPiso(inicio[1] + 4, ESCALA), this.acompanante, ESCALA).setDepth(6);
      this.huella = [];
    }
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
    if (!this.conCarro) return;
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
    if (!(await voz.decir(this.linea))) return;
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
      this.errores++;
      await voz.secuencia(['zona_' + id, this.ayuda]);
      // Sin guía, la flecha aparece al segundo error.
      if (this.guiado || this.errores >= 2) this.apuntar();
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
    await this.recorrer(ruta(this.desde, id));
    estado.lugar = id;
    await new Promise((r) => this.time.delayedCall(300, r));
    if (!this.volver) {
      siguiente(this);
      return;
    }
    this.cameras.main.fadeOut(300, 31, 45, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.wake(this.volver);
      this.scene.stop();
    });
  }

  // Cada pieza va delante del personaje si él está detrás de ella en el piso. La cámara mira desde
  // el frente a la derecha: está delante de una pieza si pisa a su derecha (x mayor) o adelante (y menor).
  update() {
    this.seguir();
    const [a, b, c, d, e, f] = MAPA.piso;
    const px = this.yo.x;
    const py = this.yo.y - enPiso(0, ESCALA);
    const x = a * px + b * py + c;
    const y = d * px + e * py + f;
    for (const { img, planta } of this.piezas) img.setDepth(x >= planta[2] || y <= planta[1] ? 5 : 7);
  }

  // Quien acompaña va por el mismo camino que el jugador, DISTANCIA px atrás (si él se detiene, ella se
  // detiene detrás, sin encimarse), mirando hacia donde camina y delante o detrás de él según el piso.
  seguir() {
    if (!this.otro) return;
    const h = this.huella;
    const ult = h[h.length - 1];
    if (!ult || Math.hypot(this.yo.x - ult.x, this.yo.y - ult.y) > 1) h.push({ x: this.yo.x, y: this.yo.y });
    if (h.length > 300) h.splice(0, h.length - 300);
    let falta = DISTANCIA;
    for (let i = h.length - 1; i > 0; i--) {
      const [a, b] = [h[i], h[i - 1]];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d >= falta) {
        const x = a.x + ((b.x - a.x) * falta) / d;
        const y = a.y + ((b.y - a.y) * falta) / d;
        const [dx, dy] = [x - this.otro.x, y - this.otro.y];
        if (Math.abs(dx) + Math.abs(dy) > 0.3) mirarHacia(this.otro, dx, dy);
        this.otro.setPosition(x, y).setDepth(y > this.yo.y ? 6.1 : 5.9);
        return;
      }
      falta -= d;
    }
  }

  // La cámara se acerca y sigue al personaje mientras camina (la lista ya no hace falta).
  acercar() {
    const cam = this.cameras.main;
    // Límites: todo lo que se ve (el render ancho, o más si la pantalla es aún más ancha o más alta).
    cam.setBounds(Math.min(X_IZQ, cam.scrollX), Math.min(0, cam.scrollY), Math.max(ANCHO_MAX, cam.width), Math.max(ALTO, cam.height));
    cam.startFollow(this.yo, false, 0.08, 0.08);
    cam.zoomTo(ZOOM, 900, 'Sine.easeInOut');
    this.tweens.add({ targets: this.lista, alpha: 0, duration: 300 });
  }

  // Camina de punto en punto a velocidad pareja, mirando hacia donde va.
  recorrer(puntos) {
    caminar(this.yo, true);
    if (this.otro) caminar(this.otro, true);
    return new Promise((fin) => {
      const paso = (i) => {
        if (i >= puntos.length) {
          caminar(this.yo, false);
          if (this.otro) caminar(this.otro, false);
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
// A cuántos px (por el camino) va quien acompaña detrás del jugador.
const DISTANCIA = 34;

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
