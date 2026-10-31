import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoRender } from '../lib/fondos.js';
import { boton, Indicador, letreroPasillo, marca, panel, sacudir } from '../lib/ui.js';
import { gondola } from '../lib/gondola.js';
import { crearPersonaje, enPiso, ESCALA, PISO_FRONTAL_Y } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { partirReloj, siguiente } from '../lib/flujo.js';

const PRODUCTOS = ['bebida', 'jugo', 'agua'];
const OTROS = ['leche', 'aceite', 'detergente'];
const PANEL = { x: 80, y: 120 };

// Tarea adicional: revisar qué falta en la sala y verificar si hay existencias en la bodega.
// Parte 1 (sala): tocar las secciones con huecos. Parte 2 (bodega): tocar la caja de cada faltante;
// si está vacía, avisar al supervisor.
export default class Faltantes extends Phaser.Scene {
  constructor() {
    super('Faltantes');
  }

  create() {
    // Dos de los tres productos faltan; uno de ellos no tiene existencias en la bodega.
    this.faltan = Phaser.Utils.Array.Shuffle([...PRODUCTOS]).slice(0, 2);
    this.sinStock = Phaser.Utils.Array.GetRandom(this.faltan);
    this.marcados = [];
    this.revisados = new Set();
    this.avisado = false;
    this.sala();
  }

