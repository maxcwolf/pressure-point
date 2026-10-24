// The rules for the game's icons and the working out behind `yarn icons`, kept apart from the drawing so the tests
// can check them: what an icon file may contain, which icons the scene needs, where each sits in the atlas, and a
// fingerprint of the drawings that tells whether what was built from them is up to date.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

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
  // the yellow of a face or a hand, as an emoji's, so a face reads on red, white and cream alike
  face: '#ffcc4d',
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

/**
 * How big each icon's cell in the atlas is, in pixels, how many cells go across it, and how much empty atlas lies
 * between two cells: the graphics card shrinks the atlas by halves for an icon seen small, and without a gutter a
 * cell's edge would take in its neighbour's ink once shrunk to an eighth.
 */
export const CELL = 128;
export const ATLAS_COLUMNS = 16;
export const GUTTER = 16;

/** The family an icon belongs to, from the start of its id. */
export const familyOf = (id) => id.split('-')[0];

/**
 * The families every icon of which has a small drawing, which the scene and the small sheet draw it from. Their small
 * drawings keep to `checkSmallIcon`'s stricter rules, so the lints of line and ink (`checkLines`, `checkInk`) leave
 * their large drawings be.
 */
export const DRAWN_SMALL_FAMILIES = ['bubble', 'marker'];

/**
 * The drawings kept as they are though a lint finds fault with them, with the lints (`line`, `ink`) they are spared:
 * each was picked as drawn, and redrawing it to pass would change its picture.
 */
export const SPARED = {
  // an hourglass, kept as it was: the outline of its sand is 1.5
  'feeling-long-wait': ['line'],
};

/** Whether a lint, of line or of ink, looks at a drawing. */
export const linted = (id, lint) => !DRAWN_SMALL_FAMILIES.includes(familyOf(id)) && !SPARED[id]?.includes(lint);

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
    [/\sstyle=/, "no styles: the sprite sheets set the lines' width with one"],
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
  if (linted(id, 'line')) problems.push(...checkLines(svg));
  return problems;
}

/** The thinnest navy line a drawing may have, in units of its 32, after any scaling: 1.3 pixels at 24. */
export const MIN_LINE = 1.6;

/** How much a transform scales what it holds, as the square root of its area's change. */
function scaleOf(transform) {
  let k = 1;
  for (const [, fn, args] of transform.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = args
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (fn === 'scale') k *= Math.sqrt(Math.abs((n[0] ?? 1) * (n[1] ?? n[0] ?? 1)));
    else if (fn === 'matrix') k *= Math.sqrt(Math.abs((n[0] ?? 1) * (n[3] ?? 1) - (n[1] ?? 0) * (n[2] ?? 0)));
  }
  return k;
}

/**
 * Every line a drawing strokes: its color and how wide it comes out, in units of the 32, with the width and color
 * each shape takes from the groups round it and the scaling of their transforms.
 */
export function linesOf(svg) {
  const lines = [];
  const stack = [{ stroke: 'none', width: 1, scale: 1 }];
  for (const [, close, tag, attrs, selfClosing] of svg.matchAll(/<(\/?)(\w+)([^>]*?)(\/?)>/g)) {
    if (close) {
      stack.pop();
      continue;
    }
    const outer = stack[stack.length - 1];
    /** The value of one of the element's attributes, if it has it. */
    const attr = (name) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];
    const here = {
      stroke: attr('stroke') ?? outer.stroke,
      width: attr('stroke-width') !== undefined ? Number(attr('stroke-width')) : outer.width,
      scale: outer.scale * scaleOf(attr('transform') ?? ''),
    };
    if (/^(path|rect|circle|ellipse|line|polyline|polygon)$/.test(tag) && here.stroke !== 'none')
      lines.push({ color: here.stroke, width: Number((here.width * here.scale).toFixed(2)) });
    if (!selfClosing) stack.push(here);
  }
  return lines;
}

