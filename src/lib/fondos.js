import Phaser from 'phaser';
import { ANCHO, ALTO, ANCHO_MAX, COLOR, X_IZQ, estiloTexto } from './estilo.js';
import { sombra } from './sombras.js';

const PRODUCTOS_DECO = ['atun', 'leche', 'aceite', 'bebida', 'tomate', 'ketchup', 'miel', 'chocolate', 'jugo', 'mani', 'pan', 'queso'];

function piso(g, y, colorA, colorB, tam = 80) {
  for (let fila = 0; y + fila * tam < ALTO; fila++) {
    for (let col = Math.floor(X_IZQ / tam); col * tam < X_IZQ + ANCHO_MAX; col++) {
      g.fillStyle((fila + col) % 2 ? colorA : colorB, 1);
      g.fillRect(col * tam, y + fila * tam, tam, tam);
    }
  }
}

// Sala de ventas: pared clara, piso de baldosas, letrero del supermercado.
export function fondoSala(scene, { pisoY = 560, letrero = true } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(0xeef3f6, 1).fillRect(X_IZQ, 0, ANCHO_MAX, pisoY);
  g.fillStyle(0xd8e2e8, 1).fillRect(X_IZQ, pisoY - 14, ANCHO_MAX, 14);
  piso(g, pisoY, 0xe7e1d6, 0xf4efe6);
  if (letrero) barraTitulo(scene, 'SUPERMERCADO EL BARRIO', COLOR.marca);
  return g;
}

// Bodega: muro gris, piso de cemento con línea de seguridad amarilla.
export function fondoBodega(scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x8a96a3, 1).fillRect(X_IZQ, 0, ANCHO_MAX, ALTO);
  for (let y = 0; y < 560; y += 40) {
    g.lineStyle(2, 0x7a8693, 1).lineBetween(X_IZQ, y, X_IZQ + ANCHO_MAX, y);
  }
  g.fillStyle(0x6b737c, 1).fillRect(X_IZQ, 560, ANCHO_MAX, ALTO - 560);
  g.fillStyle(COLOR.amarillo, 1).fillRect(X_IZQ, 566, ANCHO_MAX, 8);
  barraTitulo(scene, 'BODEGA', 0x3d4852);
  return g;
}

// Imagen de fondo de alto completo, centrada (los renders son más anchos que 16:9: lo que sobra se ve
// en pantallas alargadas).
export function fondoImagen(scene, clave) {
  const img = scene.add.image(ANCHO / 2, 0, clave).setOrigin(0.5, 0);
  return img.setScale(ALTO / img.height);
}

// Barra del título arriba, a todo el ancho.
function barraTitulo(scene, titulo, color) {
  const g = scene.add.graphics();
  g.fillStyle(color, 1).fillRect(X_IZQ, 0, ANCHO_MAX, 56);
  g.fillStyle(COLOR.marcaAcento, 1).fillRect(X_IZQ, 56, ANCHO_MAX, 6);
  scene.add.text(ANCHO / 2, 28, titulo, estiloTexto(28, '#ffffff')).setOrigin(0.5);
  return g;
}

// Exterior / entrada del supermercado (render de Blender: tools/gen_escenarios.py) con el nombre en el letrero.
export function fondoEntrada(scene) {
  fondoImagen(scene, 'esc_fachada');
  scene.add.text(ANCHO / 2, 130, 'SUPERMERCADO EL BARRIO', estiloTexto(48, '#ffffff', { stroke: '#2d2060', strokeThickness: 6 })).setOrigin(0.5);
}

/** Estantería decorativa llena de productos al azar. */
export function estanteDeco(scene, x, y, ancho, niveles = 3, altoNivel = 90, tam = 52, profundidad = 0) {
  const g = scene.add.graphics().setDepth(profundidad);
  const alto = niveles * altoNivel + 20;
  g.fillStyle(0x5f6b78, 1).fillRect(x, y, 12, alto).fillRect(x + ancho - 12, y, 12, alto);
  g.fillStyle(0xdfe6ec, 1).fillRect(x + 12, y, ancho - 24, alto);
  const rnd = new Phaser.Math.RandomDataGenerator([String(x + y)]);
  for (let n = 0; n < niveles; n++) {
    const yb = y + (n + 1) * altoNivel;
    g.fillStyle(0x8795a1, 1).fillRect(x, yb, ancho, 12);
    const prod = rnd.pick(PRODUCTOS_DECO);
    for (let px = x + 20 + tam / 2; px < x + ancho - 20; px += tam * 0.9) {
      scene.add.image(px, yb - tam / 2 + 6, 'prod_' + prod).setDisplaySize(tam, tam).setDepth(profundidad);
    }
  }
  return g;
}

// Carro de reposición (plataforma con ruedas). Devuelve un container.
export function carro(scene, x, y, ancho = 300) {
  const c = scene.add.container(x, y);
  c.add(sombra(scene, 0, 40, ancho * 1.05, 34, 0.35));
  const g = scene.add.graphics();
  g.fillStyle(0x2b6cb0, 1).fillRoundedRect(-ancho / 2, -16, ancho, 28, 6);
  g.fillStyle(0x1e4e80, 1).fillRect(ancho / 2 - 14, -150, 12, 140);
  g.fillRoundedRect(ancho / 2 - 50, -160, 60, 14, 6);
  g.fillStyle(0x222222, 1).fillCircle(-ancho / 2 + 34, 24, 16).fillCircle(ancho / 2 - 34, 24, 16);
  g.fillStyle(0x888888, 1).fillCircle(-ancho / 2 + 34, 24, 6).fillCircle(ancho / 2 - 34, 24, 6);
  c.add(g);
  return c;
}

// Fondo renderizado en Blender (tools/gen_escenarios.py) con la barra superior del juego.
export function fondoRender(scene, clave, titulo, colorBarra = COLOR.marca) {
  const fondo = fondoImagen(scene, clave);
  scene.add.image(ANCHO / 2, 0, 'vineta').setOrigin(0.5, 0).setDisplaySize(fondo.displayWidth, ALTO);
  return barraTitulo(scene, titulo, colorBarra);
}
