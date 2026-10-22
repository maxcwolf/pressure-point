// Builds the game's icons from the drawings in src/ui/icons/: a sprite sheet the interface draws them from, a second
// for 20 pixels and under, a texture atlas the scene draws them from with a map of where each sits in it, and the list
// of ids the code checks icons by. An icon with a drawing in src/ui/icons/small/ is drawn from it where it is small.
// Commit what it writes. It draws the atlas in a headless browser, as `yarn brand` does, and needs no network.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';
import { format, resolveConfig } from 'prettier';

import {
  atlasSvg,
  checkIcon,
  checkSmallIcon,
  IDS_FILE,
  inScene,
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
await page.setContent(`<body style="margin:0">${svg}</body>`);
await page.locator('svg').screenshot({ path: join(OUT_DIR, 'atlas.png'), omitBackground: true });
await browser.close();

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
