// Pictures of the 3D scene itself. Only scenes with nobody in them: people sway and blink, so they never hold still.
import { expect, test } from '../e2e/fixtures';

test.describe('the scene', () => {
  // the one picture of the scene, so the one place the screenshot tests draw it
  test.use({ draw: true });

  test('rooms with windows on every side, at the back, middle and front of the building', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      const { sim } = pp;
      // against the back corner of the building, in the middle, and against the front walls
      const rooms = [
        { rect: { x: 3, y: 3, w: 4, h: 4 }, door: { x: 6, y: 5, dx: 1, dy: 0 } },
        { rect: { x: 12, y: 8, w: 4, h: 4 }, door: { x: 13, y: 11, dx: 0, dy: 1 } },
        { rect: { x: 24, y: 14, w: 4, h: 4 }, door: { x: 24, y: 15, dx: -1, dy: 0 } },
      ];
      for (const { rect, door } of rooms) {
        const room = sim.createRoom('staffroom', rect, door);
        const { x, y, w, h } = rect;
        room.windows.push(
          { x: x + 1, y, dx: 0, dy: -1 },
          { x: x + 2, y, dx: 0, dy: -1 },
          { x, y: y + 1, dx: -1, dy: 0 },
          { x: x + w - 1, y: y + 2, dx: 1, dy: 0 },
          { x: x + 2, y: y + h - 1, dx: 0, dy: 1 },
        );
        room.done = true;
      }
      sim.world.version++;
      pp.state.speed = 0;
    });
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-windows.png');
  });

  test('rooms decorated with every floor and wall', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      const { sim } = pp;
      const floors = ['oak', 'slate', 'terrazzo', 'checker', 'bamboo', 'rainbow', 'starry', 'standard'] as const;
      const walls = ['sage', 'sky', 'paneling', 'botanical', 'tiedye', 'starry', 'standard', 'sage'] as const;
      floors.forEach((floor, i) => {
        const x = 3 + (i % 4) * 6;
        const y = 3 + Math.floor(i / 4) * 7;
        const room = sim.createRoom('staffroom', { x, y, w: 4, h: 4 }, { x: x + 1, y: y + 3, dx: 0, dy: 1 });
        room.done = true;
        sim.decorateRoom(room.id, { floor, wall: walls[i] ?? 'standard' });
      });
      pp.state.speed = 0;
    });
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-decor.png');
  });

  test('a building grown into the land on every side, with a room against its old wall', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      const { sim } = pp;
      // against the old east wall, which comes down as the building grows past it
      const room = sim.createRoom('staffroom', { x: 24, y: 6, w: 4, h: 4 }, { x: 24, y: 7, dx: -1, dy: 0 });
      room.done = true;
      pp.state.stars = 1;
      pp.state.money = 100000;
      for (const side of ['west', 'east', 'back'] as const) sim.buyLand(side);
      pp.state.speed = 0;
    });
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-land.png');
  });
});
