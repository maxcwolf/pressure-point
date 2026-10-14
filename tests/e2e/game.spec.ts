import type { Page } from '@playwright/test';

import { expect, type Game, test } from './fixtures';

test.describe('starting out', () => {
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

  test('music and sound can be switched off on the title screen', async ({ game, page }) => {
    await page.goto('/');
    const music = page.locator('#title').getByTitle('Music');
    const sound = page.locator('#title').getByTitle('Sound effects');
    await expect(music).toHaveAttribute('aria-pressed', 'true');
    await music.click();
    await expect(music).toHaveAttribute('aria-pressed', 'false');
    await sound.click();
    await expect(sound).toHaveText('🔇');
    expect(await page.evaluate(() => localStorage.getItem('pressure-point-audio'))).toBe(
      '{"sound":false,"music":false}',
    );
    // the choice carries into the game, and survives a reload
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await page.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => !!window.pp);
    await expect(page.locator('#sys').getByTitle('Music')).toHaveClass(/off/);
    await expect(page.locator('#sys').getByTitle('Sound effects')).toHaveText('🔇');
    await page.reload();
    await expect(page.locator('#title').getByTitle('Music')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#title').getByTitle('Music').click();
    await expect(page.locator('#title').getByTitle('Music')).toHaveAttribute('aria-pressed', 'true');
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

  test('an invalid spot is refused and explained', async ({ game, page }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Bench').click();
    await game.hoverLawn();
    await expect(page.locator('#hint')).toContainText('Must be inside the building');
    await game.clickLawn();
    expect(await game.eval((pp) => pp.state.items.length)).toBe(0);
  });

  test('the newer items wait for their stars, or karma', async ({ game }) => {
    await game.start();
    await game.menu('Items');
    await expect(game.card('Water Cooler')).toContainText('Corridor');
    await expect(game.card('Mindfulness Arcade')).toContainText('Star 1, or ✨ 3 karma');
    await expect(game.card('Aquarium')).toContainText('Star 2, or ✨ 5 karma');
    await expect(game.card('Trophy Cabinet')).toContainText('Star 3, or ✨ 5 karma');
    await expect(game.card('Koi Pond')).toContainText('🔒 ✨ 6 karma');
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
    await expect(page.locator('#hint')).toContainText('purple square: staff');
    await expect(page.locator('#hint')).toContainText('orange square: guests');
    expect(await marked()).toEqual(await used(table));
    expect(await marked()).toHaveLength(2);
    await game.placeHeld();
    // the oil cart is not used by anyone, so it marks no squares and the hint says nothing about them
    await game.hoverHeld();
    expect(await marked()).toEqual([]);
    await expect(page.locator('#hint')).not.toContainText('square');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    // a bench is for guests only
    await game.menu('Items');
    await game.card('Bench').click();
    const bench = await game.hoverHeld();
    await expect(page.locator('#hint')).toContainText('orange square: guests');
    await expect(page.locator('#hint')).not.toContainText('staff');
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
    await page.getByRole('button', { name: 'Borrow $5,000' }).click();
    await expect(page.locator('#stats')).toContainText('$35,000');
    await expect(page.locator('#menu')).toContainText('Loan: $5,000 of $50,000');
    await page.getByRole('button', { name: '+10%' }).click();
    await expect(page.locator('#menu')).toContainText('Prices: 110% of standard');
    await page.getByRole('button', { name: 'Repay $5,000' }).click();
    expect(await game.eval((pp) => [pp.state.loan, pp.state.money, pp.state.priceLevel])).toEqual([0, 30000, 1.1]);
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

  // the offer used to add "massage" to every technique, so an acupuncture emergency asked for "Cupping massage"
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
    await offer.getByTitle('Decide later').click();
    await expect(offer).toHaveText('🚨 Emergency on offer: 8 days left to decide');
    // the clock keeps running while it is put aside
    await game.eval((pp) => (pp.state.day += 5));
    await expect(offer).toContainText('3 days left to decide');
    await offer.getByTitle('Show the emergency').click();
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
    await expect(page.locator('#stats .speed.on')).toHaveText('▶▶▶');
    await page.keyboard.press('1');
    await game.menu('Items');
    await game.card('Bench').click();
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('item');
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => pp.tools.tool.kind)).toBe('none');
  });

  test('the camera pans and zooms', async ({ game, page }) => {
    await game.start();
    // a plant to watch: when the camera moves right, it slides left across the screen
    await game.give('plant');
    const before = await game.itemPoint('plant');
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    const after = await game.itemPoint('plant');
    expect(after.x).toBeLessThan(before.x - 20);
    const dist = await game.eval((pp) => pp.view.dist);
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, -400);
    expect(await game.eval((pp) => pp.view.dist)).toBeLessThan(dist);
  });

  test('the pause menu shows the controls and resumes at the old speed', async ({ game, page }) => {
    await game.start();
    await page.keyboard.press('2');
    await page.locator('#sys').getByTitle('Menu').click();
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
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    const before = await game.eval((pp) => ({
      rooms: pp.state.rooms.length,
      staff: pp.state.staff.length,
      money: pp.state.money,
    }));
    await page.locator('#sys').getByTitle('Menu').click();
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
    await page.locator('#sys').getByTitle('Menu').click();
    await expect(page.getByRole('button', { name: 'Main menu' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Exit/ })).toHaveCount(0);
  });
});

