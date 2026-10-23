// Text that drifts up from a point in the world, such as money earned: where each sits, and how those close together
// share the space rather than piling up into a smear.

import { money } from '../../core/format';
import type { Tone } from '../../core/sim/events';

/** How long a floater shows, in seconds. */
export const FLOAT_LIFE = 1.5;

/** How far apart, in tiles, two floaters may start and still be taken as one place. */
export const NEAR = 1.2;

/** How young a floater must be, in seconds, for a new amount nearby to be added to it rather than shown beside it. */
export const MERGE_FOR = 0.6;

/** Text that drifts up from a point in the world. */
export interface Floater {
  id: number;
  text: string;
  kind: Tone;
  /** Where in the world it rises from, in tiles. */
  x: number;
  y: number;
  /** Seconds since it appeared. */
  age: number;
  /** The amount of money it says, when it says one, so another nearby can be added to it. */
  amount: number | null;
  /** Which row it takes above the spot, so floaters close together stack rather than overlap. */
  row: number;
}

/** The amount of money a floater's words say, such as "+$1,200" or "-$40", or null for other words. */
export function amountOf(text: string): number | null {
  const m = /^([+-]?)\$([\d,]+)$/.exec(text);
  if (!m?.[2]) return null;
  const n = Number(m[2].replace(/,/g, ''));
  return m[1] === '-' ? -n : n;
}

/** An amount as a floater says it: "+$1,200" earned, "-$40" spent. */
export function amountText(n: number): string {
  return n < 0 ? money(n) : `+${money(n)}`;
}

/**
 * The floaters with a new one added. Money close by a young floater of money the same way round is added to it, which
 * starts again; anything else close by takes the next row up.
 */
export function addFloater(list: readonly Floater[], f: Floater): Floater[] {
  const near = list.filter((o) => Math.hypot(o.x - f.x, o.y - f.y) <= NEAR);
  const same = near.find(
    (o) =>
      o.age <= MERGE_FOR &&
      o.kind === f.kind &&
      o.amount !== null &&
      f.amount !== null &&
      Math.sign(o.amount) === Math.sign(f.amount),
  );
  const before = same?.amount ?? null;
  if (same && before !== null && f.amount !== null) {
    const amount = before + f.amount;
    return list.map((o) => (o === same ? { ...o, amount, text: amountText(amount), age: 0 } : o));
  }
  const taken = new Set(near.map((o) => o.row));
  let row = 0;
  while (taken.has(row)) row++;
  return [...list, { ...f, row }];
}

/** The floaters `dt` seconds on, without those that have run their course. */
export function ageFloaters(list: readonly Floater[], dt: number): Floater[] {
  return list.map((f) => ({ ...f, age: f.age + dt })).filter((f) => f.age < FLOAT_LIFE);
}
