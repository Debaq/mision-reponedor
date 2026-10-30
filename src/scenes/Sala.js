import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoSala, carro } from '../lib/fondos.js';
import { Indicador, marca, aleatorio, FELICITAR } from '../lib/ui.js';
import { ListaPanel } from '../lib/listaPanel.js';
import { crearPersonaje } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { siguiente } from '../lib/flujo.js';
import niveles from '../data/niveles.json';

const ESTANTE = { x0: 250, ancho: 860, bases: [190, 330, 470] };
const SECCION_ANCHO = 420;
const TAM = 60;
const CARRO = { x: 660, y: 585, ancho: 700 };

// Etapas 5 y 6 (parte 2): ubicar en la estantería y ordenar.
export default class Sala extends Phaser.Scene {
  constructor() {
    super('Sala');
  }

  init(datos) {
    this.nivel = datos.nivel || 'tutorial';
    this.guiado = !!datos.guiado;
  }

  create() {
    this.cameras.main.fadeIn(300);
    fondoSala(this);
    const nivel = niveles[this.nivel];
    this.panelLista = new ListaPanel(this, nivel.lista);
    this.ind = new Indicador(this);
    this.chuecos = [];
    this.malPuestos = [];
    this.ordenarActivo = !this.guiado;
    this.avisoOrdenar = false;
    this.terminado = false;

    this.dibujarEstante();
    this.secciones = nivel.estante.map((s, i) => this.crearSeccion(s, i));
    for (const m of nivel.malPuestos) this.crearMalPuesto(m);

    carro(this, CARRO.x, CARRO.y, CARRO.ancho);
    crearPersonaje(this, 1195, 460, estado.avatar, 0.27);
    this.enCarro = [];
    nivel.lista.flatMap((it) => Array(it.n).fill(it.p)).forEach((p, i) => this.crearItemCarro(p, i));

    this.input.on('drag', (pointer, obj, x, y) => obj.setPosition(x, y));

    if (this.guiado) {
      voz.decir('tut_paso5');
      this.guiarUbicar();
    } else {
      voz.decir('sala_intro');
    }
  }

  dibujarEstante() {
    const { x0, ancho, bases } = ESTANTE;
    const g = this.add.graphics();
    g.fillStyle(0x5f6b78, 1).fillRect(x0 - 14, 70, 14, 460).fillRect(x0 + ancho, 70, 14, 460);
    g.fillStyle(0xdfe6ec, 1).fillRect(x0, 70, ancho, 460);
    for (const b of bases) {
      g.fillStyle(0x8795a1, 1).fillRect(x0 - 14, b, ancho + 28, 14);
    }
  }

  crearSeccion(s, i) {
    const nivelY = ESTANTE.bases[Math.floor(i / 2)];
    const x0 = ESTANTE.x0 + (i % 2) * (SECCION_ANCHO + 20);
    const sec = { p: s.p, x0, base: nivelY, slots: [] };
    // Etiqueta de precio con el dibujo del producto
    const tx = x0 + SECCION_ANCHO / 2;
    const g = this.add.graphics();
    g.fillStyle(COLOR.amarillo, 1).fillRoundedRect(tx - 60, nivelY + 16, 120, 40, 6);
    g.lineStyle(2, 0xb7791f, 1).strokeRoundedRect(tx - 60, nivelY + 16, 120, 40, 6);
    this.add.image(tx - 34, nivelY + 36, 'prod_' + s.p).setDisplaySize(36, 36);
    this.add.text(tx + 18, nivelY + 36, '$990', estiloTexto(18, '#1f2d3a')).setOrigin(0.5);

    const total = s.llenos + s.vacios;
    const paso = 64;
    const inicio = x0 + 40;
    const marco = this.add.graphics();
    for (let k = 0; k < total; k++) {
      const slot = { x: inicio + k * paso, y: nivelY - TAM / 2 - 2, lleno: k < s.llenos };
      sec.slots.push(slot);
      if (!slot.lleno) {
        marco.lineStyle(3, 0x9fb0bf, 1).strokeRoundedRect(slot.x - 28, slot.y - 30, 56, 62, 8);
        continue;
      }
      const it = this.add.image(slot.x, slot.y, 'prod_' + s.p).setDisplaySize(TAM, TAM);
      if ((s.chuecos || []).includes(k)) this.hacerChueco(it, slot);
    }
    return sec;
  }

  hacerChueco(it, slot) {
    it.setAngle(Phaser.Math.RND.pick([-1, 1]) * Phaser.Math.Between(20, 30));
    it.x += Phaser.Math.Between(-8, 8);
    it.slot = slot;
    it.setInteractive({ useHandCursor: true });
    it.on('pointerup', () => {
      if (!this.ordenarActivo || !this.chuecos.includes(it)) return;
      sfx(this, 'tick');
      this.chuecos = this.chuecos.filter((c) => c !== it);
      this.tweens.add({ targets: it, angle: 0, x: slot.x, duration: 250, ease: 'Back.easeOut' });
      it.disableInteractive();
      this.revisar();
    });
    this.chuecos.push(it);
  }

