import Phaser from 'phaser';
import { ANCHO, ALTO, COLOR, estiloTexto } from '../lib/estilo.js';
import { boton, flechaSiguiente, panel, sacudir } from '../lib/ui.js';
import { crearPersonaje, actualizarPersonaje, opcionesDe, PEINADOS, centroParte, enPiso, ESCALA, imagenCapa } from '../lib/personaje.js';
import { estado, nombreJugador, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { FLUJO, siguiente } from '../lib/flujo.js';
import { estrellasGuardadas } from '../lib/perfil.js';
import { CHALECOS } from '../lib/premios.js';
import { sombraPuntos } from '../lib/sombras.js';

// Categorías del editor: voz, nombre, parte que se ve en la miniatura e ícono de la pestaña.
// Ícono: capa del atlas del personaje y su color.
const CATEGORIAS = {
  genero: { voz: 'avatar_genero', nombre: 'Soy', parte: 'cabeza', icono: ['pelo_largo', 0x6b4423] },
  piel: { voz: 'avatar_piel', nombre: 'Piel', parte: 'cabeza', icono: ['piel', 0xc68642] },
  peinado: { voz: 'avatar_peinado', nombre: 'Peinado', parte: 'cabeza', icono: ['pelo_corto', 0x2b2b2b] },
  colorPelo: { voz: 'avatar_colorpelo', nombre: 'Color pelo', parte: 'cabeza', icono: ['pelo_rulos', 0xc0502e] },
  poleraColor: { voz: 'avatar_polera', nombre: 'Polera', parte: 'torso', icono: ['polera_corta', 0x3498db] },
  manga: { voz: 'avatar_polera', nombre: 'Manga', parte: 'torso', icono: ['polera_larga', 0x3498db] },
  pantalonColor: { voz: 'avatar_pantalon', nombre: 'Pantalón', parte: 'piernas', icono: ['pantalon_largo', 0x2c3e66] },
  pantalonLargo: { voz: 'avatar_pantalon', nombre: 'Largo', parte: 'piernas', icono: ['pantalon_corto', 0x2c3e66] },
  zapatos: { voz: 'avatar_zapatos', nombre: 'Zapatos', parte: 'pies', icono: ['zapatos', 0x3a3f3a] },
  chaleco: { voz: 'avatar_chaleco', nombre: 'Chaleco', parte: 'torso', icono: ['chaleco_basico'] },
};
const MODOS = {
  personaje: ['genero', 'piel', 'peinado', 'colorPelo', 'poleraColor', 'pantalonColor'],
  trabajo: ['poleraColor', 'manga', 'pantalonColor', 'pantalonLargo', 'zapatos', 'chaleco'],
};
// Ropa de calle con la que se crea el personaje (en "trabajo" hay que cambiarla por la adecuada).
const CALLE = { chaleco: 'no', pantalonLargo: 'shorter', poleraColor: 'red', pantalonColor: 'LightBlue', manga: 'short' };
const NOMBRE_GENERO = { hombre: 'Hombre', mujer: 'Mujer', nobinario: 'No binario' };
// Escala de la miniatura según la parte del cuerpo que muestra.
const ESCALA_PARTE = { cabeza: 1.05, torso: 0.5, piernas: 0.36, pies: 0.9 };

const PANEL = { x: 30, y: 72, ancho: 640, alto: 530 };
const GRILLA = { x0: 125, y0: 296, cols: 4, paso: 150, tam: 132 };
const POR_PAGINA = 8;

// Editor del personaje por pestañas y grilla (como la referencia del documento), en dos momentos:
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
    this.add.image(0, 0, 'esc_habitacion').setOrigin(0).setDisplaySize(ANCHO, ALTO);
    const trabajo = this.modo === 'trabajo';
    // Sin chaleco al empezar: en "trabajo" hay que ponérselo.
    this.cfg = estado.nombre ? { ...estado.avatar, chaleco: 'no' } : { ...estado.avatar, ...CALLE };
    this.categorias = MODOS[this.modo];
    this.categoria = this.categorias[0];
    this.pagina = 0;
    this.estrellas = 0;
    // (Phaser reutiliza la escena: se limpian las referencias de la vez anterior.)
    this.tarjetas = [];
    this.pestanas = {};

    this.crearPasos(trabajo ? 3 : 1);
    this.muneco = crearPersonaje(this, 960, enPiso(), this.cfg, ESCALA);

    // Panel con pestañas, grilla y páginas
    panel(this, PANEL.x + PANEL.ancho / 2, PANEL.y + PANEL.alto / 2, PANEL.ancho, PANEL.alto, 0xffffff, 22);
    this.add.graphics().fillStyle(0x3182ce, 1).fillRoundedRect(PANEL.x, PANEL.y, PANEL.ancho, 46, { tl: 22, tr: 22, bl: 0, br: 0 });
    this.add.text(PANEL.x + 24, PANEL.y + 23, trabajo ? 'ROPA DE TRABAJO' : 'TU PERSONAJE', estiloTexto(22, '#ffffff')).setOrigin(0, 0.5);
    this.categorias.forEach((cat, i) => this.crearPestana(cat, PANEL.x + 56 + i * 86, PANEL.y + 104));
    const yPag = PANEL.y + PANEL.alto - 36;
    this.flechaAtras = boton(this, PANEL.x + 80, yPag, { icono: 'ui_left', ancho: 120, alto: 54, color: 0x3182ce, onClick: () => this.cambiarPagina(-1) });
    this.flechaAdelante = boton(this, PANEL.x + PANEL.ancho - 80, yPag, { icono: 'ui_right', ancho: 120, alto: 54, color: 0x3182ce, onClick: () => this.cambiarPagina(1) });
    this.txtPagina = this.add.text(PANEL.x + PANEL.ancho / 2, yPag, '', estiloTexto(20, '#4a5568')).setOrigin(0.5);

    // Nombre y estrellas guardadas (desbloquean chalecos), sobre el personaje
    this.iconoEstrellas = this.add.image(915, 212, 'ui_star').setTint(COLOR.amarillo).setDisplaySize(32, 32).setVisible(false);
    this.txtEstrellas = this.add.text(937, 212, '', estiloTexto(26, '#b7791f', { stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0, 0.5);
    const mostrarEstrellas = (nombre) => {
      this.estrellas = nombre ? estrellasGuardadas(nombre) : 0;
      this.txtEstrellas.setText(this.estrellas ? String(this.estrellas) : '');
      this.iconoEstrellas.setVisible(this.estrellas > 0);
      if (this.categoria === 'chaleco') this.mostrarTarjetas();
    };
    if (trabajo) {
      this.add.text(960, 165, nombreJugador(), estiloTexto(30, '#553c9a', { backgroundColor: '#ffffff', padding: { x: 18, y: 6 } })).setOrigin(0.5);
      mostrarEstrellas(estado.nombre);
      this.listo = flechaSiguiente(this, () => this.validarTrabajo());
      voz.decir(FLUJO[estado.paso]?.turno === 2 ? 'vestir_t2' : 'vestir_intro');
    } else {
      this.input_ = this.add.dom(960, 165).createFromHTML('<input class="nombre" maxlength="14" placeholder="Tu nombre" autocomplete="off">');
      this.input_.setScale(0.8);
      const campo = this.input_.node.querySelector('input');
      campo.value = estado.nombre;
      campo.addEventListener('focus', () => voz.decir('avatar_nombre'));
      campo.addEventListener('keydown', (e) => e.stopPropagation());
      campo.addEventListener('input', () => mostrarEstrellas(campo.value.trim()));
      mostrarEstrellas(campo.value.trim());
      this.listo = flechaSiguiente(this, () => this.validarPersonaje(campo));
      voz.secuencia(['avatar_intro', 'avatar_nombre']);
    }
    this.elegirCategoria(this.categoria, false);
  }

  // Pasos del proceso (como la referencia): 1. Personaje → 2. Contrato → 3. Ropa de trabajo.
  crearPasos(actual) {
    ['Personaje', 'Contrato', 'Ropa de trabajo'].forEach((t, i) => {
      const x = 700 + i * 186;
      const flecha = (dx, dy) => [[0, 76], [167, 76], [185, 100], [167, 124], [0, 124], [18, 100]].map(([px, py]) => ({ x: x + px + dx, y: py + dy }));
      const color = i + 1 === actual ? 0xed8936 : i + 1 < actual ? 0x48bb78 : 0x2b6cb0;
      const g = this.add.graphics();
      sombraPuntos(g, flecha(2, 6), 0.24, 10);
      g.fillStyle(color, 1).fillPoints(flecha(0, 0), true);
      this.add.text(x + 96, 100, `${i + 1}. ${t}`, estiloTexto(17, '#ffffff')).setOrigin(0.5);
    });
  }

  crearPestana(cat, x, y) {
    const c = this.add.container(x, y);
    const fondo = this.add.graphics();
    const [capa, tinte] = CATEGORIAS[cat].icono;
    const img = imagenCapa(this, 0, -8, capa, 50, tinte);
    c.add([fondo, img, this.add.text(0, 30, CATEGORIAS[cat].nombre, estiloTexto(13, '#2d3748')).setOrigin(0.5)]);
    c.setSize(78, 84).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.elegirCategoria(cat, true));
    c.dibujar = (activa) => {
      fondo.clear();
      fondo.fillStyle(activa ? 0x9ae6b4 : 0xebf4ff, 1).fillRoundedRect(-39, -42, 78, 84, 14);
      fondo.lineStyle(activa ? 4 : 2, activa ? 0x2f855a : 0x90cdf4, 1).strokeRoundedRect(-39, -42, 78, 84, 14);
    };
    this.pestanas[cat] = c;
  }

  elegirCategoria(cat, hablar) {
    this.categoria = cat;
    this.pagina = Math.floor(Math.max(0, this.opciones().indexOf(this.cfg[cat])) / POR_PAGINA);
    for (const [k, p] of Object.entries(this.pestanas)) p.dibujar(k === cat);
    if (hablar) {
      sfx(this, 'click', 0.3);
      voz.decir(CATEGORIAS[cat].voz);
    }
    this.mostrarTarjetas();
  }

  opciones() {
    return opcionesDe(this.categoria, this.cfg);
  }

  cambiarPagina(d) {
    const paginas = Math.ceil(this.opciones().length / POR_PAGINA);
    this.pagina = (this.pagina + d + paginas) % paginas;
    this.mostrarTarjetas();
  }

  // Grilla de tarjetas: cada una muestra cómo se vería esa opción en el personaje.
  mostrarTarjetas() {
    for (const t of this.tarjetas) t.destroy();
    this.tarjetas = [];
    const ops = this.opciones();
    const paginas = Math.ceil(ops.length / POR_PAGINA);
    ops.slice(this.pagina * POR_PAGINA, (this.pagina + 1) * POR_PAGINA).forEach((v, i) => {
      const x = GRILLA.x0 + (i % GRILLA.cols) * GRILLA.paso;
      const y = GRILLA.y0 + Math.floor(i / GRILLA.cols) * GRILLA.paso;
      this.tarjetas.push(this.crearTarjeta(v, x, y));
    });
    this.flechaAtras.setVisible(paginas > 1);
    this.flechaAdelante.setVisible(paginas > 1);
    this.txtPagina.setText(paginas > 1 ? `${this.pagina + 1} / ${paginas}` : '');
  }

  // Tarjeta en tres capas: fondo, miniatura del personaje (recortada a la tarjeta) y encima borde y marcas.
  crearTarjeta(valor, x, y) {
    const cat = this.categoria;
    const { tam } = GRILLA;
    const elegida = this.cfg[cat] === valor;
    const bloqueada = cat === 'chaleco' && this.estrellas < CHALECOS[valor];

    const fondo = this.add.graphics().setDepth(1);
    fondo.fillStyle(0xf7fafc, 1).fillRoundedRect(x - tam / 2, y - tam / 2, tam, tam, 14);

    const parte = CATEGORIAS[cat].parte;
    const escala = ESCALA_PARTE[parte];
    const prueba = { ...this.cfg, [cat]: valor };
    if (cat === 'genero' && valor !== 'nobinario') prueba.peinado = PEINADOS[valor][0];
    const dy = cat === 'genero' ? -12 : 0;
    const mini = crearPersonaje(this, x, y - centroParte(this, prueba.genero, parte) * escala + dy, prueba, escala, { vida: false }).setDepth(2);
    const mascara = this.make.graphics({ add: false }).fillRect(x - tam / 2 + 3, y - tam / 2 + 3, tam - 6, tam - 6);
    mini.setMask(mascara.createGeometryMask());

    const c = this.add.container(x, y).setDepth(3);
    if (cat === 'genero') c.add(this.add.text(0, tam / 2 - 18, NOMBRE_GENERO[valor], estiloTexto(16, '#2d3748', { backgroundColor: '#ffffffdd', padding: { x: 6, y: 2 } })).setOrigin(0.5));
    if (cat === 'chaleco' && valor === 'no') {
      c.add([this.add.circle(-tam / 2 + 22, tam / 2 - 22, 18, 0xffffff).setStrokeStyle(3, COLOR.rojo),
        this.add.image(-tam / 2 + 22, tam / 2 - 22, 'ui_cross').setDisplaySize(24, 24).setTint(COLOR.rojo)]);
    }
    const borde = this.add.graphics();
    if (bloqueada) {
      borde.fillStyle(0x1a202c, 0.55).fillRoundedRect(-tam / 2, -tam / 2, tam, tam, 14);
      candado(borde, 0, -12);
    }
    borde.lineStyle(elegida ? 6 : 3, elegida ? 0x38a169 : 0xcbd5e0, 1).strokeRoundedRect(-tam / 2, -tam / 2, tam, tam, 14);
    c.add(borde);
    if (bloqueada) c.add(this.add.text(0, 40, `★ ${CHALECOS[valor]}`, estiloTexto(20, '#f6c343')).setOrigin(0.5));
    if (elegida) c.add(this.add.image(tam / 2 - 18, -tam / 2 + 18, 'ui_checkmark').setDisplaySize(28, 28).setTint(0x38a169));

    c.setSize(tam, tam).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.elegir(valor, bloqueada));
    c.once('destroy', () => {
      fondo.destroy();
      mini.destroy();
      mascara.destroy();
    });
    return c;
  }

  elegir(valor, bloqueada) {
    sfx(this, 'click', 0.3);
    const cat = this.categoria;
    this.cfg[cat] = valor;
    if (cat === 'genero') {
      if (valor !== 'nobinario') this.cfg.peinado = PEINADOS[valor][0];
      voz.decir('gen_' + valor);
    }
    if (bloqueada) voz.decir('avatar_bloqueado');
    actualizarPersonaje(this, this.muneco, this.cfg);
    this.tweens.add({ targets: this.muneco, scale: ESCALA * 1.05, duration: 120, yoyo: true });
    this.mostrarTarjetas();
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
    this.tweens.add({ targets: this.muneco, scale: ESCALA * 1.08, duration: 250, yoyo: true });
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
    this.tweens.add({ targets: this.muneco, scale: ESCALA * 1.08, duration: 250, yoyo: true });
    await voz.decir('avatar_bien');
    siguiente(this);
  }
}

// Candado dibujado (opciones bloqueadas).
function candado(g, x, y) {
  g.lineStyle(7, 0xf7fafc, 1).beginPath().arc(x, y - 6, 15, Math.PI, 0).strokePath();
  g.fillStyle(0xf7fafc, 1).fillRoundedRect(x - 22, y - 8, 44, 34, 6);
  g.fillStyle(0x1a202c, 1).fillCircle(x, y + 6, 5);
}
