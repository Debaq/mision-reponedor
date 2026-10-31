import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoRender } from '../lib/fondos.js';
import { boton, marca } from '../lib/ui.js';
import { crearPersonaje, SUPERVISOR, enPiso, ESCALA } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import { sombraRect } from '../lib/sombras.js';

/**
 * Muestra opciones de respuesta como tarjetas. Tocar una tarjeta la lee en voz alta;
 * el botón verde confirma. Devuelve una promesa con la opción elegida.
 * opciones: [{ id, ok, fijo? }] — el texto sale del guion (fijo: texto distinto al audio)
 */
export function elegirRespuesta(scene, opciones, { x = 640, y0 = 150, ancho = 520 } = {}) {
  return new Promise((resolve) => {
    const velo = scene.add.graphics().setDepth(99);
    velo.fillStyle(0xffffff, 0.55).fillRoundedRect(x - ancho / 2 - 20, y0 - 64, ancho + 40, opciones.length * 108 + 120, 24);
    const objs = [velo];
    let elegida = null;
    const tarjetas = Phaser.Utils.Array.Shuffle([...opciones]).map((op, i) => {
      const y = y0 + i * 108;
      const c = scene.add.container(x, y).setDepth(100);
      const g = scene.add.graphics();
      const dibujar = (sel) => {
        g.clear();
        sombraRect(g, -ancho / 2 + 2, -44 + 7, ancho, 88, 16, 0.22);
        g.fillStyle(sel ? 0xfff4c2 : 0xffffff, 1).fillRoundedRect(-ancho / 2, -44, ancho, 88, 16);
        g.lineStyle(sel ? 6 : 3, sel ? COLOR.amarillo : 0xb8c4cf, 1).strokeRoundedRect(-ancho / 2, -44, ancho, 88, 16);
      };
      dibujar(false);
      const icono = scene.add.image(-ancho / 2 + 40, 0, 'ui_audioOn').setDisplaySize(40, 40).setTint(COLOR.azul);
      const t = scene.add.text(-ancho / 2 + 76, 0, op.fijo || voz.texto(op.id),
        estiloTexto(21, '#1f2d3a', { wordWrap: { width: ancho - 100 } })).setOrigin(0, 0.5);
      c.add([g, icono, t]);
      c.setSize(ancho, 88).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        sfx(scene, 'click', 0.3);
        elegida = op;
        tarjetas.forEach((tt) => tt.dibujar(tt.op === op));
        voz.decir(op.id);
        ok.setActivo(true);
      });
      c.dibujar = dibujar;
      c.op = op;
      objs.push(c);
      return c;
    });
    const ok = boton(scene, x, y0 + opciones.length * 108 + 10, {
      icono: 'ui_checkmark', texto: 'Elegir', ancho: 240, alto: 80, color: COLOR.verde,
      onClick: () => {
        if (!elegida) return;
        objs.forEach((o) => o.destroy());
        ok.destroy();
        resolve(elegida);
      },
    }).setDepth(100).setActivo(false);
  });
}

// Etapa 3: presentación con el supervisor (habilidades sociales).
export default class Supervisor extends Phaser.Scene {
  constructor() {
    super('Supervisor');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_tienda', 'SUPERMERCADO EL BARRIO');
    this.jefe = crearPersonaje(this, 1070, enPiso(), SUPERVISOR, ESCALA);
    this.yo = crearPersonaje(this, 210, enPiso(), estado.avatar, ESCALA);

    // El que habla se mueve un poco.
    this.alHablar = (id, texto, quien) => {
      const p = quien === 'jefe' ? this.jefe : quien === 'jugador' ? this.yo : null;
      if (p) this.tweens.add({ targets: p, y: p.y - 10, duration: 160, yoyo: true, repeat: 2 });
    };
    voz.on('linea', this.alHablar);
    this.events.once('shutdown', () => voz.off('linea', this.alHablar));

    this.conversar();
  }

  async conversar() {
    if (!(await voz.secuencia(['sup_llegada', 'sup_hola', 'elige_respuesta']))) return;

    // Pregunta 1: saludo
    for (;;) {
      const r = await elegirRespuesta(this, [
        { id: 'r1_bien', ok: true },
        { id: 'r1_mal1', ok: false },
        { id: 'r1_mal2', fijo: '(No digo nada y miro el celular)', ok: false },
      ]);
      if (!(await voz.decir(r.id))) return;
      marca(this, 640, 300, r.ok);
      sfx(this, r.ok ? 'bien' : 'error');
      if (r.ok) {
        if (!(await voz.decir('sup_r1_bien'))) return;
        break;
      }
      sumarError();
      if (!(await voz.secuencia([r.id === 'r1_mal1' ? 'sup_r1_mal1' : 'sup_r1_mal2', 'guia_saludo']))) return;
    }

    if (!(await voz.secuencia(['sup_funciones', 'sup_pregunta']))) return;

    // Pregunta 2: dudas / actitud
    for (;;) {
      const r = await elegirRespuesta(this, [
        { id: 'r2_bodega', ok: true },
        { id: 'r2_gracias', ok: true },
        { id: 'r2_mal', ok: false },
      ]);
      if (!(await voz.decir(r.id))) return;
      marca(this, 640, 300, r.ok);
      sfx(this, r.ok ? 'bien' : 'error');
      if (r.ok) {
        if (!(await voz.decir(r.id === 'r2_bodega' ? 'sup_r2_bodega' : 'sup_r2_gracias'))) return;
        break;
      }
      sumarError();
      if (!(await voz.secuencia(['sup_r2_mal', 'guia_respeto']))) return;
    }

    if (!(await voz.decir('sup_lista'))) return;
    siguiente(this);
  }
}
