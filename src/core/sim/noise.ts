// Calm: arcades, pool tables, snack machines and crowds make noise that carries as decor does, though a room's walls
// keep much of it out, and less with every window. Noise at a treatment table lowers results and spoils the visit.

import {
  CROWD_NOISE,
  ITEMS,
  MAX_LEAK,
  NOISE_LOUD,
  NOISE_NOTICE,
  NOISE_PEACEFUL,
  NOISE_PENALTY,
  NOISE_RADIUS,
  STRESSED_NOISE,
  WALL_DAMPING,
  WINDOW_LEAK,
} from '../data';
import type { Guest, Item, Room } from '../state/types';
import { clamp } from '../util';
import { itemCenter } from '../world';
import type { SimContext } from './context';
import { feel } from './feelings';
import { playingFor } from './sessions';
import { gridAt, spreader } from './spread';

/** How much of the noise outside a room gets in through its walls: more with each window, up to a point. */
export const noiseLeak = (room: Room) => Math.min(MAX_LEAK, WALL_DAMPING + room.windows.length * WINDOW_LEAK);

/** The noise a guest makes: a murmur from anyone about the place, more from someone stressed, none from the table. */
export function guestNoise(g: Guest): number {
  if (g.state === 'leaving' || g.state === 'served') return 0;
  return g.stressed ? STRESSED_NOISE : CROWD_NOISE;
}

/** Whether an item that sounds in a group session is sounding now: a session is playing in its room. */
export const sessionHeard = (ctx: SimContext, it: Item) => playingFor(ctx, it);

/** Work out afresh how noisy each tile is. */
export function updateNoise(ctx: SimContext) {
  const grid = ctx.noise;
  grid.fill(0);
  const spread = spreader(ctx, noiseLeak);
  for (const it of ctx.s.items) {
    const { noise, sessionNoise } = ITEMS[it.type];
    const [cx, cy] = itemCenter(it);
    if (noise) spread(grid, Math.floor(cx), Math.floor(cy), noise, NOISE_RADIUS);
    // a gong is part of the treatment in its own room, and only noise to everyone else
    if (sessionNoise && sessionHeard(ctx, it))
      spread(grid, Math.floor(cx), Math.floor(cy), sessionNoise, NOISE_RADIUS, 0);
  }
  for (const g of ctx.s.guests) {
    const noise = guestNoise(g);
    if (noise) spread(grid, g.tx, g.ty, noise, NOISE_RADIUS);
  }
}

/** How noisy a tile is, never below silence. */
export const noiseAt = (ctx: SimContext, x: number, y: number) => Math.max(0, gridAt(ctx.noise, x, y));

/** How noisy it is at an item, from the middle of it. */
export function itemNoise(ctx: SimContext, it: Item): number {
  const [cx, cy] = itemCenter(it);
  return noiseAt(ctx, Math.floor(cx), Math.floor(cy));
}

/** How much noise takes off the chance of a treatment working: nothing in silence, the most once it is loud. */
export const noisePenalty = (noise: number) => clamp(noise / NOISE_LOUD, 0, 1) * NOISE_PENALTY;

/** How calm a spot is, from 1 in silence to 0 once it is loud. */
export const calmness = (noise: number) => clamp(1 - noise / NOISE_LOUD, 0, 1);

/** What a guest on the table makes of the noise: put out if it is noisy, pleased if it is peaceful. */
export function feelNoise(g: Guest, noise: number) {
  if (noise >= NOISE_NOTICE) feel(g, 'noisy');
  else if (noise <= NOISE_PEACEFUL) feel(g, 'peaceful');
}
