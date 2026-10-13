// Bundles the desktop shell: the main process and the preload script, each into one CommonJS file.
// A sandboxed preload cannot load other files, so the two are built separately and share no chunks.
import { build } from 'vite';

const entries = { main: 'electron/main.ts', preload: 'electron/preload.ts' };

for (const [name, entry] of Object.entries(entries)) {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    build: {
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
      rolldownOptions: { external: ['electron', /^node:/] },
    },
  });
}
