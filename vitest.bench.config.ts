import { defineConfig } from 'vitest/config';

import base from './vite.config';

// `yarn bench`: timings of the simulation, kept out of `yarn test` because they depend on the machine.
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['tests/bench/**/*.bench.ts'], testTimeout: 300_000 },
});
