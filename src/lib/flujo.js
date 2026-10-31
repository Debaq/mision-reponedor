import { estado, registrarResultado } from './estado.js';
import { guardarEstrellas } from './perfil.js';
import { turno2Desbloqueado } from './premios.js';
import { voz } from './voz.js';

// Orden de las etapas del juego (secuencia del documento).
// Las etapas con `id` dan estrellas y puntos al terminar; `nombre` es el que aparece en el resumen final.
// `enOrden`: id de la etapa Órdenes que encarga esta tarea (al terminarla se vuelve a ese tablero).
// `datos.tiempo`: segundos para hacer la tarea (el jefe lo anuncia y aparece el reloj).
// `omitir`: si devuelve true, la etapa se salta al avanzar.
// `lugar`: pasillo donde se hace la tarea; antes se va caminando por el mapa (etapa Mapa con `mapa: true`).
const TURNO_1 = [
  { escena: 'Avatar', datos: { modo: 'personaje' }, titulo: '1. Crear personaje' },
  // Quien ya desbloqueó el turno 2 elige qué turno jugar.
  { escena: 'Turnos', omitir: () => !turno2Desbloqueado() },
  { escena: 'Contrato', titulo: '2. Aviso de contratación' },
  { escena: 'Avatar', datos: { modo: 'trabajo' }, titulo: '3. Ropa de trabajo', id: 'avatar', nombre: 'Vestimenta' },
  { escena: 'Supervisor', titulo: '4. Presentación con el supervisor', id: 'supervisor', nombre: 'Presentación' },
  { escena: 'Lista', datos: { nivel: 'tutorial' }, titulo: '5. Lista de productos' },
  { escena: 'Mapa', datos: { nivel: 'tutorial', destino: 'bodega', guiado: true } },
  { escena: 'Bodega', datos: { nivel: 'tutorial', guiado: true }, titulo: '6. Tutorial: bodega', id: 'bodega_tutorial', nombre: 'Bodega · tutorial' },
  { escena: 'Mapa', datos: { nivel: 'tutorial', destino: 'pasillo', guiado: true } },
  { escena: 'Traslado', datos: { nivel: 'tutorial' } },
  { escena: 'Sala', datos: { nivel: 'tutorial', guiado: true }, titulo: '6. Tutorial: estantería', id: 'sala_tutorial', nombre: 'Estante · tutorial' },
  { escena: 'Lista', datos: { nivel: 'practica' }, titulo: '7. Práctica: lista nueva' },
  { escena: 'Mapa', datos: { nivel: 'practica', destino: 'bodega' } },
  { escena: 'Bodega', datos: { nivel: 'practica' }, titulo: '7. Práctica: bodega', id: 'bodega_practica', nombre: 'Bodega · práctica' },
  { escena: 'Mapa', datos: { nivel: 'practica', destino: 'pasillo' }, titulo: '7. Práctica: mapa', id: 'mapa', nombre: 'Mapa' },
  { escena: 'Traslado', datos: { nivel: 'practica' } },
  { escena: 'Sala', datos: { nivel: 'practica' }, titulo: '7. Práctica: estantería', id: 'sala_practica', nombre: 'Estante · práctica' },
  { escena: 'Ordenes', datos: { tareas: ['derrame', 'basura', 'vencidos'] }, titulo: '8. Órdenes del supervisor (1)', id: 'ordenes', nombre: 'Órdenes 1' },
  { escena: 'Derrame', lugar: 'bebidas', datos: { tiempo: 60 }, titulo: '8. Tarea: limpiar derrame', id: 'derrame', nombre: 'Derrame', enOrden: 'ordenes' },
  { escena: 'Basura', lugar: 'higiene', datos: { tiempo: 45 }, titulo: '8. Tarea: recoger basura', id: 'basura', nombre: 'Basura', enOrden: 'ordenes' },
  { escena: 'Vencidos', lugar: 'alimentos', datos: { tiempo: 90 }, titulo: '8. Tarea: productos vencidos', id: 'vencidos', nombre: 'Vencidos', enOrden: 'ordenes' },
  { escena: 'Cliente', titulo: '8. Tarea: orientar a un cliente', id: 'cliente', nombre: 'Atención cliente' },
  { escena: 'Ordenes', datos: { tareas: ['precios', 'faltantes'] }, titulo: '9. Órdenes del supervisor (2)', id: 'ordenes_2', nombre: 'Órdenes 2' },
  { escena: 'Precios', lugar: 'limpieza', datos: { tiempo: 60 }, titulo: '9. Tarea: precios y ofertas', id: 'precios', nombre: 'Precios', enOrden: 'ordenes_2' },
  { escena: 'Faltantes', lugar: 'bebidas', datos: { tiempo: 90 }, titulo: '9. Tarea: revisar faltantes', id: 'faltantes', nombre: 'Faltantes', enOrden: 'ordenes_2' },
  { escena: 'Fin', titulo: 'Fin del turno' },
];

