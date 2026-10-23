import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

import { DAY_SECONDS, LOAN_MAX } from '../../src/core/data/rules';
import type { Layout } from '../../src/core/room-layout';
import { expect, type Game, test } from './fixtures';

test.describe('drawing', () => {
  // the one test here that draws: the rest check behavior, and the screenshot tests check the pictures
  test.use({ draw: true });

  test('the title screen leads into a fresh, rendering game', async ({ game, page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Pressure Point Institute' })).toBeVisible();
    // a first visit has no save to show or continue
    await expect(page.locator('#title .save-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
    await game.start();
    await expect(page.locator('#stats')).toContainText('$30,000');
    await expect(page.locator('#objectives')).toContainText('Heal 8 guests (0/8)');
    await expect(page.locator('#advisor')).toContainText('Reception Desk');
    await expect.poll(() => game.eval((pp) => pp.view.renderer.info.render.triangles)).toBeGreaterThan(1000);
  });
});

test.describe('starting out', () => {
  test('the changelog opens from the corner of the title screen, marking the version being played', async ({
    page,
  }) => {
    await page.goto('/');
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
    await page.getByRole('button', { name: 'What’s new' }).click();
    const panel = page.locator('#title-changes');
    await expect(panel.getByRole('heading', { name: `v${version}` })).toContainText('This version');
    await expect(panel).toContainText('First release');
    // the button makes way for the panel it opens, and comes back with the menu
    await expect(page.getByRole('button', { name: 'What’s new' })).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByRole('button', { name: 'What’s new' })).toBeVisible();
  });

  test('feedback can be written from the corner of the title screen', async ({ page }) => {
    await page.goto('/');
    // the version says the game is unfinished
    await expect(page.locator('#title .title-version')).toContainText('Alpha');
    await page.getByRole('button', { name: 'Give feedback' }).click();
    const panel = page.locator('#title-feedback');
    const send = panel.getByRole('button', { name: 'Send feedback' });
    // nothing to send until something is written
    await expect(send).toBeDisabled();
    await panel.getByRole('textbox', { name: 'Your feedback' }).fill('The fountain is lovely');
    await send.click();
    // the dev server sends nothing, and says so, keeping what was written
    await expect(panel.getByRole('alert')).toContainText('local build');
    await expect(panel.getByRole('textbox', { name: 'Your feedback' })).toHaveValue('The fountain is lovely');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  test('feedback can be written from the pause menu, with keys going to the box and not the game', async ({
    game,
    page,
  }) => {
    await game.start();
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'Give feedback' }).click();
    const box = page.locator('#modal').getByRole('textbox', { name: 'Your feedback' });
    await box.click();
    await page.keyboard.type('rooms built here');
    await expect(box).toHaveValue('rooms built here');
    await expect(page.locator('#modal')).toContainText('Give feedback');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save or load' })).toBeVisible();
    expect(game.errors).toEqual([]);
  });

  test('music and sound can be switched off on the title screen', async ({ game, page }) => {
    await page.goto('/');
    const music = page.locator('#title').locator('[data-tip="Music"]');
    const sound = page.locator('#title').locator('[data-tip="Sound effects"]');
    await expect(music).toHaveAttribute('aria-pressed', 'true');
    await music.click();
    await expect(music).toHaveAttribute('aria-pressed', 'false');
    await sound.click();
    await expect(sound.locator('use')).toHaveAttribute('href', '#icon-ui-mute');
    expect(await page.evaluate(() => localStorage.getItem('pressure-point-audio'))).toBe(
      '{"sound":false,"music":false}',
    );
    // the choice carries into the game, and survives a reload
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await page.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => !!window.pp);
    await expect(page.locator('#sys').locator('[data-tip="Music"]')).toHaveClass(/off/);
    await expect(page.locator('#sys').locator('[data-tip="Sound effects"]').locator('use')).toHaveAttribute(
      'href',
      '#icon-ui-mute',
    );
    await page.reload();
    await expect(page.locator('#title').locator('[data-tip="Music"]')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#title').locator('[data-tip="Music"]').click();
    await expect(page.locator('#title').locator('[data-tip="Music"]')).toHaveAttribute('aria-pressed', 'true');
    expect(game.errors).toEqual([]);
  });

  test('a reception desk can be placed from the Items menu', async ({ game, page }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Reception Desk').click();
    await expect(page.locator('#hint')).toContainText('click to place');
    await game.placeHeld();
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => pp.state.items.map((i) => i.type))).toEqual(['reception_desk']);
    await expect(page.locator('#stats')).toContainText('$28,800');
    await expect(page.locator('#advisor')).toContainText('Hire a Receptionist');
  });

  test('a placement keeps the next preview out of the way, and one that cannot be paid for shows red first', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Potted Plant').click();
    await game.placeHeld();
    // the pointer has not moved: the next plant does not sit red on the one just put down
    expect(await game.eval((pp) => pp.tools.problem)).toBe('');
    await expect(page.locator('#hint b')).toHaveCount(0);
    // and the price floats off it
    await expect(page.locator('#floaters')).toContainText('-$120');
    // with too little in the bank, the next is red before any click, saying why
    await game.eval((pp) => (pp.state.money = 5));
    await game.hoverHeld();
    await expect(page.locator('#hint b')).toHaveText("Can't afford it");
    expect(game.errors).toEqual([]);
  });

  test('an invalid spot is refused and explained', async ({ game, page }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Bench').click();
    await game.hoverLawn();
    await expect(page.locator('#hint')).toContainText('Must be inside the building');
    await game.clickLawn();
    expect(await game.eval((pp) => pp.state.items.length)).toBe(0);
    // the reason pulses, so the click is seen to be turned down as well as heard
    await expect(page.locator('#hint b.refused')).toHaveCount(1);
  });

  test('the newer items wait for their stars, or karma', async ({ game }) => {
    await game.start();
    await game.menu('Items');
    await expect(game.card('Water Cooler')).toContainText('Corridor');
    await expect(game.card('Mindfulness Arcade')).toContainText('Star 1, or 3 karma');
    await expect(game.card('Aquarium')).toContainText('Star 2, or 5 karma');
    await expect(game.card('Trophy Cabinet')).toContainText('Star 3, or 5 karma');
    await expect(game.card('Koi Pond')).toContainText('6 karma');
  });

  test('locked equipment cannot be picked before its star', async ({ game }) => {
    await game.start();
    await game.menu('Items');
    await expect(game.card('Stone Warmer')).toContainText('Unlocks at star 2');
    await game.card('Stone Warmer').click();
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
  });
});

test.describe('building rooms', () => {
  test('drag out a floor, place a door, then the furniture', async ({ game, page }) => {
    await game.start();
    await game.menu('Rooms');
    await game.card('Consultation Room').click();
    const rect = await game.dragOutRoom(4, 4);
    await expect(page.locator('#hint')).toContainText('place the door');
    const door = await game.clickWall('east');
    // the blueprint opens and hands over the required furniture one piece at a time
    await expect(page.locator('#plan')).toContainText('Consultation Room blueprint');
    await expect(page.locator('#plan')).toContainText('Still needed: Consultation Desk, Chart Cabinet');
    await expect(page.locator('#hint')).toContainText('Place the Consultation Desk inside the room');
    await game.placeHeld();
    await expect(page.locator('#hint')).toContainText('Place the Chart Cabinet inside the room');
    await game.placeHeld();
    await expect(page.locator('#plan')).toContainText('Ready to build');
    // nothing is charged, and the room is not open, until it is confirmed
    expect(await game.eval((pp) => [pp.state.money, pp.state.rooms[0]!.done])).toEqual([28800 + 1200, false]);
    await page.locator('#plan').getByRole('button', { name: 'Build room' }).click();
    await expect(page.locator('#toasts')).toContainText('Consultation Room built!');
    await expect(page.locator('#plan')).toBeEmpty();
    const room = await game.eval((pp) => pp.state.rooms[0]);
    expect(room).toMatchObject({ type: 'consult', ...rect, done: true, door });
    expect(door).toMatchObject({ dx: 1, dy: 0 });
    await expect(page.locator('#stats')).toContainText('$26,000');
    // finishing a room selects it
    await expect(page.locator('#inspector')).toContainText('Prestige');
  });

  test('a room that is too small is refused', async ({ game, page }) => {
    await game.start();
    await game.menu('Rooms');
    await game.card('Massage Suite').click();
    await game.dragOutRoom(2, 2);
    await expect(page.locator('#hint')).not.toContainText('place the door');
    expect(await game.eval((pp) => pp.tools.tool.phase)).toBe('drag');
  });

  test('backing out of a half-built room costs nothing', async ({ game, page }) => {
    await game.start();
    await game.menu('Rooms');
    await game.card('Massage Suite').click();
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
    await expect(page.locator('#hint')).toContainText('Place the Massage Table inside the room');
    await game.placeHeld();
    // the first Esc only puts down what is in hand; the blueprint stays open
    await page.keyboard.press('Escape');
    await expect(page.locator('#plan')).toContainText('Massage Suite blueprint');
    expect(await game.eval((pp) => pp.state.rooms.length)).toBe(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#plan')).toBeEmpty();
    expect(await game.eval((pp) => [pp.state.rooms.length, pp.state.items.length, pp.state.money])).toEqual([
      0, 0, 30000,
    ]);
  });

  test('R rotates furniture before it is placed', async ({ game, page }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Bench').click();
    await game.hoverHeld();
    await page.keyboard.press('r');
    // it goes down the way it is now being held, with no further turning needed
    const spot = await game.placeHeld();
    expect(spot.turns).toBe(0);
    expect(await game.eval((pp) => pp.state.items[0]!.rot)).toBe(1);
  });
});

test.describe('room blueprints', () => {
  /** Drag out a four-by-four Massage Suite and put its door in the south wall, which opens the blueprint. */
  const startSuite = async (game: Game) => {
    await game.start();
    await game.menu('Rooms');
    await game.card('Massage Suite').click();
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
  };

  test('the Build button stays locked until the required furniture is in', async ({ game, page }) => {
    await startSuite(game);
    const build = page.locator('#plan').getByRole('button', { name: 'Build room' });
    await expect(build).toHaveClass(/locked/);
    await build.click();
    await page.keyboard.press('Enter');
    expect(await game.eval((pp) => pp.state.rooms[0]!.done)).toBe(false);
    await game.placeHeld();
    await expect(page.locator('#plan .chip.done')).toHaveCount(2);
    await game.placeHeld();
    await expect(build).not.toHaveClass(/locked/);
    await build.click();
    expect(await game.eval((pp) => [pp.state.rooms[0]!.done, pp.state.money])).toEqual([true, 23000]);
    await expect(page.locator('#inspector')).toContainText('Massage Suite');
  });

  test('windows can be added to the blueprint, and are charged with the room', async ({ game, page }) => {
    await startSuite(game);
    await game.placeHeld();
    await game.placeHeld();
    await page
      .locator('#plan')
      .getByRole('button', { name: /Windows \(0\)/ })
      .click();
    await expect(page.locator('#hint')).toContainText('click a wall to add one');
    const south = await game.clickWall('south');
    const east = await game.clickWall('east');
    await expect(page.locator('#plan')).toContainText('Windows (2)');
    await expect(page.locator('#plan h3')).toContainText('$7,000 + $300');
    expect(await game.eval((pp) => pp.state.rooms[0]!.windows)).toEqual([south, east]);
    // clicking a window again takes it out
    await game.clickWall('east', 'existing-window');
    await expect(page.locator('#plan')).toContainText('Windows (1)');
    expect(await game.eval((pp) => pp.state.rooms[0]!.windows)).toEqual([south]);
    // the door's own stretch of wall is refused
    await game.hoverWall('south', 'door-spot');
    await expect(page.locator('#hint')).toContainText('The door is there');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    expect(await game.eval((pp) => [pp.state.rooms[0]!.done, pp.state.money])).toEqual([true, 30000 - 7000 - 150]);
  });

  test('the door can be moved while planning', async ({ game, page }) => {
    await startSuite(game);
    await game.placeHeld();
    await game.placeHeld();
    await page.locator('#plan').getByRole('button', { name: 'Move door' }).click();
    const moved = await game.clickWall('east');
    expect(moved).toMatchObject({ dx: 1, dy: 0 });
    expect(await game.eval((pp) => pp.state.rooms[0]!.door)).toEqual(moved);
  });

  test('opening a menu keeps the blueprint, and extras from it can go in the room', async ({ game, page }) => {
    await startSuite(game);
    await game.menu('Items');
    await expect(page.locator('#plan')).toContainText('Massage Suite blueprint');
    await game.card('Potted Plant').click();
    await game.placeHeld({ inRoom: true });
    expect(await game.eval((pp) => [pp.state.items.map((i) => i.type), pp.state.money])).toEqual([
      ['plant'],
      30000 - 120,
    ]);
    // it went inside the blueprint's room
    expect(
      await game.eval(
        (pp) => pp.sim.world.zoneAt(pp.state.items[0]!.x, pp.state.items[0]!.y) === pp.state.rooms[0]!.id,
      ),
    ).toBe(true);
    await expect(page.locator('#plan')).toContainText('Still needed: Massage Table, Oil Cart');
    // pick the required table back up from the panel
    await page
      .locator('#plan')
      .getByRole('button', { name: /Massage Table/ })
      .click();
    await game.placeHeld();
    await expect(page.locator('#plan')).toContainText('Still needed: Oil Cart');
    // cancelling refunds the plant along with everything else
    await page.locator('#plan').getByRole('button', { name: 'Cancel' }).click();
    expect(await game.eval((pp) => [pp.state.rooms.length, pp.state.items.length, pp.state.money])).toEqual([
      0, 0, 30000,
    ]);
  });

  test('a blueprint left open when the game closes is torn up and refunded on return', async ({ game, page }) => {
    await startSuite(game);
    await game.placeHeld();
    // a window and a plant, both paid for
    await page
      .locator('#plan')
      .getByRole('button', { name: /Windows/ })
      .click();
    await game.clickWall('east');
    await game.menu('Items');
    await game.card('Potted Plant').click();
    await game.placeHeld({ inRoom: true });
    expect(await game.eval((pp) => pp.state.money)).toBe(30000 - 150 - 120);
    await page.reload();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => [pp.state.rooms.length, pp.state.items.length, pp.state.money])).toEqual([
      0, 0, 30000,
    ]);
  });

  test('a built room can have windows added and its door moved', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    /** Select the Massage Suite and wait for its inspector. */
    const openRoom = async () => {
      await game.clickRoom('massage');
      await expect(page.locator('#inspector')).toContainText('Massage Suite');
    };
    await openRoom();
    await expect(page.locator('#inspector')).toContainText('0 windows');
    const money = await game.eval((pp) => pp.state.money);
    await page
      .locator('#inspector')
      .getByRole('button', { name: /Windows/ })
      .click();
    await game.clickWall('north');
    await game.clickWall('east');
    await page.keyboard.press('Escape');
    expect(
      await game.eval((pp) => [pp.state.rooms.find((r) => r.type === 'massage')!.windows.length, pp.state.money]),
    ).toEqual([2, money - 300]);
    await openRoom();
    await expect(page.locator('#inspector')).toContainText('2 windows');
    await page.locator('#inspector').getByRole('button', { name: 'Move door' }).click();
    const moved = await game.clickWall('east');
    expect(moved).toMatchObject({ dx: 1, dy: 0 });
    expect(await game.eval((pp) => pp.state.rooms.find((r) => r.type === 'massage')!.door)).toEqual(moved);
    await expect(page.locator('#inspector')).toContainText('Massage Suite');
  });

  test('a built room can be picked up and moved, furniture and all, and copied', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    await game.clickRoom('massage');
    await page.locator('#inspector').getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.locator('#hint')).toContainText('Moving the Massage Suite');
    /** The first free spot the suite fits, scanning the lot, and where on screen its middle is. */
    const find = () =>
      game.eval((pp) => {
        const room = pp.state.rooms.find((r) => r.type === 'massage')!;
        const layout = pp.sim.roomLayout(room);
        /** The layout put down with its corner at a tile. */
        const at = (x: number, y: number) => ({
          rect: { x, y, w: layout.w, h: layout.h },
          door: { ...layout.door, x: layout.door.x + x, y: layout.door.y + y },
          windows: [],
          items: layout.items.map((it) => ({ ...it, x: it.x + x, y: it.y + y })),
        });
        for (let y = 0; y < 30; y++)
          for (let x = 0; x < 40; x++) {
            if (Math.abs(x - room.x) < layout.w + 1 && Math.abs(y - room.y) < layout.h + 1) continue;
            if (!pp.sim.world.layoutValid(room.type, at(x, y)).ok) continue;
            const p = pp.view.project(x + layout.w / 2, y + layout.h / 2, 0);
            return { x, y, screen: p, id: room.id };
          }
        throw new Error('nowhere for the suite to go');
      });
    const spot = await find();
    await page.mouse.move(spot.screen.x, spot.screen.y, { steps: 4 });
    await page.mouse.click(spot.screen.x, spot.screen.y);
    const moved = await game.eval((pp, id) => pp.state.rooms.find((r) => r.id === id)!, spot.id);
    expect(moved).toMatchObject({ x: spot.x, y: spot.y });
    await expect(page.locator('#inspector')).toContainText('Massage Suite');

    const rooms = await game.eval((pp) => pp.state.rooms.length);
    await page.locator('#inspector').getByRole('button', { name: /Copy/ }).click();
    await expect(page.locator('#hint')).toContainText('Copying the Massage Suite');
    const copy = await find();
    await page.mouse.move(copy.screen.x, copy.screen.y, { steps: 4 });
    await page.mouse.click(copy.screen.x, copy.screen.y);
    expect(await game.eval((pp) => pp.state.rooms.length)).toBe(rooms + 1);
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
    expect(game.errors).toEqual([]);
  });

  test('a room saved as a template is built again, turned, renamed, exported and imported', async ({
    game,
    page,
  }, testInfo) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    await game.clickRoom('massage');
    await page
      .locator('#inspector')
      .getByRole('button', { name: /Save as template/ })
      .click();
    await expect(page.locator('#toasts')).toContainText('Saved as the template "Massage Suite"');

    await game.menu('Rooms');
    await page.locator('#menu').getByRole('button', { name: 'Templates (1)' }).click();
    const card = page.locator('.card.template');
    await expect(card).toContainText('Massage Suite, 4×4, 2 items');
    // typing a name goes to the name, not to the camera or the tools, and survives the interface redrawing as the
    // game runs, a few times a second
    await game.eval((pp) => (pp.state.speed = 1));
    const name = card.getByLabel('Template name');
    await name.fill('');
    await name.pressSequentially('Corner suite', { delay: 60 });
    await expect(name).toHaveValue('Corner suite');
    await name.press('Enter');
    await expect(name).toHaveValue('Corner suite');
    expect(await page.evaluate(() => localStorage.getItem('pressure-point-room-templates'))).toContain('Corner suite');
    await game.eval((pp) => (pp.state.speed = 0));

    const rooms = await game.eval((pp) => pp.state.rooms.length);
    await card.getByRole('button', { name: 'Build' }).click();
    await expect(page.locator('#hint')).toContainText('Building "Corner suite"');
    await page.keyboard.press('r');
    /** The first free spot the turned suite fits, scanning the lot, and where on screen its middle is. */
    const spot = await game.eval((pp) => {
      const tool = pp.tools.tool as { kind: string; layout: Layout };
      if (tool.kind !== 'template') throw new Error('no template in hand');
      const { layout } = tool;
      for (let y = 0; y < 30; y++)
        for (let x = 0; x < 40; x++) {
          const placed = {
            rect: { x, y, w: layout.w, h: layout.h },
            door: { ...layout.door, x: layout.door.x + x, y: layout.door.y + y },
            windows: [],
            items: layout.items.map((it) => ({ ...it, x: it.x + x, y: it.y + y })),
          };
          if (pp.sim.world.layoutValid(layout.type, placed).ok)
            return { x, y, screen: pp.view.project(x + layout.w / 2, y + layout.h / 2, 0) };
        }
      throw new Error('nowhere for the suite to go');
    });
    await page.mouse.move(spot.screen.x, spot.screen.y, { steps: 4 });
    await page.mouse.click(spot.screen.x, spot.screen.y);
    await expect(page.locator('#toasts')).toContainText('"Corner suite" built for');
    expect(await game.eval((pp) => pp.state.rooms.length)).toBe(rooms + 1);
    expect(await game.eval((pp) => pp.state.rooms.at(-1))).toMatchObject({ type: 'massage', x: spot.x, y: spot.y });
    await page.keyboard.press('Escape');

    await game.menu('Rooms');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      card.getByRole('button', { name: 'Export' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('pressure-point-room-corner-suite.json');
    const file = testInfo.outputPath('template.json');
    await download.saveAs(file);
    await card.getByRole('button', { name: 'Delete' }).click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('#menu')).toContainText('No templates yet');
    await page.locator('#menu .filebtn input').setInputFiles(file);
    await expect(page.locator('#toasts')).toContainText('Imported a template from "template.json"');
    await expect(card.getByLabel('Template name')).toHaveValue('Corner suite');
    expect(game.errors).toEqual([]);
  });

  test('a room is decorated from its inspector, with locked floors and walls offered for karma', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    await game.clickRoom('massage');
    const decor = page.locator('#inspector .decor');
    await expect(decor).toContainText('Floor: Standard');
    await decor.getByRole('button', { name: 'Oak planks', exact: true }).click();
    await decor.getByRole('button', { name: 'Sage', exact: true }).click();
    await expect(decor).toContainText('Floor: Oak planks');
    await expect(decor).toContainText('Walls: Sage');
    expect(await game.eval((pp) => pp.state.rooms.find((r) => r.type === 'massage'))).toMatchObject({
      floor: 'oak',
      wall: 'sage',
    });

    // a fresh campaign has no karma: the offer says what it costs and to earn more
    await decor
      .getByRole('button', { name: /Starry night: unlock/ })
      .first()
      .click();
    await expect(page.locator('.dialog')).toContainText('Unlock the Starry night floor?');
    await page.locator('.dialog').getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('.dialog')).toHaveCount(0);

    await decor.getByRole('button', { name: /Use for every Massage Suite/ }).click();
    await expect(page.locator('#toasts')).toContainText('Every Massage Suite now looks like this one');
    expect(await game.eval((pp) => pp.state.roomDecor)).toEqual({ massage: { floor: 'oak', wall: 'sage' } });
    expect(game.errors).toEqual([]);
  });

  test('equipment is upgraded from its inspector, and a Mechanic installs it', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.state.stars = 1;
    });
    await game.settle();
    await game.clickItem('massage_table');
    const upgrades = page.locator('#inspector .upgrades');
    await expect(upgrades).toContainText('Upgrades ☆☆☆');
    const money = await game.eval((pp) => pp.state.money);
    await upgrades.getByRole('button', { name: /Upgrade to level 1/ }).click();
    await expect(upgrades).toContainText('Waiting for a Mechanic to install the upgrade');
    expect(await game.eval((pp) => pp.state.money)).toBe(money - 1000);

    // a Caretaker who has been on the Mechanics course comes to install it
    await game.eval((pp) => {
      const applicant = pp.state.candidates.find((c) => c.role === 'caretaker');
      const caretaker = applicant && pp.sim.hire(applicant.id);
      if (!caretaker) throw new Error('no Caretaker to hire');
      caretaker.general.push('mechanics');
      const table = pp.state.items.find((it) => it.type === 'massage_table');
      pp.state.speed = 1;
      for (let i = 0; i < 6000 && table?.level === 0; i++) pp.sim.tick(0.1);
      pp.state.speed = 0;
    });
    await expect(upgrades).toContainText('Upgrades ★☆☆');
    await expect(upgrades).toContainText('Wears 30% more slowly');
    await expect(upgrades.getByRole('button', { name: /Level 2 unlocks at star 2/ })).toBeVisible();
    expect(game.errors).toEqual([]);
  });

  test('a built room can be resized by dragging one of its walls', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    await game.clickRoom('massage');
    await page
      .locator('#inspector')
      .getByRole('button', { name: /Resize/ })
      .click();
    // a wall the suite can be pushed out through by two tiles, and where to grab it and let it go on screen
    const plan = await game.eval((pp) => {
      const room = pp.state.rooms.find((r) => r.type === 'massage')!;
      const { x, y, w, h } = room;
      const pushes = [
        { rect: { x, y, w: w + 2, h }, grab: [x + w, y + h / 2], drop: [x + w + 2, y + h / 2] },
        { rect: { x: x - 2, y, w: w + 2, h }, grab: [x, y + h / 2], drop: [x - 2, y + h / 2] },
        { rect: { x, y, w, h: h + 2 }, grab: [x + w / 2, y + h], drop: [x + w / 2, y + h + 2] },
        { rect: { x, y: y - 2, w, h: h + 2 }, grab: [x + w / 2, y], drop: [x + w / 2, y - 2] },
      ];
      const push = pushes.find((p) => pp.sim.world.resizeValid(room, p.rect).ok)!;
      /** Where a point on the ground is on screen. */
      const at = (p: number[]) => pp.view.project(p[0]!, p[1]!, 0);
      return { rect: push.rect, from: at(push.grab), to: at(push.drop), money: pp.state.money };
    });
    await page.mouse.move(plan.from.x, plan.from.y);
    await page.mouse.down();
    await page.mouse.move(plan.to.x, plan.to.y, { steps: 10 });
    await expect(page.locator('#hint')).toContainText('costs $');
    await page.mouse.up();
    const after = await game.eval((pp) => {
      const { x, y, w, h } = pp.state.rooms.find((r) => r.type === 'massage')!;
      return { rect: { x, y, w, h }, money: pp.state.money };
    });
    expect(after.rect).toEqual(plan.rect);
    expect(after.money).toBeLessThan(plan.money);
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
    expect(game.errors).toEqual([]);
  });

  test('placing furniture shows which square is for staff and which is for guests', async ({ game, page }) => {
    await startSuite(game);
    /** The tiles with an icon floating over them. */
    const marked = () =>
      game.eval((pp) => {
        const view = pp.view as unknown as {
          overlays: { markers: { visible: boolean; position: { x: number; z: number } }[] };
        };
        return view.overlays.markers
          .filter((m) => m.visible)
          .map((m) => [Math.floor(m.position.x), Math.floor(m.position.z)]);
      });
    /** The tiles the game says people use this item from, wherever it is being held. */
    const used = (held: { type: string; x: number; y: number; rot: number }) =>
      game.eval(
        (pp, h) =>
          (pp.data.ITEMS as Record<string, { access: unknown[] }>)[h.type]!.access.map((_, i) =>
            pp.geo.accessTile(h, i),
          ),
        held,
      );

    // the massage table is used from two sides: the therapist on one, the guest on the other
    const table = await game.hoverHeld();
    await expect(page.locator('#hint li.legend')).toHaveText(['Massage Therapist', 'guests']);
    await expect(page.locator('#hint li.legend .square').first()).toHaveAttribute('aria-label', /^purple/);
    expect(await marked()).toEqual(await used(table));
    expect(await marked()).toHaveLength(2);
    await game.placeHeld();
    // the oil cart is not used by anyone, so it marks no squares and the hint says nothing about them
    await game.hoverHeld();
    expect(await marked()).toEqual([]);
    await expect(page.locator('#hint li.legend')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    // a bench is for guests only
    await game.menu('Items');
    await game.card('Bench').click();
    const bench = await game.hoverHeld();
    await expect(page.locator('#hint li.legend')).toHaveText(['guests']);
    await expect(page.locator('#hint li.legend .square')).toHaveAttribute('aria-label', /^orange/);
    expect(await marked()).toEqual(await used(bench));
  });
});

