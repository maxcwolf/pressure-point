// Bundles the desktop shell: the main process and the preload script, each into CommonJS with every package it uses
// built in. A sandboxed preload cannot load other files, so the two are built separately and share no chunks.
import { build } from 'vite';

const entries = { main: 'electron/main.ts', preload: 'electron/preload.ts' };

for (const [name, entry] of Object.entries(entries)) {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    // built for Node, as the server side of a site is: Node's own modules are left to Node, and packages give their
    // Node code rather than what they would give a browser. But every package is bundled in, not loaded from
    // node_modules, which electron-builder fills only with the dependencies in package.json.
    ssr: { noExternal: true },
    build: {
      ssr: true,
      outDir: 'dist-electron',
      emptyOutDir: name === 'main',
      // the Electron version is pinned, so there is nothing older to support
      target: 'esnext',
      minify: false,
      lib: {
        entry,
        formats: ['cjs'],
        /** Name the bundle after its entry. */
        fileName: () => `${name}.cjs`,
      },
      rolldownOptions: {
        external: ['electron', /^node:/],
        // electron-updater goes in a file of its own, which the main process loads only once the game is on screen
        output: {
          codeSplitting: { groups: [{ name: 'electron-updater', test: /node_modules/ }] },
          chunkFileNames: '[name].cjs',
        },
      },
    },
  });
}
