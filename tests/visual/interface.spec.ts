// A picture of every screen of the interface. Run `yarn test:visual` to compare with the stored
// pictures, and `yarn test:visual:update` to replace them after a change that is meant to be seen.
import { expect, test } from './fixtures';

/** The emergency on offer in the pictures, lapsing eight days after the day given. */
const OFFER = (day: number) => ({
  condition: 'knotted' as const,
  cause: 'A yoga retreat has gone badly wrong.',
  total: 6,
  target: 4,
  healed: 0,
  pending: 0,
  reward: 3200,
  deadline: day + 8,
});

test.describe('title screen', () => {
  test('with a game to continue', async ({ screens }) => {
    await screens.title();
    await screens.shot('title');
  });

  test('settings and saved games', async ({ screens, page }) => {
    await screens.title();
    await page.getByRole('button', { name: 'Settings' }).click();
    await screens.shot('title-settings');
    await page.getByRole('button', { name: '‹ Back', exact: true }).click();
    await page.getByRole('button', { name: 'Load game' }).click();
    await screens.shot('title-saves');
  });

  test('the campaign trail', async ({ screens, page }) => {
    await screens.title();
    await page.evaluate(() =>
      localStorage.setItem(
        'pressure-point-campaign',
        JSON.stringify({ stars: { willow: 2 }, achieved: ['called-in'], unlocked: ['bonsai'] }),
      ),
    );
    await page.getByRole('button', { name: 'Campaign' }).click();
    await screens.shot('title-campaign');
    await page.getByRole('tab', { name: 'Karma shop' }).click();
    await screens.shot('title-karma-shop');
    await page.locator('.shop-head').scrollIntoViewIfNeeded();
    await screens.shot('title-karma-shop-decor');
    await page.getByRole('tab', { name: 'Achievements' }).click();
    await screens.shot('title-achievements');
  });

  test('in a short window', async ({ screens, page }) => {
    await page.setViewportSize({ width: 1000, height: 600 });
    await screens.title();
    await screens.shot('title-short');
    await page.getByRole('button', { name: 'Settings' }).click();
    await screens.shot('title-short-settings');
  });

  test('the sandbox settings', async ({ screens, page }) => {
    await screens.title();
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await screens.shot('title-sandbox');
    // relaxed, but for impatient guests: a custom difficulty
    await page.getByRole('radio', { name: 'Relaxed' }).click();
    await page.getByRole('button', { name: 'Patience: Patient' }).click();
    await page.getByRole('button', { name: 'Patience: Usual' }).click();
    await screens.shot('title-sandbox-custom');
  });

  test('what is new', async ({ screens, page }) => {
    await screens.title();
    await page.getByRole('button', { name: 'What’s new' }).click();
    // the oldest notes, which never change, unlike the newest. The newer ones are taken out first: scrolled down past
    // them, every release added at the top moved the picture by a fraction of a pixel.
    await page.locator('#title-changes section').evaluateAll((sections) => {
      for (const s of sections.slice(0, -4)) s.remove();
    });
    await page.locator('#title-changes section').last().scrollIntoViewIfNeeded();
    await screens.shot('title-changelog');
  });
});

