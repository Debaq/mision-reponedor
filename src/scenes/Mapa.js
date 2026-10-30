import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { Indicador, marca, panel, producto, sacudir } from '../lib/ui.js';
import { crearPersonaje } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import niveles from '../data/niveles.json';
import pasillos from '../data/pasillos.json';

const BODEGA = { x: 690, y: 135, ancho: 900, alto: 110 };
const PASILLO = { y: 370, ancho: 200, alto: 270, x0: 330, paso: 240 };
const ENTRADA = { x: 690, y: 560 };
const color = (hex) => parseInt(hex.slice(1), 16);

// Mapa del supermercado (vista desde arriba): el jugador toca adónde ir.
// datos: { nivel, destino: 'bodega' | 'pasillo', guiado }
export default class Mapa extends Phaser.Scene {
  constructor() {
    super('Mapa');
  }

  init(datos) {
    this.nivel = niveles[datos.nivel || 'tutorial'];
    this.destino = datos.destino === 'pasillo' ? this.nivel.pasillo : 'bodega';
    this.guiado = !!datos.guiado;
  }

  create() {
    this.cameras.main.fadeIn(300);
    this.listo = false;
    this.ind = new Indicador(this);
    this.add.graphics().fillStyle(0xf4efe6, 1).fillRect(0, 0, ANCHO, 720);
    this.zonas = {};

    this.crearBodega();
    Object.entries(pasillos).forEach(([id, p], i) => this.crearPasillo(id, p, PASILLO.x0 + i * PASILLO.paso));

    // Entrada (abajo)
    const g = this.add.graphics();
    g.fillStyle(0xd8d2c6, 1).fillRect(BODEGA.x - BODEGA.ancho / 2, 520, BODEGA.ancho, 70);
    g.fillStyle(0x9fd3ef, 1).fillRect(ENTRADA.x - 90, 580, 180, 14);
    this.add.text(ENTRADA.x + 150, 555, 'ENTRADA', estiloTexto(18, '#718096')).setOrigin(0.5);

    this.crearLista();

    // El personaje parte en la entrada (va a la bodega) o en la bodega (lleva el carro).
    const inicio = this.destino === 'bodega' ? ENTRADA : { x: BODEGA.x, y: BODEGA.y + 40 };
    this.yo = crearPersonaje(this, inicio.x, inicio.y, estado.avatar, 0.13).setDepth(10);

    this.intro();
  }

  crearBodega() {
    const { x, y, ancho, alto } = BODEGA;
    panel(this, x, y, ancho, alto, 0x8a96a3, 14);
    const g = this.add.graphics();
    for (let i = 0; i < 6; i++) {
      const cx = x - ancho / 2 + 90 + i * 150;
      g.fillStyle(COLOR.cartonOscuro, 1).fillRect(cx - 36, y - 26, 72, 52);
      g.fillStyle(COLOR.carton, 1).fillRect(cx - 33, y - 23, 66, 46);
    }
    this.add.text(x, y - alto / 2 - 4, 'BODEGA', estiloTexto(24, '#ffffff', { backgroundColor: '#3d4852', padding: { x: 14, y: 4 } })).setOrigin(0.5);
    this.zonas.bodega = this.crearZona('bodega', x, y, ancho, alto);
  }

  crearPasillo(id, p, x) {
    const { y, ancho, alto } = PASILLO;
    const g = this.add.graphics();
    g.fillStyle(0xe7e1d6, 1).fillRect(x - ancho / 2, y - alto / 2, ancho, alto);
    // Estanterías a los lados del pasillo
    g.fillStyle(0x8795a1, 1).fillRect(x - ancho / 2, y - alto / 2 + 50, 30, alto - 60).fillRect(x + ancho / 2 - 30, y - alto / 2 + 50, 30, alto - 60);
    // Letrero con número y nombre
    g.fillStyle(color(p.color), 1).fillRoundedRect(x - ancho / 2, y - alto / 2, ancho, 48, 12);
    g.fillStyle(0xffffff, 1).fillCircle(x - ancho / 2 + 26, y - alto / 2 + 24, 18);
    this.add.text(x - ancho / 2 + 26, y - alto / 2 + 24, String(p.n), estiloTexto(24)).setOrigin(0.5);
    this.add.text(x + 14, y - alto / 2 + 24, p.nombre.toUpperCase(), estiloTexto(19, '#ffffff')).setOrigin(0.5);
    p.muestra.forEach((prod, k) => producto(this, x, y - 40 + k * 70, prod, 64));
    this.zonas[id] = this.crearZona(id, x, y, ancho, alto);
  }

  crearZona(id, x, y, ancho, alto) {
    const borde = this.add.graphics().setDepth(5);
    const z = this.add.zone(x, y, ancho, alto).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => borde.clear().lineStyle(6, COLOR.amarillo, 1).strokeRoundedRect(x - ancho / 2, y - alto / 2, ancho, alto, 14));
    z.on('pointerout', () => borde.clear());
    z.on('pointerup', () => this.tocar(id, z));
    z.centro = { x, y };
    return z;
  }

  // Al llevar el carro: recordatorio de los productos de la lista, para buscar el pasillo con esos dibujos.
  crearLista() {
    if (this.destino === 'bodega') return;
    const lista = this.nivel.lista;
    const alto = 60 + lista.length * 80;
    panel(this, 100, 220 + alto / 2, 150, alto, COLOR.papel, 16);
    this.add.image(100, 248, 'ui_shoppingCart').setDisplaySize(40, 40).setTint(COLOR.marca);
    lista.forEach((it, i) => producto(this, 100, 310 + i * 80, it.p, 66));
  }

  async intro() {
    const linea = this.destino === 'bodega' ? 'mapa_bodega' : 'mapa_pasillo';
    if (!(await voz.decir(linea))) return;
    if (this.guiado) this.apuntar();
  }

  apuntar() {
    const z = this.zonas[this.destino];
    this.ind.apuntar(z.centro.x, z.centro.y, this.destino === 'bodega' ? 90 : 120);
  }

  async tocar(id, z) {
    if (this.listo) return;
    sfx(this, 'click', 0.3);
    if (id !== this.destino) {
      sfx(this, 'error');
      sumarError();
      sacudir(this, this.yo);
      await voz.secuencia(['zona_' + id, 'mapa_mal']);
      if (this.guiado) this.apuntar();
      return;
    }
    this.listo = true;
    this.ind.ocultar();
    marca(this, z.centro.x, z.centro.y - 60, true);
    sfx(this, 'bien');
    voz.decir('zona_' + id);
    // Caminar hasta el lugar elegido.
    const destino = id === 'bodega' ? { x: BODEGA.x, y: BODEGA.y + 40 } : { x: z.centro.x, y: z.centro.y + 60 };
    this.tweens.add({ targets: this.yo, x: destino.x, y: destino.y, duration: 1200, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.yo, angle: { from: -4, to: 4 }, duration: 150, yoyo: true, repeat: 3 });
    await new Promise((r) => this.time.delayedCall(1500, r));
    siguiente(this);
  }
}
