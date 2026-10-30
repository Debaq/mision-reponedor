import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoEntrada } from '../lib/fondos.js';
import { boton, panel } from '../lib/ui.js';
import { crearPersonaje, SUPERVISOR } from '../lib/personaje.js';
import { estado, nombreJugador, totales } from '../lib/estado.js';
import { guardarPartida, perfil } from '../lib/perfil.js';
import { FLUJO } from '../lib/flujo.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';

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

    const etapas = FLUJO.filter((p) => p.id);
    const t = totales();
    const jugadas = etapas.filter((p) => estado.resultados[p.id]);
    // Estrellas grandes: promedio de las etapas jugadas.
    const promedio = jugadas.length ? Math.round(t.estrellas / jugadas.length) : 0;
    const recordAnterior = perfil().record;
    guardarPartida(t.puntos);

    panel(this, ANCHO / 2, 320, 740, 470, 0xffffff, 24);
    this.add.text(ANCHO / 2, 118, '¡TURNO TERMINADO!', estiloTexto(40, '#553c9a')).setOrigin(0.5);
    this.add.text(ANCHO / 2, 162, nombreJugador(), estiloTexto(28)).setOrigin(0.5);
    for (let i = 0; i < 3; i++) {
      const e = this.add.image(ANCHO / 2 - 70 + i * 70, 215, 'ui_star').setDisplaySize(60, 60).setScale(0)
        .setTint(i < promedio ? COLOR.amarillo : 0xcbd5e0);
      this.tweens.add({ targets: e, scaleX: 60 / e.width, scaleY: 60 / e.height, delay: 300 + i * 250, duration: 300, ease: 'Back.easeOut',
        onStart: () => sfx(this, 'tick') });
    }
    const nuevoRecord = t.puntos > recordAnterior && recordAnterior > 0;
    this.add.text(ANCHO / 2, 268, `★ ${t.estrellas} / ${jugadas.length * 3}     ${t.puntos} puntos${nuevoRecord ? '  ¡récord!' : ''}`,
      estiloTexto(24, '#553c9a')).setOrigin(0.5);

    // Detalle por etapa (útil para el docente).
    etapas.forEach((p, i) => {
      const x = ANCHO / 2 - 340 + Math.floor(i / 5) * 360;
      const y = 318 + (i % 5) * 40;
      const r = estado.resultados[p.id];
      this.add.text(x, y, p.nombre, estiloTexto(19)).setOrigin(0, 0.5);
      if (!r) {
        this.add.text(x + 320, y, '—', estiloTexto(19, '#a0aec0')).setOrigin(1, 0.5);
        return;
      }
      for (let k = 0; k < 3; k++) {
        this.add.image(x + 200 + k * 26, y, 'ui_star').setDisplaySize(24, 24).setTint(k < r.estrellas ? COLOR.amarillo : 0xcbd5e0);
      }
      this.add.text(x + 320, y, r.errores ? `${r.errores} ✗` : '✓', estiloTexto(19, r.errores ? '#c05621' : '#2f855a')).setOrigin(1, 0.5);
    });
    this.add.text(ANCHO / 2, 528, `Estrellas: 0 errores = 3 · 1 o 2 errores = 2 · más = 1      ✗ = intentos con error`,
      estiloTexto(15, '#718096', { fontStyle: 'normal' })).setOrigin(0.5);

    voz.secuencia(['fin_jefe', 'fin_guia']);
    sfx(this, 'logro');

    boton(this, ANCHO - 140, 90, {
      icono: 'ui_home', texto: 'Inicio', ancho: 200, alto: 76, tam: 26, color: COLOR.azul,
      onClick: () => {
        voz.callar();
        this.scene.start('Inicio');
      },
    });
  }
}
