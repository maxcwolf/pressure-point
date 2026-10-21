// Turning numbers into the text the player reads.

import { DAYS_PER_MONTH } from './data';

/** A dollar amount as text, rounded to whole dollars. */
export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

/** "a" or "an", to go before a name. */
export const article = (name: string) => (/^[AEIOU]/.test(name) ? 'an' : 'a');

/** A name with "a" or "an" before it, capitalized to start a sentence if asked: "An Air Conditioner". */
export function an(name: string, start = false): string {
  const a = article(name);
  return `${start ? a.charAt(0).toUpperCase() + a.slice(1) : a} ${name}`;
}

/** The day, month and year that a running day count falls on. */
export function dateOf(day: number) {
  const d = Math.floor(day);
  return {
    day: (d % DAYS_PER_MONTH) + 1,
    month: (Math.floor(d / DAYS_PER_MONTH) % 12) + 1,
    year: Math.floor(d / (DAYS_PER_MONTH * 12)) + 1,
  };
}
