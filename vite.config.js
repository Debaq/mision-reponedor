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

// base relativa para poder publicar en cualquier carpeta (GitHub Pages, itch.io, etc.)
export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(VERSION) },
  plugins: [archivoVersion],
  build: { chunkSizeWarningLimit: 2000 },
});
