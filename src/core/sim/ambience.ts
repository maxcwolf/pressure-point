// How pleasant the place is: decor, litter, grime and the prestige of each room.

import {
  DECOR_BOOST,
  DECOR_CALM,
  DECOR_FADE,
  DECOR_RADIUS,
  DIRT_FILTHY,
  FILTHY_DECOR,
  isWatered,
  ITEMS,
  type ItemType,
  WINDOW_MAX_BONUS,
} from '../data';
import { extraTiles } from '../resize';
import type { Item, Room } from '../state/types';
import { at, clamp } from '../util';
import { itemCenter, type World } from '../world';
import type { SimContext } from './context';

/** How many tiles an item's decor reaches. */
export const decorReach = (type: ItemType) => ITEMS[type].reach ?? DECOR_RADIUS;

/**
 * Add pleasantness around a tile, fading with distance out to a radius, to nothing at `fade` tiles: walls do not stop
 * it.
 */
function spread(world: World, grid: Float32Array, cx: number, cy: number, amount: number, R: number, fade: number) {
  for (let y = cy - R; y <= cy + R; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      if (!world.onMap(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      const i = world.idx(x, y);
      if (d <= R) grid[i] = at(grid, i) + amount * (1 - d / fade);
    }
  }
}

/**
 * Add an item's decor around the middle of it: good decor a little stronger, across the item's own reach and fading
 * gently; a wilted plant or filthy furniture as far as litter, and fading as fast.
 */
export function spreadDecor(world: World, grid: Float32Array, type: ItemType, cx: number, cy: number, decor: number) {
  if (decor > 0) {
    const R = decorReach(type);
    spread(world, grid, cx, cy, decor * DECOR_BOOST, R, R + DECOR_FADE);
  } else spread(world, grid, cx, cy, decor, DECOR_RADIUS, DECOR_RADIUS + 1);
}

/** Work out afresh how pleasant each tile is. */
export function updateAmbience(ctx: SimContext) {
  const grid = ctx.attract;
  const { world } = ctx;
  grid.fill(0);
  for (const it of ctx.s.items) {
    const decor = decorOf(it);
    if (!decor) continue;
    const [cx, cy] = itemCenter(it);
    spreadDecor(world, grid, it.type, Math.floor(cx), Math.floor(cy), decor);
  }
  for (const l of ctx.s.litter) spread(world, grid, l.x, l.y, -2.5, DECOR_RADIUS, DECOR_RADIUS + 1);
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

/** Patience drains slower in pleasant surroundings and faster in grim ones. `extra` is pleasantness not yet placed. */
export function drainFactor(ctx: SimContext, x: number, y: number, extra = 0): number {
  const here = ctx.world.onMap(x, y) ? at(ctx.attract, ctx.world.idx(x, y)) : 0;
  return clamp(1.12 - (here + extra) * DECOR_CALM, 0.7, 1.4);
}

/** What a room's prestige is made of: points for floor beyond the smallest, decor, daylight and litter, and the score. */
export interface PrestigeTerms {
  size: number;
  decor: number;
  windows: number;
  /** Points taken off for litter, as a positive number. */
  litter: number;
  score: number;
  /** The prestige the score comes to, one to five. */
  level: number;
}

/** How many points of score each star of prestige takes. */
export const PRESTIGE_STEP = 3;

/** The terms a room's prestige is made of. `extra` is decor not yet placed in it. */
export function prestigeTerms(ctx: SimContext, room: Room, extra = 0): PrestigeTerms {
  const size = extraTiles(room.type, room) * 0.4;
  let decor = extra;
  for (const it of ctx.s.items) if (ctx.world.zoneAt(it.x, it.y) === room.id) decor += decorOf(it);
  let litter = 0;
  for (const l of ctx.s.litter) if (ctx.world.zoneAt(l.x, l.y) === room.id) litter += 2;
  // daylight helps, up to a point
  const windows = Math.min(room.windows.length, WINDOW_MAX_BONUS) * 1.5;
  const score = size + decor + windows - litter;
  return { size, decor, windows, litter, score, level: clamp(1 + Math.floor(score / PRESTIGE_STEP), 1, 5) };
}

/** One to five, from how roomy and how nicely furnished a room is. `extra` is decor not yet placed in it. */
export function prestige(ctx: SimContext, room: Room, extra = 0): number {
  return prestigeTerms(ctx, room, extra).level;
}
