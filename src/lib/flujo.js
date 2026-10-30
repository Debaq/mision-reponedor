import { estado, registrarResultado } from './estado.js';
import { guardarEstrellas } from './perfil.js';
import { voz } from './voz.js';

// Orden de las etapas del juego (secuencia del documento).
// Las etapas con `id` dan estrellas y puntos al terminar; `nombre` es el que aparece en el resumen final.
// `enOrden`: tarea que el supervisor encarga desde la escena Órdenes (al terminar se vuelve al tablero).
// `datos.tiempo`: segundos para hacer la tarea (el jefe lo anuncia y aparece el reloj).
export const FLUJO = [
  { escena: 'Avatar', titulo: '1. Crear personaje', id: 'avatar', nombre: 'Vestimenta' },
  { escena: 'Contrato', titulo: '2. Aviso de contratación' },
  { escena: 'Supervisor', titulo: '3. Presentación con el supervisor', id: 'supervisor', nombre: 'Presentación' },
  { escena: 'Lista', datos: { nivel: 'tutorial' }, titulo: '4. Lista de productos' },
  { escena: 'Bodega', datos: { nivel: 'tutorial', guiado: true }, titulo: '5. Tutorial: bodega', id: 'bodega_tutorial', nombre: 'Bodega · tutorial' },
  { escena: 'Traslado', datos: { nivel: 'tutorial' } },
  { escena: 'Sala', datos: { nivel: 'tutorial', guiado: true }, titulo: '5. Tutorial: estantería', id: 'sala_tutorial', nombre: 'Estante · tutorial' },
  { escena: 'Lista', datos: { nivel: 'practica' }, titulo: '6. Práctica: lista nueva' },
  { escena: 'Bodega', datos: { nivel: 'practica' }, titulo: '6. Práctica: bodega', id: 'bodega_practica', nombre: 'Bodega · práctica' },
  { escena: 'Traslado', datos: { nivel: 'practica' } },
  { escena: 'Sala', datos: { nivel: 'practica' }, titulo: '6. Práctica: estantería', id: 'sala_practica', nombre: 'Estante · práctica' },
  { escena: 'Ordenes', titulo: '7. Órdenes del supervisor', id: 'ordenes', nombre: 'Orden de tareas' },
  { escena: 'Derrame', datos: { tiempo: 60 }, titulo: '7. Tarea: limpiar derrame', id: 'derrame', nombre: 'Derrame', enOrden: true },
  { escena: 'Basura', datos: { tiempo: 45 }, titulo: '7. Tarea: recoger basura', id: 'basura', nombre: 'Basura', enOrden: true },
  { escena: 'Vencidos', datos: { tiempo: 90 }, titulo: '7. Tarea: productos vencidos', id: 'vencidos', nombre: 'Vencidos', enOrden: true },
  { escena: 'Cliente', titulo: '7. Tarea: orientar a un cliente', id: 'cliente', nombre: 'Atención cliente' },
  { escena: 'Fin', titulo: 'Fin del turno' },
];

export const indiceDe = (escena) => FLUJO.findIndex((p) => p.escena === escena);

// true mientras se cierra una etapa (premio o fundido): evita avanzar dos veces o partir un reloj.
let saliendo = false;

export function irA(scene, indice, extra = {}) {
  saliendo = true;
  estado.paso = indice;
  estado.erroresPaso = 0;
  estado.tarde = false;
  voz.callar();
  const paso = FLUJO[indice];
  const hud = scene.scene.get('Hud');
  hud.detenerReloj();
  scene.cameras.main.fadeOut(300, 31, 45, 58);
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
  // Tarea encargada desde Órdenes: volver al tablero.
  if (paso.enOrden && estado.ordenes) return { indice: indiceDe('Ordenes'), extra: { volver: true } };
  let i = estado.paso + 1;
  // Desde Órdenes (ya terminadas): saltar las tareas, que se hicieron desde el tablero.
  if (paso.escena === 'Ordenes') while (FLUJO[i].enOrden) i++;
  return { indice: Math.min(i, FLUJO.length - 1) };
}

export async function siguiente(scene) {
  if (saliendo) return;
  saliendo = true;
  const hud = scene.scene.get('Hud');
  hud.detenerReloj();
  const paso = FLUJO[estado.paso];
  if (paso.enOrden && estado.ordenes) estado.ordenes.hechas++;
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
  const ok = anunciar ? await voz.decir('tiempo_' + segundos) : true;
  if (scene.sys.isActive() && !saliendo) scene.scene.get('Hud').iniciarReloj(segundos);
  return ok;
}
