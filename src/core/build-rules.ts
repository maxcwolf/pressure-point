// The build rules: where furniture can stand or hang, and where rooms, their doors and their windows can go. Each
// one reads the world's grids, and tries a change out on its scratch grids, without touching the game.

import { certificatesLeft } from './certificates';
import {
  centerOf,
  goesIn,
  isWatered,
  type ItemDef,
  ITEMS,
  type ItemType,
  ROOMS,
  roomsFor,
  type RoomType,
  SIDEWALK_Y,
} from './data';
import { doorstep, entranceSteps, type Footprint, spotInWall } from './footprint';
import { an } from './format';
import { plotAt, plotGroundAt, plotOffers } from './land';
import { carryWallSpot, farSide, inRect, sameRect } from './resize';
import { type Layout, type PlacedLayout, placeLayout } from './room-layout';
import { sameSpot } from './state/game';
import type { Room, Sketch, WallSpot } from './state/types';
import { layoutProblem } from './templates';
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
  type SketchFit,
  type Trial,
  wallSpotsOf,
  type World,
  Z_CORRIDOR,
  Z_OUTSIDE,
  Z_SCENERY,
} from './world';

const OK: Check = { ok: true, reason: '' };
/** A failed check, with the reason why. */
const no = (reason: string): Check => ({ ok: false, reason });

/** The sketch pencilled in over a tile, if any. */
export function sketchAt(world: World, x: number, y: number): Sketch | undefined {
  return world.s.sketches.find((sk) => inRect(sk, x, y));
}

/** The first sketch a rectangle covers any of, but the one numbered `spare` (a sketch being built), if any. */
export function sketchOverlap(world: World, r: Rect, spare?: number): Sketch | undefined {
  return world.s.sketches.find(
    (sk) => sk.id !== spare && sk.x < r.x + r.w && r.x < sk.x + sk.w && sk.y < r.y + r.h && r.y < sk.y + sk.h,
  );
}

/** Building over a sketch, turned down: the line names the room it is pencilled in for, and `sketch` which it is. */
export function onSketch(sk: Sketch): Check {
  return {
    ok: false,
    reason: `That's pencilled in for ${an(ROOMS[sk.type].name)}. Erase the sketch first.`,
    sketch: sk.id,
  };
}

