// The icon sheet: every icon at the sizes the interface uses, and every icon the scene draws as a sprite among clay
// people and furniture from the game's camera, so a change to one drawing, or to how the atlas is built, shows here.
import { expect, type Page, test } from '@playwright/test';

// the scene is drawn in software, a person at a time, which takes a while
test.setTimeout(240_000);

/** Open the sheet held still, with the camera at a distance, and wait for the scene to be drawn. */
async function open(page: Page, camera = 'game') {
  await page.goto(`/icons.html?still&camera=${camera}`);
  await page.waitForFunction(() => window.iconSheet?.ready, null, { timeout: 200_000 });
  // the settings over the scene are not what is being looked at
  await page.addStyleTag({ content: '.controls { visibility: hidden; }' });
}

test('every icon, by family', async ({ page }) => {
  await open(page);
  await expect(page.locator('.sheet')).toHaveScreenshot('icons-sheet.png', { timeout: 120_000 });
});

for (const camera of ['game', 'close']) {
  test(`every icon in the scene, from ${camera === 'game' ? 'where the game starts' : 'as close as the game goes'}`, async ({
    page,
  }) => {
    await open(page, camera);
    const name = camera === 'game' ? 'icons-scene.png' : 'icons-scene-close.png';
    await expect(page.locator('.scene canvas')).toHaveScreenshot(name, { timeout: 120_000 });
  });
}