/**
 * What is wrong with how a drawing is drawn, as against what it may contain: a navy line under `MIN_LINE`, which the
 * interface draws at 4/5 and a plain screen smears to a grey hairline.
 */
export function checkLines(svg) {
  const thinnest = Math.min(
    ...linesOf(svg)
      .filter((l) => l.color === PALETTE.navy)
      .map((l) => l.width),
  );
  return thinnest < MIN_LINE ? [`a navy line ${thinnest} wide is a hairline: ${MIN_LINE} at least`] : [];
}

/**
 * How big a drawing's ink may be on its 32-unit square: at least 23 across, so it looks as big as the icons beside it
 * (most are 25 to 29), and clear of every edge by half a unit, so its outline is not cut off.
 */
export const MIN_INK = 23;
export const MIN_MARGIN = 0.5;

/**
 * What is wrong with where a drawing's ink lies, given the box round it as `yarn icons` measured it: left, top, right
 * and bottom, in units of the 32.
 */
export function checkInk([left, top, right, bottom]) {
  const problems = [];
  const across = Math.max(right - left, bottom - top);
  if (across < MIN_INK) problems.push(`its ink is ${across.toFixed(1)} across, which looks small: ${MIN_INK} at least`);
  const margin = Math.min(left, top, 32 - right, 32 - bottom);
  if (margin < MIN_MARGIN)
    problems.push(`its ink comes ${margin.toFixed(1)} from the edge, which cuts its outline: ${MIN_MARGIN} at least`);
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
 * How much thinner the interface draws an icon's lines than the scene does, where it has room: the drawings'
 * 2.25-wide outline reads heavy at 24 pixels and over, and drawn at 1.8 it sits with the type. The scene's atlas keeps
 * the full width, as its icons are seen from further off.
 */
export const SPRITE_STROKE = 1.8 / 2.25;

/**
 * Lines this wide and wider are not outlines but the wide strokes some drawings lay under a narrower colored one, as
 * an outline of their own. They are never drawn heavier than drawn, which would swallow the color.
 */
export const WIDE_STROKE = 3;

/**
 * A drawing whose lines take their width from the size it comes out at: each is its drawn width times
 * `--icon-line`, which `Icon` sets from how many pixels the icon has (`lineScale`), so a line is about a pixel and a
 * half at 16 pixels on a plain screen and 4/5 of drawn at 24 and over, with no step between. A wide stroke is drawn no
 * heavier than drawn. Without `--icon-line` the lines are drawn at `fallback` of their width.
 */
export const sized = (inner, fallback = SPRITE_STROKE) => {
  const k = Number(fallback.toFixed(2));
  return inner.replace(/stroke-width="([\d.]+)"/g, (_, w) =>
    Number(w) < WIDE_STROKE
      ? `style="stroke-width:calc(${w} * var(--icon-line, ${k}))"`
      : `style="stroke-width:calc(${w} * min(var(--icon-line, ${k}), 1))"`,
  );
};

/**
 * The sprite sheet the interface draws icons from: one symbol per icon, each named `icon-` and its id, its lines as
 * wide as the size it comes out at calls for (`sized`).
 */
export function spriteSheet(icons) {
  const symbols = icons.map(
    ({ id, svg }) => `<symbol id="icon-${id}" viewBox="0 0 32 32">${sized(innerOf(svg))}</symbol>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="0" height="0" style="position:absolute">\n${symbols.join('\n')}\n</svg>\n`;
}

/**
 * How heavy the small sheet draws the lines of an icon that has no small drawing, when nothing says how big it is: at
 * 16 pixels on a plain screen the 2.25 outline is 1.1 pixels and the sprite's 1.8 is under one, so both smear to grey;
 * 2.9 lands on a pixel and a half.
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
 * A hand-drawn small drawing with its lines on the same curve of weight as the rest, as a share of how it is drawn,
 * which is for 16 pixels on a plain screen: `--icon-small-line`, which `Icon` sets, 1 meaning as drawn. As in `sized`,
 * a wide stroke laid under a colored line is never made heavier.
 */
export const sizedSmall = (inner) =>
  inner.replace(/stroke-width="([\d.]+)"/g, (_, w) =>
    Number(w) < 4
      ? `style="stroke-width:calc(${w} * var(--icon-small-line, 1))"`
      : `style="stroke-width:calc(${w} * min(var(--icon-small-line, 1), 1))"`,
  );

/**
 * An icon as the small sheet draws it: its small drawing, or its one drawing made whiter and unmedalled, either with
 * its lines as wide as its size calls for.
 */
export const madeSmall = (id, inner, small) =>
  small[id]
    ? sizedSmall(innerOf(small[id]))
    : sized(whitened(familyOf(id) === 'award' ? unmedalled(inner) : inner), SMALL_STROKE);

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
 * The bubbles that also come in amber, for a need that will become trouble: a waiting guest bursting or parched, a
 * member of staff worn out, and a guest running out of patience before they are fed up.
 */
export const NEEDS = ['bubble-restroom', 'bubble-thirsty', 'bubble-exhausted', 'bubble-impatient'];

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
 * icon on its own and then in its bubble and the rest, packed across in order of id, with a gutter round every cell.
 */
export function atlasLayout(ids, cell = CELL, columns = ATLAS_COLUMNS, gutter = GUTTER) {
  const cells = ids.flatMap((id) => variantsOf(id).map((variant) => ({ id, variant })));
  const rows = Math.ceil(cells.length / columns);
  const step = cell + gutter;
  const icons = {};
  cells.forEach(({ id, variant }, i) => {
    icons[id] ??= {};
    icons[id][variant] = {
      x: (i % columns) * step + gutter / 2,
      y: Math.floor(i / columns) * step + gutter / 2,
      w: cell,
      h: cell,
    };
  });
  return { width: Math.min(cells.length, columns) * step, height: rows * step, cell, icons };
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

/**
 * The white badge with a navy "!" on an alarm's upper right, so an alarm is told apart by its shape as well as its red,
 * for players who can't tell red from amber.
 */
const BANG =
  `<circle cx="104" cy="24" r="20" fill="${PALETTE.white}" stroke="${PALETTE.navy}" stroke-width="6"/>` +
  `<path d="M104 13v12" stroke="${PALETTE.navy}" stroke-width="7" stroke-linecap="round"/>` +
  `<circle cx="104" cy="34.5" r="3.8" fill="${PALETTE.navy}"/>`;

/** The disc a staff marker sits on over a use square: purple as the square, outlined in navy inside a white edge. */
const SQUARE_DISC =
  `<circle cx="64" cy="64" r="58" fill="${PALETTE.white}"/>` +
  `<circle cx="64" cy="64" r="52" fill="${STAFF_SQUARE}" stroke="${PALETTE.navy}" stroke-width="6"/>`;

/**
 * How an icon is placed on its cell, and what is drawn under it: on its own it fills the cell inside a white edge,
 * like a sticker, so it reads against any floor; in a bubble it fills the bubble's disc, white for something said, red
 * for an alarm, with a "!" badge, and amber for a need; as a staff marker it sits on the purple disc, without a disc of
 * its own.
 */
const PLACING = {
  plain: { x: 10, y: 10, size: 108, filter: ' filter="url(#sticker)"' },
  bubble: { x: 20, y: 11, size: 88, filter: '', under: BUBBLE(PALETTE.white) },
  // on red, the drawing's red turns navy and the rest stays as drawn, so an hourglass's sand still shows; the whole
  // bubble a little smaller, to leave room in the cell for its badge
  alarm: {
    x: 20,
    y: 11,
    size: 88,
    filter: '',
    under: BUBBLE(PALETTE.red),
    recolor: [PALETTE.red, PALETTE.navy],
    shrink: 0.88,
    badge: BANG,
  },
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
  let cell = p.under ? `<g transform="translate(${at.x} ${at.y})">${p.under}</g>${placed}` : placed;
  if (p.shrink) {
    const cx = at.x + 64;
    const cy = at.y + 64;
    cell = `<g transform="translate(${cx} ${cy}) scale(${p.shrink}) translate(${-cx} ${-cy})">${cell}</g>`;
  }
  return p.badge ? `${cell}<g transform="translate(${at.x} ${at.y})">${p.badge}</g>` : cell;
}

/**
 * The atlas as one SVG drawing, each icon drawn on its cells as `atlasLayout` lays them out. An icon with a small
 * drawing is drawn from it, as a sprite is seen at 13 to 30 pixels from where the game starts and further out; a
 * room's sign is drawn from its one drawing, as its small drawing is for the interface alone.
 */
export function atlasSvg(icons, small = {}) {
  const scene = icons.filter(({ id }) => inScene(id));
  const layout = atlasLayout(scene.map(({ id }) => id));
  const cells = scene.flatMap(({ id, svg }) => {
    const drawn = familyOf(id) === 'room' ? svg : (small[id] ?? svg);
    return variantsOf(id).map((variant) => atlasCell(variant, innerOf(drawn), layout.icons[id][variant]));
  });
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

/** Below this opacity, out of 255, a texel of the atlas is clear, and its color is not its own but bled in. */
export const CLEAR = 16;

/**
 * The atlas's pixels with color bled into every clear texel from the nearest inked one, in place. Saved as it is
 * drawn, a clear texel is black, and the graphics card, blending texels as it shrinks and samples the atlas, darkens
 * every edge with it: a dark fringe round each icon and a grey ring on a marker's white edge. Bled, a clear texel has
 * the color of the ink beside it, so an edge fades out in its own color. `rgba` is four bytes a texel, row by row.
 */
export function bleed(rgba, width, height) {
  const n = width * height;
  const from = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] >= CLEAR) {
      from[i] = i;
      queue[tail++] = i;
    }
  }
  // outward from all the ink at once, a ring at a time, so each clear texel takes the color of the ink nearest it
  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
      if (j < 0 || j >= n || from[j] !== -1) continue;
      from[j] = from[i];
      const o = j * 4;
      const src = from[i] * 4;
      rgba[o] = rgba[src];
      rgba[o + 1] = rgba[src + 1];
      rgba[o + 2] = rgba[src + 2];
      queue[tail++] = j;
    }
  }
  return rgba;
}

