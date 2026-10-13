// Turning where the cursor is into tiles and rectangles.

import type { ItemType } from '../../core/data';
import { itemDims, type Rect } from '../../core/world';
import type { Point, Tile } from './types';

/** The tile a point on the ground falls in. */
export function tileOf(p: Point): Tile {
  return [Math.floor(p.x), Math.floor(p.y)];
}

/** The rectangle of tiles between two corners, whichever way it was dragged. */
export function dragRect(start: Readonly<Tile>, end: Readonly<Tile>): Rect {
  return {
    x: Math.min(start[0], end[0]),
    y: Math.min(start[1], end[1]),
    w: Math.abs(end[0] - start[0]) + 1,
    h: Math.abs(end[1] - start[1]) + 1,
  };
}

/** The top-left tile for an item centered on the cursor. */
export function itemSpot(cursor: Point, type: ItemType, rot: number): Tile {
  const [w, h] = itemDims(type, rot);
  return [Math.floor(cursor.x - w / 2 + 0.5), Math.floor(cursor.y - h / 2 + 0.5)];
}
