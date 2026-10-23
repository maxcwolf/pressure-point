// The display settings: how big the interface is drawn.
import { expect, test } from './fixtures';

test.describe('the display settings', () => {
  test('the interface can be drawn larger, and stays within the window', async ({ game, page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    const size = page.getByRole('button', { name: 'Interface size' });
    await expect(size).toHaveText('100%');
    await size.click();
    await expect(size).toHaveText('115%');
    await game.start();
    await expect(page.locator('html')).toHaveCSS('--ui-scale', '1.15');
    // the bottom bar still ends inside the window, and the right-hand column above it
    const stats = (await page.locator('#stats').boundingBox())!;
    const side = (await page.locator('#side').boundingBox())!;
    const { width, height } = page.viewportSize()!;
    expect(stats.x + stats.width).toBeLessThanOrEqual(width);
    expect(stats.y + stats.height).toBeLessThanOrEqual(height);
    expect(side.y + side.height).toBeLessThanOrEqual(stats.y);
  });
});
