import Phaser from 'phaser';
import { fondoSala, estanteDeco } from '../lib/fondos.js';
import { Indicador, marca, sacudir } from '../lib/ui.js';
import { basurero } from '../lib/objetos.js';
import { crearPersonaje } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';

const BASURA = ['basura_lata', 'basura_envoltorio', 'basura_manzana', 'basura_vaso', 'basura_lata'];
const NO_BASURA = ['atun', 'chocolate'];
const TACHO = { x: 1080, y: 470 };

// Tarea adicional: recoger basura del pasillo (y distinguir productos que no son basura).
export default class Basura extends Phaser.Scene {
  constructor() {
    super('Basura');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoSala(this, { pisoY: 400 });
    estanteDeco(this, 80, 90, 520, 3, 100, 50);
    estanteDeco(this, 680, 90, 520, 3, 100, 50);
    crearPersonaje(this, 1210, 470, estado.avatar, 0.27);
    basurero(this, TACHO.x, TACHO.y);
    this.ind = new Indicador(this);

    const posiciones = Phaser.Utils.Array.Shuffle([
      [180, 450], [320, 520], [460, 440], [600, 530], [740, 460], [880, 540], [260, 560], [540, 470],
    ]);
    this.quedan = 0;
    [...BASURA.map((k) => ({ k, basura: true })), ...NO_BASURA.map((k) => ({ k: k, basura: false }))]
      .forEach((o, i) => {
        const [x, y] = posiciones[i];
        const it = this.add.image(x, y, o.basura ? o.k : 'prod_' + o.k).setDisplaySize(64, 64).setAngle(Phaser.Math.Between(-40, 40));
        it.basura = o.basura;
        it.origen = { x, y };
        if (o.basura) this.quedan++;
        it.setInteractive({ useHandCursor: true, draggable: true });
        it.on('dragstart', () => { it.setDepth(100); this.ind.ocultar(); sfx(this, 'tomar', 0.4); });
        it.on('dragend', () => this.soltar(it));
      });
    this.input.on('drag', (p, obj, x, y) => obj.setPosition(x, y));

    voz.secuencia(['extra_basura_jefe', 'basura_instr']).then((ok) => ok && this.quedan && this.ind.apuntar(TACHO.x, TACHO.y, 90));
  }

  async soltar(it) {
    const enTacho = Math.abs(it.x - TACHO.x) < 80 && Math.abs(it.y - TACHO.y) < 110;
    if (!enTacho) {
      it.setDepth(0);
      return;
    }
    if (!it.basura) {
      sfx(this, 'error');
      sumarError('basura');
      voz.decir('basura_no');
      this.tweens.add({ targets: it, x: it.origen.x, y: it.origen.y, duration: 300 });
      sacudir(this, it);
      return;
    }
    it.disableInteractive();
    sfx(this, 'soltar');
    this.tweens.add({ targets: it, x: TACHO.x, y: TACHO.y - 60, scale: 0, duration: 250, onComplete: () => it.destroy() });
    this.quedan--;
    if (this.quedan > 0) return;
    marca(this, TACHO.x, TACHO.y - 160, true);
    sfx(this, 'logro');
    if (!(await voz.decir('basura_fin'))) return;
    siguiente(this);
  }
}
