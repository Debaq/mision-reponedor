import Phaser from 'phaser';
import { ANCHO, ALTO, COLOR, estiloTexto, ANCHO_MAX, X_IZQ } from '../lib/estilo.js';
import { fondoEntrada } from '../lib/fondos.js';
import { boton } from '../lib/ui.js';
import { voz } from '../lib/voz.js';
import { irA } from '../lib/flujo.js';
import { crearPersonaje, enPiso, ESCALA } from '../lib/personaje.js';
import { AVATAR_INICIAL, nuevaPartida } from '../lib/estado.js';
import { VERSION } from '../lib/version.js';
import { avisoInstalar, pantallaCompleta } from '../lib/movil.js';

export default class Inicio extends Phaser.Scene {
  constructor() {
    super('Inicio');
  }

  create() {
    this.cameras.main.fadeIn(300);
    const hud = this.scene.get('Hud');
    hud.ocultar();
    hud.mostrarMarcador(false);
    nuevaPartida();
    fondoEntrada(this);
    this.add.graphics().fillStyle(0x000000, 0.35).fillRect(X_IZQ, 0, ANCHO_MAX, ALTO);
    crearPersonaje(this, 230, enPiso(640), AVATAR_INICIAL, ESCALA);

    const titulo = this.add.text(ANCHO / 2 + 80, 290, 'MISIÓN\nREPONEDOR', estiloTexto(92, '#ffffff', {
      align: 'center', stroke: '#1f2d3a', strokeThickness: 12, lineSpacing: -10,
    })).setOrigin(0.5);
    this.tweens.add({ targets: titulo, y: 300, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // El primer toque desbloquea el audio del navegador.
    const jugar = boton(this, ANCHO / 2 + 80, 500, {
      icono: 'ui_right', texto: 'COMENZAR', ancho: 380, alto: 120, tam: 44,
      onClick: async () => {
        // Asegura que el audio quede activo (el navegador solo lo permite tras un toque).
        this.sound.context?.resume?.();
        pantallaCompleta(this);
        jugar.setActivo(false);
        await voz.decir('inicio_bienvenida');
        irA(this, 0);
      },
    });
    this.tweens.add({ targets: jugar, scale: 1.06, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(16, ALTO - 12, 'v' + VERSION, estiloTexto(14, '#ffffff', { fontStyle: 'normal' })).setOrigin(0, 1).setAlpha(0.6);

    boton(this, ANCHO - 120, ALTO - 60, {
      icono: 'ui_information', texto: 'Etapas', ancho: 190, alto: 70, tam: 24, color: COLOR.gris,
      onClick: () => this.scene.start('Etapas'),
    });
    avisoInstalar(this);
  }
}