test.describe('staff', () => {
  test('are hired from the Hire menu, tab by tab', async ({ game, page }) => {
    await game.start();
    await game.menu('Hire');
    await page.locator('#menu .card.cv').first().getByRole('button', { name: 'Hire' }).click();
    await page.locator('#menu .tab', { hasText: 'Massage Therapist' }).click();
    await expect(page.locator('#menu .quals').first()).toContainText('Swedish');
    await page.locator('#menu .card.cv').first().getByRole('button', { name: 'Hire' }).click();
    expect(await game.eval((pp) => pp.state.staff.map((s) => s.role))).toEqual(['receptionist', 'therapist']);
    await game.menu('Staff');
    await expect(page.locator('#menu .row:not(.head)')).toHaveCount(2);
  });

  test('can be selected in the world, sent on a course and given a raise', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.stars = 1;
      const t = pp.state.staff.find((s) => s.role === 'therapist')!;
      t.quals = ['swedish'];
    });
    await game.fastForward(40);
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    const before = await game.eval((pp) => {
      const t = pp.state.staff.find((s) => s.role === 'therapist')!;
      return { salary: t.salary, state: t.state };
    });
    // standing at the massage table, a click on them must select them and not the table
    expect(before.state).toBe('atPost');
    const spot = { ...(await game.clickStaff('therapist')), salary: before.salary };
    await expect(page.locator('#inspector h3')).toHaveText(spot.name);
    await expect(page.locator('#inspector .tag')).toContainText('Massage Therapist');

    await page.locator('#inspector button.raise').click();
    expect(await game.eval((pp) => pp.state.staff.find((s) => s.role === 'therapist')!.salary)).toBeGreaterThan(
      spot.salary,
    );

    await page.locator('#inspector .course', { hasText: 'Deep Tissue' }).click();
    expect(await game.eval((pp) => pp.state.staff.find((s) => s.role === 'therapist')!.training?.course)).toBe('deep');
    await expect(page.locator('#inspector')).toContainText('Course progress');
    await game.eval((pp) => (pp.state.speed = 1));
    await game.fastForward(80);
    expect(await game.eval((pp) => pp.state.staff.find((s) => s.role === 'therapist')!.quals)).toContain('deep');
    await game.menu('Treatments');
    await expect(game.card('Deep Tissue')).toContainText('1 qualified');
  });

  test('are let go only once the player says they are sure', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    const name = await game.eval((pp) => {
      pp.state.speed = 0;
      const st = pp.state.staff.find((x) => x.role === 'consultant')!;
      pp.tools.select({ kind: 'staff', id: st.id });
      return st.name;
    });
    const insp = page.locator('#inspector');
    const modal = page.locator('#modal');
    /** Whether the consultant is on their way out. */
    const leaving = () => game.eval((pp) => pp.state.staff.find((x) => x.role === 'consultant')?.state === 'leaving');

    // Esc backs out, and so does keeping them on
    await insp.getByRole('button', { name: 'Let go' }).click();
    await expect(modal.locator('h2')).toHaveText(`Are you sure you want to fire ${name}?`);
    await page.keyboard.press('Escape');
    await expect(modal).toBeEmpty();
    await insp.getByRole('button', { name: 'Let go' }).click();
    await modal.getByRole('button', { name: 'Keep them on' }).click();
    await expect(modal).toBeEmpty();
    expect(await leaving()).toBe(false);
    await expect(insp.locator('h3')).toHaveText(name);

    await insp.getByRole('button', { name: 'Let go' }).click();
    await modal.getByRole('button', { name: 'Let go' }).click();
    await expect(modal).toBeEmpty();
    await expect(page.locator('#toasts')).toContainText(`${name} has been let go.`);
    await expect(insp).toBeEmpty();
    expect(await game.eval((pp) => pp.state.staff.some((x) => x.role === 'consultant' && x.state !== 'leaving'))).toBe(
      false,
    );
  });

  test('have a course called off for the fee back only once the player says so', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    const { name, money } = await game.eval((pp) => {
      pp.state.speed = 0;
      pp.state.stars = 1;
      const st = pp.state.staff.find((x) => x.role === 'therapist')!;
      st.quals = ['swedish'];
      pp.tools.select({ kind: 'staff', id: st.id });
      return { name: st.name, money: pp.state.money };
    });
    const insp = page.locator('#inspector');
    const modal = page.locator('#modal');
    await insp.locator('.course', { hasText: 'Deep Tissue' }).click();
    const paid = await game.eval((pp) => pp.state.staff.find((x) => x.role === 'therapist')!.training!.cost);
    expect(await game.eval((pp) => pp.state.money)).toBe(money - paid);
    /** The course the therapist is on, if any. */
    const course = () =>
      game.eval((pp) => pp.state.staff.find((x) => x.role === 'therapist')!.training?.course ?? null);
    const fee = `$${paid.toLocaleString('en-US')}`;

    // Esc backs out, and so does keeping them training
    await insp.getByRole('button', { name: 'Cancel course' }).click();
    await expect(modal.locator('h2')).toHaveText(`Cancel ${name}'s Deep Tissue massage course?`);
    await expect(modal).toContainText(`You'll get ${fee} back.`);
    await page.keyboard.press('Escape');
    await expect(modal).toBeEmpty();
    expect(await course()).toBe('deep');
    await insp.getByRole('button', { name: 'Cancel course' }).click();
    await modal.getByRole('button', { name: 'Keep training' }).click();
    await expect(modal).toBeEmpty();
    expect(await course()).toBe('deep');

    await insp.getByRole('button', { name: 'Cancel course' }).click();
    await modal.getByRole('button', { name: 'Cancel course' }).click();
    await expect(modal).toBeEmpty();
    await expect(page.locator('#toasts')).toContainText(
      `${name} has left the Deep Tissue massage course. ${fee} refunded.`,
    );
    expect(await course()).toBeNull();
    expect(await game.eval((pp) => pp.state.money), 'the whole fee back').toBe(money);
    await expect(insp).not.toContainText('Course progress');
    await expect(insp.getByRole('button', { name: 'Cancel course' })).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.staff.find((x) => x.role === 'therapist')!.quals)).not.toContain('deep');
  });

  test('show in the Staff menu what each one knows, narrowed to those who know a treatment', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    const name = await game.eval((pp) => {
      pp.state.speed = 0;
      const st = pp.state.staff.find((x) => x.role === 'therapist')!;
      st.quals = ['swedish', 'deep'];
      return st.name;
    });
    await game.menu('Staff');
    const rows = page.locator('#menu .row:not(.head)');
    await expect(rows).toHaveCount(3);
    await expect(rows.filter({ hasText: name }).locator('.knows .quals > span')).toHaveText(['Swedish', 'Deep Tissue']);
    // those with no treatments say what they do instead
    await expect(rows.locator('.knows')).toContainText(['Receptionist', 'Wellness Consultant', 'Swedish']);

    const filters = page.locator('#menu .tabs.knows .tab');
    await expect(filters).toHaveText(['Everyone', 'Swedish 1', 'Deep Tissue 1']);
    await filters.filter({ hasText: 'Deep Tissue' }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(name);
    // pressed again, it lets go
    await filters.filter({ hasText: 'Deep Tissue' }).click();
    await expect(rows).toHaveCount(3);
  });

  test('can be compared side by side in the inspector', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    const { therapist, consultant, second } = await game.eval((pp) => {
      pp.state.speed = 0;
      const t = pp.state.staff.find((x) => x.role === 'therapist')!;
      const c = pp.state.staff.find((x) => x.role === 'consultant')!;
      const t2 = pp.sim.hire(pp.state.candidates.find((x) => x.role === 'therapist')!.id)!;
      t.quals = ['swedish'];
      t.served = 12;
      c.served = 30;
      pp.tools.select({ kind: 'staff', id: t.id });
      return { therapist: t.name, consultant: c.name, second: t2.name };
    });
    const insp = page.locator('#inspector');
    await insp.getByRole('button', { name: 'Compare' }).click();
    // only the others in the same role, until everyone is asked for
    const picks = insp.locator('.compare-pick button.pick');
    await expect(picks).toHaveCount(1);
    await expect(picks).toContainText(second);
    await insp.getByRole('button', { name: 'Everyone' }).click();
    await expect(picks).toHaveCount(3);
    await expect(picks.first()).toContainText(second);
    await insp.locator('.compare-pick button.pick', { hasText: consultant }).click();

    const table = insp.locator('.compare-table');
    await expect(table.locator('thead th')).toHaveText([therapist.split(' ')[0]!, consultant.split(' ')[0]!]);
    await expect(table.locator('tr', { hasText: 'Role' })).toHaveCount(1);
    const served = table.locator('tr', { hasText: 'Guests served' }).locator('td');
    await expect(served).toHaveText(['12', '30']);
    await expect(served.nth(1)).toHaveClass(/ahead/);
    await expect(table.locator('tr', { hasText: 'Swedish' }).locator('td')).toHaveText(['✔', '—']);

    // going to the other keeps the two compared, the other way round
    await insp.getByRole('button', { name: /^Go to / }).click();
    await expect(insp.locator('h3')).toHaveText(consultant);
    await expect(table.locator('thead th')).toHaveText([consultant.split(' ')[0]!, therapist.split(' ')[0]!]);

    await insp.getByRole('button', { name: 'Done comparing' }).click();
    await expect(table).toHaveCount(0);
  });
});

