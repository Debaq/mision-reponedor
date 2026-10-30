import { estrellasGuardadas } from './perfil.js';

// Desbloqueos según las estrellas guardadas del jugador (mejor resultado de cada etapa).
// Turno 1 da hasta 45 estrellas; el chaleco de oro necesita también el turno 2.
export const CHALECOS = { no: 0, basico: 0, estrella: 10, experto: 25, plata: 40, oro: 55 };
export const TURNO_2 = 30;

export const turno2Desbloqueado = (nombre) => estrellasGuardadas(nombre) >= TURNO_2;

// Lo que se ganó al pasar de `antes` a `ahora` estrellas.
export function nuevosPremios(antes, ahora) {
  const sube = (n) => antes < n && ahora >= n;
  return {
    chalecos: Object.keys(CHALECOS).filter((id) => CHALECOS[id] > 0 && sube(CHALECOS[id])),
    turno2: sube(TURNO_2),
  };
}