test.describe('acupuncture and settings', () => {
  /** Open the pause menu and press one of its buttons. */
  const pauseMenu = async (page: Page, button: string) => {
    await page.locator('#sys').getByTitle('Menu').click();
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
    await expect(page.locator('.title-sys').getByTitle('Music')).toHaveAttribute('aria-pressed', 'false');

    // the panel stands in for the menu until Back, or Esc
    await expect(page.getByRole('button', { name: 'Sandbox' })).toBeHidden();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await expect(page.locator('#title-sandbox')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Sandbox' }).click();

    await page.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => pp.sim.enabled('acupuncture'))).toBe(false);
    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('switch', { name: 'Acupuncture' })).toHaveAttribute('aria-checked', 'false');
  });

  test('a saved game keeps its own choice', async ({ game, page }) => {
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
    await page.locator('#toasts .toast', { hasText: `${therapist.name} joins` }).click();
    await expect(page.locator('#inspector')).toContainText(therapist.name);
    await expect
      .poll(async () => {
        const at = await lookingAt(game);
        return Math.hypot(at.x - therapist.x, at.z - therapist.y);
      })
      .toBeLessThan(0.5);
  });

  test('clicking the advisor about a raise selects the one asking', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    const name = await game.eval((pp) => {
      pp.state.speed = 0;
      const st = pp.state.staff.find((s) => s.role === 'consultant')!;
      st.raiseAsked = true;
      return st.name;
    });
    const note = page.locator('#advisor .note');
    await expect(note).toContainText(`${name} wants a raise`);
    await note.click();
    await expect(page.locator('#inspector')).toContainText(name);
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
});

