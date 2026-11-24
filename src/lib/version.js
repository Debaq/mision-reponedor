/* global __VERSION__ */
// Versión del build (la inyecta vite.config.js).
export const VERSION = __VERSION__;

// Agrega la versión a la URL de un asset para que el navegador no use una copia vieja.
export function conVersion(url) {
  return `${url}?v=${encodeURIComponent(VERSION)}`;
}

/**
 * Revisa si hay una versión publicada más nueva que la que está corriendo.
 * Si la hay, recarga con la nueva versión en la URL (así el navegador pide un index.html fresco).
 * Devuelve true si va a recargar.
 */
export async function revisarVersion() {
  if (import.meta.env.DEV) return false;
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const { version } = await r.json();
    if (!version || version === VERSION) return false;
    const url = new URL(location.href);
    // Evita un bucle si el servidor sigue entregando el index viejo.
    if (url.searchParams.get('v') === version) return false;
    url.searchParams.set('v', version);
    // Con service worker, el index.html viene de su caché: hay que instalar el nuevo antes de recargar.
    await actualizarServiceWorker();
    location.replace(url.toString());
    return true;
  } catch {
    return false; // sin red o sin version.json: seguir con lo que hay
  }
}

/**
 * Registra el service worker (public/sw.js lo genera vite-plugin-pwa) para jugar sin internet.
 * Solo en el build publicado. Si el navegador no lo soporta, el juego anda igual pero necesita red.
 */
export function registrarServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {
    // sin service worker: el juego sigue funcionando con red
  });
}

// Busca un service worker nuevo y espera a que tome el control (máx. 10 s, después recarga igual).
async function actualizarServiceWorker() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const cambio = new Promise((ok) => navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true }));
    await reg.update();
    if (!reg.installing && !reg.waiting) return; // no había uno nuevo
    await Promise.race([cambio, new Promise((ok) => setTimeout(ok, 10000))]);
  } catch {
    // sin red o sin service worker: recargar igual
  }
}

/**
 * Deja listos para jugar sin internet los archivos que cargó Boot (URLs completas, con ?v=versión):
 * borra las copias de versiones anteriores y guarda las que falten. En la primera visita el service
 * worker toma el control cuando Boot ya pidió parte de los archivos, y esos no pasan por su caché;
 * aquí se agregan (normalmente salen de la caché del navegador, sin volver a descargarlos).
 */
export async function prepararSinConexion(urls) {
  if (import.meta.env.DEV || !('serviceWorker' in navigator) || !('caches' in window)) return;
  try {
    await navigator.serviceWorker.ready;
    const cache = await caches.open('assets-juego');
    const guardadas = new Set();
    for (const pedido of await cache.keys()) {
      if (new URL(pedido.url).searchParams.get('v') !== VERSION) await cache.delete(pedido);
      else guardadas.add(pedido.url);
    }
    for (const url of urls) {
      if (!guardadas.has(url)) await cache.add(url).catch(() => {});
    }
  } catch {
    // caché no disponible: el juego sigue con red
  }
}
