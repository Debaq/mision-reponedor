// Personaje armado con piezas de Kenney "Modular Characters" (CC0), con proporciones adultas,
// cara por piezas (cejas, ojos, nariz, boca) y vida: respira, parpadea, mueve la boca cuando habla
// y reacciona a los aciertos y errores del jugador (eventos 'reaccion' que emite sfx()).
// Coordenadas en píxeles del sprite original, relativas al centro del torso.
import { voz } from './voz.js';

export const OPCIONES = {
  genero: ['hombre', 'mujer', 'nobinario'],
  piel: [1, 2, 3, 4, 5, 6, 7, 8],
  colorPelo: ['black', 'brown1', 'brown2', 'blonde', 'red', 'tan', 'grey', 'white'],
  cara: [1, 2, 3, 4, 5, 6, 7, 8],
  poleraColor: ['white', 'blue', 'navy', 'grey', 'red', 'green', 'pine', 'yellow'],
  manga: ['short', 'long'],
  pantalonColor: ['Navy', 'Grey', 'Brown', 'Blue1', 'LightBlue', 'Tan', 'Red', 'Green'],
  pantalonLargo: ['long', 'shorter'],
  zapatos: ['black', 'brown', 'brown2', 'grey', 'blue', 'red', 'tan'],
  chaleco: ['no', 'basico', 'estrella', 'experto', 'plata', 'oro'],
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
  ceja: (pelo, n) => `${pelo}Brow${n}.png`,
  ojo: (color, tam) => `eye${color}_${tam}.png`,
  nariz: (piel, n) => `tint${piel}Nose${n}.png`,
  boca: (b) => `mouth_${b}.png`,
  polera: (c, n) => (c === 'yellow' ? `shirtYellow${n}.png` : `${c}Shirt${n}.png`),
  manga: (c, m) => (c === 'white' || c === 'yellow' ? `arm${cap(c)}_${m}.png` : `${c}Arm_${m}.png`),
  pantalonArriba: (c) => `pants${c}1.png`,
  pantalonPierna: (c, l) => `pants${c}_${l}.png`,
  zapato: (c) => `${c}Shoe1.png`,
};

// Caras (opción "cara"): combinación de cejas, ojos y nariz.
const CARAS = {
  1: { ceja: 1, ojo: 'Brown', tam: 'large', nariz: 1 },
  2: { ceja: 2, ojo: 'Pine', tam: 'large', nariz: 2 },
  3: { ceja: 3, ojo: 'Black', tam: 'small', nariz: 3 },
  4: { ceja: 1, ojo: 'Black', tam: 'large', nariz: 2 },
  5: { ceja: 2, ojo: 'Blue', tam: 'small', nariz: 1 },
  6: { ceja: 3, ojo: 'Green', tam: 'large', nariz: 3 },
  7: { ceja: 1, ojo: 'Brown', tam: 'small', nariz: 2 },
  8: { ceja: 2, ojo: 'Black', tam: 'large', nariz: 1 },
};
const BOCAS = { normal: 'glad', feliz: 'teethUpper', triste: 'sad' };
const BOCAS_HABLA = ['oh', 'teethLower', 'straight', 'glad'];

// Proporciones adultas sobre las piezas de Kenney (que vienen con cabeza grande):
// cabeza más chica (desde el cuello), piernas y brazos más largos y brazos más pegados al cuerpo.
const P = { cabeza: 0.8, piernas: 1.35, brazos: 1.1, giroBrazo: 12, mano: 0.85 };
const CUELLO_Y = -96;
const CADERA_Y = 97;
const ZAPATO_Y = 268;
// Todo sube para que los pies queden donde estaban (las escenas ubican al personaje por su centro).
const DY = -(CADERA_Y + (ZAPATO_Y - CADERA_Y) * P.piernas - ZAPATO_Y);

// Quién es quién para mover la boca: la voz que habla ('jefe', 'cliente' o la del jugador).
const ROL_VOZ = { jugador: 'jugador', jugadora: 'jugador', jugadore: 'jugador', jefe: 'jefe', cliente: 'cliente' };

