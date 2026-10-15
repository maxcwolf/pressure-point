// What makes a center different to run: rush hours, seasons and snowed-in spells.

import { centerOf, DAY_SECONDS, DAYS_PER_MONTH } from '../data';
import type { Snowfall } from '../data/types';
import type { SimContext } from './context';
import { emit, tipOnce } from './events';

/**
 * Rush hours come in waves: two days of them in every six, as the office crowd comes in. A game day lasts only a few
 * seconds, so anything shorter would flicker past.
 */
export const RUSH_CYCLE_DAYS = 6;
export const RUSH_START = 3;
export const RUSH_DAYS = 2;

/** Whether a moment of the game falls in a rush hour. */
export function inRush(day: number): boolean {
  const t = day - Math.floor(day / RUSH_CYCLE_DAYS) * RUSH_CYCLE_DAYS;
  return t >= RUSH_START && t < RUSH_START + RUSH_DAYS;
}

/** The seasons, a quarter of the year each, starting the year in winter. */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/** The season a game day falls in: December to February is winter, and so on. */
export function seasonOf(day: number): Season {
  const month = Math.floor(day / DAYS_PER_MONTH) % 12;
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

/** A number from 0 to 1 that is always the same for the same whole number, and looks random from one to the next. */
export function dice(n: number): number {
  let h = Math.imul(n ^ 0x5bd1e995, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  return ((h ^ (h >>> 13)) >>> 0) / 0x100000000;
}

/** A game starts in winter, so the road is kept clear for its first month, for the center to get open. */
export const SNOW_GRACE_DAYS = DAYS_PER_MONTH;

/**
 * Whether a moment of the game falls in a snowed-in spell. Winter is cut into spells a few days long, and each is
 * snowed in or not by the luck of the draw, the same every time for the same spell.
 */
export function snowedIn(day: number, snow: Snowfall): boolean {
  if (day < SNOW_GRACE_DAYS || seasonOf(day) !== 'winter') return false;
  return dice(Math.floor(day / snow.days)) < snow.chance;
}

/** Whether the center is snowed in now, so nobody can get up the road to it. */
export function cutOff(ctx: SimContext): boolean {
  const { snow } = centerOf(ctx.s);
  return !!snow && snowedIn(ctx.s.day, snow);
}

/** How much faster than usual guests arrive at a moment: busier in rush hours and summers, quieter otherwise. */
export function arrivalFactor(ctx: SimContext): number {
  const { rush, seasons } = centerOf(ctx.s);
  let factor = 1;
  if (rush) factor *= inRush(ctx.s.day) ? rush.peak : rush.lull;
  if (seasons) {
    const season = seasonOf(ctx.s.day);
    if (season === 'summer') factor *= seasons.summer;
    else if (season === 'winter') factor *= seasons.winter;
  }
  return factor;
}

/** What the speakers say as each season starts, in a center that has them. */
const SEASON_NEWS: Record<Season, string> = {
  winter: 'Winter is here. The promenade is empty, so watch the budget until spring.',
  spring: 'Spring! The first day-trippers are back in town.',
  summer: 'Summer at last, and the town is packed. Expect a crowd.',
  autumn: 'Autumn. The visitors are heading home.',
};

/** How much faster than usual waiting guests lose patience here. */
export function impatience(ctx: SimContext): number {
  return centerOf(ctx.s).rush?.impatience ?? 1;
}

/** What the speakers say as a snowed-in spell starts, and as the road opens again. */
export const SNOW_NEWS = {
  start: 'Snowed in! The road up the mountain is closed, so nobody new can get here for a day or two.',
  end: 'The snowplow has been through, and the road is open again.',
} as const;

/** Explain rush hours the first time one comes, and announce each season, and each snowed-in spell, as it starts. */
export function updateTwists(ctx: SimContext, dt: number) {
  const s = ctx.s;
  const { rush, seasons, snow } = centerOf(s);
  if (!s.open) return;
  const before = s.day - dt / DAY_SECONDS;
  // they come round too often to announce every time: the bottom bar says when one is on
  if (rush && inRush(s.day) && !inRush(before))
    tipOnce(
      ctx,
      'rush-hour',
      'Rush hour! The office crowd comes in waves: a couple of busy days in every six, when guests are less patient. The bottom bar shows when one is on.',
    );
  const season = seasonOf(s.day);
  if (seasons && season !== seasonOf(before)) emit(ctx, { type: 'announce', text: SEASON_NEWS[season] });
  if (snow && snowedIn(s.day, snow) !== snowedIn(before, snow))
    emit(ctx, { type: 'announce', text: snowedIn(s.day, snow) ? SNOW_NEWS.start : SNOW_NEWS.end });
}
