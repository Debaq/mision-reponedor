import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoEntrada } from '../lib/fondos.js';
import { boton, panel } from '../lib/ui.js';
import { crearPersonaje, SUPERVISOR } from '../lib/personaje.js';
import { estado, nombreJugador } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';

const ETAPAS = [
  ['avatar', 'Vestimenta'], ['supervisor', 'Presentación'], ['bodega', 'Bodega'], ['sala', 'Estantería'],
  ['derrame', 'Derrame'], ['basura', 'Basura'], ['vencidos', 'Vencidos'], ['cliente', 'Atención cliente'],
];

// Fin del turno: felicitación y resumen (útil para el docente).
export default class Fin extends Phaser.Scene {
  constructor() {
    super('Fin');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoEntrada(this);
    crearPersonaje(this, 170, 420, SUPERVISOR, 0.45);
    crearPersonaje(this, 1110, 420, estado.avatar, 0.45);

    panel(this, ANCHO / 2, 330, 560, 470, 0xffffff, 24);
    this.add.text(ANCHO / 2, 140, '¡TURNO TERMINADO!', estiloTexto(40, '#553c9a')).setOrigin(0.5);
    this.add.text(ANCHO / 2, 188, nombreJugador(), estiloTexto(30)).setOrigin(0.5);
    for (let i = 0; i < 3; i++) {
      const e = this.add.image(ANCHO / 2 - 70 + i * 70, 245, 'ui_star').setTint(COLOR.amarillo).setDisplaySize(60, 60).setScale(0);
      this.tweens.add({ targets: e, scaleX: 60 / e.width, scaleY: 60 / e.height, delay: 300 + i * 250, duration: 300, ease: 'Back.easeOut',
        onStart: () => sfx(this, 'tick') });
    }
    ETAPAS.forEach(([k, nombre], i) => {
      const x = ANCHO / 2 - 250 + (i % 2) * 260;
      const y = 310 + Math.floor(i / 2) * 50;
      const err = estado.errores[k] || 0;
      this.add.image(x + 14, y, 'ui_checkmark').setDisplaySize(26, 26).setTint(COLOR.verde);
      this.add.text(x + 36, y, nombre, estiloTexto(20)).setOrigin(0, 0.5);
      this.add.text(x + 236, y, err ? `${err} ✗` : '✓', estiloTexto(20, err ? '#c05621' : '#2f855a')).setOrigin(1, 0.5);
    });
    this.add.text(ANCHO / 2, 512, 'Número = intentos con error', estiloTexto(15, '#718096', { fontStyle: 'normal' })).setOrigin(0.5);

    voz.secuencia(['fin_jefe', 'fin_guia']);
    sfx(this, 'logro');

    boton(this, ANCHO - 140, 90, {
      icono: 'ui_home', texto: 'Inicio', ancho: 200, alto: 76, tam: 26, color: COLOR.azul,
      onClick: () => {
        voz.callar();
        estado.errores = {};
        this.scene.start('Inicio');
      },
    });
  }
}
