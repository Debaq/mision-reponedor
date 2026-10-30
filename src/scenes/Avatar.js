import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoSala } from '../lib/fondos.js';
import { boton, flechaSiguiente, panel, sacudir } from '../lib/ui.js';
import { crearPersonaje, actualizarPersonaje, opcionesDe, PEINADOS, MUESTRA } from '../lib/personaje.js';
import { estado, nombreJugador, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { FLUJO, siguiente } from '../lib/flujo.js';
import { estrellasGuardadas } from '../lib/perfil.js';
import { CHALECOS } from '../lib/premios.js';

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
  ['chaleco', 'avatar_chaleco', 'Chaleco', (v, cfg, estrellas) => (estrellas < CHALECOS[v]
    ? { texto: `★ ${CHALECOS[v]}`, bloqueado: true }
    : { texto: { no: 'No', basico: 'Sí', estrella: 'Estrella', experto: 'Experto', plata: 'Plata', oro: 'Oro' }[v] })],
];

// Columnas del editor según el modo.
const FILAS_TU = FILAS.slice(0, 5);
const FILAS_CALLE = [FILAS[5], FILAS[7]];
const FILAS_TRABAJO = FILAS.slice(5);
// Ropa de calle con la que se crea el personaje (en "trabajo" hay que cambiarla por la adecuada).
const CALLE = { chaleco: 'no', pantalonLargo: 'shorter', poleraColor: 'red', pantalonColor: 'LightBlue', manga: 'short' };

// Editor del personaje, en dos momentos:
// - modo 'personaje' (al empezar): nombre, cómo te identificas, físico y ropa de calle.
// - modo 'trabajo' (después del contrato): elegir la ropa adecuada para trabajar (se valida).
export default class Avatar extends Phaser.Scene {
  constructor() {
    super('Avatar');
  }

  init(datos) {
    this.modo = datos.modo || 'personaje';
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoSala(this);
    const trabajo = this.modo === 'trabajo';
    // Sin chaleco al empezar: en "trabajo" hay que ponérselo.
    this.cfg = estado.nombre ? { ...estado.avatar, chaleco: 'no' } : { ...estado.avatar, ...CALLE };

    panel(this, 250, 360, 380, 520, 0xffffff, 24);
    this.muneco = crearPersonaje(this, 250, 420, this.cfg, 0.5);

    // (Phaser reutiliza la escena: se limpian las filas de la vez anterior antes de refrescarlas.)
    this.valores = {};
    this.estrellas = 0;
    this.iconoEstrellas = this.add.image(220, 212, 'ui_star').setTint(COLOR.amarillo).setDisplaySize(30, 30);
    this.txtEstrellas = this.add.text(240, 212, '', estiloTexto(24, '#b7791f')).setOrigin(0, 0.5);
    const mostrarEstrellas = (nombre) => {
      this.estrellas = nombre ? estrellasGuardadas(nombre) : 0;
      this.txtEstrellas.setText(String(this.estrellas));
      this.iconoEstrellas.setVisible(this.estrellas > 0);
      this.txtEstrellas.setVisible(this.estrellas > 0);
      if (this.valores.chaleco) this.refrescarFila('chaleco');
    };

    if (trabajo) {
      // Nombre fijo; las estrellas guardadas desbloquean chalecos.
      this.add.text(250, 150, nombreJugador(), estiloTexto(30, '#553c9a')).setOrigin(0.5);
      mostrarEstrellas(estado.nombre);
      this.add.text(800, 70, 'ROPA DE TRABAJO', estiloTexto(26, '#553c9a')).setOrigin(0.5);
      FILAS_TRABAJO.forEach((fila, i) => this.crearFila(800, 125 + i * 80, fila));
      this.listo = flechaSiguiente(this, () => this.validarTrabajo());
      voz.decir(FLUJO[estado.paso]?.turno === 2 ? 'vestir_t2' : 'vestir_intro');
      return;
    }

    // Nombre
    this.add.text(250, 118, 'Tu nombre', estiloTexto(24, '#553c9a')).setOrigin(0.5);
    this.input_ = this.add.dom(250, 162).createFromHTML('<input class="nombre" maxlength="14" placeholder="Nombre" autocomplete="off">');
    this.input_.setScale(0.8);
    const campo = this.input_.node.querySelector('input');
    campo.value = estado.nombre;
    campo.addEventListener('focus', () => voz.decir('avatar_nombre'));
    campo.addEventListener('keydown', (e) => e.stopPropagation());
    campo.addEventListener('input', () => mostrarEstrellas(campo.value.trim()));
    mostrarEstrellas(campo.value.trim());

    this.add.text(640, 72, 'TÚ', estiloTexto(26, '#553c9a')).setOrigin(0.5);
    FILAS_TU.forEach((fila, i) => this.crearFila(640, 125 + i * 82, fila));
    this.add.text(1010, 72, 'TU ROPA', estiloTexto(26, '#553c9a')).setOrigin(0.5);
    FILAS_CALLE.forEach((fila, i) => this.crearFila(1010, 125 + i * 82, fila));

    this.listo = flechaSiguiente(this, () => this.validarPersonaje(campo));
    voz.secuencia(['avatar_intro', 'avatar_nombre']);
  }

