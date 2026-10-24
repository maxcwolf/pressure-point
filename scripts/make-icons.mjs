// Builds the game's icons from the drawings in src/ui/icons/: a sprite sheet the interface draws them from, a second
// for 20 pixels and under, a texture atlas the scene draws them from (its clear texels tinted with the ink beside them,
// so its edges do not darken as it shrinks) with a map of where each sits in it, the box round each drawing's ink, and
// the list of ids the code checks icons by. An icon with a drawing in src/ui/icons/small/ is drawn from it where it is
// small. Commit what it writes. It draws the atlas in a headless browser, as `yarn brand` does, and needs no network.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';
import { format, resolveConfig } from 'prettier';

import {
  atlasSvg,
  bleed,
  checkIcon,
  checkInk,
  checkSmallIcon,
  encodePng,
  IDS_FILE,
  inScene,
  linted,
  OUT_DIR,
  readIcons,
  readSmall,
  smallSheet,
  sourceHash,
  spriteSheet,
} from './icons.mjs';

const icons = readIcons();
const small = readSmall();
const ids = icons.map(({ id }) => id);
const problems = [
  ...icons.flatMap(({ id, svg }) => checkIcon(id, svg).map((p) => `${id}.svg: ${p}`)),
  ...Object.entries(small).flatMap(([id, svg]) => checkSmallIcon(id, svg, ids).map((p) => `small/${id}.svg: ${p}`)),
];
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

/** Write a file, formatted as Prettier would leave it, so `yarn format:check` passes on what this makes. */
async function writeFormatted(path, text) {
  const options = (await resolveConfig(path)) ?? {};
  writeFileSync(path, await format(text, { ...options, filepath: path }));
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'sprite.svg'), spriteSheet(icons));
writeFileSync(join(OUT_DIR, 'sprite-small.svg'), smallSheet(icons, small));

const { svg, layout } = atlasSvg(icons, small);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
// drawn on a canvas rather than photographed, to have its pixels to bleed color into before it is saved
const pixels = await page.evaluate(
  async ({ svg, width, height }) => {
    const { Image, document } = globalThis;
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, width, height).data;
    let text = '';
    for (let i = 0; i < data.length; i += 0x8000) text += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return btoa(text);
  },
  { svg, width: layout.width, height: layout.height },
);
// the box round each drawing's ink, for the lint of how big it looks and whether it touches the edge
const ink = await page.evaluate(async (drawings) => {
  const { Image, document } = globalThis;
  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const boxes = {};
  for (const { id, svg } of drawings) {
    const image = new Image();
    // drawn with room round the square, so ink that runs off its edge is measured rather than cut off
    const framed = svg
      .replace('viewBox="0 0 32 32"', 'viewBox="-8 -8 48 48"')
      .replace('<svg ', `<svg width="${size}" height="${size}" `);
    image.src = `data:image/svg+xml;base64,${btoa(framed)}`;
    await image.decode();
    context.clearRect(0, 0, size, size);
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, size, size).data;
    let [left, top, right, bottom] = [size, size, 0, 0];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[(y * size + x) * 4 + 3] <= 64) continue;
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
      }
    }
    boxes[id] = [left, top, right, bottom].map((v) => Math.round(((v * 48) / size - 8) * 100) / 100);
  }
  return boxes;
}, icons);
await browser.close();
const inkProblems = Object.entries(ink)
  .filter(([id]) => linted(id, 'ink'))
  .flatMap(([id, box]) => checkInk(box).map((p) => `${id}.svg: ${p}`));
if (inkProblems.length) {
  console.error(inkProblems.join('\n'));
  process.exit(1);
}
const rgba = new Uint8Array(Buffer.from(pixels, 'base64'));
writeFileSync(
  join(OUT_DIR, 'atlas.png'),
  encodePng(bleed(rgba, layout.width, layout.height), layout.width, layout.height),
);

await writeFormatted(join(OUT_DIR, 'ink.json'), JSON.stringify({ hash: sourceHash(icons, small), boxes: ink }));
await writeFormatted(
  join(OUT_DIR, 'atlas.json'),
  JSON.stringify({ hash: sourceHash(icons, small), width: layout.width, height: layout.height, icons: layout.icons }),
);

const scene = ids.filter(inScene);
await writeFormatted(
  IDS_FILE,
  `// The game's icons, by id: one for each drawing in src/ui/icons/. Written by \`yarn icons\` (scripts/make-icons.mjs),
// so add or rename an icon there rather than here.

/** Every icon there is. */
export const ICON_IDS = ${JSON.stringify(ids)} as const;

/** An icon, by the name of its drawing. A name with no drawing does not compile. */
export type IconId = (typeof ICON_IDS)[number];

/** The icons the scene draws, which are in its texture atlas: speech bubbles, markers, room signs and roles. */
export const SCENE_ICON_IDS = ${JSON.stringify(scene)} as const;

/** An icon the scene can draw. */
export type SceneIconId = (typeof SCENE_ICON_IDS)[number];
`,
);

console.log(
  `${ids.length} icons, ${Object.keys(small).length} drawn small, ${scene.length} in the ${layout.width}×${layout.height} atlas`,
);
