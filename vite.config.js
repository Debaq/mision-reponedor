import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';

// Versión = package.json + commit de git (cambia en cada commit aunque no se suba la versión).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
let commit;
try {
  commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  commit = Date.now().toString(36);
}
const VERSION = `${pkg.version}+${commit}`;

// Escribe dist/version.json: el juego lo consulta al abrir para saber si hay una versión nueva.
const archivoVersion = {
  name: 'version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: VERSION, fecha: new Date().toISOString() }),
    });
  },
};

// Dirección pública del juego (con / al final), para la vista previa al compartir el link: WhatsApp
// solo muestra la imagen si su URL es completa. Se toma de URL_SITIO o de "sitio" en package.json.
let SITIO = (process.env.URL_SITIO || pkg.sitio || '').trim();
if (SITIO && !SITIO.endsWith('/')) SITIO += '/';
const vistaPrevia = {
  name: 'vista-previa',
  transformIndexHtml(html) {
    if (SITIO) return html.replaceAll('%SITIO%', SITIO);
    // Sin dirección: imagen relativa (Facebook y Telegram la encuentran; WhatsApp no) y sin og:url.
    if (process.env.NODE_ENV === 'production') {
      console.warn('\n⚠ Falta "sitio" en package.json: al compartir el link en WhatsApp no saldrá la imagen.\n');
    }
    return html.replace(/^\s*<meta property="og:url"[^>]*>\n/m, '').replaceAll('%SITIO%', '');
  },
};

// PWA: un service worker para que el juego funcione sin internet después de abrirlo una vez.
// - Precache: index.html, el JS del juego e íconos (poco peso, se actualiza con cada versión).
// - Imágenes, voces y sonidos (public/assets, ~20 MB): se guardan en caché la primera vez que Boot los
//   carga, con la URL completa (?v=versión). Así no se descargan dos veces. Al cambiar de versión, Boot
//   borra las copias viejas (src/lib/version.js: limpiarCacheVieja).
// - version.json no se guarda nunca: es lo que avisa que hay una versión nueva.
// El manifest es el de public/ y el registro lo hace src/main.js (sin recargas automáticas a mitad del juego).
const pwa = VitePWA({
  injectRegister: false,
  manifest: false,
  workbox: {
    globPatterns: ['index.html', 'assets/*.js', '*.{png,svg,webmanifest}'],
    navigateFallback: 'index.html',
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/.+\.(png|jpe?g|json|mp3)$/.test(url.pathname),
        handler: 'CacheFirst',
        options: {
          cacheName: 'assets-juego',
          cacheableResponse: { statuses: [200] },
          rangeRequests: true,
        },
      },
    ],
  },
});

// base relativa para poder publicar en cualquier carpeta (GitHub Pages, itch.io, etc.)
export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(VERSION) },
  plugins: [archivoVersion, vistaPrevia, pwa],
  build: { chunkSizeWarningLimit: 2000 },
});
