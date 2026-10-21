// What makes a center different to run: rush hours, seasons and snowed-in spells.

import { centerOf, DAY_SECONDS, DAYS_PER_MONTH } from '../data';
import type { RushHours, Seasons, Snowfall } from '../data/types';
import type { SimContext } from './context';
import { emit, tipOnce } from './events';
import { mishapArrivals } from './mishaps';
import { rivalDraw } from './rival';
import { gradeArrivals } from './standing';

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
  const { rush, seasons, arrivals } = centerOf(ctx.s);
  let factor = arrivals ?? 1;
  if (rush) factor *= inRush(ctx.s.day) ? rush.peak : rush.lull;
  if (seasons) {
    const season = seasonOf(ctx.s.day);
    if (season === 'summer') factor *= seasons.summer;
    else if (season === 'winter') factor *= seasons.winter;
  }
  // a center that stands higher draws more guests, the rival across the street draws some away, and a storm keeps
  // most at home
  return factor * gradeArrivals(ctx.s.grade) * (1 - rivalDraw(ctx.s)) * mishapArrivals(ctx.s);
}

/** How much faster than usual guests arrive in a season, in a center with seasons. */
export function seasonFactor(season: Season, seasons: Seasons): number {
  return season === 'summer' ? seasons.summer : season === 'winter' ? seasons.winter : 1;
}

/** The season now and the one coming: their arrival multipliers, and the day the season turns. */
export interface SeasonOutlook {
  season: Season;
  factor: number;
  next: Season;
  nextFactor: number;
  /** The day the next season starts, and how many days off that is. */
  turnsOn: number;
  daysUntil: number;
}

/** Where the year stands for a center with seasons: this season's multiplier and the next, with the day it turns. */
export function seasonOutlook(day: number, seasons: Seasons): SeasonOutlook {
  const season = seasonOf(day);
  let month = Math.floor(day / DAYS_PER_MONTH) + 1;
  while (seasonOf(month * DAYS_PER_MONTH) === season) month++;
  const turnsOn = month * DAYS_PER_MONTH;
  const next = seasonOf(turnsOn);
  return {
    season,
    factor: seasonFactor(season, seasons),
    next,
    nextFactor: seasonFactor(next, seasons),
    turnsOn,
    daysUntil: turnsOn - day,
  };
}

/** Where the rush-hour cycle stands: whether one is on, how arrivals run now, and when it turns. */
export interface RushOutlook {
  on: boolean;
  factor: number;
  /** How arrivals will run once it turns, and the day it does, with how many days off that is. */
  nextFactor: number;
  turnsOn: number;
  daysUntil: number;
}

/** Where the rush hours stand for a center that has them: on or off now, and when the next change comes. */
export function rushOutlook(day: number, rush: RushHours): RushOutlook {
  const on = inRush(day);
  const cycle = Math.floor(day / RUSH_CYCLE_DAYS) * RUSH_CYCLE_DAYS;
  const t = day - cycle;
  const turnsOn = on
    ? cycle + RUSH_START + RUSH_DAYS
    : t < RUSH_START
      ? cycle + RUSH_START
      : cycle + RUSH_CYCLE_DAYS + RUSH_START;
  return {
    on,
    factor: on ? rush.peak : rush.lull,
    nextFactor: on ? rush.lull : rush.peak,
    turnsOn,
    daysUntil: turnsOn - day,
  };
}

/** What the speakers say as each season starts, in a center that has them. */
const SEASON_NEWS: Record<Season, string> = {
  winter: 'Winter is here. The promenade is empty, so watch the budget until spring.',
  spring: 'Spring! The first day-trippers are back in town.',
  summer: 'Summer at last, and the town is packed. Expect a crowd.',
  autumn: 'Autumn. The visitors are heading home.',
};

/**
 * The season's announcement with its numbers: the arrival multiplier, and the guests to expect a month from last
 * month's count, which was at the season before's pace.
 */
export function seasonNews(season: Season, seasons: Seasons, lastArrived?: number): string {
  const factor = seasonFactor(season, seasons);
  const before = seasonFactor(previousSeason(season), seasons);
  const change = factor === 1 ? 'the usual number of guests' : `about ×${factor} the usual guests`;
  const expect =
    lastArrived === undefined
      ? ''
      : ` Last month ${lastArrived} came: expect about ${Math.round((lastArrived * factor) / before)} a month.`;
  return `${SEASON_NEWS[season]} ${change.charAt(0).toUpperCase()}${change.slice(1)} until it turns.${expect}`;
}

/** The season before one. */
export function previousSeason(season: Season): Season {
  return season === 'winter' ? 'autumn' : season === 'spring' ? 'winter' : season === 'summer' ? 'spring' : 'summer';
}

/** How much faster than usual waiting guests lose patience here: faster during a rush, where a center has them. */
export function impatience(ctx: SimContext): number {
  const rush = centerOf(ctx.s).rush;
  return rush && inRush(ctx.s.day) ? rush.impatience : 1;
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
  if (seasons && season !== seasonOf(before))
    emit(ctx, { type: 'announce', text: seasonNews(season, seasons, s.months.at(-1)?.arrived) });
  if (snow && snowedIn(s.day, snow) !== snowedIn(before, snow))
    emit(ctx, { type: 'announce', text: snowedIn(s.day, snow) ? SNOW_NEWS.start : SNOW_NEWS.end });
}