test.describe('running a center', () => {
  test('guests arrive, are treated and pay', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await expect(page.locator('#toasts')).toContainText('Grand opening');
    await game.fastForward(480);
    const stats = await game.eval((pp) => ({ ...pp.state.stats, money: pp.state.money }));
    expect(stats.arrived).toBeGreaterThan(5);
    expect(stats.healed).toBeGreaterThan(0);
    await expect(page.locator('#stats')).toContainText(`${stats.healed} healed`);
    await game.draw();
    await expect.poll(() => game.eval((pp) => pp.view.renderer.info.render.triangles)).toBeGreaterThan(5000);
  });

  test('a guest can be inspected', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(60);
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    // a guest in plain view: nobody standing in front of them and no HUD panel over them
    const spot = await game.clickGuest();
    await expect(page.locator('#inspector h3')).toHaveText(spot.name);
    await expect(page.locator('#inspector')).toContainText('Patience');
    await page.locator('#inspector .x').click();
    await expect(page.locator('#inspector')).toBeEmpty();
  });

  test('the Money menu lends money and changes prices', async ({ game, page }) => {
    await game.start();
    await game.menu('Money');
    const menu = page.locator('#menu');
    await menu.getByRole('button', { name: /Loan/ }).click();
    await page.getByRole('button', { name: 'Borrow $5,000' }).click();
    await expect(page.locator('#stats')).toContainText('$35,000');
    await expect(menu).toContainText('Loan: $5,000 of $50,000');
    await menu.getByRole('button', { name: /Prices/ }).click();
    await page.getByRole('button', { name: '+10%' }).click();
    await expect(menu).toContainText('Overall: 110% of standard');
    await menu.getByRole('button', { name: /Loan/ }).click();
    await page.getByRole('button', { name: 'Repay $5,000' }).click();
    expect(await game.eval((pp) => [pp.state.loan, pp.state.money, pp.state.priceLevel])).toEqual([0, 30000, 1.1]);
  });

  test('the Policy menu sets the diagnosis threshold, emergencies first and breaks', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.menu('Policy');
    const menu = page.locator('#menu');
    await expect(menu).toContainText('75% sure');
    await menu.locator('.stepper').filter({ hasText: 'Treat once' }).getByRole('button', { name: '+' }).click();
    await expect(menu).toContainText('80% sure');
    await menu.getByRole('button', { name: /Emergencies first: off/ }).click();
    await expect(menu).toContainText('Emergencies first: on');
    await menu.locator('.stepper').filter({ hasText: 'Take a break' }).getByRole('button', { name: '+' }).click();
    // no limit on breaks to begin with; stepping down from it starts at five
    await menu.locator('.stepper').filter({ hasText: 'Massage Therapists' }).getByRole('button', { name: '−' }).click();
    await expect(menu.locator('.stepper').filter({ hasText: 'Massage Therapists' })).toContainText('5');
    expect(await game.eval((pp) => pp.state.policy)).toEqual({
      diagnosis: 0.8,
      emergenciesFirst: true,
      breakAt: 23,
      breakLimit: { therapist: 5 },
      stashMushrooms: true,
    });
  });

  test("a station's line can be reordered, and a guest sent home from it", async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    // play on until three guests are waiting somewhere, then stop the clock and line them up at the table
    const ids = await game.eval((pp) => {
      /** Guests in the building who are not being seen or on their way out. */
      const free = () => pp.state.guests.filter((g) => !['leaving', 'called', 'served'].includes(g.state));
      pp.state.speed = 1;
      for (let i = 0; i < 6000 && free().length < 3; i++) pp.sim.tick(0.1);
      pp.state.speed = 0;
      const table = pp.state.items.find((i) => i.type === 'massage_table')!;
      const guests = free().slice(0, 3);
      for (const it of pp.state.items) it.queue = it.queue.filter((id) => !guests.some((g) => g.id === id));
      table.queue = guests.map((g) => g.id);
      for (const g of guests) Object.assign(g, { station: table.id, state: 'waiting', goal: 'treat' });
      return table.queue.slice();
    });
    expect(ids.length).toBe(3);
    // a star earned while playing on is out of the way first
    await game.settle();
    const keepHealing = page.getByRole('button', { name: 'Keep healing' });
    if (await keepHealing.isVisible()) await keepHealing.click();
    // selected directly: someone standing in front of the table would take a click meant for it
    await game.eval((pp) => {
      pp.tools.select({ kind: 'item', id: pp.state.items.find((i) => i.type === 'massage_table')!.id });
    });
    const rows = page.locator('#inspector .in-line');
    await expect(rows).toHaveCount(3);
    await rows.nth(1).getByRole('button', { name: '▲' }).click();
    expect(await game.eval((pp) => pp.state.items.find((i) => i.type === 'massage_table')!.queue)).toEqual([
      ids[1],
      ids[0],
      ids[2],
    ]);
    await rows
      .nth(0)
      .getByRole('button', { name: /^Send home untreated/ })
      .click();
    await expect(rows).toHaveCount(2);
    expect(await game.eval((pp) => pp.state.stats.sent)).toBe(1);
  });

  test('a room can be given priority from its inspector', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    await game.clickRoom('training');
    await page
      .locator('#inspector')
      .getByRole('button', { name: /Priority: off/ })
      .click();
    await expect(page.locator('#inspector')).toContainText('Priority: on');
    expect(await game.eval((pp) => pp.state.rooms.find((r) => r.type === 'training')!.priority)).toBe(true);
  });

  test('a member of staff can be assigned to a room by clicking it', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    // at their table, in plain view
    await game.fastForward(40);
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    await game.clickStaff('therapist');
    const inspector = page.locator('#inspector');
    await inspector.getByRole('button', { name: /Assign to rooms/ }).click();
    await expect(page.locator('#hint')).toContainText('works anywhere');
    await game.clickRoom('massage');
    await expect(inspector.locator('.works-in')).toHaveText('Massage Suite');
    await expect(page.locator('#hint')).toContainText('works in 1 room');
    await inspector.getByRole('button', { name: /Done/ }).click();
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
    const assigned = await game.eval((pp) => {
      const st = pp.state.staff.find((s) => s.role === 'therapist')!;
      return st.rooms.map((id) => pp.state.rooms.find((r) => r.id === id)?.type);
    });
    expect(assigned).toEqual(['massage']);
    await inspector.getByRole('button', { name: 'Anywhere' }).click();
    await expect(inspector.locator('.works-in')).toHaveText('Anywhere');
  });

  test('the rival makes an unhappy member of staff an offer, which a raise sees off', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(40);
    await game.eval((pp) => {
      pp.state.rivalOn = true;
      pp.state.rival.opened = pp.state.day;
      pp.state.rival.nextSale = 1e9;
      pp.state.rival.nextPoach = pp.state.day;
      for (const st of pp.state.staff) st.morale = st.role === 'therapist' ? 20 : 90;
    });
    await game.fastForward(2);
    await expect(page.locator('#toasts')).toContainText('ZenMart has offered');
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    await game.clickStaff('therapist');
    const inspector = page.locator('#inspector');
    await expect(inspector.locator('.rival-offer')).toContainText('ZenMart has offered them a job');
    await inspector.getByRole('button', { name: /Raise to/ }).click();
    await game.fastForward(2);
    // among the messages, though with the inspector open only the newest two show above it, the rest counted
    await expect
      .poll(() => game.eval((pp) => pp.ui.toasts.some((t) => t.text.includes("turned down ZenMart's offer"))))
      .toBe(true);
    await expect(inspector.locator('.rival-offer')).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.rival.poached)).toBe(0);
  });

  test('an emergency can be accepted from its offer', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.stars = 1;
      pp.sim.offerEmergency();
    });
    await expect(page.locator('#offer')).toContainText('Emergency');
    await page.locator('#offer').getByRole('button', { name: 'Accept' }).click();
    await expect(page.locator('#offer')).toBeEmpty();
    await expect(page.locator('#objectives .emergency')).toContainText('days left');
    await game.fastForward(10);
    expect(await game.eval((pp) => pp.state.guests.filter((g) => g.emergency).length)).toBeGreaterThan(3);
  });

  test('a stress outbreak can be taken on, and a stressed guest calmed from their inspector', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(60);
    await game.eval((pp) => {
      pp.state.stars = 2;
      pp.sim.offerOutbreak();
    });
    await expect(page.locator('#offer')).toContainText('Stress outbreak');
    await page.locator('#offer').getByRole('button', { name: 'Accept' }).click();
    await expect(page.locator('#offer')).toBeEmpty();
    await expect(page.locator('#objectives .outbreak')).toContainText('calming sessions left');
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    // the calming button is not offered to a guest who is going home, and after a minute some are
    const spot = await game.clickGuest({ staying: true });
    await expect(page.locator('#inspector')).toContainText('Condition');
    const calms = await game.eval((pp, name) => {
      const g = pp.state.guests.find((x) => x.name === name)!;
      g.stressed = true;
      g.calmed = false;
      return pp.state.outbreak!.calms;
    }, spot.name);
    await page
      .locator('#inspector')
      .getByRole('button', { name: /Calm them/ })
      .click();
    await expect(page.locator('#inspector')).toContainText('Has had a calming session');
    await expect(page.locator('#objectives .outbreak')).toContainText(`${calms - 1} calming session`);
    expect(await game.eval((pp, name) => pp.state.guests.find((x) => x.name === name)!.stressed, spot.name)).toBe(
      false,
    );
  });

  test('a guest on a really bad trip is named in a toast and a pill, and calmed down by someone sent from the pill', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    // a few guests in at once, so some are waiting in the building rather than on a table
    await game.fastForward(10);
    expect(await game.eval((pp) => pp.sim.cheat('guests 4').ok)).toBe(true);
    // the console sends a waiting guest off on one, as a failed ceremony now and then does: the first it would pick,
    // once that one is inside, where the staff can get to them
    let name: string | undefined;
    for (let i = 0; i < 30 && !name; i++) {
      await game.fastForward(2);
      name = await game.eval((pp) => {
        pp.state.speed = 0;
        const g = pp.state.guests.find(
          (x) => !x.classDay && !['called', 'served', 'running', 'leaving'].includes(x.state) && !x.outcome,
        );
        if (!g || !pp.sim.world.inside(Math.round(g.tx), Math.round(g.ty)) || !pp.sim.cheat('badtrip').ok)
          return undefined;
        return g.name;
      });
    }
    if (!name) throw new Error('nobody waited inside to send on a bad trip');
    await expect(
      page.locator('#toasts').getByRole('button', { name: new RegExp(`${name} is having a really bad trip`) }),
    ).toBeVisible();
    // the pill at the top says how long they have, and sends someone without opening anything
    const pill = page.locator('#offer .runner-pill').filter({ hasText: name });
    await expect(pill).toContainText(`${name} is on a really bad trip`);
    await expect(pill).toContainText('days to the door');
    await pill.getByRole('button', { name: /^Send / }).click();
    await expect(pill).toContainText('to calm them down');
    // and its body takes the player to them, where the inspector says the same
    await pill.getByRole('button', { name: new RegExp(`${name} is on a really bad trip`) }).click();
    const inspector = page.locator('#inspector');
    await expect(inspector).toContainText(name);
    await expect(inspector).toContainText('Running round the institute on a really bad trip');
    await expect(inspector).toContainText('to calm them down');
    // past listening: they cannot be sent home, only calmed down
    await expect(inspector.getByRole('button', { name: /Send home/ })).toHaveCount(0);
    // a second at a time, so they are caught still here, calmed and on their way
    /** Whether the guest of this name has been calmed down. */
    const calmed = (who: string) =>
      game.eval((pp, n) => !!pp.state.guests.find((x) => x.name === n)?.feelings.includes('calmed'), who);
    for (let i = 0; i < 60 && !(await calmed(name)); i++) await game.fastForward(1);
    await expect(inspector).toContainText('Calmed down when it all got too much');
    expect(
      await game.eval((pp, who) => {
        const g = pp.state.guests.find((x) => x.name === who)!;
        return { running: g.state === 'running', calming: pp.state.staff.some((st) => st.job?.kind === 'calm') };
      }, name),
    ).toEqual({ running: false, calming: false });
  });

  // the offer used to add "massage" to every technique, so an acupuncture emergency asked for "Cupping massage"

  test('a mishap is announced, can be prepared for from its notice, and shows while it lasts', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(10);
    const money = await game.eval((pp) => {
      const day = pp.state.day;
      pp.state.mishap = { kind: 'power', starts: day + 3, ends: day + 4, prepared: false, started: false };
      return pp.state.money;
    });
    const notice = page.locator('#offer .mishap');
    await expect(notice).toContainText('Power cut coming');
    await expect(notice).toContainText('Starts in 3 days');
    // put aside, it waits as a line, and comes back when clicked
    await notice.getByRole('button', { name: 'Take my chances' }).click();
    await expect(page.locator('.mishap-pill')).toContainText('not prepared');
    await page.locator('.mishap-pill').click();
    await notice.getByRole('button', { name: /Hire a generator/ }).click();
    await expect(page.locator('.mishap-pill')).toContainText('Power cut: starts in 3 days · prepared');
    expect(await game.eval((pp) => pp.state.money)).toBe(money - 1500);
    await game.fastForward(3 * 6 + 1);
    await expect(page.locator('.mishap-pill.on')).toContainText('day left · prepared');
    await game.fastForward(6);
    await expect(page.locator('#offer')).toBeEmpty();
  });
  test('an emergency offer names the treatment as the Treatments menu does', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.buildClinic();
    await game.eval((pp) => {
      pp.state.offer = {
        condition: 'vibes',
        cause: 'A bus tour arrived.',
        total: 5,
        target: 3,
        healed: 0,
        pending: 0,
        reward: 4000,
        deadline: pp.state.day + 8,
      };
    });
    await expect(page.locator('#offer')).toContainText('need Cupping.');
    await game.eval((pp) => {
      pp.state.offer!.condition = 'slump';
    });
    await expect(page.locator('#offer')).toContainText('need Swedish massage.');
  });

  test('an emergency offer can be put aside and brought back before it lapses', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.stars = 1;
      pp.sim.offerEmergency();
      pp.state.speed = 0;
    });
    const offer = page.locator('#offer');
    await expect(offer).toContainText('Offer lapses: 8 days left');
    await offer.locator('[data-tip="Decide later"]').click();
    await expect(offer).toHaveText('Emergency on offer: 8 days left to decide');
    // the clock keeps running while it is put aside
    await game.eval((pp) => (pp.state.day += 5));
    await expect(offer).toContainText('3 days left to decide');
    await offer.locator('[data-tip="Show the emergency"]').click();
    await offer.getByRole('button', { name: 'Accept' }).click();
    await expect(offer).toBeEmpty();
    await expect(page.locator('#objectives .emergency')).toContainText('days left');
  });

  test('furniture can be picked up and moved', async ({ game, page }) => {
    await game.start();
    await game.give('plant');
    const was = await game.eval((pp) => [pp.state.items[0]!.x, pp.state.items[0]!.y]);
    await game.clickItem('plant');
    await expect(page.locator('#inspector')).toContainText('Potted Plant');
    await page.locator('#inspector').getByRole('button', { name: 'Move' }).click();
    await expect(page.locator('#hint')).toContainText('Moving the Potted Plant');
    const to = await game.placeHeld();
    // it is where it was put, which is not where it was, and moving it cost nothing beyond its price
    expect(await game.eval((pp) => [pp.state.items[0]!.x, pp.state.items[0]!.y, pp.state.money])).toEqual([
      to.x,
      to.y,
      30000 - 120,
    ]);
    expect([to.x, to.y]).not.toEqual(was);
  });

  test('items sell for half and rooms can be demolished', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.money = 10000));
    await game.give('bench');
    await game.clickItem('bench');
    await page
      .locator('#inspector')
      .getByRole('button', { name: /Sell for \$75/ })
      .click();
    expect(await game.eval((pp) => pp.state.items.some((i) => i.type === 'bench'))).toBe(false);

    await game.clickRoom('massage');
    await expect(page.locator('#inspector')).toContainText('Massage Suite');
    await page
      .locator('#inspector')
      .getByRole('button', { name: /Demolish/ })
      .click();
    expect(await game.eval((pp) => pp.state.rooms.map((r) => r.type))).toEqual(['consult', 'training']);
  });
});