/** Crea un contenedor con el personaje. `escala` 1 = tamaño original (~600 px de alto). */
export function crearPersonaje(scene, x, y, cfg, escala = 0.5) {
  const c = scene.add.container(x, y).setScale(escala);
  c.rol = cfg === SUPERVISOR ? 'jefe' : cfg === CLIENTA ? 'cliente' : 'jugador';
  c.cfg = { ...cfg };
  armar(scene, c);
  darVida(scene, c);
  return c;
}

export function actualizarPersonaje(scene, c, cfg) {
  detenerAnimaciones(scene, c);
  c.cfg = { ...cfg };
  c.removeAll(true);
  armar(scene, c);
  animarCuerpo(scene, c);
}

function armar(scene, c) {
  const k = c.cfg;
  const img = (destino, atlas, f, x, y, ox = 0.5, oy = 0.5, flip = false) => {
    const i = scene.add.image(x, y, atlas, f).setOrigin(ox, oy).setFlipX(flip);
    destino.add(i);
    return i;
  };
  const grupo = (destino, x, y, sx = 1, sy = sx) => {
    const g = scene.add.container(x, y).setScale(sx, sy);
    destino.add(g);
    return g;
  };
  const piel = (p) => frame.piel(k.piel, p);

  // Sombra en el piso (bajo los zapatos).
  c.add(scene.add.ellipse(0, ZAPATO_Y + 26, 300, 46, 0x000000, 0.13));
  const cuerpo = grupo(c, 0, DY);

  // Piernas: piel + pantalón (alineado arriba, por el lado interior), estiradas desde la cadera.
  const piernas = grupo(cuerpo, 0, CADERA_Y, 1, P.piernas);
  for (const lado of [-1, 1]) {
    img(piernas, 'piel', piel('leg'), 38 * lado, 180 - CADERA_Y, 0.5, 0.5, lado < 0);
    img(piernas, 'pantalon', frame.pantalonPierna(k.pantalonColor, k.pantalonLargo), -17 * lado, 0, lado < 0 ? 1 : 0, 0, lado < 0);
  }
  // Zapatos sin estirar, al final de la pierna.
  for (const lado of [-1, 1]) {
    img(cuerpo, 'zapatos', frame.zapato(k.zapatos), 48 * lado, CADERA_Y + (ZAPATO_Y - CADERA_Y) * P.piernas, 0.5, 0.5, lado < 0);
  }
  img(cuerpo, 'piel', piel('neck'), 0, -80);
  // Brazos: piel + manga + mano, desde el hombro; algo girados hacia el cuerpo.
  c.brazos = [-1, 1].map((lado) => {
    const brazo = grupo(cuerpo, 45 * lado, -88, P.brazos).setAngle(P.giroBrazo * lado);
    img(brazo, 'piel', piel('arm'), 0, 0, lado < 0 ? 1 : 0, 0, lado < 0);
    img(brazo, 'polera', frame.manga(k.poleraColor, k.manga), -1 * lado, -3, lado < 0 ? 1 : 0, 0, lado < 0);
    // Portapapeles en la mano derecha (el supervisor).
    if (k.portapapeles && lado > 0) brazo.add(portapapeles(scene, 150, 118));
    img(brazo, 'piel', piel('hand'), 155 * lado, 148, 0.5, 0.5, lado < 0).setScale(P.mano);
    brazo.angulo = brazo.angle;
    return brazo;
  });
  img(cuerpo, 'pantalon', frame.pantalonArriba(k.pantalonColor), 0, 95);
  img(cuerpo, 'polera', frame.polera(k.poleraColor, k.poleraEstilo || (k.genero === 'mujer' ? 4 : 1)), 0, 0);
  if (k.corbata) {
    const t = scene.add.graphics();
    t.fillStyle(0x2a4365, 1).fillTriangle(-11, -78, 11, -78, 0, -60).fillTriangle(-9, -62, 9, -62, 0, 40);
    t.fillStyle(0x1a365d, 1).fillRect(-1, -60, 2, 98);
    cuerpo.add(t);
  }
  // Chaleco: 'basico' (o true, en los personajes fijos) o una variante desbloqueada.
  const chaleco = k.chaleco === true ? 'basico' : k.chaleco;
  if (chaleco && chaleco !== 'no') cuerpo.add(scene.add.image(0, 0, chaleco === 'basico' ? 'chaleco' : 'chaleco_' + chaleco));

  // Cabeza, escalada desde el cuello. Coordenadas locales: cuello = 0.
  const cabeza = grupo(cuerpo, 0, CUELLO_Y, P.cabeza);
  img(cabeza, 'piel', piel('head'), 0, -180 - CUELLO_Y);
  const cara = CARAS[k.cara] || CARAS[1];
  const yCara = -170 - CUELLO_Y - 50; // borde superior de la cara de Kenney (100 px de alto)
  const cejas = [-1, 1].map((lado) => img(cabeza, 'cara', frame.ceja(k.colorPelo, cara.ceja), 30 * lado, yCara + 11, 0.5, 0.5, lado > 0));
  const ojos = [-32, 29].map((x) => img(cabeza, 'cara', frame.ojo(cara.ojo, cara.tam), x, yCara + 48));
  img(cabeza, 'cara', frame.nariz(k.piel, cara.nariz), -3, yCara + 68);
  const boca = img(cabeza, 'cara', frame.boca(BOCAS.normal), 7, yCara + 94);
  if (k.lentes) {
    const l = scene.add.graphics();
    l.lineStyle(6, 0x1a202c, 1).strokeRoundedRect(-58, yCara + 30, 50, 38, 10).strokeRoundedRect(4, yCara + 30, 50, 38, 10);
    l.lineBetween(-8, yCara + 44, 4, yCara + 44);
    cabeza.add(l);
  }
  // El pelo se alinea por arriba, 28 px sobre la frente (cabeza: centro -180, alto 168).
  img(cabeza, 'pelo', frame.pelo(k.colorPelo, k.peinado), 0, -292 - CUELLO_Y, 0.5, 0);

  // Globo de diálogo sobre la cabeza (visible mientras habla): deja claro quién habla.
  const yGlobo = CUELLO_Y + (-292 - CUELLO_Y) * P.cabeza - 90;
  const globo = scene.add.container(70, yGlobo).setVisible(false);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.15).fillRoundedRect(-86, -50, 180, 104, 40);
  g.fillStyle(0xffffff, 1).fillRoundedRect(-90, -56, 180, 104, 40).fillTriangle(-50, 40, -10, 40, -60, 84);
  g.lineStyle(5, 0x1f2d3a, 0.15).strokeRoundedRect(-90, -56, 180, 104, 40);
  globo.puntos = [-44, 0, 44].map((x) => scene.add.circle(x, -4, 14, 0x553c9a));
  globo.add([g, ...globo.puntos]);
  cuerpo.add(globo);

  c.globo = globo;
  c.cuerpo = cuerpo;
  c.cabeza = cabeza;
  c.cara = { ojos, cejas, boca, expresion: 'normal', hablando: false };
}

