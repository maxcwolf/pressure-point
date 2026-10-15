import { defineConfig } from '@playwright/test';

import type { GameOptions } from './tests/e2e/fixtures';

/** The dev server's port: 5183 as usual, or another set in E2E_PORT, so a second checkout can run its own. */
const PORT = Number(process.env.E2E_PORT ?? 5183);
/** Point the suite at another running build with VISUAL_URL, for example to compare against an older version. */
const elsewhere = process.env.VISUAL_URL;

// Screenshot tests: every screen of the interface, compared with the pictures in tests/visual/screenshots.
export default defineConfig<GameOptions>({
  testDir: 'tests/visual',
  // pictures differ from one operating system to the next, so each keeps its own set
  snapshotPathTemplate: '{testDir}/screenshots/{platform}/{arg}{ext}',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // each test runs a software-rendered game, so too many at once and a picture never settles
  workers: 3,
  expect: { timeout: 20_000, toHaveScreenshot: { animations: 'disabled' } },
  use: {
    // the interface pictures hide the 3D scene, so the game skips drawing it; the scene's own pictures draw
    draw: false,
    baseURL: elsewhere ?? `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // software WebGL, so the game runs the same with or without a GPU
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  ...(elsewhere
    ? {}
    : {
        webServer: {
          command: `yarn vite --port ${PORT} --strictPort`,
          url: `http://localhost:${PORT}`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }),
});