test.describe('in a game', () => {
  test('the heads-up display', async ({ screens }) => {
    await screens.play();
    await screens.shot('hud');
  });

  for (const menu of ['Rooms', 'Items', 'Hire', 'Staff', 'Treatments', 'Money', 'Policy', 'Stats'] as const) {
    test(`the ${menu} menu`, async ({ screens, game }) => {
      await screens.play();
      await game.menu(menu);
      await screens.shot(`menu-${menu.toLowerCase()}`);
    });
  }

  test("the Rooms menu's templates", async ({ screens, game, page }) => {
    // two templates kept from earlier games: one to build, and one whose room is still locked here
    await page.addInitScript(() => {
      /** A 4×4 room with its door on the bottom wall and two pieces of furniture along the top. */
      const room = (type: string, table: string, side: string) => ({
        type,
        w: 4,
        h: 4,
        door: { x: 1, y: 3, dx: 0, dy: 1 },
        windows: [{ x: 0, y: 1, dx: -1, dy: 0 }],
        items: [
          { type: table, x: 1, y: 0, rot: 0 },
          { type: side, x: 3, y: 0, rot: 0 },
        ],
      });
      localStorage.setItem(
        'pressure-point-room-templates',
        JSON.stringify([
          { name: 'Corner suite', layout: room('massage', 'massage_table', 'oil_trolley') },
          { name: 'Quiet reiki', layout: room('reiki', 'reiki_table', 'reiki_altar') },
        ]),
      );
    });
    await screens.play();
    await game.menu('Rooms');
    const templates = page.locator('#menu .tab', { hasText: 'Templates' });
    await templates.click();
    // the menu shrinks to the shorter tab, so the pointer follows its tab rather than resting on an objective's tooltip
    await templates.hover();
    await screens.shot('menu-rooms-templates');
  });

  test('the Hire menu on another tab', async ({ screens, game, page }) => {
    await screens.play();
    await game.menu('Hire');
    await page.locator('#menu .tab', { hasText: 'Massage Therapist' }).click();
    await screens.shot('menu-hire-therapist');
  });

  test('the inspector for a guest', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => pp.tools.select({ kind: 'guest', id: pp.state.guests[0]!.id }));
    await screens.shot('inspector-guest');
    // a loyal regular, back for their fifth visit
    await game.eval((pp) => {
      const g = pp.state.guests[0]!;
      pp.state.regulars = [{ id: 9000, name: g.name, look: g.look, visits: 5, loyalty: 64, due: 0 }];
      g.regular = 9000;
    });
    await screens.shot('inspector-regular');
  });

  for (const role of ['receptionist', 'therapist'] as const) {
    test(`the inspector for a ${role}`, async ({ screens, game }) => {
      await screens.play();
      await game.eval(
        (pp, role) => pp.tools.select({ kind: 'staff', id: pp.state.staff.find((s) => s.role === role)!.id }),
        role,
      );
      await screens.shot(`inspector-${role}`);
    });
  }

  test('an applicant with a rare quirk, and their inspector once hired', async ({ screens, game, page }) => {
    await screens.play();
    // three common quirks and a rare one, the most a card holds, beside two with fewer
    const id = await game.eval((pp) => {
      const c = pp.state.candidates.find((x) => x.role === 'therapist')!;
      c.traits = ['brisk', 'tireless', 'quick', 'hands'];
      return c.id;
    });
    await game.menu('Hire');
    await page.locator('#menu .tab', { hasText: 'Massage Therapist' }).click();
    await screens.shot('menu-hire-rare');
    await page
      .locator('#menu .cv', { hasText: 'Healing Hands' })
      .getByRole('button', { name: 'Hire', exact: true })
      .click();
    // hired, and with a few treatments their Healing Hands saved
    await game.eval((pp, id) => {
      const st = pp.state.staff.at(-1)!;
      if (pp.state.candidates.some((c) => c.id === id)) throw new Error('not hired');
      st.rescued = 4;
      pp.tools.select({ kind: 'staff', id: st.id });
    }, id);
    await screens.shot('inspector-rare');
  });

  test('the inspector comparing two of the staff', async ({ screens, game, page }) => {
    await screens.play();
    await game.eval((pp) =>
      pp.tools.select({ kind: 'staff', id: pp.state.staff.find((s) => s.role === 'therapist')!.id }),
    );
    await page.locator('#inspector').getByRole('button', { name: 'Compare' }).click();
    await page.locator('#inspector button.pick').first().click();
    // the click can scroll the inspector down to its pick first, and the picture is of its top
    await page.locator('#inspector .panel').evaluate((panel) => panel.scrollTo(0, 0));
    // the pointer, left where the pick was, can rest on the scrolled-up stars and raise their tooltip
    await page.mouse.move(0, 0);
    await screens.shot('inspector-compare');
  });

  for (const type of ['massage_table', 'plant', 'bench'] as const) {
    test(`the inspector for a ${type}`, async ({ screens, game }) => {
      await screens.play();
      await game.eval(
        (pp, type) => pp.tools.select({ kind: 'item', id: pp.state.items.find((i) => i.type === type)!.id }),
        type,
      );
      await screens.shot(`inspector-${type.replace('_', '-')}`);
    });
  }

  test('a line at a massage table', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      // the guests there are, lined up at the table, one of them an emergency
      const table = pp.state.items.find((i) => i.type === 'massage_table')!;
      const guests = pp.state.guests.filter((g) => g.state !== 'leaving').slice(0, 3);
      for (const it of pp.state.items) it.queue = it.queue.filter((id) => !guests.some((g) => g.id === id));
      table.queue = guests.map((g) => g.id);
      guests.forEach((g, i) =>
        Object.assign(g, {
          station: table.id,
          state: 'waiting',
          goal: 'treat',
          patience: 90 - i * 30,
          emergency: i === 1,
        }),
      );
      pp.tools.select({ kind: 'item', id: table.id });
    });
    await screens.shot('inspector-line');
  });

  for (const type of ['massage', 'consult'] as const) {
    test(`the inspector for a ${type} room`, async ({ screens, game }) => {
      await screens.play();
      await game.eval(
        (pp, type) => pp.tools.select({ kind: 'room', id: pp.state.rooms.find((r) => r.type === type)!.id }),
        type,
      );
      await screens.shot(`inspector-room-${type}`);
    });
  }

  // a Year 2 summer with a six-figure balance, whose longer date and balance once moved the stats bar up a row and ran the
  // inspector's last lines under it
  test('the inspector late in the game', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      pp.state.day = 18 * 30 + 0.4;
      pp.state.money = 392_247;
      pp.tools.select({ kind: 'room', id: pp.state.rooms.find((r) => r.type === 'massage')!.id });
    });
    await screens.shot('inspector-late-game');
  });

  test('an item in hand and a room blueprint', async ({ screens, game }) => {
    await screens.play();
    await game.menu('Items');
    await game.card('Bench').click();
    await game.hoverHeld();
    await screens.shot('item-in-hand');
    await game.menu('Rooms');
    await game.card('Restroom').click();
    await game.dragOutRoom(3, 3);
    await game.clickWall('south');
    await screens.shot('blueprint');
  });

  test("dragging a room's wall", async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      const room = pp.state.rooms.find((r) => r.type === 'massage')!;
      pp.tools.select({ kind: 'room', id: room.id });
      pp.tools.startResize(room.id);
      // take hold of the east wall and pull it out two tiles, without letting go
      const from = pp.view.project(room.x + room.w, room.y + room.h / 2, 0);
      const to = pp.view.project(room.x + room.w + 2, room.y + room.h / 2, 0);
      pp.tools.pointerDown(from.x, from.y);
      pp.tools.pointerMove(to.x, to.y);
    });
    await screens.shot('room-resize');
  });

  test('the pause menu and its dialogs', async ({ screens, page }) => {
    await screens.play();
    await page.locator('#sys').locator('[data-tip="Menu"]').click();
    await screens.shot('pause');
    await page.getByRole('button', { name: 'Settings' }).click();
    await screens.shot('settings');
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Save or load' }).click();
    await screens.shot('saves');
    await page.getByRole('button', { name: 'Back' }).click();
    await page.locator('#modal').getByRole('button', { name: 'New game' }).click();
    await screens.shot('confirm-new-game');
  });

  test('messages and an emergency on offer', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp, offer) => {
      pp.sim.emit({ type: 'toast', text: 'A good thing happened.', kind: 'good' });
      pp.sim.emit({ type: 'toast', text: 'A bad thing happened.', kind: 'bad' });
      pp.sim.emit({ type: 'toast', text: 'Something happened.', kind: 'info' });
      pp.sim.emit({ type: 'announce', text: 'Testing the speakers. One, two.' });
      pp.state.offer = { ...offer, deadline: pp.state.day + 8 };
    }, OFFER(0));
    await screens.shot('messages');
  });

  test('messages piled up past the first few', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      // paused, the messages wait to be read
      pp.state.speed = 0;
      pp.sim.emit({ type: 'toast', text: 'Consultation Room built!', kind: 'good' });
      pp.sim.emit({ type: 'toast', text: 'Your plants are wilting. A Caretaker will water them.', kind: 'bad' });
      pp.sim.emit({ type: 'toast', text: 'Mira joins the team.', kind: 'info' });
      pp.sim.emit({ type: 'toast', text: 'A guest left without being seen.', kind: 'bad' });
      pp.sim.emit({ type: 'toast', text: 'Payday: $4,250 paid to 9 staff.', kind: 'info' });
      pp.sim.emit({ type: 'toast', text: 'A VIP is visiting in 5 days.', kind: 'info' });
      pp.sim.emit({ type: 'toast', text: 'A VIP is visiting in 5 days.', kind: 'info' });
      pp.sim.emit({ type: 'toast', text: 'Massage Suite built!', kind: 'good' });
    });
    await screens.shot('messages-piled');
  });

  // apart from the messages above, which fade after a few seconds whether or not the picture has been taken
  test('an emergency offer put aside', async ({ screens, game, page }) => {
    await screens.play();
    await game.eval((pp, offer) => {
      pp.state.offer = { ...offer, deadline: pp.state.day + 8 };
    }, OFFER(0));
    await page.locator('#offer').locator('[data-tip="Decide later"]').click();
    await screens.shot('offer-aside');
  });

  test('unlocking an item with karma', async ({ screens, game, page }) => {
    await screens.play();
    await page.evaluate(() =>
      localStorage.setItem('pressure-point-campaign', JSON.stringify({ stars: { willow: 3, exchange: 1 } })),
    );
    await game.menu('Items');
    await game.card('Koi Pond').click();
    // the click scrolls the list as far as it happens to need to, so behind the dialog it is put back at the top
    await page.locator('#menu .panel').evaluate((panel) => panel.scrollTo(0, 0));
    await screens.shot('karma');
  });

  test('a star earned', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => pp.sim.emit({ type: 'star', stars: 1 }));
    await screens.shot('star');
  });

  test('the Stats menu tabs', async ({ screens, game, page }) => {
    await screens.play();
    await game.eval((pp) => {
      const lines: [number, string, string[]][] = [
        [5, 'Walked in knotted, walked out new.', ['healed', 'pleasant', 'quick']],
        [2, 'I aged a year in that waiting area.', ['healed', 'long-wait', 'thirsty']],
        [4, 'Comfy seats.', ['healed', 'comfy']],
        [1, 'Not sure my practitioner had done this before.', ['not-healed', 'unqualified', 'long-wait']],
      ];
      pp.state.reviews = lines.map(([stars, text, feelings], i) => ({
        name: `Guest ${i + 1}`,
        stars,
        text,
        day: 20 + i,
        feelings: feelings as never,
      }));
      pp.state.casebook = {
        slump: { healed: 9, failed: 2, stormed: 1, sent: 0, priced: 1, worse: 0 },
        knotted: { healed: 1, failed: 3, stormed: 0, sent: 1, priced: 0, worse: 0 },
      };
    });
    await game.menu('Stats');
    await page
      .locator('#menu')
      .getByRole('button', { name: /Reputation/ })
      .click();
    await screens.shot('stats-reputation');
    await page
      .locator('#menu')
      .getByRole('button', { name: /Casebook/ })
      .click();
    await screens.shot('stats-casebook');
    // a center a grade up, with the rival open across the street and a sale on
    await game.eval((pp) => {
      pp.state.grade = 1;
      pp.state.rivalOn = true;
      pp.state.rival = {
        opened: 0,
        saleUntil: pp.state.day + 6,
        nextSale: 1e9,
        nextPoach: 1e9,
        poached: 1,
        trophies: 0,
        points: 80 + pp.state.day * 0.45,
        knocked: 0,
      };
    });
    await page
      .locator('#menu')
      .getByRole('button', { name: /Standing/ })
      .click();
    await screens.shot('stats-standing');
    // regulars at every level of loyalty, one of them here now
    await game.eval((pp) => {
      const s = pp.state;
      const look = s.candidates[0]!.look;
      const people: [string, number, number, number][] = [
        ['Margo Finch', 12, 92, 0],
        ['Dev Okafor', 5, 64, 6],
        ['Priya Shah', 2, 38, 11],
        ['Hal Brennan', 1, 12, 0.5],
      ];
      s.regulars = people.map(([name, visits, loyalty, due], i) => ({
        id: 9000 + i,
        name,
        look,
        visits,
        loyalty,
        due: s.day + due,
      }));
      s.guests[0]!.regular = 9000;
    });
    await page
      .locator('#menu')
      .getByRole('button', { name: /Regulars/ })
      .click();
    await screens.shot('stats-regulars');
  });

  test('the Money menu tabs', async ({ screens, game, page }) => {
    await screens.play();
    await game.menu('Money');
    const menu = page.locator('#menu');
    await menu.getByRole('button', { name: /Prices/ }).click();
    await screens.shot('money-prices');
    await menu.getByRole('button', { name: /Marketing/ }).click();
    await screens.shot('money-marketing');
  });

  test('land for sale', async ({ screens, game, page }) => {
    await screens.play();
    await game.eval((pp) => {
      pp.state.stars = 1;
      pp.state.money = 100000;
    });
    await game.menu('Money');
    await page.locator('#menu').getByRole('button', { name: /Land/ }).click();
    // the plots are outlined on the ground a moment after the tab opens
    await page.waitForTimeout(600);
    await screens.shot('money-land');
  });

  test('a plot of land being built on, in the inspector', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      pp.state.money = 100000;
      pp.sim.buyPlot('east-wing');
      pp.sim.renamePlot('east-wing', 'Garden Wing');
      // halfway through the builders' six days
      pp.state.land[0]!.ready = pp.state.day + 3;
      pp.tools.select({ kind: 'plot', id: 'east-wing' });
    });
    await screens.shot('inspector-plot');
  });

  test('a house call on offer', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      pp.state.callOffer = {
        client: 'the Grand Hotel',
        days: 2,
        perDay: 600,
        discipline: 'massage',
        deadline: pp.state.day + 6,
      };
      for (const st of pp.state.staff) if (st.role === 'therapist') st.state = 'atPost';
    });
    await screens.shot('house-call');
  });

  test('a mishap coming, and one under way', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      const day = pp.state.day;
      pp.state.mishap = { kind: 'storm', starts: day + 3, ends: day + 5, prepared: false, started: false };
    });
    await screens.shot('mishap');
    await game.eval((pp) => {
      const day = pp.state.day;
      pp.state.mishap = { kind: 'power', starts: day - 0.5, ends: day + 0.5, prepared: false, started: true };
    });
    await screens.shot('mishap-on');
  });

  test('the floor colored by an overlay', async ({ screens, page }) => {
    await screens.play();
    await page.locator('#sys').locator('[data-tip^="Overlays"]').click();
    await screens.shot('overlay-picker');
    await page
      .locator('#overlay-picker')
      .getByRole('button', { name: /Surroundings/ })
      .click();
    await screens.shot('overlay-decor');
  });

  test('a staff challenge', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      const st = pp.state.staff[0]!;
      pp.state.challenge = {
        staffId: st.id,
        staffName: st.name,
        goal: { kind: 'healed', count: 12 },
        from: pp.state.stats.healed - 5,
        set: pp.state.day,
        deadline: pp.state.day + 74,
        reward: 3000,
      };
    });
    await screens.shot('challenge');
  });

  test('the year-end awards', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      pp.state.ceremony = {
        year: 2,
        results: [
          { award: 'healing-hands', won: true, note: '81% healed, 77% needed' },
          { award: 'busiest', won: false, note: '38 healed, 50 needed' },
          { award: 'no-waiting', won: true, note: '1.4 days on average, 1.8 at most' },
          { award: 'fair-prices', won: true, note: '1% put off by prices, 3% at most' },
          { award: 'healthy-books', won: false, note: '$21,400 net, $30,000 needed' },
          { award: 'happy-team', won: false, note: 'Someone quit this year' },
          {
            award: 'healer-of-the-year',
            won: true,
            note: 'Glen Tennis: 31 guests seen, 19 needed',
            winner: 'Glen Tennis',
          },
          { award: 'caretaker-of-the-year', won: false, note: 'No Caretaker to give it to' },
        ],
      };
      // the trophies the ceremony hands over, each with a certificate to hang
      for (const award of ['healing-hands', 'no-waiting', 'fair-prices', 'healer-of-the-year'] as const)
        pp.state.trophies.push({ award, year: 2 });
      pp.sim.emit({ type: 'awards', year: 2 });
    });
    await screens.shot('awards');
  });

  test('a visitor, and the report after a visit', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => {
      const s = pp.state;
      const [first, second, third] = s.rooms.filter((r) => r.done);
      const guest = s.guests[0]!;
      // a VIP partway round, standing where a guest stands
      s.visitors.push({
        ...guest,
        id: s.nextId++,
        name: 'Morgan Bell',
        kind: 'visitor',
        visit: 'vip',
        title: 'a lifestyle columnist',
        cares: 'decor',
        state: 'looking',
        tour: [second!.id, third!.id],
        seen: [{ room: first!.id, name: 'Consultation Room', score: 74, note: 'Beautifully done.', problems: [] }],
      });
      pp.tools.select({ kind: 'visitor', id: s.visitors[0]!.id });
    });
    await screens.shot('inspector-visitor');
    await game.eval((pp) => {
      pp.state.visitReport = {
        visit: 'inspector',
        name: 'Pat Quill',
        title: 'the health inspector',
        day: 40,
        rooms: [
          { room: 1, name: 'Consultation Room', score: 100, note: 'All in order.', problems: [] },
          {
            room: 2,
            name: 'Massage Suite',
            score: 32,
            note: 'Dirty, no Fire Extinguisher nearby.',
            problems: ['dirty', 'no Fire Extinguisher nearby'],
          },
          { room: 3, name: 'Staff Room', score: 66, note: 'Broken equipment.', problems: ['broken equipment'] },
        ],
        score: 3,
        outcome: 'failed',
        money: -2400,
        rep: -3,
      };
      pp.sim.emit({ type: 'visit' });
    });
    await screens.shot('visit-report');
  });
});

// between the narrow layout and room for everything, where the bottom bar once ran off the right of the window
test.describe('in a window a little narrower than usual', () => {
  test.use({ viewport: { width: 1300, height: 800 } });

  test('the heads-up display, with every speed button in view', async ({ screens, page }) => {
    await screens.play();
    const fastest = await page.getByRole('button', { name: 'Fastest (3)' }).boundingBox();
    expect(fastest!.x + fastest!.width).toBeLessThanOrEqual(1300);
    await screens.shot('mid-hud');
  });
});

test.describe('in a narrow window', () => {
  test.use({ viewport: { width: 1000, height: 700 } });

  test('the heads-up display and a menu', async ({ screens, game }) => {
    await screens.play();
    await screens.shot('narrow-hud');
    await game.menu('Rooms');
    await screens.shot('narrow-menu-rooms');
  });
});

test.describe('in a very narrow window', () => {
  test.use({ viewport: { width: 700, height: 600 } });

  test('the heads-up display', async ({ screens }) => {
    await screens.play();
    await screens.shot('very-narrow-hud');
  });
});
