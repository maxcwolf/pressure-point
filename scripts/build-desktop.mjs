// Bundles the desktop shell: the main process and the preload script, each into CommonJS with every package it uses
// built in. A sandboxed preload cannot load other files, so the two are built separately and share no chunks.
import { readFileSync } from 'node:fs';

import { sentryVitePlugin } from '@sentry/vite-plugin';
import { build } from 'vite';

const entries = { main: 'electron/main.ts', preload: 'electron/preload.ts' };

/** The game's version, from package.json, as vite.config.ts has it for the game. */
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/**
 * Lets the build upload the main process's source maps to Sentry, as vite.config.ts does the game's. Without it the
 * build makes no source maps and uploads nothing.
 */
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;

for (const [name, entry] of Object.entries(entries)) {
  const main = name === 'main';
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    // the same release name the game's reports use (electron/reports.ts)
    define: { __APP_VERSION__: JSON.stringify(VERSION) },
    // Built for Node, as the server side of a site is: Node's own modules are left to Node, and packages give their
    // Node code rather than what they would give a browser. But every package is bundled in, not loaded from
    // node_modules, which electron-builder fills only with the dependencies in package.json. That goes for Sentry's
    // Electron SDK too: shipped in node_modules instead, it would bring every package it depends on, a native parser
    // among them, where bundled it brings only the code the main process runs.
    ssr: { noExternal: true },
    // The main process's reports come with source maps, like the game's: hidden, as nothing points at them, and
    // matched to the reports by the debug ids the Sentry plugin writes into the bundle, wherever the app is installed.
    plugins: main
      ? [
          sentryVitePlugin({
            org: 'max-wolf',
            project: 'pressure-point',
            authToken: SENTRY_AUTH_TOKEN,
            disable: !SENTRY_AUTH_TOKEN,
            release: { name: `pressure-point@${VERSION}` },
            // the maps go to Sentry, not to players
            sourcemaps: { filesToDeleteAfterUpload: ['dist-electron/**/*.map'] },
            telemetry: false,
          }),
        ]
      : [],
    build: {
      ssr: true,
      outDir: 'dist-electron',
      emptyOutDir: main,
      // the Electron version is pinned, so there is nothing older to support
      target: 'esnext',
      minify: false,
      sourcemap: main && SENTRY_AUTH_TOKEN ? 'hidden' : false,
      lib: {
        entry,
        formats: ['cjs'],
        /** Name the bundle after its entry. */
        fileName: () => `${name}.cjs`,
      },
      rolldownOptions: {
        external: ['electron', /^node:/],
        // electron-updater goes in a file of its own, which the main process loads only once the game is on screen.
        // Sentry and the OpenTelemetry API it uses start with the app, so they stay in the main bundle: in that file,
        // they would load it at once.
        output: {
          codeSplitting: {
            groups: [{ name: 'electron-updater', test: /node_modules[\\/](?!@sentry[\\/]|@opentelemetry[\\/])/ }],
          },
          chunkFileNames: '[name].cjs',
        },
      },
    },
  });
}
