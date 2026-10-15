// Something that carries from a spot to the tiles around it, fading with distance and held back by the walls of the
// rooms it passes out of and into: noise, and warmth or cool.

import type { Room } from '../state/types';
import { at } from '../util';
import { inBounds, tileIdx } from '../world';
import type { SimContext } from './context';

/** How much of what carries gets through a room's walls, from 0 (none) to 1 (all of it). */
export type Leak = (room: Room) => number;

/** How much of something carries from one zone into another: all of it within one, less through each room's walls. */
export function carry(ctx: SimContext, from: number, to: number, leak: Leak): number {
  if (from === to) return 1;
  const a = ctx.world.room(from);
  const b = ctx.world.room(to);
  return (a ? leak(a) : 1) * (b ? leak(b) : 1);
}

/** Add an amount around a tile into a grid, fading with distance out to a radius and held back by walls. */
export function spreadInto(
  ctx: SimContext,
  grid: Float32Array,
  cx: number,
  cy: number,
  amount: number,
  radius: number,
  leak: Leak,
) {
  if (!inBounds(cx, cy)) return;
  const from = ctx.world.zoneAt(cx, cy);
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!inBounds(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius) continue;
      const i = tileIdx(x, y);
      grid[i] = at(grid, i) + amount * (1 - d / (radius + 1)) * carry(ctx, from, ctx.world.zoneAt(x, y), leak);
    }
  }
}

/** The value of a grid at a tile, or a fallback off the map. */
export const gridAt = (grid: Float32Array, x: number, y: number, fallback = 0) =>
  inBounds(x, y) ? at(grid, tileIdx(x, y)) : fallback;
