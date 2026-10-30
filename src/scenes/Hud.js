import Phaser from 'phaser';
import { ANCHO, ALTO, COLOR, estiloTexto } from '../lib/estilo.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { totales } from '../lib/estado.js';

const COLOR_VOZ = { guia: COLOR.azul, jugador: COLOR.verde, jugadora: COLOR.verde, jugadore: COLOR.verde, jefe: 0x6b46c1, cliente: 0xb7791f };
const VOZ_PREMIO = { 3: 'premio_3', 2: 'premio_2', 1: 'premio_1' };
const NOMBRE_VOZ = { guia: 'Guía', jugador: 'Tú', jugadora: 'Tú', jugadore: 'Tú', jefe: 'Don Jorge', cliente: 'Clienta' };

// Escena superpuesta: subtítulo de la voz actual + botón para repetir,
// marcador de estrellas y puntos, y premio al terminar cada etapa.
export default class Hud extends Phaser.Scene {
  constructor() {
    super({ key: 'Hud', active: false });
  }

  create() {
    this.scene.bringToTop();
    const y = ALTO - 58;
    this.caja = this.add.container(0, 0).setVisible(false);
    this.fondo = this.add.graphics();
    this.quien = this.add.text(150, y - 34, '', estiloTexto(18, '#ffffff')).setOrigin(0, 0.5);
    this.texto = this.add.text(150, y + 6, '', estiloTexto(24, '#ffffff', { wordWrap: { width: ANCHO - 330 } })).setOrigin(0, 0.5);
    this.caja.add([this.fondo, this.quien, this.texto]);

    // Botón parlante: repite la última instrucción.
    this.parlante = this.add.container(70, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillCircle(0, 4, 46);
    g.fillStyle(COLOR.azul, 1).fillCircle(0, 0, 46);
    g.lineStyle(4, 0xffffff, 0.5).strokeCircle(0, 0, 40);
    this.parlante.add([g, this.add.image(0, 0, 'ui_audioOn').setDisplaySize(56, 56)]);
    this.parlante.setSize(92, 92).setInteractive({ useHandCursor: true });
    this.parlante.on('pointerup', () => {
      sfx(this, 'click', 0.3);
      voz.repetir();
    });
    this.parlante.setVisible(false);

    voz.on('linea', (id, texto, quien) => this.mostrar(texto, quien));
    voz.on('fin', () => this.ondas && this.ondas.pause());
    this.ondas = this.tweens.add({ targets: this.parlante, scale: 1.1, duration: 300, yoyo: true, repeat: -1, paused: true });
    this.crearMarcador();
  }

  // Arriba a la derecha: estrellas y puntos de la partida.
  crearMarcador() {
    const y = 34;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.55).fillRoundedRect(ANCHO - 270, y - 23, 258, 46, 23);
    g.lineStyle(2, 0xffffff, 0.25).lineBetween(ANCHO - 152, y - 13, ANCHO - 152, y + 13);
    g.fillStyle(COLOR.marcaAcento, 1).fillCircle(ANCHO - 125, y, 16);
    g.lineStyle(3, 0xffffff, 0.6).strokeCircle(ANCHO - 125, y, 12);
    this.iconoEstrella = this.add.image(ANCHO - 242, y, 'ui_star').setTint(COLOR.amarillo).setDisplaySize(36, 36);
    this.txtEstrellas = this.add.text(ANCHO - 218, y, '0', estiloTexto(24, '#ffffff')).setOrigin(0, 0.5);
    this.iconoPuntos = this.add.text(ANCHO - 125, y, 'P', estiloTexto(17, '#ffffff')).setOrigin(0.5);
    this.txtPuntos = this.add.text(ANCHO - 28, y, '0', estiloTexto(24, '#f6c343')).setOrigin(1, 0.5);
    this.marcador = this.add.container(0, 0, [g, this.iconoEstrella, this.txtEstrellas, this.iconoPuntos, this.txtPuntos]);
    this.marcador.setVisible(false);
  }

  mostrarMarcador(visible) {
    const t = totales();
    this.txtEstrellas.setText(t.estrellas);
    this.txtPuntos.setText(t.puntos);
    this.marcador.setVisible(visible);
  }

