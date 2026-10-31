import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoRender } from '../lib/fondos.js';
import { marca } from '../lib/ui.js';
import { crearPersonaje, CLIENTA, enPiso, ESCALA } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import { elegirRespuesta } from './Supervisor.js';
import pasillos from '../data/pasillos.json';

const CARTELES = Object.values(pasillos).map((p) => ({ n: p.n, nombre: p.nombre.toUpperCase(), prods: p.muestra, color: parseInt(p.color.slice(1), 16) }));

// Tarea adicional: orientar a una clienta sobre la ubicación de un producto.
export default class Cliente extends Phaser.Scene {
  constructor() {
    super('Cliente');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoRender(this, 'esc_tienda', 'SUPERMERCADO EL BARRIO');
    this.carteles = CARTELES.map((c, i) => this.crearCartel(c, 250 + i * 260, 115));
    this.clienta = crearPersonaje(this, 160, enPiso(), CLIENTA, ESCALA);
    this.yo = crearPersonaje(this, 1120, enPiso(), estado.avatar, ESCALA);
    this.alHablar = (id, texto, quien) => {
      const p = quien === 'cliente' ? this.clienta : quien === 'jugador' ? this.yo : null;
      if (p) this.tweens.add({ targets: p, y: p.y - 10, duration: 160, yoyo: true, repeat: 2 });
    };
    voz.on('linea', this.alHablar);
    this.events.once('shutdown', () => voz.off('linea', this.alHablar));
    this.conversar();
  }

  crearCartel(c, x, y) {
    const cont = this.add.container(x, y);
    const g = this.add.graphics();
    g.lineStyle(4, 0x5f6b78, 1).lineBetween(-80, -70, -80, -40).lineBetween(80, -70, 80, -40);
    g.fillStyle(c.color, 1).fillRoundedRect(-115, -40, 230, 110, 14);
    g.fillStyle(0xffffff, 1).fillCircle(-80, -2, 24);
    cont.add([g,
      this.add.text(-80, -2, String(c.n), estiloTexto(32, '#1f2d3a')).setOrigin(0.5),
      this.add.text(22, -14, c.nombre, estiloTexto(20, '#ffffff')).setOrigin(0.5)]);
    c.prods.forEach((p, i) => cont.add(this.add.image(-30 + i * 46, 38, 'prod_' + p).setDisplaySize(44, 44)));
    cont.setSize(230, 110).setInteractive({ useHandCursor: true });
    cont.on('pointerup', () => {
      sfx(this, 'click', 0.3);
      voz.decir('cartel_' + c.n);
    });
    return cont;
  }

  async conversar() {
    if (!(await voz.secuencia(['cliente_pregunta', 'cliente_instr']))) return;
    for (;;) {
      const r = await elegirRespuesta(this, [
        { id: 'rc_bien', ok: true },
        { id: 'rc_nose', ok: false },
        { id: 'rc_p2', ok: false },
      ], { y0: 235, ancho: 500 });
      if (!(await voz.decir(r.id))) return;
      marca(this, 640, 380, r.ok);
      sfx(this, r.ok ? 'bien' : 'error');
      if (r.ok) break;
      sumarError();
      const linea = r.id === 'rc_nose' ? ['cliente_mal_nose', 'guia_cliente_nose'] : ['guia_cliente_p2'];
      if (!(await voz.secuencia(linea))) return;
    }
    // Acompañarla caminando por el mapa hasta el pasillo 1 (alimentos); al llegar, el mapa despierta
    // esta escena y ella da las gracias junto al cartel.
    await new Promise((r) => this.time.delayedCall(500, r));
    this.cameras.main.fadeOut(300, 31, 45, 58);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.events.once('wake', () => this.llegar());
      this.scene.launch('Mapa', { destino: 'alimentos', linea: 'mapa_cliente', volver: 'Cliente', acompanante: CLIENTA });
      this.scene.sleep();
    });
  }

  async llegar() {
    const c1 = this.carteles[0];
    this.clienta.x = c1.x - 60;
    this.yo.x = c1.x + 110;
    this.cameras.main.fadeIn(300);
    this.tweens.add({ targets: c1, scale: 1.1, duration: 300, yoyo: true, repeat: 2 });
    sfx(this, 'logro');
    if (!(await voz.decir('cliente_gracias'))) return;
    siguiente(this);
  }
}
