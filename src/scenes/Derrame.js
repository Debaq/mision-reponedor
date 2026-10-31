import Phaser from 'phaser';
import { COLOR, estiloTexto, ANCHO_MAX, X_IZQ, ALTO } from '../lib/estilo.js';
import { fondoRender } from '../lib/fondos.js';
import { Indicador, marca, sacudir } from '../lib/ui.js';
import { basurero, charco, herramienta, letreroPisoMojado, tarjeta } from '../lib/objetos.js';
import { crearPersonaje, enPiso, ESCALA } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { partirReloj, siguiente } from '../lib/flujo.js';
import { levantar } from '../lib/sombras.js';
import { alzaDedo, holgura, tocable } from '../lib/movil.js';

const CHARCO = { x: 640, y: 500, rx: 150, ry: 50 };
const BASURERO = { x: 170, y: 480 };

// Tarea adicional: botar la botella al basurero, limpiar la bebida derramada y señalizar.
export default class Derrame extends Phaser.Scene {
  constructor() {
    super('Derrame');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_tienda', 'SUPERMERCADO EL BARRIO');
    crearPersonaje(this, 1170, enPiso(), estado.avatar, ESCALA);
    this.ind = new Indicador(this);

    // Charco de bebida (se va desvaneciendo al limpiar) y la botella caída, con la boca hacia el charco.
    this.charco = charco(this, CHARCO.x, CHARCO.y, 400);
    this.basurero = basurero(this, BASURERO.x, BASURERO.y);
    this.botella = this.add.image(CHARCO.x + 240, CHARCO.y - 26, 'prod_bebida').setDisplaySize(70, 70).setAngle(-100);
    this.limpieza = 0;

    this.inicio();
  }

  async inicio() {
    if (!(await voz.decir('extra_derrame_jefe'))) return;
    if (!(await partirReloj(this))) return;
    this.botarBotella();
  }

  // Primero la botella vacía al basurero (si no, se sigue derramando y estorba al limpiar).
  botarBotella() {
    const b = this.botella;
    const origen = { x: b.x, y: b.y };
    tocable(b.setInteractive({ useHandCursor: true, draggable: true }), 56);
    b.on('dragstart', () => {
      sfx(this, 'tomar', 0.4);
      b.setDepth(60);
      this.tweens.add({ targets: b, angle: 0, duration: 150 });
      this.ind.apuntar(BASURERO.x, BASURERO.y - 40, 90);
    });
    levantar(b);
    b.on('drag', (p, x, y) => b.setPosition(x, y - alzaDedo(this)));
    b.on('dragend', async () => {
      const enBasurero = Math.abs(b.x - BASURERO.x) < 90 * holgura() && Math.abs(b.y - BASURERO.y) < 120 * holgura();
      if (!enBasurero) {
        this.tweens.add({ targets: b, x: origen.x, y: origen.y, angle: -100, duration: 250 });
        b.setDepth(0);
        this.ind.apuntar(origen.x, origen.y, 50);
        return;
      }
      b.disableInteractive();
      this.ind.ocultar();
      sfx(this, 'soltar');
      this.tweens.add({ targets: b, x: BASURERO.x, y: BASURERO.y - 60, scale: 0, duration: 250, onComplete: () => b.destroy() });
      marca(this, BASURERO.x, BASURERO.y - 150, true);
      sfx(this, 'bien');
      if (!(await voz.decir('derrame_botella_bien'))) return;
      this.elegirHerramienta();
    });
    this.ind.apuntar(origen.x, origen.y, 50);
    voz.decir('derrame_botella');
  }

  elegirHerramienta() {
    const opciones = Phaser.Utils.Array.Shuffle(['trapero', 'escoba', 'plumero']);
    const fondo = this.add.graphics().fillStyle(0x000000, 0.45).fillRect(X_IZQ, 0, ANCHO_MAX, ALTO);
    const objs = [fondo];
    opciones.forEach((tipo, i) => {
      const x = 400 + i * 240;
      const t = tarjeta(this, x, 300, 200, 300);
      t.add(herramienta(this, 0, -30, tipo).setScale(1.05));
      t.add(this.add.text(0, 118, tipo[0].toUpperCase() + tipo.slice(1), estiloTexto(24)).setOrigin(0.5));
      objs.push(t);
      t.on('pointerup', async () => {
        sfx(this, 'click', 0.3);
        if (tipo !== 'trapero') {
          sacudir(this, t);
          sfx(this, 'error');
          sumarError();
          await voz.decir('herr_' + tipo);
          voz.decir('derrame_mal');
          return;
        }
        marca(this, x, 180, true);
        sfx(this, 'bien');
        objs.forEach((o) => o.destroy());
        this.limpiar();
      });
    });
    voz.decir('derrame_elige');
  }

  limpiar() {
    voz.decir('derrame_limpia');
    const trapero = herramienta(this, 900, 420, 'trapero').setDepth(50);
    trapero.setSize(80, 200).setInteractive({ useHandCursor: true, draggable: true });
    this.ind.apuntar(900, 420, 70);
    let ultimo = null;
    let sonido = 0;
    trapero.on('dragstart', () => this.ind.ocultar());
    trapero.on('drag', (p, x, y) => {
      trapero.setPosition(x, y);
      // La punta del trapero está ~80 px bajo el centro.
      const px = x;
      const py = y + 80;
      const dx = (px - CHARCO.x) / (CHARCO.rx + 60);
      const dy = (py - CHARCO.y) / (CHARCO.ry + 30);
      if (dx * dx + dy * dy <= 1 && ultimo) {
        this.limpieza += Phaser.Math.Distance.Between(px, py, ultimo.x, ultimo.y) / 25;
        this.charco.setAlpha(Math.max(0, 1 - this.limpieza / 100));
        if (this.time.now - sonido > 350) {
          sfx(this, 'frotar', 0.35);
          sonido = this.time.now;
        }
        if (this.limpieza >= 100) {
          trapero.disableInteractive();
          this.tweens.add({ targets: trapero, alpha: 0, duration: 300, onComplete: () => trapero.destroy() });
          this.charco.destroy();
          sfx(this, 'bien');
          this.ponerLetrero();
        }
      }
      ultimo = { x: px, y: py };
    });
  }

  ponerLetrero() {
    voz.decir('derrame_letrero');
    const destino = this.add.circle(CHARCO.x - 260, CHARCO.y - 10, 70).setStrokeStyle(5, COLOR.amarillo).setFillStyle(0xffffff, 0.3);
    this.tweens.add({ targets: destino, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    const letrero = letreroPisoMojado(this, 960, 470).setDepth(50);
    letrero.setSize(120, 150).setInteractive({ useHandCursor: true, draggable: true });
    this.ind.apuntar(960, 470, 80);
    letrero.on('dragstart', () => this.ind.apuntar(destino.x, destino.y, 80));
    letrero.on('drag', (p, x, y) => letrero.setPosition(x, y - alzaDedo(this)));
    letrero.on('dragend', async () => {
      if (Phaser.Math.Distance.Between(letrero.x, letrero.y, destino.x, destino.y) > 110 * holgura()) {
        this.ind.apuntar(destino.x, destino.y, 80);
        return;
      }
      letrero.disableInteractive();
      letrero.setPosition(destino.x, destino.y - 20);
      destino.destroy();
      this.ind.ocultar();
      marca(this, destino.x, destino.y - 140, true);
      sfx(this, 'logro');
      if (!(await voz.decir('derrame_fin'))) return;
      siguiente(this);
    });
  }
}
