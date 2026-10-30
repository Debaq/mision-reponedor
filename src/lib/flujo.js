import { estado, registrarResultado } from './estado.js';
import { guardarEstrellas } from './perfil.js';
import { voz } from './voz.js';

// Orden de las etapas del juego (secuencia del documento).
// Las etapas con `id` dan estrellas y puntos al terminar; `nombre` es el que aparece en el resumen final.
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
  { escena: 'Derrame', titulo: '7. Tarea: limpiar derrame', id: 'derrame', nombre: 'Derrame' },
  { escena: 'Basura', titulo: '7. Tarea: recoger basura', id: 'basura', nombre: 'Basura' },
  { escena: 'Vencidos', titulo: '7. Tarea: productos vencidos', id: 'vencidos', nombre: 'Vencidos' },
  { escena: 'Cliente', titulo: '7. Tarea: orientar a un cliente', id: 'cliente', nombre: 'Atención cliente' },
  { escena: 'Fin', titulo: 'Fin del turno' },
];

let saliendo = false;

export function irA(scene, indice) {
  saliendo = false;
  estado.paso = indice;
  estado.erroresPaso = 0;
  voz.callar();
  const paso = FLUJO[indice];
  const hud = scene.scene.get('Hud');
  scene.cameras.main.fadeOut(300, 31, 45, 58);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    hud.ocultar();
    hud.mostrarMarcador(paso.escena !== 'Fin');
    scene.scene.start(paso.escena, { ...(paso.datos || {}) });
  });
}

export async function siguiente(scene) {
  if (saliendo) return;
  saliendo = true;
  const paso = FLUJO[estado.paso];
  if (paso.id) {
    const r = registrarResultado(paso.id);
    guardarEstrellas(paso.id, r.estrellas);
    await scene.scene.get('Hud').premiar(r);
    if (!scene.sys.isActive()) return; // se cambió de etapa durante el premio
  }
  irA(scene, Math.min(estado.paso + 1, FLUJO.length - 1));
}
