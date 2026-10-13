import { defineConfig } from '@playwright/test';

// Tests that launch the built desktop app. Build first: `yarn test:desktop` does both.
export default defineConfig({
  testDir: 'tests/desktop',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // each test opens a real window, so one at a time
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
});
