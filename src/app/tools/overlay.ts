// Working out which floor tiles to color for the tool in hand.

import { footprint, type Rect } from '../../core/world';
import {
  type Marker,
  OV_BAD,
  OV_FREE,
  OV_GOOD,
  OV_GUEST,
  OV_STAFF,
  type OverlayTile,
} from '../../render/overlay-codes';
import { useSquares } from './squares';
import type { HeldItem } from './types';

/** Every tile of a rectangle, in one color. */
export function rectTiles(rect: Rect, code: number): OverlayTile[] {
  const tiles: OverlayTile[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) tiles.push([x, y, code]);
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
