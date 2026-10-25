// Draws the README's pictures of the game by the numbers, karma, and how a center progresses, from brand/readme.mjs
// into docs/assets, at twice their size for sharp screens. The counts, prices and names are read from the game's data
// through Vite, so run it again when they change. They are drawn in Fredoka from Google Fonts, so this needs a network
// connection.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

import { DECOR_SHOWN, readmePage } from '../brand/readme.mjs';

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
});
const d = await vite.ssrLoadModule('/src/core/data/index.ts');
await vite.close();

const achievements = Object.values(d.ACHIEVEMENTS);
/** Something bought with karma, as the picture names and prices it. */
const purchase = (id, def) => ({ id, name: def.name, karma: def.karma });
const game = {
  centers: d.CAMPAIGN.length,
  arts: Object.keys(d.DISCIPLINES).length,
  treatments: Object.keys(d.MODALITIES).length,
  ailments: Object.keys(d.CONDITIONS).length,
  starKarma: d.STAR_KARMA,
  achievements: achievements.length,
  hidden: achievements.filter((a) => a.hidden).length,
  achievementMin: Math.min(...achievements.map((a) => a.karma)),
  achievementMax: Math.max(...achievements.map((a) => a.karma)),
  // three stars at every center, and every achievement once
  campaignKarma: d.CAMPAIGN.length * 3 * d.STAR_KARMA + achievements.reduce((sum, a) => sum + a.karma, 0),
  shop: d.KARMA_ITEMS.map((t) => purchase(t, d.ITEMS[t])).sort((a, b) => b.karma - a.karma),
  carousel: purchase('wheel_of_rebirth', d.ITEMS.wheel_of_rebirth),
  decor: DECOR_SHOWN.map((id) => ({ id, name: d.decorLabel(id).replace(/^the /, ''), karma: d.decorDef(id).karma })),
  grades: d.GRADES.map((g) => g.name),
  ranks: d.RANKS,
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 800, height: 900 } });
await page.setContent(readmePage(game));
await page.evaluate(
  "Promise.all([document.fonts.load('400 12px Fredoka'), document.fonts.load('600 12px Fredoka'), document.fonts.load('700 12px Fredoka')])",
);
for (const id of ['numbers', 'karma', 'progress'])
  await page.locator(`#${id}`).screenshot({ path: `docs/assets/${id}.png` });
await browser.close();
