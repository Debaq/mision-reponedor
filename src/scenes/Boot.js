import Phaser from 'phaser';
import { ANCHO, ALTO, COLOR, estiloTexto } from '../lib/estilo.js';
import { LINEAS, voz } from '../lib/voz.js';
import { SFX } from '../lib/sfx.js';
import productos from '../data/productos.json';
import { conVersion as v } from '../lib/version.js';

const ICONOS = ['audioOn', 'checkmark', 'cross', 'home', 'information', 'left', 'next', 'phone', 'question',
  'return', 'right', 'shoppingCart', 'star', 'trashcan', 'warning'];

export default class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const barra = this.add.graphics();
    const txt = this.add.text(ANCHO / 2, ALTO / 2 - 60, 'Cargando...', estiloTexto(36, '#ffffff')).setOrigin(0.5);
    this.load.on('progress', (p) => {
      barra.clear();
      barra.fillStyle(0x34495e, 1).fillRoundedRect(ANCHO / 2 - 300, ALTO / 2, 600, 36, 18);
      barra.fillStyle(COLOR.verdeClaro, 1).fillRoundedRect(ANCHO / 2 - 300, ALTO / 2, Math.max(36, 600 * p), 36, 18);
    });
    this.load.on('complete', () => txt.destroy());

    this.load.setPath('assets/');
    for (const [clave, archivo] of [['piel', 'skin'], ['cara', 'face'], ['pelo', 'hair'], ['polera', 'shirts'],
      ['pantalon', 'pants'], ['zapatos', 'shoes']]) {
      this.load.atlasXML(clave, v(`personaje/sheet_${archivo}.png`), v(`personaje/sheet_${archivo}.xml`));
    }
    this.load.image('mapa', v('mapa/mapa.jpg'));
    this.load.image('chaleco', v('personaje/chaleco.png'));
    for (const ch of ['estrella', 'experto', 'plata', 'oro']) this.load.image('chaleco_' + ch, v(`personaje/chaleco_${ch}.png`));
    for (const id of Object.keys(productos)) this.load.image('prod_' + id, v(`productos/${id}.png`));
    for (const id of ['basura_lata', 'basura_envoltorio', 'basura_manzana', 'basura_vaso']) this.load.image(id, v(`productos/${id}.png`));
    for (const i of ICONOS) this.load.image('ui_' + i, v(`ui/${i}.png`));
    for (const s of Object.values(SFX)) this.load.audio('sfx_' + s, v(`sfx/${s}.mp3`));
    for (const id of Object.keys(LINEAS)) this.load.audio('v_' + id, v(`audio/voces/${id}.mp3`));
  }

  create() {
    voz.iniciar(this.game);
    this.scene.launch('Hud');
    this.scene.start('Inicio');
  }
}
