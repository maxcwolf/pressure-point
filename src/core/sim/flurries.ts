// Light snow: a flurry or two each winter wherever it goes below freezing, a few days at a time. It is only weather,
// to look at, and changes nothing for the center.

import { DAYS_PER_MONTH } from '../data';
import type { Climate } from '../data/types';
import { dice } from './twists';
import { COLDEST_DAY } from './warmth';

/** The temperature, in degrees Fahrenheit, below which it can snow. */
export const FREEZING = 32;

/** How many whole days a flurry lasts. A game day is six seconds, so a flurry falls for about eighteen. */
export const FLURRY_DAYS = 3;

/** How many days there are in a year of the calendar. */
const YEAR_DAYS = 12 * DAYS_PER_MONTH;

/** Added to the number each roll of the dice is made from, so flurries never roll the same numbers as snowed-in spells. */
const FLURRY_SALT = 1_000_003;

/**
 * How many days either side of the coldest day of the year the weather outside is below freezing, in a climate: none in
 * a climate that never freezes, and half a year in one that is below freezing all year.
 */
export function freezingWindow(climate: Climate): number {
  if (climate.average - climate.swing >= FREEZING) return 0;
  if (climate.swing <= 0) return YEAR_DAYS / 2;
  const c = Math.min(1, Math.max(-1, (FREEZING - climate.average) / climate.swing));
  return (6 - (6 / Math.PI) * Math.acos(c)) * DAYS_PER_MONTH;
}

/**
 * The calendar days each flurry starts on in the cold season around the January of year `year`, counting the first year
 * of the calendar as 0. A season has one flurry or two, as the dice fall, each starting on a whole day picked so that
 * the whole flurry is below freezing. A climate that is below freezing for less time than a flurry lasts has none.
 */
export function flurrySpells(year: number, climate: Climate): number[] {
  const half = freezingWindow(climate);
  const middle = COLDEST_DAY + year * YEAR_DAYS;
  // the first whole day after it starts freezing, and the last a flurry can start on and still end before the thaw
  const first = Math.floor(middle - half) + 1;
  const last = Math.floor(middle + half) - FLURRY_DAYS;
  if (half <= 0 || last < first) return [];
  const key = FLURRY_SALT + year * 4;
  const count = dice(key) < 0.5 ? 1 : 2;
  return Array.from({ length: count }, (_, k) => first + Math.floor(dice(key + 1 + k) * (last - first + 1)));
}

/**
 * Whether a moment of the game, `day` days in, falls in a flurry of light snow, in a game that opened in `startMonth`.
 * Every moment of the same day is the same, so a flurry falls from the start of its first day to the end of its last.
 */
export function flurrying(day: number, climate: Climate, startMonth = 0): boolean {
  const date = day + startMonth * DAYS_PER_MONTH;
  const year = Math.round((date - COLDEST_DAY) / YEAR_DAYS);
  return flurrySpells(year, climate).some((start) => date >= start && date < start + FLURRY_DAYS);
}
