/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';

import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, type Plugin } from 'vite';

/** The game's version, from package.json, which a release tag sets. */
const VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string })
  .version;

/**
 * The token that lets the build upload its source maps to Sentry, so error reports show the real code. Only the web
 * deploy (.github/workflows/pages.yml) has one; every other build makes no source maps and uploads nothing.
 */
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;

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
  plugins: [
    productionPolicy,
    // last, so it sees the finished bundle
    sentryVitePlugin({
      org: 'max-wolf',
      project: 'pressure-point',
      authToken: SENTRY_AUTH_TOKEN,
      disable: !SENTRY_AUTH_TOKEN,
      release: { name: `pressure-point@${VERSION}` },
      // the maps go to Sentry, not to players
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
      telemetry: false,
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  server: { port: 5183, strictPort: true },
  // hidden: the maps are made for Sentry, and the code does not point browsers at them
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, sourcemap: SENTRY_AUTH_TOKEN ? 'hidden' : false },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Some tests play an hour of the game, which takes a second or two, or several on a busy machine. Vitest's usual
    // five seconds made them fail whenever something else was using the processor, so every test gets thirty.
    testTimeout: 30_000,
  },
});
