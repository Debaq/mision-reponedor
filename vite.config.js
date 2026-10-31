import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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

// base relativa para poder publicar en cualquier carpeta (GitHub Pages, itch.io, etc.)
export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(VERSION) },
  plugins: [archivoVersion, vistaPrevia],
  build: { chunkSizeWarningLimit: 2000 },
});
