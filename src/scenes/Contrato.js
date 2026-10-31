import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { flechaSiguiente, Indicador } from '../lib/ui.js';
import { crearPersonaje, enPiso, ESCALA } from '../lib/personaje.js';
import { estado, nombreJugador, segunGenero } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import { sombraRect } from '../lib/sombras.js';
import { fondoImagen } from '../lib/fondos.js';

const CEL = { x: 860, y: 330, ancho: 330, alto: 560 };
const AZUL = 0x2b6cb0;

// Llega un mensaje al celular avisando la contratación (en la pieza del personaje).
export default class Contrato extends Phaser.Scene {
  constructor() {
    super('Contrato');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoImagen(this, 'esc_habitacion');
    this.yo = crearPersonaje(this, 330, enPiso(), estado.avatar, ESCALA);
    this.crearCelular();
    this.time.delayedCall(800, () => this.llegaMensaje());
  }

  crearCelular() {
    const { x, y, ancho, alto } = CEL;
    this.cel = this.add.container(x, y);
    const g = this.add.graphics();
    sombraRect(g, -ancho / 2 + 6, -alto / 2 + 14, ancho, alto, 40, 0.32, 24);
    g.fillStyle(0x1a202c, 1).fillRoundedRect(-ancho / 2, -alto / 2, ancho, alto, 40);
    g.fillStyle(0x4a5568, 1).fillRoundedRect(-ancho / 2 + 3, -alto / 2 + 3, ancho - 6, alto - 6, 38);
    g.fillStyle(0x1a202c, 1).fillRoundedRect(-ancho / 2 + 6, -alto / 2 + 6, ancho - 12, alto - 12, 36);
    // Pantalla con fondo degradado
    const px = -ancho / 2 + 14;
    const py = -alto / 2 + 14;
    this.pantalla = { x: px, y: py, ancho: ancho - 28, alto: alto - 28 };
    g.fillGradientStyle(0xe9f2fb, 0xe9f2fb, 0xd6e6f5, 0xd6e6f5, 1).fillRoundedRect(px, py, ancho - 28, alto - 28, 28);
    // Cámara frontal y barra de estado (hora, señal, wifi, batería)
    g.fillStyle(0x1a202c, 1).fillRoundedRect(-36, py + 8, 72, 18, 9);
    g.fillStyle(0x1f2d3a, 1);
    for (let k = 0; k < 4; k++) g.fillRect(70 + k * 7, py + 22 - k * 3, 5, 6 + k * 3);
    g.lineStyle(3, 0x1f2d3a, 1).beginPath().arc(112, py + 30, 10, Math.PI * 1.2, Math.PI * 1.8).strokePath();
    g.lineStyle(2, 0x1f2d3a, 1).strokeRoundedRect(124, py + 14, 22, 12, 3);
    g.fillStyle(0x1f2d3a, 1).fillRect(126, py + 16, 16, 8);
    this.cel.add([g, this.add.text(px + 22, py + 18, '07:30', estiloTexto(18, '#1f2d3a')).setOrigin(0, 0.5)]);
    this.reloj = this.add.text(0, -150, '07:30', estiloTexto(64, '#1f2d3a')).setOrigin(0.5);
    this.fecha = this.add.text(0, -100, 'lunes', estiloTexto(22, '#4a5568', { fontStyle: 'normal' })).setOrigin(0.5);
    this.cel.add([this.reloj, this.fecha]);
  }

  llegaMensaje() {
    sfx(this, 'abrir');
    this.tweens.add({ targets: this.cel, angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 7, onComplete: () => this.cel.setAngle(0) });

    // Notificación: sobre azul, remitente y vista previa
    const noti = this.add.container(0, 0).setAlpha(0);
    const f = this.add.graphics();
    sombraRect(f, -142, -48, 284, 110, 18, 0.16);
    f.fillStyle(0xffffff, 1).fillRoundedRect(-142, -54, 284, 110, 18);
    noti.add([f, sobre(this, -100, 0, 1),
      this.add.text(-62, -30, 'Supermercado El Barrio', estiloTexto(17, '#1f2d3a')).setOrigin(0, 0),
      this.add.text(-62, -4, '¡Felicidades! Tienes un', estiloTexto(15, '#4a5568', { fontStyle: 'normal' })).setOrigin(0, 0),
      this.add.text(-62, 16, 'mensaje nuevo.', estiloTexto(15, '#4a5568', { fontStyle: 'normal' })).setOrigin(0, 0)]);
    this.cel.add(noti);
    this.tweens.add({ targets: noti, y: -10, alpha: 1, duration: 300, ease: 'Back.easeOut' });

    const zona = this.add.zone(CEL.x, CEL.y - 10, 290, 120).setInteractive({ useHandCursor: true });
    const ind = new Indicador(this);
    ind.apuntar(CEL.x, CEL.y - 10, 80);
    voz.decir('contrato_llega');
    zona.once('pointerup', () => {
      ind.ocultar();
      zona.destroy();
      noti.destroy();
      this.abrirMensaje();
    });
  }

  // Mensaje abierto, como la ilustración del documento.
  async abrirMensaje() {
    sfx(this, 'click');
    this.reloj.setVisible(false);
    this.fecha.setVisible(false);
    const { x, y, ancho } = this.pantalla;
    const m = this.add.container(0, 0).setScale(0.7).setAlpha(0);
    const b = this.add.graphics();
    b.fillStyle(0xffffff, 1).fillRoundedRect(x + 10, y + 50, ancho - 20, 440, 20);
    b.lineStyle(2, 0xd6e6f5, 1).lineBetween(x + 30, y + 360, x + ancho - 30, y + 360);
    const cx = x + ancho / 2;
    const texto = (t, yy, tam, color, extra = {}) => this.add.text(cx, yy, t, estiloTexto(tam, color, { align: 'center', ...extra })).setOrigin(0.5, 0);
    m.add([b, sobre(this, cx, y + 104, 1.3),
      texto('¡Felicidades!', y + 148, 30, '#1f2d3a'),
      texto(nombreJugador(), y + 190, 22, '#553c9a'),
      texto(segunGenero('Has sido contratado para\ntrabajar en el supermercado.', 'Has sido contratada para\ntrabajar en el supermercado.',
        'Conseguiste el trabajo en\nel supermercado.'), y + 226, 18, '#1f2d3a', { fontStyle: 'normal', lineSpacing: 4 }),
      texto('Te esperamos mañana\na las 8:00.', y + 288, 18, '#1f2d3a', { fontStyle: 'normal', lineSpacing: 4 }),
      texto(segunGenero('¡Bienvenido a\nnuestro equipo!', '¡Bienvenida a\nnuestro equipo!', '¡Te damos la bienvenida\na nuestro equipo!'), y + 376, 19, '#2b6cb0', { lineSpacing: 4 }),
    ]);
    this.cel.add(m);
    this.tweens.add({ targets: m, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    sfx(this, 'logro');
    await voz.decir('contrato_mensaje');
    const fl = flechaSiguiente(this, () => siguiente(this));
    fl.latir();
    voz.decir('contrato_seguir');
  }
}

// Ícono de sobre en un cuadro azul redondeado.
function sobre(scene, x, y, escala) {
  const g = scene.add.graphics();
  g.fillStyle(AZUL, 1).fillRoundedRect(-28, -28, 56, 56, 12);
  g.fillStyle(0xffffff, 1).fillRect(-17, -11, 34, 23);
  g.lineStyle(3, AZUL, 1).beginPath().moveTo(-17, -11).lineTo(0, 3).lineTo(17, -11).strokePath();
  return scene.add.container(x, y, [g]).setScale(escala);
}
