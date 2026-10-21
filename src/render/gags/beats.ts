// The small sums gags are written with: how far through a stretch of the session it is, eased, and bumps and wobbles.

import { clamp } from '../../core/util';
import type { GagFrame, GagInput, GagScript } from './types';

/** How far through the stretch from `a` to `b` a value is, from 0 to 1. */
export const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);

/** Eased in and out. */
export const smooth = (x: number) => x * x * (3 - 2 * x);

/** Eased from `a` to `b`, from 0 to 1. */
export const ease = (p: number, a: number, b: number) => smooth(span(p, a, b));

/** Up from 0 to 1 and back down over the stretch from `a` to `b`, and 0 outside it. */
export const bump = (p: number, a: number, b: number) => (p <= a || p >= b ? 0 : Math.sin(span(p, a, b) * Math.PI));

/** Whether a value is in the stretch from `a` up to `b`. */
export const within = (p: number, a: number, b: number) => p >= a && p < b;

/** A wobble of a size, so many times a second. */
export const wobble = (t: number, size: number, rate: number, phase = 0) =>
  Math.sin(t * rate * Math.PI * 2 + phase) * size;

/** A frame with nothing moved. */
export const still = (): GagFrame => ({ parts: {}, guest: {}, emit: {} });

/** Whether a session plays its machine's fake failure: settled by the two ids alone, never the game's dice. */
export function hiccupOf(itemId: number, guestId: number, chance: number): boolean {
  let h = Math.imul(itemId, 73856093) ^ Math.imul(guestId, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 0x100000000 < chance;
}

/** A gag's frame, with the smoke and sparks every machine shows when it is worn or down added in. */
export function gagFrame(script: GagScript, input: GagInput): GagFrame {
  const f = script.frame(input);
  if (input.smoking) f.emit.smoke = Math.max(f.emit.smoke ?? 0, 0.7);
  if (input.down) f.emit.sparks = Math.max(f.emit.sparks ?? 0, 0.6);
  return f;
}