test.describe('controls and saving', () => {
  test('keyboard shortcuts pause, change speed and cancel tools', async ({ game, page }) => {
    await game.start();
    await page.keyboard.press('Space');
    expect(await game.eval((pp) => pp.state.speed)).toBe(0);
    await page.keyboard.press('3');
    expect(await game.eval((pp) => pp.state.speed)).toBe(3);
    await expect(page.locator('#stats .speed.on')).toHaveAccessibleName(/Fastest/);
    await page.keyboard.press('1');
    await game.menu('Items');
    await game.card('Bench').click();
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('item');
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
  });

  test('the camera pans and zooms', async ({ game, page }) => {
    await game.start();
    // a spot on the ground to watch: when the camera moves right, it slides left across the screen
    /** How far across the screen the spot is. */
    const spot = () => game.eval((pp) => pp.view.project(16, 12).x);
    const before = await spot();
    // held until it has moved, however many frames a busy machine draws while it is held
    await page.keyboard.down('d');
    await expect.poll(spot, { intervals: [50] }).toBeLessThan(before - 20);
    await page.keyboard.up('d');
    // and still once it is let go
    const stopped = await spot();
    await game.settle();
    expect(await spot()).toBeCloseTo(stopped, 0);
    const dist = await game.eval((pp) => pp.view.dist);
    // the wheel zooms toward the spot under the pointer, which stays where it is on screen
    const pointer = { x: 1000, y: 300 };
    const ground = await game.eval((pp, p) => pp.view.groundAt(p.x, p.y)!, pointer);
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.wheel(0, -400);
    // easing in over a few frames
    await expect.poll(() => game.eval((pp) => pp.view.dist)).toBeLessThan(dist);
    await game.cameraStill();
    const at = await game.eval((pp, g) => pp.view.project(g.x, g.y), ground);
    expect(Math.abs(at.x - pointer.x)).toBeLessThan(2);
    expect(Math.abs(at.y - pointer.y)).toBeLessThan(2);
  });

  test('the pause menu shows the controls and resumes at the old speed', async ({ game, page }) => {
    await game.start();
    await page.keyboard.press('2');
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await expect(page.locator('#modal')).toContainText('Pressure Point Institute');
    expect(await game.eval((pp) => pp.state.speed)).toBe(0);
    await page.getByRole('button', { name: 'Resume' }).click();
    expect(await game.eval((pp) => pp.state.speed)).toBe(2);
  });
});

test.describe('clicking', () => {
  /** Press, let the pointer wander, release: how a hand or a trackpad actually clicks. */
  const pressAndRelease = async (game: Game, at: { x: number; y: number }, drift: number, holdMs = 0) => {
    await game.page.mouse.move(at.x, at.y);
    await game.page.mouse.down();
    await game.page.mouse.move(at.x + drift, at.y + drift * 0.5, { steps: 3 });
    if (holdMs) await game.page.waitForTimeout(holdMs);
    await game.page.mouse.up();
    await game.settle();
  };
  /** Move the mouse to a point. */
  const moveTo = (game: Game, at: { x: number; y: number }) => game.page.mouse.move(at.x, at.y, { steps: 4 });
  /** The id of whatever is selected, or null. */
  const selectedId = (game: Game) => game.eval((pp) => pp.tools.selected?.id ?? null);

  test('selecting a second item switches to it, even when the click drifts a little', async ({ game, page }) => {
    await game.start();
    const bench = await game.give('bench');
    const fountain = await game.give('fountain');
    // up to 8 pixels of drift, comfortably inside the 10 that makes a drag
    for (const drift of [0, 4, 8]) {
      await pressAndRelease(game, await game.itemPoint('bench'), 0);
      expect(await selectedId(game), `first click, drift ${drift}`).toBe(bench);
      await expect(page.locator('#inspector h3')).toContainText('Bench');
      await pressAndRelease(game, await game.itemPoint('fountain'), drift);
      expect(await selectedId(game), `second click drifting ${drift}px`).toBe(fountain);
      await expect(page.locator('#inspector h3')).toContainText('Zen Fountain');
    }
  });

  test('what a click would select glows under the pointer, with a hand for the pointer', async ({ game, page }) => {
    await game.start();
    const bench = await game.give('bench');
    /** What a click would select now, and the pointer the canvas shows. */
    const hovered = () =>
      game.eval((pp) => [pp.view.overlays.hovered?.id ?? null, document.getElementById('game')!.style.cursor]);
    await moveTo(game, await game.itemPoint('bench'));
    await expect.poll(hovered).toEqual([bench, 'pointer']);
    // nothing on the lawn to click
    await game.hoverLawn();
    await expect.poll(hovered).toEqual([null, '']);
    // leaving the canvas for the interface clears it
    await moveTo(game, await game.itemPoint('bench'));
    await expect.poll(hovered).toEqual([bench, 'pointer']);
    const stats = (await page.locator('#stats').boundingBox())!;
    await page.mouse.move(stats.x + 10, stats.y + 10, { steps: 4 });
    await expect.poll(hovered).toEqual([null, '']);
    // a tool in hand draws its own preview
    await game.menu('Items');
    await game.card('Potted Plant').click();
    await moveTo(game, await game.itemPoint('bench'));
    await game.settle();
    await page.waitForTimeout(300);
    expect(await hovered()).toEqual([null, '']);
  });

  test('a person selected behind an item shows a marker over them, drawn over everything', async ({ game }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(30);
    // the receptionist works from behind the desk, which stands between them and the camera
    const id = await game.eval((pp) => {
      const st = pp.state.staff.find((s) => s.role === 'receptionist')!;
      pp.tools.select({ kind: 'staff', id: st.id });
      pp.view.lookAt(st.x, st.y);
      return st.id;
    });
    await game.draw();
    expect(await game.eval((pp) => [pp.tools.selected?.id, pp.view.overlays.markerShown])).toEqual([id, true]);
    // the marker's gold shows over their head
    const gold = await game.eval((pp) => {
      const st = pp.state.staff.find((s) => s.role === 'receptionist')!;
      const r = pp.view.renderer as unknown as {
        render(scene: unknown, camera: unknown): void;
        getContext(): WebGLRenderingContext;
        getPixelRatio(): number;
      };
      const view = pp.view as unknown as { scene: unknown; rig: { camera: unknown } };
      r.render(view.scene, view.rig.camera);
      const gl = r.getContext();
      const ratio = r.getPixelRatio();
      const p = pp.view.project(st.x, st.y, 2.35);
      const size = 24;
      const px = new Uint8Array(size * size * 4);
      const x = Math.round(p.x * ratio) - size / 2;
      const y = gl.drawingBufferHeight - Math.round(p.y * ratio) - size / 2;
      gl.readPixels(x, y, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i]! > 180 && px[i + 1]! > 140 && px[i + 2]! < 90) n++;
      return n;
    });
    expect(gold).toBeGreaterThan(10);
  });

  test('an item in hand is placed even when the click drifts a little', async ({ game }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Potted Plant').click();
    await pressAndRelease(game, (await game.heldSpot()).at, 8);
    await pressAndRelease(game, (await game.heldSpot()).at, 7);
    expect(await game.eval((pp) => pp.state.items.length)).toBe(2);
  });

  test('a real drag moves the camera and leaves the selection alone', async ({ game }) => {
    await game.start();
    const bench = await game.give('bench');
    await game.give('fountain');
    await pressAndRelease(game, await game.itemPoint('bench'), 0);
    const before = await game.itemPoint('bench');
    // start the drag on the other item: a slow, long drag is a pan, not a click on it
    await pressAndRelease(game, await game.itemPoint('fountain'), 120, 300);
    const after = await game.itemPoint('bench');
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(60);
    expect(await selectedId(game)).toBe(bench);
  });

  test('a drag the browser cancels stops panning, rather than panning on every hover after', async ({ game, page }) => {
    await game.start();
    /** Where the camera is looking. */
    const target = () =>
      game.eval((pp) => {
        const { target: t } = (pp.view as unknown as { rig: { target: { x: number; z: number } } }).rig;
        return [t.x, t.z];
      });
    await page.mouse.move(600, 400);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(680, 400, { steps: 4 });
    await page.evaluate(() => document.getElementById('game')!.dispatchEvent(new PointerEvent('pointercancel')));
    const before = await target();
    // plain hovering, with no button down, as a pen or touch screen goes on reporting after a cancel
    await page.evaluate(() => {
      const canvas = document.getElementById('game')!;
      for (const x of [700, 760, 820])
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: 400 }));
    });
    expect(await target()).toEqual(before);
    await page.mouse.up({ button: 'right' });
  });

  test('a real drag with an item in hand does not place it', async ({ game }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Potted Plant').click();
    await pressAndRelease(game, (await game.heldSpot()).at, 90, 300);
    expect(await game.eval((pp) => pp.state.items.length)).toBe(0);
  });
});

test.describe('leaving a game', () => {
  test('Main menu saves and returns to the title screen, where Continue picks the game back up', async ({
    game,
    page,
  }) => {
    // starts a game twice, and a start can take half a minute on a busy machine
    test.slow();
    // starts a game twice, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    const before = await game.eval((pp) => ({
      rooms: pp.state.rooms.length,
      staff: pp.state.staff.length,
      money: pp.state.money,
    }));
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.locator('#title .title-logo')).toBeVisible();
    await expect(page.locator('#title .save-card')).toContainText('Autosave');
    // the card shows a picture of the game just left
    await expect(page.locator('#title .save-thumb')).toHaveAttribute('src', /^data:image\/jpeg/);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(
      await game.eval((pp) => ({ rooms: pp.state.rooms.length, staff: pp.state.staff.length, money: pp.state.money })),
    ).toEqual(before);
  });

  test('Esc opens the pause menu when nothing is in hand, and closes it again', async ({ game, page }) => {
    await game.start();
    await page.keyboard.press('2');
    // first Esc clears a selection, the next one opens the menu
    await game.give('plant');
    await game.clickItem('plant');
    await expect(page.locator('#inspector')).toContainText('Potted Plant');
    await page.keyboard.press('Escape');
    await expect(page.locator('#inspector')).toBeEmpty();
    await expect(page.locator('#modal')).toBeEmpty();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toContainText('Main menu');
    expect(await game.eval((pp) => pp.state.speed)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeEmpty();
    expect(await game.eval((pp) => pp.state.speed)).toBe(2);
    // and from a dialog inside the menu
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeEmpty();
  });

  test('a browser has no Exit button, since a tab cannot close itself', async ({ game, page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sandbox' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Exit/ })).toHaveCount(0);
    await game.start();
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await expect(page.getByRole('button', { name: 'Main menu' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Exit/ })).toHaveCount(0);
  });
});

test.describe('acupuncture and settings', () => {
  /** Open the pause menu and press one of its buttons. */
  const pauseMenu = async (page: Page, button: string) => {
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: button }).click();
  };

  test('the clinic is locked until the first star, then can be built and staffed', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.menu('Rooms');
    await expect(game.card('Acupuncture Clinic')).toContainText('Unlocks at star 1');
    await game.card('Acupuncture Clinic').click();
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
    await game.menu('Hire');
    await expect(page.locator('#menu .tab', { hasText: 'Acupuncturist' })).toHaveCount(0);

    await game.eval((pp) => (pp.state.stars = 1));
    await game.menu('Rooms');
    await game.card('Acupuncture Clinic').click();
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
    await expect(page.locator('#hint')).toContainText('Place the Acupuncture Table inside the room');
    await game.placeHeld();
    await game.placeHeld();
    await page.keyboard.press('Enter');
    await expect(page.locator('#toasts')).toContainText('Acupuncture Clinic built!');
    await page.keyboard.press('Escape');

    await game.menu('Hire');
    await page.locator('#menu .tab', { hasText: 'Acupuncturist' }).click();
    await expect(page.locator('#menu .quals').first()).toContainText('Classic Needling');
    await page.locator('#menu .card.cv').first().getByRole('button', { name: 'Hire' }).click();
    await game.menu('Treatments');
    await expect(page.locator('#menu')).toContainText('Delivered in the Acupuncture Clinic');
    await expect(game.card('Classic Needling')).toContainText('1 qualified');
    await expect(game.card('Moxibustion')).toContainText('Unlocks at star 2');
  });

  test('acupuncture guests are treated in the clinic', async ({ game }) => {
    await game.start();
    await game.buildCenter();
    await game.buildClinic();
    // turn every new arrival into an acupuncture case and play until one has been seen
    const served = await game.eval((pp) => {
      const { sim, state } = pp;
      const acu = state.staff.find((s) => s.role === 'acupuncturist')!;
      for (let i = 0; i < 9000 && acu.served < 2; i++) {
        for (const g of state.guests) if (g.diagnosis === 0) g.condition = 'qi';
        sim.tick(0.1);
      }
      return acu.served;
    });
    expect(served).toBeGreaterThanOrEqual(2);
    await game.settle();
  });

  test('switching acupuncture off in the pause menu hides it, and on brings it back', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => (pp.state.stars = 1));
    await game.menu('Rooms');
    await expect(game.card('Acupuncture Clinic')).toBeVisible();

    await pauseMenu(page, 'Settings');
    const toggle = page.getByRole('switch', { name: 'Acupuncture' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#settings-panel')).toContainText('Massage therapy');
    await expect(page.locator('#settings-panel')).toContainText('Always on');
    await expect(page.getByRole('switch', { name: 'Reiki' })).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: 'Resume' }).click();

    await game.menu('Rooms');
    await expect(game.card('Massage Suite')).toBeVisible();
    await expect(game.card('Acupuncture Clinic')).toHaveCount(0);
    await game.menu('Hire');
    await expect(page.locator('#menu .tab', { hasText: 'Acupuncturist' })).toHaveCount(0);
    await game.menu('Items');
    await expect(game.card('Cupping Cart')).toHaveCount(0);
    await game.menu('Treatments');
    await expect(page.locator('#menu')).not.toContainText('Classic Needling');
    expect(await game.eval((pp) => pp.sim.enabled('acupuncture'))).toBe(false);

    await pauseMenu(page, 'Settings');
    await page.getByRole('switch', { name: 'Acupuncture' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await game.menu('Rooms');
    await expect(game.card('Acupuncture Clinic')).toBeVisible();
  });

  test('a choice made on the title screen applies to new games and is remembered', async ({ game, page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('switch', { name: 'Acupuncture' }).click();
    await expect(page.getByRole('switch', { name: 'Acupuncture' })).toHaveAttribute('aria-checked', 'false');
    // the audio switches there stay in step with the ones in the corner
    await page.getByRole('switch', { name: 'Music' }).click();
    await expect(page.locator('.title-sys').locator('[data-tip="Music"]')).toHaveAttribute('aria-pressed', 'false');

    // the panel stands in for the menu until Back, or Esc
    await expect(page.getByRole('button', { name: 'Sandbox' })).toBeHidden();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await expect(page.locator('#title-sandbox')).toBeVisible();
    await page.getByRole('button', { name: '‹ Back', exact: true }).click();
    await page.getByRole('button', { name: 'Sandbox' }).click();

    await page.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => pp.sim.enabled('acupuncture'))).toBe(false);
    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('switch', { name: 'Acupuncture' })).toHaveAttribute('aria-checked', 'false');
  });

  test('a saved game keeps its own choice', async ({ game, page }) => {
    // starts a game twice, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await pauseMenu(page, 'Settings');
    await page.getByRole('switch', { name: 'Acupuncture' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => pp.sim.enabled('acupuncture'))).toBe(false);
  });
});

test.describe('the interface', () => {
  test('stays subscribed to the game across redraws, rather than signing up again each time', async ({ game }) => {
    await game.start();
    const signups = await game.eval(async (pp) => {
      const ui = pp.ui;
      const subscribe = ui.subscribe.bind(ui);
      let count = 0;
      /** Count each signup on the way through. */
      ui.subscribe = (f) => {
        count++;
        return subscribe(f);
      };
      for (let i = 0; i < 5; i++) {
        ui.update();
        await new Promise((r) => setTimeout(r, 30));
      }
      return count;
    });
    expect(signups).toBe(0);
  });
});

