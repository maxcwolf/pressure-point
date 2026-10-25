// What makes a center different to run: rush hours, seasons and snowed-in spells.

import { centerOf, DAY_SECONDS, DAYS_PER_MONTH } from '../data';
import type { RushHours, Seasons, Snowfall } from '../data/types';
import { calendarDay } from '../format';
import type { GameState } from '../state/types';
import type { SimContext } from './context';
import { emit, tipOnce, toast } from './events';
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

/** A game can start in winter, so the road is kept clear for its first month, for the center to get open. */
export const SNOW_GRACE_DAYS = DAYS_PER_MONTH;

/**
 * Whether a moment of the game, `day` days in, falls in a snowed-in spell, in a game that opened in `startMonth`.
 * Winter is cut into spells a few days long, and each is snowed in or not by the luck of the draw, the same every time
 * for the same spell.
 */
export function snowedIn(day: number, snow: Snowfall, startMonth = 0): boolean {
  const date = day + startMonth * DAYS_PER_MONTH;
  if (day < SNOW_GRACE_DAYS || seasonOf(date) !== 'winter') return false;
  return dice(Math.floor(date / snow.days)) < snow.chance;
}

/** Whether the center is snowed in now, so nobody can get up the road to it. */
export function cutOff(ctx: SimContext): boolean {
  const { snow } = centerOf(ctx.s);
  return !!snow && snowedIn(ctx.s.day, snow, ctx.s.startMonth);
}

/** What moves how often guests arrive at a moment, beyond reputation and what the center can treat, each a multiplier. */
export interface ArrivalParts {
  /** The center's own draw, the same all year. */
  center: number;
  /** The season or the rush hour: busier in rush hours and summers, quieter otherwise. */
  time: number;
  /** A center that stands higher draws more guests, the rival across the street draws some away, a storm keeps most at home. */
  grade: number;
  rival: number;
  mishap: number;
}

/** How much faster than usual guests arrive at a moment, part by part. */
export function arrivalParts(ctx: SimContext): ArrivalParts {
  const { rush, seasons, arrivals } = centerOf(ctx.s);
  let time = 1;
  if (rush) time *= inRush(ctx.s.day) ? rush.peak : rush.lull;
  if (seasons) time *= seasonFactor(seasonOf(calendarDay(ctx.s)), seasons);
  return {
    center: arrivals ?? 1,
    time,
    grade: gradeArrivals(ctx.s.grade),
    rival: 1 - rivalDraw(ctx.s),
    mishap: mishapArrivals(ctx.s),
  };
}

/** How much faster than usual guests arrive at a moment: busier in rush hours and summers, quieter otherwise. */
export function arrivalFactor(ctx: SimContext): number {
  const p = arrivalParts(ctx);
  return p.center * p.time * p.grade * p.rival * p.mishap;
}

/** How much busier than usual a season is, in a center with seasons. */
export function seasonFactor(season: Season, seasons: Seasons): number {
  return season === 'summer' ? seasons.summer : season === 'winter' ? seasons.winter : 1;
}

/** What a season will bring, in guests a month: how many came last month, and how many to expect at this season's pace. */
export interface SeasonOutlook {
  season: Season;
  /** How much busier than usual the season is. */
  factor: number;
  /** Guests who came last month, and the month before, if there were months; or null in the first month. */
  last: number | null;
  /** About how many to expect a month this season, from last month's at the season's pace against last month's. */
  expect: number | null;
}

/** What a season will bring, in guests a month, going by the month just finished. */
export function seasonOutlook(s: GameState, season: Season): SeasonOutlook {
  const seasons = centerOf(s).seasons ?? { summer: 1, winter: 1 };
  const factor = seasonFactor(season, seasons);
  const last = s.months.at(-1);
  if (!last) return { season, factor, last: null, expect: null };
  // the month just finished, at its own season's pace
  const lastFactor = seasonFactor(seasonOf(calendarDay(s, s.day - DAYS_PER_MONTH)), seasons);
  return { season, factor, last: last.arrived, expect: Math.round((last.arrived * factor) / lastFactor) };
}

/** A season's pace in a few words: "about ×1.9 the usual guests". */
const paceOf = (factor: number) => `about ×${factor} the usual guests`;

/** The outlook in a few words, or nothing in the first month. */
function expectOf(o: SeasonOutlook): string {
  return o.last === null || o.expect === null ? '' : ` Last month ${o.last} came; expect about ${o.expect} a month.`;
}

/** What the speakers say as each season starts, before the numbers: the part the announcer records. */
export const SEASON_LINES: Readonly<Record<Season, string>> = {
  winter: 'Winter is here. The promenade is empty, so watch the budget until spring.',
  spring: 'Spring has sprung! The first day-trippers are back in town.',
  summer: 'Summer at last, and the town is packed. Expect a crowd.',
  autumn: 'Autumn. The visitors are heading home.',
};

/** What the speakers say as each season starts, in a center that has them, with the numbers. */
export function seasonNews(s: GameState, season: Season): string {
  const o = seasonOutlook(s, season);
  switch (season) {
    case 'winter':
      return `${SEASON_LINES.winter} Until then, ${paceOf(o.factor)}.${expectOf(o)}`;
    case 'summer':
      return `${SEASON_LINES.summer} Until autumn, ${paceOf(o.factor)}.${expectOf(o)}`;
    default:
      return `${SEASON_LINES[season]}${expectOf(o)}`;
  }
}

/** Days ahead of a summer or a winter that a center with seasons is told what is coming. */
export const SEASON_AHEAD_DAYS = 14;

/**
 * A fortnight before a summer or a winter, what it will bring in numbers, and the levers: for a summer, rooms, staff,
 * prices or a limit on guests at once; for a winter, the wages that will not shrink with it.
 */
export function seasonAhead(s: GameState, season: 'summer' | 'winter'): string {
  const o = seasonOutlook(s, season);
  if (season === 'summer')
    return `Summer in ${SEASON_AHEAD_DAYS} days: ${paceOf(o.factor)} for three months.${expectOf(o)} The line grows to match, and guests who wait too long go home worse off: more rooms and staff, higher prices, or a limit on guests at once (Money menu, Prices), before it starts.`;
  return `Winter in ${SEASON_AHEAD_DAYS} days: ${paceOf(o.factor)} for three months.${expectOf(o)} The wages stay as they are: let go anyone you can spare, or have the money put by.`;
}

/** The season now and the one coming: their arrival multipliers, and the day the season turns. */
export interface SeasonTurn {
  season: Season;
  factor: number;
  next: Season;
  nextFactor: number;
  /** The day the next season starts, and how many days off that is. */
  turnsOn: number;
  daysUntil: number;
}

/** Where the year stands for a center with seasons: this season's multiplier and the next, with the day it turns. */
export function seasonTurn(day: number, seasons: Seasons): SeasonTurn {
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
  const now = calendarDay(s);
  const then = calendarDay(s, before);
  const season = seasonOf(now);
  if (seasons && season !== seasonOf(then)) emit(ctx, { type: 'announce', text: seasonNews(s, season) });
  const ahead = seasonOf(now + SEASON_AHEAD_DAYS);
  if (seasons && ahead !== seasonOf(then + SEASON_AHEAD_DAYS) && (ahead === 'summer' || ahead === 'winter'))
    toast(ctx, seasonAhead(s, ahead), 'info', undefined, `season-${ahead}`);
  const snowed = snow && snowedIn(s.day, snow, s.startMonth);
  if (snow && snowed !== snowedIn(before, snow, s.startMonth))
    emit(ctx, { type: 'announce', text: snowed ? SNOW_NEWS.start : SNOW_NEWS.end });
}
