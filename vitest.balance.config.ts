import { availableParallelism } from 'node:os';

import { defineConfig } from 'vitest/config';

import base from './vite.config';

/**
 * Worker slots: vitest runs test files in parallel but the tests inside one file one after another, so the playtest
 * file runs once per slot, as a project of its own, and each slot plays every `BALANCE_SLOTS`-th center and seed.
 */
const SLOTS = Number(process.env.BALANCE_SLOTS ?? Math.max(1, availableParallelism() - 1));

// `yarn balance`: the playtest bot plays every campaign center and reports the pace. Slow, and not pass/fail.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    globalSetup: ['tests/balance/merge.ts'],
    maxWorkers: SLOTS,
    projects: Array.from({ length: SLOTS }, (_, slot) => ({
      extends: true as const,
      test: {
        name: `slot ${slot}`,
        include: ['tests/balance/**/*.balance.ts'],
        testTimeout: 1_800_000,
        env: { BALANCE_SLOT: String(slot), BALANCE_SLOTS: String(SLOTS) },
      },
    })),
  },
});
