import { expect, test } from './fixtures';

test.describe('starting out', () => {
  test('the title screen leads into a fresh, rendering game', async ({ game, page }) => {
    await page.goto('/');
    await expect(page.locator('.logo')).toHaveText('PressurePointInstitute');
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
    expect(await page.evaluate(() => localStorage.getItem('pressure-point-audio'))).toBe('{"sound":false,"music":false}');
    // the choice carries into the game, and survives a reload
    await page.getByRole('button', { name: 'New game' }).click();
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
    await game.click(15.5, 13.5);
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => pp.state.items.map((i) => i.type))).toEqual(['reception_desk']);
    await expect(page.locator('#stats')).toContainText('$28,800');
    await expect(page.locator('#advisor')).toContainText('Hire a Receptionist');
  });

  test('an invalid spot is refused and explained', async ({ game, page }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Bench').click();
    await game.hover(1.5, 1.5);
    await expect(page.locator('#hint')).toContainText('Must be inside the building');
    await game.click(1.5, 1.5);
    expect(await game.eval((pp) => pp.state.items.length)).toBe(0);
  });

  test('locked equipment cannot be picked before its star', async ({ game, page }) => {
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
    await game.drag([5.5, 5.5], [8.5, 8.5]);
    await expect(page.locator('#hint')).toContainText('place the door');
    await game.click(9.2, 7.5);
    await expect(page.locator('#hint')).toContainText('Consultation Desk (1 of 2)');
    await game.click(7, 6.5);
    await expect(page.locator('#hint')).toContainText('Chart Cabinet (2 of 2)');
    await game.click(5.5, 8.5);
    await expect(page.locator('#toasts')).toContainText('Consultation Room built!');
    const room = await game.eval((pp) => pp.state.rooms[0]);
    expect(room).toMatchObject({ type: 'consult', x: 5, y: 5, w: 4, h: 4, done: true, door: { x: 8, y: 7, dx: 1, dy: 0 } });
    await expect(page.locator('#stats')).toContainText('$26,000');
    // finishing a room selects it
    await expect(page.locator('#inspector')).toContainText('Prestige');
  });

  test('a room that is too small is refused', async ({ game, page }) => {
    await game.start();
    await game.menu('Rooms');
    await game.card('Massage Suite').click();
    await game.drag([5.5, 5.5], [6.5, 6.5]);
    await expect(page.locator('#hint')).not.toContainText('place the door');
    expect(await game.eval((pp) => pp.tools.tool.phase)).toBe('drag');
  });

  test('backing out of a half-built room costs nothing', async ({ game, page }) => {
    await game.start();
    await game.menu('Rooms');
    await game.card('Massage Suite').click();
    await game.drag([11.5, 5.5], [14.5, 8.5]);
    await game.click(12.5, 9.2);
    await expect(page.locator('#hint')).toContainText('Massage Table (1 of 2)');
    await page.keyboard.press('Escape');
    expect(await game.eval((pp) => [pp.state.rooms.length, pp.state.items.length, pp.state.money])).toEqual([0, 0, 30000]);
  });

  test('R rotates furniture before it is placed', async ({ game, page }) => {
    await game.start();
    await game.menu('Items');
    await game.card('Bench').click();
    await game.hover(12.5, 12.5);
    await page.keyboard.press('r');
    await game.click(12.5, 12.5);
    expect(await game.eval((pp) => pp.state.items[0].rot)).toBe(1);
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
    await expect(page.locator('#menu .row')).toHaveCount(2);
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
    const spot = await game.eval((pp) => {
      const t = pp.state.staff.find((s) => s.role === 'therapist')!;
      return { ...pp.view.project(t.x, t.y, 0.6), name: t.name, salary: t.salary, state: t.state };
    });
    // standing at the massage table, a click on them must select them and not the table
    expect(spot.state).toBe('atPost');
    await page.mouse.click(spot.x, spot.y);
    await expect(page.locator('#inspector h3')).toHaveText(spot.name);
    await expect(page.locator('#inspector .tag')).toContainText('Massage Therapist');

    await page.locator('#inspector button.raise').click();
    expect(await game.eval((pp) => pp.state.staff.find((s) => s.role === 'therapist')!.salary)).toBeGreaterThan(spot.salary);

    await page.locator('#inspector .course', { hasText: 'Deep Tissue' }).click();
    expect(await game.eval((pp) => pp.state.staff.find((s) => s.role === 'therapist')!.training?.course)).toBe('deep');
    await expect(page.locator('#inspector')).toContainText('Course progress');
    await game.eval((pp) => (pp.state.speed = 1));
    await game.fastForward(80);
    expect(await game.eval((pp) => pp.state.staff.find((s) => s.role === 'therapist')!.quals)).toContain('deep');
    await game.menu('Massage');
    await expect(game.card('Deep Tissue')).toContainText('1 qualified therapist');
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
    // pick a guest nobody is standing in front of
    const spot = await game.eval((pp) => {
      for (const g of pp.state.guests) {
        const p = pp.view.project(g.x, g.y, 0.6);
        const hit = pp.view.pick(p.x, p.y);
        if (hit?.kind === 'guest' && hit.id === g.id) return { ...p, name: g.name };
      }
      throw new Error('no guest in plain view');
    });
    await page.mouse.click(spot.x, spot.y);
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

  test('furniture can be picked up and moved', async ({ game, page }) => {
    await game.start();
    await game.eval((pp) => void pp.sim.placeItem('plant', 12, 12, 0));
    await game.settle();
    const p = await game.eval((pp) => pp.view.project(12.5, 12.5, 0.5));
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#inspector')).toContainText('Potted Plant');
    await page.locator('#inspector').getByRole('button', { name: 'Move' }).click();
    await expect(page.locator('#hint')).toContainText('Moving the Potted Plant');
    await game.click(18.5, 14.5);
    expect(await game.eval((pp) => [pp.state.items[0].x, pp.state.items[0].y, pp.state.money])).toEqual([18, 14, 29880]);
  });

  test('items sell for half and rooms can be demolished', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => {
      pp.state.money = 10000;
      pp.sim.placeItem('bench', 18, 12, 0);
    });
    await game.settle();
    const p = await game.eval((pp) => pp.view.project(19, 12.5, 0.4));
    await page.mouse.click(p.x, p.y);
    await page.locator('#inspector').getByRole('button', { name: /Sell for \$75/ }).click();
    expect(await game.eval((pp) => pp.state.items.some((i) => i.type === 'bench'))).toBe(false);

    const floor = await game.at(13.5, 7.5);
    await page.mouse.click(floor.x, floor.y);
    await expect(page.locator('#inspector')).toContainText('Massage Suite');
    await page.locator('#inspector').getByRole('button', { name: /Demolish/ }).click();
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
    const before = await game.at(15, 10);
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    const after = await game.at(15, 10);
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

test.describe('saved games', () => {
  const openSaves = async (page: import('@playwright/test').Page) => {
    await page.locator('#sys').getByTitle('Menu').click();
    await page.getByRole('button', { name: 'Save or load' }).click();
  };
  const summary = (game: import('./fixtures').Game) =>
    game.eval((pp) => ({ rooms: pp.state.rooms.length, staff: pp.state.staff.length, arrived: pp.state.stats.arrived, money: pp.state.money }));

  test('the autosave brings a game back after a reload', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(120);
    await game.eval((pp) => (pp.state.speed = 0));
    const before = await summary(game);
    await page.reload();
    await expect(page.locator('#title')).toContainText('Continue picks up "Autosave"');
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
    const [download] = await Promise.all([page.waitForEvent('download'), row.getByRole('button', { name: 'Export' }).click()]);
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
    await page.getByRole('button', { name: 'New game' }).click();
    await page.waitForFunction(() => !!window.pp);
    await openSaves(page);
    await page.locator('.filebtn input').setInputFiles(file);
    await expect(page.locator('.save-note')).toHaveText('Imported "Travels well".');
    await page.locator('.save-list li', { hasText: 'Travels well' }).getByRole('button', { name: 'Load' }).click();
    await page.waitForFunction(() => !!window.pp && window.pp.state.rooms.length > 0);
    await game.eval((pp) => (pp.state.speed = 0));
    expect(await summary(game)).toEqual(before);
  });

  test('a file that is not a save is refused politely', async ({ game, page }) => {
    await game.start();
    await openSaves(page);
    await page.locator('.filebtn input').setInputFiles({ name: 'holiday.json', mimeType: 'application/json', buffer: Buffer.from('{"photos": 12}') });
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
    await page.waitForFunction(() => !!window.pp && window.pp.state.rooms.length === 0);
    expect(await game.eval((pp) => pp.state.money)).toBe(30000);

    await openSaves(page);
    const prev = page.locator('.save-list li', { hasText: 'Previous game' });
    await prev.getByRole('button', { name: 'Load' }).click();
    await page.waitForFunction(() => !!window.pp && window.pp.state.rooms.length === 3);
    expect(await game.eval((pp) => pp.state.staff.length)).toBe(3);
  });
});
