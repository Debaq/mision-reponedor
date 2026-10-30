import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoSala, estanteDeco } from '../lib/fondos.js';
import { Indicador, marca, sacudir } from '../lib/ui.js';
import { herramienta, letreroPisoMojado, tarjeta } from '../lib/objetos.js';
import { crearPersonaje } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';

const CHARCO = { x: 640, y: 500, rx: 150, ry: 50 };

// Tarea adicional: limpiar una bebida derramada y señalizar.
export default class Derrame extends Phaser.Scene {
  constructor() {
    super('Derrame');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoSala(this, { pisoY: 400 });
    estanteDeco(this, 80, 90, 520, 3, 100, 50);
    estanteDeco(this, 680, 90, 520, 3, 100, 50);
    crearPersonaje(this, 1150, 470, estado.avatar, 0.3);
    this.ind = new Indicador(this);

    // Charco: varias manchas que se van desvaneciendo al limpiar.
    this.charco = this.add.container(CHARCO.x, CHARCO.y);
    const g = this.add.graphics();
    g.fillStyle(0x9c4221, 0.75);
    g.fillEllipse(0, 0, CHARCO.rx * 2, CHARCO.ry * 2);
    g.fillEllipse(-110, 20, 90, 40).fillEllipse(120, -14, 110, 46).fillEllipse(40, 34, 80, 30);
    g.fillStyle(0xffffff, 0.35).fillEllipse(-40, -14, 60, 12);
    this.charco.add(g);
    this.add.image(CHARCO.x + 190, CHARCO.y - 20, 'prod_bebida').setDisplaySize(70, 70).setAngle(95);
    this.limpieza = 0;

    this.inicio();
  }

  async inicio() {
    if (!(await voz.secuencia(['extra_intro', 'extra_derrame_jefe']))) return;
    this.elegirHerramienta();
  }

  elegirHerramienta() {
    const opciones = Phaser.Utils.Array.Shuffle(['trapero', 'escoba', 'plumero']);
    const fondo = this.add.graphics().fillStyle(0x000000, 0.45).fillRect(0, 0, 1280, 720);
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
    letrero.on('drag', (p, x, y) => letrero.setPosition(x, y));
    letrero.on('dragend', async () => {
      if (Phaser.Math.Distance.Between(letrero.x, letrero.y, destino.x, destino.y) > 110) {
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
