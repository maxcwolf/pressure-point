// Grid caches derived from the game state: zones, blocking, doors, plus pathfinding. The build rules that read them
// are in build-rules.ts.

import * as rules from './build-rules';
import {
  centerOf,
  H,
  ITEMS,
  type ItemType,
  MISHAPS,
  mishapStopsType,
  type Pose,
  type RoomType,
  SIDEWALK_Y,
} from './data';
import {
  type BuildingWindow,
  buildingWindows,
  doorstep,
  entranceSteps,
  type Footprint,
  footprintOf,
  inFootprint,
  onPath,
} from './footprint';
import { buildingsOf, lotWidth } from './land';
import { byId } from './lookup';
import type { PlacedLayout } from './room-layout';
import { sameSpot } from './state/game';
import type { GameState, Item, Room, WallSpot, Waypoint } from './state/types';
import { at } from './util';

/** Zone ids: -2 scenery (not walkable), -1 outdoors path, 0 corridor, >0 room id. */
export const Z_SCENERY = -2;
export const Z_OUTSIDE = -1;
export const Z_CORRIDOR = 0;

// ---- Item geometry ---------------------------------------------------------
/** Where an item is, or would be: its type, its corner and how it is turned. */
export interface Placed {
  type: ItemType;
  x: number;
  y: number;
  rot: number;
}

/** Rotate a continuous local point (rotation-0 frame) by `rot` quarter turns. */
export function rotPoint(w: number, h: number, rot: number, cx: number, cy: number): [number, number] {
  switch (rot & 3) {
    case 1:
      return [h - cy, cx];
    case 2:
      return [w - cx, h - cy];
    case 3:
      return [cy, w - cx];
    default:
      return [cx, cy];
  }
}
/** Rotate a direction by `rot` quarter turns. */
export function rotVec(rot: number, fx: number, fy: number): [number, number] {
  switch (rot & 3) {
    case 1:
      return [-fy, fx];
    case 2:
      return [-fx, -fy];
    case 3:
      return [fy, -fx];
    default:
      return [fx, fy];
  }
}
/** An item's width and height once rotated. */
export function itemDims(type: ItemType, rot: number): [number, number] {
  const d = ITEMS[type];
  return rot & 1 ? [d.h, d.w] : [d.w, d.h];
}
/** The tiles an item covers. */
export function footprint(it: Placed): [number, number][] {
  const [w, h] = itemDims(it.type, it.rot);
  const out: [number, number][] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([it.x + dx, it.y + dy]);
  return out;
}
/** Whether an item hangs on a wall rather than standing on the floor. */
export const onWall = (type: ItemType) => ITEMS[type].mount === 'wall';
/**
 * The stretches of wall a wall item hangs on: each tile of floor in front of it, and the way out through the wall
 * behind, which is the way it faces turned right round.
 */
