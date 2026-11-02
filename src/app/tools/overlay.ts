// Working out which floor tiles to color for the tool in hand.

import type { PlacedLayout } from '../../core/room-layout';
import type { Room } from '../../core/state/types';
import { footprint, type Placed, type Rect } from '../../core/world';
import {
  type Marker,
  OV_BAD,
  OV_BLUE,
  OV_FREE,
  OV_GOOD,
  OV_GUEST,
  OV_STAFF,
  type OverlayTile,
} from '../../render/overlay-codes';
import { useSquares } from './squares';
import type { HeldItem, Tile } from './types';

/** Every tile of a rectangle, in one color. */
export function rectTiles(rect: Rect, code: number): OverlayTile[] {
  const tiles: OverlayTile[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) tiles.push([x, y, code]);
  return tiles;
}

/** The rooms someone is assigned to in green, and the room under the cursor in blue if they could work there, or red. */
export function assignTiles(assigned: readonly Room[], hover: Room | undefined, workable: boolean): OverlayTile[] {
  const tiles = assigned.flatMap((r) => rectTiles(r, OV_GOOD));
  if (hover && !assigned.includes(hover)) tiles.push(...rectTiles(hover, workable ? OV_BLUE : OV_BAD));
  return tiles;
}

/**
 * The tiles of a room being dragged out: red where something is in the way, and for the rest
 * green if the room as a whole is allowed or yellow if it is not yet.
 */
export function dragTiles(rect: Rect, allowed: boolean, isFree: (x: number, y: number) => boolean): OverlayTile[] {
  return rectTiles(rect, OV_GOOD).map(([x, y]) => {
    const free = isFree(x, y);
    return [x, y, free && allowed ? OV_GOOD : free ? OV_FREE : OV_BAD];
  });
}

/** What to draw for an item about to be put down: its footprint, then the squares it is used from. */
export function itemTiles(
  item: HeldItem & { x: number; y: number },
  fits: boolean,
): { tiles: OverlayTile[]; markers: Marker[] } {
  const tiles: OverlayTile[] = footprint(item).map(([x, y]) => [x, y, fits ? OV_GOOD : OV_BAD]);
  const markers: Marker[] = [];
  for (const sq of useSquares(item)) {
    tiles.push([sq.x, sq.y, sq.staff ? OV_STAFF : OV_GUEST]);
    markers.push({ x: sq.x, y: sq.y, icon: sq.icon });
  }
  return { tiles, markers };
}

/** A room about to be put down: its floor green if it fits there or red if not, with its furniture in blue. */
export function layoutTiles(placed: PlacedLayout, fits: boolean): OverlayTile[] {
  const furniture = new Set(placed.items.flatMap((it) => footprint(it).map(([x, y]) => `${x},${y}`)));
  return rectTiles(placed.rect, fits ? OV_GOOD : OV_BAD).map(([x, y, code]) => [
    x,
    y,
    furniture.has(`${x},${y}`) ? OV_BLUE : code,
  ]);
}

/** The edge of the square of tiles an extinguisher on a tile reaches doors from, as far as `reach` either way. */
export function reachEdge(x: number, y: number, reach: number): Tile[] {
  const tiles: Tile[] = [];
  for (let d = -reach; d <= reach; d++) tiles.push([x + d, y - reach], [x + d, y + reach]);
  for (let d = 1 - reach; d < reach; d++) tiles.push([x - reach, y + d], [x + reach, y + d]);
  return tiles;
}

/** Whether a room would have an extinguisher near its door, for what is marked on the floor for it. */
interface Covered {
  covered: boolean;
}

/**
 * What an extinguisher in hand marks on the floor: the edge of its reach in blue, each finished room's door, and each
 * machine that can catch fire, green or red by whether the room would have one near its door with this one down.
 */
export function fireMarks(
  edge: readonly Tile[],
  doors: readonly (Covered & { x: number; y: number })[],
  machines: readonly (Covered & Placed)[],
): OverlayTile[] {
  const tiles: OverlayTile[] = edge.map(([x, y]) => [x, y, OV_BLUE]);
  for (const d of doors) tiles.push([d.x, d.y, d.covered ? OV_GOOD : OV_BAD]);
  for (const m of machines) for (const [x, y] of footprint(m)) tiles.push([x, y, m.covered ? OV_GOOD : OV_BAD]);
  return tiles;
}
