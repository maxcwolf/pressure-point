// Pathfinding: the way from one tile to another, the tiles reachable on foot, where someone can stand, and whether
// everything that needs reaching can be reached. Each one steps over the world's grids, or a what-if's, as
// `World.canStep` allows.

import { ITEMS, SIDEWALK_Y } from './data';
import { entranceSteps } from './footprint';
import type { Waypoint } from './state/types';
import { at } from './util';
import { accessTile, type Grid, type Trial, type World } from './world';

/** Steps to the eight neighbors, with the distance each one covers. The first four are the straight ones. */
const DIRS8: readonly (readonly [dx: number, dy: number, cost: number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];
const DIRS4 = DIRS8.slice(0, 4);
/** How many tiles out from a spot to look for somewhere to stand. */
const STAND_SEARCH = 160;

/** What pathfinding keeps from one call to the next, one for each world: the search's grids, and the spots found. */
export class Pathfinder {
  readonly g: Float32Array;
  readonly f: Float64Array;
  readonly came: Int32Array;
  /** 1 for a tile on the open list, 2 for one done with, in the search numbered in `marked`; else not yet seen. */
  readonly state: Uint8Array;
  /** Which search last marked each tile, so a new search need not clear the marks of the last. */
  readonly marked: Uint32Array;
  search = 0;
  /** Standing spots already worked out, by tile and count, while the grids stay as they were. */
  readonly spots = new Map<number, readonly [number, number][]>();
  spotsStamp = -1;

  constructor(tiles: number) {
    this.g = new Float32Array(tiles);
    this.f = new Float64Array(tiles);
    this.came = new Int32Array(tiles);
    this.state = new Uint8Array(tiles);
    this.marked = new Uint32Array(tiles);
  }
}

/** A* over the tile grid. The start tile may itself be blocked. Returns tile-center waypoints. */
export function findPath(world: World, sx: number, sy: number, gx: number, gy: number): Waypoint[] | null {
  if (!world.onMap(sx, sy) || !world.walkable(gx, gy)) return null;
  if (sx === gx && sy === gy) return [];
  // a single step to the next tile along is what the search would find, the shortest way there being that step
  if (Math.abs(gx - sx) + Math.abs(gy - sy) === 1 && world.canStep(sx, sy, gx, gy)) return [[gx + 0.5, gy + 0.5, 0]];
  const pf = world.pathfinder;
  const { g, f, came, state, marked } = pf;
  const search = ++pf.search;
  /** Where a tile stands in this search: 0 not yet seen, 1 on the open list, 2 done with. */
  const stateOf = (i: number) => (marked[i] === search ? at(state, i) : 0);
  /** Mark where a tile stands in this search. */
  const mark = (i: number, v: number) => {
    marked[i] = search;
    state[i] = v;
  };
  const start = world.idx(sx, sy);
  const goal = world.idx(gx, gy);
  const open: number[] = [start];
  g[start] = 0;
  f[start] = 0;
  mark(start, 1);
  while (open.length) {
    // take the most promising tile off the open list: the first of any that are as promising as each other
    let bi = 0;
    let best = Infinity;
    for (let i = 0; i < open.length; i++) {
      const score = at(f, at(open, i));
      if (score < best) {
        best = score;
        bi = i;
      }
    }
    const cur = at(open, bi);
    open[bi] = at(open, open.length - 1);
    open.pop();
    if (cur === goal) break;
    mark(cur, 2);
    const cx = cur % world.w;
    const cy = (cur - cx) / world.w;
    for (const [dx, dy, cost] of DIRS8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!world.onMap(nx, ny)) continue;
      const n = world.idx(nx, ny);
      const seen = stateOf(n);
      if (seen === 2) continue;
      if (dx && dy) {
        if (
          !world.canStep(cx, cy, nx, cy) ||
          !world.canStep(nx, cy, nx, ny) ||
          !world.canStep(cx, cy, cx, ny) ||
          !world.canStep(cx, ny, nx, ny)
        )
          continue;
      } else if (!world.canStep(cx, cy, nx, ny)) continue;
      const ng = at(g, cur) + cost;
      if (seen === 1 && ng >= at(g, n)) continue;
      g[n] = ng;
      came[n] = cur;
      // the distance so far, and a lower bound on the distance left to the goal, allowing diagonal steps
      const hx = Math.abs(nx - gx);
      const hy = Math.abs(ny - gy);
      f[n] = ng + (Math.max(hx, hy) + (Math.SQRT2 - 1) * Math.min(hx, hy));
      if (seen !== 1) {
        mark(n, 1);
        open.push(n);
      }
    }
  }
  if (stateOf(goal) === 0) return null;
  const path: Waypoint[] = [];
  let c = goal;
  while (c !== start) {
    const x = c % world.w;
    path.push([x + 0.5, (c - x) / world.w + 0.5, 0]);
    c = at(came, c);
  }
  return path.reverse();
}

