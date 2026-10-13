// A picture of every screen of the interface. Run `yarn test:visual` to compare with the stored
// pictures, and `yarn test:visual:update` to replace them after a change that is meant to be seen.
import { test } from './fixtures';

test.describe('title screen', () => {
  test('with a game to continue', async ({ screens }) => {
    await screens.title();
    await screens.shot('title');
  });

  test('settings and saved games', async ({ screens, page }) => {
    await screens.title();
    await page.getByRole('button', { name: 'Settings' }).click();
    await screens.shot('title-settings');
    await page.getByRole('button', { name: 'Load game' }).click();
    await screens.shot('title-saves');
  });
});

test.describe('in a game', () => {
  test('the heads-up display', async ({ screens }) => {
    await screens.play();
    await screens.shot('hud');
  });

  for (const menu of ['Rooms', 'Items', 'Hire', 'Staff', 'Treatments', 'Money'] as const) {
    test(`the ${menu} menu`, async ({ screens, game }) => {
      await screens.play();
      await game.menu(menu);
      await screens.shot(`menu-${menu.toLowerCase()}`);
    });
  }

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

  test('the pause menu and its dialogs', async ({ screens, page }) => {
    await screens.play();
    await page.locator('#sys').getByTitle('Menu').click();
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
    await game.eval((pp) => {
      pp.sim.emit({ type: 'toast', text: 'A good thing happened.', kind: 'good' });
      pp.sim.emit({ type: 'toast', text: 'A bad thing happened.', kind: 'bad' });
      pp.sim.emit({ type: 'toast', text: 'Something happened.', kind: 'info' });
      pp.sim.emit({ type: 'announce', text: 'Testing the speakers. One, two.' });
      pp.state.offer = {
        condition: 'knotted',
        cause: 'A yoga retreat has gone badly wrong.',
        total: 6,
        target: 4,
        healed: 0,
        pending: 0,
        reward: 3200,
        deadline: pp.state.day + 8,
      };
    });
    await screens.shot('messages');
  });

  test('a star earned', async ({ screens, game }) => {
    await screens.play();
    await game.eval((pp) => pp.sim.emit({ type: 'star', stars: 1 }));
    await screens.shot('star');
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
