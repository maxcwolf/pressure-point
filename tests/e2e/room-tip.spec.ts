// Resting the pointer on a room shows its line in a tooltip: who is seen and by whom, and who is waiting, in order.
import type { Page } from '@playwright/test';

import { expect, type Game, test } from './fixtures';

/** Open the settings from the pause menu. */
const openSettings = async (page: Page) => {
  await page.locator('#sys').locator('[data-tip="Menu"]').click();
  await page.getByRole('button', { name: 'Settings' }).click();
};

/** The standard center, open and with the clock stopped, so its lines stay as a test sets them. */
const stillCenter = async (game: Game) => {
  await game.start();
  await game.buildCenter();
  await game.fastForward(2);
  await game.eval((pp) => (pp.state.speed = 0));
};

/** Send guests in and put them in the line at the Massage Table, waiting for treatment. Returns their names. */
const lineUp = (game: Game, count: number) =>
  game.eval((pp, n) => {
    pp.sim.cheat(`guests ${n}`, true);
    const table = pp.state.items.find((i) => i.type === 'massage_table');
    if (!table) throw new Error('no table');
    const guests = pp.state.guests.filter((g) => !table.queue.includes(g.id)).slice(0, n);
    for (const g of guests) {
      g.goal = 'treat';
      g.state = 'waiting';
      g.station = table.id;
      table.queue.push(g.id);
    }
    return guests.map((g) => g.name);
  }, count);

test.describe('the queue on hover', () => {
  test('shows a room’s line after a moment, keeps up with it, and never takes a click', async ({ game, page }) => {
    await stillCenter(game);
    const tip = page.locator('#room-tip');
    await game.hoverRoom('massage');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Massage Suite');
    await expect(tip).toContainText('No line');

    // guests joining the line show while the pointer stays put
    const names = await lineUp(game, 2);
    await expect(tip.locator('li')).toHaveCount(2);
    await expect(tip.locator('li').first()).toContainText(`1. ${names[0] ?? ''}`);
    await expect(tip).not.toContainText('No line');
    expect(await tip.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

    // it points at the room, not at the pointer, so it stays put as the pointer moves about in the room
    const box = await tip.boundingBox();
    const at = await game.eval((pp) => {
      const room = pp.state.rooms.find((r) => r.type === 'massage');
      if (!room) throw new Error('no room');
      return pp.view.project(room.x + 1.5, room.y + room.h - 0.5, 0);
    });
    await page.mouse.move(at.x, at.y, { steps: 3 });
    await game.settle();
    expect(await tip.boundingBox()).toEqual(box);

    // off the rooms, it goes
    await game.hoverLawn();
    await expect(tip).toBeHidden();
  });

  test('goes while a button is held, something is in hand or a menu is open, and stays away from a room clicked', async ({
    game,
    page,
  }) => {
    await stillCenter(game);
    const tip = page.locator('#room-tip');
    await game.hoverRoom('massage');
    await expect(tip).toBeVisible();
    await page.mouse.down();
    await expect(tip).toBeHidden();
    await page.mouse.up();
    await game.settle();
    await expect(tip, 'a room clicked keeps it away until the pointer leaves').toBeHidden();
    await game.hoverLawn();
    await game.hoverRoom('consult');
    await expect(tip).toContainText('Consultation Room');

    await game.menu('Items');
    await expect(tip).toBeHidden();
    await game.card('Plant').click();
    await game.hoverRoom('consult');
    await game.settle();
    await expect(tip, 'with an item in hand').toBeHidden();
    await page.keyboard.press('Escape');
    await game.hoverLawn();
    await game.hoverRoom('consult');
    await expect(tip).toBeVisible();
  });

  test('the switch in Settings turns it off', async ({ game, page }) => {
    await stillCenter(game);
    const tip = page.locator('#room-tip');
    await game.hoverRoom('massage');
    await expect(tip).toBeVisible();
    await openSettings(page);
    await expect(tip, 'under the menu').toBeHidden();
    const toggle = page.getByRole('switch', { name: 'Queue on hover' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: 'Back' }).click();
    const resume = page.getByRole('button', { name: 'Resume' });
    // on a busy machine the pause menu can miss a press made as it opens
    await expect(async () => {
      await resume.click();
      await expect(resume).toBeHidden({ timeout: 1000 });
    }).toPass();
    await game.hoverLawn();
    await game.hoverRoom('massage');
    await expect.poll(() => game.eval((pp) => pp.ui.pointedRoom), 'the pointer is on the room').toBeGreaterThan(0);
    // nothing shows that it is not coming, so wait well past the moment it would have
    await page.waitForTimeout(800);
    await expect(tip).toBeHidden();
  });
});
