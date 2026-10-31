import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto, ANCHO_MAX, X_IZQ } from '../lib/estilo.js';
import { carro } from '../lib/fondos.js';
import { caminar, crearPersonaje, enPiso, ESCALA } from '../lib/personaje.js';
import { estado } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { siguiente } from '../lib/flujo.js';
import niveles from '../data/niveles.json';
import pasillos from '../data/pasillos.json';

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
    g.fillStyle(0x8a96a3, 1).fillRect(X_IZQ, 0, ANCHO / 2 - X_IZQ, 560);
    g.fillStyle(0xeef3f6, 1).fillRect(ANCHO / 2, 0, ANCHO_MAX / 2, 560);
    g.fillStyle(0x6b737c, 1).fillRect(X_IZQ, 560, ANCHO / 2 - X_IZQ, 160);
    g.fillStyle(0xe7e1d6, 1).fillRect(ANCHO / 2, 560, ANCHO_MAX / 2, 160);
    g.fillStyle(0x5f6b78, 1).fillRect(ANCHO / 2 - 90, 180, 180, 380);
    g.fillStyle(0x9aa5b1, 1).fillRect(ANCHO / 2 - 80, 190, 160, 370);
    this.add.text(320, 110, 'BODEGA', estiloTexto(44, '#ffffff')).setOrigin(0.5);
    const pas = pasillos[niveles[this.nivel].pasillo];
    this.add.text(960, 110, `PASILLO ${pas.n}`, estiloTexto(44, '#ffffff', { backgroundColor: pas.color, padding: { x: 18, y: 6 } })).setOrigin(0.5);
    this.add.text(960, 168, pas.nombre.toUpperCase(), estiloTexto(32, pas.color)).setOrigin(0.5);

    const grupo = this.add.container(-200, 0);
    const c = carro(this, 260, 540, 300);
    const items = niveles[this.nivel].lista.flatMap((it) => Array(it.n).fill(it.p));
    items.slice(0, 20).forEach((p, i) => {
      c.add(this.add.image(-125 + (i % 7) * 40, -36 - Math.floor(i / 7) * 36, 'prod_' + p).setDisplaySize(44, 44));
    });
    const yo = crearPersonaje(this, 470, enPiso(), estado.avatar, ESCALA);
    grupo.add([c, yo]);
    caminar(yo, true);

    voz.decir('traslado');
    this.tweens.add({
      targets: grupo, x: ANCHO - 420, duration: 4200, ease: 'Sine.easeInOut',
      onComplete: () => this.time.delayedCall(400, () => siguiente(this)),
    });
  }
}
