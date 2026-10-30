// Personaje armado con piezas de Kenney "Modular Characters" (CC0).
// Coordenadas en píxeles del sprite original, relativas al centro del torso.

export const OPCIONES = {
  genero: ['hombre', 'mujer', 'nobinario'],
  piel: [1, 2, 3, 4, 5, 6, 7, 8],
  colorPelo: ['black', 'brown1', 'brown2', 'blonde', 'red', 'tan', 'grey', 'white'],
  cara: [1, 2, 3, 4],
  poleraColor: ['white', 'blue', 'navy', 'grey', 'red', 'green', 'pine', 'yellow'],
  manga: ['short', 'long'],
  pantalonColor: ['Navy', 'Grey', 'Brown', 'Blue1', 'LightBlue', 'Tan', 'Red', 'Green'],
  pantalonLargo: ['long', 'shorter'],
  zapatos: ['black', 'brown', 'brown2', 'grey', 'blue', 'red', 'tan'],
  chaleco: [true, false],
};

const CORTOS = ['Man1', 'Man2', 'Man3', 'Man4', 'Man5', 'Man6', 'Man7'];
const LARGOS = ['Woman1', 'Woman2', 'Woman3', 'Woman4', 'Woman5', 'Woman6'];

// Todos los peinados están disponibles para todos; el género solo cambia cuáles aparecen primero.
export const PEINADOS = {
  hombre: [...CORTOS, ...LARGOS],
  mujer: [...LARGOS, ...CORTOS],
  nobinario: CORTOS.flatMap((c, i) => (LARGOS[i] ? [c, LARGOS[i]] : [c])),
};

export function opcionesDe(clave, cfg) {
  return clave === 'peinado' ? PEINADOS[cfg.genero || 'hombre'] : OPCIONES[clave];
}

// Colores representativos (para las muestras del editor).
export const MUESTRA = {
  piel: { 1: 0xffe0b0, 2: 0xf1c27d, 3: 0xe0ac69, 4: 0xc68642, 5: 0x8d5524, 6: 0x6b3e1f, 7: 0xffd9c0, 8: 0xb07a4a },
  colorPelo: { black: 0x2b2b2b, brown1: 0x6b4423, brown2: 0x5a4d45, blonde: 0xf2d16b, red: 0xc0502e, tan: 0xb08a5a, grey: 0x9aa0a6, white: 0xeeeeee },
};

const cap = (s) => s[0].toUpperCase() + s.slice(1);

const frame = {
  piel: (t, parte) => `tint${t}_${parte}.png`,
  pelo: (c, p) => `${c}${p}.png`,
  cara: (n) => `face${n}.png`,
  polera: (c, n) => (c === 'yellow' ? `shirtYellow${n}.png` : `${c}Shirt${n}.png`),
  manga: (c, m) => (c === 'white' || c === 'yellow' ? `arm${cap(c)}_${m}.png` : `${c}Arm_${m}.png`),
  pantalonArriba: (c) => `pants${c}1.png`,
  pantalonPierna: (c, l) => `pants${c}_${l}.png`,
  zapato: (c) => `${c}Shoe1.png`,
};

/** Crea un contenedor con el personaje. `escala` 1 = tamaño original (~600 px de alto). */
export function crearPersonaje(scene, x, y, cfg, escala = 0.5) {
  const c = scene.add.container(x, y).setScale(escala);
  c.cfg = { ...cfg };
  armar(scene, c);
  return c;
}

export function actualizarPersonaje(scene, c, cfg) {
  c.cfg = { ...cfg };
  c.removeAll(true);
  armar(scene, c);
}

function armar(scene, c) {
  const k = c.cfg;
  const img = (atlas, f, x, y, ox = 0.5, oy = 0.5, flip = false) => {
    const i = scene.add.image(x, y, atlas, f).setOrigin(ox, oy).setFlipX(flip);
    c.add(i);
    return i;
  };
  const piel = (p) => frame.piel(k.piel, p);

  // Piernas: piel + pantalón (pantalón alineado arriba, por el lado interior).
  for (const lado of [-1, 1]) {
    img('piel', piel('leg'), 38 * lado, 180, 0.5, 0.5, lado < 0);
    img('pantalon', frame.pantalonPierna(k.pantalonColor, k.pantalonLargo), -17 * lado, 97, lado < 0 ? 1 : 0, 0, lado < 0);
    img('zapatos', frame.zapato(k.zapatos), 48 * lado, 268, 0.5, 0.5, lado < 0);
  }
  img('piel', piel('neck'), 0, -80);
  // Brazos: piel + manga alineadas en el hombro.
  for (const lado of [-1, 1]) {
    img('piel', piel('arm'), 45 * lado, -88, lado < 0 ? 1 : 0, 0, lado < 0);
    img('polera', frame.manga(k.poleraColor, k.manga), 44 * lado, -91, lado < 0 ? 1 : 0, 0, lado < 0);
    img('piel', piel('hand'), 200 * lado, 60, 0.5, 0.5, lado < 0);
  }
  img('pantalon', frame.pantalonArriba(k.pantalonColor), 0, 95);
  img('polera', frame.polera(k.poleraColor, k.poleraEstilo || (k.genero === 'mujer' ? 4 : 1)), 0, 0);
  if (k.chaleco) c.add(scene.add.image(0, 0, 'chaleco'));
  img('piel', piel('head'), 0, -180);
  img('cara', frame.cara(k.cara), 0, -170);
  // El pelo se alinea por arriba, 28 px sobre la frente (cabeza: centro -180, alto 168).
  img('pelo', frame.pelo(k.colorPelo, k.peinado), 0, -292, 0.5, 0);
}

// Personajes fijos del juego.
export const SUPERVISOR = {
  genero: 'hombre', piel: 3, peinado: 'Man3', colorPelo: 'grey', cara: 1, poleraColor: 'navy', poleraEstilo: 5, manga: 'long',
  pantalonColor: 'Grey', pantalonLargo: 'long', zapatos: 'black', chaleco: true,
};

export const CLIENTA = {
  genero: 'mujer', piel: 5, peinado: 'Woman4', colorPelo: 'black', cara: 3, poleraColor: 'red', poleraEstilo: 4, manga: 'long',
  pantalonColor: 'Blue1', pantalonLargo: 'long', zapatos: 'brown', chaleco: false,
};
