import { defineConfig } from 'vitest/config';

import base from './vite.config';

// `yarn balance`: the playtest bot plays every campaign center and reports the pace. Slow, and not pass/fail.
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['tests/balance/**/*.balance.ts'], testTimeout: 1_800_000 },
});
