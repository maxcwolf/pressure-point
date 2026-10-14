import { defineConfig } from '@playwright/test';

import base from './playwright.config';

/** A port of its own, so the checks always run this code and never a dev server already open on the usual one. */
const PORT = 5184;

// Performance checks: the same browser as the end-to-end tests, one test at a time so that no
// test's numbers are skewed by another sharing the processor.
export default defineConfig({
  ...base,
  testDir: 'tests/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `yarn vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
