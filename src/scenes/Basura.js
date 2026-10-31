import Phaser from 'phaser';
import { fondoRender } from '../lib/fondos.js';
import { Indicador, marca, sacudir } from '../lib/ui.js';
import { basurero, carroReposicion } from '../lib/objetos.js';
import { crearPersonaje, enPiso, ESCALA } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { levantar } from '../lib/sombras.js';
import { partirReloj, siguiente } from '../lib/flujo.js';

const BASURA = ['basura_lata', 'basura_envoltorio', 'basura_manzana', 'basura_vaso', 'basura_lata'];
const NO_BASURA = ['atun', 'chocolate', 'jabon'];
const TACHO = { x: 1080, y: 470 };
const CARRO = { x: 170, y: 480 };

// Tarea adicional: ordenar el pasillo. La basura va al basurero y los productos caídos
// van al carro de reposición, para devolverlos a su lugar.
export default class Basura extends Phaser.Scene {
  constructor() {
    super('Basura');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_tienda', 'SUPERMERCADO EL BARRIO');
    crearPersonaje(this, 1215, enPiso(), estado.avatar, ESCALA);
    basurero(this, TACHO.x, TACHO.y);
    carroReposicion(this, CARRO.x, CARRO.y);
    this.ind = new Indicador(this);

    const posiciones = Phaser.Utils.Array.Shuffle([
      [340, 450], [460, 530], [580, 440], [700, 530], [820, 460], [940, 545], [400, 580], [640, 480], [760, 590],
    ]);
    this.quedan = 0;
    [...BASURA.map((k) => ({ k, basura: true })), ...NO_BASURA.map((k) => ({ k: k, basura: false }))]
      .forEach((o, i) => {
        const [x, y] = posiciones[i];
        const it = this.add.image(x, y, o.basura ? o.k : 'prod_' + o.k).setDisplaySize(64, 64).setAngle(Phaser.Math.Between(-40, 40));
        it.basura = o.basura;
        it.origen = { x, y };
        this.quedan++;
        it.setInteractive({ useHandCursor: true, draggable: true });
        it.on('dragstart', () => { it.setDepth(100); this.ind.ocultar(); sfx(this, 'tomar', 0.4); });
        levantar(it);
        it.on('dragend', () => this.soltar(it));
      });
    this.input.on('drag', (p, obj, x, y) => obj.setPosition(x, y));

    this.instrucciones();
  }

  async instrucciones() {
    const ok = await voz.secuencia(['extra_basura_jefe', 'basura_instr']);
    if (!(await partirReloj(this, ok)) || !ok) return;
    if (this.quedan) this.ind.apuntar(TACHO.x, TACHO.y, 90);
  }

  async soltar(it) {
    const enTacho = Math.abs(it.x - TACHO.x) < 80 && Math.abs(it.y - TACHO.y) < 110;
    const enCarro = Math.abs(it.x - CARRO.x) < 110 && Math.abs(it.y - CARRO.y) < 100;
    if (!enTacho && !enCarro) {
      it.setDepth(0);
      return;
    }
    // Lugar equivocado: producto al basurero o basura al carro.
    if (enTacho !== it.basura) {
      sfx(this, 'error');
      sumarError();
      voz.decir(it.basura ? 'basura_carro_no' : 'basura_no');
      this.tweens.add({ targets: it, x: it.origen.x, y: it.origen.y, duration: 300 });
      sacudir(this, it);
      return;
    }
    it.disableInteractive();
    if (enTacho) {
      sfx(this, 'soltar');
      this.tweens.add({ targets: it, x: TACHO.x, y: TACHO.y - 60, scale: 0, duration: 250, onComplete: () => it.destroy() });
    } else {
      // Al carro: queda a la vista, ordenado en la canasta.
      sfx(this, 'bien');
      this.enCarro = (this.enCarro || 0) + 1;
      this.tweens.add({ targets: it, x: CARRO.x - 50 + (this.enCarro - 1) * 48, y: CARRO.y - 52, angle: 0, duration: 250 });
      it.setDisplaySize(46, 46).setDepth(5);
    }
    this.quedan--;
    if (this.quedan > 0) return;
    marca(this, 640, 330, true);
    sfx(this, 'logro');
    await voz.decir('basura_fin');
    siguiente(this);
  }
}
