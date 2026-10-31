import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoRender } from '../lib/fondos.js';
import { boton, marca, panel, sacudir } from '../lib/ui.js';
import { basurero, herramienta } from '../lib/objetos.js';
import { etiquetaPrecio } from '../lib/gondola.js';
import { crearPersonaje, SUPERVISOR, enPiso, ESCALA } from '../lib/personaje.js';
import { estado } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { FLUJO, irA, siguiente } from '../lib/flujo.js';

const TAREAS = {
  derrame: { escena: 'Derrame', nombre: 'Derrame' },
  basura: { escena: 'Basura', nombre: 'Basura' },
  vencidos: { escena: 'Vencidos', nombre: 'Vencidos' },
  precios: { escena: 'Precios', nombre: 'Precios' },
  faltantes: { escena: 'Faltantes', nombre: 'Faltantes' },
};
const PUESTOS = { 2: [575, 825], 3: [450, 700, 950] };
const Y_TARJETA = 320;

// Instrucciones consecutivas: el supervisor encarga dos o tres tareas (datos.tareas; con datos.elegir,
// solo esa cantidad al azar) en un orden al azar y el jugador debe elegirlas en ese orden.
// Después de cada tarea se vuelve a este tablero.
export default class Ordenes extends Phaser.Scene {
  constructor() {
    super('Ordenes');
  }

  create(data) {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_tienda', 'SUPERMERCADO EL BARRIO');
    this.jefe = crearPersonaje(this, 160, enPiso(), SUPERVISOR, ESCALA);
    this.alHablar = (id, texto, quien) => {
      if (quien === 'jefe') this.tweens.add({ targets: this.jefe, y: this.jefe.y - 8, duration: 160, yoyo: true, repeat: 2 });
    };
    voz.on('linea', this.alHablar);
    this.events.once('shutdown', () => voz.off('linea', this.alHablar));

    // Pizarra de tareas
    panel(this, 700, 330, 820, 400, 0x2d3e4e, 22);
    panel(this, 700, 330, 796, 376, 0x3b5266, 18, false);

    this.repetir = boton(this, 160, 128, {
      icono: 'ui_audioOn', texto: 'Repetir', ancho: 220, alto: 76, tam: 26, color: COLOR.marca,
      onClick: () => this.elegible && this.explicar(false),
    });

    const bloque = FLUJO[estado.paso].id;
    if (!data.volver || estado.ordenes?.bloque !== bloque) {
      const lista = Phaser.Utils.Array.Shuffle([...data.tareas]).slice(0, data.elegir || data.tareas.length);
      estado.ordenes = { bloque, lista, hechas: 0, errores: 0 };
    }
    this.bloque = bloque;
    this.puestos = PUESTOS[estado.ordenes.lista.length];
    this.erroresEleccion = 0;
    this.tarjetas = {};
    for (const id of estado.ordenes.lista) this.tarjetas[id] = this.crearTarjeta(id);

    const o = estado.ordenes;
    if (o.hechas === 0 && !data.volver) {
      this.ubicar(false);
      this.explicar(true);
    } else if (o.hechas >= o.lista.length) {
      this.ubicar(false);
      this.terminar();
    } else {
      this.ubicar(true, false);
      this.elegir('orden_sigue');
    }
  }

