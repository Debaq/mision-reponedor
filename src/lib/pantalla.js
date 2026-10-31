import Phaser from 'phaser';
import { ALTO, ANCHO } from './estilo.js';

// Pantallas más alargadas que 16:9 (nivel 2 de docs/plan-movil.md): con Scale.EXPAND el juego crece a
// lo ancho (hasta ANCHO_MAX) y este plugin corre la cámara principal de cada escena para que el
// contenido, dibujado en 0..ANCHO, quede al centro. También al girar o cambiar el tamaño de la ventana.
export class Centrado extends Phaser.Plugins.ScenePlugin {
  boot() {
    this.systems.events.on('create', this.centrar, this);
    this.game.scale.on('resize', this.centrar, this);
    this.systems.events.once('destroy', () => this.game.scale.off('resize', this.centrar, this));
  }

  centrar() {
    const cam = this.systems.cameras?.main;
    if (!cam) return;
    const { width, height } = this.game.scale.gameSize;
    cam.setScroll(-(width - ANCHO) / 2, -(height - ALTO) / 2);
  }
}

// Cuánto se ve a cada lado del contenido (0 en 16:9).
export const margenLateral = (scene) => (scene.scale.gameSize.width - ANCHO) / 2;
