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
    // four pictures drawn in software, with the camera turned between them, which a busy machine takes a while over
    test.setTimeout(120_000);
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
      // until the camera has glided all the way round
      await game.cameraStill();
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
      // with nobody to work it, the room's lamp pulses amber; held at one moment, the picture holds still
      const { rooms } = pp.view;
      const update = rooms.update.bind(rooms);
      /** Light the lamps as they are at the scene's first moment, whenever it is. */
      rooms.update = () => update(0);
      pp.view.turnCamera(1);
      pp.view.target.set(14, 0, 10);
    });
    await noon(game);
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    // until the camera has glided all the way round
    await game.cameraStill();
    await expect(page).toHaveScreenshot('scene-progress-bar-turned.png');
  });

  test('two rooms pencilled in beside a room built, one selected with its inspector open, the other amber', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => {
      const { sim, state } = pp;
      state.money = 100000;
      // the first-time tip is a message of its own, not part of this picture
      state.seenTips.push('sketch');
      const room = sim.createRoom('massage', { x: 12, y: 5, w: 4, h: 4 }, { x: 13, y: 8, dx: 0, dy: 1 });
      sim.placeItem('massage_table', 13, 5, 0, { free: true, roomId: room.id });
      sim.finishRoom(room);
      sim.addSketch('consult', { x: 18, y: 5, w: 4, h: 4 }, { x: 18, y: 6, dx: -1, dy: 0 });
      // a plant in its doorway, so it no longer fits: amber, its label saying why
      sim.placeItem('plant', 17, 6, 0, { free: true });
      const staffroom = sim.addSketch('staffroom', { x: 17, y: 11, w: 4, h: 3 }, { x: 18, y: 11, dx: 0, dy: -1 });
      if (staffroom) pp.tools.select({ kind: 'sketch', id: staffroom.id });
      pp.ui.dismissAllToasts();
      state.speed = 0;
      // with nobody to work it, the room's lamp pulses amber; held at one moment, the picture holds still
      const { rooms } = pp.view;
      const update = rooms.update.bind(rooms);
      /** Light the lamps as they are at the scene's first moment, whenever it is. */
      rooms.update = () => update(0);
      pp.view.target.set(17, 0, 9);
    });
    await noon(game);
    await game.cameraStill();
    // until the inspector has popped in
    await page.waitForFunction(() => !document.querySelector('.pop') && !!document.querySelector('.sketch-head'));
    await game.settle();
    await expect(page).toHaveScreenshot('scene-sketches.png');
  });

  test('the Plans overlay on, with three rooms pencilled in, one remembering a template and one amber', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => {
      const { sim, state } = pp;
      state.money = 100000;
      // the first-time tip is a message of its own, not part of this picture
      state.seenTips.push('sketch');
      const room = sim.createRoom('massage', { x: 12, y: 5, w: 4, h: 4 }, { x: 13, y: 8, dx: 0, dy: 1 });
      sim.placeItem('massage_table', 13, 5, 0, { free: true, roomId: room.id });
      sim.finishRoom(room);
      sim.addSketch('consult', { x: 17, y: 5, w: 4, h: 4 }, { x: 18, y: 8, dx: 0, dy: 1 });
      // a plant in its doorway, so it no longer fits: amber, its label saying why
      sim.addSketch('staffroom', { x: 17, y: 12, w: 3, h: 3 }, { x: 18, y: 12, dx: 0, dy: -1 });
      sim.placeItem('plant', 18, 11, 0, { free: true });
      // a Massage Suite pencilled in from a template: its furniture outlined, its windows blue
      const cozy = {
        type: 'massage' as const,
        w: 4,
        h: 4,
        door: { x: 1, y: 3, dx: 0, dy: 1 },
        windows: [
          { x: 0, y: 1, dx: -1, dy: 0 },
          { x: 3, y: 1, dx: 1, dy: 0 },
        ],
        items: [
          { type: 'massage_table' as const, x: 1, y: 0, rot: 0 },
          { type: 'oil_trolley' as const, x: 3, y: 0, rot: 0 },
          { type: 'plant' as const, x: 3, y: 3, rot: 0 },
        ],
      };
      const placed = {
        rect: { x: 21, y: 8, w: 4, h: 4 },
        door: { x: 22, y: 11, dx: 0, dy: 1 },
        windows: [
          { x: 21, y: 9, dx: -1, dy: 0 },
          { x: 24, y: 9, dx: 1, dy: 0 },
        ],
        items: cozy.items.map((it) => ({ ...it, x: it.x + 21, y: it.y + 8 })),
      };
      sim.pencilTemplate('Cozy 4×4', cozy, placed);
      pp.ui.overlay = 'plans';
      pp.ui.dismissAllToasts();
      state.speed = 0;
      // with nobody to work it, the room's lamp pulses amber; held at one moment, the picture holds still
      const { rooms } = pp.view;
      const update = rooms.update.bind(rooms);
      /** Light the lamps as they are at the scene's first moment, whenever it is. */
      rooms.update = () => update(0);
      pp.view.target.set(18, 0, 9);
    });
    await noon(game);
    await game.cameraStill();
    await page.waitForFunction(() => document.querySelectorAll('#plans-key li').length === 3);
    // the room built's message comes once the game has run a frame
    await game.eval((pp) => {
      pp.ui.dismissAllToasts();
    });
    await game.settle();
    await expect(page).toHaveScreenshot('scene-plans.png');
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
