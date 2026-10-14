// What makes a center different to run: rush hours and seasons.

import { centerOf, DAY_SECONDS, DAYS_PER_MONTH } from '../data';
import type { SimContext } from './context';
import { emit } from './events';

/** The rush hours, as parts of each day: before work and after it. */
export const RUSH_WINDOWS: readonly (readonly [start: number, end: number])[] = [
  [0.05, 0.22],
  [0.68, 0.85],
];

/** Whether a moment of the game falls in a rush hour. */
export function inRush(day: number): boolean {
  const t = day - Math.floor(day);
  return RUSH_WINDOWS.some(([a, b]) => t >= a && t < b);
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

/** Announce each rush hour and each season as it starts. */
export function updateTwists(ctx: SimContext, dt: number) {
  const s = ctx.s;
  const { rush, seasons } = centerOf(s);
  if (!s.open) return;
  const before = s.day - dt / DAY_SECONDS;
  if (rush && inRush(s.day) && !inRush(before))
    emit(ctx, { type: 'announce', text: 'Rush hour! A crowd of desk workers is on its way.' });
  const season = seasonOf(s.day);
  if (seasons && season !== seasonOf(before)) emit(ctx, { type: 'announce', text: SEASON_NEWS[season] });
}
