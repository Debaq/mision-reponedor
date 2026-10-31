import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoRender } from '../lib/fondos.js';
import { boton, Indicador, panel } from '../lib/ui.js';
import { crearPersonaje, SUPERVISOR, enPiso, ESCALA } from '../lib/personaje.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import { sombraRect } from '../lib/sombras.js';
import niveles from '../data/niveles.json';
import productos from '../data/productos.json';

// El supervisor entrega la lista de reposición (imagen + cantidad).
export default class Lista extends Phaser.Scene {
  constructor() {
    super('Lista');
  }

  init(datos) {
    this.nivel = datos.nivel || 'tutorial';
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_tienda', 'SUPERMERCADO EL BARRIO');
    crearPersonaje(this, 1100, enPiso(), SUPERVISOR, ESCALA);
    const lista = niveles[this.nivel].lista;

    // Checklist de reposición: tarjetas con dibujo, nombre, cantidad y casilla (como la referencia del documento).
    const BORDES = [0x63b3ed, 0xf6ad55, 0x68d391, 0xb794f4, 0xf687b3];
    const PILDORAS = [0xbee3f8, 0xfeebc8, 0xc6f6d5, 0xe9d8fd, 0xfed7e2];
    panel(this, 480, 128, 820, 92, 0xd6ecfb, 22);
    this.add.text(150, 112, 'Checklist de reposición', estiloTexto(36, '#1f2d3a')).setOrigin(0, 0.5);
    this.add.text(150, 152, 'Reponer estos productos en la estantería', estiloTexto(19, '#4a5568', { fontStyle: 'normal' })).setOrigin(0, 0.5);
    this.add.image(830, 128, 'ui_shoppingCart').setDisplaySize(64, 64).setTint(0x1f2d3a);

    this.ind = new Indicador(this);
    this.escuchadas = new Set();
    // Phaser reutiliza la escena: el botón de la lista anterior ya no existe.
    this.flecha = null;
    const ancho = 250;
    const paso = 270;
    const x0 = 480 - ((lista.length - 1) * paso) / 2;
    this.filas = lista.map((item, i) => {
      const x = x0 + i * paso;
      const y = 385;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      sombraRect(g, -ancho / 2 + 2, -150 + 10, ancho, 300, 20, 0.24, 16);
      g.fillStyle(0xffffff, 1).fillRoundedRect(-ancho / 2, -150, ancho, 300, 20);
      g.lineStyle(5, BORDES[i % BORDES.length], 1).strokeRoundedRect(-ancho / 2, -150, ancho, 300, 20);
      const nombre = this.add.text(0, -118, productos[item.p].nombre, estiloTexto(24, '#1f2d3a')).setOrigin(0.5);
      const img = this.add.image(-40, 0, 'prod_' + item.p).setDisplaySize(130, 130);
      const pild = this.add.graphics();
      pild.fillStyle(PILDORAS[i % PILDORAS.length], 1).fillRoundedRect(28, -52, 92, 60, 16);
      const num = this.add.text(74, -22, 'X' + item.n, estiloTexto(36, '#1f2d3a')).setOrigin(0.5);
      // Casilla: se marca al escuchar el producto.
      const casilla = this.add.graphics();
      casilla.lineStyle(4, 0x1f2d3a, 1).strokeRoundedRect(48, 26, 52, 52, 8);
      const check = this.add.image(74, 52, 'ui_checkmark').setDisplaySize(44, 44).setTint(COLOR.verde).setVisible(false);
      const parl = this.add.image(-40, 108, 'ui_audioOn').setDisplaySize(36, 36).setTint(COLOR.azul);
      c.add([g, nombre, img, pild, num, casilla, check, parl]);
      c.setSize(ancho, 300).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        sfx(this, 'click', 0.3);
        this.tweens.add({ targets: img, scale: img.scale * 1.12, duration: 150, yoyo: true });
        voz.decir(`lista_${item.p}_${item.n}`);
        check.setVisible(true);
        this.escuchadas.add(i);
        this.guiar();
      });
      return c;
    });

    const intro = { practica: ['prac_intro', 'lista_intro'], turno2: ['t2_intro', 'lista_intro'] }[this.nivel] || ['lista_intro'];
    voz.secuencia(intro).then((ok) => ok && this.guiar());
  }

  // Apunta a la siguiente tarjeta sin escuchar; al terminar muestra el botón para seguir, bajo las tarjetas.
  guiar() {
    const pendiente = this.filas.findIndex((_, i) => !this.escuchadas.has(i));
    if (pendiente >= 0) {
      const f = this.filas[pendiente];
      this.ind.apuntar(f.x, f.y, 110);
      return;
    }
    if (this.flecha) return;
    this.flecha = boton(this, 480, 574, {
      icono: 'ui_right', texto: 'Seguir', ancho: 280, alto: 72, tam: 30, color: COLOR.verde,
      onClick: () => siguiente(this),
    }).setDepth(50);
    this.flecha.latir();
    // Aviso cuando termine de leerse el último producto.
    const avisar = () => {
      if (!this.flecha.active) return;
      this.ind.apuntar(480, 574, 70);
      voz.decir('lista_lista');
    };
    if (voz.hablando()) voz.once('fin', () => this.time.delayedCall(300, avisar));
    else avisar();
  }
}
