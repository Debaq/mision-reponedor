import Phaser from 'phaser';
import { ANCHO, ALTO, COLOR, estiloTexto } from '../lib/estilo.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';

const COLOR_VOZ = { guia: COLOR.azul, jugador: COLOR.verde, jugadora: COLOR.verde, jugadore: COLOR.verde, jefe: 0x6b46c1, cliente: 0xb7791f };
const NOMBRE_VOZ = { guia: 'Guía', jugador: 'Tú', jugadora: 'Tú', jugadore: 'Tú', jefe: 'Don Jorge', cliente: 'Clienta' };

// Escena superpuesta: subtítulo de la voz actual + botón para repetir.
export default class Hud extends Phaser.Scene {
  constructor() {
    super({ key: 'Hud', active: false });
  }

  create() {
    this.scene.bringToTop();
    const y = ALTO - 58;
    this.caja = this.add.container(0, 0).setVisible(false);
    this.fondo = this.add.graphics();
    this.quien = this.add.text(150, y - 34, '', estiloTexto(18, '#ffffff')).setOrigin(0, 0.5);
    this.texto = this.add.text(150, y + 6, '', estiloTexto(24, '#ffffff', { wordWrap: { width: ANCHO - 330 } })).setOrigin(0, 0.5);
    this.caja.add([this.fondo, this.quien, this.texto]);

    // Botón parlante: repite la última instrucción.
    this.parlante = this.add.container(70, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillCircle(0, 4, 46);
    g.fillStyle(COLOR.azul, 1).fillCircle(0, 0, 46);
    g.lineStyle(4, 0xffffff, 0.5).strokeCircle(0, 0, 40);
    this.parlante.add([g, this.add.image(0, 0, 'ui_audioOn').setDisplaySize(56, 56)]);
    this.parlante.setSize(92, 92).setInteractive({ useHandCursor: true });
    this.parlante.on('pointerup', () => {
      sfx(this, 'click', 0.3);
      voz.repetir();
    });
    this.parlante.setVisible(false);

    voz.on('linea', (id, texto, quien) => this.mostrar(texto, quien));
    voz.on('fin', () => this.ondas && this.ondas.pause());
    this.ondas = this.tweens.add({ targets: this.parlante, scale: 1.1, duration: 300, yoyo: true, repeat: -1, paused: true });
  }

  mostrar(texto, quien) {
    const y = ALTO - 58;
    this.fondo.clear();
    this.fondo.fillStyle(0x000000, 0.72).fillRoundedRect(120, y - 52, ANCHO - 260, 104, 16);
    this.fondo.fillStyle(COLOR_VOZ[quien] || COLOR.azul, 1).fillRoundedRect(130, y - 46, 8, 92, 4);
    this.quien.setText(NOMBRE_VOZ[quien] || '');
    this.texto.setText(texto);
    const tam = texto.length > 150 ? 19 : texto.length > 100 ? 21 : 24;
    this.texto.setFontSize(tam);
    this.caja.setVisible(true);
    this.parlante.setVisible(true);
    this.ondas.resume();
  }

  // Las escenas pueden ocultar el subtítulo (ej. al cambiar de etapa).
  ocultar() {
    this.caja.setVisible(false);
  }
}
