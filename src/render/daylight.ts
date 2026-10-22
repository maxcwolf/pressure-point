// How the light changes through a game day and through the year: a warm, low morning at opening, a plain high noon
// and an amber evening at closing, and a sky and lawn a little fresher in spring, warmer in summer, golden in autumn
// and paler in winter. Pure numbers, so the balance is easy to tune and test; lighting.ts puts them on the lights.

import type { Season } from '../core/sim/twists';

/** A tint for a light, red, green and blue, each 1 for no change. */
export type Tint = readonly [number, number, number];

/** How the light looks at a moment, against plain noon: the tint and brightness of the sun and of the sky. */
export interface Daylight {
  sun: Tint;
  sunLevel: number;
  sky: Tint;
  skyLevel: number;
}

/** No tint at all. */
const PLAIN: Tint = [1, 1, 1];

/** Plain noon: the light the stored pictures are taken in. */
export const NOON: Daylight = { sun: PLAIN, sunLevel: 1, sky: PLAIN, skyLevel: 1 };

/** The time of day, as a share of the game day, that is noon in the middle of its plain stretch. */
export const NOON_AT = 0.45;

/** The center opens in a low, warm, faintly rosy light. */
const MORNING: Daylight = { sun: [1.04, 0.9, 0.8], sunLevel: 0.84, sky: [1.0, 0.95, 0.95], skyLevel: 0.96 };
/** And closes in an amber one. */
const EVENING: Daylight = { sun: [1.06, 0.84, 0.64], sunLevel: 0.8, sky: [1.02, 0.94, 0.86], skyLevel: 0.94 };

/**
 * The light through the day, as shares of it: morning at opening, plain from late morning to early afternoon, amber
 * at closing, then back round to morning, so the day wraps without a jump.
 */
const DAY: readonly (readonly [number, Daylight])[] = [
  [0, MORNING],
  [0.3, NOON],
  [0.6, NOON],
  [0.88, EVENING],
  [1, MORNING],
];

/** Ease from 0 to 1 slowly at both ends. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** A number between two, a share of the way along. */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A tint between two, a share of the way along. */
const lerpTint = (a: Tint, b: Tint, t: number): Tint => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** The light between two, a share of the way along. */
function lerpLight(a: Daylight, b: Daylight, t: number): Daylight {
  return {
    sun: lerpTint(a.sun, b.sun, t),
    sunLevel: lerp(a.sunLevel, b.sunLevel, t),
    sky: lerpTint(a.sky, b.sky, t),
    skyLevel: lerp(a.skyLevel, b.skyLevel, t),
  };
}

/**
 * The light at a moment of the game, from its running day count, its fractional part being the time of day; `depth`
 * scales how far it strays from noon, 1 in full and 0 for plain noon all day.
 */
export function daylightAt(day: number, depth = 1): Daylight {
  const t = day - Math.floor(day);
  let i = 0;
  while (i < DAY.length - 2 && t >= (DAY[i + 1]?.[0] ?? 1)) i++;
  const [t0, a] = DAY[i] ?? [0, NOON];
  const [t1, b] = DAY[i + 1] ?? [1, NOON];
  return lerpLight(NOON, lerpLight(a, b, smooth((t - t0) / (t1 - t0))), depth);
}

/** The gray of storm clouds: a cool, flat light that takes most of the warmth out of the sun and the sky. */
const STORM_SUN: Tint = [0.92, 0.95, 1.0];
const STORM_SKY: Tint = [0.9, 0.94, 1.0];
/** How much of the time of day's own tint a storm takes away, at its height. */
const STORM_FLATTEN = 0.7;

/** The light under storm clouds `gray` of the way in, 0 to 1, on top of the time of day: cooler and flatter. */
export function stormy(d: Daylight, gray: number): Daylight {
  const t = gray * STORM_FLATTEN;
  return { ...d, sun: lerpTint(d.sun, STORM_SUN, t), sky: lerpTint(d.sky, STORM_SKY, t) };
}

/** The tint each season puts on the sky and the sun, on top of a setting's own light. */
export const SEASON_LIGHT: Record<Season, { sky: Tint; sun: Tint }> = {
  spring: { sky: [0.99, 1.01, 1.0], sun: [1.0, 1.0, 0.98] },
  summer: { sky: [1.02, 1.0, 0.96], sun: [1.02, 0.99, 0.94] },
  autumn: { sky: [1.03, 0.99, 0.92], sun: [1.03, 0.97, 0.9] },
  winter: { sky: [0.95, 0.98, 1.05], sun: [0.97, 0.99, 1.04] },
};

/** A color the ground is drawn toward in a season, and how far: a lawn's, bare sand's or paving's. */
interface GroundShift {
  toward: number;
  by: number;
}

/** How each season shifts a lawn: fresher green in spring, warmer in summer, gold in autumn, pale and cool in winter. */
const LAWN_SEASON: Record<Season, GroundShift> = {
  spring: { toward: 0x86d47e, by: 0.22 },
  summer: { toward: 0xa6cf62, by: 0.25 },
  autumn: { toward: 0xd2b260, by: 0.38 },
  winter: { toward: 0xc9d6cc, by: 0.36 },
};
/** And sand, a touch: warmer in summer and autumn, paler in winter. */
const SAND_SEASON: Record<Season, GroundShift> = {
  spring: { toward: 0xead9ab, by: 0 },
  summer: { toward: 0xf0d49a, by: 0.25 },
  autumn: { toward: 0xe2cc98, by: 0.2 },
  winter: { toward: 0xe8e4d6, by: 0.3 },
};

/**
 * And paving, which never greens or whitens: a little paler in summer's sun, and darker and wetter, autumn's a touch
 * warm and winter's cool, through the rains.
 */
const PAVING_SEASON: Record<Season, GroundShift> = {
  spring: { toward: 0xc2c1bb, by: 0 },
  summer: { toward: 0xd8d2c4, by: 0.22 },
  autumn: { toward: 0x8e8a82, by: 0.2 },
  winter: { toward: 0x939ba3, by: 0.26 },
};

/** What the ground of a setting is: grass, sand, paving, or snow, which already looks like winter all year. */
export type Ground = 'grass' | 'sand' | 'paving' | 'snow';

/** How each kind of ground but snow shifts with the seasons. */
const GROUND_SEASON: Record<Exclude<Ground, 'snow'>, Record<Season, GroundShift>> = {
  grass: LAWN_SEASON,
  sand: SAND_SEASON,
  paving: PAVING_SEASON,
};

/** One channel of a color, 0 to 255. */
const channel = (hex: number, shift: number) => (hex >> shift) & 0xff;

/** A color between two, a share of the way along, in the colors as picked. */
export function mixHex(a: number, b: number, t: number): number {
  /** One channel of the mix, in place. */
  const at = (shift: number) => Math.round(lerp(channel(a, shift), channel(b, shift), t)) << shift;
  return at(16) | at(8) | at(0);
}

/** A ground color as it looks in a season. */
export function seasonGround(hex: number, ground: Ground, season: Season): number {
  if (ground === 'snow') return hex;
  const { toward, by } = GROUND_SEASON[ground][season];
  return mixHex(hex, toward, by);
}

/** How bright a tinted white light looks to the eye, 1 for plain white. */
export const brightness = (t: Tint) => 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
