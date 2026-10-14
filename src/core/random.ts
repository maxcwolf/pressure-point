// The game's random numbers. Seedable, so tests can repeat a run exactly.

import { at } from './util';

let seed = (Math.random() * 2 ** 32) >>> 0;

/** Reseed the game's random numbers. Tests use this to get repeatable runs. */
export function setSeed(n: number) {
  seed = n >>> 0;
}

/** Mulberry32: a small seedable generator, uniform in [0, 1). */
export function random(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A random number from 0 up to a, or from a up to b when both are given. */
export const rnd = (a = 1, b?: number) => (b === undefined ? random() * a : a + random() * (b - a));

/** A random whole number from a to b, both included. */
export const irnd = (a: number, b: number) => Math.floor(rnd(a, b + 1));

/** A random element of a list. */
export const pick = <T>(arr: readonly T[]): T => at(arr, Math.floor(random() * arr.length));

/**
 * A random element of a list that is not among the most recent picks, which are noted in `recent`. Half the list
 * is held back at a time, so at least that many others come up before any one comes up again.
 */
export function pickFresh<T>(arr: readonly T[], recent: T[]): T {
  const fresh = arr.filter((x) => !recent.includes(x));
  const chosen = pick(fresh.length ? fresh : arr);
  recent.push(chosen);
  while (recent.length > Math.floor(arr.length / 2)) recent.shift();
  return chosen;
}
