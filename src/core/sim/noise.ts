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
import { at, clamp } from '../util';
import { itemCenter } from '../world';
import type { SimContext } from './context';
import { feel } from './feelings';
import { rattling, running } from './machines';
import { playingFor } from './sessions';
import { gridAt, spreader } from './spread';

/** How much of the noise outside a room gets in through its walls: more with each window, up to a point. */
export const noiseLeak = (room: Room) => Math.min(MAX_LEAK, WALL_DAMPING + room.windows.length * WINDOW_LEAK);

/** The noise a guest makes: a murmur from anyone about the place, more from someone stressed, none lying down. */
export function guestNoise(g: Guest): number {
  if (g.state === 'leaving' || g.state === 'served' || g.state === 'resting') return 0;
  return g.stressed ? STRESSED_NOISE : CROWD_NOISE;
}

/** Whether an item that sounds in a group session is sounding now: a session is playing in its room. */
export const sessionHeard = (ctx: SimContext, it: Item) => playingFor(ctx, it);

/** Work out afresh how noisy each tile is. */
export function updateNoise(ctx: SimContext) {
  const grid = ctx.noise;
  grid.fill(0);
  // the outer walls hold noise back as a room's do, between the buildings and out of doors
  const spread = spreader(ctx, noiseLeak, WALL_DAMPING);
  for (const it of ctx.s.items) {
    const { noise, sessionNoise } = ITEMS[it.type];
    const [cx, cy] = itemCenter(it);
    if (noise) spread(grid, Math.floor(cx), Math.floor(cy), noise, NOISE_RADIUS);
    // a gong is part of the treatment in its own room, and only noise to everyone else
    if (sessionNoise && sessionHeard(ctx, it))
      spread(grid, Math.floor(cx), Math.floor(cy), sessionNoise, NOISE_RADIUS, 0);
    // and so is a machine with someone inside it
    const runNoise = ITEMS[it.type].machine?.runNoise;
    if (runNoise && running(it)) spread(grid, Math.floor(cx), Math.floor(cy), runNoise, NOISE_RADIUS, 0);
  }
  for (const g of ctx.s.guests) {
    const noise = guestNoise(g);
    if (noise) spread(grid, g.tx, g.ty, noise, NOISE_RADIUS);
  }
  for (const it of ctx.s.items) {
    const rattle = ITEMS[it.type].machine?.rattle;
    const home = rattle ? ctx.world.roomOfItem(it) : undefined;
    if (!rattle || !home) continue;
    for (const room of rattling(ctx, it)) rattleRoom(ctx, grid, room, home, rattle);
  }
}

/**
 * Shake noise through the wall a room shares with a rattling machine's own: as loud as the rattle along that wall, and
 * fading across the room as noise fades over the tiles it carries.
 */
function rattleRoom(ctx: SimContext, grid: Float32Array, room: Room, from: Room, amount: number) {
  const { world } = ctx;
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++) {
      if (world.zoneAt(x, y) !== room.id) continue;
      // how many tiles in from the shared wall: 1 beside it
      const dx = Math.max(from.x - x, 0, x - (from.x + from.w - 1));
      const dy = Math.max(from.y - y, 0, y - (from.y + from.h - 1));
      const share = 1 - (Math.max(dx, dy) - 1) / (NOISE_RADIUS + 1);
      if (share <= 0) continue;
      const i = world.idx(x, y);
      grid[i] = at(grid, i) + amount * share;
    }
}

/** How noisy a tile is, never below silence. `extra` is noise not yet placed. */
export const noiseAt = (ctx: SimContext, x: number, y: number, extra = 0) =>
  Math.max(0, gridAt(ctx.world, ctx.noise, x, y) + extra);

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
