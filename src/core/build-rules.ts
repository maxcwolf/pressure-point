// The build rules: where furniture can stand or hang, and where rooms, their doors and their windows can go. Each
// one reads the world's grids, and tries a change out on its scratch grids, without touching the game.

import { certificatesLeft } from './certificates';
import { goesIn, ITEMS, type ItemType, ROOMS, roomsFor, type RoomType } from './data';
import { spotInWall } from './footprint';
import { carryWallSpot, inRect, sameRect } from './resize';
import type { PlacedLayout } from './room-layout';
import { sameSpot } from './state/game';
import type { Room, WallSpot } from './state/types';
import { at } from './util';
import {
  accessTile,
  type Check,
  footprint,
  onWall,
  type Placed,
  type Rect,
  type RoomShape,
  rotFacing,
  type Trial,
  wallSpotsOf,
  type World,
  Z_CORRIDOR,
} from './world';

const OK: Check = { ok: true, reason: '' };
/** A failed check, with the reason why. */
const no = (reason: string): Check => ({ ok: false, reason });

/** Steps to the four straight neighbors. */
const DIRS4: readonly (readonly [dx: number, dy: number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Can something hang on this stretch of wall, seen from the tile in front of it? Inside a room, on any of its walls
 * but where its door or a window is. In a corridor, only on the building's outer wall, away from its windows and
 * its entrances: the corridor side of a room's wall is never seen standing tall.
 */
export function wallFace(world: World, spot: WallSpot): Check {
  const { x, y, dx, dy } = spot;
  if (!world.inside(x, y)) return no('Must be inside the building');
  const ox = x + dx;
  const oy = y + dy;
  const z = world.zoneAt(x, y);
  if (z > 0) {
    const room = world.room(z);
    if (!room || world.zoneAt(ox, oy) === z) return no('Hang it on a wall');
    if (sameSpot(room.door, spot)) return no('The door is there');
    if (room.windows.some((w) => sameSpot(w, spot))) return no('There is a window there');
    return OK;
  }
  if (z !== Z_CORRIDOR) return no('Must be inside the building');
  if (world.inside(ox, oy))
    return no(
      world.zoneAt(ox, oy) > 0 ? "Hang it inside the room, or on the building's outer wall" : 'Hang it on a wall',
    );
  // the entrance, and a tile either side of it for its pillars
  const [ax, ay] = dx ? [0, 1] : [1, 0];
  for (const k of [-1, 0, 1])
    if (world.doors.has(world.edgeKey(x + ax * k, y + ay * k, ox + ax * k, oy + ay * k)))
      return no('Too close to the entrance');
  const { side, line, t } = spotInWall(spot);
  if (world.buildingWindows().some((w) => w.side === side && w.line === line && t >= w.a && t < w.b))
    return no('There is a window there');
  return OK;
}

/** Can an item go in this zone: a corridor, or a kind of room it is for? */
export function belongs(world: World, type: ItemType, z: number): Check {
  const def = ITEMS[type];
  if (def.where === 'corridor') return z === Z_CORRIDOR ? OK : no('Goes in a corridor, not a room');
  if (def.where === 'any') return OK;
  const room = z > 0 ? world.room(z) : undefined;
  if (room && goesIn(def, room.type)) return OK;
  return no(
    `Goes inside ${roomsFor(def)
      .map((r) => `a ${ROOMS[r].name}`)
      .join(' or ')}`,
  );
}

/** Can a wall item hang here, facing this way? Every stretch of wall it covers has to be free, on one wall. */
export function canHang(world: World, type: ItemType, x: number, y: number, rot: number, roomId?: number): Check {
  let z: number | null = null;
  let outer: boolean | null = null;
  for (const spot of wallSpotsOf({ type, x, y, rot })) {
    const face = wallFace(world, spot);
    if (!face.ok) return face;
    const hung = world.hungAt(spot);
    if (hung) return no(`The ${ITEMS[hung.type].name} hangs there`);
    // one straight stretch of one wall: not round a corner, nor half on a room's wall and half on the building's
    const here = world.zoneAt(spot.x, spot.y);
    const out = !world.inside(spot.x + spot.dx, spot.y + spot.dy);
    if (z === null) [z, outer] = [here, out];
    else if (z !== here || outer !== out) return no('It has to hang on one stretch of wall');
  }
  if (z === null) return no('Invalid');
  if (roomId !== undefined && z !== roomId) return no('Hang it inside the new room');
  return belongs(world, type, z);
}

/**
 * Where a wall item would hang for a point on the ground: on the wall nearest it, within a tile or so, that it can
 * hang on, centered on the point along the wall. Its top-left tile and the way it faces, or null if no wall is near.
 */
export function nearestWall(
  world: World,
  type: ItemType,
  fx: number,
  fy: number,
): { x: number; y: number; rot: number } | null {
  const w = ITEMS[type].w;
  let best: { x: number; y: number; rot: number } | null = null;
  let bestD = 1.25;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  for (let y = ty - 1; y <= ty + 1; y++) {
    for (let x = tx - 1; x <= tx + 1; x++) {
      for (const [dx, dy] of DIRS4) {
        const spot = { x, y, dx, dy };
        if (!wallFace(world, spot).ok) continue;
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

/** Can this item go here, facing this way? */
export function canPlaceItem(world: World, type: ItemType, x: number, y: number, rot: number, roomId?: number): Check {
  const { s } = world;
  if (type === 'certificate' && !certificatesLeft(s).length)
    return no('Win an award at the year-end ceremony to earn one');
  if (onWall(type)) return canHang(world, type, x, y, rot, roomId);
  const def = ITEMS[type];
  const it: Placed = { type, x, y, rot };
  const tiles = footprint(it);
  let z: number | null = null;
  for (const [tx, ty] of tiles) {
    if (!world.inside(tx, ty)) return no('Must be inside the building');
    const i = world.idx(tx, ty);
    if (def.walkable) {
      // rugs lie flat: fine under furniture and in doorways, but not on another rug
      if (s.items.some((o) => ITEMS[o.type].walkable && footprint(o).some(([ox, oy]) => ox === tx && oy === ty)))
        return no('There is already a rug here');
    } else {
      if (world.blocked[i]) return no('Something is in the way');
      if (world.reserved[i]) return no('Keep doorways and access spots clear');
    }
    const here = at(world.zone, i);
    if (z === null) z = here;
    else if (z !== here) return no('Cannot straddle a wall');
  }
  if (z === null) return no('Invalid');
  if (roomId !== undefined && z !== roomId) return no('Place it inside the new room');
  const fits = belongs(world, type, z);
  if (!fits.ok) return fits;
  for (let i = 0; i < def.access.length; i++) {
    const [ax, ay] = accessTile(it, i);
    if (!world.inside(ax, ay) || world.zone[world.idx(ax, ay)] !== z || world.blocked[world.idx(ax, ay)])
      return no('Needs clear space to use it (R rotates)');
  }
  // try it out, to make sure nothing gets cut off
  return world.connected(world.tryOut(s.rooms, [...s.items, it])) ? OK : no('That would block the way');
}

/** Can a room of this type cover this rectangle, in the game as it is or in a what-if? */
export function roomRectValid(world: World, type: RoomType, r: Rect, t: Trial = world.asIs()): Check {
  const def = ROOMS[type];
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!world.inside(x, y)) return no('Must be inside the building');
      const i = world.idx(x, y);
      if (t.zone[i] !== Z_CORRIDOR) return no('Overlaps another room');
      if (t.blocked[i]) return no('Something is in the way');
      if (t.reserved[i]) return no('Keep doorways and access spots clear');
    }
  }
  /** Whether a tile is inside the new room. */
  const within = (x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  // things that can be walked over, like rugs, have to end up wholly on one side of the new walls
  for (const it of t.items) {
    // something hung on the building's wall would end up inside the room
    if (onWall(it.type)) {
      if (footprint(it).some(([x, y]) => within(x, y))) return no(`Take the ${ITEMS[it.type].name} down first`);
      continue;
    }
    const tiles = footprint(it);
    const n = tiles.filter(([x, y]) => within(x, y)).length;
    if (n > 0 && n < tiles.length) return no('Something is in the way');
  }
  for (const room of t.rooms)
    if (room.windows.some((w) => within(w.x + w.dx, w.y + w.dy))) return no('A window is in the way');
  if (Math.min(r.w, r.h) < def.minShort || Math.max(r.w, r.h) < def.minLong)
    return no(`Too small: needs at least ${def.minShort}×${def.minLong}`);
  return OK;
}

/** The doorway on the room edge nearest a ground position. */
export function nearestDoor(r: Rect, fx: number, fy: number): Room['door'] {
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
 * that already exists, so it is judged as if that room had the new door. Any kind of room is judged the same.
 */
export function doorValid(world: World, r: Rect, door: Room['door'], replacing?: Room): Check {
  const ox = door.x + door.dx;
  const oy = door.y + door.dy;
  if (!world.inside(ox, oy) || world.zone[world.idx(ox, oy)] !== Z_CORRIDOR)
    return no('Doors must open onto a corridor');
  if (world.blocked[world.idx(ox, oy)]) return no('Something is blocking that doorway');
  if (replacing) {
    if (replacing.windows.some((w) => w.x === door.x && w.y === door.y && w.dx === door.dx && w.dy === door.dy))
      return no('There is a window there');
    if (world.blocked[world.idx(door.x, door.y)]) return no('Furniture is in the way inside the room');
    const hung = world.hungAt(door);
    if (hung) return no(`Take the ${ITEMS[hung.type].name} down first`);
  }
  const trial: RoomShape = { id: replacing?.id ?? 2147483000, x: r.x, y: r.y, w: r.w, h: r.h, door, windows: [] };
  const rooms = [...world.s.rooms.filter((x) => x !== replacing), trial];
  return world.connected(world.tryOut(rooms, world.s.items)) ? OK : no('That would block the way');
}

/**
 * Can a room take a new shape? Its new floor has to be free corridor inside the building, its furniture and the
 * spots it is used from have to stay inside, its door has to stay on a wall it can still open from, and nobody
 * may be cut off.
 */
export function resizeValid(world: World, room: Room, r: Rect): Check {
  const { s } = world;
  const def = ROOMS[room.type];
  if (sameRect(room, r)) return no('Drag a wall in or out');
  if (Math.min(r.w, r.h) < def.minShort || Math.max(r.w, r.h) < def.minLong)
    return no(`Too small: needs at least ${def.minShort}×${def.minLong}`);
  const ownDoorway = world.idx(room.door.x + room.door.dx, room.door.y + room.door.dy);
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (inRect(room, x, y)) continue;
      if (!world.inside(x, y)) return no('Must be inside the building');
      const i = world.idx(x, y);
      if (world.zone[i] !== Z_CORRIDOR) return no('Overlaps another room');
      if (world.blocked[i]) return no('Something is in the way');
      // the room's own doorway moves out of the way with the wall
      if (world.reserved[i] && i !== ownDoorway) return no('Keep doorways and access spots clear');
    }
  }
  const inside = s.items.filter((it) => world.zoneAt(it.x, it.y) === room.id);
  // what hangs on the walls moves with them, or is sold if its stretch of wall is gone
  for (const it of inside.filter((i) => !onWall(i.type))) {
    const spots = [...footprint(it)];
    for (let i = 0; i < ITEMS[it.type].access.length; i++) spots.push(accessTile(it, i));
    if (spots.some(([x, y]) => !inRect(r, x, y))) return no('The furniture has to stay inside: move it first');
  }
  // anything outside the room, like a rug, has to end up wholly on one side of the new walls
  for (const it of s.items) {
    if (inside.includes(it)) continue;
    if (footprint(it).some(([x, y]) => inRect(r, x, y)))
      return no(onWall(it.type) ? `Take the ${ITEMS[it.type].name} down first` : 'Something is in the way');
  }
  for (const other of s.rooms)
    if (other !== room && other.windows.some((w) => inRect(r, w.x + w.dx, w.y + w.dy)))
      return no('A window is in the way');
  const door = carryWallSpot(room.door, r);
  if (!door) return no('That would cut off the door: move it first');
  // try it: the door has to open onto corridor as things will be, and everyone and everything still be reached
  const resized: RoomShape = { id: room.id, x: r.x, y: r.y, w: r.w, h: r.h, door, windows: room.windows };
  const t = world.tryOut(
    s.rooms.map((x) => (x === room ? resized : x)),
    s.items,
  );
  const ox = door.x + door.dx;
  const oy = door.y + door.dy;
  if (!world.inside(ox, oy) || t.zone[world.idx(ox, oy)] !== Z_CORRIDOR)
    return no('The door must open onto a corridor');
  if (t.blocked[world.idx(ox, oy)]) return no('Something is blocking the doorway');
  return world.connected(t) ? OK : no('That would block the way');
}

/**
 * Can a room with this layout be put down here? Pass `moving` to judge it as if that room and its furniture had
 * been lifted out first. The floor has to be free corridor inside the building, the door has to open onto clear
 * corridor, and nobody and nothing may be cut off.
 */
export function layoutValid(world: World, type: RoomType, placed: PlacedLayout, moving?: Room): Check {
  // lift the room being moved, and its furniture, out first
  const rooms = world.s.rooms.filter((r) => r !== moving);
  const items = moving ? world.s.items.filter((it) => world.zoneAt(it.x, it.y) !== moving.id) : world.s.items;
  const lifted = moving ? world.tryOut(rooms, items) : world.asIs();
  const check = roomRectValid(world, type, placed.rect, lifted);
  if (!check.ok) return check;
  const { door } = placed;
  const ox = door.x + door.dx;
  const oy = door.y + door.dy;
  if (!world.inside(ox, oy) || lifted.zone[world.idx(ox, oy)] !== Z_CORRIDOR)
    return no('The door must open onto a corridor');
  if (lifted.blocked[world.idx(ox, oy)]) return no('Something is blocking the doorway');
  // a rug lies flat on the floor, but not on another rug, such as one left in the corridor
  const rugTiles = new Set(
    items.filter((it) => ITEMS[it.type].walkable).flatMap((it) => footprint(it).map(([tx, ty]) => world.idx(tx, ty))),
  );
  const rugs = placed.items.filter((it) => ITEMS[it.type].walkable);
  if (rugs.some((it) => footprint(it).some(([tx, ty]) => rugTiles.has(world.idx(tx, ty)))))
    return no('There is already a rug here');
  // try it: everyone and everything has to be reached with the room in its new place
  const { x, y, w, h } = placed.rect;
  const trial: RoomShape = { id: moving?.id ?? 2147483001, x, y, w, h, door, windows: [] };
  return world.connected(world.tryOut([...rooms, trial], [...items, ...placed.items]))
    ? OK
    : no('That would block the way');
}

/** Can this stretch of a room's wall take a window? */
export function windowValid(world: World, room: Room, spot: Room['door']): Check {
  const inside = spot.x >= room.x && spot.x < room.x + room.w && spot.y >= room.y && spot.y < room.y + room.h;
  const ox = spot.x + spot.dx;
  const oy = spot.y + spot.dy;
  const outside = ox < room.x || ox >= room.x + room.w || oy < room.y || oy >= room.y + room.h;
  if (!inside || !outside || Math.abs(spot.dx) + Math.abs(spot.dy) !== 1) return no("Windows go in the room's walls");
  const d = room.door;
  if (d.x === spot.x && d.y === spot.y && d.dx === spot.dx && d.dy === spot.dy) return no('The door is there');
  const hung = world.hungAt(spot);
  if (hung) return no(`Take the ${ITEMS[hung.type].name} down first`);
  // a window onto the room next door would just be a hole in two walls
  const beyond = world.zoneAt(ox, oy);
  if (beyond > 0 && beyond !== room.id) return no('Another room is on the other side');
  return OK;
}