  crearMalPuesto({ p, en }) {
    const sec = this.secciones.find((s) => s.p === en);
    const it = this.add.image(sec.x0 + SECCION_ANCHO - 36, sec.base - 24, 'prod_' + p).setDisplaySize(TAM, TAM).setAngle(80);
    it.p = p;
    it.malPuesto = true;
    this.hacerArrastrable(it);
    this.malPuestos.push(it);
  }

  crearItemCarro(p, i) {
    const porFila = 14;
    const x = CARRO.x - CARRO.ancho / 2 + 36 + (i % porFila) * 48;
    const y = CARRO.y - 40 - Math.floor(i / porFila) * 46;
    const it = this.add.image(x, y, 'prod_' + p).setDisplaySize(50, 50);
    it.p = p;
    this.hacerArrastrable(it);
    this.enCarro.push(it);
  }

  hacerArrastrable(it) {
    it.setInteractive({ useHandCursor: true, draggable: true });
    it.origen = { x: it.x, y: it.y, angle: it.angle };
    it.on('dragstart', () => {
      if (it.malPuesto && !this.ordenarActivo) return;
      sfx(this, 'tomar', 0.4);
      it.setDepth(500).setAngle(0);
      it.setDisplaySize(TAM + 8, TAM + 8);
      if (this.guiado && !it.malPuesto) {
        const sec = this.secciones.find((s) => s.p === it.p);
        this.ind.apuntar(sec.x0 + SECCION_ANCHO / 2, sec.base - 40, 120);
      }
    });
    it.on('dragend', (pointer) => this.soltar(it, pointer));
  }

  seccionEn(x, y) {
    return this.secciones.find((s) => x >= s.x0 && x <= s.x0 + SECCION_ANCHO && y >= s.base - 130 && y <= s.base + 60);
  }

  soltar(it, pointer) {
    const sec = this.seccionEn(pointer.x, pointer.y);
    const libre = sec && sec.p === it.p ? sec.slots.find((s) => !s.lleno) : null;
    if (sec && libre) {
      libre.lleno = true;
      it.disableInteractive();
      sfx(this, 'soltar');
      this.tweens.add({ targets: it, x: libre.x, y: libre.y, duration: 160 });
      it.setDisplaySize(TAM, TAM).setDepth(1);
      if (it.malPuesto) {
        this.malPuestos = this.malPuestos.filter((m) => m !== it);
      } else {
        this.enCarro = this.enCarro.filter((m) => m !== it);
        this.panelLista.sumar(it.p);
        if (this.panelLista.completo(it.p)) sfx(this, 'bien');
      }
      if (this.guiado) this.guiarUbicar();
      this.revisar();
      return;
    }
    // Volver al origen
    this.tweens.add({ targets: it, x: it.origen.x, y: it.origen.y, angle: it.origen.angle, duration: 250 });
    it.setDisplaySize(it.malPuesto ? TAM : 50, it.malPuesto ? TAM : 50).setDepth(it.malPuesto ? 1 : 0);
    if (!sec) {
      if (this.guiado) this.guiarUbicar();
      return;
    }
    sfx(this, 'error');
    sumarError();
    voz.decir(sec.p === it.p ? 'fb_lleno' : 'fb_lugar_mal');
    if (this.guiado) this.guiarUbicar();
  }

  guiarUbicar() {
    const it = this.enCarro[0];
    if (it) this.ind.apuntar(it.origen.x, it.origen.y, 44);
    else this.ind.ocultar();
  }

  async revisar() {
    if (this.terminado) return;
    if (!this.panelLista.todoCompleto()) return;
    const desorden = [...this.chuecos, ...this.malPuestos];
    if (desorden.length) {
      if (!this.avisoOrdenar) {
        this.avisoOrdenar = true;
        this.ordenarActivo = true;
        this.time.delayedCall(500, () => voz.decir(this.guiado ? 'tut_paso6' : 'sala_ordenar'));
      }
      const d = desorden[0];
      this.ind.apuntar(d.slot ? d.slot.x : d.origen.x, d.slot ? d.slot.y : d.origen.y, 46);
      return;
    }
    this.terminado = true;
    this.ind.ocultar();
    marca(this, 680, 300, true);
    sfx(this, 'logro');
    await new Promise((r) => this.time.delayedCall(400, r));
    const fin = this.guiado ? ['fb_estante_listo', 'tut_fin'] : ['fb_estante_listo', 'prac_fin'];
    if (!(await voz.secuencia([aleatorio(FELICITAR), ...fin]))) return;
    siguiente(this);
  }
}
