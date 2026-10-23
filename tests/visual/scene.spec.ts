// Pictures of the 3D scene itself. Only scenes with nobody in them: people sway and blink, so they never hold still.
import { NOON_AT } from '../../src/render/daylight';
import { expect, type Game, test } from '../e2e/fixtures';

/** Hold the game at noon on the day it is, so the light is the same in every picture whenever the test stopped the clock. */
const noon = (game: Game) =>
  game.eval((pp, at) => {
    pp.state.day = Math.floor(pp.state.day) + at;
  }, NOON_AT);

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
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-windows.png');
    // and from each of the other sides, with the walls facing the camera cut low and the ones across from it tall
    for (const side of ['north-east', 'north-west', 'south-west']) {
      await game.eval((pp) => pp.view.turnCamera(1));
      // long enough for the camera to glide all the way round
      await page.evaluate(
        () =>
          new Promise<void>((done) => {
            let frames = 0;
            /** Count a frame, and finish after enough. */
            const tick = () => (++frames > 90 ? done() : requestAnimationFrame(tick));
            tick();
          }),
      );
      await expect(page).toHaveScreenshot(`scene-windows-${side}.png`);
    }
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
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-decor.png');
  });

  test('the plots of land around the building, with their boards, outlined by the Expand tool', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.tools.startExpand('east-wing');
      // over the east wing and the garden block past it
      pp.view.target.set(34, 0, 11);
    });
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-expand.png');
  });

  test('a Generator on the front lawn, beside the pavement, with the trees kept clear of it', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.sim.placeItem('generator', 20, 19, 0);
      pp.sim.placeItem('generator', 24, 19, 2);
      pp.view.target.set(21, 0, 17);
    });
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-generator.png');
  });

  test('a plot being built on: bare earth fenced off, with SOLD on its board', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.state.money = 100000;
      pp.sim.buyPlot('east-wing');
      pp.view.target.set(34, 0, 11);
    });
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-site.png');
  });

  test('a building standing apart, with its own door and a path out to the pavement', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      const { sim, state } = pp;
      state.stars = 1;
      state.money = 1000000;
      for (const id of ['east-wing', 'garden-block']) {
        sim.buyPlot(id);
        // the builders done at once
        for (const l of state.land) delete l.ready;
        sim.world.rebuild();
      }
      const room = sim.createRoom('massage', { x: 39, y: 8, w: 4, h: 4 }, { x: 40, y: 11, dx: 0, dy: 1 });
      sim.placeItem('massage_table', 40, 8, 0, { free: true, roomId: room.id });
      sim.finishRoom(room);
      state.speed = 0;
      pp.view.target.set(37, 0, 13);
    });
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-apart.png');
  });

  test('a treatment under way, its progress bar facing the camera turned to look from the north-east', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => {
      const { sim, state } = pp;
      const room = sim.createRoom('massage', { x: 12, y: 8, w: 4, h: 4 }, { x: 13, y: 11, dx: 0, dy: 1 });
      const table = sim.placeItem('massage_table', 13, 8, 0, { free: true, roomId: room.id })!;
      sim.finishRoom(room);
      // a session two fifths of the way through, with nobody on the table, so nothing in the picture moves
      table.serving = 1;
      table.progress = 0.4;
      state.speed = 0;
      pp.view.turnCamera(1);
      pp.view.target.set(14, 0, 10);
    });
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    // long enough for the camera to glide all the way round
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          let frames = 0;
          /** Count a frame, and finish after enough. */
          const tick = () => (++frames > 90 ? done() : requestAnimationFrame(tick));
          tick();
        }),
    );
    await game.settle();
    await expect(page).toHaveScreenshot('scene-progress-bar-turned.png');
  });

  test('a building grown into every plot of land, with a room against its old wall', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      const { sim } = pp;
      // against the old east wall, which comes down as the building grows past it
      const room = sim.createRoom('staffroom', { x: 24, y: 6, w: 4, h: 4 }, { x: 24, y: 7, dx: -1, dy: 0 });
      room.done = true;
      pp.state.unlockAll = true;
      pp.state.money = 1000000;
      for (const o of sim.landOffers()) {
        sim.buyPlot(o.def.id);
        // the builders done at once
        for (const l of pp.state.land) delete l.ready;
        sim.world.rebuild();
      }
      pp.state.speed = 0;
    });
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-land.png');
  });
});
