import { defineConfig } from 'vite';

// base relativa para poder publicar en cualquier carpeta (GitHub Pages, itch.io, etc.)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