// Turno 2 (se desbloquea con estrellas): pasillo de limpieza con reloj y tres tareas al azar.
const TURNO_2 = [
  { escena: 'Avatar', datos: { modo: 'trabajo' }, titulo: 'T2. Ropa de trabajo', id: 't2_vestimenta', nombre: 'Vestimenta' },
  { escena: 'Lista', datos: { nivel: 'turno2' }, titulo: 'T2. Lista de productos' },
  { escena: 'Mapa', datos: { nivel: 'turno2', destino: 'bodega' } },
  { escena: 'Bodega', datos: { nivel: 'turno2', tiempo: 60 }, titulo: 'T2. Bodega', id: 't2_bodega', nombre: 'Bodega' },
  { escena: 'Mapa', datos: { nivel: 'turno2', destino: 'pasillo' }, id: 't2_mapa', nombre: 'Mapa' },
  { escena: 'Traslado', datos: { nivel: 'turno2' } },
  { escena: 'Sala', datos: { nivel: 'turno2', tiempo: 120 }, titulo: 'T2. Estantería', id: 't2_sala', nombre: 'Estantería' },
  { escena: 'Ordenes', datos: { tareas: ['derrame', 'basura', 'vencidos', 'precios', 'faltantes'], elegir: 3 }, titulo: 'T2. Órdenes del supervisor', id: 't2_ordenes', nombre: 'Órdenes' },
  { escena: 'Derrame', lugar: 'bebidas', datos: { tiempo: 45 }, id: 't2_derrame', nombre: 'Derrame', enOrden: 't2_ordenes' },
  { escena: 'Basura', lugar: 'higiene', datos: { tiempo: 45 }, id: 't2_basura', nombre: 'Basura', enOrden: 't2_ordenes' },
  { escena: 'Vencidos', lugar: 'alimentos', datos: { tiempo: 60 }, id: 't2_vencidos', nombre: 'Vencidos', enOrden: 't2_ordenes' },
  { escena: 'Precios', lugar: 'limpieza', datos: { tiempo: 45 }, id: 't2_precios', nombre: 'Precios', enOrden: 't2_ordenes' },
  { escena: 'Faltantes', lugar: 'bebidas', datos: { tiempo: 60 }, id: 't2_faltantes', nombre: 'Faltantes', enOrden: 't2_ordenes' },
  { escena: 'Fin', titulo: 'T2. Fin del turno' },
];

// Las tareas con `lugar` llevan antes el mapa: se camina hasta su pasillo.
const conMapa = (pasos) => pasos.flatMap((p) => (p.lugar ? [{ escena: 'Mapa', datos: { destino: p.lugar }, enOrden: p.enOrden, mapa: true }, p] : [p]));
// Días al azar (del día 3 en adelante, al terminar el turno 2): el recorrido del turno 2 con el nivel que
// arma src/lib/dias.js (otro pasillo, otros productos y otra estantería cada día).
const DIAS = TURNO_2.map((p) => ({
  ...p,
  datos: p.datos?.nivel ? { ...p.datos, nivel: 'dia' } : p.datos,
  id: p.id && p.id.replace(/^t2_/, 'd_'),
  enOrden: p.enOrden && p.enOrden.replace(/^t2_/, 'd_'),
  titulo: p.escena === 'Avatar' ? 'Día 3 en adelante (al azar)' : undefined,
}));

