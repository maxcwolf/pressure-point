// The rules for the game's icons and the working out behind `yarn icons`, kept apart from the drawing so the tests
// can check them: what an icon file may contain, which icons the scene needs, where each sits in the atlas, and a
// fingerprint of the drawings that tells whether what was built from them is up to date.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Where the drawings are, and where what is built from them goes. */
export const ICON_DIR = 'src/ui/icons';
export const OUT_DIR = 'src/ui/icons/generated';
export const IDS_FILE = 'src/core/data/icon-ids.ts';

/** The colors an icon may use: the palette in src/ui/theme/tokens.css, and white. */
export const PALETTE = {
  navy: '#24384a',
  cream: '#fff8ea',
  sand: '#f3e7cf',
  white: '#ffffff',
  teal: '#2fa8a0',
  tealDark: '#23827c',
  orange: '#f08a4b',
  gold: '#f2c14e',
  red: '#e5564d',
  green: '#3bb273',
  blue: '#4a9fe0',
};

/**
 * The families an icon's id starts with. Rooms and places are teal, people and roles orange, warnings red and money
 * gold; the rest use whichever of those their subject calls for, on cream and sand.
 */
export const FAMILIES = [
  'bubble',
  'marker',
  'room',
  'role',
  'discipline',
  'overlay',
  'ui',
  'season',
  'item',
  'technique',
  'course',
  'feeling',
  'award',
  'achievement',
  'mishap',
  'standing',
];

/** The families the 3D scene draws, which go into its atlas. The rest are for the interface alone. */
export const SCENE_FAMILIES = ['bubble', 'marker', 'room', 'role'];

/** How big each icon's cell in the atlas is, in pixels, and how many cells go across it. */
export const CELL = 128;
export const ATLAS_COLUMNS = 16;

/** The family an icon belongs to, from the start of its id. */
export const familyOf = (id) => id.split('-')[0];

/** Whether the scene draws an icon, and so whether it goes into the atlas. */
export const inScene = (id) => SCENE_FAMILIES.includes(familyOf(id));

/** Every drawing in a folder, by id, in order of id. */
export function readIcons(dir = ICON_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .sort()
    .map((f) => ({ id: f.slice(0, -4), svg: readFileSync(join(dir, f), 'utf8') }));
}

/** What is wrong with a drawing, if anything, as a list of complaints. */
export function checkIcon(id, svg) {
  const problems = [];
  if (!/^[a-z]+(-[a-z0-9]+)+$/.test(id)) problems.push('its id should be lowercase words joined by hyphens');
  if (!FAMILIES.includes(familyOf(id))) problems.push(`its id should start with one of ${FAMILIES.join(', ')}`);
  const root = /^<svg\b([^>]*)>/.exec(svg.trim());
  if (!root) problems.push('it should be a single <svg> element');
  else {
    const attrs = root[1] ?? '';
    if (!attrs.includes('xmlns="http://www.w3.org/2000/svg"')) problems.push('its <svg> needs the SVG namespace');
    if (!attrs.includes('viewBox="0 0 32 32"')) problems.push('its <svg> should have viewBox="0 0 32 32"');
  }
  // ids would clash once every icon shares one page, and the rest draw differently in the atlas or not at all
  for (const [pattern, why] of [
    [/<text\b/, 'no text: draw letters as shapes'],
    [/<(image|style|script|foreignObject)\b/, 'no images, styles or scripts'],
    [
      /<(defs|linearGradient|radialGradient|filter|mask|clipPath|pattern|use)\b/,
      'flat shapes only, no gradients or references',
    ],
    [/\sid=/, 'no ids'],
    [/\sclass=/, 'no classes'],
    [/url\(/, 'no references'],
  ]) {
    if (pattern.test(svg)) problems.push(why);
  }
  const allowed = new Set(Object.values(PALETTE));
  for (const [, color] of svg.matchAll(/(?:fill|stroke)="([^"]*)"/g)) {
    if (color === 'none' || allowed.has(color.toLowerCase())) continue;
    problems.push(`${color} is not in the palette`);
  }
  return problems;
}

