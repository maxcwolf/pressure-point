// Turning numbers into the text the player reads.

import { DAYS_PER_MONTH } from './data';

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export function dateOf(day: number) {
  const d = Math.floor(day);
  return {
    day: (d % DAYS_PER_MONTH) + 1,
    month: (Math.floor(d / DAYS_PER_MONTH) % 12) + 1,
    year: Math.floor(d / (DAYS_PER_MONTH * 12)) + 1,
  };
}