test.describe('messages', () => {
  /** Where the camera is looking, on the ground. */
  const lookingAt = (game: Game) =>
    game.eval((pp) => {
      const { target } = (pp.view as unknown as { rig: { target: { x: number; z: number } } }).rig;
      return { x: target.x, z: target.z };
    });

  test('clicking a toast about someone selects them and takes the camera there', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    const therapist = await game.eval((pp) => {
      const st = pp.state.staff.find((s) => s.role === 'therapist')!;
      return { name: st.name, x: st.x, y: st.y };
    });
    await game.eval((pp) => (pp.state.speed = 0));
    // by role as well as name, as two hires can draw the same name
    await page.locator('#toasts .toast', { hasText: `${therapist.name} joins as a Massage Therapist` }).click();
    await expect(page.locator('#inspector')).toContainText(therapist.name);
    await expect
      .poll(async () => {
        const at = await lookingAt(game);
        return Math.hypot(at.x - therapist.x, at.z - therapist.y);
      })
      .toBeLessThan(0.5);
  });

  test('a raise request waits on a card at the side, which selects the one asking', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    const name = await game.eval((pp) => {
      pp.state.speed = 0;
      const st = pp.state.staff.find((s) => s.role === 'consultant')!;
      st.raiseAsked = true;
      return st.name;
    });
    const card = page.locator('#toasts .request');
    await expect(card).toContainText(`${name} wants a raise`);
    await expect(page.locator('#advisor')).not.toContainText('wants a raise');
    await card.click();
    await expect(page.locator('#inspector')).toContainText(name);
    // answered, the card goes
    await game.eval((pp) => {
      pp.state.staff.find((s) => s.role === 'consultant')!.raiseAsked = false;
    });
    await expect(card).toHaveCount(0);
  });

  test('a message stays while the game is paused or the pointer is on it, and can be closed', async ({
    game,
    page,
  }) => {
    await game.start();
    const toast = page.locator('#toasts .messages .toast', { hasText: 'Mira joins the team.' });
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.sim.emit({ type: 'toast', text: 'Mira joins the team.', kind: 'info' });
    });
    await expect(toast).toBeVisible();
    // a minute of frames, paused
    await game.eval((pp) => pp.ui.tickToasts(60));
    await expect(toast).toBeVisible();
    await game.eval((pp) => (pp.state.speed = 1));
    await toast.hover();
    await game.eval((pp) => pp.ui.tickToasts(60));
    await expect(toast).toBeVisible();
    await page.mouse.move(400, 450);
    await game.eval((pp) => pp.ui.tickToasts(60));
    await expect(toast).toHaveCount(0);
    // said twice, it shows once, counted; its close button takes it away
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.sim.emit({ type: 'toast', text: 'Mira joins the team.', kind: 'info' });
      pp.sim.emit({ type: 'toast', text: 'Mira joins the team.', kind: 'info' });
    });
    await expect(toast).toContainText('×2');
    await toast.locator('[data-tip="Dismiss"]').click();
    await expect(toast).toHaveCount(0);
  });

  test('past the first few, messages pile up, open out, and are dismissed together once the player is sure', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.speed = 0;
      for (let i = 1; i <= 6; i++) pp.sim.emit({ type: 'toast', text: `Message ${i}`, kind: 'info' });
    });
    const messages = page.locator('#toasts .messages .toast');
    const pile = page.locator('#toasts .pile');
    await expect(messages).toHaveCount(4);
    await expect(messages.first()).toContainText('Message 6');
    await expect(pile).toContainText('2 more messages');
    await pile.getByRole('button', { name: '2 more messages' }).click();
    await expect(messages).toHaveCount(6);
    await expect(messages.last()).toContainText('Message 1');
    await page.keyboard.press('Escape');
    await expect(messages).toHaveCount(4);
    await pile.locator('[data-tip="Dismiss all messages"]').click();
    const dialog = page.locator('.dialog');
    await expect(dialog).toContainText('Dismiss all 6 messages?');
    await dialog.getByRole('button', { name: 'Keep them' }).click();
    await expect(messages).toHaveCount(4);
    await pile.locator('[data-tip="Dismiss all messages"]').click();
    await dialog.getByRole('button', { name: 'Dismiss all' }).click();
    await expect(messages).toHaveCount(0);
    await expect(pile).toHaveCount(0);
    expect(await game.eval((pp) => pp.ui.toasts.length)).toBe(0);
  });
});

test.describe('the Items menu', () => {
  test('can be filtered by where an item goes and what it is for', async ({ game, page }) => {
    await game.start();
    await game.menu('Items');
    await expect(game.card('Bench')).toBeVisible();
    await page.locator('#menu .tab', { hasText: 'Staff Room' }).click();
    await expect(game.card('Squishy Couch')).toBeVisible();
    await expect(game.card('Bench')).toHaveCount(0);
    await expect(game.card('Potted Plant')).toBeVisible();
    await page.locator('#menu .tab', { hasText: 'Decor' }).click();
    await expect(game.card('Squishy Couch')).toHaveCount(0);
    await expect(game.card('Potted Plant')).toBeVisible();
    // the choice stays while the menu is closed and opened again
    await game.menu('Items');
    await game.menu('Items');
    await expect(page.locator('#menu .tab.on')).toHaveText(['Staff Room', 'Decor']);
    await page.locator('#menu .tab', { hasText: 'Everywhere' }).click();
    await page.locator('#menu .tab', { hasText: 'Everything' }).click();
    await expect(game.card('Bench')).toBeVisible();
  });

  test('will not hand over an item that cannot be paid for, and says how much more it needs', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.state.money = 300;
    });
    await game.menu('Items');
    const desk = game.card('Reception Desk');
    await expect(desk).toHaveClass(/poor/);
    await expect(desk).toContainText('Need $900 more');
    await desk.click();
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
    await expect(page.locator('#menu .panel')).toBeVisible();
  });

  test('hangs things on walls: a chip on the wall once it is cut low, to be clicked, moved and sold', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.menu('Items');
    await page.locator('#menu .tab', { hasText: 'On the walls' }).click();
    await expect(game.card('Bench')).toHaveCount(0);
    await game.card('Wall Clock').click();
    await expect(page.locator('#hint')).toContainText('click a wall to hang it');
    const money = await game.eval((pp) => pp.state.money);
    await game.placeHeld();
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => pp.state.items.filter((it) => it.type === 'wall_clock').length)).toBe(1);
    expect(await game.eval((pp) => pp.state.money)).toBe(money - 150);
    // it hangs on the back wall, nobody's way: the floor in front of it can still be walked on
    const clock = await game.eval((pp) => pp.state.items.find((it) => it.type === 'wall_clock')!);
    expect(await game.eval((pp, [x, y]) => pp.sim.world.walkable(x!, y!), [clock.x, clock.y])).toBe(true);
    // in the middle of the view, clear of the panels
    await game.eval((pp, [x, y]) => pp.view.lookAt(x! + 0.5, y! + 0.5), [clock.x, clock.y]);
    // once the camera has glided there, or the clock slides out from under the click
    await game.cameraStill();
    await game.clickItem('wall_clock');
    await expect(page.locator('#inspector')).toContainText('Wall Clock');
    // turned round, its wall is cut low and it shows as a chip, which can still be clicked
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyE');
    await page.keyboard.press('KeyE');
    await game.eval((pp, [x, y]) => pp.view.lookAt(x! + 0.5, y! + 0.5), [clock.x, clock.y]);
    await game.cameraStill();
    await game.clickItem('wall_clock');
    await expect(page.locator('#inspector')).toContainText('Wall Clock');
    await page.locator('#inspector').getByRole('button', { name: 'Move' }).click();
    await game.placeHeld();
    const moved = await game.eval((pp) => pp.state.items.find((it) => it.type === 'wall_clock')!);
    expect([moved.x, moved.y, moved.rot]).not.toEqual([clock.x, clock.y, clock.rot]);
    await game.eval((pp, [x, y]) => pp.view.lookAt(x! + 0.5, y! + 0.5), [moved.x, moved.y]);
    await game.cameraStill();
    await game.clickItem('wall_clock');
    await page.locator('#inspector').getByRole('button', { name: /Sell/ }).click();
    expect(await game.eval((pp) => pp.state.items.some((it) => it.type === 'wall_clock'))).toBe(false);
    expect(game.errors).toEqual([]);
  });
});

test.describe('more land', () => {
  test('is bought from the world: pointed at with the Expand tool, clicked, and confirmed', async ({ game, page }) => {
    // starts a game twice, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await game.eval((pp) => {
      pp.state.money = 100000;
    });
    const before = await game.eval((pp) => pp.sim.world.building.bounds.x1);
    await page
      .locator('#buildbtns')
      .getByRole('button', { name: /Expand/ })
      .click();
    await expect(page.locator('#hint')).toContainText('point at a plot');
    // one not for sale yet says when it will be
    await game.hoverPlot('back-gallery');
    await expect(page.locator('#hint')).toContainText('Comes up for sale at star 1');
    await game.hoverPlot('east-wing');
    await expect(page.locator('#hint li')).toHaveText(['The east wing', '8 × 15 tiles', '$24,000', 'click to buy']);
    await game.clickPlot('east-wing');
    const dialog = page.locator('.dialog');
    await expect(dialog).toContainText('Buy the east wing?');
    await expect(dialog).toContainText('The builders take 6 days, then the building grows into it');
    // the game waits while the dialog is open
    expect(await game.eval((pp) => pp.state.speed)).toBe(0);
    await dialog.getByRole('button', { name: 'Buy for $24,000' }).click();
    await expect(page.locator('#toasts')).toContainText('The east wing is yours. The builders are at work on it');
    expect(await game.eval((pp) => pp.state.land.map((l) => l.plot))).toEqual(['east-wing']);
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
    // the building waits for the builders, even over a reload
    expect(await game.eval((pp) => pp.sim.world.building.bounds.x1)).toBe(before);
    await page.reload();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => pp.sim.world.building.bounds.x1)).toBe(before);
    // six days, and a second more for the once-a-second check that sees the builders are done
    await game.fastForward(6 * 6 + 1);
    expect(await game.eval((pp) => pp.sim.world.building.bounds.x1)).toBeGreaterThan(before);
    await expect(page.locator('#toasts')).toContainText('Work on the east wing is done');
    expect(game.errors).toEqual([]);
  });

  test('is fenced off while it is built on, and has a panel of its own to name it and see its rooms', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.money = 100000;
      pp.sim.buyPlot('east-wing');
    });
    await game.settle();
    // the site is picked from the ground, without the Expand tool
    await game.clickPlot('east-wing');
    const insp = page.locator('#inspector');
    await expect(insp).toContainText('The builders are at work: done in 6 days');
    const name = insp.getByRole('textbox', { name: 'Plot name' });
    await name.fill('Garden Wing');
    await name.press('Enter');
    expect(await game.eval((pp) => pp.state.land[0]?.name)).toBe('Garden Wing');
    await game.fastForward(6 * 6);
    await expect(insp).toContainText('None yet');
    await expect(page.locator('#toasts')).toContainText('Work on Garden Wing is done');
    // built on, it is the building's floor, and is seen with the Expand tool
    await game.eval((pp) => {
      pp.tools.select(null);
      pp.tools.startExpand();
    });
    await game.hoverPlot('east-wing');
    await expect(page.locator('#hint li')).toHaveText(['Garden Wing', '8 × 15 tiles', 'yours', 'click to see it']);
    await game.clickPlot('east-wing');
    await expect(name).toHaveValue('Garden Wing');
    expect(game.errors).toEqual([]);
  });

  test('is listed in the Land tab, which shows each plot in the world', async ({ game, page }) => {
    await game.start();
    await game.menu('Money');
    const menu = page.locator('#menu');
    await menu.getByRole('button', { name: /Land/ }).click();
    await expect(menu.locator('.ledger.land')).toHaveCount(6);
    await expect(menu).toContainText('Comes up for sale at star 1');
    // By its heading: the garden block's card names the east wing too, as the plot it waits on
    const eastWing = menu.locator('.ledger.land', { has: page.getByRole('heading', { name: 'The east wing' }) });
    await eastWing.getByRole('button', { name: 'Show me' }).click();
    await expect(menu.locator('.ledger.land')).toHaveCount(0);
    expect(await game.eval((pp) => pp.tools.tool)).toEqual({ kind: 'expand', pointed: 'east-wing' });
    await expect(page.locator('#hint')).toContainText('The east wing');
  });
});

test.describe('controls', () => {
  test('a key can be set to another in the settings, and the pause menu shows it', async ({ game, page }) => {
    await game.start();
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Pause: Space' }).click();
    await expect(page.locator('#settings-panel')).toContainText('Press a key');
    // Esc gives up on the key, and leaves the settings open
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Pause: Space' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause: Space' }).click();
    await page.keyboard.press('KeyP');
    await expect(page.getByRole('button', { name: 'Pause: P' })).toBeVisible();
    await page.getByRole('button', { name: 'Every 5 minutes' }).click();
    await expect(page.getByRole('button', { name: 'Only on leaving' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('#modal')).toContainText('The game saves when you leave it.');
    await expect(page.locator('#modal .keys')).toContainText('P pause');
    await page.getByRole('button', { name: 'Resume' }).click();

    await game.eval((pp) => (pp.state.speed = 1));
    await page.keyboard.press('Space');
    expect(await game.eval((pp) => pp.state.speed), 'Space no longer pauses').toBe(1);
    await page.keyboard.press('KeyP');
    expect(await game.eval((pp) => pp.state.speed)).toBe(0);
    expect(game.errors).toEqual([]);
  });
});

test.describe('visitors', () => {
  test('a VIP writes ahead, tours the center, and leaves a report', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(5);
    await game.eval((pp) => {
      pp.state.visitsOn = true;
      pp.state.nextInspection = 1e9;
      pp.state.nextVip = 0;
      pp.state.stars = 1;
    });
    await game.fastForward(2);
    await expect(page.locator('#toasts')).toContainText('is visiting in 5 days');
    await game.eval((pp) => {
      pp.state.visitNotice!.arrives = pp.state.day;
    });
    await game.fastForward(2);
    // the message that they have arrived takes the player to them
    await game.eval((pp) => (pp.state.speed = 0));
    await page.locator('#toasts .toast', { hasText: 'has arrived' }).click();
    const insp = page.locator('#inspector');
    await expect(insp.locator('.tag')).toContainText('VIP');
    await expect(insp).toContainText('cares most about');
    await game.fastForward(120);
    const modal = page.locator('#modal');
    await expect(modal.locator('h2')).toContainText('visit');
    expect(await modal.locator('.visit-rooms li').count()).toBeGreaterThanOrEqual(1);
    await modal.getByRole('button', { name: 'Back to work' }).click();
    await expect(modal.locator('h2')).toHaveCount(0);
    expect(await game.eval((pp) => [pp.state.visitors.length, pp.state.visitReport?.visit])).toEqual([0, 'vip']);
  });
});

test.describe('the business side', () => {
  test("a treatment's own price is set on top of the overall level", async ({ game, page }) => {
    await game.start();
    await game.menu('Money');
    const menu = page.locator('#menu');
    await menu.getByRole('button', { name: /Prices/ }).click();
    const swedish = menu.locator('.technique-price', { hasText: 'Swedish' });
    await swedish.getByRole('button', { name: '+' }).click();
    await expect(swedish).toContainText('110%');
    expect(await game.eval((pp) => pp.state.prices)).toEqual({ swedish: 1.1 });
  });

  test('a marketing campaign is bought from the Money menu', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.menu('Money');
    const menu = page.locator('#menu');
    await menu.getByRole('button', { name: /Marketing/ }).click();
    const card = menu.locator('.campaign', { hasText: 'Word of mouth' });
    await card.getByRole('button', { name: /1 mo/ }).click();
    await expect(card).toContainText('Running');
    expect(await game.eval((pp) => pp.state.campaigns.map((c) => c.kind))).toEqual(['word']);
  });

  test('a house call is offered, and someone sent on it from the card', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(20);
    const name = await game.eval((pp) => {
      pp.state.speed = 0;
      const st = pp.state.staff.find((x) => x.role === 'therapist')!;
      st.state = 'atPost';
      pp.state.callOffer = {
        client: 'the Grand Hotel',
        days: 2,
        perDay: 600,
        discipline: 'massage',
        deadline: pp.state.day + 6,
      };
      return st.name;
    });
    const card = page.locator('#offer .call');
    await expect(card).toContainText('The Grand Hotel would like a Massage Therapist');
    await card.getByRole('button', { name: new RegExp(`Send ${name}`) }).click();
    await expect(card).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.staff.find((x) => x.role === 'therapist')!.state)).toBe('toCall');
  });

  test('the Shop Counter is in the Items menu from the first star', async ({ game }) => {
    await game.start();
    await game.menu('Items');
    await expect(game.card('Shop Counter')).toHaveClass(/locked/);
    await game.eval((pp) => (pp.state.stars = 1));
    await game.menu('Items');
    await game.menu('Items');
    await expect(game.card('Shop Counter')).not.toHaveClass(/locked/);
  });
});

test.describe('staff careers', () => {
  test('someone ready for promotion waits on a card at the side, and is promoted from their inspector', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    const name = await game.eval((pp) => {
      pp.state.speed = 0;
      const st = pp.state.staff.find((x) => x.role === 'therapist')!;
      // every slot filled and the experience for the next rank: ready, and waiting
      Object.assign(st, { skill: 1, quals: ['swedish'], general: ['stamina'], xp: 20, promotion: true });
      return st.name;
    });
    const card = page.locator('#toasts .request', { hasText: `${name} is ready for promotion` });
    await card.click();
    const insp = page.locator('#inspector');
    await expect(insp.locator('h3')).toHaveText(name);
    await insp.getByRole('button', { name: /Promote to Junior/ }).click();
    await expect(insp.locator('.rank')).toContainText('Junior');
    await expect(card).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.staff.find((x) => x.role === 'therapist')!.skill)).toBe(2);
  });

  test('someone with the experience but empty slots is told to train before a promotion', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.speed = 0;
      const st = pp.state.staff.find((x) => x.role === 'consultant')!;
      Object.assign(st, { skill: 2, general: ['bedside'], xp: 45, promotion: false });
      pp.tools.select({ kind: 'staff', id: st.id });
    });
    const insp = page.locator('#inspector');
    await expect(insp).toContainText('Experience: enough for Experienced');
    await expect(insp.locator('.needs')).toHaveText(
      'To be promoted, fill every qualification slot (1 of 2 filled) with a course in a Training Room.',
    );
    await expect(insp.getByRole('button', { name: /Promote/ })).toHaveCount(0);
  });

  test('a receptionist can be kept to one duty, but not from them all', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.tools.select({ kind: 'staff', id: pp.state.staff.find((x) => x.role === 'receptionist')!.id });
    });
    const insp = page.locator('#inspector');
    await insp.getByRole('button', { name: /Shop Counter/ }).click();
    await expect(insp.getByRole('button', { name: /Shop Counter/ })).toContainText('✗');
    await insp.getByRole('button', { name: /Front desk/ }).click();
    expect(await game.eval((pp) => pp.state.staff.find((x) => x.role === 'receptionist')!.off)).toEqual(['shop']);
  });

  test('an applicant can be turned down', async ({ game, page }) => {
    await game.start();
    await game.menu('Hire');
    const cards = page.locator('#menu .card.cv');
    await expect(cards).toHaveCount(3);
    await cards.first().getByRole('button', { name: 'Reject' }).click();
    await expect(cards).toHaveCount(2);
  });
});

