import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoRender } from '../lib/fondos.js';
import { Indicador, marca, panel } from '../lib/ui.js';
import { canasto } from '../lib/objetos.js';
import { crearPersonaje, enPiso, ESCALA } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { partirReloj, siguiente } from '../lib/flujo.js';

// Hoy: 15 de noviembre. Fechas DDMM; vencida si es anterior a hoy.
const HOY = { d: 15, m: 11 };
const FECHAS = ['0511', '2011', '1011', '0212', '1411', '2811'];
const MESES = { 11: 'NOV', 12: 'DIC' };
const CANASTO = { x: 1060, y: 520 };

const vencida = (f) => {
  const d = +f.slice(0, 2);
  const m = +f.slice(2);
  return m < HOY.m || (m === HOY.m && d < HOY.d);
};

// Tarea adicional: revisar fechas de vencimiento y retirar los productos vencidos.
export default class Vencidos extends Phaser.Scene {
  constructor() {
    super('Vencidos');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_tienda', 'SUPERMERCADO EL BARRIO');
    crearPersonaje(this, 1190, enPiso(), estado.avatar, ESCALA);
    this.ind = new Indicador(this);

    // Calendario "HOY"
    panel(this, 150, 230, 210, 230, 0xffffff, 18);
    this.add.graphics().fillStyle(COLOR.rojo, 1).fillRoundedRect(45, 115, 210, 56, { tl: 18, tr: 18, bl: 0, br: 0 });
    this.add.text(150, 143, 'HOY', estiloTexto(32, '#ffffff')).setOrigin(0.5);
    this.add.text(150, 235, String(HOY.d), estiloTexto(90)).setOrigin(0.5);
    this.add.text(150, 310, MESES[HOY.m], estiloTexto(34, '#c53030')).setOrigin(0.5);

    // Estantería con leches
    const g = this.add.graphics();
    g.fillStyle(0xdfe6ec, 1).fillRect(300, 150, 660, 300);
    g.fillStyle(0x8795a1, 1).fillRect(286, 440, 688, 16);
    g.fillStyle(0x5f6b78, 1).fillRect(286, 150, 14, 306).fillRect(960, 150, 14, 306);

    canasto(this, CANASTO.x, CANASTO.y, 'VENCIDOS');
    this.quedan = FECHAS.filter(vencida).length;

    Phaser.Utils.Array.Shuffle([...FECHAS]).forEach((f, i) => {
      const x = 360 + i * 108;
      const c = this.add.container(x, 360);
      c.add(this.add.image(0, 0, 'prod_leche').setDisplaySize(120, 120));
      const etiqueta = this.add.graphics();
      etiqueta.fillStyle(0xffffff, 1).fillRoundedRect(-46, -128, 92, 58, 8);
      etiqueta.lineStyle(3, 0x1f2d3a, 1).strokeRoundedRect(-46, -128, 92, 58, 8);
      c.add([etiqueta,
        this.add.text(0, -112, String(+f.slice(0, 2)), estiloTexto(26)).setOrigin(0.5),
        this.add.text(0, -86, MESES[+f.slice(2)], estiloTexto(18, '#c53030')).setOrigin(0.5)]);
      c.fecha = f;
      c.origen = { x, y: 360 };
      c.setSize(100, 240).setInteractive({ useHandCursor: true, draggable: true });
      c.on('pointerdown', () => voz.decir('fecha_' + f));
      c.on('dragstart', () => c.setDepth(100));
      c.on('drag', (p, dx, dy) => c.setPosition(dx, dy));
      c.on('dragend', () => this.soltar(c));
    });

    voz.secuencia(['extra_vencidos_jefe', 'vencidos_instr']).then((ok) => partirReloj(this, ok));
  }

  async soltar(c) {
    const enCanasto = Math.abs(c.x - CANASTO.x) < 110 && Math.abs(c.y - CANASTO.y) < 120;
    if (!enCanasto) {
      this.tweens.add({ targets: c, x: c.origen.x, y: c.origen.y, duration: 250 });
      c.setDepth(0);
      return;
    }
    if (!vencida(c.fecha)) {
      sfx(this, 'error');
      sumarError();
      voz.decir('vencidos_mal');
      this.tweens.add({ targets: c, x: c.origen.x, y: c.origen.y, duration: 300 });
      return;
    }
    c.disableInteractive();
    sfx(this, 'bien');
    this.tweens.add({ targets: c, x: CANASTO.x, y: CANASTO.y, scale: 0.4, alpha: 0, duration: 300, onComplete: () => c.destroy() });
    this.quedan--;
    if (this.quedan > 0) {
      voz.decir('vencidos_bien');
      return;
    }
    marca(this, CANASTO.x, CANASTO.y - 120, true);
    sfx(this, 'logro');
    if (!(await voz.secuencia(['vencidos_bien', 'vencidos_fin']))) return;
    siguiente(this);
  }
}
