// Resizing a room by dragging one of its walls: which wall the cursor is on, and the room it drags out.

import type { Rect } from '../../core/world';
import type { Point } from './types';

/** One of a room's four walls. */
export type Edge = 'north' | 'south' | 'west' | 'east';

/** How close to a wall the cursor has to be to take hold of it, in tiles. */
const GRAB = 0.7;

/** The wall of a room the cursor is on or near, if any: the nearest, within reach and along its length. */
export function edgeNear(r: Rect, p: Point): Edge | null {
  const alongX = p.x > r.x - GRAB && p.x < r.x + r.w + GRAB;
  const alongY = p.y > r.y - GRAB && p.y < r.y + r.h + GRAB;
  const options: [number, Edge][] = [];
  if (alongX) options.push([Math.abs(p.y - r.y), 'north'], [Math.abs(p.y - (r.y + r.h)), 'south']);
  if (alongY) options.push([Math.abs(p.x - r.x), 'west'], [Math.abs(p.x - (r.x + r.w)), 'east']);
  const near = options.filter(([d]) => d < GRAB).sort((a, b) => a[0] - b[0]);
  return near[0]?.[1] ?? null;
}

/** The room with one wall dragged to the grid line nearest the cursor, never closing it up to nothing. */
export function dragEdge(room: Rect, edge: Edge, p: Point): Rect {
  // just the rectangle, even when handed a whole room
  const r: Rect = { x: room.x, y: room.y, w: room.w, h: room.h };
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  switch (edge) {
    case 'north': {
      const y = Math.min(Math.round(p.y), bottom - 1);
      return { ...r, y, h: bottom - y };
    }
    case 'south':
      return { ...r, h: Math.max(Math.round(p.y), r.y + 1) - r.y };
    case 'west': {
      const x = Math.min(Math.round(p.x), right - 1);
      return { ...r, x, w: right - x };
    }
    case 'east':
      return { ...r, w: Math.max(Math.round(p.x), r.x + 1) - r.x };
  }
}

/** The tiles along one wall of a room, just inside it, for showing which wall is in hand. */
export function edgeTiles(r: Rect, edge: Edge): [number, number][] {
  const tiles: [number, number][] = [];
  if (edge === 'north' || edge === 'south') {
    const y = edge === 'north' ? r.y : r.y + r.h - 1;
    for (let x = r.x; x < r.x + r.w; x++) tiles.push([x, y]);
  } else {
    const x = edge === 'west' ? r.x : r.x + r.w - 1;
    for (let y = r.y; y < r.y + r.h; y++) tiles.push([x, y]);
  }
  return tiles;
}
