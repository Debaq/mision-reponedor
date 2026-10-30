import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoSala } from '../lib/fondos.js';
import { marca } from '../lib/ui.js';
import { crearPersonaje, CLIENTA } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import { elegirRespuesta } from './Supervisor.js';

const CARTELES = [
  { n: 1, nombre: 'LÁCTEOS', prods: ['leche', 'queso'], color: 0x3182ce },
  { n: 2, nombre: 'ABARROTES', prods: ['aceite', 'atun', 'tomate'], color: 0xdd6b20 },
  { n: 3, nombre: 'BEBIDAS', prods: ['bebida', 'jugo'], color: 0x38a169 },
];

// Tarea adicional: orientar a una clienta sobre la ubicación de un producto.
export default class Cliente extends Phaser.Scene {
  constructor() {
    super('Cliente');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoSala(this, { pisoY: 470 });
    this.carteles = CARTELES.map((c, i) => this.crearCartel(c, 330 + i * 310, 115));
    this.clienta = crearPersonaje(this, 150, 420, CLIENTA, 0.45);
    this.yo = crearPersonaje(this, 1130, 420, estado.avatar, 0.45);
    this.alHablar = (id, texto, quien) => {
      const p = quien === 'cliente' ? this.clienta : quien === 'jugador' ? this.yo : null;
      if (p) this.tweens.add({ targets: p, y: p.y - 10, duration: 160, yoyo: true, repeat: 2 });
    };
    voz.on('linea', this.alHablar);
    this.events.once('shutdown', () => voz.off('linea', this.alHablar));
    this.conversar();
  }

  crearCartel(c, x, y) {
    const cont = this.add.container(x, y);
    const g = this.add.graphics();
    g.lineStyle(4, 0x5f6b78, 1).lineBetween(-80, -70, -80, -40).lineBetween(80, -70, 80, -40);
    g.fillStyle(c.color, 1).fillRoundedRect(-130, -40, 260, 110, 14);
    g.fillStyle(0xffffff, 1).fillCircle(-92, -2, 26);
    cont.add([g,
      this.add.text(-92, -2, String(c.n), estiloTexto(34, '#1f2d3a')).setOrigin(0.5),
      this.add.text(18, -14, c.nombre, estiloTexto(22, '#ffffff')).setOrigin(0.5)]);
    c.prods.forEach((p, i) => cont.add(this.add.image(-40 + i * 48, 38, 'prod_' + p).setDisplaySize(44, 44)));
    cont.setSize(260, 110).setInteractive({ useHandCursor: true });
    cont.on('pointerup', () => {
      sfx(this, 'click', 0.3);
      voz.decir('cartel_' + c.n);
    });
    return cont;
  }

  async conversar() {
    if (!(await voz.secuencia(['cliente_pregunta', 'cliente_instr']))) return;
    for (;;) {
      const r = await elegirRespuesta(this, [
        { id: 'rc_bien', ok: true },
        { id: 'rc_nose', ok: false },
        { id: 'rc_p3', ok: false },
      ], { y0: 235, ancho: 500 });
      if (!(await voz.decir(r.id))) return;
      marca(this, 640, 380, r.ok);
      sfx(this, r.ok ? 'bien' : 'error');
      if (r.ok) break;
      sumarError('cliente');
      const linea = r.id === 'rc_nose' ? ['cliente_mal_nose', 'guia_cliente_nose'] : ['guia_cliente_p3'];
      if (!(await voz.secuencia(linea))) return;
    }
    // Acompañar a la clienta al pasillo 2
    const c2 = this.carteles[1];
    this.tweens.add({ targets: c2, scale: 1.1, duration: 300, yoyo: true, repeat: 2 });
    this.tweens.add({ targets: this.clienta, x: c2.x - 80, duration: 1800, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.yo, x: c2.x + 90, duration: 1800, ease: 'Sine.easeInOut' });
    await new Promise((r) => this.time.delayedCall(1200, r));
    sfx(this, 'logro');
    if (!(await voz.decir('cliente_gracias'))) return;
    siguiente(this);
  }
}
