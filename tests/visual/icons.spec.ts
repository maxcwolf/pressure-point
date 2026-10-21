// The icon sheet: every icon at the sizes the interface uses, and every icon the scene draws as a sprite among clay
// people and furniture from the game's camera, so a change to one drawing, or to how the atlas is built, shows here.
import { expect, test } from '@playwright/test';

// the scene is drawn in software, a person at a time, which takes a while
test.setTimeout(240_000);

test.beforeEach(async ({ page }) => {
  await page.goto('/icons.html?still');
  await page.waitForFunction(() => window.iconSheet?.ready, null, { timeout: 200_000 });
});

test('every icon, by family', async ({ page }) => {
  await expect(page.locator('.sheet')).toHaveScreenshot('icons-sheet.png');
});

test('every icon in the scene, from where the game starts and from as close as it goes', async ({ page }) => {
  // the settings over the scene are not what is being looked at
  await page.addStyleTag({ content: '.controls { visibility: hidden; }' });
  await expect(page.locator('.scene canvas')).toHaveScreenshot('icons-scene.png', { timeout: 120_000 });
  await page.selectOption('.controls select >> nth=0', 'close');
  await expect(page.locator('.scene canvas')).toHaveScreenshot('icons-scene-close.png', { timeout: 120_000 });
});
