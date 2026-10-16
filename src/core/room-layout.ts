// A room's layout: its type, size, door, windows and furniture, measured from its top-left corner. Moving or copying
// a room picks its layout up, turns it if wanted, and puts it down somewhere else. Plain functions of the layout, so
// they can be tested without a game.

import { ITEMS, type ItemType, ROOMS, type RoomType, type RugPatternId, WINDOW_COST } from './data';
import type { Item, Room, RoomDecor, WallSpot } from './state/types';
import { itemDims, type Rect } from './world';

/** A piece of furniture in a layout: what it is, where from the room's corner, and which way it faces. */
export interface LayoutItem {
  type: ItemType;
  x: number;
  y: number;
  rot: number;
  /** A rug's pattern, if it has one. */
  pattern?: RugPatternId;
}

/** A room's shape, contents and look, measured from its top-left corner. */
export interface Layout extends RoomDecor {
  type: RoomType;
  w: number;
  h: number;
  door: WallSpot;
  windows: WallSpot[];
  items: LayoutItem[];
}

/** A layout put down at a spot: the room's rectangle, door and windows, and its furniture, on the map. */
export interface PlacedLayout {
  rect: Rect;
  door: WallSpot;
  windows: WallSpot[];
  items: LayoutItem[];
}

/** A wall spot moved by an offset. */
const shift = (s: WallSpot, x: number, y: number): WallSpot => ({ x: s.x + x, y: s.y + y, dx: s.dx, dy: s.dy });

/** The layout of a room and the furniture in it. */
export function layoutOf(room: Room, items: readonly Item[]): Layout {
  return {
    type: room.type,
    w: room.w,
    h: room.h,
    door: shift(room.door, -room.x, -room.y),
    windows: room.windows.map((w) => shift(w, -room.x, -room.y)),
    items: items.map((it) => ({
      type: it.type,
      x: it.x - room.x,
      y: it.y - room.y,
      rot: it.rot,
      ...(it.pattern && { pattern: it.pattern }),
    })),
    ...(room.floor && { floor: room.floor }),
    ...(room.wall && { wall: room.wall }),
  };
}

/** A wall spot in a room `h` tiles tall, turned a quarter turn the way furniture turns. */
function turnSpot(s: WallSpot, h: number): WallSpot {
  return { x: h - 1 - s.y, y: s.x, dx: -s.dy || 0, dy: s.dx };
}

/** A layout turned a quarter turn, the same way R turns furniture: everything in it turns with it. */
export function turnLayout(l: Layout): Layout {
  return {
    ...l,
    type: l.type,
    w: l.h,
    h: l.w,
    door: turnSpot(l.door, l.h),
    windows: l.windows.map((w) => turnSpot(w, l.h)),
    items: l.items.map((it) => {
      const [, fh] = itemDims(it.type, it.rot);
      return { ...it, x: l.h - it.y - fh, y: it.x, rot: (it.rot + 1) & 3 };
    }),
  };
}

/** A layout put down with its top-left corner at a tile. */
export function placeLayout(l: Layout, x: number, y: number): PlacedLayout {
  return {
    rect: { x, y, w: l.w, h: l.h },
    door: shift(l.door, x, y),
    windows: l.windows.map((w) => shift(w, x, y)),
    items: l.items.map((it) => ({ ...it, x: it.x + x, y: it.y + y })),
  };
}

/** Where a layout's top-left corner goes for it to sit centered on a point on the ground. */
export function cornerFor(l: Layout, at: { x: number; y: number }): [number, number] {
  return [Math.round(at.x - l.w / 2), Math.round(at.y - l.h / 2)];
}

/** What building a copy of a layout costs: the room, with its required furniture, then any extras and windows. */
export function copyCost(l: Layout): number {
  const free = [...ROOMS[l.type].required];
  let extras = 0;
  for (const it of l.items) {
    const at = free.indexOf(it.type);
    if (at >= 0) free.splice(at, 1);
    else extras += ITEMS[it.type].cost;
  }
  return ROOMS[l.type].cost + extras + l.windows.length * WINDOW_COST;
}
