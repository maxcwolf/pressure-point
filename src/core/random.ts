// The game's random numbers. Each game keeps its own stream in its state, so a saved game carries on drawing the
// numbers it would have drawn had it never been saved, and two games never draw from each other's.

import { at } from './util';

/** Somewhere random numbers are drawn from: a game's state keeps one, saved along with everything else. */
export interface Rng {
  /** Where the stream has got to. */
  rng: number;
}

/** A stream of random numbers starting from a seed. */
export const stream = (seed: number): Rng => ({ rng: seed >>> 0 });

/** Mulberry32: a small seedable generator, uniform in [0, 1). */
export function random(r: Rng): number {
  r.rng = (r.rng + 0x6d2b79f5) >>> 0;
  let t = r.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Where new games' streams start: different every time the game is run, unless a test seeds it. */
const seeds = stream(Math.random() * 2 ** 32);

/**
 * Reseed a stream: by default the one the next new game starts from, which then starts from exactly this seed. Tests
 * use this to get repeatable runs.
 */
export function setSeed(n: number, r: Rng = seeds) {
  r.rng = n >>> 0;
}

/**
 * The seed for a new game's stream. The next game's is mixed out of this one, so games started one after another do
 * not draw the same numbers a step apart.
 */
export function newSeed(): number {
  const seed = seeds.rng;
  seeds.rng = (random(stream(seed)) * 2 ** 32) >>> 0;
  return seed;
}

/** A random number from 0 up to a, or from a up to b when both are given. */
export const rnd = (r: Rng, a = 1, b?: number) => (b === undefined ? random(r) * a : a + random(r) * (b - a));

/** A random whole number from a to b, both included. */
export const irnd = (r: Rng, a: number, b: number) => Math.floor(rnd(r, a, b + 1));

/** A random element of a list. */
export const pick = <T>(r: Rng, arr: readonly T[]): T => at(arr, Math.floor(random(r) * arr.length));

/**
 * A random element of a list that is not among the most recent picks, which are noted in `recent`. Half the list
 * is held back at a time, so at least that many others come up before any one comes up again.
 */
export function pickFresh<T>(r: Rng, arr: readonly T[], recent: T[]): T {
  const fresh = arr.filter((x) => !recent.includes(x));
  const chosen = pick(r, fresh.length ? fresh : arr);
  recent.push(chosen);
  while (recent.length > Math.floor(arr.length / 2)) recent.shift();
  return chosen;
}