test.describe('stats', () => {
  test('the Money menu counts guests put off by prices', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => {
      pp.state.tally.priced = 3;
      pp.state.months = [{ ...pp.state.tally, priced: 5, ledger: pp.state.ledger, reputation: 30, money: 0 }];
    });
    await game.menu('Money');
    await expect(page.locator('#menu .priced')).toHaveText('Put off by prices: 3 this month, 5 last month');
  });

  test('the Stats menu charts chosen figures, and remembers the choice', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(200);
    await game.eval((pp) => (pp.state.speed = 0));
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

test.describe('the campaign', () => {
  test('starts at Willow Lane, and a star there opens The Exchange', async ({ game, page }) => {
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Campaign' }).click();
    const trail = page.locator('#title-campaign');
    await expect(trail.locator('.stop')).toHaveCount(3);
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
    await page.locator('#sys').getByTitle('Menu').click();
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.locator('#title .save-card')).toContainText('Willow Lane');
    await page.getByRole('button', { name: 'Campaign' }).click();
    await expect(page.locator('#title-campaign .stop').first()).toContainText('★');
    await page.getByRole('button', { name: 'Play The Exchange' }).click();
    await page.waitForFunction(() => window.pp?.state.center === 'exchange');
    await expect(page.locator('#objectives')).toContainText('The Exchange');
  });

  test('karma from stars unlocks an item for good, in a game or from the karma shop', async ({ game, page }) => {
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('pressure-point-campaign', JSON.stringify({ stars: { willow: 3 } })),
    );
    await page.getByRole('button', { name: 'Campaign' }).click();
    const panel = page.locator('#title-campaign');
    await expect(panel.locator('.karma')).toHaveText('✨ 6 karma');
    await panel.getByRole('tab', { name: 'Karma shop' }).click();
    await panel.locator('.shop li', { hasText: 'Bonsai' }).getByRole('button').click();
    await expect(panel.locator('.shop li', { hasText: 'Bonsai' })).toContainText('Unlocked');
    await expect(panel.locator('.karma')).toHaveText('✨ 3 karma');
    // the koi pond costs more than is left
    await expect(panel.locator('.shop li', { hasText: 'Koi Pond' }).getByRole('button')).toBeDisabled();

    await panel.getByRole('tab', { name: 'Centers' }).click();
    await panel.getByRole('button', { name: 'Play Willow Lane again' }).click();
    await page.waitForFunction(() => !!window.pp);
    await game.menu('Items');
    await expect(game.card('Bonsai')).not.toHaveClass(/locked/);
    await expect(game.card('Mindfulness Arcade')).toContainText('Star 1, or ✨ 3 karma');
    await game.card('Mindfulness Arcade').click();
    await expect(page.locator('#modal')).toContainText('Unlock the Mindfulness Arcade?');
    await page.getByRole('button', { name: 'Unlock for ✨ 3 karma' }).click();
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
    await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Sandbox' }).click();
    const panel = page.locator('#title-sandbox');
    await panel.getByRole('radio', { name: '$200,000' }).click();
    await panel.getByRole('switch', { name: 'Reiki' }).click();
    await panel.getByRole('switch', { name: 'Everything unlocked' }).click();
    await panel.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(
      await game.eval((pp) => [pp.state.money, pp.state.unlockAll, pp.sim.enabled('reiki'), pp.sim.unlocked('stone')]),
    ).toEqual([200000, true, false, true]);
    await game.menu('Items');
    await expect(game.card('Koi Pond')).not.toHaveClass(/locked/);
    await game.menu('Rooms');
    await expect(game.card('Acupuncture Clinic')).not.toHaveClass(/locked/);

    // the next sandbox game, from the pause menu, is set up the same way
    await page.locator('#sys').getByTitle('Menu').click();
    await page.locator('#modal').getByRole('button', { name: 'New game' }).click();
    await page.getByRole('button', { name: 'Start a new game' }).click();
    await page.waitForFunction(() => window.pp?.state.day === 0);
    expect(await game.eval((pp) => [pp.state.money, pp.state.unlockAll])).toEqual([200000, true]);
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
    await expect(game.card('Sound Bath')).toContainText('Unlocks at star 3');
  });

  test('switching reiki off in Settings hides its studio, staff and equipment', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => (pp.state.stars = 3));
    await game.menu('Rooms');
    await expect(game.card('Reiki Studio')).toBeVisible();

    await page.locator('#sys').getByTitle('Menu').click();
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

test.describe('saved games', () => {
  /** Open the save and load screen from the pause menu. */
  const openSaves = async (page: Page) => {
    await page.locator('#sys').getByTitle('Menu').click();
    await page.getByRole('button', { name: 'Save or load' }).click();
  };
  test('warns when the game is also open in another tab, saving over this one', async ({ game, page }) => {
    await game.start();
    const other = await page.context().newPage();
    await other.goto('/');
    await other.getByRole('button', { name: 'Sandbox' }).click();
    await other.getByRole('button', { name: 'Start building' }).click();
    await other.waitForFunction(() => !!window.pp);
    // opening the saves screen there saves that copy of the game
    await openSaves(other);
    await expect(page.locator('#toasts')).toContainText('also open in another tab or window');
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
    await expect.poll(() => game.eval((pp) => pp.view.renderer.info.render.triangles)).toBeGreaterThan(5000);
  });

  test('a named save can be made, then loaded from the title screen', async ({ game, page }) => {
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
    await expect(page.locator('#toasts .toast', { hasText: 'could not be saved' })).toHaveCount(1);
  });

  test('a new game is refused, not started, when there is no room to keep the old one', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => (pp.state.money = 12345));
    await page.locator('#sys').getByTitle('Menu').click();
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
    // the regular autosave, after twelve seconds of play
    await page.waitForFunction(() => localStorage.getItem('pressure-point-save-v1') !== null, null, {
      timeout: 20_000,
    });
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
    await game.start();
    await game.buildCenter();
    await page.locator('#sys').getByTitle('Menu').click();
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
