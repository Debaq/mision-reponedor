// Personaje hecho con MakeHuman y renderizado en Blender (tools/personaje.py), armado por capas: piel,
// zapatos, pantalón, polera, chaleco, cara (expresión), rasgos (ojos, pestañas, dientes), cejas, pelo y
// accesorios. Las capas vienen en blanco y se colorean con tint; hay un atlas por cuerpo ('p_hombre',
// 'p_mujer', 'p_nobinario') y en cada uno un juego de capas por pose.
// Tiene vida: respira, parpadea, gesticula y mueve la boca cuando habla su voz, y el personaje del
// jugador celebra los aciertos y se pone triste con los errores (eventos 'reaccion' que emite sfx()).
import { voz } from './voz.js';
import { sombra, sombraRect } from './sombras.js';

export const OPCIONES = {
  genero: ['hombre', 'mujer', 'nobinario'],
  piel: [1, 2, 3, 4, 5, 6, 7, 8],
  colorPelo: ['black', 'brown1', 'brown2', 'blonde', 'red', 'tan', 'grey', 'white'],
  poleraColor: ['white', 'blue', 'navy', 'grey', 'red', 'green', 'pine', 'yellow'],
  manga: ['short', 'long'],
  pantalonColor: ['Navy', 'Grey', 'Brown', 'Blue1', 'LightBlue', 'Tan', 'Red', 'Green'],
  pantalonLargo: ['long', 'shorter'],
  zapatos: ['black', 'brown', 'brown2', 'grey', 'blue', 'red', 'tan'],
  chaleco: ['no', 'basico', 'estrella', 'experto', 'plata', 'oro'],
};

// Todos los peinados están disponibles para todos; el género solo cambia cuáles aparecen primero.
export const PEINADOS = {
  hombre: ['corto', 'rapado', 'lado', 'rulos', 'afro', 'melena', 'largo', 'cola', 'mono', 'trenza'],
  mujer: ['largo', 'cola', 'melena', 'trenza', 'mono', 'rulos', 'afro', 'corto', 'lado', 'rapado'],
  nobinario: ['melena', 'corto', 'rulos', 'largo', 'lado', 'afro', 'cola', 'trenza', 'rapado', 'mono'],
};

export function opcionesDe(clave, cfg) {
  return clave === 'peinado' ? PEINADOS[cfg.genero || 'hombre'] : OPCIONES[clave];
}

// Colores (tint) de cada opción.
export const MUESTRA = {
  piel: { 1: 0xffe0b0, 2: 0xf1c27d, 3: 0xe0ac69, 4: 0xc68642, 5: 0x8d5524, 6: 0x6b3e1f, 7: 0xffd9c0, 8: 0xb07a4a },
  colorPelo: { black: 0x2b2b2b, brown1: 0x6b4423, brown2: 0x4a3a30, blonde: 0xf2d16b, red: 0xc0502e, tan: 0xb08a5a, grey: 0x9aa0a6, white: 0xeeeeee },
  ropa: {
    white: 0xf5f5f5, blue: 0x3498db, navy: 0x34495e, grey: 0x95a5a6, red: 0xe05a47, green: 0x4caf50, pine: 0x2e7d6b,
    yellow: 0xf4c430, Navy: 0x2c3e66, Grey: 0x8e9aa5, Brown: 0x8b5e3c, Blue1: 0x3b6fb6, LightBlue: 0x6ec6d9,
    Tan: 0xc9a27e, Red: 0xc0392b, Green: 0x4caf50, black: 0x3a3f3a, brown: 0x8b5e3c, brown2: 0x6b4423, tan: 0xd2b48c,
  },
};

// Geometría del render (ver tools/gen_personaje_mh.py): lienzo 360x520 = 2 m de alto (260 px/m),
// pies en y = 507.
const PIES_Y = 507;
const ALTO_LIENZO = 520;
// En coordenadas del personaje los pies quedan en y = 290 y 1 m mide 350 px (escala 1: una persona de
// 1,72 m ≈ 600 px), igual que el personaje anterior: así las escenas no cambian de posición.
const PIES_LOCAL = 290;
const AUMENTO = 350 / 260;
// Escala común a todas las escenas (los fondos de Blender están hechos para esto): una persona de
// 1,72 m mide ~380 px con los pies en y = 600 (en bodega y estanterías, de frente, en y = 578).
export const ESCALA = 0.63;
export const PISO_Y = 600;
export const PISO_FRONTAL_Y = 578;
// y del contenedor para que los pies queden en `pies`.
export const enPiso = (pies = PISO_Y, escala = ESCALA) => pies - PIES_LOCAL * escala;

