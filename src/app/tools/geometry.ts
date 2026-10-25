// Turning where the cursor is into tiles and rectangles.

import type { ItemType } from '../../core/data';
import { itemCenter, itemDims, type Placed, type Rect, rotVec } from '../../core/world';
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

/**
 * The way to turn an item standing with its middle at a point so its front looks toward another item's middle, to the
 * nearest quarter turn. Looking at it exactly corner-on, it looks at the other item's front if that is one of the two
 * ways it could look, or else up or down the map. Null at the other item's middle, where there is no way to look.
 */
export function rotToward(x: number, y: number, target: Placed): number | null {
  const [cx, cy] = itemCenter(target);
  const dx = cx - x;
  const dy = cy - y;
  if (dx === 0 && dy === 0) return null;
  let way: Tile;
  if (Math.abs(dx) > Math.abs(dy)) way = [Math.sign(dx), 0];
  else if (Math.abs(dy) > Math.abs(dx)) way = [0, Math.sign(dy)];
  else {
    const [fx, fy] = rotVec(target.rot, 0, 1);
    way = fy === 0 && -fx === Math.sign(dx) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  }
  return [0, 1, 2, 3].findIndex((rot) => {
    const [fx, fy] = rotVec(rot, 0, 1);
    return fx === way[0] && fy === way[1];
  });
}
