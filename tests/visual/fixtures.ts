// Helpers for the screenshot tests.
//
// Every test opens the same saved game, paused, with the clock stopped and the 3D scene hidden,
// so the only thing that can change a picture is a change to the interface.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, type Game, test as base } from '../e2e/fixtures';

/** The saved game every screenshot is taken from. Being an old save, it also shows that old saves still load. */
const CENTER = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures/center.json'), 'utf8')) as object;
/** When the fixture game was saved, and the moment every test pretends it is: ten minutes later. */
const SAVED_AT = Date.UTC(2026, 0, 15, 12, 0);
const NOW = SAVED_AT + 10 * 60_000;

/** Put the saved game into the page's storage as the autosave and as a named save, with sound off. */
async function seedStorage(page: Page) {
  await page.evaluate(
    async ([state, savedAt]) => {
      localStorage.clear();
      localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}');
      // the game's own storage code, as served by the dev server
      const saves = (await import(/* @vite-ignore */ `${location.origin}/src/storage/saves.ts`)) as {
        autosave: (state: object, now: number) => void;
        writeSave: (state: object, name: string, id: undefined, now: number) => void;
      };
      saves.autosave(state, savedAt);
      saves.writeSave(state, 'Before the inspectors', undefined, savedAt);
    },
    [CENTER, SAVED_AT] as const,
  );
}

/**
 * Wait until no panel is popping in. A panel pops in a frame or two after it opens, and one that starts while the
 * screenshot has animations stopped is caught on its first frame, shrunk and shifted; so the page has to stay clear for
 * a few frames running. Endless animations, such as a lamp's pulse, do not count.
 */
async function stillPanels(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let clear = 0;
        /** Count the frames in a row with nothing popping in, until there are enough. */
        const check = () => {
          const moving =
            document.querySelector('.pop') !== null ||
            document
              .getAnimations()
              .some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
          clear = moving ? 0 : clear + 1;
          if (clear >= 3) done();
          else requestAnimationFrame(check);
        };
        check();
      }),
  );
}

export interface Screens {
  /** Show the title screen, with the saved game ready to continue. */
  title(): Promise<void>;
  /** Continue the saved game and wait for the interface. */
  play(): Promise<void>;
  /** Compare the whole page with the stored picture of this name. */
  shot(name: string): Promise<void>;
}

export const test = base.extend<{ screens: Screens }>({
  /** Give each test the saved game and a stopped clock. */
  screens: async ({ game, page }, use) => {
    await page.clock.setFixedTime(NOW);
    // the scene is still there to click on, just not in the picture
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        // the version on the title screen changes with every release, so it is left out of the pictures
        style.textContent = '#game, .title-version { opacity: 0 !important; }';
        document.head.appendChild(style);
      });
    });
    /** Show the title screen, with the saved game ready to continue. */
    const title = async () => {
      // starting a game first installs the helpers the other tests use
      await game.start();
      // back at the title screen nothing is running, so nothing saves over what is put in storage next
      await page.reload();
      await seedStorage(page);
      await page.reload();
      // the logo and the backdrop behind it are pictures, so wait for them to arrive
      await expect(page.locator('#title .title-logo img')).toHaveJSProperty('complete', true);
      await page.waitForLoadState('networkidle');
    };
    await use({
      title,
      /** Continue the saved game and wait for the interface. */
      play: async () => {
        await title();
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.waitForFunction(() => window.pp?.state.rooms.length === 4);
        await game.settle();
      },
      /** Compare the whole page with the stored picture of this name. */
      shot: async (name) => {
        await game.settle();
        await stillPanels(page);
        await expect(page).toHaveScreenshot(`${name}.png`);
      },
    });
  },
});

export { expect, type Game };
