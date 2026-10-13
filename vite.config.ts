import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the built game loads from file:// inside Electron
  base: './',
  server: { port: 5183, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