  crearTarjeta(id) {
    const c = this.add.container(this.puestos[0], Y_TARJETA);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-104, -124, 208, 260, 18);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-104, -130, 208, 260, 18);
    c.add(g);
    c.add(this.dibujoTarea(id));
    c.add(this.add.text(0, 100, TAREAS[id].nombre, estiloTexto(24)).setOrigin(0.5));

    // Número (orden) y check (hecha)
    const num = this.add.container(-80, -106);
    num.add([this.add.circle(0, 0, 30, COLOR.marca).setStrokeStyle(4, 0xffffff), this.add.text(0, 0, '', estiloTexto(32, '#ffffff')).setOrigin(0.5)]);
    c.add(num);
    const check = this.add.container(78, -104);
    check.add([this.add.circle(0, 0, 28, COLOR.verdeClaro), this.add.image(0, 0, 'ui_checkmark').setDisplaySize(36, 36)]);
    c.add(check);
    c.num = num;
    c.check = check;
    c.tarea = id;

    c.setSize(208, 260).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.tocar(c));
    return c;
  }

  // Dibujo de cada tarea (sin texto, para quien no lee).
  dibujoTarea(id) {
    const d = this.add.container(0, -14);
    if (id === 'derrame') {
      const g = this.add.graphics();
      g.fillStyle(0x9c4221, 0.75).fillEllipse(-10, 40, 150, 46).fillEllipse(-60, 50, 60, 24);
      d.add([g, this.add.image(55, 20, 'prod_bebida').setDisplaySize(56, 56).setAngle(95),
        herramienta(this, -30, -10, 'trapero').setScale(0.55).setAngle(-20)]);
    } else if (id === 'basura') {
      d.add([basurero(this, 20, 10).setScale(0.75),
        this.add.image(-52, 46, 'basura_lata').setDisplaySize(44, 44).setAngle(-30),
        this.add.image(-48, -10, 'basura_envoltorio').setDisplaySize(40, 40)]);
    } else if (id === 'precios') {
      const oferta = this.add.graphics();
      oferta.fillStyle(COLOR.rojo, 1).fillRoundedRect(-70, -70, 140, 50, 10);
      d.add([oferta, this.add.text(0, -45, 'OFERTA', estiloTexto(22, '#ffffff')).setOrigin(0.5),
        etiquetaPrecio(this, 0, 20, 'cloro', '$990', true).setScale(1.2)]);
    } else if (id === 'faltantes') {
      const g = this.add.graphics();
      g.fillStyle(0xdfe6ec, 1).fillRect(-80, -60, 160, 110);
      g.fillStyle(0x8795a1, 1).fillRect(-86, -6, 172, 8).fillRect(-86, 50, 172, 8);
      g.lineStyle(3, COLOR.rojo, 1).strokeCircle(40, -30, 26).strokeCircle(40, 26, 26);
      d.add([g, ...[-50, -10].flatMap((x) => [this.add.image(x, -30, 'prod_jugo').setDisplaySize(40, 40), this.add.image(x, 26, 'prod_jugo').setDisplaySize(40, 40)])]);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillRoundedRect(8, -62, 76, 80, 10);
      g.lineStyle(3, 0x1f2d3a, 1).strokeRoundedRect(8, -62, 76, 80, 10);
      g.fillStyle(COLOR.rojo, 1).fillRoundedRect(8, -62, 76, 24, { tl: 10, tr: 10, bl: 0, br: 0 });
      d.add([this.add.image(-36, 14, 'prod_leche').setDisplaySize(96, 96), g,
        this.add.text(46, -50, 'HOY', estiloTexto(14, '#ffffff')).setOrigin(0.5),
        this.add.text(46, -6, '15', estiloTexto(30)).setOrigin(0.5)]);
    }
    return d;
  }

  // Coloca las tarjetas: en orden con su número (explicación) o mezcladas (para elegir).
  ubicar(mezclar, animar = true) {
    const o = estado.ordenes;
    let puestos = o.lista.map((_, i) => i);
    if (mezclar) {
      // Que el orden en pantalla no coincida con el pedido (si no, se adivina de izquierda a derecha).
      do Phaser.Utils.Array.Shuffle(puestos); while (puestos.every((p, i) => p === i));
    }
    o.lista.forEach((id, i) => {
      const t = this.tarjetas[id];
      const x = this.puestos[puestos[i]];
      if (animar) this.tweens.add({ targets: t, x, duration: 500, ease: 'Sine.easeInOut' });
      else t.x = x;
      const hecha = i < o.hechas;
      t.num.list[1].setText(String(i + 1));
      t.num.setVisible(!mezclar || hecha);
      t.check.setVisible(hecha);
      t.setAlpha(hecha && mezclar ? 0.6 : 1);
    });
  }

  async explicar(primera) {
    this.elegible = false;
    this.repetir.setActivo(false);
    this.ubicar(false);
    const o = estado.ordenes;
    if (primera && !(await voz.decir(o.lista.length === 2 ? 'orden_intro_2' : 'orden_intro'))) return;
    for (let i = 0; i < o.lista.length; i++) {
      const t = this.tarjetas[o.lista[i]];
      this.tweens.add({ targets: t, scale: 1.1, duration: 250, yoyo: true, repeat: 1 });
      if (!(await voz.secuencia(['ord_' + (i + 1), 'tarea_' + o.lista[i]]))) return;
    }
    await new Promise((r) => this.time.delayedCall(400, r));
    this.ubicar(true);
    await new Promise((r) => this.time.delayedCall(600, r));
    this.elegir(o.hechas === 0 ? 'orden_elige' : 'orden_sigue');
  }

  elegir(linea) {
    this.elegible = true;
    this.repetir.setActivo(true);
    voz.decir(linea);
  }

  async tocar(t) {
    sfx(this, 'click', 0.3);
    const o = estado.ordenes;
    const i = o.lista.indexOf(t.tarea);
    if (!this.elegible) {
      voz.decir('tarea_' + t.tarea);
      return;
    }
    if (i < o.hechas) {
      voz.decir('orden_hecha');
      return;
    }
    if (i !== o.hechas) {
      o.errores++;
      this.erroresEleccion++;
      sfx(this, 'error');
      sacudir(this, t);
      // Al segundo error seguido se le recuerda cuál es.
      const ayuda = this.erroresEleccion >= 2 ? ['ord_' + (o.hechas + 1), 'tarea_' + o.lista[o.hechas]] : [];
      if (ayuda.length) this.tweens.add({ targets: this.tarjetas[o.lista[o.hechas]], scale: 1.1, duration: 250, yoyo: true, repeat: 3 });
      voz.secuencia(['orden_mal', ...ayuda]);
      return;
    }
    this.elegible = false;
    this.repetir.setActivo(false);
    sfx(this, 'bien');
    marca(this, t.x, Y_TARJETA - 170, true);
    t.num.setVisible(true);
    this.tweens.add({ targets: t, scale: 1.12, duration: 200, yoyo: true });
    if (!(await voz.decir('tarea_' + t.tarea))) return;
    irA(this, FLUJO.findIndex((p) => p.escena === TAREAS[t.tarea].escena && p.enOrden === this.bloque));
  }

  async terminar() {
    this.repetir.setVisible(false);
    sfx(this, 'logro');
    if (!(await voz.decir(estado.ordenes.lista.length === 2 ? 'orden_listo_2' : 'orden_listo'))) return;
    estado.erroresPaso = estado.ordenes.errores;
    estado.ordenes = null;
    siguiente(this);
  }
}
