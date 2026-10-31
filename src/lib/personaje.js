// Personaje 3D renderizado en Blender (tools/gen_personaje.py) y armado por capas: piel, zapatos,
// pantalón, polera, chaleco, cara (ojos, iris, párpados, cejas, boca), pelo y accesorios.
// Las capas vienen en blanco y se colorean con tint; cada pose es un juego de capas del atlas 'p3d'.
// Tiene vida: respira, parpadea, gesticula y mueve la boca cuando habla su voz, y el personaje del
// jugador celebra los aciertos y se pone triste con los errores (eventos 'reaccion' que emite sfx()).
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

// Todos los peinados están disponibles para todos; el género solo cambia cuáles aparecen primero.
export const PEINADOS = {
  hombre: ['corto', 'rapado', 'lado', 'rulos', 'afro', 'melena', 'largo', 'cola', 'mono'],
  mujer: ['largo', 'cola', 'melena', 'mono', 'rulos', 'afro', 'corto', 'lado', 'rapado'],
  nobinario: ['melena', 'corto', 'rulos', 'largo', 'lado', 'afro', 'cola', 'rapado', 'mono'],
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
  // Color de ojos de cada cara
  iris: { 1: 0x5a3b1e, 2: 0x2e7d6b, 3: 0x2b2b2b, 4: 0x6b4423, 5: 0x3b78b5, 6: 0x4a8a3c, 7: 0x8a6a3a, 8: 0x6b7a8a },
};

// Geometría del render (ver tools/gen_personaje.py): lienzo 440x640, pies en y = 624.
const PIES_Y = 624;
const ALTO_LIENZO = 640;
// En coordenadas del personaje (escala 1 ≈ 600 px de alto) los pies quedan en y = 290,
// igual que el personaje anterior: así las escenas no cambian de posición.
const PIES_LOCAL = 290;
// Escala común a todas las escenas (los fondos de Blender están hechos para esto): una persona de
// 1,72 m mide ~380 px con los pies en y = 600 (en bodega y estanterías, de frente, en y = 578).
export const ESCALA = 0.63;
export const PISO_Y = 600;
export const PISO_FRONTAL_Y = 578;
// y del contenedor para que los pies queden en `pies`.
export const enPiso = (pies = PISO_Y, escala = ESCALA) => pies - PIES_LOCAL * escala;

// Centro de cada parte (coordenadas del personaje, escala 1), para encuadrarla en una miniatura.
export const CENTRO_PARTE = { cabeza: -230, torso: -94, piernas: 130, pies: 274 };

const ORDEN = ['piel', 'zapatos', 'pantalon', 'polera', 'chaleco', 'corbata', 'ojos', 'iris', 'parpados', 'cejas', 'boca', 'pelo', 'lentes', 'tabla'];
const BOCA = { normal: 'sonrisa', feliz: 'abierta', triste: 'triste' };
const BOCAS_HABLA = ['abierta', 'neutra', 'abierta', 'sonrisa'];
const CAMINAR = ['camina1', 'quieto', 'camina2', 'quieto'];

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
    ojos: ['ojos'],
    iris: ['iris', MUESTRA.iris[k.cara] || MUESTRA.iris[1]],
    parpados: ['parpados', MUESTRA.piel[k.piel]],
    cejas: ['cejas', MUESTRA.colorPelo[k.colorPelo]],
    boca: ['boca_sonrisa'],
    pelo: ['pelo_' + pelo, MUESTRA.colorPelo[k.colorPelo]],
    lentes: k.lentes ? ['lentes'] : null,
    tabla: k.portapapeles ? ['tabla'] : null,
  };
}

/**
 * Crea un contenedor con el personaje. `escala` 1 ≈ 600 px de alto; los pies quedan 290 px bajo (x, y).
 * Mira en tres cuartos hacia el centro de la pantalla (opción `mirar`: 'derecha' | 'izquierda').
 * Con `vida: false` queda quieto (sin animaciones ni voz), por ejemplo para las miniaturas del editor.
 */
