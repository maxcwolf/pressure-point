// The clock stops while a room or an item is being placed and starts again once it is down, and a piece of furniture
// put in a room not yet built can be picked up and put down elsewhere in it.
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

    // Space while placing starts the clock, as it does anywhere, and the clock is theirs from then on
    await game.menu('Items');
    await game.card('Plant').click();
    await expect.poll(() => speedOf(game)).toBe(0);
    await page.keyboard.press('Space');
    expect(await speedOf(game)).toBe(1);
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    await game.settle();
    expect(await speedOf(game), 'paused again by hand, it stays paused').toBe(0);
  });

  test('the pause button pressed while placing keeps the game paused once placing is done', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => (pp.state.speed = 2));
    await game.menu('Items');
    await game.card('Bench').click();
    await expect.poll(() => speedOf(game)).toBe(0);
    await page.locator('#stats').getByRole('button', { name: 'Pause (Space)' }).click();
    await page.keyboard.press('Escape');
    await game.settle();
    expect(await speedOf(game)).toBe(0);
  });

  test('the switch in Settings turns it off, and turned off while placing, the clock goes back at once', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => (pp.state.speed = 2));
    await game.menu('Items');
    await game.card('Plant').click();
    await expect.poll(() => speedOf(game)).toBe(0);
    await openSettings(page);
    const toggle = page.getByRole('switch', { name: 'Pause while placing' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    // the Plant still in hand
    await expect.poll(() => speedOf(game)).toBe(2);
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('item');
    await page.keyboard.press('Escape');
    await game.menu('Items');
    await game.card('Bench').click();
    await game.settle();
    expect(await speedOf(game)).toBe(2);
  });
});

test.describe('moving furniture before the room is built', () => {
  test('a piece in a blueprint is picked up with a click and put down elsewhere in the room, for nothing', async ({
    game,
    page,
  }) => {
    await game.start();
    await startSuite(game);
    await game.placeHeld();
    await game.placeHeld();
    await expect(page.locator('#hint')).toContainText('click a piece in the room to move it');
    const money = await game.eval((pp) => pp.state.money);
    const before = await game.eval((pp) => pp.state.items.find((i) => i.type === 'massage_table')!);
    // it glows under the pointer, as something a click would pick up
    const at = await game.itemPoint('massage_table');
    await page.mouse.move(at.x, at.y, { steps: 4 });
    await expect.poll(() => game.eval((pp) => pp.view.overlays.hovered)).toEqual({ kind: 'item', id: before.id });
    await game.clickItem('massage_table');
    expect(await game.eval((pp) => pp.tools.tool.sub)).toMatchObject({ kind: 'move', id: before.id });
    await expect(page.locator('#hint')).toContainText('Moving the Massage Table');
    const spot = await game.placeHeld({ inRoom: true });
    const after = await game.eval((pp, id) => pp.state.items.find((i) => i.id === id)!, before.id);
    expect([after.x, after.y]).toEqual([spot.x, spot.y]);
    expect([after.x, after.y]).not.toEqual([before.x, before.y]);
    expect(await game.eval((pp) => [pp.state.money, pp.state.rooms[0]!.done])).toEqual([money, false]);
    expect(await game.eval((pp) => pp.tools.tool.sub)).toBeNull();

    // picked up and called off, it stays where it was
    const trolley = await game.eval((pp) => pp.state.items.find((i) => i.type === 'oil_trolley')!);
    await game.clickItem('oil_trolley');
    await game.hoverHeld({ inRoom: true });
    await page.keyboard.press('Escape');
    await expect(page.locator('#plan')).toContainText('Massage Suite blueprint');
    expect(await game.eval((pp, id) => pp.state.items.find((i) => i.id === id), trolley.id)).toMatchObject({
      x: trolley.x,
      y: trolley.y,
      rot: trolley.rot,
    });

    await page.locator('#plan').getByRole('button', { name: 'Build room' }).click();
    await expect(page.locator('#toasts')).toContainText('Massage Suite built!');
    expect(await game.eval((pp) => pp.state.money)).toBe(money - 7000);
  });
});
