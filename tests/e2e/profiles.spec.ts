// Profiles: two people on one computer, each with a campaign, saved games and settings of their own.
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

/** Leave a game for the title screen from the pause menu. */
async function mainMenu(page: Page) {
  await page.locator('#sys').locator('[data-tip="Menu"]').click();
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.locator('#title .title-logo')).toBeVisible();
}

/** The row for a profile in the profiles list. */
const row = (page: Page, name: string) => page.locator('#title-profiles .profile-row', { hasText: name });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}'));
});

test.describe('profiles', () => {
  test('keep a campaign and saved games each, and switching shows only its own', async ({ game, page }) => {
    // starts three games, and a start can take half a minute on a busy machine
    test.slow();
    await page.goto('/');
    const profile = page.locator('#title .title-profile');
    await expect(profile).toHaveText('Player 1');

    // the first player earns a star at Willow Lane
    await page.getByRole('button', { name: 'Campaign' }).click();
    await page.locator('#title-campaign').getByRole('button', { name: 'Play Willow Lane' }).click();
    await page.waitForFunction(() => window.pp?.state.center === 'willow');
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.state.stars = 1;
      pp.state.money = 54321;
    });
    await mainMenu(page);
    await expect(page.locator('#title .save-card')).toContainText('Willow Lane');

    // a profile for Sam starts with no games and a campaign of its own, and is played straight away
    await profile.click();
    await expect(row(page, 'Player 1')).toContainText('Playing');
    await expect(row(page, 'Player 1')).toContainText('1 saved game · 1 ★');
    await page.getByLabel('Name for a new profile').fill('Sam');
    await page.getByRole('button', { name: 'Add profile' }).click();
    await expect(profile).toHaveText('Sam');
    await expect(page.locator('#title .save-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Campaign' }).click();
    await expect(page.locator('#title-campaign .stop').nth(1)).toContainText('Earn a star at Willow Lane to open');

    // Sam plays a sandbox game, and has only that one to load
    await page.getByRole('button', { name: '‹ Back', exact: true }).click();
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await page.getByRole('button', { name: 'Start building' }).click();
    await page.waitForFunction(() => window.pp?.state.center === 'sandbox');
    await game.eval((pp) => {
      pp.state.speed = 0;
      pp.state.money = 777;
    });
    await mainMenu(page);
    await page.getByRole('button', { name: 'Load game' }).click();
    await expect(page.locator('#title-saves .save-list li')).toHaveCount(1);
    await expect(page.locator('#title-saves .save-list')).toContainText('$777');
    await page.getByRole('button', { name: '‹ Back', exact: true }).click();

    // back to the first player: their Willow Lane game and star, and nothing of Sam's
    await profile.click();
    await expect(row(page, 'Sam')).toContainText('Playing');
    await row(page, 'Player 1').getByRole('button', { name: 'Play' }).click();
    await expect(profile).toHaveText('Player 1');
    await expect(page.locator('#title .save-card')).toContainText('Willow Lane');
    await page.getByRole('button', { name: 'Load game' }).click();
    await expect(page.locator('#title-saves .save-list li')).toHaveCount(1);
    await expect(page.locator('#title-saves .save-list')).not.toContainText('$777');
    await page.getByRole('button', { name: '‹ Back', exact: true }).click();
    await page.getByRole('button', { name: 'Campaign' }).click();
    await expect(page.locator('#title-campaign').getByRole('button', { name: 'Play The Exchange' })).toBeVisible();
    await page.getByRole('button', { name: '‹ Back', exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForFunction(() => !!window.pp);
    expect(await game.eval((pp) => [pp.state.center, pp.state.money])).toEqual(['willow', 54321]);

    // Sam's games are under Sam's own keys, and the first player's where they always were
    const stored = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const sam = (
        JSON.parse(localStorage.getItem('pressure-point-profiles') ?? '{}') as {
          profiles: { id: string; name: string }[];
        }
      ).profiles.find((p) => p.name === 'Sam')!.id;
      const theirs = keys.filter((k) => k.startsWith('profile:'));
      return {
        theirsOnly: theirs.every((k) => k.startsWith(`profile:${sam}:`)),
        autosave: (
          JSON.parse(localStorage.getItem(`profile:${sam}:pressure-point-save-v1`) ?? '{}') as { money?: number }
        ).money,
        firstAutosave: (JSON.parse(localStorage.getItem('pressure-point-save-v1') ?? '{}') as { center?: string })
          .center,
      };
    });
    expect(stored).toEqual({ theirsOnly: true, autosave: 777, firstAutosave: 'willow' });
    expect(game.errors).toEqual([]);
  });

  test('are renamed, and deleting one first says what it loses', async ({ page }) => {
    await page.goto('/');
    const profile = page.locator('#title .title-profile');
    await profile.click();
    // the only profile cannot be deleted
    await expect(row(page, 'Player 1').getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await page.getByLabel('Name for a new profile').fill('Sam');
    await page.keyboard.press('Enter');
    await expect(profile).toHaveText('Sam');

    // renamed in place, refusing a name another profile has
    await profile.click();
    await row(page, 'Sam').getByRole('button', { name: 'Rename' }).click();
    await page.getByLabel('New name for Sam').fill('player 1');
    await page.keyboard.press('Enter');
    await expect(page.locator('#title-profiles .profile-note')).toHaveText(
      'There is a profile called player 1 already.',
    );
    // Esc puts the name box away, leaving the list open rather than going back to the menu
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('New name for Sam')).toHaveCount(0);
    await expect(page.locator('#title-profiles')).toBeVisible();
    await row(page, 'Sam').getByRole('button', { name: 'Rename' }).click();
    await page.getByLabel('New name for Sam').fill('Robin');
    await page.keyboard.press('Enter');
    await expect(row(page, 'Robin')).toContainText('Playing');
    await page.getByRole('button', { name: '‹ Back', exact: true }).click();
    await expect(profile).toHaveText('Robin');

    // deleting the profile playing asks first, says what goes, and moves the game to the other
    await profile.click();
    await row(page, 'Robin').getByRole('button', { name: 'Delete' }).click();
    const asking = page.locator('#title-profiles .deleting');
    await expect(asking).toContainText('Delete Robin?');
    await expect(asking).toContainText('It has no saved games or campaign progress yet, so only its settings go.');
    await expect(asking).toContainText('The game moves to Player 1.');
    await asking.getByRole('button', { name: 'Keep Robin' }).click();
    await expect(asking).toHaveCount(0);
    await row(page, 'Robin').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete Robin' }).click();
    await expect(profile).toHaveText('Player 1');
    await profile.click();
    await expect(page.locator('#title-profiles .profile-row')).toHaveCount(1);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('profile:')))).toEqual([]);
  });
});
