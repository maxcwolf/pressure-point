// Something that carries from a spot to the tiles around it, fading with distance and held back by the walls of the
// rooms it passes out of and into: noise, and warmth or cool.

import type { Room } from '../state/types';
import { at } from '../util';
import type { World } from '../world';
import type { SimContext } from './context';

/** How much of what carries gets through a room's walls, from 0 (none) to 1 (all of it). */
export type Leak = (room: Room) => number;

/** How much of what spreads reaches each tile of the square around a spot, by radius: 0 beyond the radius itself. */
const kernels = new Map<number, Float64Array>();

/** The share of what spreads from a spot that reaches each tile of the square around it, out to a radius. */
function kernel(radius: number): Float64Array {
  let k = kernels.get(radius);
  if (!k) {
    const side = radius * 2 + 1;
    k = new Float64Array(side * side);
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const d = Math.hypot(dx, dy);
        k[(dy + radius) * side + dx + radius] = d > radius ? 0 : 1 - d / (radius + 1);
      }
    kernels.set(radius, k);
  }
  return k;
}

/**
 * Something spread from a spot into a grid: an amount, fading with distance out to a radius. `inside` is the share
 * that carries within the spot's own room or corridor: all of it, unless it is only to be heard outside.
 */
export type Spread = (
  grid: Float32Array,
  cx: number,
  cy: number,
  amount: number,
  radius: number,
  inside?: number,
) => void;

/**
 * A way to spread something into a grid, held back by the walls of the rooms it passes out of and into: all of it
 * carries within one zone, and from one into another as much as both rooms' walls let through. What each tile's walls
 * let through is worked out once, so a spreader is for the rooms as they are now.
 */
export function spreader(ctx: SimContext, leak: Leak): Spread {
  const { world } = ctx;
  const walls = new Float64Array(world.w * world.h);
  for (let i = 0; i < walls.length; i++) {
    const room = world.room(at(world.zone, i));
    walls[i] = room ? leak(room) : 1;
  }
  return (grid, cx, cy, amount, radius, inside = 1) => {
    if (!world.onMap(cx, cy)) return;
    const from = world.zoneAt(cx, cy);
    const out = at(walls, world.idx(cx, cy));
    const k = kernel(radius);
    const side = radius * 2 + 1;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!world.onMap(x, y)) continue;
        const share = at(k, (y - cy + radius) * side + x - cx + radius);
        if (share === 0) continue;
        const i = world.idx(x, y);
        const carry = at(world.zone, i) === from ? inside : out * at(walls, i);
        grid[i] = at(grid, i) + amount * share * carry;
      }
    }
  };
}

/** The value of a grid at a tile, or a fallback off the map. */
export const gridAt = (world: World, grid: Float32Array, x: number, y: number, fallback = 0) =>
  world.onMap(x, y) ? at(grid, world.idx(x, y)) : fallback;