/** Steps to the four straight neighbors. */
const DIRS4: readonly (readonly [dx: number, dy: number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Whether the room beyond a stretch of a room's wall has a window there, which comes through it. */
function windowNextDoor(world: World, spot: WallSpot): boolean {
  const beyond = world.zoneAt(spot.x + spot.dx, spot.y + spot.dy);
  return beyond > 0 && !!world.room(beyond)?.windows.some((w) => sameSpot(w, farSide(spot)));
}

/**
 * Can something hang on this stretch of wall, seen from the tile in front of it? Inside a room, on any of its walls
 * but where its door or a window is, its own or one next door's that comes through. In a corridor, only on the
 * building's outer wall, away from its windows and its entrances: the corridor side of a room's wall is never seen
 * standing tall.
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
    if (windowNextDoor(world, spot)) return no('There is a window there');
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
  if (def.where === 'outdoors') return no('Goes outdoors, not inside');
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

/** How many rows along the back of every lot are its boundary, a hedge or the beach huts, rather than grounds. */
export const BACK_ROWS = 2;

/**
 * Whether a tile is under the sign on the front lawn, which stands left of the path to the front door, in the two rows
 * out from the front wall. `signSpot()` in render/sign.ts puts it there.
 */
export function underSign(fp: Pick<Footprint, 'door' | 'front'>, x: number, y: number): boolean {
  const row = doorstep(fp);
  return x >= fp.door[0] - 6 && x <= fp.door[0] - 3 && y >= row && y <= row + 1;
}

/** Whether a tile is just outside an entrance, either side of its path, where the lamps on its pillars stand. */
export function besideEntrance(fp: Pick<Footprint, 'entrances'>, x: number, y: number): boolean {
  return fp.entrances.some((e) => {
    const [a, b] = entranceSteps(e).map((step) => step.outside);
    if (!a || !b) return false;
    const [ax, ay] = [b[0] - a[0], b[1] - a[1]];
    return (x === a[0] - ax && y === a[1] - ay) || (x === b[0] + ax && y === b[1] + ay);
  });
}

/**
 * Is a tile part of the center's own grounds, where something can stand out of doors? Outside every building, on the
 * lot clear of its edges, off the street and the paths, and on no plot, or the path to one, that is not the game's yet
 * or that the builders are at; and not where the sign or an entrance's lamps stand.
 */
export function onGrounds(world: World, x: number, y: number): Check {
  if (!world.onMap(x, y) || x < 1 || x > world.w - 2 || y < BACK_ROWS) return no('Keep it on your own grounds');
  if (world.inside(x, y)) return no('Goes outdoors, not inside');
  if (y >= SIDEWALK_Y) return no('Keep it off the street');
  if (world.zoneAt(x, y) !== Z_SCENERY) return no('Keep it off the paths');
  const { s } = world;
  const sketch = sketchAt(world, x, y);
  if (sketch) return onSketch(sketch);
  // a plot not yet built on is kept clear, and so is the path it will have
  const plot = plotGroundAt(centerOf(s).plots, x, y);
  if (plot)
    return no(
      s.land.some((l) => l.plot === plot.id && l.ready !== undefined)
        ? 'The builders are at work there'
        : 'That land is not yours yet',
    );
  if (underSign(world.building, x, y)) return no('The sign stands there');
  if (besideEntrance(world.building, x, y)) return no('Too close to the entrance');
  return OK;
}

/** Whether something needs a Caretaker now and then: it wears, gets grubby, or needs watering. */
const tended = (def: ItemDef) => !!def.wear || !!def.dailyWear || !!def.dirt || isWatered(def.type);

/**
 * Can something that goes outdoors stand here? On the grounds, clear, used from a path or the pavement, and with one
 * beside it if a Caretaker has to get to it: nobody walks on the grass.
 */
function canPlaceOutdoors(world: World, it: Placed): Check {
  const { s } = world;
  const def = ITEMS[it.type];
  const tiles = footprint(it);
  for (const [tx, ty] of tiles) {
    const ground = onGrounds(world, tx, ty);
    if (!ground.ok) return ground;
    if (world.blocked[world.idx(tx, ty)]) return no('Something is in the way');
  }
  /** Whether a tile is paving someone can stand on. */
  const paved = (x: number, y: number) => world.zoneAt(x, y) === Z_OUTSIDE && world.walkable(x, y);
  for (let i = 0; i < def.access.length; i++) {
    const [ax, ay] = accessTile(it, i);
    if (!paved(ax, ay)) return no('Needs a path or the pavement to use it from (R rotates)');
  }
  if (tended(def) && !tiles.some(([tx, ty]) => DIRS4.some(([dx, dy]) => paved(tx + dx, ty + dy))))
    return no('Needs a path or the pavement beside it, for a Caretaker');
  return world.connected(world.tryOut(s.rooms, [...s.items, it])) ? OK : no('That would block the way');
}

/** Can this item go here, facing this way? */
export function canPlaceItem(world: World, type: ItemType, x: number, y: number, rot: number, roomId?: number): Check {
  const { s } = world;
  if (type === 'certificate' && !certificatesLeft(s).length)
    return no('Win an award at the year-end ceremony to earn one');
  if (ITEMS[type].where === 'outdoors')
    return roomId === undefined ? canPlaceOutdoors(world, { type, x, y, rot }) : no('Goes outdoors, not in a room');
  const def = ITEMS[type];
  const it: Placed = { type, x, y, rot };
  const tiles = footprint(it);
  // nothing goes on a room pencilled in, nor is used from it: hung on a wall, it covers the floor in front
  const spots = onWall(type) ? tiles : [...tiles, ...def.access.map((_, i) => accessTile(it, i))];
  for (const [tx, ty] of spots) {
    const sketch = sketchAt(world, tx, ty);
    if (sketch) return onSketch(sketch);
  }
  if (onWall(type)) return canHang(world, type, x, y, rot, roomId);
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

/**
 * The windows of the rooms next door, other than `moving`, that a room put down from a layout takes out. A window
 * looking onto it comes through into it, unless the layout hangs something on that stretch of its wall.
 */
export function windowsOnto(world: World, placed: PlacedLayout, moving?: Room): WallSpot[] {
  const hung = placed.items.filter((it) => onWall(it.type)).flatMap((it) => wallSpotsOf(it));
  return world.s.rooms
    .filter((room) => room !== moving)
    .flatMap((room) => room.windows.filter((w) => hung.some((h) => sameSpot(h, farSide(w)))));
}

/**
 * Can a room of this type cover this rectangle, in the game as it is or in a what-if? A window next door looking out
 * onto it is no bar: it comes through into the room.
 */
export function roomRectValid(
  world: World,
  type: RoomType,
  r: Rect,
  t: Trial = world.asIs(),
  /** A sketch that may be built over: the one this room is being built from. */
  spare?: number,
): Check {
  const def = ROOMS[type];
  const sketch = sketchOverlap(world, r, spare);
  if (sketch) return onSketch(sketch);
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
  if (Math.min(r.w, r.h) < def.minShort || Math.max(r.w, r.h) < def.minLong)
    return no(`Too small: needs at least ${def.minShort}×${def.minLong}`);
  return OK;
}

/**
 * Whether a room of a type would fit anywhere in the building at its smallest, either way round, as things stand: the
 * floor alone, before a door is chosen. Nowhere, and the room for it has to come from land, or from the rooms there are.
 */
export function roomFitsAnywhere(world: World, type: RoomType): boolean {
  const def = ROOMS[type];
  const t = world.asIs();
  const b = world.building.bounds;
  const ways: [number, number][] = [
    [def.minShort, def.minLong],
    [def.minLong, def.minShort],
  ];
  for (const [w, h] of ways)
    for (let y = b.y0; y + h - 1 <= b.y1; y++)
      for (let x = b.x0; x + w - 1 <= b.x1; x++) if (roomRectValid(world, type, { x, y, w, h }, t).ok) return true;
  return false;
}

/**
 * Can a room of this type be pencilled in over this rectangle? Inside the building, wherever the room itself could go
 * today; or wholly on one plot of land not the game's yet, clear of any other sketch, at the room's smallest or more.
 * Never half in and half out, nor anywhere else outdoors. `spare` is a sketch being moved, which is no bar to itself.
 */
export function sketchRectValid(world: World, type: RoomType, r: Rect, spare?: number): Check {
  const def = ROOMS[type];
  let indoors = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (world.inside(x, y)) indoors++;
  // no sketch may stand in another's doorway, so none blocks another the day it is built
  const doorway = world.s.sketches.find(
    (sk) => sk.id !== spare && inRect(r, sk.door.x + sk.door.dx, sk.door.y + sk.door.dy),
  );
  if (doorway) return onSketch(doorway);
  if (indoors === r.w * r.h) return roomRectValid(world, type, r, world.asIs(), spare);
  if (indoors > 0) return no('Keep it all inside the building, or all on one plot for sale');
  const plots = centerOf(world.s).plots;
  const plot = plotAt(plots, r.x, r.y);
  const owned = plotOffers(world.s, world.building).find((o) => o.def.id === plot?.id)?.state === 'owned';
  if (!plot || owned) return no('Must be inside the building, or on land for sale');
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) if (plotAt(plots, x, y) !== plot) return no('Keep it on one plot for sale');
  const sketch = sketchOverlap(world, r, spare);
  if (sketch) return onSketch(sketch);
  if (Math.min(r.w, r.h) < def.minShort || Math.max(r.w, r.h) < def.minLong)
    return no(`Too small: needs at least ${def.minShort}×${def.minLong}`);
  return OK;
}

/**
 * Can a sketch have its door here? Inside the building, wherever the room's door could go today; on land for sale, any
 * edge will do for now, as there is nothing there yet for it to open onto, but another sketch.
 */
export function sketchDoorValid(world: World, r: Rect, door: Room['door']): Check {
  if (world.inside(door.x, door.y)) return doorValid(world, r, door);
  const onto = sketchAt(world, door.x + door.dx, door.y + door.dy);
  return onto ? onSketch(onto) : OK;
}

/**
 * What keeps a room remembered by a sketch from being built anywhere, or '' if nothing does: furniture this version does
 * not know, as in a template from a newer one, or a layout the game no longer allows.
 */
export function sketchLayoutProblem(l: Layout): string {
  if (!Object.hasOwn(ROOMS, l.type) || l.items.some((it) => !Object.hasOwn(ITEMS, it.type)))
    return "This template needs items this version doesn't have";
  return layoutProblem(l);
}

/**
 * Can a template be pencilled in here, put down as it would be built? Where building it could go today, by
 * `layoutValid`, and, as for any sketch, not in another sketch's doorway. `spare` is a sketch being moved.
 */
export function templateSketchValid(world: World, layout: Layout, placed: PlacedLayout, spare?: number): Check {
  const doorway = world.s.sketches.find(
    (sk) => sk.id !== spare && inRect(placed.rect, sk.door.x + sk.door.dx, sk.door.y + sk.door.dy),
  );
  if (doorway) return onSketch(doorway);
  const problem = sketchLayoutProblem(layout);
  if (problem) return no(problem);
  return layoutValid(world, layout.type, placed, undefined, spare);
}

/**
 * Whether a sketch could be built where it is today, and where it stands: on land not built on yet, it waits; inside,
 * its floor has to be free but for itself, and its door able to open onto free corridor without cutting anyone off. A
 * sketch that remembers a room is judged as building that room whole there would be.
 */
export function sketchFit(world: World, sk: Sketch): SketchFit {
  if (!world.inside(sk.x, sk.y)) {
    const plot = plotAt(centerOf(world.s).plots, sk.x, sk.y);
    const building = world.s.land.some((l) => l.plot === plot?.id && l.ready !== undefined);
    return {
      fit: no(building ? 'The builders are at work there' : 'That land is not yours yet'),
      standing: 'waits',
    };
  }
  // a room remembered that this version cannot build no longer fits anywhere, until it is forgotten
  const problem = sk.layout && sketchLayoutProblem(sk.layout);
  if (problem) return { fit: no(problem), standing: 'unfit' };
  const floor = roomRectValid(world, sk.type, sk, world.asIs(), sk.id);
  if (!floor.ok) return { fit: floor, standing: 'unfit' };
  // a room remembered is judged as building it whole would be, so amber means what Build here would say
  const door = sk.layout
    ? layoutValid(world, sk.type, placeLayout(sk.layout, sk.x, sk.y), undefined, sk.id)
    : doorValid(world, sk, sk.door);
  if (door.ok) return { fit: OK, standing: 'fits' };
  // the room would cut someone off, with its doorway itself clear: the room no longer fits, rather than its door
  const [ox, oy] = [sk.door.x + sk.door.dx, sk.door.y + sk.door.dy];
  const clear =
    world.inside(ox, oy) && world.zoneAt(ox, oy) === Z_CORRIDOR && !world.blocked[world.idx(ox, oy)] && !door.sketch;
  return { fit: door, standing: clear ? 'unfit' : 'doorway' };
}

/** Whether a sketch could be built where it is today. */
export const sketchFits = (world: World, sk: Sketch): Check => sketchFit(world, sk).fit;

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
  // a door onto a room pencilled in would be blocked the day it is built
  const onto = sketchAt(world, ox, oy);
  if (onto) return onSketch(onto);
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
  const sketch = sketchOverlap(world, r);
  if (sketch) return onSketch(sketch);
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
  const onto = sketchAt(world, ox, oy);
  if (onto) return onSketch(onto);
  return world.connected(t) ? OK : no('That would block the way');
}

/**
 * Can a room with this layout be put down here? Pass `moving` to judge it as if that room and its furniture had
 * been lifted out first. The floor has to be free corridor inside the building, the door has to open onto clear
 * corridor, and nobody and nothing may be cut off. A window next door looking onto the floor is no bar: it comes
 * through into the room, or is taken out if the layout hangs something there.
 */
export function layoutValid(
  world: World,
  type: RoomType,
  placed: PlacedLayout,
  moving?: Room,
  /** A sketch that may be built over: the one this room is being built from. */
  spare?: number,
): Check {
  // lift the room being moved, and its furniture, out first
  const rooms = world.s.rooms.filter((r) => r !== moving);
  const items = moving ? world.s.items.filter((it) => world.zoneAt(it.x, it.y) !== moving.id) : world.s.items;
  const lifted = moving ? world.tryOut(rooms, items) : world.asIs();
  const check = roomRectValid(world, type, placed.rect, lifted, spare);
  if (!check.ok) return check;
  const { door } = placed;
  const ox = door.x + door.dx;
  const oy = door.y + door.dy;
  if (!world.inside(ox, oy) || lifted.zone[world.idx(ox, oy)] !== Z_CORRIDOR)
    return no('The door must open onto a corridor');
  if (lifted.blocked[world.idx(ox, oy)]) return no('Something is blocking the doorway');
  const onto = sketchAt(world, ox, oy);
  if (onto) return onSketch(onto);
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
  // a window onto the room next door goes through both walls, so the far side has to be free too
  if (windowNextDoor(world, spot)) return no('There is a window there');
  const hung = world.hungAt(spot) ?? world.hungAt(farSide(spot));
  if (hung) return no(`Take the ${ITEMS[hung.type].name} down first`);
  return OK;
}
