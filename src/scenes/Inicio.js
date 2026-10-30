import Phaser from 'phaser';
import { ANCHO, ALTO, COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoEntrada } from '../lib/fondos.js';
import { boton } from '../lib/ui.js';
import { voz } from '../lib/voz.js';
import { irA } from '../lib/flujo.js';
import { crearPersonaje } from '../lib/personaje.js';
import { AVATAR_INICIAL } from '../lib/estado.js';

export default class Inicio extends Phaser.Scene {
  constructor() {
    super('Inicio');
  }

  create() {
    this.cameras.main.fadeIn(300);
    this.scene.get('Hud').ocultar?.();
    fondoEntrada(this);
    this.add.graphics().fillStyle(0x000000, 0.35).fillRect(0, 0, ANCHO, ALTO);
    crearPersonaje(this, 230, 470, AVATAR_INICIAL, 0.55);

    const titulo = this.add.text(ANCHO / 2 + 80, 290, 'MISIÓN\nREPONEDOR', estiloTexto(92, '#ffffff', {
      align: 'center', stroke: '#1f2d3a', strokeThickness: 12, lineSpacing: -10,
    })).setOrigin(0.5);
    this.tweens.add({ targets: titulo, y: 300, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // El primer toque desbloquea el audio del navegador.
    const jugar = boton(this, ANCHO / 2 + 80, 500, {
      icono: 'ui_right', texto: 'COMENZAR', ancho: 380, alto: 120, tam: 44,
      onClick: async () => {
        jugar.setActivo(false);
        await voz.decir('inicio_bienvenida');
        irA(this, 0);
      },
    });
    this.tweens.add({ targets: jugar, scale: 1.06, duration: 700, yoyo: true, repeat: -1 });

    boton(this, ANCHO - 120, ALTO - 60, {
      icono: 'ui_information', texto: 'Etapas', ancho: 190, alto: 70, tam: 24, color: COLOR.gris,
      onClick: () => this.scene.start('Etapas'),
    });
  }
}
