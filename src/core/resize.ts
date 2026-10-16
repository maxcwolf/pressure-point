// Resizing a room: where its door and windows end up when its walls move, and what the change costs.
// Plain functions of the room and the new rectangle, so they can be tested without a game.

import { ROOM_TILE_COST } from './data';
import type { Room, WallSpot } from './state/types';
import type { Rect } from './world';

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

/** How many tiles a resize adds to a room, and how many it takes away. */
export function tilesChanged(room: Rect, to: Rect): { added: number; removed: number } {
  let added = 0;
  for (let y = to.y; y < to.y + to.h; y++) for (let x = to.x; x < to.x + to.w; x++) if (!inRect(room, x, y)) added++;
  let removed = 0;
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++) if (!inRect(to, x, y)) removed++;
  return { added, removed };
}

/**
 * The floor a resize pays for and gives back. A room costs the same at any size it is first built, so only floor
 * bought since, by earlier resizes (`bought`) or by this one, comes back when it is taken away: otherwise building
 * a room big and shrinking it would pay out for floor that was never paid for.
 */
export function resizeTiles(room: Rect & { bought?: number }, to: Rect) {
  const { added, removed } = tilesChanged(room, to);
  const refunded = Math.min(removed, (room.bought ?? 0) + added);
  return { added, refunded, bought: (room.bought ?? 0) + added - refunded };
}

/**
 * What a resize costs: the tiles added at full price, less half back for bought tiles taken away. Negative is a
 * refund.
 */
export function resizeCost(room: Rect & { bought?: number }, to: Rect): number {
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
