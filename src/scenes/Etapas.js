import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { boton } from '../lib/ui.js';
import { FLUJO, irA } from '../lib/flujo.js';

// Menú para docentes: saltar directamente a cualquier etapa.
export default class Etapas extends Phaser.Scene {
  constructor() {
    super('Etapas');
  }

  create() {
    this.add.text(ANCHO / 2, 50, 'Elegir etapa (docente)', estiloTexto(40, '#ffffff')).setOrigin(0.5);
    const conTitulo = FLUJO.map((p, i) => ({ ...p, i })).filter((p) => p.titulo);
    conTitulo.forEach((p, n) => {
      const col = n < 7 ? 0 : 1;
      const fila = n < 7 ? n : n - 7;
      boton(this, 340 + col * 600, 130 + fila * 76, {
        texto: p.titulo, ancho: 560, alto: 64, tam: 22, color: COLOR.azul,
        onClick: () => irA(this, p.i),
      });
    });
    boton(this, 120, 660, { icono: 'ui_return', ancho: 110, alto: 80, color: COLOR.gris, onClick: () => this.scene.start('Inicio') });
  }
}
