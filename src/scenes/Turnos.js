import Phaser from 'phaser';
import { ANCHO, COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoEntrada } from '../lib/fondos.js';
import { dibujarReloj, flechaSiguiente, letreroPasillo } from '../lib/ui.js';
import { tarjeta } from '../lib/objetos.js';
import { crearPersonaje, SUPERVISOR } from '../lib/personaje.js';
import { estrellasGuardadas } from '../lib/perfil.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { inicioTurno, irA } from '../lib/flujo.js';

// Elegir turno (solo para quien ya desbloqueó el turno 2). Tocar una tarjeta la elige y la lee;
// la flecha verde confirma.
export default class Turnos extends Phaser.Scene {
  constructor() {
    super('Turnos');
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoEntrada(this);
    this.add.graphics().fillStyle(0x000000, 0.35).fillRect(0, 0, ANCHO, 720);
    crearPersonaje(this, 150, 440, SUPERVISOR, 0.42);
    this.elegido = null;

    this.add.image(ANCHO / 2 - 40, 70, 'ui_star').setTint(COLOR.amarillo).setDisplaySize(44, 44);
    this.add.text(ANCHO / 2 - 10, 70, String(estrellasGuardadas()), estiloTexto(36, '#ffffff')).setOrigin(0, 0.5);

    this.tarjetas = [1, 2].map((n) => this.crearTarjeta(n, n === 1 ? 470 : 810));
    voz.decir('turnos_elige');
  }

  crearTarjeta(n, x) {
    const t = tarjeta(this, x, 330, 300, 340);
    t.add(this.add.text(0, -130, `TURNO ${n}`, estiloTexto(34, '#553c9a')).setOrigin(0.5));
    if (n === 1) {
      t.add([crearPersonaje(this, 0, 40, { ...SUPERVISOR, poleraColor: 'white', colorPelo: 'brown2', peinado: 'Man1' }, 0.3)]);
      t.add(this.add.text(0, 140, 'Día completo', estiloTexto(22, '#4a5568')).setOrigin(0.5));
    } else {
      t.add(letreroPasillo(this, 'limpieza', 0, 20).disableInteractive());
      const g = this.add.graphics();
      dibujarReloj(g, 80, -60, 30, COLOR.rojo);
      t.add(g);
      t.add(this.add.text(0, 140, 'Limpieza + reloj', estiloTexto(22, '#4a5568')).setOrigin(0.5));
    }
    const marco = this.add.graphics();
    t.add(marco);
    t.marco = marco;
    t.on('pointerup', () => this.elegir(n, t));
    return t;
  }

  elegir(n, t) {
    sfx(this, 'click', 0.3);
    this.elegido = n;
    for (const o of this.tarjetas) o.marco.clear();
    t.marco.lineStyle(8, COLOR.amarillo, 1).strokeRoundedRect(-150, -170, 300, 340, 18);
    voz.decir('turno_' + n);
    if (!this.flecha) {
      this.flecha = flechaSiguiente(this, () => irA(this, inicioTurno(this.elegido)));
      this.flecha.latir();
    }
  }
}
