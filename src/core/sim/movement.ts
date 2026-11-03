// Walking: setting off for a tile, moving along the path and stopping.

import type { Char, Item, Waypoint } from '../state/types';
import { clamp } from '../util';
import { footprint, type PosePoint } from '../world';
import type { SimContext } from './context';

/** Turn an angle toward a target by at most `maxStep`, going the short way around. */
export function turnToward(cur: number, target: number, maxStep: number) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + clamp(d, -maxStep, maxStep);
}

/** Whether someone could walk from where they stand to a tile, without setting off. */
export function canWalkTo(ctx: SimContext, c: Char, tx: number, ty: number): boolean {
  return !!ctx.world.findPath(c.tx, c.ty, tx, ty);
}

/** Set someone walking to a tile, optionally ending in a pose there. False if there is no way. */
export function goTo(ctx: SimContext, c: Char, tx: number, ty: number, pp?: PosePoint): boolean {
  let sx = c.tx;
  let sy = c.ty;
  const ahead = c.path?.[0];
  if (ahead && !ahead[2]) {
    const [wx, wy] = ahead;
    if (Math.hypot(wx - c.x, wy - c.y) < 0.5) {
      sx = Math.floor(wx);
      sy = Math.floor(wy);
    }
  }
  const p = ctx.world.findPath(sx, sy, tx, ty);
  if (!p) return false;
  const path: Waypoint[] = [];
  if (Math.hypot(sx + 0.5 - c.x, sy + 0.5 - c.y) > 0.05) path.push([sx + 0.5, sy + 0.5, 0]);
  for (const wp of p) path.push(wp);
  if (pp) {
    path.push([pp.x, pp.y, 1]);
    c.endPose = pp.pose;
    c.endH = pp.h;
    c.endFace = pp.face;
  }
  c.dest = pp ? [tx, ty, pp.x, pp.y, 1] : [tx, ty, 0, 0, 0];
  c.path = path;
  c.pose = 'walk';
  c.h = 0;
  c.busy = false;
  return true;
}

/** Advance along the current path. Returns true on the tick the path completes. */
export function moveAlong(c: Char, dt: number, speed: number): boolean {
  if (!c.path) return false;
  let remaining = speed * dt;
  for (let next = c.path[0]; next && remaining > 0; next = c.path[0]) {
    const [wx, wy, isPose] = next;
    const dx = wx - c.x;
    const dy = wy - c.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-3) c.facing = turnToward(c.facing, Math.atan2(dx, dy), dt * 14);
    if (d <= remaining) {
      c.x = wx;
      c.y = wy;
      remaining -= d;
      c.path.shift();
      if (isPose) {
        c.pose = c.endPose;
        c.h = c.endH;
        c.facing = c.endFace;
      } else {
        c.tx = Math.floor(wx);
        c.ty = Math.floor(wy);
      }
    } else {
      c.x += (dx / d) * remaining;
      c.y += (dy / d) * remaining;
      remaining = 0;
    }
  }
  if (!c.path.length) {
    c.path = null;
    c.dest = null;
    if (c.pose === 'walk') c.pose = 'stand';
    return true;
  }
  return false;
}

/** Stop someone where they stand. */
export function halt(c: Char) {
  c.path = null;
  c.dest = null;
  c.busy = false;
  c.pose = 'stand';
  c.h = 0;
}

/** The four tiles beside a tile, for standing next to something. */
const BESIDE: readonly (readonly [dx: number, dy: number])[] = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
];

/**
 * Set someone walking to stand next to an item, on whichever side can be reached, and on the same side of the
 * building's walls, passing over any tile `free` turns down. False if no side can be reached.
 */
export function standBeside(
  ctx: SimContext,
  c: Char,
  item: Item,
  free: (x: number, y: number) => boolean = () => true,
): boolean {
  const indoors = ctx.world.inside(item.x, item.y);
  for (const [fx, fy] of footprint(item)) {
    for (const [dx, dy] of BESIDE) {
      const [bx, by] = [fx + dx, fy + dy];
      if (!free(bx, by)) continue;
      if (ctx.world.walkable(bx, by) && ctx.world.inside(bx, by) === indoors && goTo(ctx, c, bx, by)) return true;
    }
  }
  return false;
}
