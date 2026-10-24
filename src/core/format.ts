// Turning numbers into the text the player reads.

import { DAYS_PER_MONTH } from './data';

/** A dollar amount as text, rounded to whole dollars. */
export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

/** A rate as a whole percentage: 0.05 is "5%". */
export const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** "a" or "an", to go before a name. */
export const article = (name: string) => (/^[AEIOU]/.test(name) ? 'an' : 'a');

/** A name with "a" or "an" before it, capitalized to start a sentence if asked: "An Air Conditioner". */
export function an(name: string, start = false): string {
  const a = article(name);
  return `${start ? a.charAt(0).toUpperCase() + a.slice(1) : a} ${name}`;
}

/**
 * The day on the calendar that a game's running day count falls on: a game that opened later in the year than January
 * runs that many months ahead of its count.
 */
export const calendarDay = (s: { day: number; startMonth: number }, day = s.day) => day + s.startMonth * DAYS_PER_MONTH;

/**
 * The day, month and year that a running day count falls on, in a game that opened in `startMonth` (0 for January):
 * the month is the calendar's, and the year the year of running the center, the one its awards are for.
 */
export function dateOf(day: number, startMonth = 0) {
  const d = Math.floor(day);
  return {
    day: (d % DAYS_PER_MONTH) + 1,
    month: ((Math.floor(d / DAYS_PER_MONTH) + startMonth) % 12) + 1,
    year: Math.floor(d / (DAYS_PER_MONTH * 12)) + 1,
  };
}