function ponerBoca(c, b) {
  if (c.cara?.boca?.active) c.cara.boca.setFrame(frame.boca(b));
}

// Expresión por un rato (o fija si no hay duración).
export function expresion(c, tipo, ms = 0) {
  if (!c.cara) return;
  c.cara.expresion = tipo;
  if (!c.cara.hablando) ponerBoca(c, BOCAS[tipo]);
  const scene = c.scene;
  if (tipo === 'triste') c.cara.cejas.forEach((ce, i) => ce.setAngle(i ? -12 : 12));
  else c.cara.cejas.forEach((ce) => ce.setAngle(0));
  if (ms && scene) {
    c.tExpresion?.remove();
    c.tExpresion = scene.time.delayedCall(ms, () => c.active && expresion(c, 'normal'));
  }
}

// Respiración: la cabeza sube y baja apenas y los brazos se mecen.
function animarCuerpo(scene, c) {
  c.anims_ = [
    scene.tweens.add({ targets: c.cabeza, y: c.cabeza.y - 3, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
    ...c.brazos.map((b) => scene.tweens.add({ targets: b, angle: b.angulo + (b.angulo > 0 ? 2 : -2), duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })),
  ];
}

function detenerAnimaciones(scene, c) {
  (c.anims_ || []).forEach((t) => t.remove());
  c.anims_ = [];
}

function darVida(scene, c) {
  animarCuerpo(scene, c);

  // Parpadeo cada 2,5–5 s.
  const parpadear = () => {
    if (!c.active) return;
    const ojos = c.cara.ojos.filter((o) => o.active);
    scene.tweens.add({ targets: ojos, scaleY: 0.1, duration: 70, yoyo: true });
    c.tParpadeo = scene.time.delayedCall(2500 + Math.random() * 2500, parpadear);
  };
  c.tParpadeo = scene.time.delayedCall(1000 + Math.random() * 2000, parpadear);

  // Mover la boca mientras habla su voz.
  let tHabla = null;
  const callar = () => {
    tHabla?.remove();
    tHabla = null;
    if (!c.cara) return;
    c.cara.hablando = false;
    if (c.globo?.active) c.globo.setVisible(false);
    ponerBoca(c, BOCAS[c.cara.expresion]);
  };
  const alHablar = (id, texto, quien) => {
    callar();
    if (ROL_VOZ[quien] !== c.rol || !c.active) return;
    c.cara.hablando = true;
    c.globo.setVisible(true);
    let i = 0;
    tHabla = scene.time.addEvent({
      delay: 120, loop: true,
      callback: () => {
        ponerBoca(c, BOCAS_HABLA[i % BOCAS_HABLA.length]);
        // Puntos del globo: se encienden de a uno.
        c.globo.puntos.forEach((p, k) => p.setAlpha(k === Math.floor(i / 3) % 3 ? 1 : 0.3));
        i++;
      },
    });
  };
  voz.on('linea', alHablar);
  voz.on('fin', callar);

  // Reacciones del jugador a aciertos y errores.
  const reaccionar = (tipo) => {
    if (c.rol !== 'jugador' || !c.active) return;
    if (tipo === 'bien' || tipo === 'logro') {
      expresion(c, 'feliz', 1400);
      scene.tweens.add({ targets: c.cuerpo, y: DY - 18, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    } else if (tipo === 'error') {
      expresion(c, 'triste', 1400);
      scene.tweens.add({ targets: c.cabeza, angle: { from: -7, to: 7 }, duration: 110, yoyo: true, repeat: 2, onComplete: () => c.cabeza?.setAngle(0) });
    }
  };
  scene.events.on('reaccion', reaccionar);

  c.once('destroy', () => {
    voz.off('linea', alHablar);
    voz.off('fin', callar);
    scene.events.off('reaccion', reaccionar);
    tHabla?.remove();
    c.tParpadeo?.remove();
    c.tExpresion?.remove();
    detenerAnimaciones(scene, c);
  });
}

// Portapapeles con hoja y pinza (lo lleva el supervisor).
function portapapeles(scene, x, y) {
  const g = scene.add.graphics();
  g.fillStyle(0x8b5e3c, 1).fillRoundedRect(-38, -50, 76, 100, 8);
  g.fillStyle(0xffffff, 1).fillRect(-30, -38, 60, 80);
  g.lineStyle(3, 0xa0aec0, 1);
  for (let k = 0; k < 5; k++) g.lineBetween(-22, -24 + k * 14, 22, -24 + k * 14);
  g.fillStyle(0x718096, 1).fillRoundedRect(-16, -58, 32, 16, 4);
  return scene.add.container(x, y, [g]).setAngle(-12);
}

// Personajes fijos del juego.
export const SUPERVISOR = {
  genero: 'hombre', piel: 3, peinado: 'Man3', colorPelo: 'grey', cara: 1, poleraColor: 'white', poleraEstilo: 5, manga: 'long',
  pantalonColor: 'Navy', pantalonLargo: 'long', zapatos: 'black', chaleco: true, lentes: true, corbata: true, portapapeles: true,
};

export const CLIENTA = {
  genero: 'mujer', piel: 5, peinado: 'Woman4', colorPelo: 'black', cara: 3, poleraColor: 'red', poleraEstilo: 4, manga: 'long',
  pantalonColor: 'Blue1', pantalonLargo: 'long', zapatos: 'brown', chaleco: false,
};
