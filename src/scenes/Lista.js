import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoSala } from '../lib/fondos.js';
import { flechaSiguiente, Indicador, panel } from '../lib/ui.js';
import { crearPersonaje, SUPERVISOR } from '../lib/personaje.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import niveles from '../data/niveles.json';

// Etapa 4: el supervisor entrega la lista de reposición (imagen + cantidad).
export default class Lista extends Phaser.Scene {
  constructor() {
    super('Lista');
  }

  init(datos) {
    this.nivel = datos.nivel || 'tutorial';
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoSala(this);
    crearPersonaje(this, 1080, 400, SUPERVISOR, 0.5);
    const lista = niveles[this.nivel].lista;

    // Portapapeles
    const fila = lista.length > 3 ? 94 : 110;
    const alto = 130 + lista.length * fila;
    const y0 = 340 - alto / 2;
    panel(this, 560, 340, 560, alto, 0x8b5e3c, 20);
    panel(this, 560, 350, 520, alto - 40, COLOR.papel, 10, false);
    this.add.graphics().fillStyle(0x9aa5b1, 1).fillRoundedRect(480, y0 - 14, 160, 40, 10);
    this.add.text(560, y0 + 52, 'LISTA DE REPOSICIÓN', estiloTexto(28, '#553c9a')).setOrigin(0.5);

    this.ind = new Indicador(this);
    this.escuchadas = new Set();
    this.filas = lista.map((item, i) => {
      const y = y0 + 140 + i * fila;
      const c = this.add.container(560, y);
      const g = this.add.graphics();
      g.lineStyle(2, 0xd6cdb8, 1).lineBetween(-230, fila / 2, 230, fila / 2);
      const img = this.add.image(-150, 0, 'prod_' + item.p).setDisplaySize(fila - 8, fila - 8);
      const num = this.add.text(30, 0, '× ' + item.n, estiloTexto(64, '#1f2d3a')).setOrigin(0.5);
      const parl = this.add.image(190, 0, 'ui_audioOn').setDisplaySize(42, 42).setTint(COLOR.azul);
      const check = this.add.image(-215, 0, 'ui_checkmark').setDisplaySize(34, 34).setTint(COLOR.verde).setVisible(false);
      c.add([g, img, num, parl, check]);
      c.setSize(480, 100).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        sfx(this, 'click', 0.3);
        this.tweens.add({ targets: img, scale: img.scale * 1.15, duration: 150, yoyo: true });
        voz.decir(`lista_${item.p}_${item.n}`);
        check.setVisible(true);
        this.escuchadas.add(i);
        this.guiar();
      });
      return c;
    });

    const intro = this.nivel === 'practica' ? ['prac_intro', 'lista_intro'] : ['lista_intro'];
    voz.secuencia(intro).then((ok) => ok && this.guiar());
  }

  // Apunta a la siguiente fila sin escuchar; al terminar muestra la flecha.
  guiar() {
    const pendiente = this.filas.findIndex((_, i) => !this.escuchadas.has(i));
    if (pendiente >= 0) {
      this.ind.apuntar(410, this.filas[pendiente].y, 56);
      return;
    }
    this.ind.ocultar();
    if (!this.flecha) {
      this.flecha = flechaSiguiente(this, () => siguiente(this));
      this.flecha.latir();
    }
  }
}
