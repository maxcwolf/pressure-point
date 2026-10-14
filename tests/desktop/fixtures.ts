// Helpers for driving the built desktop app.
//
// The app is launched with its own throwaway profile, so nothing here can touch
// games a player has saved on this machine.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { _electron as electron, type ElectronApplication, type Page, test as base } from '@playwright/test';

/** Set PP_APP to a packaged app's executable to test that instead of the build in this folder. */
const PACKAGED_APP = process.env.PP_APP;

/** Lets the game fall back to drawing in software where there is no graphics card, as on CI machines. */
const SOFTWARE_WEBGL = ['--enable-unsafe-swiftshader'];

export interface Desktop {
  /** Where this test's copy of the app keeps its saves and settings. */
  profile: string;
  /** Open the app and wait for the title screen. Safe to call again after the app has quit. */
  launch(): Promise<{ app: ElectronApplication; page: Page }>;
}

export const test = base.extend<{ desktop: Desktop }>({
  /** Give each test a throwaway profile and a way to launch the app, then clean up. */
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixtures argument to be destructured
  desktop: async ({}, use) => {
    // the real path, since macOS reaches its temporary folder through a link
    const profile = realpathSync(mkdtempSync(path.join(tmpdir(), 'pressure-point-desktop-')));
    const apps: ElectronApplication[] = [];
    await use({
      profile,
      /** Open the app on the test profile with sound off and wait for the title screen. */
      launch: async () => {
        const args = [`--user-data-dir=${profile}`, ...SOFTWARE_WEBGL];
        const app = await electron.launch(
          PACKAGED_APP ? { executablePath: PACKAGED_APP, args } : { args: ['.', ...args] },
        );
        apps.push(app);
        const used = await app.evaluate(({ app }) => app.getPath('userData'));
        if (realpathSync(used) !== profile) {
          await app.close();
          throw new Error(`the app ignored its test profile and opened ${used}`);
        }
        const page = await app.firstWindow();
        // quiet, so a test run does not play the game's music out loud
        await page.evaluate(() => {
          localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}');
        });
        await page.reload();
        await page.locator('#title .title-logo').waitFor();
        return { app, page };
      },
    });
    // a test that quit the app has nothing left to close
    for (const app of apps) await app.close().catch(() => undefined);
    rmSync(profile, { recursive: true, force: true });
  },
});

export { expect } from '@playwright/test';

/** Start a new game from the title screen. */
export async function newGame(page: Page) {
  await page.getByRole('button', { name: 'New game' }).click();
  await page.locator('#stats').waitFor();
}

/** Open the pause menu. */
export async function openPauseMenu(page: Page) {
  await page.locator('#sys').getByTitle('Menu').click();
}
