// What the floor shows while something is in hand: the overlay an item's purchase shows comes up again while it is
// moved, and an item put in hand by a lesson's button shows its overlay from the start.
import { expect, type Game, test } from './fixtures';

/** What the floor is colored by: an overlay, the land, or nothing. */
const floorShown = (game: Game) => game.eval((pp) => pp.floorShown);

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
