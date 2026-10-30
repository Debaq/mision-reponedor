// Estado de la partida (se pierde al recargar la página; el progreso se guarda en perfil.js).
export const AVATAR_INICIAL = {
  genero: 'hombre',
  piel: 2,
  peinado: 'Man1',
  colorPelo: 'brown2',
  cara: 1,
  poleraColor: 'white',
  manga: 'short',
  pantalonColor: 'Navy',
  pantalonLargo: 'long',
  zapatos: 'black',
  chaleco: true,
};

export const estado = {
  nombre: '',
  avatar: { ...AVATAR_INICIAL },
  paso: 0,
  erroresPaso: 0, // errores en la etapa actual (se reinicia al cambiar de etapa)
  resultados: {}, // id de etapa → { errores, estrellas, puntos }
};

// Nunca 0 estrellas: terminar la tarea siempre tiene premio.
export const PUNTOS = { 3: 100, 2: 70, 1: 40 };

export function estrellasPor(errores) {
  return errores === 0 ? 3 : errores <= 2 ? 2 : 1;
}

export function sumarError() {
  estado.erroresPaso++;
}

export function nuevaPartida() {
  estado.erroresPaso = 0;
  estado.resultados = {};
}

// Cierra la etapa actual: calcula estrellas y puntos según los errores.
export function registrarResultado(id) {
  const errores = estado.erroresPaso;
  const estrellas = estrellasPor(errores);
  const r = { errores, estrellas, puntos: PUNTOS[estrellas] };
  estado.resultados[id] = r;
  return r;
}

export function totales() {
  let estrellas = 0;
  let puntos = 0;
  for (const r of Object.values(estado.resultados)) {
    estrellas += r.estrellas;
    puntos += r.puntos;
  }
  return { estrellas, puntos };
}

export function nombreJugador() {
  return estado.nombre || 'Reponedor';
}

export const esMujer = () => estado.avatar.genero === 'mujer';

// Elige un texto según el género del jugador (hombre, mujer, no binario).
export function segunGenero(hombre, mujer, nobinario) {
  return { mujer, nobinario }[estado.avatar.genero] ?? hombre;
}
