import Phaser from 'phaser';
import { COLOR, estiloTexto } from './estilo.js';
import { sfx } from './sfx.js';
import { voz } from './voz.js';
import { sombraRect } from './sombras.js';
import pasillos from '../data/pasillos.json';

// Rectángulo redondeado con sombra.
export function panel(scene, x, y, w, h, color = COLOR.papel, radio = 18, sombra = true) {
  const g = scene.add.graphics();
  if (sombra) {
    sombraRect(g, x - w / 2 + 2, y - h / 2 + 8, w, h, radio, 0.22);
  }
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radio);
  return g;
}

/**
 * Botón grande con ícono y/o texto.
 * opts: { texto, icono, ancho, alto, color, tam, onClick, voz }
 * Si trae `voz`, al tocarlo dice esa línea (útil para quien no lee).
 */
export function boton(scene, x, y, opts = {}) {
  const { texto = '', icono = null, ancho = 220, alto = 84, color = COLOR.verde, tam = 30 } = opts;
  const c = scene.add.container(x, y);
  const fondo = scene.add.graphics();
  const dibujar = (col) => {
    fondo.clear();
    sombraRect(fondo, -ancho / 2, -alto / 2 + 8, ancho, alto, 20, 0.28, 10);
    fondo.fillStyle(col, 1);
    fondo.fillRoundedRect(-ancho / 2, -alto / 2, ancho, alto, 20);
    fondo.lineStyle(3, 0xffffff, 0.35);
    fondo.strokeRoundedRect(-ancho / 2 + 4, -alto / 2 + 4, ancho - 8, alto - 8, 16);
  };
  dibujar(color);
  c.add(fondo);

  let img = null;
  if (icono) {
    const tamIcono = Math.min(alto - 24, 64);
    img = scene.add.image(texto ? -ancho / 2 + 18 + tamIcono / 2 : 0, 0, icono).setDisplaySize(tamIcono, tamIcono);
    c.add(img);
  }
  if (texto) {
    const t = scene.add.text(img ? 22 : 0, 0, texto, estiloTexto(tam, '#ffffff', { align: 'center' })).setOrigin(0.5);
    c.add(t);
    c.etiqueta = t;
  }

  c.setSize(ancho, alto);
  c.setInteractive({ useHandCursor: true });
  c.activo = true;
  c.on('pointerover', () => c.activo && scene.tweens.add({ targets: c, scale: 1.06, duration: 100 }));
  c.on('pointerout', () => scene.tweens.add({ targets: c, scale: 1, duration: 100 }));
  c.on('pointerup', () => {
    if (!c.activo) return;
    sfx(scene, 'click');
    if (opts.voz) voz.decir(opts.voz);
    if (opts.onClick) opts.onClick(c);
  });
  c.setActivo = (v) => {
    c.activo = v;
    c.setAlpha(v ? 1 : 0.4);
    return c;
  };
  c.setColor = (col) => dibujar(col);
  c.latir = () => {
    scene.tweens.add({ targets: c, scale: 1.12, duration: 380, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    return c;
  };
  return c;
}

// Botón redondo de "siguiente" (flecha verde) abajo a la derecha.
export function flechaSiguiente(scene, onClick, x = 1185, y = 610) {
  const b = boton(scene, x, y, { icono: 'ui_right', ancho: 120, alto: 120, color: COLOR.verde, onClick });
  b.setDepth(50);
  return b;
}

// Indicador para guiar: aro que late + flecha que rebota.
export class Indicador {
  constructor(scene) {
    this.scene = scene;
    this.aro = scene.add.circle(0, 0, 60).setStrokeStyle(8, COLOR.amarillo).setDepth(900).setVisible(false);
    this.flecha = scene.add.triangle(0, 0, 0, 0, 44, 0, 22, 34, COLOR.amarillo)
      .setStrokeStyle(4, 0x7a5a00).setDepth(901).setVisible(false);
    scene.tweens.add({ targets: this.aro, scale: { from: 0.85, to: 1.15 }, alpha: { from: 1, to: 0.5 }, duration: 600, yoyo: true, repeat: -1 });
  }

  apuntar(x, y, radio = 60) {
    this.aro.setPosition(x, y).setRadius(radio).setVisible(true);
    this.flecha.setPosition(x, y - radio - 40).setVisible(true);
    this.scene.tweens.killTweensOf(this.flecha);
    this.scene.tweens.add({ targets: this.flecha, y: y - radio - 22, duration: 400, yoyo: true, repeat: -1 });
  }

  ocultar() {
    this.aro.setVisible(false);
    this.flecha.setVisible(false);
    this.scene.tweens.killTweensOf(this.flecha);
  }
}

// Destello de estrellitas (aciertos y premios).
export function destello(scene, x, y, cantidad = 12, profundidad = 960) {
  const p = scene.add.particles(x, y, 'ui_star', {
    speed: { min: 140, max: 320 }, angle: { min: 0, max: 360 }, scale: { start: 0.55, end: 0 },
    lifespan: 800, gravityY: 300, rotate: { min: -180, max: 180 },
    tint: [COLOR.amarillo, 0xffffff, COLOR.marcaAcento], emitting: false,
  }).setDepth(profundidad);
  p.explode(cantidad);
  scene.time.delayedCall(1000, () => p.destroy());
  return p;
}

// Marca grande de acierto / error en una posición.
export function marca(scene, x, y, bien = true) {
  if (bien) destello(scene, x, y);
  const c = scene.add.circle(x, y, 34, bien ? COLOR.verdeClaro : COLOR.rojo).setDepth(950);
  const i = scene.add.image(x, y, bien ? 'ui_checkmark' : 'ui_cross').setDisplaySize(44, 44).setDepth(951);
  c.setScale(0);
  i.setScale(0);
  scene.tweens.add({ targets: [c], scale: 1, duration: 200, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: [i], scaleX: 44 / i.width, scaleY: 44 / i.height, duration: 200, ease: 'Back.easeOut' });
  scene.time.delayedCall(900, () => {
    scene.tweens.add({ targets: [c, i], alpha: 0, duration: 250, onComplete: () => { c.destroy(); i.destroy(); } });
  });
}

// Imagen de producto en un tamaño dado.
export function producto(scene, x, y, id, tam = 64) {
  return scene.add.image(x, y, 'prod_' + id).setDisplaySize(tam, tam);
}

// Sacudida horizontal (error).
export function sacudir(scene, obj) {
  const x0 = obj.x;
  scene.tweens.add({ targets: obj, x: x0 + 12, duration: 50, yoyo: true, repeat: 3, onComplete: () => (obj.x = x0) });
}

export function aleatorio(arr) {
  return arr[Phaser.Math.Between(0, arr.length - 1)];
}

export const FELICITAR = ['fb_bien1', 'fb_bien2', 'fb_bien3'];

// Ícono de reloj dibujado (esfera y punteros) sobre un Graphics.
export function dibujarReloj(g, x, y, r, color = COLOR.oscuro) {
  g.fillStyle(0xffffff, 1).fillCircle(x, y, r);
  g.lineStyle(Math.max(2, r / 5), color, 1).strokeCircle(x, y, r);
  g.lineStyle(Math.max(2, r / 6), color, 1).lineBetween(x, y, x, y - r * 0.6).lineBetween(x, y, x + r * 0.45, y + r * 0.1);
  return g;
}

// Letrero colgante del pasillo (arriba a la derecha por defecto). Al tocarlo dice su nombre.
export function letreroPasillo(scene, id, x = 1197, y = 150) {
  const p = pasillos[id];
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.lineStyle(4, 0x5f6b78, 1).lineBetween(-36, -84, -36, -50).lineBetween(36, -84, 36, -50);
  g.fillStyle(parseInt(p.color.slice(1), 16), 1).fillRoundedRect(-62, -50, 124, 110, 14);
  g.fillStyle(0xffffff, 1).fillCircle(0, -14, 26);
  c.add([g, scene.add.text(0, -14, String(p.n), estiloTexto(34)).setOrigin(0.5),
    scene.add.text(0, 36, p.nombre.toUpperCase(), estiloTexto(17, '#ffffff')).setOrigin(0.5)]);
  c.setSize(124, 110).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => voz.decir('zona_' + id));
  return c;
}