export function wallSpotsOf(it: Placed): WallSpot[] {
  const [dx, dy] = rotVec(it.rot, 0, -1);
  return footprint(it).map(([x, y]) => ({ x, y, dx: dx || 0, dy: dy || 0 }));
}
/** Which way a wall item hung on a stretch of wall faces: out from the wall, the way R turns furniture. */
export function rotFacing(spot: Pick<WallSpot, 'dx' | 'dy'>): number {
  if (spot.dy < 0) return 0;
  if (spot.dx > 0) return 1;
  if (spot.dy > 0) return 2;
  return 3;
}
/** The tile someone stands on to use one of an item's access spots. */
export function accessTile(it: Placed, i: number): [number, number] {
  const d = ITEMS[it.type];
  const a = at(d.access, i);
  const [rx, ry] = rotPoint(d.w, d.h, it.rot, a.x + 0.5, a.y + 0.5);
  return [it.x + Math.floor(rx), it.y + Math.floor(ry)];
}
export interface PosePoint {
  x: number;
  y: number;
  face: number;
  pose: Pose;
  h: number;
}
/** Exactly where someone ends up at one of an item's access spots, and how they are posed. */
export function accessPose(it: Placed, i: number): PosePoint {
  const d = ITEMS[it.type];
  const a = at(d.access, i);
  const [rx, ry] = rotPoint(d.w, d.h, it.rot, a.px, a.py);
  const [fx, fy] = rotVec(it.rot, a.face[0], a.face[1]);
  return { x: it.x + rx, y: it.y + ry, face: Math.atan2(fx, fy), pose: a.pose, h: a.h ?? 0 };
}
/** The center point of an item. */
export function itemCenter(it: Placed): [number, number] {
  const [w, h] = itemDims(it.type, it.rot);
  return [it.x + w / 2, it.y + h / 2];
}
/** The middle of an item's front edge, and the way its front faces as `accessPose` gives it, for an item with a front. */
export function frontOf(it: Placed): { x: number; y: number; face: number } | null {
  if (!ITEMS[it.type].front) return null;
  const [cx, cy] = itemCenter(it);
  const [w, h] = itemDims(it.type, it.rot);
  const [dx, dy] = rotVec(it.rot, 0, 1);
  return { x: cx + (dx * w) / 2, y: cy + (dy * h) / 2, face: Math.atan2(dx, dy) };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Check {
  ok: boolean;
  reason: string;
}

/** The grids a way through is worked out on: each tile's zone, what blocks it, what is kept clear, and the doors. */
export interface Grid {
  zone: Int32Array;
  blocked: Uint8Array;
  reserved: Uint8Array;
  doors: Set<number>;
}
/** Where a room is, or would be, as far as the grids care: its floor, its door and its windows. */
export type RoomShape = Pick<Room, 'id' | 'x' | 'y' | 'w' | 'h' | 'door' | 'windows'>;
/** A what-if for the build checks: the rooms and furniture as they would be, and the grids laid out from them. */
export interface Trial extends Grid {
  rooms: readonly RoomShape[];
  items: readonly Placed[];
}

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

export class World {
  /** How wide and deep the map is, in tiles: the center's lot. */
  readonly w: number;
  readonly h = H;
  zone: Int32Array;
  blocked: Uint8Array;
  reserved: Uint8Array;
  doors = new Set<number>();
  /** Bumped on every rebuild so the renderer knows to resync. */
  version = 0;
  /** Bumped on every rebuild, silent ones too, so answers worked out from the grids know when they are stale. */
  private stamp = 0;
  /** Standing spots already worked out, by tile and count, while the grids stay as they were. */
  private spots = new Map<number, readonly [number, number][]>();
  private spotsStamp = -1;
  /** The building's own windows, worked out once for each time the grids change. */
  private panes: BuildingWindow[] = [];
  private panesStamp = -1;
  /** The building alone, before any rooms or furniture: each tile's zone, the tiles kept clear and the doors in. */
  private bare: { zone: Int32Array; reserved: Uint8Array; doors: number[] };
  /** Grids to try a change out on without touching the game or the grids it plays on. */
  private scratch: Grid;

  constructor(public s: GameState) {
    this.w = lotWidth(centerOf(s));
    const tiles = this.w * this.h;
    this.zone = new Int32Array(tiles);
    this.blocked = new Uint8Array(tiles);
    this.reserved = new Uint8Array(tiles);
    this.indoors = new Uint8Array(tiles);
    this.buildingNo = new Uint8Array(tiles);
    this.g = new Float32Array(tiles);
    this.f = new Float64Array(tiles);
    this.came = new Int32Array(tiles);
    this.state = new Uint8Array(tiles);
    this.marked = new Uint32Array(tiles);
    this.bare = { zone: new Int32Array(tiles), reserved: new Uint8Array(tiles), doors: [] };
    this.scratch = {
      zone: new Int32Array(tiles),
      blocked: new Uint8Array(tiles),
      reserved: new Uint8Array(tiles),
      doors: new Set(),
    };
    this.building = footprintOf(centerOf(s).plot);
    this.rebuild();
  }

  /** A tile's position in the flat grid arrays. */
  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  /** Whether a tile is on the map. */
  onMap(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Where this game's building stands on its lot, grown into any land bought, as of the last rebuild. */
  building: Footprint;
  /** One byte a tile, 1 for the tiles inside the building, as of the last rebuild. */
  indoors: Uint8Array;
  /** Which building each tile is in: 0 outdoors, 1 the one with the front door, then 2, 3… those standing apart. */
  buildingNo: Uint8Array;

  /** Which building a tile is in: 0 outdoors or off the map, 1 the one with the front door, then the rest. */
  buildingAt(x: number, y: number): number {
    return this.onMap(x, y) ? at(this.buildingNo, this.idx(x, y)) : 0;
  }

  /** Whether a tile is inside the building. */
  inside(x: number, y: number): boolean {
    return this.onMap(x, y) && this.indoors[this.idx(x, y)] === 1;
  }

  /** A key for the edge between two neighboring tiles. Public for the build rules, as are `tryOut` and `asIs`. */
  edgeKey(ax: number, ay: number, bx: number, by: number) {
    if (ay === by) return this.idx(Math.min(ax, bx), ay) * 2;
    return this.idx(ax, Math.min(ay, by)) * 2 + 1;
  }

  /** Rebuild the zone, blocking, reserved and door grids from the game state. */
  rebuild(silent = false) {
    const { indoors } = this;
    const { zone, reserved } = this.bare;
    reserved.fill(0);
    const doors: number[] = [];
    const fp = buildingsOf(this.s);
    this.building = fp;
    const outside = doorstep(fp);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = this.idx(x, y);
        indoors[i] = inFootprint(fp, x, y) ? 1 : 0;
        let z = Z_SCENERY;
        if (indoors[i]) z = Z_CORRIDOR;
        else if (y === SIDEWALK_Y) z = Z_OUTSIDE;
        else if (fp.door.includes(x) && y >= outside && y < SIDEWALK_Y) z = Z_OUTSIDE;
        else if (onPath(fp, x, y)) z = Z_OUTSIDE;
        zone[i] = z;
      }
    }
    for (const e of fp.entrances)
      for (const {
        inside: [x, y],
        outside: [ox, oy],
      } of entranceSteps(e)) {
        doors.push(this.edgeKey(x, y, ox, oy));
        // the tile inside the door, and the next one in, are kept clear for the way through
        reserved[this.idx(x, y)] = 1;
        if (this.onMap(2 * x - ox, 2 * y - oy)) reserved[this.idx(2 * x - ox, 2 * y - oy)] = 1;
      }
    this.bare.doors = doors;
    this.numberBuildings();
    this.lay(this, this.s.rooms, this.s.items);
    this.stamp++;
    if (!silent) this.version++;
  }

  /** Lay rooms and furniture over the building as it was at the last rebuild, filling in the grids `g`. */
  private lay(g: Grid, rooms: readonly RoomShape[], items: readonly Placed[]) {
    const { zone, blocked, reserved, doors } = g;
    zone.set(this.bare.zone);
    reserved.set(this.bare.reserved);
    blocked.fill(0);
    doors.clear();
    for (const k of this.bare.doors) doors.add(k);
    for (const r of rooms) {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) zone[this.idx(x, y)] = r.id;
      const ox = r.door.x + r.door.dx;
      const oy = r.door.y + r.door.dy;
      doors.add(this.edgeKey(r.door.x, r.door.y, ox, oy));
      reserved[this.idx(r.door.x, r.door.y)] = 1;
      if (this.onMap(ox, oy)) reserved[this.idx(ox, oy)] = 1;
    }
    for (const it of items) {
      // something on a wall is out of everyone's way
      if (onWall(it.type)) continue;
      if (!ITEMS[it.type].walkable)
        for (const [x, y] of footprint(it)) if (this.onMap(x, y)) blocked[this.idx(x, y)] = 1;
      for (let i = 0; i < ITEMS[it.type].access.length; i++) {
        const [x, y] = accessTile(it, i);
        if (this.onMap(x, y)) reserved[this.idx(x, y)] = 1;
      }
    }
  }

  /**
   * Try out the game with these rooms and this furniture, on grids of its own: the game, and the grids it plays on,
   * are left alone. The answer is good until the next one is asked for, which reuses its grids.
   */
  tryOut(rooms: readonly RoomShape[], items: readonly Placed[]): Trial {
    this.lay(this.scratch, rooms, items);
    return { ...this.scratch, rooms, items };
  }

  /** The game as it is, put as a what-if. */
  asIs(): Trial {
    return {
      zone: this.zone,
      blocked: this.blocked,
      reserved: this.reserved,
      doors: this.doors,
      rooms: this.s.rooms,
      items: this.s.items,
    };
  }

  /** Number the buildings, each a run of tiles indoors: the one with the front door first, then the rest in turn. */
  private numberBuildings() {
    const { buildingNo, indoors } = this;
    buildingNo.fill(0);
    const { door, front } = this.building;
    const starts = [this.idx(door[0], front), ...indoors.keys()];
    let next = 1;
    for (const start of starts) {
      if (!indoors[start] || buildingNo[start]) continue;
      const todo = [start];
      buildingNo[start] = next;
      while (todo.length) {
        const i = todo.pop() ?? 0;
        const x = i % this.w;
        const y = (i - x) / this.w;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (!this.onMap(nx, ny)) continue;
          const n = this.idx(nx, ny);
          if (indoors[n] && !buildingNo[n]) {
            buildingNo[n] = next;
            todo.push(n);
          }
        }
      }
      next++;
    }
  }

  /** The room with this id, if there is one. */
  room(id: number): Room | undefined {
    // zone ids for the corridor, the path and the scenery are never rooms
    return id > 0 ? byId(this.s.rooms, id) : undefined;
  }
  /** The item with this id, if there is one. */
  item(id: number): Item | undefined {
    return id ? byId(this.s.items, id) : undefined;
  }
  /** The zone id of a tile. Anything off the map counts as scenery. */
  zoneAt(x: number, y: number) {
    return this.onMap(x, y) ? (this.zone[this.idx(x, y)] ?? Z_SCENERY) : Z_SCENERY;
  }
  /** The room a tile is in, if any. */
  roomAt(x: number, y: number): Room | undefined {
    const z = this.zoneAt(x, y);
    return z > 0 ? this.room(z) : undefined;
  }
  /** The item covering a tile, if any. */
  itemAt(x: number, y: number): Item | undefined {
    return this.s.items.find((it) => footprint(it).some(([fx, fy]) => fx === x && fy === y));
  }
  /** The building's own windows as things stand: none where a room runs along the wall, or something hangs on it. */
  buildingWindows(): readonly BuildingWindow[] {
    if (this.panesStamp !== this.stamp) {
      const hung = this.s.items.filter((it) => onWall(it.type) && this.zoneAt(it.x, it.y) === Z_CORRIDOR);
      this.panes = buildingWindows(this.building, this.s.rooms, hung.flatMap(wallSpotsOf));
      this.panesStamp = this.stamp;
    }
    return this.panes;
  }
  /** What hangs on a stretch of wall, if anything. */
  hungAt(spot: WallSpot): Item | undefined {
    return this.s.items.find((it) => onWall(it.type) && wallSpotsOf(it).some((w) => sameSpot(w, spot)));
  }
  /** The room an item is in, if any. */
  roomOfItem(it: Item): Room | undefined {
    return this.roomAt(it.x, it.y);
  }
  /** Corridor items always work; room items once the room is finished and not flooded. Broken items never do. */
  usable(it: Item): boolean {
    if (it.wear >= 100 || this.stoppedByMishap(it)) return false;
    // a Mechanic is on the way to install an upgrade: the guest on it is finished with, and nobody else is called
    if (it.upgradePaid && it.claimedBy && !it.serving) return false;
    const r = this.roomOfItem(it);
    return !r || (r.done && !this.flooded(r));
  }
  /** Whether a storm has flooded a room, and the water is not all mopped up yet. */
  flooded(r: Room): boolean {
    return this.s.litter.some((l) => l.flood === r.id);
  }
  /** Whether the mishap under way has taken an item out of action, as a power cut does to anything with a plug. */
  stoppedByMishap(it: Item): boolean {
    const m = this.s.mishap;
    return !!m?.started && mishapStopsType(MISHAPS[m.kind], it.type, m.prepared);
  }
  /** Whether a tile can be walked on: in the game as it is, or on the grids `g` of a what-if. */
  walkable(x: number, y: number, g: Grid = this) {
    if (!this.onMap(x, y)) return false;
    const i = this.idx(x, y);
    return g.zone[i] !== Z_SCENERY && !g.blocked[i];
  }

  /** Orthogonal step between adjacent tiles, in the game as it is or on the grids `g` of a what-if. */
  canStep(ax: number, ay: number, bx: number, by: number, g: Grid = this) {
    if (!this.walkable(bx, by, g)) return false;
    return g.zone[this.idx(ax, ay)] === g.zone[this.idx(bx, by)] || g.doors.has(this.edgeKey(ax, ay, bx, by));
  }

  // ---- Pathfinding ---------------------------------------------------------
  private g: Float32Array;
  private f: Float64Array;
  private came: Int32Array;
  /** 1 for a tile on the open list, 2 for one done with, in the search numbered in `marked`; else not yet seen. */
  private state: Uint8Array;
  /** Which search last marked each tile, so a new search need not clear the marks of the last. */
  private marked: Uint32Array;
  private search = 0;

  /** A* over the tile grid. The start tile may itself be blocked. Returns tile-center waypoints. */
  findPath(sx: number, sy: number, gx: number, gy: number): Waypoint[] | null {
    if (!this.onMap(sx, sy) || !this.walkable(gx, gy)) return null;
    if (sx === gx && sy === gy) return [];
    // a single step to the next tile along is what the search would find, the shortest way there being that step
    if (Math.abs(gx - sx) + Math.abs(gy - sy) === 1 && this.canStep(sx, sy, gx, gy)) return [[gx + 0.5, gy + 0.5, 0]];
    const { g, f, came, state, marked } = this;
    const search = ++this.search;
    /** Where a tile stands in this search: 0 not yet seen, 1 on the open list, 2 done with. */
    const stateOf = (i: number) => (marked[i] === search ? at(state, i) : 0);
    /** Mark where a tile stands in this search. */
    const mark = (i: number, v: number) => {
      marked[i] = search;
      state[i] = v;
    };
    const start = this.idx(sx, sy);
    const goal = this.idx(gx, gy);
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
      const cx = cur % this.w;
      const cy = (cur - cx) / this.w;
      for (const [dx, dy, cost] of DIRS8) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.onMap(nx, ny)) continue;
        const n = this.idx(nx, ny);
        const seen = stateOf(n);
        if (seen === 2) continue;
        if (dx && dy) {
          if (
            !this.canStep(cx, cy, nx, cy) ||
            !this.canStep(nx, cy, nx, ny) ||
            !this.canStep(cx, cy, cx, ny) ||
            !this.canStep(cx, ny, nx, ny)
          )
            continue;
        } else if (!this.canStep(cx, cy, nx, ny)) continue;
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
      const x = c % this.w;
      path.push([x + 0.5, (c - x) / this.w + 0.5, 0]);
      c = at(came, c);
    }
    return path.reverse();
  }

  /** Tiles reachable on foot from a start tile, in breadth-first order, in the game or on the grids `g` of a what-if. */
  flood(sx: number, sy: number, limit = this.w * this.h, g: Grid = this): [number, number][] {
    const seen = new Uint8Array(this.w * this.h);
    const out: [number, number][] = [];
    if (!this.onMap(sx, sy)) return out;
    // a queue of tile indexes read from the front, as taking from the front of an array moves everything behind it
    const queue = new Int32Array(this.w * this.h);
    let head = 0;
    let tail = 0;
    queue[tail++] = this.idx(sx, sy);
    seen[this.idx(sx, sy)] = 1;
    while (head < tail && out.length < limit) {
      const i = at(queue, head++);
      const x = i % this.w;
      const y = (i - x) / this.w;
      out.push([x, y]);
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.onMap(nx, ny) || seen[this.idx(nx, ny)]) continue;
        if (!this.canStep(x, y, nx, ny, g)) continue;
        seen[this.idx(nx, ny)] = 1;
        queue[tail++] = this.idx(nx, ny);
      }
    }
    return out;
  }

  /**
   * Free standing spots near a tile: same zone, not blocking a doorway or an access spot. They depend only on the
   * grids, so each is worked out once and kept until the grids next change; the list is shared, so it is read-only.
   */
  standSpots(x: number, y: number, count: number): readonly [number, number][] {
    if (this.spotsStamp !== this.stamp) {
      this.spots.clear();
      this.spotsStamp = this.stamp;
    }
    if (!this.onMap(x, y)) return [];
    // the search stops 160 tiles out, so asking for more than that finds the same
    const key = this.idx(x, y) * (STAND_SEARCH + 1) + Math.min(count, STAND_SEARCH);
    let found = this.spots.get(key);
    if (!found) {
      const z = this.zoneAt(x, y);
      found = this.flood(x, y, STAND_SEARCH)
        .filter(([tx, ty]) => this.zone[this.idx(tx, ty)] === z && !this.reserved[this.idx(tx, ty)])
        .slice(0, count);
      this.spots.set(key, found);
    }
    return found;
  }

  /** Everything that needs reaching can be reached from the street: in the game as it is, or in a what-if. */
  connected(t: Trial = this.asIs()): boolean {
    const seen = new Uint8Array(this.w * this.h);
    for (const [x, y] of this.flood(0, SIDEWALK_Y, undefined, t)) seen[this.idx(x, y)] = 1;
    /** Whether a tile was reached from the street. */
    const need = (x: number, y: number) => this.onMap(x, y) && seen[this.idx(x, y)] === 1;
    if (!need(this.w - 1, SIDEWALK_Y)) return false;
    // through every door: to the tile just outside, and the one past the tile inside
    for (const e of this.building.entrances)
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
      !this.inside(x, y) ||
      (this.walkable(x, y, t)
        ? need(x, y)
        : DIRS4.some(([dx, dy]) => need(x + dx, y + dy) && this.canStep(x, y, x + dx, y + dy, t)));
    // nobody already inside may be walled in, on the tile they stand on or the one they are stepping into, as they
    // may already be partway across into it and set off again from there
    for (const c of [...this.s.guests, ...this.s.staff, ...this.s.visitors]) {
      if (!free(c.tx, c.ty)) return false;
      const ahead = c.path?.[0];
      if (ahead && !ahead[2] && !free(Math.floor(ahead[0]), Math.floor(ahead[1]))) return false;
    }
    return true;
  }

  // ---- Build rules -----------------------------------------------------------
  // The rules themselves are in build-rules.ts; these pass the world along to them.
  /** Can something hang on this stretch of wall, seen from the tile in front of it? */
  wallFace(spot: WallSpot): Check {
    return rules.wallFace(this, spot);
  }
  /** Where a wall item would hang for a point on the ground, or null if no wall is near. */
  nearestWall(type: ItemType, fx: number, fy: number): { x: number; y: number; rot: number } | null {
    return rules.nearestWall(this, type, fx, fy);
  }
  /** Can this item go here, facing this way? */
  canPlaceItem(type: ItemType, x: number, y: number, rot: number, roomId?: number): Check {
    return rules.canPlaceItem(this, type, x, y, rot, roomId);
  }
  /** Can a room of this type cover this rectangle, in the game as it is or in a what-if? */
  roomRectValid(type: RoomType, r: Rect, t?: Trial): Check {
    return rules.roomRectValid(this, type, r, t);
  }
  /** The doorway on the room edge nearest a ground position. */
  nearestDoor(r: Rect, fx: number, fy: number): Room['door'] {
    return rules.nearestDoor(r, fx, fy);
  }
  /** Can a room have its door here, or the room `replacing` have it moved here? */
  doorValid(_type: RoomType, r: Rect, door: Room['door'], replacing?: Room): Check {
    return rules.doorValid(this, r, door, replacing);
  }
  /** Can a room take a new shape? */
  resizeValid(room: Room, r: Rect): Check {
    return rules.resizeValid(this, room, r);
  }
  /** Can a room with this layout be put down here, or the room `moving` be moved here? */
  layoutValid(type: RoomType, placed: PlacedLayout, moving?: Room): Check {
    return rules.layoutValid(this, type, placed, moving);
  }
  /** Can this stretch of a room's wall take a window? */
  windowValid(room: Room, spot: Room['door']): Check {
    return rules.windowValid(this, room, spot);
  }
}