export const FLUJO = [
  ...conMapa(TURNO_1).map((p) => ({ ...p, turno: 1 })),
  ...conMapa(TURNO_2).map((p) => ({ ...p, turno: 2 })),
  ...conMapa(DIAS).map((p) => ({ ...p, turno: 3 })),
];
// Primera etapa de cada turno (en el turno 1, la que sigue a crear el personaje).
// (turno 3 = días al azar).
export const inicioTurno = (n) => (n === 1 ? indiceDe('Contrato') : FLUJO.findIndex((p) => p.turno === n));

export const indiceDe = (escena) => FLUJO.findIndex((p) => p.escena === escena);

// true mientras se cierra una etapa (premio o fundido): evita avanzar dos veces o partir un reloj.
let saliendo = false;

export function irA(scene, indice, extra = {}) {
  // Una escena que ya se cerró no cambia de etapa (ej.: COMENZAR esperaba la voz de bienvenida y
  // mientras tanto se eligió otra etapa en el menú).
  if (!scene.sys.isActive()) return;
  saliendo = true;
  estado.paso = indice;
  estado.erroresPaso = 0;
  estado.tarde = false;
  voz.callar();
  const paso = FLUJO[indice];
  const hud = scene.scene.get('Hud');
  hud.detenerReloj();
  // fade con force: si la escena aún está entrando (fadeIn), un fadeOut normal se ignora y nunca termina.
  scene.cameras.main.fade(300, 31, 45, 58, true);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    hud.ocultar();
    hud.mostrarMarcador(paso.escena !== 'Fin');
    saliendo = false;
    scene.scene.start(paso.escena, { ...(paso.datos || {}), ...extra });
  });
}

// Etapa que viene después de la actual.
function proxima() {
  const paso = FLUJO[estado.paso];
  // Tarea encargada desde Órdenes: volver a su tablero.
  if (paso.enOrden && estado.ordenes && !paso.mapa) return { indice: FLUJO.findIndex((p) => p.id === paso.enOrden), extra: { volver: true } };
  let i = estado.paso + 1;
  // Desde Órdenes (ya terminadas): saltar sus tareas (y sus mapas), que se hicieron desde el tablero.
  if (paso.escena === 'Ordenes') while (FLUJO[i].enOrden === paso.id) i++;
  while (FLUJO[i]?.omitir?.()) i++;
  return { indice: Math.min(i, FLUJO.length - 1) };
}

export async function siguiente(scene) {
  if (saliendo) return;
  saliendo = true;
  const hud = scene.scene.get('Hud');
  hud.detenerReloj();
  const paso = FLUJO[estado.paso];
  if (paso.enOrden && estado.ordenes && !paso.mapa) estado.ordenes.hechas++;
  if (paso.id) {
    const r = registrarResultado(paso.id);
    guardarEstrellas(paso.id, r.estrellas);
    await hud.premiar(r);
    if (!scene.sys.isActive()) return; // se cambió de etapa durante el premio
  }
  const { indice, extra } = proxima();
  irA(scene, indice, extra);
}

// Si la etapa tiene tiempo límite, el jefe lo anuncia y parte el reloj.
// Con `anunciar` en false parte sin voz (el jugador ya empezó y está escuchando otra cosa).
// Devuelve false si la voz fue interrumpida.
export async function partirReloj(scene, anunciar = true) {
  const segundos = FLUJO[estado.paso].datos?.tiempo;
  if (!segundos) return true;
  const ok = anunciar === true ? await voz.decir('tiempo_' + segundos) : true;
  if (scene.sys.isActive() && !saliendo) scene.scene.get('Hud').iniciarReloj(segundos);
  return ok;
}
