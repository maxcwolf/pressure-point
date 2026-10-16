// Renders the README's download buttons from brand/buttons.mjs into docs/assets, at twice their size for sharp
// screens. They are drawn in Fredoka from Google Fonts, so this needs a network connection.
import { chromium } from '@playwright/test';

import { BUTTONS, buttonsPage } from '../brand/buttons.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(buttonsPage());
await page.evaluate("Promise.all([document.fonts.load('500 14px Fredoka'), document.fonts.load('600 25px Fredoka')])");
for (const b of BUTTONS)
  // each button's box leaves room below it for its drop shadow
  await page.locator(`#${b.file}`).screenshot({ path: `docs/assets/${b.file}.png`, omitBackground: true });
await browser.close();
