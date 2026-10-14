import { defineConfig } from '@playwright/test';

const PORT = 5183;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  // every test starts its own game, so they can run side by side even though they share a file
  fullyParallel: true,
  // Each one draws with software WebGL, which is hard on the processor. More than four gains nothing
  // here, and on a four-core CI machine even four starve each other, so CI splits the suite across
  // machines instead (see the e2e job in ci.yml) and runs one at a time on each.
  workers: process.env.CI ? 1 : 4,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // software WebGL, so the game renders the same with or without a GPU
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  // the dev build exposes window.pp, which the tests use to read state and skip ahead in time
  webServer: {
    command: 'yarn dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
