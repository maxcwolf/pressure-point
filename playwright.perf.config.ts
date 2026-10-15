import { defineConfig } from '@playwright/test';

import base from './playwright.config';
import type { GameOptions } from './tests/e2e/fixtures';

/** A port of its own (5184, or PERF_PORT), so the checks never run against a dev server already open on the usual one. */
const PORT = Number(process.env.PERF_PORT ?? 5184);

// Performance checks: the same browser as the end-to-end tests, one test at a time so that no
// test's numbers are skewed by another sharing the processor.
export default defineConfig<GameOptions>({
  ...base,
  testDir: 'tests/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  // the checks count what is drawn, so every frame is
  use: { ...base.use, draw: true, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `yarn vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // always a server of its own, started from this checkout: one already on the port may be running other code
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