test.describe('reading the center', () => {
  test('the reputation figure opens what it is made of, and what guests are saying', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(300);
    await game.eval((pp) => (pp.state.speed = 0));
    // a star earned on the way is out of the way first
    const keepHealing = page.getByRole('button', { name: 'Keep healing' });
    if (await keepHealing.isVisible()) await keepHealing.click();
    await page.locator('#stats .rep').click();
    const menu = page.locator('#menu');
    await expect(menu.getByRole('button', { name: /Reputation/ })).toHaveClass(/on/);
    await expect(menu).toContainText('Word of mouth');
    await expect(menu.locator('.reviews li').first()).toContainText('day');
    await menu.getByRole('button', { name: /Casebook/ }).click();
    await expect(menu.locator('.casebook tbody tr').first()).toBeVisible();
    await menu.getByRole('button', { name: /Awards/ }).click();
    await expect(menu).toContainText('Awards are handed out at the end of each year');
  });

  test("a guest's feelings show in their inspector", async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(60);
    await game.eval((pp) => {
      pp.state.speed = 0;
      const g = pp.state.guests.find((x) => x.state !== 'leaving')!;
      g.feelings = ['comfy', 'long-wait'];
      pp.tools.select({ kind: 'guest', id: g.id });
    });
    const feelings = page.locator('#inspector .feelings');
    await expect(feelings.locator('.good')).toContainText('A comfy seat');
    await expect(feelings.locator('.bad')).toContainText('Waited far too long');
  });

  test('the floor can be colored by an overlay, with a key, and cleared again', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await page.locator('#sys').locator('[data-tip^="Overlays"]').click();
    await page
      .locator('#overlay-picker')
      .getByRole('button', { name: /Surroundings/ })
      .click();
    await expect(page.locator('#overlay-picker')).toHaveCount(0);
    await expect(page.locator('#overlay-key')).toContainText('Surroundings');
    await expect.poll(() => game.eval((pp) => pp.ui.overlay)).toBe('decor');
    await page.locator('#overlay-key').locator('[data-tip^="Stop coloring"]').click();
    await expect(page.locator('#overlay-key')).toHaveCount(0);
  });

  test('the Temperature overlay keys its colors from cold to hot', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await page.locator('#sys').locator('[data-tip^="Overlays"]').click();
    await page
      .locator('#overlay-picker')
      .getByRole('button', { name: /Temperature/ })
      .click();
    await expect(page.locator('#overlay-key .scale.temperature')).toContainText('Cold');
    await expect(page.locator('#overlay-key .scale.temperature')).toContainText('Hot');
    await expect.poll(() => game.eval((pp) => pp.ui.overlay)).toBe('temperature');
  });

  test("a radiator's inspector turns the Temperature overlay on, and it stays on once closed", async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    const radiator = await game.give('radiator');
    const ac = await game.give('air_conditioner');
    // selected directly: someone walking past would take a click meant for it
    await game.eval((pp, id) => pp.tools.select({ kind: 'item', id }), radiator);
    const toggle = page.locator('#inspector').getByRole('button', { name: /Temperature overlay/ });
    await expect(toggle).toContainText('off');
    await toggle.click();
    await expect(toggle).toContainText('on');
    await expect.poll(() => game.eval((pp) => pp.ui.overlay)).toBe('temperature');
    await page.locator('#inspector .x').click();
    await expect(page.locator('#inspector .panel')).toHaveCount(0);
    await expect(page.locator('#overlay-key')).toContainText('Temperature');
    // another heater or cooler shows it on, and turns it off
    await game.eval((pp, id) => pp.tools.select({ kind: 'item', id }), ac);
    await expect(toggle).toContainText('on');
    await toggle.click();
    await expect(toggle).toContainText('off');
    await expect(page.locator('#overlay-key')).toHaveCount(0);
  });
});

test.describe('comfort', () => {
  test('stale linens show on the table until a Caretaker changes them from a Linen Hamper', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.menu('Items');
    await game.card('Linen Hamper').click();
    await game.placeHeld();
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => pp.state.items.some((i) => i.type === 'linen_hamper'))).toBe(true);
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.state.items.find((i) => i.type === 'massage_table')!.dirt = 90;
    });
    await game.clickItem('massage_table');
    await expect(page.locator('#inspector')).toContainText('Stale linens');
    await game.eval((pp) => {
      const best = pp.state.candidates.filter((c) => c.role === 'caretaker').sort((a, b) => b.skill - a.skill)[0]!;
      pp.sim.hire(best.id);
    });
    await game.fastForward(60);
    await expect(page.locator('#inspector')).not.toContainText('Stale linens');
    expect(await game.eval((pp) => pp.state.items.find((i) => i.type === 'linen_hamper')!.water)).toBe(1);
  });
});

test.describe('goals along the way', () => {
  test('a member of staff sets a challenge, shown under the objectives until it is met', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.nextChallenge = 0;
      pp.state.speed = 1;
      // someone sets one as soon as two of the staff have arrived and the center is open
      for (let i = 0; i < 300 && !pp.state.challenge; i++) pp.sim.tick(0.1);
      pp.state.speed = 0;
    });
    const card = page.locator('#objectives .challenge');
    const setter = await game.eval((pp) => pp.state.challenge!.staffName);
    await expect(card).toContainText(`${setter}'s challenge`);
    await expect(card).toContainText('days left');
    await expect(page.locator('#toasts')).toContainText(`${setter} has set the center a challenge`);
    // met: paid out, and gone
    await game.eval((pp) => {
      pp.state.challenge!.goal = { kind: 'healed', count: 1 };
      pp.state.challenge!.from = pp.state.stats.healed - 1;
      pp.state.speed = 1;
      for (let i = 0; i < 20 && pp.state.challenge; i++) pp.sim.tick(0.1);
      pp.state.speed = 0;
    });
    await expect(card).toHaveCount(0);
    await expect(page.locator('#toasts')).toContainText('Challenge met!');
  });

  test('the year ends with an awards ceremony, remembered under Stats', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.day = 360 - 0.01;
      pp.state.speed = 1;
      for (let i = 0; i < 5; i++) pp.sim.tick(0.1);
    });
    const dialog = page.locator('#modal');
    await expect(dialog).toContainText('Year 1 awards');
    await expect(dialog.locator('.awards li')).toHaveCount(8);
    // the game waits while the ceremony is on
    expect(await game.eval((pp) => pp.state.speed)).toBe(0);
    await dialog.getByRole('button', { name: 'Back to work' }).click();
    await expect(dialog).toBeEmpty();
    expect(await game.eval((pp) => pp.state.speed)).toBe(1);
    await game.menu('Stats');
    await page
      .locator('#menu')
      .getByRole('button', { name: /Awards/ })
      .click();
    await page.locator('#menu').getByRole('button', { name: 'See the year 1 ceremony' }).click();
    await expect(dialog).toContainText('Year 1 awards');
  });
});

test.describe('stats', () => {
  test('the Money menu counts guests put off by prices', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.tally.priced = 3;
      pp.state.months = [{ ...pp.state.tally, priced: 5, ledger: pp.state.ledger, reputation: 30, money: 0 }];
    });
    await game.menu('Money');
    await page
      .locator('#menu')
      .getByRole('button', { name: /Prices/ })
      .click();
    await expect(page.locator('#menu .priced')).toHaveText('Put off by prices: 3 this month, 5 last month');
  });

  test('the Stats menu charts chosen figures, and remembers the choice', async ({ game, page }) => {
    // starts a game twice, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await game.buildCenter();
    await game.fastForward(200);
    await game.eval((pp) => (pp.state.speed = 0));
    // a star earned on the way is out of the way first
    const keepHealing = page.getByRole('button', { name: 'Keep healing' });
    if (await keepHealing.isVisible()) await keepHealing.click();
    await game.menu('Stats');
    const cards = page.locator('#menu .stat-card');
    await expect(cards).toHaveCount(6);
    await expect(page.locator('#menu .stat-card[data-metric="arrived"] .chart i')).toHaveCount(2);

    await page.getByRole('button', { name: 'Choose charts' }).click();
    await page.locator('#menu .chip', { hasText: 'Bank balance' }).click();
    await page.locator('#menu .chip', { hasText: 'Stormed out' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('#menu .stat-card[data-metric="money"]')).toBeVisible();
    await expect(page.locator('#menu .stat-card[data-metric="stormed"]')).toHaveCount(0);

    await page.reload();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForFunction(() => !!window.pp);
    await game.menu('Stats');
    await expect(page.locator('#menu .stat-card[data-metric="money"]')).toBeVisible();
    await expect(page.locator('#menu .stat-card[data-metric="stormed"]')).toHaveCount(0);
  });
});

test.describe('the tutorial', () => {
  test('points a first Willow Lane game at what each step wants, and can be skipped', async ({ game, page }) => {
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Campaign' }).click();
    await page.locator('#title-campaign').getByRole('button', { name: 'Play Willow Lane' }).click();
    await page.waitForFunction(() => !!window.pp);
    const card = page.locator('#advisor .tutorial-card');
    await expect(card).toContainText('Tutorial · step 1 of');
    await game.eval((pp) => {
      pp.sim.noteLooked();
    });
    await expect(card).toContainText('step 2 of');
    await expect(card).toContainText('Pause the clock');
    await expect(page.locator('#objectives')).toContainText('Tutorial · 1 of');
    // the ring is on the pause button, and pausing moves on to the desk
    const pause = page.locator('#stats').getByRole('button', { name: 'Pause (Space)' });
    await expect(pause).toHaveClass(/guide/);
    await pause.click();
    await expect(card).toContainText('step 3 of');
    await expect(card).toContainText('Place a Reception Desk');
    await expect(page.locator('#objectives')).toContainText('Tutorial · 2 of');
    // the ring is on the Items button, then follows into the menu to the card wanted
    const items = page.locator('#buildbtns').getByRole('button', { name: 'Items' });
    await expect(items).toHaveClass(/guide/);
    await game.menu('Items');
    await expect(items).not.toHaveClass(/guide/);
    await expect(game.card('Reception Desk')).toHaveClass(/guide/);
    await expect(page.locator('#menu .guide')).toHaveCount(1);
    await game.menu('Items');
    await card.getByRole('button', { name: 'Skip the tutorial' }).click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('.guide')).toHaveCount(0);
    await expect(page.locator('#advisor')).toContainText('Open the Items menu and place a Reception Desk');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('pressure-point-tutorial'))).toBe('off');
  });

  test('looking around is done once the camera has been moved and turned', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Campaign' }).click();
    await page.locator('#title-campaign').getByRole('button', { name: 'Play Willow Lane' }).click();
    await page.waitForFunction(() => !!window.pp);
    const card = page.locator('#advisor .tutorial-card');
    await expect(card).toContainText('Look around');
    await page.keyboard.press('KeyE');
    await expect(card).toContainText('Look around');
    await page.keyboard.down('KeyD');
    await expect(card).toContainText('Pause the clock');
    await page.keyboard.up('KeyD');
  });

  test('the switch on Willow Lane’s card, and the one in Settings, turn it off and on', async ({ game, page }) => {
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Campaign' }).click();
    const trail = page.locator('#title-campaign');
    const card = trail.getByRole('switch', { name: 'Tutorial' });
    await expect(card).toHaveAttribute('aria-checked', 'true');
    await card.click();
    await expect(card).toHaveAttribute('aria-checked', 'false');
    await trail.getByRole('button', { name: 'Play Willow Lane' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => [pp.state.tutorial, pp.state.lessons])).toEqual([false, false]);
    await expect(page.locator('#advisor .tutorial-card')).toHaveCount(0);
    // switched on from the game's Settings, it starts there and then
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('switch', { name: 'Tutorial' });
    await expect(settings).toHaveAttribute('aria-checked', 'false');
    await settings.click();
    await expect(settings).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.locator('#advisor .tutorial-card')).toContainText('Tutorial · step 1 of');
    expect(await page.evaluate(() => localStorage.getItem('pressure-point-tutorial'))).toBe('on');
  });

  test('a lesson opens over the game, paused, until it is read', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.speed = 1;
      pp.sim.emit({ type: 'lesson', id: 'heal' });
      pp.sim.emit({ type: 'lesson', id: 'payday' });
    });
    const modal = page.locator('#modal');
    await expect(modal).toContainText('Your first heal');
    await expect(modal.locator('.lesson-strip li')).toHaveCount(3);
    expect(await game.eval((pp) => pp.state.speed)).toBe(0);
    // nobody to show for this one
    await expect(modal.getByRole('button', { name: 'Show me' })).toHaveCount(0);
    await modal.getByRole('button', { name: 'Got it' }).click();
    // one raised meanwhile waits its turn
    await expect(modal).toContainText('Payday');
    await modal.getByRole('button', { name: 'Got it' }).click();
    await expect(modal).toBeEmpty();
    expect(await game.eval((pp) => pp.state.speed)).toBe(1);
  });
});

test.describe('the campaign', () => {
  test('starts at Willow Lane, and a star there opens The Exchange', async ({ game, page }) => {
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Campaign' }).click();
    const trail = page.locator('#title-campaign');
    await expect(trail.locator('.stop')).toHaveCount(5);
    await expect(trail.locator('.stop').nth(1)).toContainText('Earn a star at Willow Lane to open');
    await expect(trail.getByRole('button', { name: 'Play The Exchange' })).toHaveCount(0);

    await trail.getByRole('button', { name: 'Play Willow Lane' }).click();
    await page.waitForFunction(() => !!window.pp);
    await expect(page.locator('#objectives')).toContainText('Willow Lane');
    await expect(page.locator('#objectives')).toContainText('Heal 5 guests (0/5)');
    expect(await game.eval((pp) => [pp.state.center, pp.state.money])).toEqual(['willow', 20000]);
    // Willow Lane is massage only
    await game.menu('Rooms');
    await expect(game.card('Acupuncture Clinic')).toHaveCount(0);

    await game.eval((pp) => (pp.state.stars = 1));
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.locator('#title .save-card')).toContainText('Willow Lane');
    await page.getByRole('button', { name: 'Campaign' }).click();
    await expect(page.locator('#title-campaign .stop').first()).toContainText('★');
    await page.getByRole('button', { name: 'Play The Exchange' }).click();
    await page.waitForFunction(() => window.pp?.state.center === 'exchange');
    await expect(page.locator('#objectives')).toContainText('The Exchange');
  });

  test('a star at The Boardwalk opens High Pines, which is snowed in now and then each winter', async ({
    game,
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}');
      localStorage.setItem(
        'pressure-point-campaign',
        JSON.stringify({ stars: { willow: 1, exchange: 1, boardwalk: 1 } }),
      );
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Campaign' }).click();
    await page.getByRole('button', { name: 'Play High Pines' }).click();
    await page.waitForFunction(() => window.pp?.state.center === 'highpines');
    await expect(page.locator('#objectives')).toContainText('High Pines');
    expect(await game.eval((pp) => pp.state.money)).toBe(35000);
    await expect(page.locator('#stats .date')).not.toContainText('Snowed in');
    // the first day of a snowed-in spell, found by stepping through the year
    await game.eval((pp) => {
      pp.state.speed = 0;
      for (let day = 0; day < 400; day++) {
        pp.state.day = day;
        if (pp.sim.snowedIn()) return;
      }
    });
    await expect(page.locator('#stats .date')).toContainText('Snowed in');
  });

  test('a star at High Pines opens The Orchard Estate, with every treatment room from the start', async ({
    game,
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}');
      localStorage.setItem(
        'pressure-point-campaign',
        JSON.stringify({ stars: { willow: 1, exchange: 1, boardwalk: 1, highpines: 1 } }),
      );
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Campaign' }).click();
    // the first month's wages and the rooms against the money and the loan, before anything is built
    await expect(page.locator('#title-campaign .stop', { hasText: 'The Orchard Estate' })).toContainText(
      "Opening with a Receptionist, a Wellness Consultant and a practitioner for each of its 5 disciplines costs $10,750 a month in wages at a Trainee's pay and $48,000 for their rooms",
    );
    await page.getByRole('button', { name: 'Play The Orchard Estate' }).click();
    await page.waitForFunction(() => window.pp?.state.center === 'orchard');
    await expect(page.locator('#objectives')).toContainText('Rise to Wellness Studio');
    expect(await game.eval((pp) => pp.state.money)).toBe(45000);
    await game.menu('Rooms');
    await expect(game.card('Acupuncture Clinic')).toHaveCount(1);
    await expect(game.card('Reiki Studio')).toHaveCount(1);
  });

  test('karma from stars unlocks an item for good, in a game or from the karma shop', async ({ game, page }) => {
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('pressure-point-campaign', JSON.stringify({ stars: { willow: 3 } })),
    );
    await page.getByRole('button', { name: 'Campaign' }).click();
    const panel = page.locator('#title-campaign');
    await expect(panel.locator('.karma')).toHaveText('6 karma');
    await panel.getByRole('tab', { name: 'Karma shop' }).click();
    await panel.locator('.shop li', { hasText: 'Bonsai' }).getByRole('button').click();
    await expect(panel.locator('.shop li', { hasText: 'Bonsai' })).toContainText('Unlocked');
    await expect(panel.locator('.karma')).toHaveText('3 karma');
    // the koi pond costs more than is left
    await expect(panel.locator('.shop li', { hasText: 'Koi Pond' }).getByRole('button')).toBeDisabled();

    await panel.getByRole('tab', { name: 'Centers' }).click();
    await panel.getByRole('button', { name: 'Play Willow Lane again' }).click();
    await page.waitForFunction(() => !!window.pp);
    await game.menu('Items');
    await expect(game.card('Bonsai')).not.toHaveClass(/locked/);
    await expect(game.card('Mindfulness Arcade')).toContainText('Star 1, or 3 karma');
    await game.card('Mindfulness Arcade').click();
    await expect(page.locator('#modal')).toContainText('Unlock the Mindfulness Arcade?');
    await page.getByRole('button', { name: 'Unlock for 3 karma' }).click();
    await expect(page.locator('#modal')).toBeEmpty();
    await expect(game.card('Mindfulness Arcade')).not.toHaveClass(/locked/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pressure-point-campaign')!).unlocked)).toEqual([
      'bonsai',
      'arcade_machine',
    ]);
    // nothing left for the next one
    await game.card('Koi Pond').click();
    await expect(page.locator('#modal')).toContainText('Earn more with stars and achievements');
    await page.locator('#modal').getByRole('button', { name: 'OK', exact: true }).click();
    expect(game.errors).toEqual([]);
  });
});

