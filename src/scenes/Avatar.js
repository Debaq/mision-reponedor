import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoSala } from '../lib/fondos.js';
import { boton, flechaSiguiente, panel, sacudir } from '../lib/ui.js';
import { crearPersonaje, actualizarPersonaje, opcionesDe, PEINADOS, MUESTRA } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';

const COLORES_ROPA = {
  white: 0xf5f5f5, blue: 0x3498db, navy: 0x34495e, grey: 0x95a5a6, red: 0xe05a47, green: 0x4caf50, pine: 0x2e7d6b,
  yellow: 0xf4c430, Navy: 0x34495e, Grey: 0x8e9aa5, Brown: 0x8b5e3c, Blue1: 0x3b6fb6, LightBlue: 0x6ec6d9,
  Tan: 0xc9a27e, Red: 0xc0392b, Green: 0x4caf50, black: 0x3a3f3a, brown: 0xb08d57, brown2: 0x7a5232, tan: 0xd2b48c,
};

// Filas del editor: [clave del avatar, línea de voz, etiqueta, cómo mostrar el valor]
const FILAS = [
  ['genero', 'avatar_genero', 'Soy', (v) => ({ texto: { hombre: 'Hombre', mujer: 'Mujer', nobinario: 'No binario' }[v] })],
  ['piel', 'avatar_piel', 'Piel', (v) => ({ color: MUESTRA.piel[v] })],
  ['peinado', 'avatar_peinado', 'Peinado', (v, cfg) => ({ texto: String(opcionesDe('peinado', cfg).indexOf(v) + 1) })],
  ['colorPelo', 'avatar_colorpelo', 'Color de pelo', (v) => ({ color: MUESTRA.colorPelo[v] })],
  ['cara', 'avatar_cara', 'Cara', (v) => ({ texto: String(v) })],
  ['poleraColor', 'avatar_polera', 'Polera', (v) => ({ color: COLORES_ROPA[v] })],
  ['manga', 'avatar_polera', 'Manga', (v) => ({ texto: v === 'short' ? 'Corta' : 'Larga' })],
  ['pantalonColor', 'avatar_pantalon', 'Pantalón', (v) => ({ color: COLORES_ROPA[v] })],
  ['pantalonLargo', 'avatar_pantalon', 'Largo', (v) => ({ texto: v === 'long' ? 'Largo' : 'Short' })],
  ['zapatos', 'avatar_zapatos', 'Zapatos', (v) => ({ color: COLORES_ROPA[v] })],
  ['chaleco', 'avatar_chaleco', 'Chaleco', (v) => ({ texto: v ? 'Sí' : 'No' })],
];

export default class Avatar extends Phaser.Scene {
  constructor() {
    super('Avatar');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoSala(this);
    // Empieza con ropa "de calle" para que el jugador elija la adecuada.
    this.cfg = { ...estado.avatar, chaleco: false, pantalonLargo: 'shorter', poleraColor: 'red', pantalonColor: 'LightBlue' };
    if (estado.nombre) Object.assign(this.cfg, estado.avatar);

    panel(this, 250, 360, 380, 520, 0xffffff, 24);
    this.muneco = crearPersonaje(this, 250, 420, this.cfg, 0.5);

    // Nombre
    this.add.text(250, 118, 'Tu nombre', estiloTexto(24, '#553c9a')).setOrigin(0.5);
    this.input_ = this.add.dom(250, 162).createFromHTML('<input class="nombre" maxlength="14" placeholder="Nombre" autocomplete="off">');
    this.input_.setScale(0.8);
    const campo = this.input_.node.querySelector('input');
    campo.value = estado.nombre;
    campo.addEventListener('focus', () => voz.decir('avatar_nombre'));
    campo.addEventListener('keydown', (e) => e.stopPropagation());

    // Filas de opciones
    this.valores = {};
    FILAS.forEach((fila, i) => {
      const col = i < 5 ? 0 : 1;
      const n = col === 0 ? i : i - 5;
      const x = col === 0 ? 640 : 1010;
      const y = (col === 0 ? 125 : 115) + n * 82;
      this.crearFila(x, y, fila);
    });
    this.add.text(640, 72, 'TÚ', estiloTexto(26, '#553c9a')).setOrigin(0.5);
    this.add.text(1010, 70, 'ROPA DE TRABAJO', estiloTexto(22, '#553c9a')).setOrigin(0.5).setDepth(1);

    this.listo = flechaSiguiente(this, () => this.validar(campo));
    voz.secuencia(['avatar_intro', 'avatar_nombre']);
  }

  crearFila(x, y, [clave, linea, etiqueta, mostrar]) {
    panel(this, x, y, 340, 70, 0xffffff, 14);
    // Etiqueta: al tocarla se escucha.
    const lbl = this.add.text(x - 30, y - 16, etiqueta, estiloTexto(19, '#4a5568')).setOrigin(0.5).setInteractive({ useHandCursor: true });
    lbl.on('pointerup', () => voz.decir(linea));
    const muestra = this.add.circle(x - 30, y + 14, 14, 0xffffff).setStrokeStyle(3, 0x1f2d3a);
    const valor = this.add.text(x - 30, y + 14, '', estiloTexto(22)).setOrigin(0.5);
    this.valores[clave] = { muestra, valor, mostrar };
    this.refrescarFila(clave);

    const cambiar = (d) => {
      const ops = opcionesDe(clave, this.cfg);
      const i = ops.indexOf(this.cfg[clave]);
      this.cfg[clave] = ops[(i + d + ops.length) % ops.length];
      if (clave === 'genero') {
        if (this.cfg.genero !== 'nobinario') this.cfg.peinado = PEINADOS[this.cfg.genero][0];
        this.refrescarFila('peinado');
        voz.decir('gen_' + this.cfg.genero);
      }
      actualizarPersonaje(this, this.muneco, this.cfg);
      this.refrescarFila(clave);
    };
    boton(this, x - 132, y, { icono: 'ui_left', ancho: 64, alto: 56, color: COLOR.azul, onClick: () => cambiar(-1) });
    boton(this, x + 92, y, { icono: 'ui_right', ancho: 64, alto: 56, color: COLOR.azul, onClick: () => cambiar(1) });
    this.add.image(x + 145, y, 'ui_audioOn').setDisplaySize(30, 30).setTint(0x2b6cb0)
      .setInteractive({ useHandCursor: true }).on('pointerup', () => voz.decir(linea));
  }

  refrescarFila(clave) {
    const { muestra, valor, mostrar } = this.valores[clave];
    const m = mostrar(this.cfg[clave], this.cfg);
    muestra.setVisible(m.color !== undefined);
    if (m.color !== undefined) muestra.setFillStyle(m.color);
    valor.setText(m.texto || '');
  }

  async validar(campo) {
    const nombre = campo.value.trim();
    const errores = [];
    if (!nombre) errores.push('avatar_falta_nombre');
    if (this.cfg.pantalonLargo !== 'long') errores.push('avatar_mal_short');
    if (!this.cfg.chaleco) errores.push('avatar_mal_chaleco');
    if (errores.length) {
      sfx(this, 'error');
      sumarError('avatar');
      sacudir(this, this.muneco);
      voz.secuencia(errores);
      return;
    }
    estado.nombre = nombre;
    estado.avatar = { ...this.cfg };
    this.listo.setActivo(false);
    sfx(this, 'logro');
    this.tweens.add({ targets: this.muneco, scale: 0.56, duration: 250, yoyo: true });
    await voz.decir('avatar_bien');
    siguiente(this);
  }
}
