import Phaser from 'phaser';
import { COLOR, estiloTexto } from '../lib/estilo.js';
import { fondoRender } from '../lib/fondos.js';
import { Indicador, marca, aleatorio, FELICITAR, letreroPasillo } from '../lib/ui.js';
import { ListaPanel } from '../lib/listaPanel.js';
import { crearPersonaje, enPiso, ESCALA, PISO_FRONTAL_Y } from '../lib/personaje.js';
import { estado, sumarError } from '../lib/estado.js';
import { voz } from '../lib/voz.js';
import { sfx } from '../lib/sfx.js';
import { levantar } from '../lib/sombras.js';
import { alzaDedo, compacto, holgura, tocable } from '../lib/movil.js';
import { partirReloj, siguiente } from '../lib/flujo.js';
import niveles from '../data/niveles.json';
import ESCENARIOS from '../data/escenarios.json';
import productos from '../data/productos.json';

// 1290 → "1.290"
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const ESTANTE = { x0: 250, ancho: 860, bases: [190, 330, 470] };
const SECCION_ANCHO = 420;
const TAM = 60;
// Superficie del carro en el render (los productos se ponen encima).
const CARRO = ESCENARIOS.sala.carro;

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
    fondoRender(this, 'esc_sala', 'SUPERMERCADO EL BARRIO');
    const nivel = niveles[this.nivel];
    this.panelLista = new ListaPanel(this, nivel.lista);
    this.ind = new Indicador(this);
    this.chuecos = [];
    this.malPuestos = [];
    this.ordenarActivo = !this.guiado;
    this.avisoOrdenar = false;
    this.terminado = false;

    letreroPasillo(this, nivel.pasillo);
    this.secciones = nivel.estante.map((s, i) => this.crearSeccion(s, i));
    // Secciones sobrantes de la góndola: llenas de otros productos del pasillo (solo decoración).
    const delPasillo = Object.keys(productos).filter((p) => productos[p].pasillo === nivel.pasillo);
    for (let i = nivel.estante.length; i < ESTANTE.bases.length * 2; i++) {
      this.crearSeccion({ p: delPasillo[i % delPasillo.length], llenos: 6, vacios: 0 }, i);
    }
    for (const m of nivel.malPuestos) this.crearMalPuesto(m);

    crearPersonaje(this, 1200, enPiso(PISO_FRONTAL_Y), estado.avatar, ESCALA);
    this.enCarro = [];
    // En el celular los productos del carro son más grandes (para tomarlos con el dedo).
    this.tamCarro = compacto() ? 64 : 50;
    const enCarro = nivel.lista.flatMap((it) => Array(it.n).fill(it.p));
    // Todos en una fila si caben (se juntan un poco); si no, en filas.
    this.pasoCarro = Math.min(this.tamCarro - 2, (CARRO.ancho - 60 - this.tamCarro) / Math.max(1, enCarro.length - 1));
    if (this.pasoCarro < this.tamCarro * 0.85) this.pasoCarro = this.tamCarro - 2;
    enCarro.forEach((p, i) => this.crearItemCarro(p, i));

    this.input.on('drag', (pointer, obj, x, y) => obj.setPosition(x, y - alzaDedo(this)));

    if (this.guiado) {
      voz.decir('tut_paso5');
      this.guiarUbicar();
    } else {
      voz.decir('sala_intro').then((ok) => partirReloj(this, ok));
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
    this.add.text(tx + 20, nivelY + 36, '$' + miles(productos[s.p].precio), estiloTexto(18, '#1f2d3a')).setOrigin(0.5);

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
    tocable(it.setInteractive({ useHandCursor: true }));
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
    const tam = this.tamCarro;
    const paso = this.pasoCarro;
    const porFila = Math.floor((CARRO.ancho - 60 - tam) / paso) + 1;
    const x = CARRO.x - CARRO.ancho / 2 + 30 + tam / 2 + (i % porFila) * paso;
    const y = CARRO.y - tam / 2 - 1 - Math.floor(i / porFila) * (tam - 4);
    const it = this.add.image(x, y, 'prod_' + p).setDisplaySize(tam, tam);
    it.p = p;
    this.hacerArrastrable(it);
    this.enCarro.push(it);
  }

  hacerArrastrable(it) {
    tocable(it.setInteractive({ useHandCursor: true, draggable: true }));
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
    levantar(it);
    it.on('dragend', () => this.soltar(it));
  }

  // Sección donde cae el producto (por su centro): entre las que lo alcanzan, la más cercana. En el
  // celular, con más margen.
  seccionEn(x, y) {
    const m = (holgura() - 1) * 120;
    const centro = (s) => Math.hypot(x - (s.x0 + SECCION_ANCHO / 2), y - (s.base - 35));
    return this.secciones
      .filter((s) => x >= s.x0 - m && x <= s.x0 + SECCION_ANCHO + m && y >= s.base - 130 - m && y <= s.base + 60 + m)
      .sort((a, b) => centro(a) - centro(b))[0];
  }

  soltar(it) {
    const sec = this.seccionEn(it.x, it.y);
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
    it.setDisplaySize(it.malPuesto ? TAM : this.tamCarro, it.malPuesto ? TAM : this.tamCarro).setDepth(it.malPuesto ? 1 : 0);
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