  // Premio al terminar una etapa: estrellas grandes + puntos, que vuelan al marcador.
  // Devuelve una promesa que se cumple cuando termina la animación.
  async premiar({ estrellas, puntos }) {
    const esperar = (ms) => new Promise((r) => this.time.delayedCall(ms, r));
    const cx = ANCHO / 2;
    const cy = ALTO / 2 - 60;
    this.marcador.setVisible(true);

    // Capa que bloquea los toques mientras dura el premio.
    const capa = this.add.rectangle(cx, ALTO / 2, ANCHO, ALTO, 0x000000, 0.55).setInteractive().setAlpha(0);
    const caja = this.add.graphics();
    caja.fillStyle(0xffffff, 1).fillRoundedRect(cx - 230, cy - 110, 460, 230, 28);
    caja.lineStyle(6, COLOR.amarillo, 1).strokeRoundedRect(cx - 230, cy - 110, 460, 230, 28);
    caja.setAlpha(0);
    const txt = this.add.text(cx, cy + 75, `+${puntos}`, estiloTexto(48, '#553c9a')).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [capa, caja, txt], alpha: 1, duration: 200 });

    // Tres huecos grises; las estrellas ganadas aparecen encima, una por una.
    const huecos = [];
    const llenas = [];
    for (let i = 0; i < 3; i++) {
      const x = cx - 120 + i * 120;
      const hueco = this.add.image(x, cy - 20, 'ui_star').setDisplaySize(96, 96).setTint(0xcbd5e0).setAlpha(0);
      this.tweens.add({ targets: hueco, alpha: 1, duration: 200 });
      huecos.push(hueco);
      if (i >= estrellas) continue;
      const e = this.add.image(x, cy - 20, 'ui_star').setTint(COLOR.amarillo).setDisplaySize(96, 96);
      const escala = e.scaleX;
      e.setScale(0);
      this.tweens.add({
        targets: e, scale: escala, delay: 250 + i * 300, duration: 300, ease: 'Back.easeOut',
        onStart: () => sfx(this, 'tick'),
      });
      llenas.push(e);
    }

    sfx(this, estrellas === 3 ? 'logro' : 'bien');
    // Tope de 4 s por si el audio nunca avisa que terminó (así el juego no queda detenido).
    const hablar = Promise.race([voz.decir(VOZ_PREMIO[estrellas]), esperar(4000)]);
    await Promise.all([hablar, esperar(250 + estrellas * 300 + 500)]);

    // Las estrellas ganadas vuelan al marcador.
    const destino = this.iconoEstrella;
    llenas.forEach((e, i) => this.tweens.add({
      targets: e, x: destino.x, y: destino.y, scaleX: destino.scaleX, scaleY: destino.scaleY,
      delay: i * 120, duration: 450, ease: 'Quad.easeIn',
    }));
    this.tweens.add({ targets: [capa, caja, txt, ...huecos], alpha: 0, duration: 300 });
    await esperar(450 + estrellas * 120);

    const t = totales();
    this.txtEstrellas.setText(t.estrellas);
    this.tweens.add({ targets: [this.iconoEstrella, this.txtEstrellas], scale: '*=1.25', duration: 120, yoyo: true });
    const antes = Number(this.txtPuntos.text) || 0;
    this.tweens.addCounter({
      from: antes, to: t.puntos, duration: 500,
      onUpdate: (tw) => this.txtPuntos.setText(Math.round(tw.getValue())),
    });
    sfx(this, 'tick');
    for (const o of [capa, caja, txt, ...huecos, ...llenas]) o.destroy();
    await esperar(400);
  }

  mostrar(texto, quien) {
    const y = ALTO - 58;
    this.fondo.clear();
    this.fondo.fillStyle(0x000000, 0.72).fillRoundedRect(120, y - 52, ANCHO - 260, 104, 16);
    this.fondo.fillStyle(COLOR_VOZ[quien] || COLOR.azul, 1).fillRoundedRect(130, y - 46, 8, 92, 4);
    this.quien.setText(NOMBRE_VOZ[quien] || '');
    this.texto.setText(texto);
    const tam = texto.length > 150 ? 19 : texto.length > 100 ? 21 : 24;
    this.texto.setFontSize(tam);
    this.caja.setVisible(true);
    this.parlante.setVisible(true);
    this.ondas.resume();
  }

  // Las escenas pueden ocultar el subtítulo (ej. al cambiar de etapa).
  ocultar() {
    this.caja.setVisible(false);
  }
}