  sala() {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_gondola3', 'SUPERMERCADO EL BARRIO');
    letreroPasillo(this, 'bebidas');
    crearPersonaje(this, 1200, enPiso(PISO_FRONTAL_Y), estado.avatar, ESCALA);
    this.ind = new Indicador(this);
    this.crearPanel();

    const secciones = gondola(this, PRODUCTOS.map((p) => ({ p, faltan: this.faltan.includes(p) ? Phaser.Math.Between(2, 3) : 0 })));
    for (const sec of secciones) {
      const z = this.add.zone(sec.x, (sec.arriba + sec.abajo) / 2, sec.x1 - sec.x0, sec.abajo - sec.arriba).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.tocarSeccion(sec));
    }
    this.instrucciones();
  }

  async instrucciones() {
    const ok = await voz.secuencia(['faltan_jefe', 'faltan_instr']);
    await partirReloj(this, ok);
  }

  // Lista de faltantes (arriba a la izquierda): se llena al marcar; luego muestra ✓ (hay) o ✗ (no hay).
  crearPanel() {
    panel(this, PANEL.x + 10, PANEL.y + 110, 150, 220, COLOR.papel, 16).setDepth(20);
    this.add.text(PANEL.x + 10, PANEL.y + 22, 'FALTA', estiloTexto(22, '#c53030')).setOrigin(0.5).setDepth(21);
    this.filas = this.marcados.map((p, i) => this.filaPanel(p, i));
  }

  filaPanel(p, i) {
    const y = PANEL.y + 80 + i * 90;
    const img = this.add.image(PANEL.x - 10, y, 'prod_' + p).setDisplaySize(64, 64).setDepth(21);
    const estadoIcono = this.add.image(PANEL.x + 52, y, 'ui_checkmark').setDisplaySize(34, 34).setDepth(21).setVisible(false);
    return { p, img, estadoIcono, y };
  }

  tocarSeccion(sec) {
    if (this.marcados.includes(sec.p)) return;
    sfx(this, 'click', 0.3);
    if (!this.faltan.includes(sec.p)) {
      sfx(this, 'error');
      sumarError();
      voz.decir('faltan_lleno');
      return;
    }
    // Marcar los huecos y anotar el producto en la lista.
    sfx(this, 'bien');
    for (const h of sec.huecos) {
      const c = this.add.circle(h.x, h.y, 30).setStrokeStyle(5, COLOR.rojo);
      this.tweens.add({ targets: c, scale: { from: 1.4, to: 1 }, duration: 250 });
    }
    this.marcados.push(sec.p);
    const fila = this.filaPanel(sec.p, this.marcados.length - 1);
    this.filas.push(fila);
    const vuela = this.add.image(sec.x, sec.huecos[0].y, 'prod_' + sec.p).setDisplaySize(64, 64).setDepth(30);
    this.tweens.add({ targets: vuela, x: fila.img.x, y: fila.img.y, duration: 450, ease: 'Quad.easeIn', onComplete: () => vuela.destroy() });
    voz.decir('prod_' + sec.p);
    if (this.marcados.length === this.faltan.length) this.time.delayedCall(900, () => this.irBodega());
  }

  async irBodega() {
    if (!(await voz.decir('faltan_listo'))) return;
    this.cameras.main.fadeOut(300, 31, 45, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.children.removeAll(true);
      this.bodega();
    });
  }

  bodega() {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_bodega', 'BODEGA', 0x3d4852);
    crearPersonaje(this, 1185, enPiso(PISO_FRONTAL_Y), estado.avatar, ESCALA);
    this.ind = new Indicador(this);
    this.crearPanel();

    // Las cajas tocables son las de la fila del medio del rack renderizado.
    const cajas = Phaser.Utils.Array.Shuffle([...this.faltan, ...Phaser.Utils.Array.Shuffle([...OTROS]).slice(0, 2)]);
    cajas.forEach((p, i) => this.crearCaja(p, 370 + i * 200, 290));
    voz.decir('faltan_bodega');
  }

  crearCaja(p, x, y) {
    const vacia = p === this.sinStock;
    const c = this.add.container(x, y);
    // La caja está en el render: arriba se ve si tiene productos (o el fondo oscuro si está vacía)
    // y al frente va la etiqueta con el dibujo.
    const g = this.add.graphics();
    if (vacia) g.fillStyle(0x4a3520, 1).fillRect(-38, -52, 76, 14);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-36, -18, 72, 54, 8);
    g.lineStyle(2, 0xb8c4cf, 1).strokeRoundedRect(-36, -18, 72, 54, 8);
    c.add(g);
    if (!vacia) [-24, 0, 24].forEach((dx) => c.add(this.add.image(dx, -58, 'prod_' + p).setDisplaySize(42, 42)));
    c.add(this.add.image(0, 9, 'prod_' + p).setDisplaySize(46, 46).setAlpha(vacia ? 0.5 : 1));
    c.setSize(160, 130).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.tocarCaja(p, c, vacia));
  }

  tocarCaja(p, caja, vacia) {
    if (this.revisados.has(p)) return;
    this.tweens.add({ targets: caja, scale: 0.94, duration: 70, yoyo: true });
    if (!this.faltan.includes(p)) {
      sfx(this, 'error');
      sumarError();
      sacudir(this, caja);
      voz.decir('faltan_no_lista');
      return;
    }
    this.revisados.add(p);
    const fila = this.filas.find((f) => f.p === p);
    fila.estadoIcono.setVisible(true).setTexture(vacia ? 'ui_cross' : 'ui_checkmark').setTint(vacia ? COLOR.rojo : COLOR.verde);
    if (!vacia) {
      sfx(this, 'bien');
      marca(this, caja.x, caja.y - 110, true);
      voz.decir('faltan_hay').then((ok) => ok && this.revisarFin());
      return;
    }
    sfx(this, 'error');
    voz.decir('faltan_nohay');
    this.avisar = boton(this, 640, 520, {
      icono: 'ui_warning', texto: 'Avisar al jefe', ancho: 340, alto: 84, tam: 26, color: COLOR.marca,
      onClick: () => this.avisarJefe(),
    }).latir();
  }

  async avisarJefe() {
    this.avisar.setActivo(false);
    this.avisado = true;
    sfx(this, 'bien');
    if (!(await voz.decir('faltan_aviso'))) return;
    this.avisar.destroy();
    this.revisarFin();
  }

  async revisarFin() {
    if (this.terminado || this.revisados.size < this.faltan.length || !this.avisado) return;
    this.terminado = true;
    sfx(this, 'logro');
    if (!(await voz.decir('faltan_fin'))) return;
    siguiente(this);
  }
}
