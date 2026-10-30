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
    location.replace(url.toString());
    return true;
  } catch {
    return false; // sin red o sin version.json: seguir con lo que hay
  }
}
