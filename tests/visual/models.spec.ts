// A picture of every model on its own, from the model lab: each item, a guest with each condition, each role of
// staff, each kind of visitor, how people look as they feel (a waiting guest's patience, a face, staff with nothing to
// do), a room's doorway and sign, and the scenery. A change to a shared part shows up in every model that uses it.
import { expect, type Page, test } from '@playwright/test';

import { CENTERS, CONDITIONS, ITEMS, ROLE_ORDER } from '../../src/core/data';

/** The faces people make, other than at ease, each seen close up. */
const FACES = ['delighted', 'unhappy', 'wince'].map((face) => `face:${face}`);

/** Every model the lab shows, by its id there. */
const IDS = [
  ...Object.keys(ITEMS).map((type) => `item:${type}`),
  // a painting of each center's view, the sandbox's being the painting's own
  ...Object.keys(CENTERS)
    .filter((c) => c !== 'sandbox')
    .map((c) => `item:landscape_painting:${c}`),
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
  // a waiting guest's patience running out, standing and on a bench; a face, seen close up; staff passing the time
  ...['restless', 'impatient', 'fed-up'].flatMap((mood) => [`mood:${mood}`, `mood:${mood}-seated`]),
  ...FACES,
  ...['stretch', 'look', 'watch'].map((act) => `idle:${act}`),
  'room:door',
  'scenery:trees',
  'scenery:pines',
  'scenery:orchard',
  'scenery:beach',
  'scenery:storefront',
  'scenery:for-sale',
  'scenery:site',
];

// a small window keeps the pictures small; the stage is what is left beside the list of models
test.use({ viewport: { width: 900, height: 600 } });

/** Open the lab on one model, held still, with only the stage in view (a face close up, anything else whole), and any of its settings given. */
async function openLab(page: Page, id: string, settings = '') {
  await page.goto(
    `/lab.html?model=${encodeURIComponent(id)}&still${FACES.includes(id) ? '&view=head' : ''}${settings}`,
  );
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

/**
 * Items showing what they are doing, as the scene shows it with no overlay open: a machine wearing out, one that has
 * broken, a mat growing grimy, an arcade a guest is playing and a radiator heating. Each is held at the same moment.
 */
const STATES = [
  ['item:snack_machine', 'worn', '&wear=85'],
  ['item:arcade_machine', 'broken', '&wear=100'],
  ['item:sound_mat', 'dirty', '&dirt=65'],
  ['item:arcade_machine', 'played', '&inUse=1'],
  ['item:radiator', 'heating', '&heating=1'],
] as const;

test.describe('items showing their state', () => {
  for (const [id, state, settings] of STATES) {
    test(`${id}, ${state}`, async ({ page }) => {
      await openLab(page, id, settings);
      await expect(page.locator('canvas.stage')).toHaveScreenshot([
        'models',
        `${id.replaceAll(':', '-')}-${state}.png`,
      ]);
    });
  }
});

/**
 * A room's doorway and sign with its lamp in each state, and in a wall cut low, where the sign stands on a post beside
 * the door. Each is held at the same moment, so a pulsing lamp is caught at the same brightness every time.
 */
const SIGNS = [
  ['idle', '&lamp=idle'],
  ['broken', '&lamp=broken'],
  ['unfinished', '&lamp=unfinished'],
  ['low', '&low=1'],
] as const;

test.describe("a room's sign showing how the room is doing", () => {
  for (const [state, settings] of SIGNS) {
    test(`room:door, ${state}`, async ({ page }) => {
      await openLab(page, 'room:door', settings);
      await expect(page.locator('canvas.stage')).toHaveScreenshot(['models', `room-door-${state}.png`]);
    });
  }
});
