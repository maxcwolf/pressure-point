// The clock stops while a room or an item is being placed and starts again once it is down.
import type { Page } from '@playwright/test';

import { expect, type Game, test } from './fixtures';

/** The game's speed: 0 while the clock is stopped. */
const speedOf = (game: Game) => game.eval((pp) => pp.state.speed);

/** Drag out a four-by-four Massage Suite and put its door in the south wall, which opens the blueprint. */
const startSuite = async (game: Game) => {
  await game.menu('Rooms');
  await game.card('Massage Suite').click();
  await game.dragOutRoom(4, 4);
  await game.clickWall('south');
};

/** Open the settings from the pause menu. */
const openSettings = async (page: Page) => {
  await page.locator('#sys').locator('[data-tip="Menu"]').click();
  await page.getByRole('button', { name: 'Settings' }).click();
};

test.describe('pausing to place', () => {
  test('the clock stops while a room is placed and furnished, and runs again at its speed once built', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => (pp.state.speed = 2));
    await game.menu('Rooms');
    await game.card('Massage Suite').click();
    await expect.poll(() => speedOf(game)).toBe(0);
    await expect(page.locator('#stats .speed.on')).toHaveAccessibleName(/Pause/);
    const day = await game.eval((pp) => pp.state.day);
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
    await game.placeHeld();
    await game.placeHeld();
    await game.settle();
    expect(await speedOf(game)).toBe(0);
    expect(await game.eval((pp) => pp.state.day), 'no time has passed').toBe(day);
    await page.locator('#plan').getByRole('button', { name: 'Build room' }).click();
    await expect.poll(() => speedOf(game)).toBe(2);
    await expect(page.locator('#stats .speed.on')).toHaveAccessibleName(/Fast \(2\)/);
  });

  test('an item stops it too, and putting it away starts it again unless the player paused or played by hand', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => (pp.state.speed = 3));
    await game.menu('Items');
    await game.card('Bench').click();
    await expect.poll(() => speedOf(game)).toBe(0);
    await game.placeHeld();
    await game.settle();
    expect(await speedOf(game), 'held for another').toBe(0);
    await page.keyboard.press('Escape');
    await expect.poll(() => speedOf(game)).toBe(3);

    // a player who had paused stays paused
    await page.keyboard.press('Space');
    expect(await speedOf(game)).toBe(0);
    await startSuite(game);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.locator('#plan')).toBeEmpty();
    await game.settle();
    expect(await speedOf(game)).toBe(0);

    // and one who starts the clock by hand while placing keeps it going as they set it
    await page.keyboard.press('2');
    await game.menu('Items');
    await game.card('Plant').click();
    await expect.poll(() => speedOf(game)).toBe(0);
    await page.keyboard.press('1');
    await game.settle();
    expect(await speedOf(game), 'not stopped again').toBe(1);
    await page.keyboard.press('Escape');
    await game.settle();
    expect(await speedOf(game)).toBe(1);
  });

  test('the switch in Settings turns it off', async ({ game, page }) => {
    await game.start();
    await openSettings(page);
    const toggle = page.getByRole('switch', { name: 'Pause while placing' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await game.eval((pp) => (pp.state.speed = 2));
    await game.menu('Items');
    await game.card('Bench').click();
    await game.settle();
    expect(await speedOf(game)).toBe(2);
  });
});