test.describe('the sandbox', () => {
  test('starts with the money, treatments and unlocks chosen for it', async ({ game, page }) => {
    // starts a game twice, and a start can take half a minute on a busy machine
    test.slow();
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Sandbox' }).click();
    const panel = page.locator('#title-sandbox');
    await panel.getByRole('radio', { name: '$200,000' }).click();
    await panel.getByRole('switch', { name: 'Reiki' }).click();
    await panel.getByRole('switch', { name: 'Everything unlocked' }).click();
    await panel.getByRole('switch', { name: 'Staff challenges' }).click();
    await panel.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(
      await game.eval((pp) => [
        pp.state.money,
        pp.state.unlockAll,
        pp.sim.enabled('reiki'),
        pp.sim.unlocked('stone'),
        pp.state.challengesOn,
      ]),
    ).toEqual([200000, true, false, true, false]);
    await game.menu('Items');
    await expect(game.card('Koi Pond')).not.toHaveClass(/locked/);
    await game.menu('Rooms');
    await expect(game.card('Acupuncture Clinic')).not.toHaveClass(/locked/);

    // the next sandbox game, from the pause menu, is set up the same way
    await game.eval((pp) => Object.assign(window, { oldState: pp.state }));
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.locator('#modal').getByRole('button', { name: 'New game' }).click();
    await page.getByRole('button', { name: 'Start a new game' }).click();
    // a new game, however far it has got by the time anyone looks
    await page.waitForFunction(() => window.pp && window.pp.state !== (window as { oldState?: unknown }).oldState);
    expect(await game.eval((pp) => [pp.state.money, pp.state.unlockAll])).toEqual([200000, true]);
    expect(game.errors).toEqual([]);
  });
});

test.describe('difficulty', () => {
  test('a preset sets every pressure, any can be changed, and the sandbox game plays at it', async ({ game, page }) => {
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Sandbox' }).click();
    const panel = page.locator('#title-sandbox');
    await expect(panel.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
    await panel.getByRole('radio', { name: 'Demanding' }).click();
    await expect(panel.getByRole('button', { name: 'Loans: Lower' })).toBeVisible();
    // one setting changed on its own makes it a custom difficulty
    await panel.getByRole('button', { name: 'Patience: Impatient' }).click();
    await expect(panel.getByRole('button', { name: 'Patience: Patient' })).toBeVisible();
    await expect(panel.getByRole('radio', { name: 'Demanding' })).toHaveAttribute('aria-checked', 'false');
    await expect(panel).toContainText('Custom');
    await panel.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => [pp.state.difficulty.loans, pp.state.difficulty.patience])).toEqual([
      'harder',
      'easier',
    ]);
    // the bank lends half as much
    await game.menu('Money');
    await page.locator('#menu').getByRole('button', { name: /Loan/ }).click();
    await expect(page.locator('#menu')).toContainText('of $25,000');
    expect(game.errors).toEqual([]);
  });
});

test.describe('reiki', () => {
  test('the studio is locked until the second star, then can be built and staffed', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.stars = 1));
    await game.menu('Rooms');
    await expect(game.card('Reiki Studio')).toContainText('Unlocks at star 2');
    await game.menu('Hire');
    await expect(page.locator('#menu .tab', { hasText: 'Reiki Practitioner' })).toHaveCount(0);

    await game.eval((pp) => (pp.state.stars = 2));
    await game.menu('Rooms');
    await game.card('Reiki Studio').click();
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
    await expect(page.locator('#hint')).toContainText('Place the Reiki Table inside the room');
    await game.placeHeld();
    await game.placeHeld();
    await page.keyboard.press('Enter');
    await expect(page.locator('#toasts')).toContainText('Reiki Studio built!');
    await page.keyboard.press('Escape');

    await game.menu('Hire');
    await page.locator('#menu .tab', { hasText: 'Reiki Practitioner' }).click();
    await expect(page.locator('#menu .quals').first()).toContainText('Usui Reiki');
    await page.locator('#menu .card.cv').first().getByRole('button', { name: 'Hire' }).click();
    await game.menu('Treatments');
    await expect(page.locator('#menu')).toContainText('Delivered in the Reiki Studio');
    await expect(game.card('Usui Reiki')).toContainText('1 qualified');
    await expect(game.card('Distance Reiki')).toContainText('Unlocks at star 3');
  });

  test('switching reiki off in Settings hides its studio, staff and equipment', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => (pp.state.stars = 3));
    await game.menu('Rooms');
    await expect(game.card('Reiki Studio')).toBeVisible();

    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'Settings' }).click();
    const toggle = page.getByRole('switch', { name: 'Reiki' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    // acupuncture keeps its own switch
    await expect(page.getByRole('switch', { name: 'Acupuncture' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Resume' }).click();

    await game.menu('Rooms');
    await expect(game.card('Reiki Studio')).toHaveCount(0);
    await expect(game.card('Acupuncture Clinic')).toBeVisible();
    await game.menu('Hire');
    await expect(page.locator('#menu .tab', { hasText: 'Reiki Practitioner' })).toHaveCount(0);
    await game.menu('Items');
    await expect(game.card('Crystal Grid')).toHaveCount(0);
    expect(await game.eval((pp) => pp.sim.enabled('reiki'))).toBe(false);
  });
});

test.describe('sound healing', () => {
  test('the studio is locked until the first star, then can be built and staffed', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.menu('Rooms');
    await expect(game.card('Sound Bath Studio')).toContainText('Unlocks at star 1');

    await game.eval((pp) => (pp.state.stars = 1));
    // the menu stays open, so the card only unlocks once it redraws
    await expect(game.card('Sound Bath Studio')).not.toContainText('Unlocks at star');
    await game.card('Sound Bath Studio').click();
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
    await expect(page.locator('#hint')).toContainText('Place the Singing Bowls inside the room');
    await game.placeHeld();
    await game.placeHeld();
    await game.placeHeld();
    await page.keyboard.press('Enter');
    await expect(page.locator('#toasts')).toContainText('Sound Bath Studio built!');
    await page.keyboard.press('Escape');

    await game.menu('Hire');
    await page.locator('#menu .tab', { hasText: 'Sound Healer' }).click();
    await expect(page.locator('#menu .quals').first()).toContainText('Singing Bowls');
    await page.locator('#menu .card.cv').first().getByRole('button', { name: 'Hire' }).click();
    await game.menu('Treatments');
    await expect(page.locator('#menu')).toContainText('Delivered in the Sound Bath Studio');
    await expect(game.card('Singing Bowls')).toContainText('1 qualified');
    await expect(game.card('Gong Bath')).toContainText('Unlocks at star 2');
    expect(game.errors).toEqual([]);
  });
});

test.describe('the shaman', () => {
  test('the Ceremony Lodge opens at the second star, is staffed by a Shaman, and its ceremonies want a good room', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.stars = 1));
    await game.menu('Rooms');
    await expect(game.card('Ceremony Lodge')).toContainText('Unlocks at star 2');

    await game.eval((pp) => (pp.state.stars = 2));
    // the menu stays open, so the card only unlocks once it redraws
    await expect(game.card('Ceremony Lodge')).not.toContainText('Unlocks at star');
    await game.card('Ceremony Lodge').click();
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
    await expect(page.locator('#hint')).toContainText('Place the Ceremony Mat inside the room');
    await game.placeHeld();
    await game.placeHeld();
    await page.keyboard.press('Enter');
    await expect(page.locator('#toasts')).toContainText('Ceremony Lodge built!');
    await page.keyboard.press('Escape');

    await game.menu('Hire');
    await page.locator('#menu .tab', { hasText: 'Shaman' }).click();
    await expect(page.locator('#menu .quals').first()).toContainText('Spirit Animal Reading');
    await page.locator('#menu .card.cv').first().getByRole('button', { name: 'Hire' }).click();
    await game.menu('Treatments');
    await expect(page.locator('#menu')).toContainText('Delivered in the Ceremony Lodge');
    await expect(game.card('Spirit Animal Reading')).toContainText('1 qualified');
    await expect(game.card('Mushroom Ceremony')).toContainText('Set and setting');
    await expect(game.card('Ayahuasca Ceremony')).toContainText('Unlocks at star 3');
    expect(game.errors).toEqual([]);
  });
});

test.describe('magic mushrooms', () => {
  test('a Shaman supplies them under the Shop Counter, and the inspector who finds them can be paid off', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.stars = 2;
      pp.state.money = 100000;
      pp.sim.hire(pp.state.candidates.find((c) => c.role === 'shaman')!.id);
    });
    await game.give('shop_counter');
    await game.clickItem('shop_counter');
    const insp = page.locator('#inspector');
    await insp.getByRole('button', { name: /Mushrooms under the counter: put away/ }).click();
    await expect(insp).toContainText('Mushrooms under the counter: on sale');
    await page.keyboard.press('Escape');

    // left out on purpose, for the inspector to find
    await game.menu('Policy');
    await page.locator('#menu').getByRole('button', { name: 'Hide from inspector: on' }).click();
    await expect(page.locator('#menu')).toContainText('Hide from inspector: off');
    await page.keyboard.press('Escape');
    await game.eval((pp) => {
      pp.state.visitsOn = true;
      pp.state.nextVip = 1e9;
      pp.state.nextInspection = 0;
    });
    await game.fastForward(2);
    await expect(page.locator('#toasts')).toContainText('still on sale');
    await game.eval((pp) => {
      pp.state.visitNotice!.arrives = pp.state.day;
      // only until the report, as the game pauses for it, and an unsettled fine is paid the day after
      pp.state.speed = 1;
      for (let i = 0; i < 2400 && !pp.state.visitReport; i++) pp.sim.tick(0.1);
    });
    await game.settle();
    const modal = page.locator('#modal');
    await expect(modal.locator('.visit-rooms')).toContainText('Magic mushrooms under the counter!');
    const fines = await game.eval((pp) => pp.state.ledger.fines);
    await modal.getByRole('button', { name: /Make it go away/ }).click();
    await expect(modal.locator('h2')).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.visitReport?.outcome)).toBe('paid off');
    expect((await game.eval((pp) => pp.state.ledger.fines)) - fines).toBeGreaterThanOrEqual(10000);
    expect(game.errors).toEqual([]);
  });
});

test.describe('the first paydays', () => {
  test('the Payroll tab and the advisor weigh a month of wages against the bank and the loan left', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(1);
    await game.eval((pp) => {
      pp.state.speed = 0;
      // $6,000 a month in wages against $5,500 in hand, with the takings so far bringing the next payday in reach
      for (const st of pp.state.staff) st.salary = 2000;
      pp.state.money = 500;
      pp.state.loan = 45000;
      pp.state.ledger.treatment = 2000;
    });
    await game.settle();
    await expect(page.locator('#advisor')).toContainText(
      "Hire nobody more, send nobody on a course and turn house calls down until there is a month's wages in hand, $500 more: $6,000 a month in wages, against $500 in the bank and $5,000 the bank will still lend: less than one payday in hand",
    );
    await game.menu('Money');
    const menu = page.locator('#menu');
    await menu.getByRole('button', { name: /Payroll/ }).click();
    await expect(menu).toContainText('3 paydays come before the takings have a record');
    await expect(menu).toContainText('That is past what the paydays can carry');
    await expect(menu.locator('.ledger', { hasText: 'Months of wages in hand' })).toContainText('0.9');
    expect(game.errors).toEqual([]);
  });
});

test.describe('a payday the bank cannot cover', () => {
  /** Run up to the end of the month with the bank nearly empty and so much owed, until the game stops for the question. */
  async function toPayday(game: Game, loan = 0) {
    await game.start();
    await game.buildCenter();
    await game.eval((pp, loan) => {
      pp.state.money = 500;
      pp.state.loan = loan;
      pp.state.day = 29.95;
      pp.state.speed = 1;
      for (let i = 0; i < 100 && !pp.state.payrollDue; i++) pp.sim.tick(0.1);
    }, loan);
    await game.settle();
  }

  test('asks to borrow the wages, and carries on once it is taken', async ({ game, page }) => {
    await toPayday(game);
    const modal = page.locator('#modal');
    await expect(modal.locator('h2')).toContainText('Payday, and the bank is short');
    // the game waits, and Esc does not back out of it
    await page.keyboard.press('Escape');
    await expect(modal.locator('h2')).toContainText('Payday, and the bank is short');
    await modal.getByRole('button', { name: /^Borrow/ }).click();
    await expect(modal.locator('h2')).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.payrollDue)).toBeNull();
    expect(await game.eval((pp) => pp.state.loan)).toBeGreaterThan(0);
    expect(game.errors).toEqual([]);
  });

  test('pays the wages into the red when the loan is refused, and the bank lets it be while it would still lend', async ({
    game,
    page,
  }) => {
    await toPayday(game);
    const modal = page.locator('#modal');
    await modal.getByRole('button', { name: /^Pay into the red/ }).click();
    await expect(modal.locator('h2')).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.money)).toBeLessThan(0);
    expect(await game.eval((pp) => [pp.state.bankrupt, pp.state.insolvency])).toEqual([false, null]);
    expect(game.errors).toEqual([]);
  });

  test('pays the wages into the red past the loan, and the bank calls it in from a center losing money', async ({
    game,
    page,
  }) => {
    await toPayday(game, LOAN_MAX);
    const modal = page.locator('#modal');
    await modal.getByRole('button', { name: 'Pay into the red and carry on' }).click();
    await expect(modal.locator('h2')).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.money)).toBeLessThan(0);
    expect(await game.eval((pp) => pp.state.bankrupt)).toBe(false);
    // in the red past what the bank will lend, with no takings on the books, so the bank gives it ten days, and then calls it in
    expect(await game.eval((pp) => pp.state.insolvency)).not.toBeNull();
    // the bank looks as the next day begins, up to a day of play away: played here, not left to the running game, which
    // a busy machine runs too slowly to get there before the dialog is looked for
    await game.eval((pp, day) => {
      pp.state.day = pp.state.insolvency!.until;
      pp.state.speed = 1;
      for (let i = 0; i < (day + 1) * 10 && !pp.state.bankrupt; i++) pp.sim.tick(0.1);
    }, DAY_SECONDS);
    await game.settle();
    await expect(modal.locator('h2')).toContainText('Bankrupt');
    expect(await game.eval((pp) => pp.state.bankrupt)).toBe(true);
    // and it stays that way: Esc does not close it, and time does not move
    await page.keyboard.press('Escape');
    await expect(modal.locator('h2')).toContainText('Bankrupt');
    const day = await game.eval((pp) => pp.state.day);
    await game.fastForward(3);
    expect(await game.eval((pp) => pp.state.day)).toBe(day);
    expect(game.errors).toEqual([]);
  });
});

test.describe('the qi gong studio', () => {
  test('opens at the second star, is staffed by an Instructor, and keeps a weekly timetable', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.stars = 1));
    await game.menu('Rooms');
    await expect(game.card('Qi Gong Studio')).toContainText('Unlocks at star 2');

    await game.eval((pp) => (pp.state.stars = 2));
    // the menu stays open, so the card only unlocks once it redraws: clicked before then, it is still locked
    await expect(game.card('Qi Gong Studio')).not.toContainText('Unlocks at star');
    await game.card('Qi Gong Studio').click();
    await game.dragOutRoom(4, 4);
    await game.clickWall('south');
    await expect(page.locator('#hint')).toContainText('Place the Instructor’s Mat inside the room');
    await game.placeHeld();
    await game.placeHeld();
    await game.placeHeld();
    await page.keyboard.press('Enter');
    await expect(page.locator('#toasts')).toContainText('Qi Gong Studio built!');
    await page.keyboard.press('Escape');

    await game.menu('Hire');
    await page.locator('#menu .tab', { hasText: 'Qi Gong Instructor' }).click();
    await page.locator('#menu .card.cv').first().getByRole('button', { name: 'Hire' }).click();
    await page.keyboard.press('Escape');

    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    await game.clickRoom('qigong');
    const timetable = page.locator('#inspector .timetable');
    await expect(timetable).toContainText('shared among 3 class days');
    await timetable.getByRole('button', { name: 'Sun', exact: true }).click();
    await expect(timetable).toContainText('shared among 4 class days');
    expect(await game.eval((pp) => pp.state.rooms.find((r) => r.type === 'qigong')?.classDays)).toEqual([0, 2, 4, 6]);
    expect(game.errors).toEqual([]);
  });
});

