import Phaser from 'phaser';
import guion from '../data/voces.json';
import auto from '../data/voces_auto.json';
import { estado } from './estado.js';

export const LINEAS = { ...guion, ...auto };
delete LINEAS._info;

// Reproduce las voces del juego (una a la vez) y avisa al HUD para mostrar el subtítulo.
class Voz extends Phaser.Events.EventEmitter {
  iniciar(game) {
    this.game = game;
    this.actual = null;
    this.ultimo = null;
    this._resolver = null;
  }

  // Versión según género: "_f" (mujer) o "_n" (no binario, lenguaje neutro), si existe.
  variante(id) {
    const suf = { mujer: '_f', nobinario: '_n' }[estado.avatar.genero];
    return suf && LINEAS[id + suf] ? id + suf : id;
  }

  texto(id) {
    return (LINEAS[this.variante(id)]?.texto || '').replaceAll('{nombre}', estado.nombre);
  }

  hablando() {
    return !!this.actual;
  }

  // Devuelve una promesa: true si terminó de hablar, false si fue interrumpida.
  decir(id) {
    this.callar();
    id = this.variante(id);
    const linea = LINEAS[id];
    if (!linea) {
      console.warn('Voz sin guion:', id);
      return Promise.resolve(true);
    }
    this.ultimo = id;
    this.emit('linea', id, this.texto(id), linea.voz);
    return new Promise((resolve) => {
      this._resolver = resolve;
      const clave = 'v_' + id;
      if (!this.game.cache.audio.exists(clave)) {
        // Sin audio (no generado): esperar según el largo del texto.
        console.warn('Falta audio:', clave);
        this.actual = { stop() {}, destroy() {}, play() {} };
        this._timer = setTimeout(() => this._terminar(true), 600 + this.texto(id).length * 55);
        return;
      }
      this.actual = this.game.sound.add(clave);
      this.actual.once('complete', () => this._terminar(true));
      this.actual.play();
    });
  }

  async secuencia(ids) {
    for (const id of ids) {
      if (!(await this.decir(id))) return false;
    }
    return true;
  }

  // Repite la última línea (botón del parlante).
  repetir() {
    if (!this.ultimo) return;
    if (this.actual && this.actual.isPlaying) {
      this.actual.play();
      return;
    }
    if (this.actual) return;
    const clave = 'v_' + this.ultimo;
    if (!this.game.cache.audio.exists(clave)) return;
    const s = this.game.sound.add(clave);
    this.emit('linea', this.ultimo, this.texto(this.ultimo), LINEAS[this.ultimo].voz);
    s.once('complete', () => {
      s.destroy();
      this.emit('fin');
    });
    s.play();
  }

  callar() {
    if (this.actual) this._terminar(false);
  }

  _terminar(completa) {
    clearTimeout(this._timer);
    const s = this.actual;
    this.actual = null;
    if (s) {
      s.stop();
      s.destroy();
    }
    const r = this._resolver;
    this._resolver = null;
    this.emit('fin');
    if (r) r(completa);
  }
}

export const voz = new Voz();