/** The drawing inside an icon's <svg> element, with its comments and the space between elements taken out. */
export function innerOf(svg) {
  return svg
    .trim()
    .replace(/^<svg\b[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How much thinner the interface draws an icon's lines than the scene does. Beside words, at 16 to 24 pixels, the
 * drawings' 2.25-wide outline reads heavy; drawn at 2 it sits with the type. The scene's atlas keeps the full width,
 * as its icons are seen from further off.
 */
export const SPRITE_STROKE = 2 / 2.25;

/** A drawing with every line's width scaled, for the sprite sheet. */
export const thinned = (inner, scale = SPRITE_STROKE) =>
  inner.replace(/stroke-width="([\d.]+)"/g, (_, w) => `stroke-width="${Number((Number(w) * scale).toFixed(2))}"`);

/**
 * The sprite sheet the interface draws icons from: one symbol per icon, each named `icon-` and its id, its lines a
 * little thinner than drawn.
 */
export function spriteSheet(icons) {
  const symbols = icons.map(
    ({ id, svg }) => `<symbol id="icon-${id}" viewBox="0 0 32 32">${thinned(innerOf(svg))}</symbol>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="0" height="0" style="position:absolute">\n${symbols.join('\n')}\n</svg>\n`;
}

/** The ways the scene shows an icon: on its own, or in a white speech bubble. */
export const VARIANTS = ['plain', 'bubble'];

/**
 * Where each of the scene's icons sits in the atlas, in pixels from its top left: a row of cells for each, the icon
 * on its own and then in its bubble, packed across in order of id.
 */
export function atlasLayout(ids, cell = CELL, columns = ATLAS_COLUMNS) {
  const cells = ids.flatMap((id) => VARIANTS.map((variant) => ({ id, variant })));
  const rows = Math.ceil(cells.length / columns);
  const icons = {};
  cells.forEach(({ id, variant }, i) => {
    icons[id] ??= {};
    icons[id][variant] = { x: (i % columns) * cell, y: Math.floor(i / columns) * cell, w: cell, h: cell };
  });
  return { width: Math.min(cells.length, columns) * cell, height: rows * cell, cell, icons };
}

/** The white speech bubble an icon can sit in, on a cell: a disc with a short tail at the bottom, outlined in navy. */
const BUBBLE =
  `<path d="M64 10a46 46 0 0 1 16 89.2L64 122 48 99.2A46 46 0 0 1 64 10z" fill="#ffffff" stroke="${PALETTE.navy}" ` +
  `stroke-width="6" stroke-linejoin="round"/>`;

/**
 * How an icon is placed on its cell: on its own it fills the cell inside a white edge, like a sticker, so it reads
 * against any floor; in a bubble it sits in the bubble's disc.
 */
const PLACING = {
  plain: { x: 10, y: 10, size: 108, filter: ' filter="url(#sticker)"' },
  bubble: { x: 26, y: 18, size: 76, filter: '' },
};

/** The atlas as one SVG drawing, each icon drawn on its cells as `atlasLayout` lays them out. */
export function atlasSvg(icons) {
  const scene = icons.filter(({ id }) => inScene(id));
  const layout = atlasLayout(scene.map(({ id }) => id));
  const cells = scene.flatMap(({ id, svg }) =>
    VARIANTS.map((variant) => {
      const at = layout.icons[id][variant];
      const p = PLACING[variant];
      const scale = p.size / 32;
      const art = `<g transform="translate(${at.x + p.x} ${at.y + p.y}) scale(${scale})"${p.filter}>${innerOf(svg)}</g>`;
      return variant === 'bubble' ? `<g transform="translate(${at.x} ${at.y})">${BUBBLE}</g>${art}` : art;
    }),
  );
  // the white edge round an icon on its own, grown out from its shape
  const sticker =
    '<filter id="sticker" x="-25%" y="-25%" width="150%" height="150%">' +
    '<feMorphology in="SourceAlpha" operator="dilate" radius="1.7" result="grown"/>' +
    '<feFlood flood-color="#ffffff"/><feComposite in2="grown" operator="in" result="edge"/>' +
    '<feMerge><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  return {
    layout,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" ` +
      `viewBox="0 0 ${layout.width} ${layout.height}"><defs>${sticker}</defs>${cells.join('')}</svg>`,
  };
}

/** A fingerprint of everything built from the drawings, so the tests can tell when `yarn icons` is due. */
export function sourceHash(icons) {
  const hash = createHash('sha256');
  hash.update(atlasSvg(icons).svg);
  hash.update(spriteSheet(icons));
  return hash.digest('hex').slice(0, 16);
}
