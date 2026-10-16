// Grid caches derived from the game state: zones, blocking, doors, plus
// placement validation and pathfinding.

import {
  centerOf,
  H,
  ITEMS,
  type ItemType,
  MISHAPS,
  mishapStopsType,
  type Pose,
  ROOMS,
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
  spotInWall,
} from './footprint';
import { buildingsOf, lotWidth } from './land';
import { byId } from './lookup';
import { carryWallSpot, inRect, sameRect } from './resize';
import type { PlacedLayout } from './room-layout';
import { sameSpot } from './state/game';
import type { GameState, Item, Room, WallSpot, Waypoint } from './state/types';
import { at } from './util';

/** Zone ids: -2 scenery (not walkable), -1 outdoors path, 0 corridor, >0 room id. */
export const Z_SCENERY = -2;
export const Z_OUTSIDE = -1;
export const Z_CORRIDOR = 0;

// ---- Item geometry ---------------------------------------------------------
interface Placed {
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
const OK: Check = { ok: true, reason: '' };
/** A failed check, with the reason why. */
const no = (reason: string): Check => ({ ok: false, reason });

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

  /** A key for the edge between two neighboring tiles. */
  private edgeKey(ax: number, ay: number, bx: number, by: number) {
    if (ay === by) return this.idx(Math.min(ax, bx), ay) * 2;
    return this.idx(ax, Math.min(ay, by)) * 2 + 1;
  }

