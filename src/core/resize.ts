// A room's floor: what building it at a size costs, where its door and windows end up when its walls move, and what
// the change costs. Plain functions of the room and the new rectangle, so they can be tested without a game.

import { ROOM_TILE_COST, ROOMS, type RoomType } from './data';
import type { Room, WallSpot } from './state/types';
import type { Rect } from './world';

/** The tiles of floor a room has beyond the smallest a room of its kind can be: what its prestige counts for size. */
export function extraTiles(type: RoomType, size: { w: number; h: number }): number {
  const def = ROOMS[type];
  return Math.max(0, size.w * size.h - def.minShort * def.minLong);
}

/** The floor a room's price covers: one tile more each way than the smallest a room of its kind can be, 4×4 for 3×3. */
export function coveredTiles(type: RoomType): number {
  const def = ROOMS[type];
  return (def.minShort + 1) * (def.minLong + 1);
}

/** The tiles of floor a room has past what its price covers: the floor it pays for, at build or by resizing. */
export function paidTiles(type: RoomType, size: { w: number; h: number }): number {
  return Math.max(0, size.w * size.h - coveredTiles(type));
}

/** The size a room's price covers, as words: "4×4". */
export function coveredSize(type: RoomType): string {
  const def = ROOMS[type];
  return `${def.minShort + 1}×${def.minLong + 1}`;
}

/**
 * What building a room at a size costs: its price, which comes with its required furniture and floor up to one tile
 * more each way than its smallest, and every tile past that at the price a resize charges, so the prestige of a room
 * bigger than that is paid for however it got its floor.
 */
export const roomCost = (type: RoomType, size: { w: number; h: number }) =>
  ROOMS[type].cost + paidTiles(type, size) * ROOM_TILE_COST;

/** Whether a tile is inside a rectangle. */
export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Whether two rectangles are the same. */
export function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/**
 * Where a door or window ends up when its wall moves to a room's new edge: the same distance along the wall, on
 * the new wall. Null if the new wall no longer reaches that far.
 */
export function carryWallSpot(spot: WallSpot, to: Rect): WallSpot | null {
  if (spot.dy !== 0) {
    if (spot.x < to.x || spot.x >= to.x + to.w) return null;
    return { ...spot, y: spot.dy < 0 ? to.y : to.y + to.h - 1 };
  }
  if (spot.y < to.y || spot.y >= to.y + to.h) return null;
  return { ...spot, x: spot.dx < 0 ? to.x : to.x + to.w - 1 };
}

/** How many tiles a resize adds to a room, and how many it takes away, wherever they are. */
export function tilesChanged(room: Rect, to: Rect): { added: number; removed: number } {
  let added = 0;
  for (let y = to.y; y < to.y + to.h; y++) for (let x = to.x; x < to.x + to.w; x++) if (!inRect(room, x, y)) added++;
  let removed = 0;
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++) if (!inRect(to, x, y)) removed++;
  return { added, removed };
}

/**
 * The floor a resize pays for and gives back, as building charges for it: floor up to what the room's price covers
 * is free either way, and only floor past it is paid for. The room already holds what it has paid for (`bought`), and
 * any floor it has past what its price covers: a room built before floor was charged had that for nothing, and a
 * resize charges only for floor beyond it. Floor paid for comes back only when the room is made smaller, and never
 * more than was paid.
 */
export function resizeTiles(room: Rect & { type: RoomType; bought?: number }, to: Rect) {
  const bought = room.bought ?? 0;
  const held = Math.max(bought, paidTiles(room.type, room));
  const need = paidTiles(room.type, to);
  const added = Math.max(0, need - held);
  const refunded = to.w * to.h < room.w * room.h ? Math.max(0, bought - need) : 0;
  return { added, refunded, bought: bought + added - refunded };
}

/**
 * What a resize costs: the floor past what the room's price covers that it adds, at full price, less half back for
 * floor paid for that it gives up. Negative is a refund.
 */
export function resizeCost(room: Rect & { type: RoomType; bought?: number }, to: Rect): number {
  const { added, refunded } = resizeTiles(room, to);
  return added * ROOM_TILE_COST - refunded * (ROOM_TILE_COST / 2);
}

/** The room's windows after a resize: carried along with their walls, less any whose stretch of wall is gone. */
export function carryWindows(room: Room, to: Rect): WallSpot[] {
  return room.windows.flatMap((w) => {
    const moved = carryWallSpot(w, to);
    return moved ? [moved] : [];
  });
}
