// What the floor shows while something is in hand: the overlay an item's purchase shows comes up again while it is
// moved, and an item put in hand by a lesson's button shows its overlay from the start. And fire cover: which rooms a
// Fire Extinguisher in hand would cover, which have none, and whether a door or a machine that can catch fire has one.
import type { Page } from '@playwright/test';

import { expect, type Game, test } from './fixtures';

/** What the floor is colored by: an overlay, the land, or nothing. */
const floorShown = (game: Game) => game.eval((pp) => pp.floorShown);

/**
 * Have the health inspector check the center, though not call while the test runs, and fires break out, so that fire
 * cover matters: the standard center has visits off.
 */
const inspected = (pp: Parameters<Parameters<Game['eval']>[0]>[0]) => {
  pp.state.visitsOn = true;
  pp.state.nextVip = 1e9;
  pp.state.nextInspection = 1e9;
  pp.state.blazesOn = true;
};

/** Hold the mouse over the middle of a tile. */
async function hoverTile(game: Game, page: Page, x: number, y: number) {
  const p = await game.eval((pp, [x, y]) => pp.view.project(x + 0.5, y + 0.5, 0), [x, y] as const);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  return p;
}

test.describe('the overlay of an item in hand', () => {
  test('shows while a built item is moved, as when it was bought, and goes once it is down or put away', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Potted Plant').click();
    await game.hoverHeld();
    await expect.poll(() => floorShown(game)).toBe('decor');
    await game.placeHeld();
    await page.keyboard.press('Escape');
    await expect.poll(() => floorShown(game)).toBeNull();

    await game.clickItem('plant');
    await page.locator('#inspector').getByRole('button', { name: 'Move' }).click();
    await expect(page.locator('#hint')).toContainText('Moving the Potted Plant');
    await game.hoverHeld();
    await expect.poll(() => floorShown(game)).toBe('decor');
    await expect(page.locator('#hint')).toContainText('Surroundings here');
    await game.placeHeld();
    await expect.poll(() => floorShown(game)).toBeNull();

    // picked up again and put away where it stands
    await game.clickItem('plant');
    await page.locator('#inspector').getByRole('button', { name: 'Move' }).click();
    await game.hoverHeld();
    await expect.poll(() => floorShown(game)).toBe('decor');
    await page.keyboard.press('Escape');
    await expect.poll(() => floorShown(game)).toBeNull();
  });

  test('shows while a piece of a blueprint is moved', async ({ game, page }) => {
    await game.start();
    await game.menu('Rooms');
    await game.card('Massage Suite').click();
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
    await game.placeHeld();
    await game.placeHeld();
    await expect.poll(() => floorShown(game)).toBeNull();
    // a treatment table minds the noise where it goes
    await game.clickItem('massage_table');
    await expect(page.locator('#hint')).toContainText('Moving the Massage Table');
    await game.hoverHeld({ inRoom: true });
    await expect.poll(() => floorShown(game)).toBe('calm');
    await game.placeHeld({ inRoom: true });
    await expect.poll(() => floorShown(game)).toBeNull();
  });

  test("shows the temperature for the lesson's heater or cooler, from the first one", async ({ game, page }) => {
    await game.start();
    // the warmest day of the year, so the lesson offers an Air Conditioner, which hums as well as cools
    await game.eval((pp) => {
      const s = pp.state;
      s.speed = 0;
      s.weatherOn = true;
      const start = s.day;
      let warmest = start;
      for (let d = start, most = -Infinity; d < start + 360; d++) {
        s.day = d;
        const out = pp.sim.outdoorTemp();
        if (out > most) [warmest, most] = [d, out];
      }
      s.day = warmest;
      pp.sim.emit({ type: 'lesson', id: 'weather' });
    });
    const modal = page.locator('#modal');
    const place = modal.getByRole('button', { name: 'Place an Air Conditioner' });
    await place.click();
    await expect(modal).toBeEmpty();
    await game.hoverHeld();
    await expect.poll(() => floorShown(game)).toBe('temperature');
    await expect(page.locator('#hint')).toContainText('°F here');
  });
});

