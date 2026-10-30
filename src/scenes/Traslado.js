import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { carro } from '../lib/fondos.js';
import { crearPersonaje } from '../lib/personaje.js';
import { estado } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { siguiente } from '../lib/flujo.js';
import niveles from '../data/niveles.json';

// Trasladar productos: el reponedor empuja el carro de la bodega a la sala de ventas.
export default class Traslado extends Phaser.Scene {
  constructor() {
    super('Traslado');
  }

  init(datos) {
    this.nivel = datos.nivel || 'tutorial';
  }

  create() {
    this.cameras.main.fadeIn(300);
    const g = this.add.graphics();
    // mitad bodega, mitad sala
    g.fillStyle(0x8a96a3, 1).fillRect(0, 0, ANCHO / 2, 560);
    g.fillStyle(0xeef3f6, 1).fillRect(ANCHO / 2, 0, ANCHO / 2, 560);
    g.fillStyle(0x6b737c, 1).fillRect(0, 560, ANCHO / 2, 160);
    g.fillStyle(0xe7e1d6, 1).fillRect(ANCHO / 2, 560, ANCHO / 2, 160);
    g.fillStyle(0x5f6b78, 1).fillRect(ANCHO / 2 - 90, 180, 180, 380);
    g.fillStyle(0x9aa5b1, 1).fillRect(ANCHO / 2 - 80, 190, 160, 370);
    this.add.text(320, 110, 'BODEGA', estiloTexto(44, '#ffffff')).setOrigin(0.5);
    this.add.text(960, 110, 'SALA DE VENTAS', estiloTexto(44, '#553c9a')).setOrigin(0.5);

    const grupo = this.add.container(-200, 0);
    const c = carro(this, 260, 540, 300);
    const items = niveles[this.nivel].lista.flatMap((it) => Array(it.n).fill(it.p));
    items.slice(0, 20).forEach((p, i) => {
      c.add(this.add.image(-125 + (i % 7) * 40, -36 - Math.floor(i / 7) * 36, 'prod_' + p).setDisplaySize(44, 44));
    });
    const yo = crearPersonaje(this, 470, 450, estado.avatar, 0.3);
    grupo.add([c, yo]);
    this.tweens.add({ targets: yo, y: 444, duration: 220, yoyo: true, repeat: -1 });

    voz.decir('traslado');
    this.tweens.add({
      targets: grupo, x: ANCHO - 420, duration: 4200, ease: 'Sine.easeInOut',
      onComplete: () => this.time.delayedCall(400, () => siguiente(this)),
    });
  }
}
