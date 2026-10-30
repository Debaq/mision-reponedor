import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoEntrada } from '../lib/fondos.js';
import { boton, dibujarReloj, panel } from '../lib/ui.js';
import { crearPersonaje, SUPERVISOR } from '../lib/personaje.js';
import { estado, nombreJugador, nuevaPartida } from '../lib/estado.js';
import { estrellasGuardadas, guardarPartida, perfil } from '../lib/perfil.js';
import { nuevosPremios, turno2Desbloqueado } from '../lib/premios.js';
import { FLUJO, inicioTurno, irA } from '../lib/flujo.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';

// Fin del turno: felicitación, resumen (útil para el docente) y aviso de lo desbloqueado.
export default class Fin extends Phaser.Scene {
  constructor() {
    super('Fin');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoEntrada(this);
    crearPersonaje(this, 170, 420, SUPERVISOR, 0.45);
    crearPersonaje(this, 1110, 420, estado.avatar, 0.45);

    // Etapas de este turno (las tareas encargadas solo si se jugaron: en el turno 2 se eligen al azar).
    const turno = FLUJO[estado.paso].turno;
    const etapas = FLUJO.filter((p) => p.id && p.turno === turno && (!p.enOrden || estado.resultados[p.id]));
    const jugadas = etapas.filter((p) => estado.resultados[p.id]);
    const t = { estrellas: 0, puntos: 0 };
    for (const p of jugadas) {
      t.estrellas += estado.resultados[p.id].estrellas;
      t.puntos += estado.resultados[p.id].puntos;
    }
    // Estrellas grandes: promedio de las etapas jugadas.
    const promedio = jugadas.length ? Math.round(t.estrellas / jugadas.length) : 0;
    const recordAnterior = perfil().record;
    guardarPartida(t.puntos);

    panel(this, ANCHO / 2, 320, 740, 470, 0xffffff, 24);
    this.add.text(ANCHO / 2, 118, turno === 2 ? '¡TURNO 2 TERMINADO!' : '¡TURNO TERMINADO!', estiloTexto(40, '#553c9a')).setOrigin(0.5);
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

    // Detalle por etapa (útil para el docente), en dos columnas.
    const porColumna = Math.ceil(etapas.length / 2);
    const alto = Math.min(36, 200 / (porColumna - 1));
    etapas.forEach((p, i) => {
      const x = ANCHO / 2 - 340 + Math.floor(i / porColumna) * 360;
      const y = 302 + (i % porColumna) * alto;
      const r = estado.resultados[p.id];
      this.add.text(x, y, p.nombre, estiloTexto(18)).setOrigin(0, 0.5);
      if (!r) {
        this.add.text(x + 340, y, '—', estiloTexto(18, '#a0aec0')).setOrigin(1, 0.5);
        return;
      }
      for (let k = 0; k < 3; k++) {
        this.add.image(x + 208 + k * 24, y, 'ui_star').setDisplaySize(22, 22).setTint(k < r.estrellas ? COLOR.amarillo : 0xcbd5e0);
      }
      this.add.text(x + 340, y, r.errores ? `${r.errores} ✗` : '✓', estiloTexto(18, r.errores ? '#c05621' : '#2f855a')).setOrigin(1, 0.5);
      if (r.tarde) dibujarReloj(this.add.graphics(), x + 284, y, 9, COLOR.rojo);
    });
    this.add.text(ANCHO / 2, 528, `0 errores = 3★ · 1 o 2 = 2★ · más = 1★ · reloj rojo = fuera de tiempo (−1★) · ✗ = errores`,
      estiloTexto(15, '#718096', { fontStyle: 'normal' })).setOrigin(0.5);

    sfx(this, 'logro');
    this.anunciar();

    boton(this, ANCHO - 140, 90, {
      icono: 'ui_home', texto: 'Inicio', ancho: 200, alto: 76, tam: 26, color: COLOR.azul,
      onClick: () => {
        voz.callar();
        this.scene.start('Inicio');
      },
    });
    if (turno2Desbloqueado()) {
      boton(this, ANCHO - 140, 190, {
        icono: 'ui_right', texto: 'Turno 2', ancho: 200, alto: 76, tam: 26, color: COLOR.marca,
        onClick: () => {
          nuevaPartida();
          estado.estrellasInicio = estrellasGuardadas();
          irA(this, inicioTurno(2));
        },
      });
    }
  }

  // Felicitación y, si se ganó algo nuevo en esta partida, una tarjeta con los premios.
  async anunciar() {
    if (!(await voz.secuencia(['fin_jefe', 'fin_guia']))) return;
    if (estado.estrellasInicio === null) return;
    const ahora = estrellasGuardadas();
    const nuevos = nuevosPremios(estado.estrellasInicio, ahora);
    estado.estrellasInicio = ahora;
    if (!nuevos.chalecos.length && !nuevos.turno2) return;

    const capa = this.add.rectangle(ANCHO / 2, 360, ANCHO, 720, 0x000000, 0.6).setInteractive().setDepth(200);
    const objs = [capa, panel(this, ANCHO / 2, 330, 620, 380, 0xffffff, 24).setDepth(201)];
    const add = (o) => objs.push(o.setDepth(202));
    add(this.add.text(ANCHO / 2, 175, '¡NUEVO!', estiloTexto(44, '#553c9a')).setOrigin(0.5));
    const items = [...nuevos.chalecos.map((c) => ({ chaleco: c })), ...(nuevos.turno2 ? [{ turno2: true }] : [])];
    items.forEach((it, i) => {
      const x = ANCHO / 2 + (i - (items.length - 1) / 2) * 200;
      if (it.chaleco) {
        const img = this.add.image(x, 320, 'chaleco_' + it.chaleco);
        add(img.setScale(150 / img.width));
      } else {
        add(this.add.text(x, 300, 'TURNO 2', estiloTexto(32, '#ffffff', { backgroundColor: '#319795', padding: { x: 14, y: 10 } })).setOrigin(0.5));
        add(this.add.text(x, 360, 'Limpieza', estiloTexto(22, '#319795')).setOrigin(0.5));
      }
    });
    add(this.add.image(ANCHO / 2, 470, 'ui_checkmark').setDisplaySize(50, 50).setTint(COLOR.verde));
    sfx(this, 'logro');
    capa.once('pointerup', () => {
      voz.callar();
      objs.forEach((o) => o.destroy());
    });
    voz.secuencia([...(nuevos.chalecos.length ? ['premio_chaleco'] : []), ...(nuevos.turno2 ? ['premio_turno2'] : [])]);
  }
}
