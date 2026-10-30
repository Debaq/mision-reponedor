// Estado de la partida (se pierde al recargar la página).
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
  errores: {},
};

export function sumarError(etapa) {
  estado.errores[etapa] = (estado.errores[etapa] || 0) + 1;
}

export function nombreJugador() {
  return estado.nombre || 'Reponedor';
}

export const esMujer = () => estado.avatar.genero === 'mujer';

// Elige un texto según el género del jugador (hombre, mujer, no binario).
export function segunGenero(hombre, mujer, nobinario) {
  return { mujer, nobinario }[estado.avatar.genero] ?? hombre;
}