  /** Rebuild the zone, blocking, reserved and door grids from the game state. */
  rebuild(silent = false) {
    const { zone, blocked, reserved, doors, indoors } = this;
    blocked.fill(0);
    reserved.fill(0);
    doors.clear();
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
        doors.add(this.edgeKey(x, y, ox, oy));
        // the tile inside the door, and the next one in, are kept clear for the way through
        reserved[this.idx(x, y)] = 1;
        if (this.onMap(2 * x - ox, 2 * y - oy)) reserved[this.idx(2 * x - ox, 2 * y - oy)] = 1;
      }
    this.numberBuildings();
    for (const r of this.s.rooms) {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) zone[this.idx(x, y)] = r.id;
      const ox = r.door.x + r.door.dx;
      const oy = r.door.y + r.door.dy;
      doors.add(this.edgeKey(r.door.x, r.door.y, ox, oy));
      reserved[this.idx(r.door.x, r.door.y)] = 1;
      if (this.onMap(ox, oy)) reserved[this.idx(ox, oy)] = 1;
    }
    for (const it of this.s.items) {
      // something on a wall is out of everyone's way
      if (onWall(it.type)) continue;
      if (!ITEMS[it.type].walkable)
        for (const [x, y] of footprint(it)) if (this.onMap(x, y)) blocked[this.idx(x, y)] = 1;
      for (let i = 0; i < ITEMS[it.type].access.length; i++) {
        const [x, y] = accessTile(it, i);
        if (this.onMap(x, y)) reserved[this.idx(x, y)] = 1;
      }
    }
    this.stamp++;
    if (!silent) this.version++;
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
  /**
   * Can something hang on this stretch of wall, seen from the tile in front of it? Inside a room, on any of its walls
   * but where its door or a window is. In a corridor, only on the building's outer wall, away from its windows and
   * its entrances: the corridor side of a room's wall is never seen standing tall.
   */
  wallFace(spot: WallSpot): Check {
    const { x, y, dx, dy } = spot;
    if (!this.inside(x, y)) return no('Must be inside the building');
    const ox = x + dx;
    const oy = y + dy;
    const z = this.zoneAt(x, y);
    if (z > 0) {
      const room = this.room(z);
      if (!room || this.zoneAt(ox, oy) === z) return no('Hang it on a wall');
      if (sameSpot(room.door, spot)) return no('The door is there');
      if (room.windows.some((w) => sameSpot(w, spot))) return no('There is a window there');
      return OK;
    }
    if (z !== Z_CORRIDOR) return no('Must be inside the building');
    if (this.inside(ox, oy))
      return no(
        this.zoneAt(ox, oy) > 0 ? "Hang it inside the room, or on the building's outer wall" : 'Hang it on a wall',
      );
    // the entrance, and a tile either side of it for its pillars
    const [ax, ay] = dx ? [0, 1] : [1, 0];
    for (const k of [-1, 0, 1])
      if (this.doors.has(this.edgeKey(x + ax * k, y + ay * k, ox + ax * k, oy + ay * k)))
        return no('Too close to the entrance');
    const { side, line, t } = spotInWall(spot);
    if (this.buildingWindows().some((w) => w.side === side && w.line === line && t >= w.a && t < w.b))
      return no('There is a window there');
    return OK;
  }
  /** Can a wall item hang here, facing this way? Every stretch of wall it covers has to be free, on one wall. */
  private canHang(type: ItemType, x: number, y: number, rot: number, roomId?: number): Check {
    const def = ITEMS[type];
    let z: number | null = null;
    let outer: boolean | null = null;
    for (const spot of wallSpotsOf({ type, x, y, rot })) {
      const face = this.wallFace(spot);
      if (!face.ok) return face;
      const hung = this.hungAt(spot);
      if (hung) return no(`The ${ITEMS[hung.type].name} hangs there`);
      // one straight stretch of one wall: not round a corner, nor half on a room's wall and half on the building's
      const here = this.zoneAt(spot.x, spot.y);
      const out = !this.inside(spot.x + spot.dx, spot.y + spot.dy);
      if (z === null) [z, outer] = [here, out];
      else if (z !== here || outer !== out) return no('It has to hang on one stretch of wall');
    }
    if (z === null) return no('Invalid');
    if (roomId !== undefined && z !== roomId) return no('Hang it inside the new room');
    if (def.where === 'corridor' && z !== Z_CORRIDOR) return no('Goes in a corridor, not a room');
    if (def.where !== 'corridor' && def.where !== 'any') {
      const room = z > 0 ? this.room(z) : undefined;
      if (room?.type !== def.where) return no(`Goes inside a ${ROOMS[def.where].name}`);
    }
    return OK;
  }
  /**
   * Where a wall item would hang for a point on the ground: on the wall nearest it, within a tile or so, that it can
   * hang on, centered on the point along the wall. Its top-left tile and the way it faces, or null if no wall is near.
   */
  nearestWall(type: ItemType, fx: number, fy: number): { x: number; y: number; rot: number } | null {
    const w = ITEMS[type].w;
    let best: { x: number; y: number; rot: number } | null = null;
    let bestD = 1.25;
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    for (let y = ty - 1; y <= ty + 1; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        for (const [dx, dy] of DIRS4) {
          const spot = { x, y, dx, dy };
          if (!this.wallFace(spot).ok) continue;
          // how far the point is from this stretch of wall
          const ex = x + 0.5 + dx * 0.5;
          const ey = y + 0.5 + dy * 0.5;
          const d = dx
            ? Math.hypot(fx - ex, Math.max(0, Math.abs(fy - ey) - 0.5))
            : Math.hypot(Math.max(0, Math.abs(fx - ex) - 0.5), fy - ey);
          if (d >= bestD) continue;
          bestD = d;
          const rot = rotFacing(spot);
          // a wide item runs along the wall from its top-left tile, centered on the point
          const shift = Math.floor((dx ? fy - y : fx - x) - w / 2 + 0.5);
          best = dx
            ? { x, y: y + Math.max(-(w - 1), Math.min(0, shift)), rot }
            : { x: x + Math.max(-(w - 1), Math.min(0, shift)), y, rot };
        }
      }
    }
    return best;
  }
  /** The room an item is in, if any. */
  roomOfItem(it: Item): Room | undefined {
    return this.roomAt(it.x, it.y);
  }
  /** Corridor items always work; room items only once the room is finished. Broken items never do. */
  usable(it: Item): boolean {
    if (it.wear >= 100 || this.stoppedByMishap(it)) return false;
    // a Mechanic is on the way to install an upgrade: the guest on it is finished with, and nobody else is called
    if (it.upgradePaid && it.claimedBy && !it.serving) return false;
    const r = this.roomOfItem(it);
    return !r || r.done;
  }
  /** Whether the mishap under way has taken an item out of action, as a power cut does to anything with a plug. */
  stoppedByMishap(it: Item): boolean {
    const m = this.s.mishap;
    return !!m?.started && mishapStopsType(MISHAPS[m.kind], it.type, m.prepared);
  }
  /** Whether a tile can be walked on. */
  walkable(x: number, y: number) {
    if (!this.onMap(x, y)) return false;
    const i = this.idx(x, y);
    return this.zone[i] !== Z_SCENERY && !this.blocked[i];
  }

  /** Orthogonal step between adjacent tiles. */
  canStep(ax: number, ay: number, bx: number, by: number) {
    if (!this.walkable(bx, by)) return false;
    return this.zone[this.idx(ax, ay)] === this.zone[this.idx(bx, by)] || this.doors.has(this.edgeKey(ax, ay, bx, by));
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

  /** Tiles reachable on foot from a start tile, in breadth-first order. */
  flood(sx: number, sy: number, limit = this.w * this.h): [number, number][] {
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
        if (!this.canStep(x, y, nx, ny)) continue;
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

  /** Everything that needs reaching can be reached from the street. */
  connected(): boolean {
    const seen = new Uint8Array(this.w * this.h);
    for (const [x, y] of this.flood(0, SIDEWALK_Y)) seen[this.idx(x, y)] = 1;
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
    for (const r of this.s.rooms) {
      if (!need(r.door.x, r.door.y) || !need(r.door.x + r.door.dx, r.door.y + r.door.dy)) return false;
    }
    for (const it of this.s.items) {
      for (let i = 0; i < ITEMS[it.type].access.length; i++) {
        const [x, y] = accessTile(it, i);
        if (!need(x, y)) return false;
      }
    }
    // nobody already inside may be walled in (their own tile may be the one being built on)
    for (const c of [...this.s.guests, ...this.s.staff, ...this.s.visitors]) {
      if (!this.inside(c.tx, c.ty)) continue;
      const { tx: x, ty: y } = c;
      if (!need(x, y) && !need(x + 1, y) && !need(x - 1, y) && !need(x, y + 1) && !need(x, y - 1)) return false;
    }
    return true;
  }

  // ---- Placement validation ------------------------------------------------
  /** Can this item go here, facing this way? */
  canPlaceItem(type: ItemType, x: number, y: number, rot: number, roomId?: number): Check {
    if (onWall(type)) return this.canHang(type, x, y, rot, roomId);
    const def = ITEMS[type];
    const it: Placed = { type, x, y, rot };
    const tiles = footprint(it);
    let z: number | null = null;
    for (const [tx, ty] of tiles) {
      if (!this.inside(tx, ty)) return no('Must be inside the building');
      const i = this.idx(tx, ty);
      if (def.walkable) {
        // rugs lie flat: fine under furniture and in doorways, but not on another rug
        if (this.s.items.some((o) => ITEMS[o.type].walkable && footprint(o).some(([ox, oy]) => ox === tx && oy === ty)))
          return no('There is already a rug here');
      } else {
        if (this.blocked[i]) return no('Something is in the way');
        if (this.reserved[i]) return no('Keep doorways and access spots clear');
      }
      const here = at(this.zone, i);
      if (z === null) z = here;
      else if (z !== here) return no('Cannot straddle a wall');
    }
    if (z === null) return no('Invalid');
    if (roomId !== undefined && z !== roomId) return no('Place it inside the new room');
    if (def.where === 'corridor' && z !== Z_CORRIDOR) return no('Goes in a corridor, not a room');
    if (def.where !== 'corridor' && def.where !== 'any') {
      const room = z > 0 ? this.room(z) : undefined;
      if (room?.type !== def.where) return no(`Goes inside a ${ROOMS[def.where].name}`);
    }
    for (let i = 0; i < def.access.length; i++) {
      const [ax, ay] = accessTile(it, i);
      if (!this.inside(ax, ay) || this.zone[this.idx(ax, ay)] !== z || this.blocked[this.idx(ax, ay)])
        return no('Needs clear space to use it (R rotates)');
    }
    // trial placement to make sure nothing gets cut off
    const trial = { ...it, id: -1 } as unknown as Item;
    this.s.items.push(trial);
    this.rebuild(true);
    const fine = this.connected();
    this.s.items.pop();
    this.rebuild(true);
    return fine ? OK : no('That would block the way');
  }

  /** Can a room of this type cover this rectangle? */
  roomRectValid(type: RoomType, r: Rect): Check {
    const def = ROOMS[type];
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!this.inside(x, y)) return no('Must be inside the building');
        const i = this.idx(x, y);
        if (this.zone[i] !== Z_CORRIDOR) return no('Overlaps another room');
        if (this.blocked[i]) return no('Something is in the way');
        if (this.reserved[i]) return no('Keep doorways and access spots clear');
      }
    }
    /** Whether a tile is inside the new room. */
    const within = (x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    // things that can be walked over, like rugs, have to end up wholly on one side of the new walls
    for (const it of this.s.items) {
      // something hung on the building's wall would end up inside the room
      if (onWall(it.type)) {
        if (footprint(it).some(([x, y]) => within(x, y))) return no(`Take the ${ITEMS[it.type].name} down first`);
        continue;
      }
      const tiles = footprint(it);
      const n = tiles.filter(([x, y]) => within(x, y)).length;
      if (n > 0 && n < tiles.length) return no('Something is in the way');
    }
    for (const room of this.s.rooms)
      if (room.windows.some((w) => within(w.x + w.dx, w.y + w.dy))) return no('A window is in the way');
    if (Math.min(r.w, r.h) < def.minShort || Math.max(r.w, r.h) < def.minLong)
      return no(`Too small: needs at least ${def.minShort}×${def.minLong}`);
    return OK;
  }

  /** The doorway on the room edge nearest a ground position. */
  nearestDoor(r: Rect, fx: number, fy: number): Room['door'] {
    const cx = Math.max(r.x, Math.min(r.x + r.w - 1, Math.floor(fx)));
    const cy = Math.max(r.y, Math.min(r.y + r.h - 1, Math.floor(fy)));
    const options: [number, Room['door']][] = [
      [Math.abs(fy - r.y), { x: cx, y: r.y, dx: 0, dy: -1 }],
      [Math.abs(fy - (r.y + r.h)), { x: cx, y: r.y + r.h - 1, dx: 0, dy: 1 }],
      [Math.abs(fx - r.x), { x: r.x, y: cy, dx: -1, dy: 0 }],
      [Math.abs(fx - (r.x + r.w)), { x: r.x + r.w - 1, y: cy, dx: 1, dy: 0 }],
    ];
    options.sort((a, b) => a[0] - b[0]);
    return at(options, 0)[1];
  }

  /**
   * Can a room have its door here? Pass `replacing` when moving the door of a room
   * that already exists, so it is judged as if that room had the new door.
   */
  doorValid(type: RoomType, r: Rect, door: Room['door'], replacing?: Room): Check {
    const ox = door.x + door.dx;
    const oy = door.y + door.dy;
    if (!this.inside(ox, oy) || this.zone[this.idx(ox, oy)] !== Z_CORRIDOR)
      return no('Doors must open onto a corridor');
    if (this.blocked[this.idx(ox, oy)]) return no('Something is blocking that doorway');
    if (replacing) {
      if (replacing.windows.some((w) => w.x === door.x && w.y === door.y && w.dx === door.dx && w.dy === door.dy))
        return no('There is a window there');
      if (this.blocked[this.idx(door.x, door.y)]) return no('Furniture is in the way inside the room');
      const hung = this.hungAt(door);
      if (hung) return no(`Take the ${ITEMS[hung.type].name} down first`);
    }
    const rooms = this.s.rooms;
    const trial: Room = {
      id: replacing?.id ?? 2147483000,
      type,
      ...r,
      door,
      windows: [],
      done: false,
      priority: false,
      vibes: 0,
      claimedBy: 0,
    };
    this.s.rooms = [...rooms.filter((x) => x !== replacing), trial];
    this.rebuild(true);
    const fine = this.connected();
    this.s.rooms = rooms;
    this.rebuild(true);
    return fine ? OK : no('That would block the way');
  }

  /**
   * Can a room take a new shape? Its new floor has to be free corridor inside the building, its furniture and the
   * spots it is used from have to stay inside, its door has to stay on a wall it can still open from, and nobody
   * may be cut off.
   */
  resizeValid(room: Room, r: Rect): Check {
    const def = ROOMS[room.type];
    if (sameRect(room, r)) return no('Drag a wall in or out');
    if (Math.min(r.w, r.h) < def.minShort || Math.max(r.w, r.h) < def.minLong)
      return no(`Too small: needs at least ${def.minShort}×${def.minLong}`);
    const ownDoorway = this.idx(room.door.x + room.door.dx, room.door.y + room.door.dy);
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (inRect(room, x, y)) continue;
        if (!this.inside(x, y)) return no('Must be inside the building');
        const i = this.idx(x, y);
        if (this.zone[i] !== Z_CORRIDOR) return no('Overlaps another room');
        if (this.blocked[i]) return no('Something is in the way');
        // the room's own doorway moves out of the way with the wall
        if (this.reserved[i] && i !== ownDoorway) return no('Keep doorways and access spots clear');
      }
    }
    const inside = this.s.items.filter((it) => this.zoneAt(it.x, it.y) === room.id);
    // what hangs on the walls moves with them, or is sold if its stretch of wall is gone
    for (const it of inside.filter((i) => !onWall(i.type))) {
      const spots = [...footprint(it)];
      for (let i = 0; i < ITEMS[it.type].access.length; i++) spots.push(accessTile(it, i));
      if (spots.some(([x, y]) => !inRect(r, x, y))) return no('The furniture has to stay inside: move it first');
    }
    // anything outside the room, like a rug, has to end up wholly on one side of the new walls
    for (const it of this.s.items) {
      if (inside.includes(it)) continue;
      if (footprint(it).some(([x, y]) => inRect(r, x, y)))
        return no(onWall(it.type) ? `Take the ${ITEMS[it.type].name} down first` : 'Something is in the way');
    }
    for (const other of this.s.rooms)
      if (other !== room && other.windows.some((w) => inRect(r, w.x + w.dx, w.y + w.dy)))
        return no('A window is in the way');
    const door = carryWallSpot(room.door, r);
    if (!door) return no('That would cut off the door: move it first');
    // try it: the door has to open onto corridor as things will be, and everyone and everything still be reached
    const before = { x: room.x, y: room.y, w: room.w, h: room.h, door: room.door };
    Object.assign(room, r, { door });
    this.rebuild(true);
    const ox = door.x + door.dx;
    const oy = door.y + door.dy;
    const check =
      !this.inside(ox, oy) || this.zone[this.idx(ox, oy)] !== Z_CORRIDOR
        ? no('The door must open onto a corridor')
        : this.blocked[this.idx(ox, oy)]
          ? no('Something is blocking the doorway')
          : this.connected()
            ? OK
            : no('That would block the way');
    Object.assign(room, before);
    this.rebuild(true);
    return check;
  }

  /**
   * Can a room with this layout be put down here? Pass `moving` to judge it as if that room and its furniture had
   * been lifted out first. The floor has to be free corridor inside the building, the door has to open onto clear
   * corridor, and nobody and nothing may be cut off.
   */
  layoutValid(type: RoomType, placed: PlacedLayout, moving?: Room): Check {
    const { rooms, items } = this.s;
    const own = moving ? items.filter((it) => this.zoneAt(it.x, it.y) === moving.id) : [];
    this.s.rooms = rooms.filter((r) => r !== moving);
    this.s.items = items.filter((it) => !own.includes(it));
    this.rebuild(true);
    let check = this.roomRectValid(type, placed.rect);
    const { door } = placed;
    const ox = door.x + door.dx;
    const oy = door.y + door.dy;
    if (check.ok && (!this.inside(ox, oy) || this.zone[this.idx(ox, oy)] !== Z_CORRIDOR))
      check = no('The door must open onto a corridor');
    else if (check.ok && this.blocked[this.idx(ox, oy)]) check = no('Something is blocking the doorway');
    if (check.ok) {
      // try it: everyone and everything has to be reached with the room in its new place
      const trial: Room = {
        id: moving?.id ?? 2147483001,
        type,
        ...placed.rect,
        door,
        windows: [],
        done: false,
        priority: false,
        vibes: 0,
        claimedBy: 0,
      };
      this.s.rooms = [...this.s.rooms, trial];
      this.s.items = [...this.s.items, ...placed.items.map((it) => ({ ...it, id: -1 }) as unknown as Item)];
      this.rebuild(true);
      if (!this.connected()) check = no('That would block the way');
    }
    this.s.rooms = rooms;
    this.s.items = items;
    this.rebuild(true);
    return check;
  }

  /** Can this stretch of a room's wall take a window? */
  windowValid(room: Room, spot: Room['door']): Check {
    const inside = spot.x >= room.x && spot.x < room.x + room.w && spot.y >= room.y && spot.y < room.y + room.h;
    const ox = spot.x + spot.dx;
    const oy = spot.y + spot.dy;
    const outside = ox < room.x || ox >= room.x + room.w || oy < room.y || oy >= room.y + room.h;
    if (!inside || !outside || Math.abs(spot.dx) + Math.abs(spot.dy) !== 1) return no("Windows go in the room's walls");
    const d = room.door;
    if (d.x === spot.x && d.y === spot.y && d.dx === spot.dx && d.dy === spot.dy) return no('The door is there');
    const hung = this.hungAt(spot);
    if (hung) return no(`Take the ${ITEMS[hung.type].name} down first`);
    // a window onto the room next door would just be a hole in two walls
    const beyond = this.zoneAt(ox, oy);
    if (beyond > 0 && beyond !== room.id) return no('Another room is on the other side');
    return OK;
  }
}
