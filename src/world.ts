// Grid caches derived from the game state: zones, blocking, doors, plus
// placement validation and pathfinding.
import {
  BX0,
  BX1,
  BY0,
  BY1,
  ENT_IN_Y,
  ENT_OUT_Y,
  ENT_X,
  H,
  ITEMS,
  ROOMS,
  SIDEWALK_Y,
  W,
  type ItemType,
  type Pose,
  type RoomType,
} from './data';
import type { GameState, Item, Room } from './state';

export const tileIdx = (x: number, y: number) => y * W + x;
export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
export const inBuilding = (x: number, y: number) => x >= BX0 && x <= BX1 && y >= BY0 && y <= BY1;

/** Zone ids: -2 scenery (not walkable), -1 outdoors path, 0 corridor, >0 room id. */
export const Z_SCENERY = -2;
export const Z_OUTSIDE = -1;
export const Z_CORRIDOR = 0;

// ---- Item geometry ---------------------------------------------------------
type Placed = { type: ItemType; x: number; y: number; rot: number };

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
export function itemDims(type: ItemType, rot: number): [number, number] {
  const d = ITEMS[type];
  return rot & 1 ? [d.h, d.w] : [d.w, d.h];
}
export function footprint(it: Placed): [number, number][] {
  const [w, h] = itemDims(it.type, it.rot);
  const out: [number, number][] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([it.x + dx, it.y + dy]);
  return out;
}
export function accessTile(it: Placed, i: number): [number, number] {
  const d = ITEMS[it.type];
  const a = d.access[i];
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
export function accessPose(it: Placed, i: number): PosePoint {
  const d = ITEMS[it.type];
  const a = d.access[i];
  const [rx, ry] = rotPoint(d.w, d.h, it.rot, a.px, a.py);
  const [fx, fy] = rotVec(it.rot, a.face[0], a.face[1]);
  return { x: it.x + rx, y: it.y + ry, face: Math.atan2(fx, fy), pose: a.pose, h: a.h ?? 0 };
}
export function itemCenter(it: Placed): [number, number] {
  const [w, h] = itemDims(it.type, it.rot);
  return [it.x + w / 2, it.y + h / 2];
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
const no = (reason: string): Check => ({ ok: false, reason });

const DIRS8 = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export class World {
  zone = new Int32Array(W * H);
  blocked = new Uint8Array(W * H);
  reserved = new Uint8Array(W * H);
  doors = new Set<number>();
  /** Bumped on every rebuild so the renderer knows to resync. */
  version = 0;

  constructor(public s: GameState) {
    this.rebuild();
  }

  private edgeKey(ax: number, ay: number, bx: number, by: number) {
    if (ay === by) return tileIdx(Math.min(ax, bx), ay) * 2;
    return tileIdx(ax, Math.min(ay, by)) * 2 + 1;
  }

  rebuild(silent = false) {
    const { zone, blocked, reserved, doors } = this;
    blocked.fill(0);
    reserved.fill(0);
    doors.clear();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let z = Z_SCENERY;
        if (inBuilding(x, y)) z = Z_CORRIDOR;
        else if (y === SIDEWALK_Y) z = Z_OUTSIDE;
        else if (ENT_X.includes(x) && y >= ENT_OUT_Y && y < SIDEWALK_Y) z = Z_OUTSIDE;
        zone[tileIdx(x, y)] = z;
      }
    }
    for (const x of ENT_X) {
      doors.add(this.edgeKey(x, ENT_IN_Y, x, ENT_OUT_Y));
      reserved[tileIdx(x, ENT_IN_Y)] = 1;
      reserved[tileIdx(x, ENT_IN_Y - 1)] = 1;
    }
    for (const r of this.s.rooms) {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) zone[tileIdx(x, y)] = r.id;
      const ox = r.door.x + r.door.dx;
      const oy = r.door.y + r.door.dy;
      doors.add(this.edgeKey(r.door.x, r.door.y, ox, oy));
      reserved[tileIdx(r.door.x, r.door.y)] = 1;
      if (inBounds(ox, oy)) reserved[tileIdx(ox, oy)] = 1;
    }
    for (const it of this.s.items) {
      if (!ITEMS[it.type].walkable) for (const [x, y] of footprint(it)) if (inBounds(x, y)) blocked[tileIdx(x, y)] = 1;
      for (let i = 0; i < ITEMS[it.type].access.length; i++) {
        const [x, y] = accessTile(it, i);
        if (inBounds(x, y)) reserved[tileIdx(x, y)] = 1;
      }
    }
    if (!silent) this.version++;
  }

  room(id: number): Room | undefined {
    return this.s.rooms.find((r) => r.id === id);
  }
  item(id: number): Item | undefined {
    return id ? this.s.items.find((i) => i.id === id) : undefined;
  }
  zoneAt(x: number, y: number) {
    return inBounds(x, y) ? this.zone[tileIdx(x, y)] : Z_SCENERY;
  }
  roomAt(x: number, y: number): Room | undefined {
    const z = this.zoneAt(x, y);
    return z > 0 ? this.room(z) : undefined;
  }
  itemAt(x: number, y: number): Item | undefined {
    return this.s.items.find((it) => footprint(it).some(([fx, fy]) => fx === x && fy === y));
  }
  roomOfItem(it: Item): Room | undefined {
    return this.roomAt(it.x, it.y);
  }
  /** Corridor items always work; room items only once the room is finished. Broken items never do. */
  usable(it: Item): boolean {
    if (it.wear >= 100) return false;
    const r = this.roomOfItem(it);
    return !r || r.done;
  }
  walkable(x: number, y: number) {
    if (!inBounds(x, y)) return false;
    const i = tileIdx(x, y);
    return this.zone[i] !== Z_SCENERY && !this.blocked[i];
  }

  /** Orthogonal step between adjacent tiles. */
  canStep(ax: number, ay: number, bx: number, by: number) {
    if (!this.walkable(bx, by)) return false;
    return this.zone[tileIdx(ax, ay)] === this.zone[tileIdx(bx, by)] || this.doors.has(this.edgeKey(ax, ay, bx, by));
  }

  // ---- Pathfinding ---------------------------------------------------------
  private g = new Float32Array(W * H);
  private came = new Int32Array(W * H);
  private state = new Uint8Array(W * H);

  /** A* over the tile grid. The start tile may itself be blocked. Returns tile-center waypoints. */
  findPath(sx: number, sy: number, gx: number, gy: number): number[][] | null {
    if (!inBounds(sx, sy) || !this.walkable(gx, gy)) return null;
    if (sx === gx && sy === gy) return [];
    const { g, came, state } = this;
    state.fill(0);
    const start = tileIdx(sx, sy);
    const goal = tileIdx(gx, gy);
    const open: number[] = [start];
    const f = new Map<number, number>();
    g[start] = 0;
    f.set(start, 0);
    state[start] = 1;
    const hcost = (x: number, y: number) => {
      const dx = Math.abs(x - gx);
      const dy = Math.abs(y - gy);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f.get(open[i])! < f.get(open[bi])!) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) break;
      state[cur] = 2;
      const cx = cur % W;
      const cy = (cur - cx) / W;
      for (const [dx, dy, cost] of DIRS8) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const n = tileIdx(nx, ny);
        if (state[n] === 2) continue;
        if (dx && dy) {
          if (
            !this.canStep(cx, cy, nx, cy) ||
            !this.canStep(nx, cy, nx, ny) ||
            !this.canStep(cx, cy, cx, ny) ||
            !this.canStep(cx, ny, nx, ny)
          )
            continue;
        } else if (!this.canStep(cx, cy, nx, ny)) continue;
        const ng = g[cur] + cost;
        if (state[n] === 1 && ng >= g[n]) continue;
        g[n] = ng;
        came[n] = cur;
        f.set(n, ng + hcost(nx, ny));
        if (state[n] !== 1) {
          state[n] = 1;
          open.push(n);
        }
      }
    }
    if (state[goal] === 0) return null;
    const path: number[][] = [];
    let c = goal;
    while (c !== start) {
      const x = c % W;
      path.push([x + 0.5, (c - x) / W + 0.5, 0]);
      c = came[c];
    }
    return path.reverse();
  }

  /** Tiles reachable on foot from a start tile, in breadth-first order. */
  flood(sx: number, sy: number, limit = W * H): [number, number][] {
    const seen = new Uint8Array(W * H);
    const out: [number, number][] = [];
    if (!inBounds(sx, sy)) return out;
    const queue: [number, number][] = [[sx, sy]];
    seen[tileIdx(sx, sy)] = 1;
    while (queue.length && out.length < limit) {
      const [x, y] = queue.shift()!;
      out.push([x, y]);
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS8[d][0];
        const ny = y + DIRS8[d][1];
        if (!inBounds(nx, ny) || seen[tileIdx(nx, ny)]) continue;
        if (!this.canStep(x, y, nx, ny)) continue;
        seen[tileIdx(nx, ny)] = 1;
        queue.push([nx, ny]);
      }
    }
    return out;
  }

  /** Free standing spots near a tile: same zone, not blocking a doorway or an access spot. */
  standSpots(x: number, y: number, count: number): [number, number][] {
    const z = this.zoneAt(x, y);
    return this.flood(x, y, 160)
      .filter(([tx, ty]) => this.zone[tileIdx(tx, ty)] === z && !this.reserved[tileIdx(tx, ty)])
      .slice(0, count);
  }

  /** Everything that needs reaching can be reached from the street. */
  connected(): boolean {
    const seen = new Uint8Array(W * H);
    for (const [x, y] of this.flood(0, SIDEWALK_Y)) seen[tileIdx(x, y)] = 1;
    const need = (x: number, y: number) => inBounds(x, y) && seen[tileIdx(x, y)] === 1;
    if (!need(W - 1, SIDEWALK_Y)) return false;
    for (const x of ENT_X) if (!need(x, ENT_IN_Y - 1)) return false;
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
    for (const c of [...this.s.guests, ...this.s.staff]) {
      if (!inBuilding(c.tx, c.ty)) continue;
      const { tx: x, ty: y } = c;
      if (!need(x, y) && !need(x + 1, y) && !need(x - 1, y) && !need(x, y + 1) && !need(x, y - 1)) return false;
    }
    return true;
  }

  // ---- Placement validation ------------------------------------------------
  canPlaceItem(type: ItemType, x: number, y: number, rot: number, roomId?: number): Check {
    const def = ITEMS[type];
    const it: Placed = { type, x, y, rot };
    const tiles = footprint(it);
    let z: number | null = null;
    for (const [tx, ty] of tiles) {
      if (!inBuilding(tx, ty)) return no('Must be inside the building');
      const i = tileIdx(tx, ty);
      if (def.walkable) {
        // rugs lie flat: fine under furniture and in doorways, but not on another rug
        if (this.s.items.some((o) => ITEMS[o.type].walkable && footprint(o).some(([ox, oy]) => ox === tx && oy === ty)))
          return no('There is already a rug here');
      } else {
        if (this.blocked[i]) return no('Something is in the way');
        if (this.reserved[i]) return no('Keep doorways and access spots clear');
      }
      if (z === null) z = this.zone[i];
      else if (z !== this.zone[i]) return no('Cannot straddle a wall');
    }
    if (z === null) return no('Invalid');
    if (roomId !== undefined && z !== roomId) return no('Place it inside the new room');
    if (def.where === 'corridor' && z !== Z_CORRIDOR) return no('Goes in a corridor, not a room');
    if (def.where !== 'corridor' && def.where !== 'any') {
      const room = z > 0 ? this.room(z) : undefined;
      if (!room || room.type !== def.where) return no(`Goes inside a ${ROOMS[def.where].name}`);
    }
    for (let i = 0; i < def.access.length; i++) {
      const [ax, ay] = accessTile(it, i);
      if (!inBuilding(ax, ay) || this.zone[tileIdx(ax, ay)] !== z || this.blocked[tileIdx(ax, ay)])
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

  roomRectValid(type: RoomType, r: Rect): Check {
    const def = ROOMS[type];
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!inBuilding(x, y)) return no('Must be inside the building');
        const i = tileIdx(x, y);
        if (this.zone[i] !== Z_CORRIDOR) return no('Overlaps another room');
        if (this.blocked[i]) return no('Something is in the way');
        if (this.reserved[i]) return no('Keep doorways and access spots clear');
      }
    }
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
    return options[0][1];
  }

  /**
   * Can a room have its door here? Pass `replacing` when moving the door of a room
   * that already exists, so it is judged as if that room had the new door.
   */
  doorValid(type: RoomType, r: Rect, door: Room['door'], replacing?: Room): Check {
    const ox = door.x + door.dx;
    const oy = door.y + door.dy;
    if (!inBuilding(ox, oy) || this.zone[tileIdx(ox, oy)] !== Z_CORRIDOR) return no('Doors must open onto a corridor');
    if (this.blocked[tileIdx(ox, oy)]) return no('Something is blocking that doorway');
    if (replacing) {
      if (replacing.windows.some((w) => w.x === door.x && w.y === door.y && w.dx === door.dx && w.dy === door.dy))
        return no('There is a window there');
      if (this.blocked[tileIdx(door.x, door.y)]) return no('Furniture is in the way inside the room');
    }
    const rooms = this.s.rooms;
    const trial: Room = { id: replacing?.id ?? 2147483000, type, ...r, door, windows: [], done: false };
    this.s.rooms = [...rooms.filter((x) => x !== replacing), trial];
    this.rebuild(true);
    const fine = this.connected();
    this.s.rooms = rooms;
    this.rebuild(true);
    return fine ? OK : no('That would block the way');
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
    // a window onto the room next door would just be a hole in two walls
    const beyond = this.zoneAt(ox, oy);
    if (beyond > 0 && beyond !== room.id) return no('Another room is on the other side');
    return OK;
  }
}