const atlas = (genero) => 'p_' + (genero || 'hombre');

// Capa de referencia de cada parte del cuerpo, para encuadrarla en una miniatura.
const CAPA_PARTE = { cabeza: 'cara_sonrisa', torso: 'polera_corta', piernas: 'pantalon_largo', pies: 'zapatos' };

// Centro de una parte del cuerpo (coordenadas del personaje, escala 1), según el atlas de ese cuerpo.
export function centroParte(scene, genero, parte) {
  const f = scene.textures.getFrame(atlas(genero), 'quieto/' + CAPA_PARTE[parte]);
  return PIES_LOCAL + (f.y + f.cutHeight / 2 - PIES_Y) * AUMENTO;
}

const ORDEN = ['piel', 'zapatos', 'pantalon', 'polera', 'chaleco', 'corbata', 'cara', 'rasgos', 'cejas', 'pelo', 'lentes', 'tabla'];
// Capas que cambian con la expresión de la cara.
const CARA = ['cara', 'rasgos', 'cejas'];
const GESTO = { normal: 'sonrisa', feliz: 'abierta', triste: 'triste' };
const GESTOS_HABLA = ['abierta', 'sonrisa'];
const CAMINAR = ['camina1', 'quieto', 'camina2', 'quieto'];
// De espaldas: al caminar alejándose de la cámara (hacia arriba en el mapa).
const CAMINAR_ESPALDA = ['espalda1', 'espalda', 'espalda2', 'espalda'];

// Quién es quién para mover la boca: la voz que habla ('jefe', 'cliente' o la del jugador).
const ROL_VOZ = { jugador: 'jugador', jugadora: 'jugador', jugadore: 'jugador', jefe: 'jefe', cliente: 'cliente' };

// Capa (nombre en el atlas) y color de cada parte según la configuración.
function capas(k) {
  const chaleco = k.chaleco === true ? 'basico' : k.chaleco;
  const pelo = PEINADOS.hombre.includes(k.peinado) ? k.peinado : 'corto';
  return {
    piel: ['piel', MUESTRA.piel[k.piel]],
    zapatos: ['zapatos', MUESTRA.ropa[k.zapatos]],
    pantalon: [k.pantalonLargo === 'long' ? 'pantalon_largo' : 'pantalon_corto', MUESTRA.ropa[k.pantalonColor]],
    polera: [k.manga === 'long' ? 'polera_larga' : 'polera_corta', MUESTRA.ropa[k.poleraColor]],
    chaleco: chaleco && chaleco !== 'no' ? ['chaleco_' + chaleco] : null,
    corbata: k.corbata ? ['corbata'] : null,
    cara: ['cara', MUESTRA.piel[k.piel]],
    rasgos: ['rasgos'],
    cejas: ['cejas', MUESTRA.colorPelo[k.colorPelo]],
    pelo: ['pelo_' + pelo, MUESTRA.colorPelo[k.colorPelo]],
    lentes: k.lentes ? ['lentes'] : null,
    tabla: k.portapapeles ? ['tabla'] : null,
  };
}

/**
 * Crea un contenedor con el personaje. `escala` 1: 1 m ≈ 350 px; los pies quedan 290 px bajo (x, y).
 * Mira en tres cuartos hacia el centro de la pantalla (opción `mirar`: 'derecha' | 'izquierda').
 * Con `vida: false` queda quieto (sin animaciones ni voz), por ejemplo para las miniaturas del editor.
 */
export function crearPersonaje(scene, x, y, cfg, escala = 0.5, { vida = true, mirar } = {}) {
  const c = scene.add.container(x, y).setScale(escala);
  c.rol = cfg === SUPERVISOR ? 'jefe' : cfg === CLIENTA ? 'cliente' : 'jugador';
  c.cfg = { ...cfg };
  c.mirar = mirar || (x > scene.scale.width / 2 && vida ? 'izquierda' : 'derecha');
  c.pose = 'quieto';
  c.gesto = 'sonrisa';
  c.expresionActual = 'normal';
  armar(scene, c);
  if (vida) darVida(scene, c);
  return c;
}

export function actualizarPersonaje(scene, c, cfg) {
  c.cfg = { ...cfg };
  c.removeAll(true);
  armar(scene, c);
  if (c.respira) animarCuerpo(scene, c);
}

