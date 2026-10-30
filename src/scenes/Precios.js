import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoSala } from '../lib/fondos.js';
import { Indicador, letreroPasillo, marca, sacudir } from '../lib/ui.js';
import { etiquetaPrecio, gondola } from '../lib/gondola.js';
import { crearPersonaje } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { partirReloj, siguiente } from '../lib/flujo.js';

// Pasillo de limpieza: precio anterior → precio nuevo.
const PRECIOS = [
  { p: 'detergente', antes: '$3.990', ahora: '$3.490' },
  { p: 'cloro', antes: '$1.290', ahora: '$990' },
  { p: 'lavaloza', antes: '$1.590', ahora: '$1.390' },
];
const OFERTA = 'cloro';
const BANDEJA_Y = 556;

// Tarea adicional: cambiar las etiquetas de precio y colgar el cartel de oferta.
export default class Precios extends Phaser.Scene {
  constructor() {
    super('Precios');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoSala(this);
    letreroPasillo(this, 'limpieza');
    crearPersonaje(this, 1195, 460, estado.avatar, 0.27);
    this.ind = new Indicador(this);

    this.secciones = gondola(this, PRECIOS.map((x) => ({ p: x.p })));
    this.viejas = {};
    for (const sec of this.secciones) {
      const pr = PRECIOS.find((x) => x.p === sec.p);
      this.viejas[sec.p] = etiquetaPrecio(this, sec.etiqueta.x, sec.etiqueta.y, sec.p, pr.antes, false);
    }

    // Bandeja con las etiquetas nuevas, en otro orden.
    this.add.graphics().fillStyle(0x8b5e3c, 1).fillRoundedRect(300, BANDEJA_Y - 40, 520, 80, 12);
    this.quedan = PRECIOS.length;
    Phaser.Utils.Array.Shuffle([...PRECIOS]).forEach((pr, i) => {
      const e = etiquetaPrecio(this, 400 + i * 160, BANDEJA_Y, pr.p, pr.ahora, true);
      e.p = pr.p;
      this.arrastrable(e, (sec) => this.soltarEtiqueta(e, sec));
    });
    this.input.on('drag', (p, obj, x, y) => obj.setPosition(x, y));

    this.instrucciones();
  }

  async instrucciones() {
    const ok = await voz.secuencia(['precios_jefe', 'precios_instr']);
    await partirReloj(this, ok);
  }

  arrastrable(obj, alSoltar) {
    obj.setInteractive({ useHandCursor: true, draggable: true });
    obj.origen = { x: obj.x, y: obj.y };
    obj.on('dragstart', () => {
      obj.setDepth(100).setScale(1.1);
      this.ind.ocultar();
      sfx(this, 'tomar', 0.4);
    });
    obj.on('dragend', (pointer) => {
      obj.setScale(1);
      const sec = this.secciones.find((s) => pointer.x >= s.x0 && pointer.x <= s.x1 && pointer.y >= s.arriba - 40 && pointer.y <= s.etiqueta.y + 50);
      if (!sec) {
        this.tweens.add({ targets: obj, x: obj.origen.x, y: obj.origen.y, duration: 250 });
        obj.setDepth(0);
        return;
      }
      alSoltar(sec);
    });
  }

  volver(obj) {
    this.tweens.add({ targets: obj, x: obj.origen.x, y: obj.origen.y, duration: 300 });
    obj.setDepth(0);
    sacudir(this, obj);
  }

  async soltarEtiqueta(e, sec) {
    if (sec.p !== e.p) {
      sfx(this, 'error');
      sumarError();
      voz.decir('precios_mal');
      this.volver(e);
      return;
    }
    e.disableInteractive();
    sfx(this, 'soltar');
    const vieja = this.viejas[sec.p];
    this.tweens.add({ targets: vieja, y: vieja.y + 40, alpha: 0, duration: 250, onComplete: () => vieja.destroy() });
    this.tweens.add({ targets: e, x: sec.etiqueta.x, y: sec.etiqueta.y, duration: 200 });
    e.setDepth(1);
    this.quedan--;
    if (this.quedan > 0) return;
    sfx(this, 'bien');
    await new Promise((r) => this.time.delayedCall(500, r));
    this.oferta();
  }

  // Cartel rojo de OFERTA con el dibujo del producto: se cuelga arriba de su sección.
  oferta() {
    const c = this.add.container(560, BANDEJA_Y - 10);
    const g = this.add.graphics();
    g.fillStyle(COLOR.rojo, 1).fillRoundedRect(-90, -50, 180, 100, 12);
    g.lineStyle(4, 0xffffff, 1).strokeRoundedRect(-84, -44, 168, 88, 10);
    c.add([g, this.add.text(0, -22, 'OFERTA', estiloTexto(28, '#ffffff')).setOrigin(0.5),
      this.add.image(0, 20, 'prod_' + OFERTA).setDisplaySize(44, 44)]);
    c.setSize(180, 100);
    this.tweens.add({ targets: c, scale: { from: 0, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    this.arrastrable(c, (sec) => this.soltarOferta(c, sec));
    voz.decir('precios_oferta').then((ok) => ok && this.ind.apuntar(c.x, c.y, 80));
  }

  async soltarOferta(c, sec) {
    if (sec.p !== OFERTA) {
      sfx(this, 'error');
      sumarError();
      voz.decir('oferta_mal');
      this.volver(c);
      return;
    }
    c.disableInteractive();
    this.tweens.add({ targets: c, x: sec.x, y: sec.arriba + 4, scale: 0.8, duration: 250 });
    marca(this, sec.x, sec.arriba + 90, true);
    sfx(this, 'logro');
    if (!(await voz.decir('precios_fin'))) return;
    siguiente(this);
  }
}
