import { DAY_SECONDS, DAYS_PER_MONTH } from '../../src/core/data/rules';
import { expect, test } from './fixtures';

test.describe('the local paper', () => {
  test('prints on the payday that closes a quarter, and opens from its message and the Stats menu', async ({
    game,
    page,
  }) => {
    await game.start();
    await game.buildCenter();
    // a quarter of play, up to the payday that prints the first issue
    await game.eval(
      (pp, most) => {
        pp.state.speed = 1;
        for (let i = 0; i < most && !pp.state.paper; i++) {
          if (i === most - 600) pp.ui.dismissAllToasts();
          pp.sim.tick(0.1);
        }
      },
      Math.ceil(3 * DAYS_PER_MONTH * DAY_SECONDS * 10) + 10,
    );
    // whatever the quarter raised on the way (a star, a visit, a lesson) is put away once the next frame shows it
    await game.settle();
    await game.eval((pp) => {
      for (let i = 0; i < 20 && pp.ui.dialog; i++) pp.ui.close();
    });
    await game.settle();
    const issue = await game.eval((pp) => pp.state.paper);
    expect(issue?.issue).toBe(1);
    expect(issue?.read).toBe(false);

    const message = page.locator('#toasts .paper-message');
    await expect(message).toContainText('The Open Plot · Issue 1');
    await expect(message).toContainText(issue?.lead.headline ?? '');
    await expect(message).toContainText('Payday:');
    await message.getByRole('button', { name: 'Read the paper' }).click();

    const paper = page.locator('#modal .paper');
    await expect(paper.locator('h2')).toHaveText('The Open Plot');
    await expect(paper.locator('h3')).toHaveText(issue?.lead.headline ?? '');
    await expect(paper.locator('.column h4')).toHaveText('Planning Notices');
    // it pauses the game as every dialog does, and counts as read
    expect(await game.eval((pp) => [pp.state.speed, pp.state.paper?.read])).toEqual([0, true]);
    await page.getByRole('button', { name: 'Back to work' }).click();
    await expect(paper).toHaveCount(0);
    expect(await game.eval((pp) => pp.state.speed)).toBe(1);

    // the latest issue is kept under the Stats menu, so a message that fades loses nothing
    await game.eval((pp) => pp.ui.dismissAllToasts());
    await game.menu('Stats');
    await page.locator('#menu').getByRole('button', { name: 'Paper' }).click();
    await expect(page.locator('#menu .paper h3')).toHaveText(issue?.lead.headline ?? '');
  });
});