function armar(scene, c) {
  // Sombra en el piso: una penumbra amplia corrida hacia atrás y a la izquierda (adonde caen las
  // sombras en los fondos: el sol de tools/bl_util.py viene de adelante, arriba y a la derecha) y una
  // más oscura justo bajo los pies. No depende de hacia dónde mire: la luz no se espeja.
  c.add([sombra(scene, -34, PIES_LOCAL - 2, 330, 70, 0.28), sombra(scene, 0, PIES_LOCAL + 2, 180, 32, 0.55)]);
  // El cuerpo cuelga de los pies (así respirar o saltar escala desde el piso). El render mira hacia la
  // izquierda: para mirar a la derecha se espeja.
  const cuerpo = scene.add.container(0, PIES_LOCAL).setScale(c.mirar === 'izquierda' ? 1 : -1, 1);
  c.add(cuerpo);
  c.cuerpo = cuerpo;
  c.capas = {};
  const def = capas(c.cfg);
  for (const parte of ORDEN) {
    const d = def[parte];
    if (!d) continue;
    const capa = CARA.includes(parte) ? `${d[0]}_${c.gesto}` : d[0];
    const img = scene.add.image(0, 0, atlas(c.cfg.genero), `${c.pose}/${capa}`).setOrigin(0.5, PIES_Y / ALTO_LIENZO).setScale(AUMENTO);
    if (d[1] !== undefined) img.setTint(d[1]);
    img.capa = capa;
    img.base = d[0];
    cuerpo.add(img);
    c.capas[parte] = img;
  }

  // Globo de diálogo arriba y al lado de la cabeza (visible mientras habla): deja claro quién habla
  // sin tapar la cara.
  const globo = scene.add.container(150, PIES_LOCAL - 770).setVisible(false);
  const g = scene.add.graphics();
  sombraRect(g, -88, -48, 180, 104, 40, 0.18);
  g.fillStyle(0xffffff, 1).fillRoundedRect(-90, -56, 180, 104, 40).fillTriangle(-50, 40, -10, 40, -60, 84);
  g.lineStyle(5, 0x1f2d3a, 0.15).strokeRoundedRect(-90, -56, 180, 104, 40);
  globo.puntos = [-44, 0, 44].map((px) => scene.add.circle(px, -4, 14, 0x553c9a));
  globo.add([g, ...globo.puntos]);
  c.add(globo);
  c.globo = globo;
}

// Imagen suelta de una capa (íconos, premios): centrada en su contenido y del tamaño `tam`.
// (Las capas vienen recortadas en el atlas; el origen se calcula sobre la parte visible.)
export function imagenCapa(scene, x, y, capa, tam, tinte, genero = 'hombre') {
  const img = scene.add.image(x, y, atlas(genero), 'quieto/' + capa);
  const f = img.frame;
  img.setOrigin((f.x + f.cutWidth / 2) / f.realWidth, (f.y + f.cutHeight / 2) / f.realHeight);
  img.setScale(tam / Math.max(f.cutWidth, f.cutHeight));
  if (tinte !== undefined) img.setTint(tinte);
  return img;
}

// Cambia la pose (todas las capas a la vez).
export function ponerPose(c, pose) {
  if (!c.capas || c.pose === pose) return;
  c.pose = pose;
  for (const img of Object.values(c.capas)) if (img.active) img.setFrame(`${pose}/${img.capa}`);
}

// Gesto de la cara: 'sonrisa', 'abierta', 'triste' o 'parpadeo'.
function ponerGesto(c, g) {
  if (!c.capas) return;
  c.gesto = g;
  for (const parte of CARA) {
    const img = c.capas[parte];
    if (!img?.active) continue;
    img.capa = `${img.base}_${g}`;
    img.setFrame(`${c.pose}/${img.capa}`);
  }
}

// Expresión por un rato (o fija si no hay duración): cara y pose.
export function expresion(c, tipo, ms = 0) {
  if (!c.capas) return;
  c.expresionActual = tipo;
  if (!c.hablando) ponerGesto(c, GESTO[tipo]);
  // Caminando, la pose la pone el paso.
  if (!c.tCaminar) ponerPose(c, tipo === 'feliz' ? 'feliz' : tipo === 'triste' ? 'triste' : c.hablando ? 'habla' : 'quieto');
  if (ms && c.scene) {
    c.tExpresion?.remove();
    c.tExpresion = c.scene.time.delayedCall(ms, () => c.active && expresion(c, 'normal'));
  }
}

