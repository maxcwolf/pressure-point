// The rules for the game's icons and the working out behind `yarn icons`, kept apart from the drawing so the tests
// can check them: what an icon file may contain, which icons the scene needs, where each sits in the atlas, and a
// fingerprint of the drawings that tells whether what was built from them is up to date.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Where the drawings are, and where what is built from them goes. */
export const ICON_DIR = 'src/ui/icons';
export const OUT_DIR = 'src/ui/icons/generated';
/** Where an icon's small drawing goes, when it has one: simpler, with heavier lines, for 20 pixels and under. */
export const SMALL_DIR = 'src/ui/icons/small';
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

/**
 * The small drawings, by id: the folder's contents when it is there, nothing when it is not. An icon with one draws
 * from it at small sizes and in the scene; the rest are made small from their one drawing.
 */
export function readSmall(dir = SMALL_DIR) {
  if (!existsSync(dir)) return {};
  return Object.fromEntries(readIcons(dir).map(({ id, svg }) => [id, svg]));
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

/** The thinnest line and the smallest dot a small drawing may have, in units of its 32: about 1.4 and 2 pixels at 16. */
export const SMALL_MIN_STROKE = 2.8;
export const SMALL_MIN_RADIUS = 2;

/**
 * What is wrong with a small drawing: everything that is wrong with any drawing, and then that it must be of an icon
 * there is, and that nothing in it is too fine to survive 16 pixels on a plain screen.
 */
export function checkSmallIcon(id, svg, ids) {
  const problems = checkIcon(id, svg);
  if (!ids.includes(id)) problems.push('there is no icon of that name to be the small drawing of');
  for (const [, w] of svg.matchAll(/stroke-width="([\d.]+)"/g)) {
    if (Number(w) < SMALL_MIN_STROKE)
      problems.push(`a line ${w} wide is too thin for 16 pixels: ${SMALL_MIN_STROKE} at least`);
  }
  // a dot or an ellipse too small to see; a rectangle's rounded corners are not a feature and may be as tight as they like
  for (const [element] of svg.matchAll(/<(?:circle|ellipse)\b[^>]*>/g)) {
    for (const [, which, r] of element.matchAll(/\s(r|rx|ry)="([\d.]+)"/g)) {
      if (Number(r) < SMALL_MIN_RADIUS)
        problems.push(`${which}="${r}" is too small for 16 pixels: ${SMALL_MIN_RADIUS} at least`);
    }
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
 * How much thinner the interface draws an icon's lines than the scene does, at the sizes above 20 pixels. There the
 * drawings' 2.25-wide outline reads heavy; drawn at 1.8 it sits with the type. The scene's atlas keeps the full width,
 * as its icons are seen from further off, and the small sheet goes the other way (`SMALL_STROKE`).
 */
export const SPRITE_STROKE = 1.8 / 2.25;

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

/**
 * How much heavier the small sprite sheet draws an icon that has no small drawing. At 16 pixels on a plain screen the
 * 2.25 outline is 1.1 pixels and the sprite's 1.8 is under one, so both smear to grey; 2.9 lands on a pixel and a half.
 */
export const SMALL_STROKE = 2.9 / 2.25;

/**
 * A drawing with its cream and sand swapped for white, for small sizes: on the cream interface those fills are told
 * from the background by their outline alone, and at 16 pixels that is not enough.
 */
export const whitened = (inner) =>
  inner.replace(/fill="#fff8ea"/g, 'fill="#ffffff"').replace(/fill="#f3e7cf"/g, 'fill="#ffffff"');

/**
 * An award without its medal, for small sizes: the gold disc goes, and the pictogram that sat at 86% inside it takes the
 * whole square instead. A drawing with no such disc is left alone.
 */
export function unmedalled(inner) {
  const without = inner.replace(/<circle cx="16" cy="16" r="13.5" fill="#f2c14e"\/>/, '');
  if (without === inner) return inner;
  return without.replace(
    'translate(16 16) scale(0.86) translate(-16 -16)',
    'translate(16 16) scale(1.08) translate(-16 -16)',
  );
}

/**
 * A drawing with its outlines made heavier for small sizes: every line under 3 wide, which is to say the outlines and
 * details, and not the wide strokes some drawings lay under a narrower colored one as an outline of their own, which
 * are heavy enough already and would swallow the color.
 */
export const heavier = (inner) =>
  inner.replace(/stroke-width="([\d.]+)"/g, (m, w) =>
    Number(w) < 3 ? `stroke-width="${Number((Number(w) * SMALL_STROKE).toFixed(2))}"` : m,
  );

/** An icon as the small sheet draws it: its small drawing as drawn, or its one drawing made heavier, whiter and unmedalled. */
export const madeSmall = (id, inner, small) =>
  small[id] ? innerOf(small[id]) : heavier(whitened(familyOf(id) === 'award' ? unmedalled(inner) : inner));

/**
 * The sprite sheet the interface draws icons from at 20 pixels and under: one symbol per icon, named `icon-small-` and
 * its id, each as `madeSmall` has it.
 */
export function smallSheet(icons, small = {}) {
  const symbols = icons.map(
    ({ id, svg }) => `<symbol id="icon-small-${id}" viewBox="0 0 32 32">${madeSmall(id, innerOf(svg), small)}</symbol>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="0" height="0" style="position:absolute">\n${symbols.join('\n')}\n</svg>\n`;
}

/**
 * The ways the scene shows an icon: on its own, or in a white speech bubble; some bubbles also in red, as an alarm, or
 * in amber, as a need; and a staff marker on the purple of the squares staff use furniture from.
 */
export const VARIANTS = ['plain', 'bubble', 'alarm', 'need', 'square'];

/**
 * The bubbles that also come in red, for trouble a player should act on now: someone about to quit, a guest about to
 * walk out, a guest getting worse while they wait.
 */
export const ALARMS = ['bubble-quitting', 'bubble-impatient', 'bubble-hurt'];

/**
 * The bubbles that also come in amber, for a need that will become trouble: the body's needs, a member of staff worn
 * out, and a guest running out of patience before they are fed up.
 */
export const NEEDS = ['bubble-restroom', 'bubble-thirsty', 'bubble-hungry', 'bubble-exhausted', 'bubble-impatient'];

/** The ways an icon is shown in the scene: every icon on its own and in a bubble, and the others only where they apply. */
export function variantsOf(id) {
  return VARIANTS.filter(
    (v) =>
      v === 'plain' ||
      v === 'bubble' ||
      (v === 'alarm' && ALARMS.includes(id)) ||
      (v === 'need' && NEEDS.includes(id)) ||
      (v === 'square' && (familyOf(id) === 'role' || id === 'marker-staff')),
  );
}

/**
 * Where each of the scene's icons sits in the atlas, in pixels from its top left: a cell for each way it is shown, the
 * icon on its own and then in its bubble and the rest, packed across in order of id.
 */
export function atlasLayout(ids, cell = CELL, columns = ATLAS_COLUMNS) {
  const cells = ids.flatMap((id) => variantsOf(id).map((variant) => ({ id, variant })));
  const rows = Math.ceil(cells.length / columns);
  const icons = {};
  cells.forEach(({ id, variant }, i) => {
    icons[id] ??= {};
    icons[id][variant] = { x: (i % columns) * cell, y: Math.floor(i / columns) * cell, w: cell, h: cell };
  });
  return { width: Math.min(cells.length, columns) * cell, height: rows * cell, cell, icons };
}

/** The purple of the squares staff use furniture from, as the scene's floor overlay draws them. */
export const STAFF_SQUARE = '#9b6bff';

/**
 * The speech bubble an icon can sit in, on a cell, in a color: a disc with a short tail at the bottom, outlined in
 * navy. It fills the cell, but for a few pixels round the edge, so the bubble is as big as the sprite lets it be.
 */
const BUBBLE = (fill) =>
  `<path d="M64 5A50 50 0 0 1 81.1 102L64 122 46.9 102A50 50 0 0 1 64 5z" fill="${fill}" stroke="${PALETTE.navy}" ` +
  `stroke-width="6" stroke-linejoin="round"/>`;

/** The disc a staff marker sits on over a use square: purple as the square, outlined in navy inside a white edge. */
const SQUARE_DISC =
  `<circle cx="64" cy="64" r="58" fill="${PALETTE.white}"/>` +
  `<circle cx="64" cy="64" r="52" fill="${STAFF_SQUARE}" stroke="${PALETTE.navy}" stroke-width="6"/>`;

/**
 * How an icon is placed on its cell, and what is drawn under it: on its own it fills the cell inside a white edge,
 * like a sticker, so it reads against any floor; in a bubble it fills the bubble's disc, white for something said, red
 * for an alarm and amber for a need; as a staff marker it sits on the purple disc, without a disc of its own.
 */
const PLACING = {
  plain: { x: 10, y: 10, size: 108, filter: ' filter="url(#sticker)"' },
  bubble: { x: 20, y: 11, size: 88, filter: '', under: BUBBLE(PALETTE.white) },
  // on red, the drawing's red turns navy and the rest stays as drawn, so an hourglass's sand still shows
  alarm: { x: 20, y: 11, size: 88, filter: '', under: BUBBLE(PALETTE.red), recolor: [PALETTE.red, PALETTE.navy] },
  // on amber, the drawing's gold turns white, so nothing in it sinks into the bubble
  need: { x: 20, y: 11, size: 88, filter: '', under: BUBBLE(PALETTE.gold), recolor: [PALETTE.gold, PALETTE.white] },
  square: { x: 12, y: 12, size: 104, filter: '', under: SQUARE_DISC, undisc: true },
};

/** A drawing with one fill swapped for another, for a bubble of that color. */
export const refilled = (inner, [from, to]) => inner.replaceAll(`fill="${from}"`, `fill="${to}"`);

/**
 * A role's drawing without its orange disc, its pictogram grown to fill the space, for a staff marker's purple disc. A
 * drawing with no such disc is drawn smaller instead, to sit inside the purple one.
 */
export function undiscked(inner) {
  const without = inner.replace(/<circle cx="16" cy="16" r="13.5" fill="#[0-9a-f]{6}"\/>/, '');
  if (without === inner) return `<g transform="translate(16 16) scale(0.78) translate(-16 -16)">${inner}</g>`;
  return without.replace(
    'translate(16 16) scale(0.86) translate(-16 -16)',
    'translate(16 16) scale(0.94) translate(-16 -16)',
  );
}

/** One cell of the atlas: an icon's drawing placed as one of the ways it is shown, on whatever goes under it. */
export function atlasCell(variant, inner, at) {
  const p = PLACING[variant];
  let art = p.recolor ? refilled(inner, p.recolor) : inner;
  if (p.undisc) art = undiscked(art);
  const placed = `<g transform="translate(${at.x + p.x} ${at.y + p.y}) scale(${p.size / 32})"${p.filter}>${art}</g>`;
  return p.under ? `<g transform="translate(${at.x} ${at.y})">${p.under}</g>${placed}` : placed;
}

/**
 * The atlas as one SVG drawing, each icon drawn on its cells as `atlasLayout` lays them out. An icon with a small
 * drawing is drawn from it, as a sprite is seen at 13 to 30 pixels from where the game starts and further out.
 */
export function atlasSvg(icons, small = {}) {
  const scene = icons.filter(({ id }) => inScene(id));
  const layout = atlasLayout(scene.map(({ id }) => id));
  const cells = scene.flatMap(({ id, svg }) =>
    variantsOf(id).map((variant) => atlasCell(variant, innerOf(small[id] ?? svg), layout.icons[id][variant])),
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
export function sourceHash(icons, small = {}) {
  const hash = createHash('sha256');
  hash.update(atlasSvg(icons, small).svg);
  hash.update(spriteSheet(icons));
  hash.update(smallSheet(icons, small));
  return hash.digest('hex').slice(0, 16);
}
