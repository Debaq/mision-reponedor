import Phaser from 'phaser';
import { ANCHO, ALTO, COLOR, estiloTexto } from '../lib/estilo.js';
import { flechaSiguiente, Indicador } from '../lib/ui.js';
import { crearPersonaje } from '../lib/personaje.js';
import { estado, nombreJugador, segunGenero } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';

// Etapa 2: llega un mensaje al celular avisando la contratación.
export default class Contrato extends Phaser.Scene {
  constructor() {
    super('Contrato');
  }

  create() {
    this.cameras.main.fadeIn(300);
    const g = this.add.graphics();
    g.fillGradientStyle(0x6a8caf, 0x6a8caf, 0xf6d9a8, 0xf6d9a8, 1).fillRect(0, 0, ANCHO, ALTO);
    g.fillStyle(0xb98b5e, 1).fillRect(0, 560, ANCHO, 160);
    crearPersonaje(this, 300, 400, estado.avatar, 0.5);

    // Celular
    const cx = 820;
    const cy = 330;
    this.cel = this.add.container(cx, cy);
    const cuerpo = this.add.graphics();
    cuerpo.fillStyle(0x000000, 0.25).fillRoundedRect(-150, -262, 310, 540, 36);
    cuerpo.fillStyle(0x1f2933, 1).fillRoundedRect(-155, -270, 310, 540, 36);
    cuerpo.fillStyle(0xe8eef3, 1).fillRoundedRect(-140, -240, 280, 480, 18);
    cuerpo.fillStyle(0x1f2933, 1).fillRoundedRect(-40, -258, 80, 10, 5);
    this.hora = this.add.text(0, -190, '07:30', estiloTexto(54, '#1f2d3a')).setOrigin(0.5);
    this.cel.add([cuerpo, this.hora]);

    this.time.delayedCall(800, () => this.llegaMensaje());
  }

  llegaMensaje() {
    sfx(this, 'abrir');
    this.tweens.add({ targets: this.cel, angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 7, onComplete: () => this.cel.setAngle(0) });

    // Notificación
    const noti = this.add.container(0, -60).setAlpha(0);
    const f = this.add.graphics();
    f.fillStyle(0xffffff, 1).fillRoundedRect(-130, -55, 260, 110, 16);
    f.lineStyle(3, COLOR.marca, 1).strokeRoundedRect(-130, -55, 260, 110, 16);
    f.fillStyle(COLOR.marca, 1).fillCircle(-90, 0, 30);
    noti.add([f, this.add.image(-90, 0, 'ui_phone').setDisplaySize(38, 38),
      this.add.text(-50, -24, 'Supermercado\nEl Barrio', estiloTexto(20, '#1f2d3a')).setOrigin(0, 0),
      this.add.text(-50, 28, '1 mensaje nuevo', estiloTexto(15, '#4a5568', { fontStyle: 'normal' })).setOrigin(0, 0)]);
    this.cel.add(noti);
    this.tweens.add({ targets: noti, y: -80, alpha: 1, duration: 300 });

    const zona = this.add.zone(820, 250, 260, 110).setInteractive({ useHandCursor: true });
    const ind = new Indicador(this);
    ind.apuntar(820, 250, 80);
    voz.decir('contrato_llega');
    zona.once('pointerup', () => {
      ind.ocultar();
      zona.destroy();
      noti.destroy();
      this.abrirMensaje();
    });
  }

  async abrirMensaje() {
    sfx(this, 'click');
    this.hora.setVisible(false);
    const burbuja = this.add.container(0, 0).setScale(0.6).setAlpha(0);
    const b = this.add.graphics();
    b.fillStyle(0xffffff, 1).fillRoundedRect(-125, -215, 250, 420, 16);
    b.fillStyle(COLOR.marca, 1).fillRoundedRect(-125, -215, 250, 54, { tl: 16, tr: 16, bl: 0, br: 0 });
    burbuja.add([b,
      this.add.text(0, -188, 'Supermercado El Barrio', estiloTexto(17, '#ffffff')).setOrigin(0.5),
      this.add.text(0, -120, '¡FELICITACIONES!', estiloTexto(24, '#553c9a')).setOrigin(0.5),
      this.add.text(0, -80, nombreJugador(), estiloTexto(26, '#1f2d3a')).setOrigin(0.5),
      this.add.text(0, -30, segunGenero('Fuiste contratado\ncomo reponedor', 'Fuiste contratada\ncomo reponedora', 'Conseguiste el\ntrabajo en reposición'), estiloTexto(20, '#1f2d3a', { align: 'center' })).setOrigin(0.5),
      this.add.image(-60, 50, 'ui_star').setDisplaySize(44, 44).setTint(COLOR.amarillo),
      this.add.text(0, 50, '8:00', estiloTexto(34, '#1f2d3a')).setOrigin(0, 0.5),
      this.add.text(0, 115, 'Preséntate con\ndon Jorge', estiloTexto(19, '#4a5568', { align: 'center' })).setOrigin(0.5),
    ]);
    this.cel.add(burbuja);
    this.tweens.add({ targets: burbuja, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    sfx(this, 'logro');
    await voz.decir('contrato_mensaje');
    const f = flechaSiguiente(this, () => siguiente(this));
    f.latir();
    voz.decir('contrato_seguir');
  }
}
