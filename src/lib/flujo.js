import { estado } from './estado.js';
import { voz } from './voz.js';

// Orden de las etapas del juego (secuencia del documento).
export const FLUJO = [
  { escena: 'Avatar', titulo: '1. Crear personaje' },
  { escena: 'Contrato', titulo: '2. Aviso de contratación' },
  { escena: 'Supervisor', titulo: '3. Presentación con el supervisor' },
  { escena: 'Lista', datos: { nivel: 'tutorial' }, titulo: '4. Lista de productos' },
  { escena: 'Bodega', datos: { nivel: 'tutorial', guiado: true }, titulo: '5. Tutorial: bodega' },
  { escena: 'Traslado', datos: { nivel: 'tutorial' } },
  { escena: 'Sala', datos: { nivel: 'tutorial', guiado: true }, titulo: '5. Tutorial: estantería' },
  { escena: 'Lista', datos: { nivel: 'practica' }, titulo: '6. Práctica: lista nueva' },
  { escena: 'Bodega', datos: { nivel: 'practica' }, titulo: '6. Práctica: bodega' },
  { escena: 'Traslado', datos: { nivel: 'practica' } },
  { escena: 'Sala', datos: { nivel: 'practica' }, titulo: '6. Práctica: estantería' },
  { escena: 'Derrame', titulo: '7. Tarea: limpiar derrame' },
  { escena: 'Basura', titulo: '7. Tarea: recoger basura' },
  { escena: 'Vencidos', titulo: '7. Tarea: productos vencidos' },
  { escena: 'Cliente', titulo: '7. Tarea: orientar a un cliente' },
  { escena: 'Fin', titulo: 'Fin del turno' },
];

export function irA(scene, indice) {
  estado.paso = indice;
  voz.callar();
  const paso = FLUJO[indice];
  scene.cameras.main.fadeOut(300, 31, 45, 58);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.scene.get('Hud').ocultar();
    scene.scene.start(paso.escena, { ...(paso.datos || {}) });
  });
}

export function siguiente(scene) {
  irA(scene, Math.min(estado.paso + 1, FLUJO.length - 1));
}