test.describe('fire cover', () => {
  test('a room with no Fire Extinguisher near its door says so, and one in hand says which rooms it would cover', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.eval(inspected);
    const inspector = page.locator('#inspector');
    await game.clickRoom('massage');
    await expect(inspector.locator('.fire-cover')).toContainText('No Fire Extinguisher within 10 tiles of the door');
    await inspector.getByRole('button', { name: /Place a Fire Extinguisher/ }).click();
    const hint = page.locator('#hint');
    // in the corridor below the Massage Suite, it reaches every door
    await hoverTile(game, page, 13, 10);
    await expect.poll(() => floorShown(game)).toBe('fire');
    await expect(hint).toContainText('Covers the Consultation Room, the Massage Suite and the Training Room');
    await expect(hint).toContainText('Every room has one near its door');
    // further along, only the Massage Suite's
    const far = await hoverTile(game, page, 22, 10);
    await expect(hint).toContainText('Covers the Massage Suite');
    await expect(hint).toContainText('2 rooms still with none');
    await page.mouse.click(far.x, far.y);
    await page.keyboard.press('Escape');
    await expect.poll(() => floorShown(game)).toBeNull();
    await game.clickRoom('massage');
    await expect(inspector.locator('.fire-cover')).toHaveCount(0);
    await expect(inspector.getByRole('button', { name: /Place a Fire Extinguisher/ })).toHaveCount(0);
    await game.clickRoom('consult');
    await expect(inspector.locator('.fire-cover')).toContainText('No Fire Extinguisher within 10 tiles of the door');

    // the overlay shows the same with nothing in hand
    await page.keyboard.press('Escape');
    await page.locator('#sys').locator('[data-tip^="Overlays"]').click();
    await page
      .locator('#overlay-picker')
      .getByRole('button', { name: /Fire safety/ })
      .click();
    await expect(page.locator('#overlay-key')).toContainText('Needs one');
    await expect(page.locator('#overlay-key')).toContainText('Covered');
    await expect.poll(() => floorShown(game)).toBe('fire');
    expect(game.errors).toEqual([]);
  });

  test('a door being placed, or a machine that can catch fire, says whether an extinguisher is near', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.eval(inspected);
    const hint = page.locator('#hint');
    // a finished room's door being moved
    await game.clickRoom('massage');
    await page.locator('#inspector').getByRole('button', { name: 'Move door' }).click();
    await game.hoverWall('west');
    await expect(hint).toContainText('No Fire Extinguisher near the door: the health inspector fines that');
    await page.keyboard.press('Escape');

    await game.menu('Rooms');
    await game.card('Massage Suite').click();
    await game.dragOutRoom(4, 4);
    const door = await game.hoverWall('south');
    await expect(hint).toContainText('No Fire Extinguisher near the door: the health inspector fines that');
    await game.clickWall('south');
    // one held in the blueprint covers nothing until the room is built
    await game.eval((pp) => pp.tools.startItem('fire_extinguisher'));
    await game.hoverHeld({ inRoom: true });
    await expect(hint).toContainText(/Covers .* is built/);
    // a Hot Stone Kiln in the blueprint, whose door has none near it
    await game.eval((pp) => pp.tools.startItem('stone_kiln'));
    await game.hoverHeld({ inRoom: true });
    await expect(hint).toContainText('No Fire Extinguisher near the door: a fire here would spread');
    // one put down just outside the door
    await game.eval(
      (pp, d) => {
        for (let i = 2; i < 8; i++)
          if (pp.sim.placeItem('fire_extinguisher', d.x + d.dx * i, d.y + d.dy * i, 0)) return;
        throw new Error('nowhere for the extinguisher');
      },
      { x: door.x, y: door.y, dx: door.dx, dy: door.dy },
    );
    await page.mouse.move(5, 5);
    await game.hoverHeld({ inRoom: true });
    await expect(hint).toContainText('Fire Extinguisher near the door');
    await expect(hint).not.toContainText('No Fire Extinguisher');
    expect(game.errors).toEqual([]);
  });
});
