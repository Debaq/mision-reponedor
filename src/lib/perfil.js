import { estado } from './estado.js';

// Progreso guardado en el navegador, por nombre de jugador.
// Sirve para los desbloqueos: cuentan las mejores estrellas de cada etapa.
const CLAVE = 'mision-reponedor:perfiles';

function leerTodos() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || {};
  } catch {
    return {};
  }
}

function escribirTodos(perfiles) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(perfiles));
  } catch {
    // Navegador sin almacenamiento (modo privado): se juega igual, sin guardar.
  }
}

const claveDe = (nombre) => nombre.trim().toLowerCase();

export function perfil(nombre = estado.nombre) {
  const p = leerTodos()[claveDe(nombre)] || {};
  return { mejores: {}, record: 0, partidas: 0, ...p };
}

function modificar(cambio) {
  if (!estado.nombre) return;
  const todos = leerTodos();
  const p = perfil();
  cambio(p);
  todos[claveDe(estado.nombre)] = p;
  escribirTodos(todos);
}

export function guardarEstrellas(id, estrellas) {
  modificar((p) => {
    p.mejores[id] = Math.max(p.mejores[id] || 0, estrellas);
  });
}

export function guardarPartida(puntos) {
  modificar((p) => {
    p.partidas++;
    p.record = Math.max(p.record, puntos);
  });
}

// Días de trabajo terminados: 2 = terminó el turno 2 (se desbloquean los días al azar); 3, 4... = días.
export function guardarDia(n) {
  modificar((p) => {
    p.dia = Math.max(p.dia || 0, n);
  });
}

export const ultimoDia = (nombre = estado.nombre) => perfil(nombre).dia || 0;

// Suma de las mejores estrellas de cada etapa (para desbloquear ropa y secciones).
export function estrellasGuardadas(nombre = estado.nombre) {
  return Object.values(perfil(nombre).mejores).reduce((a, b) => a + b, 0);
}
