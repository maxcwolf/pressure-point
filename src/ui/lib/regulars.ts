// What the interface says about a regular: how they stand with the center, and when they are next in.

import { LOYALTY_NAMES } from '../../core/data';
import { loyaltyLevel } from '../../core/sim/regulars';
import type { Regular } from '../../core/state/types';

/** A number as a position: 1st, 2nd, 3rd, 4th, 11th, 21st. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** A regular's tag: how loyal they are, and which visit this is. */
export function regularTag(r: Pick<Regular, 'loyalty' | 'visits'>): string {
  const level = loyaltyLevel(r.loyalty);
  const who = level === 'regular' ? '👋 Regular' : `💛 ${LOYALTY_NAMES[level]} regular`;
  return `${who}, on their ${ordinal(r.visits)} visit`;
}

/** When a regular is next in: here now, due back in so many days, or any time. */
export function loyaltyNote(r: Pick<Regular, 'due'>, day: number, here: boolean): string {
  if (here) return 'Here now';
  if (r.due - day < 1) return 'Due back any time';
  const days = Math.ceil(r.due - day);
  return `Due back in ${days} ${days === 1 ? 'day' : 'days'}`;
}
