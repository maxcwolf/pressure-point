import { defineConfig } from '@playwright/test';

import type { GameOptions } from './tests/e2e/fixtures';

/** The dev server's port: 5183 as usual, or another set in E2E_PORT, so a second checkout can run its own. */
const PORT = Number(process.env.E2E_PORT ?? 5183);

export default defineConfig<GameOptions>({
  testDir: 'tests/e2e',
  timeout: 60_000,
  // every test starts its own game, so they can run side by side even though they share a file
  fullyParallel: true,
  // With drawing off (below), a test is light, but each still runs a whole browser. More than four gains nothing here,
  // and CI's four-core machines run two each, with the suite split across machines (see the e2e job in ci.yml).
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // these tests check what the game does, not how it looks, so it skips drawing frames (the screenshot tests draw)
    draw: false,
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // software WebGL, so the game renders the same with or without a GPU
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  // the dev build exposes window.pp, which the tests use to read state and skip ahead in time
  webServer: {
    command: `yarn vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