test.describe('the recovery lounge', () => {
  test('is locked until the first star, then built for the treatments that need a rest after', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    await game.menu('Rooms');
    await expect(game.card('Recovery Lounge')).toContainText('Unlocks at star 1');
    await game.eval((pp) => (pp.state.stars = 1));
    await game.menu('Treatments');
    await expect(game.card('Deep Tissue')).toContainText('Rest after: needs a Recovery Lounge');
    await expect(game.card('Swedish')).not.toContainText('Rest after');

    await game.menu('Rooms');
    await game.card('Recovery Lounge').click();
    await game.dragOutRoom(3, 3);
    await game.clickWall('south');
    await expect(page.locator('#hint')).toContainText('Place the Lounger inside the room');
    await game.placeHeld();
    await page.keyboard.press('Enter');
    await expect(page.locator('#toasts')).toContainText('Recovery Lounge built!');
    await page.keyboard.press('Escape');

    await game.menu('Treatments');
    await expect(game.card('Deep Tissue')).toContainText('Rest after, in the Recovery Lounge');
    expect(game.errors).toEqual([]);
  });
});

test.describe('saved games', () => {
  /** Open the save and load screen from the pause menu. */
  const openSaves = async (page: Page) => {
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'Save or load' }).click();
  };
  test('warns when the game is also open in another tab, saving over this one', async ({ game, page }) => {
    await game.start();
    // a copy of this game, moved on a little, as the other tab has it
    const copy = await game.eval((pp) => ({ ...pp.state, money: pp.state.money + 1 }));
    const other = await page.context().newPage();
    // The warning comes once, the first time another tab writes the autosave. That tab writes it with the game's own
    // storage code rather than starting a second game, which on a busy machine takes most of a test's minute. The
    // warning fades after a few seconds, so watch for it from the start.
    await Promise.all([
      expect(page.locator('#toasts')).toContainText('also open in another tab or window', { timeout: 30_000 }),
      (async () => {
        await other.goto('/');
        await other.evaluate(async (state) => {
          const saves = (await import(/* @vite-ignore */ `${location.origin}/src/storage/saves.ts`)) as {
            autosave: (state: object) => void;
          };
          saves.autosave(state);
        }, copy);
      })(),
    ]);
    await other.close();
    expect(game.errors).toEqual([]);
  });

  test('saves as the page is hidden, since a hidden page may be closed without warning', async ({ game, page }) => {
    await game.start();
    /** The money in the stored autosave. */
    const stored = () =>
      page.evaluate(
        () => (JSON.parse(localStorage.getItem('pressure-point-save-v1') ?? '{}') as { money?: number }).money,
      );
    await game.eval((pp) => (pp.state.money = 12345));
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await stored()).toBe(12345);
    // and as it goes, for browsers that close a page without a word
    await game.eval((pp) => (pp.state.money = 23456));
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await stored()).toBe(23456);
  });

  /** A few numbers that should survive saving and loading. */
  const summary = (game: Game) =>
    game.eval((pp) => ({
      rooms: pp.state.rooms.length,
      staff: pp.state.staff.length,
      arrived: pp.state.stats.arrived,
      money: pp.state.money,
    }));

  test('the autosave brings a game back after a reload', async ({ game, page }) => {
    // starts a game twice, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await game.buildCenter();
    await game.fastForward(120);
    await game.eval((pp) => (pp.state.speed = 0));
    const before = await summary(game);
    await page.reload();
    await expect(page.locator('#title .save-card')).toContainText('Autosave');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await summary(game)).toEqual(before);
    await game.draw();
    await expect.poll(() => game.eval((pp) => pp.view.renderer.info.render.triangles)).toBeGreaterThan(5000);
  });

  test('a named save can be made, then loaded from the title screen', async ({ game, page }) => {
    // starts a game twice, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await game.buildCenter();
    await game.fastForward(60);
    await game.eval((pp) => (pp.state.speed = 0));
    const saved = await summary(game);
    await openSaves(page);
    await page.getByLabel('Name for this save').fill('Before the inspectors');
    await page.getByRole('button', { name: 'Save game' }).click();
    await expect(page.locator('.save-note')).toHaveText('Saved "Before the inspectors".');
    await expect(page.locator('.save-list li')).toHaveCount(2);

    // play on, so the autosave moves past the named save
    await page.getByRole('button', { name: 'Resume' }).click();
    await game.eval((pp) => {
      pp.state.speed = 1;
      pp.state.money += 4321;
    });
    await game.fastForward(60);
    await page.reload();

    await page.getByRole('button', { name: 'Load game' }).click();
    const row = page.locator('#title .save-list li', { hasText: 'Before the inspectors' });
    await expect(row).toContainText('healed');
    await row.getByRole('button', { name: 'Load' }).click();
    await page.waitForFunction(() => !!window.pp);
    await game.eval((pp) => (pp.state.speed = 0));
    expect(await summary(game)).toEqual(saved);
  });

  test('typing a save name does not trigger game shortcuts', async ({ game, page }) => {
    await game.start();
    await page.keyboard.press('2');
    await openSaves(page);
    await page.getByLabel('Name for this save').fill('');
    await page.getByLabel('Name for this save').pressSequentially('r 1 3 wasd');
    await page.keyboard.press('Enter');
    await expect(page.locator('.save-list li', { hasText: 'r 1 3 wasd' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume' }).click();
    expect(await game.eval((pp) => pp.state.speed)).toBe(2);
  });

  test('a save can be overwritten, and deleting asks twice', async ({ game, page }) => {
    await game.start();
    await openSaves(page);
    await page.getByLabel('Name for this save').fill('Slot A');
    await page.getByRole('button', { name: 'Save game' }).click();
    const row = page.locator('.save-list li', { hasText: 'Slot A' });
    await expect(row).toContainText('$30,000');
    await game.eval((pp) => (pp.state.money = 4200));
    await row.getByRole('button', { name: 'Overwrite' }).click();
    await expect(row).toContainText('$4,200');
    await expect(page.locator('.save-list li')).toHaveCount(2);

    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(row.getByRole('button', { name: 'Really delete?' })).toBeVisible();
    await expect(page.locator('.save-list li')).toHaveCount(2);
    await row.getByRole('button', { name: 'Really delete?' }).click();
    await expect(page.locator('.save-list li', { hasText: 'Slot A' })).toHaveCount(0);
  });

  test('says once when an autosave fails for want of room', async ({ game, page }) => {
    await game.start();
    // count the warnings as they are given, since one fades after a few seconds, which a busy machine can take to check
    await game.eval((pp) => {
      const ui = pp.ui as unknown as { toast(text: string, ...rest: unknown[]): void };
      const toast = ui.toast.bind(ui);
      const counted = window as unknown as { saidFull: number };
      counted.saidFull = 0;
      /** Count a warning about full storage on its way to the screen. */
      ui.toast = (text, ...rest) => {
        if (text.includes('could not be saved')) counted.saidFull++;
        toast(text, ...rest);
      };
    });
    // storage that has no room left for the game
    await page.evaluate(() => {
      const store = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value as Storage['setItem'];
      /** Refuse the game's saves, as full storage does, and keep anything else. */
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (key.startsWith('pressure-point-save')) throw new DOMException('full', 'QuotaExceededError');
        store.call(this, key, value);
      };
    });
    // opening the saves screen saves the game first
    await openSaves(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.locator('#toasts')).toContainText('could not be saved');
    await openSaves(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    expect(await page.evaluate(() => (window as unknown as { saidFull: number }).saidFull)).toBe(1);
  });

  test('a new game is refused, not started, when there is no room to keep the old one', async ({ game, page }) => {
    // starts a game three times, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await game.eval((pp) => (pp.state.money = 12345));
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Continue' }).waitFor();
    // no room for a Previous game copy
    await page.addInitScript(() => {
      const store = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value as Storage['setItem'];
      /** Refuse the Previous game copy, as full storage does, and keep anything else. */
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (key === 'pressure-point-save:previous') throw new DOMException('full', 'QuotaExceededError');
        store.call(this, key, value);
      };
    });
    await page.reload();
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await page.getByRole('button', { name: 'Start building' }).click();
    await expect(page.locator('#title [role="alert"]')).toContainText('no room to keep');
    // the old game is still there to continue
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => pp.state.money)).toBe(12345);
  });

  test("takes the title screen's picture of the game on the way out, not at every autosave", async ({ game, page }) => {
    await game.start();
    /** Whether the autosave has a picture. */
    const pictured = () => page.evaluate(() => localStorage.getItem('pressure-point-thumb:auto') !== null);
    // the regular autosave, from the loop's own timer, told its interval has passed rather than waited out
    await game.eval((pp) => pp.loop.saveSoon());
    await page.waitForFunction(() => localStorage.getItem('pressure-point-save-v1') !== null);
    expect(await pictured()).toBe(false);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await pictured()).toBe(true);
  });

  test('the same file can be picked to import again', async ({ game, page }) => {
    await game.start();
    await openSaves(page);
    const input = page.locator('.filebtn input');
    await input.setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(page.locator('.save-note')).toContainText('"notes.json" is not a Pressure Point Institute save');
    // a browser reports a pick only when the file changes, so the input is emptied after each one
    expect(await input.inputValue()).toBe('');
  });

  test('a save can be exported to a file and imported again', async ({ game, page }, testInfo) => {
    // starts a game three times, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await game.buildCenter();
    await game.fastForward(30);
    await game.eval((pp) => (pp.state.speed = 0));
    const before = await summary(game);
    await openSaves(page);
    await page.getByLabel('Name for this save').fill('Travels well');
    await page.getByRole('button', { name: 'Save game' }).click();
    const row = page.locator('.save-list li', { hasText: 'Travels well' });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      row.getByRole('button', { name: 'Export' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('pressure-point-travels-well.json');
    const file = testInfo.outputPath('export.json');
    await download.saveAs(file);

    // a different browser profile stands in for the desktop app: nothing saved there yet
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('about:blank');
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await page.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => !!window.pp);
    await openSaves(page);
    await page.locator('.filebtn input').setInputFiles(file);
    await expect(page.locator('.save-note')).toHaveText('Imported "Travels well".');
    await page.locator('.save-list li', { hasText: 'Travels well' }).getByRole('button', { name: 'Load' }).click();
    await page.waitForFunction(() => (window.pp?.state.rooms.length ?? 0) > 0);
    await game.eval((pp) => (pp.state.speed = 0));
    expect(await summary(game)).toEqual(before);
  });

  test('a file that is not a save is refused politely', async ({ game, page }) => {
    await game.start();
    await openSaves(page);
    await page
      .locator('.filebtn input')
      .setInputFiles({ name: 'holiday.json', mimeType: 'application/json', buffer: Buffer.from('{"photos": 12}') });
    await expect(page.locator('.save-note.bad')).toContainText('"holiday.json" is not a Pressure Point Institute save');
    await expect(page.locator('.save-list li')).toHaveCount(1);
  });

  test('starting a new game keeps the old one as Previous game', async ({ game, page }) => {
    // starts a game three times, and a start can take half a minute on a busy machine
    test.slow();
    await game.start();
    await game.buildCenter();
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.locator('#modal')).toContainText('moves to "Previous game"');
    await page.getByRole('button', { name: 'Start a new game' }).click();
    // straight into the new game, with no stop at the title screen
    await page.waitForFunction(() => window.pp?.state.rooms.length === 0);
    expect(await game.eval((pp) => pp.state.money)).toBe(30000);

    await openSaves(page);
    const prev = page.locator('.save-list li', { hasText: 'Previous game' });
    await prev.getByRole('button', { name: 'Load' }).click();
    await page.waitForFunction(() => window.pp?.state.rooms.length === 3);
    expect(await game.eval((pp) => pp.state.staff.length)).toBe(3);
  });
});

test.describe('regulars', () => {
  test('come back under their own name, are tagged as regulars, and are listed under Stats', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      const s = pp.state;
      s.open = true;
      s.regulars = [{ id: 9000, name: 'Margo Finch', look: s.candidates[0]!.look, visits: 2, loyalty: 64, due: 0 }];
      s.spawnT = 0;
    });
    await game.fastForward(1);
    const id = await game.eval((pp) => pp.state.guests.find((g) => g.regular === 9000)?.id ?? 0);
    expect(id).toBeGreaterThan(0);
    await game.eval((pp, guest) => pp.tools.select({ kind: 'guest', id: guest }), id);
    const inspector = page.locator('#inspector');
    await expect(inspector).toContainText('Margo Finch');
    await expect(inspector).toContainText('Loyal regular, on their 3rd visit');
    await game.menu('Stats');
    const menu = page.locator('#menu');
    await menu.getByRole('button', { name: /Regulars/ }).click();
    await expect(menu.locator('.regulars tbody tr')).toHaveCount(1);
    await expect(menu.locator('.regulars')).toContainText('Here now');
    expect(game.errors).toEqual([]);
  });
});

test.describe('turning the camera', () => {
  test('turns a quarter at a time by key or button, and what is clicked is still what is under the cursor', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    expect(await game.eval((pp) => pp.view.turn)).toBe(0);
    await page.keyboard.press('KeyE');
    expect(await game.eval((pp) => pp.view.turn)).toBe(1);
    await page.keyboard.press('KeyQ');
    await page.keyboard.press('KeyQ');
    expect(await game.eval((pp) => pp.view.turn)).toBe(3);
    await page.locator('#sys').locator('[data-tip^="Turn the camera"]').click();
    await page.locator('#sys').locator('[data-tip^="Turn the camera"]').click();
    expect(await game.eval((pp) => pp.view.turn)).toBe(1);
    // once the camera has glided round
    await game.cameraStill();
    await game.clickRoom('massage');
    await expect(page.locator('#inspector')).toContainText('Massage Suite');
    // the room selected is outlined in gold on its floor
    await game.settle();
    expect(await game.eval((pp) => pp.view.overlays.outlineShown)).toBe(true);
    expect(game.errors).toEqual([]);
  });
});

test.describe('the camera for a player who asks for less motion', () => {
  test('cuts round and over rather than gliding', async ({ game, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await game.start();
    await page.keyboard.press('KeyE');
    expect(await game.eval((pp) => [pp.view.turn, pp.view.cameraStill])).toEqual([1, true]);
    await game.eval((pp) => pp.view.lookAt(10, 10));
    expect(await game.eval((pp) => pp.view.cameraStill)).toBe(true);
    expect(game.errors).toEqual([]);
  });
});

test.describe('room signs', () => {
  /** What the lamp on the sign of the room of this type shows. */
  const lamp = (game: Game, type: string) =>
    game.eval((pp, t) => pp.view.rooms.lampOf(pp.state.rooms.find((r) => r.type === t)!.id), type);

  test("turn amber when a room's staff leave it, and red when its equipment breaks", async ({ game }) => {
    await game.start();
    await game.buildCenter();
    // the therapist walks in from the street and takes up their post
    await game.fastForward(40);
    await game.eval((pp) => (pp.state.speed = 0));
    await game.settle();
    expect(await game.eval((pp) => pp.state.staff.find((s) => s.role === 'therapist')!.state)).toBe('atPost');
    expect(await lamp(game, 'massage')).toBe('working');
    // a room with no station to work is working once it is finished
    expect(await lamp(game, 'training')).toBe('working');

    await game.eval((pp) => pp.sim.fire(pp.state.staff.find((s) => s.role === 'therapist')!.id));
    await game.settle();
    expect(await lamp(game, 'massage')).toBe('idle');

    await game.eval((pp) => (pp.state.items.find((it) => it.type === 'massage_table')!.wear = 100));
    await game.settle();
    expect(await lamp(game, 'massage')).toBe('broken');
  });

  test('stay grey while a room is still a blueprint', async ({ game }) => {
    await game.start();
    await game.eval((pp) => {
      pp.sim.createRoom('massage', { x: 11, y: 5, w: 4, h: 4 }, { x: 12, y: 8, dx: 0, dy: 1 });
    });
    await game.settle();
    expect(await lamp(game, 'massage')).toBe('unfinished');
  });
});

test.describe('out of doors', () => {
  test('a Generator is placed on the grounds from the Items menu, and keeps the power on through a cut', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.menu('Items');
    await page.locator('#menu .tab', { hasText: 'Outdoors' }).click();
    await expect(game.card('Generator')).toContainText('Outdoors');
    await expect(game.card('Bench')).toHaveCount(0);
    await game.card('Generator').click();
    await expect(page.locator('#hint')).toContainText('beside a path or the pavement');
    // inside the building is refused, and explained
    const indoors = await game.eval((pp) => pp.view.project(20.5, 10.5, 0));
    await page.mouse.move(indoors.x, indoors.y, { steps: 4 });
    await expect(page.locator('#hint')).toContainText('Goes outdoors, not inside');
    const to = await game.placeHeld();
    await page.keyboard.press('Escape');
    const placed = await game.eval((pp) => {
      const gen = pp.state.items.find((i) => i.type === 'generator')!;
      return { x: gen.x, y: gen.y, inside: pp.sim.world.inside(gen.x, gen.y), money: pp.state.money };
    });
    expect([placed.x, placed.y]).toEqual([to.x, to.y]);
    expect(placed.inside).toBe(false);
    expect(placed.money).toBe(30000 - 2800);
    // it is picked like anything else, and its inspector offers to move and sell it
    await game.settle();
    await game.clickItem('generator');
    await expect(page.locator('#inspector')).toContainText('Generator');
    await expect(page.locator('#inspector').getByRole('button', { name: 'Move' })).toBeVisible();
    // a power cut coming finds it ready, and it runs through the cut
    await game.eval((pp) => {
      const day = pp.state.day;
      pp.state.mishap = { kind: 'power', starts: day + 3, ends: day + 4, prepared: false, started: false };
    });
    await expect(page.locator('.mishap-pill')).toContainText('Power cut: starts in 3 days · the Generator is ready');
    await game.fastForward(3 * 6 + 1);
    await expect(page.locator('.mishap-pill.on')).toContainText('the Generator is on');
    expect(await game.eval((pp) => pp.state.mishap?.prepared)).toBe(false);
    expect(game.errors).toEqual([]);
  });
});
