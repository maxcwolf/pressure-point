// Renders the brand art from brand/: the desktop app icon, the web favicon and the README wordmark.
// The wordmark needs Montserrat from Google Fonts, so this needs a network connection.
import { readFileSync, writeFileSync } from 'node:fs';

import { chromium } from '@playwright/test';

import { iconSvg } from '../brand/icon.mjs';

// macOS icons keep their art inside 824 of 1024 pixels, so the Dock shows them at the usual size
const MAC_MARGIN = 31;

writeFileSync('public/favicon.svg', iconSvg(64));

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setContent(`<body style="margin:0">${iconSvg(1024, MAC_MARGIN)}</body>`);
await page.locator('svg').screenshot({ path: 'build/icon.png', omitBackground: true });

await page.setContent(
  '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=block" rel="stylesheet">' +
    '<body style="margin:0"><svg id="logo" xmlns="http://www.w3.org/2000/svg"></svg></body>',
);
// these two run in the page, so they are passed as code
await page.evaluate("document.fonts.load('900 100px Montserrat')");
await page.addScriptTag({
  type: 'module',
  content: `${readFileSync('brand/wordmark.mjs', 'utf8')}\ndrawWordmark(document.getElementById('logo'), ${JSON.stringify(readFileSync('brand/massage.svg', 'utf8'))});\ndocument.title = 'drawn';`,
});
await page.waitForFunction("document.title === 'drawn'");
await page.locator('#logo').screenshot({ path: 'docs/logo.png', omitBackground: true });

await browser.close();
