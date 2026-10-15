/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';

import { defineConfig, type Plugin } from 'vite';

/** The game's version, from package.json, which a release tag sets. */
const VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string })
  .version;

/** The dev server's live reload needs a socket to localhost; the built game connects to nothing but itself. */
const DEV_CONNECTIONS = ' ws: http://localhost:*';

/** Take the dev server's connections out of the built game's content security policy. */
const productionPolicy: Plugin = {
  name: 'production-policy',
  apply: 'build',
  /** The page with the dev server's connections taken out of its policy. */
  transformIndexHtml(html) {
    if (!html.includes(DEV_CONNECTIONS)) throw new Error('index.html no longer has the dev connections to remove');
    return html.replace(DEV_CONNECTIONS, '');
  },
};

export default defineConfig({
  // relative base so the built game loads from file:// inside Electron
  base: './',
  plugins: [productionPolicy],
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  server: { port: 5183, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
