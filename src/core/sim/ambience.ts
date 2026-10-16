// How pleasant the place is: decor, litter, grime and the prestige of each room.

import { DECOR_RADIUS, DIRT_FILTHY, FILTHY_DECOR, isWatered, ITEMS, ROOMS, WINDOW_MAX_BONUS } from '../data';
import type { Item, Room } from '../state/types';
import { at, clamp } from '../util';
import { itemCenter } from '../world';
import type { SimContext } from './context';

/** Work out afresh how pleasant each tile is. */
export function updateAmbience(ctx: SimContext) {
  const grid = ctx.attract;
  const { world } = ctx;
  grid.fill(0);
  const R = DECOR_RADIUS;
  /** Add pleasantness around a tile, fading with distance. */
  const spread = (cx: number, cy: number, amount: number) => {
    for (let y = cy - R; y <= cy + R; y++) {
      for (let x = cx - R; x <= cx + R; x++) {
        if (!world.onMap(x, y)) continue;
        const d = Math.hypot(x - cx, y - cy);
        const i = world.idx(x, y);
        if (d <= R) grid[i] = at(grid, i) + amount * (1 - d / (R + 1));
      }
    }
  };
  for (const it of ctx.s.items) {
    const decor = decorOf(it);
    if (!decor) continue;
    const [cx, cy] = itemCenter(it);
    spread(Math.floor(cx), Math.floor(cy), decor);
  }
  for (const l of ctx.s.litter) spread(l.x, l.y, -2.5);
}

/**
 * A wilted plant or a filthy toilet drags its surroundings down instead of lifting them. Stale linens on a table do
 * their harm on the table, not to the room.
 */
export function decorOf(it: Item): number {
  if (isWatered(it.type) && it.water <= 15) return -1;
  if (it.dirt >= DIRT_FILTHY && !ITEMS[it.type].linens) return FILTHY_DECOR;
  return ITEMS[it.type].decor ?? 0;
}

/** Patience drains slower in pleasant surroundings and faster in grim ones. */
export function drainFactor(ctx: SimContext, x: number, y: number): number {
  return clamp(1.12 - (ctx.world.onMap(x, y) ? at(ctx.attract, ctx.world.idx(x, y)) : 0) * 0.035, 0.7, 1.4);
}

/** One to five, from how roomy and how nicely furnished a room is. */
export function prestige(ctx: SimContext, room: Room): number {
  const def = ROOMS[room.type];
  let score = (room.w * room.h - def.minShort * def.minLong) * 0.4;
  for (const it of ctx.s.items) if (ctx.world.zoneAt(it.x, it.y) === room.id) score += decorOf(it);
  for (const l of ctx.s.litter) if (ctx.world.zoneAt(l.x, l.y) === room.id) score -= 2;
  // daylight helps, up to a point
  score += Math.min(room.windows.length, WINDOW_MAX_BONUS) * 1.5;
  return clamp(1 + Math.floor(score / 3), 1, 5);
}