// Caminar en el lugar (las escenas mueven el contenedor): alterna las poses de paso, de frente o de
// espaldas según `c.deEspaldas` (ver mirarHacia).
export function caminar(c, activo) {
  c.tCaminar?.remove();
  c.tCaminar = null;
  if (!activo) {
    c.deEspaldas = false;
    ponerPose(c, 'quieto');
    return;
  }
  c.paso = 0;
  ponerPaso(c);
  c.tCaminar = c.scene.time.addEvent({ delay: 150, loop: true, callback: () => { c.paso++; ponerPaso(c); } });
}

const ponerPaso = (c) => ponerPose(c, (c.deEspaldas ? CAMINAR_ESPALDA : CAMINAR)[c.paso % CAMINAR.length]);

// Orienta al personaje según hacia dónde se mueve (dx, dy en pantalla): mira a la izquierda o a la
// derecha, y queda de espaldas si va hacia arriba (alejándose de la cámara).
export function mirarHacia(c, dx, dy) {
  if (Math.abs(dx) > 2) c.cuerpo.scaleX = dx > 0 ? -1 : 1;
  c.deEspaldas = dy < 0;
  if (c.tCaminar) ponerPaso(c);
}

// Respiración: el cuerpo se estira apenas desde los pies.
function animarCuerpo(scene, c) {
  c.respira?.remove();
  c.respira = scene.tweens.add({ targets: c.cuerpo, scaleY: 1.008, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

function darVida(scene, c) {
  animarCuerpo(scene, c);

  // Parpadeo cada 2,5–5 s (si no está hablando ni con otra expresión).
  const parpadear = () => {
    if (!c.active) return;
    if (!c.hablando && c.gesto === 'sonrisa') {
      ponerGesto(c, 'parpadeo');
      scene.time.delayedCall(120, () => c.active && c.gesto === 'parpadeo' && ponerGesto(c, GESTO[c.expresionActual]));
    }
    c.tParpadeo = scene.time.delayedCall(2500 + Math.random() * 2500, parpadear);
  };
  c.tParpadeo = scene.time.delayedCall(1000 + Math.random() * 2000, parpadear);

  // Gesticular y mover la boca mientras habla su voz.
  let tHabla = null;
  const callar = () => {
    tHabla?.remove();
    tHabla = null;
    if (!c.capas) return;
    c.hablando = false;
    if (c.globo?.active) c.globo.setVisible(false);
    ponerGesto(c, GESTO[c.expresionActual]);
    if (c.pose === 'habla') ponerPose(c, 'quieto');
  };
  const alHablar = (id, texto, quien) => {
    callar();
    if (ROL_VOZ[quien] !== c.rol || !c.active || c.tCaminar) return;
    c.hablando = true;
    c.globo.setVisible(true);
    if (c.expresionActual === 'normal') ponerPose(c, 'habla');
    let i = 0;
    tHabla = scene.time.addEvent({
      delay: 140, loop: true,
      callback: () => {
        ponerGesto(c, GESTOS_HABLA[i % GESTOS_HABLA.length]);
        c.globo.puntos.forEach((p, k) => p.setAlpha(k === Math.floor(i / 3) % 3 ? 1 : 0.3));
        i++;
      },
    });
  };
  voz.on('linea', alHablar);
  voz.on('fin', callar);

  // Reacciones del jugador a aciertos y errores.
  const reaccionar = (tipo) => {
    if (c.rol !== 'jugador' || !c.active || c.tCaminar) return;
    if (tipo === 'bien' || tipo === 'logro') {
      expresion(c, 'feliz', 1100);
      scene.tweens.add({ targets: c.cuerpo, y: PIES_LOCAL - 24, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
    } else if (tipo === 'error') {
      expresion(c, 'triste', 1300);
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
    c.tCaminar?.remove();
    c.respira?.remove();
  });
}

// Personajes fijos del juego.
export const SUPERVISOR = {
  genero: 'hombre', piel: 3, peinado: 'rapado', colorPelo: 'grey', poleraColor: 'white', manga: 'long',
  pantalonColor: 'Navy', pantalonLargo: 'long', zapatos: 'black', chaleco: true, lentes: true, corbata: true, portapapeles: true,
};

export const CLIENTA = {
  genero: 'mujer', piel: 5, peinado: 'cola', colorPelo: 'black', poleraColor: 'red', manga: 'long',
  pantalonColor: 'Blue1', pantalonLargo: 'long', zapatos: 'brown', chaleco: false,
};
