// What makes a center different to run: for now, rush hours.

import { centerOf, DAY_SECONDS } from '../data';
import type { SimContext } from './context';
import { emit } from './events';

/** The rush hours, as parts of each day: before work and after it. */
export const RUSH_WINDOWS: readonly (readonly [start: number, end: number])[] = [
  [0.05, 0.22],
  [0.68, 0.85],
];

/** Whether a moment of the game falls in a rush hour. */
export function inRush(day: number): boolean {
  const t = day - Math.floor(day);
  return RUSH_WINDOWS.some(([a, b]) => t >= a && t < b);
}

/** How much faster than usual guests arrive at a moment: more in a rush hour, fewer between them. */
export function arrivalFactor(ctx: SimContext): number {
  const rush = centerOf(ctx.s).rush;
  if (!rush) return 1;
  return inRush(ctx.s.day) ? rush.peak : rush.lull;
}

/** How much faster than usual waiting guests lose patience here. */
export function impatience(ctx: SimContext): number {
  return centerOf(ctx.s).rush?.impatience ?? 1;
}

/** Announce each rush hour as it starts. */
export function updateTwists(ctx: SimContext, dt: number) {
  const s = ctx.s;
  if (!s.open || !centerOf(s).rush) return;
  if (inRush(s.day) && !inRush(s.day - dt / DAY_SECONDS))
    emit(ctx, { type: 'announce', text: 'Rush hour! A crowd of desk workers is on its way.' });
}