/** A chunk of a PNG: its length, its type, what it holds and a checksum of the last two. */
function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** A PNG of pixels given four bytes a texel, row by row, each row filtered as best packs it. */
export function encodePng(rgba, width, height) {
  const stride = width * 4;
  const rows = Buffer.alloc((stride + 1) * height);
  const line = Buffer.alloc(stride);
  const best = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const at = y * stride;
    let bestFilter = 0;
    let bestCost = Infinity;
    for (let filter = 0; filter < 5; filter++) {
      let cost = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? rgba[at + i - 4] : 0;
        const b = y > 0 ? rgba[at - stride + i] : 0;
        const c = i >= 4 && y > 0 ? rgba[at - stride + i - 4] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const predicted = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
        const v = (rgba[at + i] - predicted) & 0xff;
        line[i] = v;
        cost += v < 128 ? v : 256 - v;
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestFilter = filter;
        line.copy(best);
      }
    }
    rows[y * (stride + 1)] = bestFilter;
    best.copy(rows, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A fingerprint of everything built from the drawings, so the tests can tell when `yarn icons` is due. */
export function sourceHash(icons, small = {}) {
  const hash = createHash('sha256');
  hash.update(atlasSvg(icons, small).svg);
  hash.update(spriteSheet(icons));
  hash.update(smallSheet(icons, small));
  return hash.digest('hex').slice(0, 16);
}