  crearFila(x, y, [clave, linea, etiqueta, mostrar]) {
    panel(this, x, y, 350, 74, 0xffffff, 14);
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
      if (clave === 'chaleco' && this.bloqueado()) voz.decir('avatar_bloqueado');
    };
    // Flechas grandes: en celular deben quedar de ~40 px para tocarlas fácil.
    boton(this, x - 132, y, { icono: 'ui_left', ancho: 74, alto: 66, color: COLOR.azul, onClick: () => cambiar(-1) });
    boton(this, x + 94, y, { icono: 'ui_right', ancho: 74, alto: 66, color: COLOR.azul, onClick: () => cambiar(1) });
    this.add.image(x + 152, y, 'ui_audioOn').setDisplaySize(28, 28).setTint(0x2b6cb0)
      .setInteractive({ useHandCursor: true }).on('pointerup', () => voz.decir(linea));
  }

  refrescarFila(clave) {
    const { muestra, valor, mostrar } = this.valores[clave];
    const m = mostrar(this.cfg[clave], this.cfg, this.estrellas);
    muestra.setVisible(m.color !== undefined);
    if (m.color !== undefined) muestra.setFillStyle(m.color);
    valor.setText(m.texto || '').setColor(m.bloqueado ? '#c53030' : '#1f2d3a');
  }

  bloqueado() {
    return this.estrellas < CHALECOS[this.cfg.chaleco];
  }

  async validarPersonaje(campo) {
    const nombre = campo.value.trim();
    if (!nombre) {
      sacudir(this, this.muneco);
      voz.decir('avatar_falta_nombre');
      return;
    }
    estado.nombre = nombre;
    estado.avatar = { ...this.cfg };
    estado.estrellasInicio = estrellasGuardadas(nombre);
    this.listo.setActivo(false);
    sfx(this, 'logro');
    this.tweens.add({ targets: this.muneco, scale: 0.56, duration: 250, yoyo: true });
    await voz.decir('personaje_listo');
    siguiente(this);
  }

  async validarTrabajo() {
    // Chaleco aún bloqueado: no es un error de vestimenta, solo se avisa.
    if (this.bloqueado()) {
      sacudir(this, this.muneco);
      voz.decir('avatar_bloqueado');
      return;
    }
    const errores = [];
    if (this.cfg.pantalonLargo !== 'long') errores.push('avatar_mal_short');
    if (this.cfg.chaleco === 'no') errores.push('avatar_mal_chaleco');
    if (errores.length) {
      sfx(this, 'error');
      sumarError();
      sacudir(this, this.muneco);
      voz.secuencia(errores);
      return;
    }
    estado.avatar = { ...this.cfg };
    this.listo.setActivo(false);
    sfx(this, 'logro');
    this.tweens.add({ targets: this.muneco, scale: 0.56, duration: 250, yoyo: true });
    await voz.decir('avatar_bien');
    siguiente(this);
  }
}
