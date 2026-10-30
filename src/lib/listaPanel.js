import { COLOR, estiloTexto } from './estilo.js';
import { panel } from './ui.js';
import { voz } from './voz.js';

// Lista compacta a la izquierda: imagen + "tengo / necesito" (rojo = falta, verde = listo).
export class ListaPanel {
  constructor(scene, lista, { x = 120, y = 80 } = {}) {
    this.scene = scene;
    this.lista = lista;
    this.cant = {};
    const alto = 60 + lista.length * 92;
    this.x = x;
    this.y = y;
    this.alto = alto;
    panel(scene, x, y + alto / 2, 200, alto, COLOR.papel, 16).setDepth(20);
    scene.add.text(x, y + 26, 'MI LISTA', estiloTexto(22, '#553c9a')).setOrigin(0.5).setDepth(21);
    this.filas = {};
    lista.forEach((item, i) => {
      const fy = y + 90 + i * 92;
      this.cant[item.p] = 0;
      const img = scene.add.image(x - 50, fy, 'prod_' + item.p).setDisplaySize(68, 68).setDepth(21);
      const txt = scene.add.text(x + 40, fy, '', estiloTexto(34)).setOrigin(0.5).setDepth(21);
      const zona = scene.add.zone(x, fy, 190, 86).setInteractive({ useHandCursor: true }).setDepth(22);
      zona.on('pointerup', () => voz.decir(`lista_${item.p}_${item.n}`));
      this.filas[item.p] = { img, txt, n: item.n, y: fy };
      this.actualizar(item.p, 0);
    });
  }

  actualizar(p, cant) {
    const f = this.filas[p];
    if (!f) return;
    this.cant[p] = cant;
    f.txt.setText(`${cant}/${f.n}`);
    f.txt.setColor(cant === f.n ? '#2f855a' : cant > f.n ? '#c05621' : '#c53030');
    this.scene.tweens.add({ targets: f.txt, scale: 1.25, duration: 120, yoyo: true });
  }

  sumar(p, d = 1) {
    this.actualizar(p, this.cant[p] + d);
  }

  tiene(p) {
    return p in this.filas;
  }

  completo(p) {
    return this.cant[p] === this.filas[p].n;
  }

  todoCompleto() {
    return this.lista.every((it) => this.cant[it.p] === it.n);
  }

  centro() {
    return { x: this.x, y: this.y + this.alto / 2, r: this.alto / 2 + 10 };
  }
}
