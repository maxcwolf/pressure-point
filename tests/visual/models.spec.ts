// A picture of every model on its own, from the model lab: each item, a guest with each condition, each role of
// staff, each kind of visitor and the scenery. A change to a shared part shows up in every model that uses it.
import { expect, type Page, test } from '@playwright/test';

import { CENTERS, CONDITIONS, ITEMS, ROLE_ORDER } from '../../src/core/data';

/** Every model the lab shows, by its id there. */
const IDS = [
  ...Object.keys(ITEMS).map((type) => `item:${type}`),
  // a painting of each center's view, the sandbox's being the painting's own
  ...Object.keys(CENTERS)
    .filter((c) => c !== 'sandbox')
    .map((c) => `item:landscape_painting:${c}`),
  // each machine playing its gag, with a guest inside it if it takes one
  ...Object.entries(ITEMS).flatMap(([type, def]) => (def.machine ? [`machine:${type}`] : [])),
  ...CONDITIONS.map((c) => `guest:${c.id}`),
  ...ROLE_ORDER.map((role) => `staff:${role}`),
  'staff:amanda',
  ...['long', 'bob', 'ponytail', 'curls', 'short', 'bald', 'moustache', 'beard'].map((look) => `staff:look-${look}`),
  'visitor:vip',
  'visitor:inspector',
  // someone sitting at each kind of seat, once for each who sits there
  ...Object.entries(ITEMS).flatMap(([type, def]) =>
    def.access.flatMap((a, i, all) =>
      a.pose === 'sit' && all.findIndex((b) => b.pose === 'sit' && b.role === a.role) === i
        ? [`seated:${type}:${a.role}`]
        : [],
    ),
  ),
  'scenery:trees',
  'scenery:pines',
  'scenery:beach',
  'scenery:storefront',
  'scenery:for-sale',
  'scenery:site',
];

// a small window keeps the pictures small; the stage is what is left beside the list of models
test.use({ viewport: { width: 900, height: 600 } });

/** Open the lab on one model, held still, with only the stage in view. */
async function openLab(page: Page, id: string) {
  await page.goto(`/lab.html?model=${encodeURIComponent(id)}&still`);
  await page.addStyleTag({ content: '.caption, .panel { display: none !important; }' });
  await page.waitForFunction(() => window.lab?.ready);
}

test('the lab shows every model, and nothing more', async ({ page }) => {
  await openLab(page, 'item:bench');
  const ids = await page.evaluate(() => window.lab?.ids ?? []);
  expect([...ids].sort()).toEqual([...IDS].sort());
});

test.describe('every model', () => {
  for (const id of IDS) {
    test(id, async ({ page }) => {
      await openLab(page, id);
      await expect(page.locator('canvas.stage')).toHaveScreenshot(['models', `${id.replaceAll(':', '-')}.png`]);
    });
  }
});