export function crearPersonaje(scene, x, y, cfg, escala = 0.5, { vida = true, mirar } = {}) {
  const c = scene.add.container(x, y).setScale(escala);
  c.rol = cfg === SUPERVISOR ? 'jefe' : cfg === CLIENTA ? 'cliente' : 'jugador';
  c.cfg = { ...cfg };
  c.mirar = mirar || (x > scene.scale.width / 2 && vida ? 'izquierda' : 'derecha');
  c.pose = 'quieto';
  c.boca = 'sonrisa';
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
  // Sombra en el piso, bajo los pies.
  c.add(scene.add.ellipse(0, PIES_LOCAL + 4, 230, 40, 0x000000, 0.16));
  // El cuerpo cuelga de los pies (así respirar o saltar escala desde el piso).
  const cuerpo = scene.add.container(0, PIES_LOCAL).setScale(c.mirar === 'izquierda' ? -1 : 1, 1);
  c.add(cuerpo);
  c.cuerpo = cuerpo;
  c.capas = {};
  const def = capas(c.cfg);
  for (const parte of ORDEN) {
    const d = def[parte];
    if (!d) continue;
    const img = scene.add.image(0, 0, 'p3d', `${c.pose}/${d[0]}`).setOrigin(0.5, PIES_Y / ALTO_LIENZO);
    if (d[1] !== undefined) img.setTint(d[1]);
    img.capa = d[0];
    if (parte === 'parpados') img.setVisible(false);
    cuerpo.add(img);
    c.capas[parte] = img;
  }
  ponerBoca(c, c.boca);

  // Globo de diálogo sobre la cabeza (visible mientras habla): deja claro quién habla.
  const globo = scene.add.container(60, PIES_LOCAL - 640).setVisible(false);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.15).fillRoundedRect(-86, -50, 180, 104, 40);
  g.fillStyle(0xffffff, 1).fillRoundedRect(-90, -56, 180, 104, 40).fillTriangle(-50, 40, -10, 40, -60, 84);
  g.lineStyle(5, 0x1f2d3a, 0.15).strokeRoundedRect(-90, -56, 180, 104, 40);
  globo.puntos = [-44, 0, 44].map((px) => scene.add.circle(px, -4, 14, 0x553c9a));
  globo.add([g, ...globo.puntos]);
  c.add(globo);
  c.globo = globo;
}

// Imagen suelta de una capa (íconos, premios): centrada en su contenido y del tamaño `tam`.
// (Las capas vienen recortadas en el atlas; el origen se calcula sobre la parte visible.)
export function imagenCapa(scene, x, y, capa, tam, tinte) {
  const img = scene.add.image(x, y, 'p3d', 'quieto/' + capa);
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

function ponerBoca(c, b) {
  const img = c.capas?.boca;
  if (!img?.active) return;
  img.capa = 'boca_' + b;
  img.setFrame(`${c.pose}/${img.capa}`);
}

// Expresión por un rato (o fija si no hay duración): boca y pose.
export function expresion(c, tipo, ms = 0) {
  if (!c.capas) return;
  c.expresionActual = tipo;
  if (!c.hablando) ponerBoca(c, BOCA[tipo]);
  ponerPose(c, tipo === 'feliz' ? 'feliz' : tipo === 'triste' ? 'triste' : c.hablando ? 'habla' : 'quieto');
  if (ms && c.scene) {
    c.tExpresion?.remove();
    c.tExpresion = c.scene.time.delayedCall(ms, () => c.active && expresion(c, 'normal'));
  }
}

// Caminar en el lugar (las escenas mueven el contenedor): alterna las poses de paso.
export function caminar(c, activo) {
  c.tCaminar?.remove();
  c.tCaminar = null;
  if (!activo) {
    ponerPose(c, 'quieto');
    return;
  }
  let i = 0;
  c.tCaminar = c.scene.time.addEvent({ delay: 150, loop: true, callback: () => ponerPose(c, CAMINAR[i++ % CAMINAR.length]) });
}

// Respiración: el cuerpo se estira apenas desde los pies.
function animarCuerpo(scene, c) {
  c.respira?.remove();
  c.respira = scene.tweens.add({ targets: c.cuerpo, scaleY: 1.012, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

function darVida(scene, c) {
  animarCuerpo(scene, c);

  // Parpadeo cada 2,5–5 s.
  const parpadear = () => {
    if (!c.active) return;
    const p = c.capas.parpados;
    if (p?.active) {
      p.setVisible(true);
      scene.time.delayedCall(110, () => p.active && p.setVisible(false));
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
    ponerBoca(c, BOCA[c.expresionActual]);
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
      delay: 130, loop: true,
      callback: () => {
        ponerBoca(c, BOCAS_HABLA[i % BOCAS_HABLA.length]);
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
  genero: 'hombre', piel: 3, peinado: 'rapado', colorPelo: 'grey', cara: 3, poleraColor: 'white', manga: 'long',
  pantalonColor: 'Navy', pantalonLargo: 'long', zapatos: 'black', chaleco: true, lentes: true, corbata: true, portapapeles: true,
};

export const CLIENTA = {
  genero: 'mujer', piel: 5, peinado: 'cola', colorPelo: 'black', cara: 1, poleraColor: 'red', manga: 'long',
  pantalonColor: 'Blue1', pantalonLargo: 'long', zapatos: 'brown', chaleco: false,
};
