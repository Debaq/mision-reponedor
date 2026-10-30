import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoBodega, carro } from '../lib/fondos.js';
import { Indicador, marca, sacudir } from '../lib/ui.js';
import { ListaPanel } from '../lib/listaPanel.js';
import { crearPersonaje } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import niveles from '../data/niveles.json';
import productos from '../data/productos.json';

const COLS = [370, 570, 770, 970];
const FILAS = [150, 290, 430];
const CARRO = { x: 700, y: 560, ancho: 640 };

// Etapas 5 y 6 (parte 1): buscar en la bodega, seleccionar y verificar cantidades.
export default class Bodega extends Phaser.Scene {
  constructor() {
    super('Bodega');
  }

  init(datos) {
    this.nivel = datos.nivel || 'tutorial';
    this.guiado = !!datos.guiado;
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoBodega(this);
    const lista = niveles[this.nivel].lista;
    this.panelLista = new ListaPanel(this, lista);
    this.ind = new Indicador(this);
    this.enCarro = [];
    this.terminado = false;

    this.dibujarRack();
    const ids = Phaser.Utils.Array.Shuffle(Object.keys(productos));
    this.cajas = {};
    ids.forEach((p, i) => this.crearCaja(p, COLS[i % 4], FILAS[Math.floor(i / 4)]));

    this.carro = carro(this, CARRO.x, CARRO.y, CARRO.ancho);
    crearPersonaje(this, 1170, 470, estado.avatar, 0.27);
    const zonaCarro = this.add.zone(CARRO.x, CARRO.y - 20, CARRO.ancho, 70).setInteractive({ useHandCursor: true });
    zonaCarro.on('pointerup', () => this.tocarCarro());

    if (this.guiado) this.tutorial();
    else voz.decir('bodega_intro');
  }

  dibujarRack() {
    const g = this.add.graphics();
    for (const y of FILAS) {
      g.fillStyle(0xdd6b20, 1).fillRect(260, y + 52, 820, 14);
    }
    g.fillStyle(0x2c5282, 1);
    for (const x of [255, 470, 670, 870, 1072]) g.fillRect(x - 6, 76, 14, 430);
  }

  crearCaja(p, x, y) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(COLOR.cartonOscuro, 1).fillRect(-80, -50, 160, 102);
    g.fillStyle(COLOR.carton, 1).fillRect(-76, -46, 152, 94);
    g.fillStyle(0xe0b880, 1).fillRect(-76, -46, 152, 14);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-42, -26, 84, 66, 8);
    c.add([g, this.add.image(0, 7, 'prod_' + p).setDisplaySize(64, 64)]);
    c.setSize(160, 102).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.tocarCaja(p, c));
    this.cajas[p] = c;
  }

  tocarCaja(p, caja) {
    if (this.terminado) return;
    this.tweens.add({ targets: caja, scale: 0.94, duration: 70, yoyo: true });
    if (!this.panelLista.tiene(p)) {
      sfx(this, 'error');
      sacudir(this, caja);
      sumarError();
      voz.decir('fb_no_lista');
      return;
    }
    // Sacar una unidad y llevarla al carro.
    sfx(this, 'tomar');
    const i = this.enCarro.length;
    const destino = this.posCarro(i);
    const u = this.add.image(caja.x, caja.y, 'prod_' + p).setDisplaySize(56, 56).setDepth(30);
    u.p = p;
    this.enCarro.push(u);
    this.tweens.add({ targets: u, x: destino.x, y: destino.y, duration: 380, ease: 'Quad.easeOut' });
    u.setInteractive({ useHandCursor: true }).on('pointerup', () => this.devolver(u));
    this.panelLista.sumar(p);

    const cant = this.panelLista.cant[p];
    const n = this.panelLista.filas[p].n;
    if (cant > n) {
      sfx(this, 'error');
      sumarError();
      voz.decir('fb_demasiados');
    } else {
      voz.decir('num_' + cant);
      if (cant === n) this.time.delayedCall(250, () => sfx(this, 'bien'));
    }
    this.revisar(p);
  }

  posCarro(i) {
    const porFila = 11;
    const fila = Math.floor(i / porFila);
    return { x: CARRO.x - CARRO.ancho / 2 + 40 + (i % porFila) * 54, y: CARRO.y - 42 - fila * 46 };
  }

  devolver(u) {
    if (this.terminado) return;
    const caja = this.cajas[u.p];
    this.enCarro = this.enCarro.filter((x) => x !== u);
    this.panelLista.sumar(u.p, -1);
    sfx(this, 'soltar');
    voz.decir('fb_devuelto');
    u.disableInteractive();
    this.tweens.add({ targets: u, x: caja.x, y: caja.y, alpha: 0, duration: 350, onComplete: () => u.destroy() });
    // reacomodar
    this.enCarro.forEach((x, i) => {
      const d = this.posCarro(i);
      this.tweens.add({ targets: x, x: d.x, y: d.y, duration: 200 });
    });
    this.revisar(u.p);
  }

  revisar(p) {
    // Sacó de más: apuntar a una unidad sobrante para devolverla.
    if (this.panelLista.cant[p] > this.panelLista.filas[p].n) {
      const extra = [...this.enCarro].reverse().find((u) => u.p === p);
      this.time.delayedCall(400, () => extra.active && this.ind.apuntar(extra.x, extra.y, 40));
      return;
    }
    if (this.panelLista.todoCompleto()) {
      this.ind.apuntar(CARRO.x, CARRO.y - 30, 90);
      this.time.delayedCall(700, () => {
        if (!this.panelLista.todoCompleto() || this.terminado) return;
        voz.secuencia(this.guiado ? ['tut_verifica', 'tut_paso4'] : ['bodega_listo']);
      });
      return;
    }
    if (this.guiado) {
      if (this.panelLista.completo(p)) {
        const sig = this.panelLista.lista.find((it) => !this.panelLista.completo(it.p));
        if (sig) {
          this.apuntarCaja(sig.p);
          this.time.delayedCall(700, () => voz.decir('tut_paso3_' + sig.p));
        }
      } else if (this.panelLista.cant[p] <= this.panelLista.filas[p].n) {
        this.apuntarCaja(p);
      }
    }
  }

  apuntarCaja(p) {
    const c = this.cajas[p];
    this.ind.apuntar(c.x, c.y, 80);
  }

  async tutorial() {
    const centro = this.panelLista.centro();
    if (!(await voz.decir('tut_intro'))) return;
    this.ind.apuntar(centro.x, centro.y, centro.r);
    if (!(await voz.decir('tut_paso1'))) return;
    this.ind.apuntar(670, 290, 220);
    if (!(await voz.decir('tut_paso2'))) return;
    const primero = this.panelLista.lista[0].p;
    this.apuntarCaja(primero);
    voz.decir('tut_paso3_' + primero);
  }

  tocarCarro() {
    if (this.terminado) return;
    if (!this.panelLista.todoCompleto()) {
      sfx(this, 'error');
      sumarError();
      voz.decir('fb_falta');
      return;
    }
    this.terminado = true;
    this.ind.ocultar();
    marca(this, CARRO.x, CARRO.y - 120, true);
    sfx(this, 'logro');
    this.time.delayedCall(700, () => siguiente(this));
  }
}
