import Phaser from 'phaser';
import { estado } from './estado.js';
import { ultimoDia } from './perfil.js';
import niveles from '../data/niveles.json';
import productos from '../data/productos.json';
import pasillos from '../data/pasillos.json';

// Días de trabajo al azar (día 3 en adelante): mismo recorrido que el turno 2 (lista, bodega, mapa,
// estantería y tres tareas al azar del supervisor, con reloj), pero cada día con otro pasillo, otros
// productos y otra estantería. El nivel se arma en niveles.dia (lo leen Lista, Bodega, Mapa, Traslado
// y Sala como cualquier nivel).

const MAX_POR_SECCION = 6; // espacios que caben en una sección de la estantería

// Se desbloquean al terminar el turno 2.
export const diasDesbloqueados = () => ultimoDia() >= 2;
export const proximoDia = () => Math.max(3, ultimoDia() + 1);

// Sin Phaser.Math.RND: todavía no existe cuando se carga este archivo (antes de arrancar el juego).
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];

export function generarDia() {
  const { Between } = Phaser.Math;
  const pasillo = azar(Object.keys(pasillos));
  const delPasillo = Phaser.Utils.Array.Shuffle(Object.keys(productos).filter((p) => productos[p].pasillo === pasillo));
  // Tres productos para reponer (de 2 a 4 cada uno: caben en una fila del carro) y, si el pasillo
  // tiene más, una cuarta sección ya llena, solo para ordenar.
  const lista = delPasillo.slice(0, 3).map((p) => ({ p, n: Between(2, 4) }));
  const estante = lista.map(({ p, n }) => {
    const vacios = n + Between(0, 1);
    return { p, llenos: Between(0, Math.min(2, MAX_POR_SECCION - vacios)), vacios };
  });
  if (delPasillo[3]) estante.push({ p: delPasillo[3], llenos: Between(2, 3), vacios: 1 });
  // Un producto mal puesto en la sección de otro: su sección necesita un espacio libre de más.
  const sinDesorden = (s) => s.llenos + s.vacios < MAX_POR_SECCION || s.vacios > (lista.find((it) => it.p === s.p)?.n || 0);
  const origen = azar(estante.filter(sinDesorden));
  if (origen.vacios <= (lista.find((it) => it.p === origen.p)?.n || 0)) origen.vacios++;
  const malPuestos = [{ p: origen.p, en: azar(estante.filter((s) => s !== origen)).p }];
  // Uno o dos productos chuecos en las secciones que tienen productos.
  for (const s of Phaser.Utils.Array.Shuffle(estante.filter((s) => s.llenos > 0)).slice(0, Between(1, 2))) {
    s.chuecos = [Between(0, s.llenos - 1)];
  }
  niveles.dia = { pasillo, lista, estante, malPuestos };
  return niveles.dia;
}

// Empieza el día siguiente al último terminado (o el que se pida) con un nivel nuevo.
export function empezarDia(n = proximoDia()) {
  estado.dia = n;
  estado.vencidosHoy = null;
  return generarDia();
}

// Que siempre exista (por ejemplo, al saltar a una etapa del día desde el menú de Etapas).
generarDia();
