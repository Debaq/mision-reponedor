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
    const porColumna = Math.ceil(conTitulo.length / 2);
    const paso = Math.min(76, 540 / porColumna);
    conTitulo.forEach((p, n) => {
      const col = Math.floor(n / porColumna);
      const fila = n % porColumna;
      boton(this, 340 + col * 600, 120 + fila * paso, {
        texto: p.titulo, ancho: 560, alto: paso - 8, tam: paso < 56 ? 18 : 22, color: p.turno === 2 ? COLOR.marca : COLOR.azul,
        onClick: () => irA(this, p.i),
      });
    });
    boton(this, 120, 660, { icono: 'ui_return', ancho: 110, alto: 80, color: COLOR.gris, onClick: () => this.scene.start('Inicio') });
  }
}