/** Tiles reachable on foot from a start tile, in breadth-first order, in the game or on the grids `g` of a what-if. */
export function flood(
  world: World,
  sx: number,
  sy: number,
  limit = world.w * world.h,
  g: Grid = world,
): [number, number][] {
  const seen = new Uint8Array(world.w * world.h);
  const out: [number, number][] = [];
  if (!world.onMap(sx, sy)) return out;
  // a queue of tile indexes read from the front, as taking from the front of an array moves everything behind it
  const queue = new Int32Array(world.w * world.h);
  let head = 0;
  let tail = 0;
  queue[tail++] = world.idx(sx, sy);
  seen[world.idx(sx, sy)] = 1;
  while (head < tail && out.length < limit) {
    const i = at(queue, head++);
    const x = i % world.w;
    const y = (i - x) / world.w;
    out.push([x, y]);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.onMap(nx, ny) || seen[world.idx(nx, ny)]) continue;
      if (!world.canStep(x, y, nx, ny, g)) continue;
      seen[world.idx(nx, ny)] = 1;
      queue[tail++] = world.idx(nx, ny);
    }
  }
  return out;
}

/**
 * Free standing spots near a tile: same zone, not blocking a doorway or an access spot. They depend only on the
 * grids, so each is worked out once and kept until the grids next change; the list is shared, so it is read-only.
 */
export function standSpots(world: World, x: number, y: number, count: number): readonly [number, number][] {
  const pf = world.pathfinder;
  if (pf.spotsStamp !== world.stamp) {
    pf.spots.clear();
    pf.spotsStamp = world.stamp;
  }
  if (!world.onMap(x, y)) return [];
  // the search stops 160 tiles out, so asking for more than that finds the same
  const key = world.idx(x, y) * (STAND_SEARCH + 1) + Math.min(count, STAND_SEARCH);
  let found = pf.spots.get(key);
  if (!found) {
    const z = world.zoneAt(x, y);
    found = flood(world, x, y, STAND_SEARCH)
      .filter(([tx, ty]) => world.zone[world.idx(tx, ty)] === z && !world.reserved[world.idx(tx, ty)])
      .slice(0, count);
    pf.spots.set(key, found);
  }
  return found;
}

/** Everything that needs reaching can be reached from the street: in the game as it is, or in a what-if. */
export function connected(world: World, t: Trial = world.asIs()): boolean {
  const seen = new Uint8Array(world.w * world.h);
  for (const [x, y] of flood(world, 0, SIDEWALK_Y, undefined, t)) seen[world.idx(x, y)] = 1;
  /** Whether a tile was reached from the street. */
  const need = (x: number, y: number) => world.onMap(x, y) && seen[world.idx(x, y)] === 1;
  if (!need(world.w - 1, SIDEWALK_Y)) return false;
  // through every door: to the tile just outside, and the one past the tile inside
  for (const e of world.building.entrances)
    for (const {
      inside: [x, y],
      outside: [ox, oy],
    } of entranceSteps(e))
      if (!need(ox, oy) || !need(2 * x - ox, 2 * y - oy)) return false;
  for (const r of t.rooms) {
    if (!need(r.door.x, r.door.y) || !need(r.door.x + r.door.dx, r.door.y + r.door.dy)) return false;
  }
  for (const it of t.items) {
    for (let i = 0; i < ITEMS[it.type].access.length; i++) {
      const [x, y] = accessTile(it, i);
      if (!need(x, y)) return false;
    }
  }
  /**
   * Whether someone on a tile inside can get out to the street: from the tile itself, or if it is the one being
   * built on, by stepping off it onto one that is reached, not through a wall.
   */
  const free = (x: number, y: number) =>
    !world.inside(x, y) ||
    (world.walkable(x, y, t)
      ? need(x, y)
      : DIRS4.some(([dx, dy]) => need(x + dx, y + dy) && world.canStep(x, y, x + dx, y + dy, t)));
  // nobody already inside may be walled in, on the tile they stand on or the one they are stepping into, as they
  // may already be partway across into it and set off again from there
  for (const c of [...world.s.guests, ...world.s.staff, ...world.s.visitors]) {
    if (!free(c.tx, c.ty)) return false;
    const ahead = c.path?.[0];
    if (ahead && !ahead[2] && !free(Math.floor(ahead[0]), Math.floor(ahead[1]))) return false;
  }
  return true;
}
